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
        
        // Set up proper touch and scroll handling
        this.setupScrollHandling();
        
        this.setupControls();
        this.setupCanvas();
        this.setupTouchHandling();
        this.generate(true); // true = initialize with new seed
    }

    setupScrollHandling() {
        // Get the container element
        const container = document.querySelector('.container');
        
        // Prevent default touch behaviors except on the container
        document.addEventListener('touchmove', (e) => {
            // Allow scrolling on the container and its children
            if (!container.contains(e.target) || e.target.type === 'range') {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevent pull-to-refresh on mobile
        document.body.style.overscrollBehavior = 'none';
        
        // Fix for iOS Safari to allow container scrolling
        if (container) {
            container.addEventListener('touchstart', (e) => {
                // Don't prevent default on container to allow scrolling
                return true;
            }, { passive: true });
        }
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
        // Track touch start position to determine if it's a tap or scroll
        let touchStartY = 0;
        let isTap = false;
        
        // Handle canvas touch events to allow scrolling
        [this.perlinCanvas, this.gameCanvas].forEach(canvas => {
            // On touch start, record position
            canvas.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
                isTap = true;
                // Don't prevent default to allow scrolling
            }, { passive: true });
            
            // On touch move, determine if it's a scroll or interaction
            canvas.addEventListener('touchmove', (e) => {
                const touchY = e.touches[0].clientY;
                const deltaY = Math.abs(touchY - touchStartY);
                
                // If vertical movement is significant, it's a scroll
                if (deltaY > 10) {
                    isTap = false;
                    // Don't prevent default to allow scrolling
                    return true;
                } else {
                    // It's likely an interaction with the canvas, prevent default
                    e.preventDefault();
                }
            }, { passive: false });
            
            // On touch end, handle tap if it was a tap
            canvas.addEventListener('touchend', (e) => {
                if (isTap) {
                    // It was a tap, prevent default to avoid unwanted actions
                    e.preventDefault();
                }
                // Reset tap state
                isTap = false;
            }, { passive: false });
        });
        
        // Prevent scrolling when interacting with range inputs
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(input => {
            input.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
            }, { passive: false });
            
            input.addEventListener('touchmove', (e) => {
                e.stopPropagation();
                e.preventDefault();
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
                        // Convert to float with 2 decimal places for smoother transitions
                        const persistenceValue = numValue / 100;
                        displayValue = persistenceValue.toFixed(2);
                        this.persistence = persistenceValue;
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
                
                // For persistence slider, use debounced generation to avoid too many updates
                if (id === 'persistence') {
                    this.debouncedGenerate();
                } else {
                    this.generate(); // Generate on every change for other sliders
                }
            };

            // Handle input events
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

        // Create a debounced version of generate for smoother slider interaction
        this.debouncedGenerate = this.debounce(() => {
            this.generate();
        }, 50); // 50ms debounce time

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

    // Debounce helper function to limit how often a function is called
    debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
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

        // Draw isometric game-level visualization
        this.drawIsometricGameView();
    }

    drawIsometricGameView() {
        const canvasWidth = this.gameCanvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.gameCanvas.height / (window.devicePixelRatio || 1);
        
        // Set background gradient (sky)
        const skyGradient = this.gameCtx.createLinearGradient(0, 0, 0, canvasHeight);
        skyGradient.addColorStop(0, '#1a1a2a'); // Dark blue at top
        skyGradient.addColorStop(1, '#3a3a5a'); // Lighter blue at bottom
        this.gameCtx.fillStyle = skyGradient;
        this.gameCtx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Isometric projection parameters
        const tileWidth = 20;  // Base tile width
        const tileHeight = 10; // Base tile height
        const heightScale = 15; // Height scaling factor
        
        // Calculate grid size for isometric view (use fewer cells for performance)
        const isoGridSize = Math.min(20, this.gridSize);
        const scaleFactor = this.gridSize / isoGridSize;
        
        // Calculate starting position to center the isometric grid
        const startX = canvasWidth / 2;
        const startY = canvasHeight / 4;
        
        // Draw tiles from back to front (painter's algorithm)
        for (let y = 0; y < isoGridSize; y++) {
            for (let x = 0; x < isoGridSize; x++) {
                // Sample from the noise grid (with scaling)
                const sampleX = Math.floor(x * scaleFactor);
                const sampleY = Math.floor(y * scaleFactor);
                
                if (sampleX >= this.gridSize || sampleY >= this.gridSize) continue;
                
                const value = this.noiseGrid[sampleY][sampleX];
                const normalizedValue = (value + 1) / 2;
                
                // Determine tile type based on threshold
                const isSolid = normalizedValue < (0.5 + this.threshold);
                
                // Calculate isometric position
                const isoX = startX + (x - y) * tileWidth;
                const height = Math.floor(normalizedValue * heightScale);
                const isoY = startY + (x + y) * tileHeight / 2 - height;
                
                // Draw the tile based on its type
                this.drawIsometricTile(isoX, isoY, tileWidth, tileHeight, height, normalizedValue, isSolid);
            }
        }
        
        // Add atmospheric effects
        this.addAtmosphericEffects(canvasWidth, canvasHeight);
    }

    drawIsometricTile(x, y, width, height, tileHeight, normalizedValue, isWater) {
        // Colors for different tile types
        const waterColor = `rgb(0, ${Math.floor(100 + normalizedValue * 100)}, ${Math.floor(150 + normalizedValue * 100)})`;
        
        // Use persistence to influence land color variation - higher persistence = more varied terrain
        const variationFactor = Math.min(1, this.persistence * 2); // Scale up the effect
        const landColor = `rgb(
            ${Math.floor(50 + normalizedValue * 100 + (Math.random() * 20 - 10) * variationFactor)}, 
            ${Math.floor(100 + normalizedValue * 100 + (Math.random() * 20 - 10) * variationFactor)}, 
            ${Math.floor(normalizedValue * 50 + (Math.random() * 10 - 5) * variationFactor)}
        )`;
        
        const snowThreshold = 0.8;
        
        // Determine tile color based on height and type
        let topColor, leftColor, rightColor;
        
        if (isWater) {
            // Water tiles
            topColor = waterColor;
            leftColor = this.adjustBrightness(waterColor, -20);
            rightColor = this.adjustBrightness(waterColor, -40);
        } else {
            // Land tiles
            if (normalizedValue > snowThreshold) {
                // Snow-capped mountains
                topColor = '#ffffff';
            } else {
                // Regular land
                topColor = landColor;
            }
            
            leftColor = this.adjustBrightness(topColor, -20);
            rightColor = this.adjustBrightness(topColor, -40);
        }
        
        // Draw right face (darker)
        this.gameCtx.fillStyle = rightColor;
        this.gameCtx.beginPath();
        this.gameCtx.moveTo(x, y);
        this.gameCtx.lineTo(x + width, y + height / 2);
        this.gameCtx.lineTo(x + width, y + height / 2 + tileHeight);
        this.gameCtx.lineTo(x, y + tileHeight);
        this.gameCtx.closePath();
        this.gameCtx.fill();
        
        // Draw left face (medium)
        this.gameCtx.fillStyle = leftColor;
        this.gameCtx.beginPath();
        this.gameCtx.moveTo(x, y);
        this.gameCtx.lineTo(x - width, y + height / 2);
        this.gameCtx.lineTo(x - width, y + height / 2 + tileHeight);
        this.gameCtx.lineTo(x, y + tileHeight);
        this.gameCtx.closePath();
        this.gameCtx.fill();
        
        // Draw top face
        this.gameCtx.fillStyle = topColor;
        this.gameCtx.beginPath();
        this.gameCtx.moveTo(x, y);
        this.gameCtx.lineTo(x - width, y + height / 2);
        this.gameCtx.lineTo(x, y + height);
        this.gameCtx.lineTo(x + width, y + height / 2);
        this.gameCtx.closePath();
        this.gameCtx.fill();
        
        // Add details based on tile type and persistence
        if (!isWater) {
            // Higher persistence = more features
            const featureProbability = 0.3 + this.persistence * 0.5; // Scale with persistence
            
            if (normalizedValue > 0.6 && normalizedValue < snowThreshold) {
                // Add trees to higher land based on persistence
                if (Math.random() > (1 - featureProbability)) {
                    this.drawTree(x, y - 5, normalizedValue);
                }
            } else if (normalizedValue > 0.4 && normalizedValue <= 0.6) {
                // Add grass/bushes to mid-elevation land
                if (Math.random() > (1 - featureProbability * 0.7)) {
                    this.drawBush(x, y - 2, normalizedValue);
                }
            }
        }
    }

    drawTree(x, y, normalizedValue) {
        // Tree trunk
        this.gameCtx.fillStyle = '#8B4513';
        this.gameCtx.fillRect(x - 1, y - 8, 2, 8);
        
        // Tree foliage - more varied with higher persistence
        const variationFactor = Math.min(1, this.persistence * 2);
        const greenBase = Math.floor(100 + normalizedValue * 100);
        const greenVariation = Math.floor((Math.random() * 30 - 15) * variationFactor);
        const greenIntensity = Math.max(80, Math.min(200, greenBase + greenVariation));
        
        this.gameCtx.fillStyle = `rgb(0, ${greenIntensity}, 0)`;
        
        // Draw triangular foliage with slight randomness based on persistence
        const heightVariation = Math.floor(Math.random() * 5 * variationFactor);
        const widthVariation = Math.floor(Math.random() * 3 * variationFactor);
        
        this.gameCtx.beginPath();
        this.gameCtx.moveTo(x, y - (20 + heightVariation));
        this.gameCtx.lineTo(x - (6 + widthVariation), y - 8);
        this.gameCtx.lineTo(x + (6 + widthVariation), y - 8);
        this.gameCtx.closePath();
        this.gameCtx.fill();
    }

    drawBush(x, y, normalizedValue) {
        // Bush/grass color based on normalized value and persistence
        const greenIntensity = Math.floor(80 + normalizedValue * 120);
        const variationFactor = Math.min(1, this.persistence * 2);
        const redComponent = Math.floor(20 + Math.random() * 30 * variationFactor);
        
        this.gameCtx.fillStyle = `rgb(${redComponent}, ${greenIntensity}, 20)`;
        
        // Draw small bush/grass clump
        this.gameCtx.beginPath();
        this.gameCtx.arc(x, y - 3, 3 + Math.random() * 2, 0, Math.PI * 2);
        this.gameCtx.fill();
    }

    addAtmosphericEffects(width, height) {
        // Add sun or moon
        const centerX = width * 0.8;
        const centerY = height * 0.2;
        const radius = 15;
        
        // Sun glow
        const sunGradient = this.gameCtx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, radius * 2
        );
        sunGradient.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
        sunGradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.2)');
        sunGradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
        
        this.gameCtx.fillStyle = sunGradient;
        this.gameCtx.beginPath();
        this.gameCtx.arc(centerX, centerY, radius * 2, 0, Math.PI * 2);
        this.gameCtx.fill();
        
        // Sun/moon
        this.gameCtx.fillStyle = '#ffffa0';
        this.gameCtx.beginPath();
        this.gameCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.gameCtx.fill();
        
        // Add fog/mist over water areas
        this.gameCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.gameCtx.fillRect(0, height * 0.6, width, height * 0.4);
        
        // Add vignette effect
        const vignetteGradient = this.gameCtx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, width / 1.5
        );
        vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        
        this.gameCtx.fillStyle = vignetteGradient;
        this.gameCtx.fillRect(0, 0, width, height);
    }

    // Helper function to adjust color brightness
    adjustBrightness(color, percent) {
        if (color.startsWith('#')) {
            // Convert hex to RGB
            const r = parseInt(color.substr(1, 2), 16);
            const g = parseInt(color.substr(3, 2), 16);
            const b = parseInt(color.substr(5, 2), 16);
            return this.adjustRgbBrightness(r, g, b, percent);
        } else if (color.startsWith('rgb')) {
            // Parse RGB format
            const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                return this.adjustRgbBrightness(r, g, b, percent);
            }
        }
        return color;
    }

    adjustRgbBrightness(r, g, b, percent) {
        // Adjust RGB values by percentage
        r = Math.max(0, Math.min(255, r + percent));
        g = Math.max(0, Math.min(255, g + percent));
        b = Math.max(0, Math.min(255, b + percent));
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }
}

// Initialize the visualizer when the page loads
window.addEventListener('load', () => {
    // Fix for iOS Safari viewport issues
    const fixViewportHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    fixViewportHeight();
    window.addEventListener('resize', fixViewportHeight);
    
    // Initialize the visualizer
    new PerlinVisualizer();
});