/**
 * Perlin Noise Generator
 * 
 * A JavaScript implementation of Perlin noise with interactive controls
 * and game-level visualization.
 */

class PerlinNoise {
    constructor() {
        // Initialize permutation table
        this.perm = new Array(512);
        this.gradP = new Array(512);
        
        // Standard gradient vectors for 2D Perlin noise
        this.grad3 = [
            [1, 1], [-1, 1], [1, -1], [-1, -1],
            [1, 0], [-1, 0], [0, 1], [0, -1]
        ];
        
        this.seed(Math.random());
    }

    // Seed the noise function for consistent results
    seed(seed) {
        if (seed > 0 && seed < 1) {
            // Scale the seed out
            seed *= 65536;
        }

        seed = Math.floor(seed);
        if (seed < 256) {
            seed |= seed << 8;
        }

        // Create a permutation table with consistent pseudorandom values
        const p = new Array(256);
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }

        // Fisher-Yates shuffle with seeded random
        for (let i = 255; i > 0; i--) {
            // Use a simple LCG for deterministic randomness based on seed
            seed = (seed * 16807) % 2147483647;
            const r = Math.floor((seed / 2147483647) * (i + 1));
            
            // Swap elements
            const temp = p[i];
            p[i] = p[r];
            p[r] = temp;
        }

        // Duplicate for faster lookups
        for (let i = 0; i < 256; i++) {
            this.perm[i] = this.perm[i + 256] = p[i];
            // Assign gradient vectors
            this.gradP[i] = this.gradP[i + 256] = this.grad3[p[i] % 8];
        }
    }

    // Linear interpolation
    lerp(a, b, t) {
        return (1 - t) * a + t * b;
    }

    // Fade function as defined by Ken Perlin
    // 6t^5 - 15t^4 + 10t^3
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    // Calculate the dot product of a randomly selected gradient vector and the distance vector
    grad(hash, x, y) {
        // Get gradient vector from permutation
        const g = this.gradP[hash & 255];
        // Return the dot product
        return g[0] * x + g[1] * y;
    }

    // 2D Perlin Noise
    noise2D(x, y) {
        // Find unit grid cell containing point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        // Get relative xy coordinates of point within that cell
        x = x - Math.floor(x);
        y = y - Math.floor(y);

        // Compute fade curves for each of x, y
        const u = this.fade(x);
        const v = this.fade(y);

        // Hash coordinates of the 4 square corners
        const aa = this.perm[X] + Y;
        const ab = this.perm[X] + Y + 1;
        const ba = this.perm[X + 1] + Y;
        const bb = this.perm[X + 1] + Y + 1;

        // Calculate noise contributions from each corner
        // The correct way is to calculate dot products between gradient vectors
        // and the vectors from the corner to the point
        const g00 = this.grad(this.perm[aa], x, y);
        const g01 = this.grad(this.perm[ab], x, y - 1);
        const g10 = this.grad(this.perm[ba], x - 1, y);
        const g11 = this.grad(this.perm[bb], x - 1, y - 1);

        // Bilinear interpolation using the fade function for smoothing
        const nx0 = this.lerp(g00, g01, v);
        const nx1 = this.lerp(g10, g11, v);
        const nxy = this.lerp(nx0, nx1, u);

        // Return value in range [-1, 1]
        return nxy;
    }

    // Generate Perlin noise with multiple octaves (fractal Brownian motion)
    perlin2D(x, y, octaves, persistence, lacunarity) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        // Sum multiple noise functions with different frequencies and amplitudes
        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        // Return normalized value in [-1, 1]
        return total / maxValue;
    }
}

// Canvas setup
const perlinCanvas = document.getElementById('perlinCanvas');
const gameCanvas = document.getElementById('gameCanvas');
const perlinCtx = perlinCanvas.getContext('2d');
const gameCtx = gameCanvas.getContext('2d');

class PerlinVisualizer {
    constructor() {
        this.perlinCanvas = document.getElementById('perlinCanvas');
        this.gameCanvas = document.getElementById('gameCanvas');
        this.perlinCtx = this.perlinCanvas.getContext('2d');
        this.gameCtx = this.gameCanvas.getContext('2d');
        
        this.perlin = new PerlinNoise();
        this.noiseGrid = [];
        this.currentSeed = Math.random() * 65536;
        
        // Prevent scrolling on the entire document for embedded views
        this.preventDocumentScrolling();
        
        this.setupControls();
        this.setupCanvas();
        this.setupTouchHandling();
        this.generate(true); // true = initialize with new seed
    }

    preventDocumentScrolling() {
        // Prevent scrolling on touch devices
        document.addEventListener('touchmove', (e) => {
            if (e.target.tagName !== 'INPUT' && !e.target.classList.contains('container')) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevent scrolling with mouse wheel
        document.addEventListener('wheel', (e) => {
            if (e.target.tagName !== 'INPUT' && !e.target.classList.contains('container')) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevent pull-to-refresh on mobile
        document.body.style.overscrollBehavior = 'none';
    }

    setupCanvas() {
        // Set canvas size with device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        
        // Get container dimensions
        const perlinContainer = this.perlinCanvas.parentElement;
        const gameContainer = this.gameCanvas.parentElement;
        
        // Set logical size (CSS size)
        const perlinWidth = perlinContainer.clientWidth;
        const gameWidth = gameContainer.clientWidth;
        
        this.perlinCanvas.width = perlinWidth * dpr;
        this.perlinCanvas.height = 250 * dpr;
        this.gameCanvas.width = gameWidth * dpr;
        this.gameCanvas.height = 250 * dpr;
        
        // Scale context to match device pixel ratio
        this.perlinCtx.scale(dpr, dpr);
        this.gameCtx.scale(dpr, dpr);
        
        // Calculate cell size based on grid size
        this.cellSize = Math.min(perlinWidth, this.perlinCanvas.height) / this.gridSize;
    }

    setupTouchHandling() {
        // Prevent default touch behaviors on canvases
        this.perlinCanvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        this.gameCanvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        
        // Add touch event listeners for both canvases
        [this.perlinCanvas, this.gameCanvas].forEach(canvas => {
            canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
            canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
        });
        
        // Prevent scrolling when interacting with range inputs
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(input => {
            input.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            }, { passive: false });
            
            input.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            }, { passive: false });
        });
        
        // Improve touch handling for the legend toggle
        const legendToggle = document.querySelector('.legend-toggle');
        if (legendToggle) {
            legendToggle.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            }, { passive: false });
        }
    }

    setupControls() {
        this.gridSize = parseInt(document.getElementById('gridSize').value);
        this.scale = parseInt(document.getElementById('scale').value);
        this.octaves = parseInt(document.getElementById('octaves').value);
        this.persistence = parseInt(document.getElementById('persistence').value) / 100;
        this.lacunarity = parseInt(document.getElementById('lacunarity').value) / 10;
        this.threshold = parseInt(document.getElementById('threshold').value) / 100;

        // Update display values
        document.getElementById('gridSizeValue').textContent = this.gridSize;
        document.getElementById('scaleValue').textContent = this.scale;
        document.getElementById('octavesValue').textContent = this.octaves;
        document.getElementById('persistenceValue').textContent = this.persistence.toFixed(2);
        document.getElementById('lacunarityValue').textContent = this.lacunarity.toFixed(1);
        document.getElementById('thresholdValue').textContent = this.threshold.toFixed(2);

        // Setup event listeners with improved touch support
        const setupRangeInput = (id, suffix = '', multiplier = 1) => {
            const input = document.getElementById(id);
            const valueDisplay = document.getElementById(id + 'Value');
            
            const updateValue = (value) => {
                const numValue = parseInt(value);
                let displayValue;
                
                switch(id) {
                    case 'persistence':
                        displayValue = (numValue / 100).toFixed(2);
                        this.persistence = numValue / 100;
                        break;
                    case 'lacunarity':
                        displayValue = (numValue / 10).toFixed(1);
                        this.lacunarity = numValue / 10;
                        break;
                    case 'threshold':
                        displayValue = (numValue / 100).toFixed(2);
                        this.threshold = numValue / 100;
                        break;
                    default:
                        displayValue = numValue;
                        this[id] = numValue;
                }
                
                valueDisplay.textContent = displayValue + suffix;
                this.generate(); // Generate on every change
            };

            // Prevent text selection and scrolling during touch
            input.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                document.body.style.overflow = 'hidden'; // Disable scrolling
            }, { passive: false });
            
            input.addEventListener('touchend', () => {
                document.body.style.overflow = ''; // Re-enable scrolling
            });

            input.addEventListener('input', (e) => updateValue(e.target.value));
            
            // Improved touch handling for range inputs
            input.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = input.getBoundingClientRect();
                const value = ((touch.clientX - rect.left) / rect.width) * 
                    (parseInt(input.max) - parseInt(input.min)) + parseInt(input.min);
                
                // Clamp value to min/max range
                const clampedValue = Math.max(parseInt(input.min), 
                                     Math.min(parseInt(input.max), Math.round(value)));
                
                input.value = clampedValue;
                updateValue(input.value);
            }, { passive: false });
        };

        setupRangeInput('gridSize');
        setupRangeInput('scale');
        setupRangeInput('octaves');
        setupRangeInput('persistence', '', 100);
        setupRangeInput('lacunarity', '', 10);
        setupRangeInput('threshold', '', 100);

        // Handle window resize with debounce
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.setupCanvas();
                this.draw();
            }, 250); // Debounce resize events
        });
    }

    generate(newSeed = false) {
        // Add loading state
        const canvasContainer = document.querySelector('.canvas-container');
        canvasContainer.classList.add('loading');
        
        // Only generate a new seed if explicitly requested
        if (newSeed) {
            this.perlin.seed(this.currentSeed);
        }
        
        // Generate noise grid
        this.noiseGrid = new Array(this.gridSize);
        for (let y = 0; y < this.gridSize; y++) {
            this.noiseGrid[y] = new Array(this.gridSize);
            for (let x = 0; x < this.gridSize; x++) {
                // Generate noise value
                // Invert scale so higher values = more detail (zoomed in)
                // Use a base value of 110 to maintain similar range as before
                const zoomFactor = (110 - this.scale);
                const nx = x / zoomFactor;
                const ny = y / zoomFactor;
                
                // Get noise value in range [-1, 1]
                const value = this.perlin.perlin2D(
                    nx, 
                    ny, 
                    this.octaves, 
                    this.persistence, 
                    this.lacunarity
                );
                
                // Store the raw noise value
                this.noiseGrid[y][x] = value;
            }
        }

        this.draw();
        
        // Remove loading state
        setTimeout(() => {
            canvasContainer.classList.remove('loading');
        }, 100);
    }

    draw() {
        // Clear both canvases
        this.perlinCtx.clearRect(0, 0, this.perlinCanvas.width, this.perlinCanvas.height);
        this.gameCtx.clearRect(0, 0, this.gameCanvas.width, this.gameCanvas.height);

        // Calculate cell size based on canvas dimensions
        const perlinCellWidth = this.perlinCanvas.width / this.gridSize / (window.devicePixelRatio || 1);
        const perlinCellHeight = this.perlinCanvas.height / this.gridSize / (window.devicePixelRatio || 1);
        
        const gameCellWidth = this.gameCanvas.width / this.gridSize / (window.devicePixelRatio || 1);
        const gameCellHeight = this.gameCanvas.height / this.gridSize / (window.devicePixelRatio || 1);

        // Draw Perlin noise grid
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const value = this.noiseGrid[y][x];
                
                // Map noise value from [-1, 1] to [0, 1]
                const normalizedValue = (value + 1) / 2;
                
                // Determine if this cell is "solid" based on threshold
                const isSolid = normalizedValue < (0.5 + this.threshold);
                
                // Calculate color based on noise value
                const intensity = Math.floor(normalizedValue * 255);
                
                // Use a blue gradient for water/low areas and green/brown for land/high areas
                let color;
                if (isSolid) {
                    // Underwater/cave (blues)
                    color = `rgb(0, ${Math.floor(intensity * 0.7)}, ${Math.min(255, intensity + 100)})`;
                } else {
                    // Land (greens to browns)
                    const r = Math.min(255, Math.floor(intensity * 0.8 + 50));
                    const g = Math.min(255, Math.floor(intensity * 0.9 + 80));
                    const b = Math.floor(intensity * 0.5);
                    color = `rgb(${r}, ${g}, ${b})`;
                }
                
                // Draw cell on the noise canvas
                this.perlinCtx.fillStyle = color;
                this.perlinCtx.fillRect(
                    x * perlinCellWidth,
                    y * perlinCellHeight,
                    perlinCellWidth,
                    perlinCellHeight
                );
            }
        }

        // Draw game-level visualization with perspective
        const perspective = 0.7;
        const wallHeight = gameCellHeight * 2;
        const floorColor = '#1a1a1a';
        const wallColor = '#1a1a1a';
        const highlightColor = 'rgba(255, 255, 255, 0.1)';
        const shadowColor = 'rgba(0, 0, 0, 0.3)';

        // Draw floor
        this.gameCtx.fillStyle = floorColor;
        this.gameCtx.fillRect(0, 0, this.gameCanvas.width / (window.devicePixelRatio || 1), this.gameCanvas.height / (window.devicePixelRatio || 1));

        // Draw walls and floor tiles
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const value = this.noiseGrid[y][x];
                const normalizedValue = (value + 1) / 2;
                const isSolid = normalizedValue < (0.5 + this.threshold);
                
                const screenX = x * gameCellWidth;
                const screenY = y * gameCellHeight;

                if (isSolid) {
                    // Calculate wall color based on depth
                    const depthIntensity = normalizedValue * 2; // 0 to 1 range
                    const wallR = Math.floor(26 + depthIntensity * 20);
                    const wallG = Math.floor(26 + depthIntensity * 40);
                    const wallB = Math.floor(80 + depthIntensity * 175);
                    const wallColor = `rgb(${wallR}, ${wallG}, ${wallB})`;

                    // Draw wall
                    this.gameCtx.fillStyle = wallColor;
                    this.gameCtx.fillRect(
                        screenX,
                        screenY - wallHeight * perspective,
                        gameCellWidth,
                        wallHeight
                    );

                    // Add wall highlights
                    this.gameCtx.fillStyle = highlightColor;
                    this.gameCtx.fillRect(
                        screenX,
                        screenY - wallHeight * perspective,
                        gameCellWidth,
                        2
                    );
                    this.gameCtx.fillRect(
                        screenX,
                        screenY - wallHeight * perspective,
                        2,
                        wallHeight
                    );

                    // Add wall shadows
                    this.gameCtx.fillStyle = shadowColor;
                    this.gameCtx.fillRect(
                        screenX + gameCellWidth - 2,
                        screenY - wallHeight * perspective,
                        2,
                        wallHeight
                    );
                    this.gameCtx.fillRect(
                        screenX,
                        screenY - wallHeight * perspective + wallHeight - 2,
                        gameCellWidth,
                        2
                    );
                }

                // Draw floor tile with intensity based on noise value
                const floorIntensity = normalizedValue;
                this.gameCtx.fillStyle = isSolid ? 
                    shadowColor : 
                    `rgba(255, 255, 255, ${0.05 + floorIntensity * 0.1})`;
                this.gameCtx.fillRect(
                    screenX,
                    screenY,
                    gameCellWidth,
                    gameCellHeight
                );
            }
        }

        // Add ambient lighting effect
        const canvasWidth = this.gameCanvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.gameCanvas.height / (window.devicePixelRatio || 1);
        
        const gradient = this.gameCtx.createRadialGradient(
            canvasWidth / 2,
            canvasHeight / 2,
            0,
            canvasWidth / 2,
            canvasHeight / 2,
            canvasWidth / 2
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
        this.gameCtx.fillStyle = gradient;
        this.gameCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
}

// Initialize the visualizer when the page loads
window.addEventListener('load', () => {
    // Prevent scrolling on iOS Safari
    document.ontouchmove = (e) => {
        if (e.target.tagName !== 'INPUT' && !e.target.classList.contains('container')) {
            e.preventDefault();
        }
    };
    
    // Fix for iOS Safari viewport issues
    const fixViewportHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    fixViewportHeight();
    window.addEventListener('resize', fixViewportHeight);
    
    new PerlinVisualizer();
});