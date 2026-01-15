// ============================================
// Country Marbles - Physics-Based Flag Race
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Configuration - PORTRAIT 1080x1920
const CONFIG = {
    width: 1080,
    height: 1920,
    
    ring: {
        centerX: 0,
        centerY: 0,
        radius: 300,
        thickness: 20,
        gapAngle: 50 * (Math.PI / 180),
        rotationSpeed: 0.02,
        color: '#000000',
        glowColor: 'none'
    },
    
    physics: {
        flagSpeed: 5, // Faster flags
        gravity: 0.5,
        bounceDamping: 0.7,
        floorFriction: 0.8,
        stackingDamping: 0.5
    },
    
    flag: {
        width: 60,
        height: 45,
        hitboxRadius: 25
    },
    
    game: {
        resetDelay: 10000
    }
};

// Game State
const state = {
    flags: [],
    ringRotation: 0,
    gapStartAngle: Math.PI * 0.75, // Bottom-left position (around 7-8 o'clock)
    leaderboard: {},
    gamePhase: 'playing',
    winner: null,
    countries: [],
    flagImages: {}
};

// Flag class - NO ROTATION, uses PNG images, CONSTANT SPEED
class Flag {
    constructor(country, x, y, vx, vy) {
        this.country = country;
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = CONFIG.flag.hitboxRadius;
        this.width = CONFIG.flag.width;
        this.height = CONFIG.flag.height;
        this.isOut = false;
        this.isEliminated = false;
        this.speed = CONFIG.physics.flagSpeed; // Store constant speed
    }
    
    // Normalize velocity to constant speed
    normalizeSpeed() {
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed > 0) {
            this.vx = (this.vx / currentSpeed) * this.speed;
            this.vy = (this.vy / currentSpeed) * this.speed;
        }
    }
    
    update() {
        if (this.isEliminated) {
            this.vy += CONFIG.physics.gravity * 0.5;
            this.y += this.vy;
            this.x += this.vx;
            this.vx *= 0.95;
            
            if (this.y + this.radius > CONFIG.height - 10) {
                this.y = CONFIG.height - 10 - this.radius;
                this.vy *= -CONFIG.physics.stackingDamping;
                this.vx *= CONFIG.physics.floorFriction;
                if (Math.abs(this.vy) < 0.5) this.vy = 0;
            }
            return;
        }
        
        if (this.isOut) {
            // Gravity affects fallen flags
            this.vy += CONFIG.physics.gravity;
            this.x += this.vx;
            this.y += this.vy;
            
            if (this.y + this.radius > CONFIG.height - 10) {
                this.y = CONFIG.height - 10 - this.radius;
                this.vy *= -CONFIG.physics.bounceDamping;
                this.vx *= CONFIG.physics.floorFriction;
                if (Math.abs(this.vy) < 1 && Math.abs(this.vx) < 0.5) {
                    this.isEliminated = true;
                    this.vy = 0;
                    this.vx = 0;
                }
            }
            
            if (this.x - this.radius < 0) {
                this.x = this.radius;
                this.vx *= -1;
            }
            if (this.x + this.radius > CONFIG.width) {
                this.x = CONFIG.width - this.radius;
                this.vx *= -1;
            }
        } else {
            // Inside ring - constant speed linear movement
            this.normalizeSpeed(); // Always maintain constant speed
            this.x += this.vx;
            this.y += this.vy;
            this.handleRingCollision();
        }
    }
    
    // Check if angle is within the gap
    isInGap(angle) {
        // Gap starts at gapStartAngle + rotation
        const gapStart = state.gapStartAngle + state.ringRotation;
        const gapEnd = gapStart + CONFIG.ring.gapAngle;
        
        // Normalize all angles to 0-2PI
        let normAngle = angle % (Math.PI * 2);
        if (normAngle < 0) normAngle += Math.PI * 2;
        
        let normStart = gapStart % (Math.PI * 2);
        if (normStart < 0) normStart += Math.PI * 2;
        
        let normEnd = gapEnd % (Math.PI * 2);
        if (normEnd < 0) normEnd += Math.PI * 2;
        
        // Check if angle is between start and end
        if (normStart < normEnd) {
            return normAngle >= normStart && normAngle <= normEnd;
        } else {
            // Gap wraps around 0
            return normAngle >= normStart || normAngle <= normEnd;
        }
    }
    
    handleRingCollision() {
        const dx = this.x - CONFIG.ring.centerX;
        const dy = this.y - CONFIG.ring.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const boundaryDist = CONFIG.ring.radius - this.radius;
        
        // Only check collision if at or beyond boundary
        if (dist >= boundaryDist) {
            const angle = Math.atan2(dy, dx);
            
            if (this.isInGap(angle)) {
                // EXIT THROUGH GAP!
                this.isOut = true;
                // Push outward in the direction of the gap
                this.vx = Math.cos(angle) * this.speed * 1.5;
                this.vy = Math.sin(angle) * this.speed * 1.5;
                return;
            }
            
            // Bounce off wall - reflect velocity across the normal
            const nx = dx / dist;
            const ny = dy / dist;
            
            // Reflect: v' = v - 2(v·n)n
            const dot = this.vx * nx + this.vy * ny;
            if (dot > 0) { // Only if moving outward
                this.vx = this.vx - 2 * dot * nx;
                this.vy = this.vy - 2 * dot * ny;
            }
            
            // Push back inside the ring
            this.x = CONFIG.ring.centerX + nx * (boundaryDist - 1);
            this.y = CONFIG.ring.centerY + ny * (boundaryDist - 1);
            
            // Normalize to constant speed after bounce
            this.normalizeSpeed();
        }
    }
    
    draw() {
        const img = state.flagImages[this.country.code];
        if (img && img.complete) {
            ctx.drawImage(img, this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        } else {
            ctx.fillStyle = '#888';
            ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.country.code, this.x, this.y + 3);
        }
    }
    
    checkCollisionWith(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < this.radius + other.radius;
    }
    
    resolveCollisionWith(other) {
        // Only separate and redirect - NO speed change
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;
        
        const nx = dx / dist;
        const ny = dy / dist;
        
        // Separate the flags
        const overlap = (this.radius + other.radius - dist) / 2;
        this.x += nx * overlap;
        this.y += ny * overlap;
        other.x -= nx * overlap;
        other.y -= ny * overlap;
        
        // Swap velocity components along collision normal (elastic collision)
        // But maintain constant speed for each
        const dot1 = this.vx * nx + this.vy * ny;
        const dot2 = other.vx * nx + other.vy * ny;
        
        // Only swap if approaching
        if (dot1 - dot2 < 0) {
            // Remove normal components
            this.vx -= dot1 * nx;
            this.vy -= dot1 * ny;
            other.vx -= dot2 * nx;
            other.vy -= dot2 * ny;
            
            // Add swapped normal components
            this.vx += dot2 * nx;
            this.vy += dot2 * ny;
            other.vx += dot1 * nx;
            other.vy += dot1 * ny;
        }
        
        // Normalize both to constant speed
        this.normalizeSpeed();
        other.normalizeSpeed();
    }
}

// Initialize canvas size - FIXED PORTRAIT
function resizeCanvas() {
    canvas.width = 1080;
    canvas.height = 1920;
    CONFIG.width = 1080;
    CONFIG.height = 1920;
    
    CONFIG.ring.centerX = 540;
    CONFIG.ring.centerY = 620;
    CONFIG.ring.radius = 400;
}

// Draw the rotating ring with gap
function drawRing() {
    const { centerX, centerY, radius, thickness, gapAngle, color } = CONFIG.ring;
    const gapStart = state.gapStartAngle + state.ringRotation;
    const gapEnd = gapStart + gapAngle;
    
    // Draw dark ring arc (from gap end to gap start, going the long way around)
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, gapEnd, gapStart + Math.PI * 2, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
}

// Draw floor (invisible - just for collision)
function drawFloor() {
    // No visible floor - just collision boundary
}

// Initialize flags - use ALL countries
function initFlags() {
    state.flags = [];
    
    // Use ALL countries
    state.countries.forEach(country => {
        // Random position inside ring (spread them out)
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (CONFIG.ring.radius - 60) + 20;
        const x = CONFIG.ring.centerX + Math.cos(angle) * dist;
        const y = CONFIG.ring.centerY + Math.sin(angle) * dist;
        
        // Random velocity
        const speed = CONFIG.physics.flagSpeed;
        const vAngle = Math.random() * Math.PI * 2;
        const vx = Math.cos(vAngle) * speed;
        const vy = Math.sin(vAngle) * speed;
        
        state.flags.push(new Flag(country, x, y, vx, vy));
    });
    
    updateFlagCount();
}

// Update flag count display
function updateFlagCount() {
    // Flag count display removed - not needed
}

// Update leaderboard display
function updateLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    
    const sorted = Object.entries(state.leaderboard)
        .sort((a, b) => b[1].wins - a[1].wins)
        .slice(0, 10);
    
    sorted.forEach(([code, data]) => {
        const li = document.createElement('li');
        const img = state.flagImages[code];
        const imgSrc = img ? img.src : `assets/${code}.png`;
        li.innerHTML = `
            <img class="leaderboard-flag" src="${imgSrc}" alt="${code}">
            <span class="leaderboard-name">${data.name}</span>
            <span class="leaderboard-wins">${data.wins}</span>
        `;
        list.appendChild(li);
    });
}

// Check for winner
function checkWinner() {
    const remaining = state.flags.filter(f => !f.isOut);
    
    if (remaining.length === 1 && state.gamePhase === 'playing') {
        state.winner = remaining[0];
        state.gamePhase = 'winner';
        
        const country = state.winner.country;
        if (!state.leaderboard[country.code]) {
            state.leaderboard[country.code] = {
                name: country.name,
                wins: 0
            };
        }
        state.leaderboard[country.code].wins++;
        updateLeaderboard();
        
        showWinnerAnnouncement(country);
        announceWinner(country.name);
        
        setTimeout(() => {
            hideWinnerAnnouncement();
            resetGame();
        }, CONFIG.game.resetDelay);
    }
}

// Show winner announcement
function showWinnerAnnouncement(country) {
    const announcement = document.getElementById('winner-announcement');
    const flagDiv = document.getElementById('winner-flag');
    const img = state.flagImages[country.code];
    if (img) {
        flagDiv.innerHTML = `<img src="${img.src}" style="width:80px;height:60px;">`;
    } else {
        flagDiv.textContent = country.code;
    }
    document.getElementById('winner-text').textContent = `${country.name} wins the round!`;
    announcement.classList.remove('hidden');
}

// Hide winner announcement
function hideWinnerAnnouncement() {
    document.getElementById('winner-announcement').classList.add('hidden');
}

// TTS announcement using Web Speech API
function announceWinner(countryName) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`${countryName} wins the round!`);
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        utterance.volume = 1;
        speechSynthesis.speak(utterance);
    }
}

// Reset game
function resetGame() {
    state.gamePhase = 'playing';
    state.winner = null;
    state.ringRotation = 0;
    initFlags();
}

// Handle flag-to-flag collisions
function handleFlagCollisions() {
    for (let i = 0; i < state.flags.length; i++) {
        for (let j = i + 1; j < state.flags.length; j++) {
            const a = state.flags[i];
            const b = state.flags[j];
            
            if (a.checkCollisionWith(b)) {
                a.resolveCollisionWith(b);
            }
        }
    }
}

// Main game loop
function gameLoop() {
    // Clear canvas with background
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    
    // Update ring rotation
    state.ringRotation += CONFIG.ring.rotationSpeed;
    
    // Draw ring FIRST
    drawRing();
    
    // Update and draw flags
    state.flags.forEach(flag => {
        flag.update();
        flag.draw();
    });
    
    // Handle collisions
    handleFlagCollisions();
    
    // Check for winner
    if (state.gamePhase === 'playing') {
        checkWinner();
    }
    
    requestAnimationFrame(gameLoop);
}

// Load countries and flag images
async function loadAssets() {
    console.log('Loading countries...');
    const response = await fetch('assets/countries.json');
    const countriesData = await response.json();
    
    // Convert to array format
    state.countries = Object.entries(countriesData).map(([code, name]) => ({
        code: code,
        name: name
    }));
    
    console.log(`Loaded ${state.countries.length} countries`);
    
    // Preload all flag images
    console.log('Loading flag images...');
    const loadPromises = state.countries.map(country => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                state.flagImages[country.code] = img;
                resolve();
            };
            img.onerror = () => {
                console.warn(`Failed to load flag: ${country.code}`);
                resolve();
            };
            img.src = `assets/${country.code}.png`;
        });
    });
    
    await Promise.all(loadPromises);
    console.log('All flag images loaded!');
}

// Initialize game
async function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Load assets first
    await loadAssets();
    
    // Load leaderboard from localStorage
    const saved = localStorage.getItem('flagrace-leaderboard');
    if (saved) {
        state.leaderboard = JSON.parse(saved);
        updateLeaderboard();
    }
    
    // Save leaderboard periodically
    setInterval(() => {
        localStorage.setItem('flagrace-leaderboard', JSON.stringify(state.leaderboard));
    }, 5000);
    
    initFlags();
    gameLoop();
}

// Start the game
init();
