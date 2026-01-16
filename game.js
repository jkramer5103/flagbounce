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
        flagSpeed: 10,
        gravity: 0.5,
        bounceDamping: 0.2,
        floorFriction: 0.3,
        stackingDamping: 0.1,
        fadeOutDelay: 5000
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

// Background Music
let MUSIC_TRACKS = [];
let backgroundMusic = null;
let currentTrackIndex = -1;
let musicStarted = false;
let pendingMusicStart = false;

// Game State
const state = {
    flags: [],
    ringRotation: 0,
    gapStartAngle: Math.PI * 0.75, // Bottom-left position (around 7-8 o'clock)
    leaderboard: {},
    gamePhase: 'playing',
    winner: null,
    countries: [],
    flagImages: {},
    winnerAnimation: {
        scale: 1,
        scaleDirection: 1,
        animationSpeed: 0.02
    },
    eventTracking: {
        lastWinner: null,
        consecutiveWins: 0,
        announced100Remaining: false,
        announced50Remaining: false,
        announced15Remaining: false,
        announced3Remaining: false
    },
    riggedCountry: null
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
        this.speed = CONFIG.physics.flagSpeed;
        this.opacity = 1;
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
            // No hitbox - just fall straight down
            this.vy += CONFIG.physics.gravity;
            this.y += this.vy;
            
            // Disappear when off-screen
            if (this.y > CONFIG.height + this.height) {
                this.opacity = 0;
                this.isEliminated = true;
            }
        } else {
            // Apply subtle steering for rigged country before movement
            this.applySubtleSteering();
            
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
    
    // Subtle steering for rigged country - applies gentle velocity adjustments
    applySubtleSteering() {
        if (!state.riggedCountry || this.country.code !== state.riggedCountry) return;
        if (this.isOut || this.isEliminated) return;
        
        const dx = this.x - CONFIG.ring.centerX;
        const dy = this.y - CONFIG.ring.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const boundaryDist = CONFIG.ring.radius - this.radius;
        
        // Only apply steering when getting close to the boundary (within 80% of radius)
        if (dist < boundaryDist * 0.7) return;
        
        // Calculate current angle from center
        const currentAngle = Math.atan2(dy, dx);
        
        // Calculate gap center angle
        const gapCenterAngle = state.gapStartAngle + state.ringRotation + (CONFIG.ring.gapAngle / 2);
        
        // Normalize angles
        let normCurrent = currentAngle % (Math.PI * 2);
        if (normCurrent < 0) normCurrent += Math.PI * 2;
        let normGapCenter = gapCenterAngle % (Math.PI * 2);
        if (normGapCenter < 0) normGapCenter += Math.PI * 2;
        
        // Calculate angular distance to gap center
        let angleDiff = normGapCenter - normCurrent;
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Only steer if heading toward the gap (within ~60 degrees)
        if (Math.abs(angleDiff) > Math.PI / 3) return;
        
        // Check if velocity is pointing outward toward the gap
        const velAngle = Math.atan2(this.vy, this.vx);
        const outwardAngle = currentAngle;
        let velToOutward = velAngle - outwardAngle;
        if (velToOutward > Math.PI) velToOutward -= Math.PI * 2;
        if (velToOutward < -Math.PI) velToOutward += Math.PI * 2;
        
        // Only steer if moving somewhat outward (within 90 degrees of outward direction)
        if (Math.abs(velToOutward) > Math.PI / 2) return;
        
        // Calculate steering strength based on proximity to boundary and gap
        const proximityFactor = (dist - boundaryDist * 0.7) / (boundaryDist * 0.3); // 0 to 1
        const gapProximityFactor = 1 - (Math.abs(angleDiff) / (Math.PI / 3)); // 1 at gap center, 0 at edges
        const steerStrength = 0.015 * proximityFactor * gapProximityFactor; // Very subtle
        
        // Steer perpendicular to gap direction (away from gap center)
        // Determine which direction to steer (clockwise or counter-clockwise)
        const steerDirection = angleDiff > 0 ? -1 : 1;
        
        // Apply tangential velocity adjustment
        const tangentX = -dy / dist;
        const tangentY = dx / dist;
        
        this.vx += tangentX * steerDirection * steerStrength * this.speed;
        this.vy += tangentY * steerDirection * steerStrength * this.speed;
        
        // Normalize to maintain constant speed
        this.normalizeSpeed();
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
                this.opacity = 0.5;
                
                // Calculate launch power based on gap position
                // Gap at bottom (angle ~ 3π/2) = low power, Gap at top (angle ~ π/2) = high power
                const normalizedGapAngle = (state.gapStartAngle + state.ringRotation) % (Math.PI * 2);
                // Convert to 0-1 range where 0 = bottom, 0.5 = top
                const gapPosition = (normalizedGapAngle + Math.PI/2) / (Math.PI * 2);
                if (gapPosition < 0) gapPosition += 1;
                
                // Launch power: 0.5 (bottom) to 2.5 (top) - reduced max power
                const launchPower = 0.5 + gapPosition * 1.3;
                
                // Launch in the direction the gap is pointing (outward from center through gap)
                const gapCenterAngle = state.gapStartAngle + state.ringRotation + (CONFIG.ring.gapAngle / 2);
                this.vx = Math.cos(gapCenterAngle) * this.speed * launchPower;
                this.vy = Math.sin(gapCenterAngle) * this.speed * launchPower;
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
        if (this.opacity <= 0) return;
        
        ctx.save();
        ctx.globalAlpha = this.opacity;
        
        const img = state.flagImages[this.country.code];
        const x = this.x - this.width/2;
        const y = this.y - this.height/2;
        const cornerRadius = 6;
        
        // Create rounded rectangle clip path
        ctx.beginPath();
        ctx.moveTo(x + cornerRadius, y);
        ctx.lineTo(x + this.width - cornerRadius, y);
        ctx.quadraticCurveTo(x + this.width, y, x + this.width, y + cornerRadius);
        ctx.lineTo(x + this.width, y + this.height - cornerRadius);
        ctx.quadraticCurveTo(x + this.width, y + this.height, x + this.width - cornerRadius, y + this.height);
        ctx.lineTo(x + cornerRadius, y + this.height);
        ctx.quadraticCurveTo(x, y + this.height, x, y + this.height - cornerRadius);
        ctx.lineTo(x, y + cornerRadius);
        ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
        ctx.closePath();
        ctx.clip();
        
        if (img && img.complete) {
            ctx.drawImage(img, x, y, this.width, this.height);
        } else {
            ctx.fillStyle = '#888';
            ctx.fillRect(x, y, this.width, this.height);
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.country.code, this.x, this.y + 3);
        }
        
        ctx.restore();
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
    CONFIG.ring.centerY = 750;
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
        .slice(0, 3);
    
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
    
    // Check for remaining countries milestones
    if (state.gamePhase === 'playing') {
        if (remaining.length === 100 && !state.eventTracking.announced100Remaining) {
            playEventAudio('100_remaining');
            state.eventTracking.announced100Remaining = true;
        } else if (remaining.length === 50 && !state.eventTracking.announced50Remaining) {
            playEventAudio('50_remaining');
            state.eventTracking.announced50Remaining = true;
        } else if (remaining.length === 15 && !state.eventTracking.announced15Remaining) {
            playEventAudio('15_remaining');
            state.eventTracking.announced15Remaining = true;
        } else if (remaining.length === 3 && !state.eventTracking.announced3Remaining) {
            playEventAudio('3_remaining');
            state.eventTracking.announced3Remaining = true;
        }
    }
    
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
        
        // Check for win streaks
        if (state.eventTracking.lastWinner === country.code) {
            state.eventTracking.consecutiveWins++;
            
            // Announce streak milestones (play after winner announcement)
            if (state.eventTracking.consecutiveWins === 2) {
                playEventAudio('2_streak', 2000);
            } else if (state.eventTracking.consecutiveWins === 3) {
                playEventAudio('3_streak', 2000);
            } else if (state.eventTracking.consecutiveWins === 5) {
                playEventAudio('5_streak', 2000);
            }
        } else {
            state.eventTracking.lastWinner = country.code;
            state.eventTracking.consecutiveWins = 1;
        }
        
        updateLeaderboard();
        
        // Report to server and push updated leaderboard
        reportRoundComplete(state.winner);
        pushLeaderboardToServer();
        
        // Check if this country just became champion (reached 4 wins)
        if (state.leaderboard[country.code].wins === 4) {
            // CHAMPION CELEBRATION!
            showChampionCelebration(country);
            playEventAudio('champion', 500);
            
            // Champion celebration lasts 12 seconds
            setTimeout(() => {
                hideChampionCelebration();
                resetGame();
            }, 12000);
        } else {
            showWinnerAnnouncement(country);
            announceWinner(country);
            
            // Randomly play an exciting announcement (20% chance)
            if (Math.random() < 0.2) {
                const excitingAnnouncements = ['intense_round', 'nail_biter', 'spectacular', 'unbelievable', 'amazing', 'incredible'];
                const randomAnnouncement = excitingAnnouncements[Math.floor(Math.random() * excitingAnnouncements.length)];
                playEventAudio(randomAnnouncement, 2500);
            }
            
            // Auto-reset after 3.5 seconds
            setTimeout(() => {
                hideWinnerAnnouncement();
                resetGame();
            }, 3500);
        }
    }
}

// Show winner announcement
function showWinnerAnnouncement(country) {
    const announcement = document.getElementById('winner-announcement');
    const flagDiv = document.getElementById('winner-flag');
    const img = state.flagImages[country.code];
    if (img) {
        flagDiv.innerHTML = `<img src="${img.src}" style="width:200px;height:150px;">`;
    } else {
        flagDiv.textContent = country.code;
    }
    document.getElementById('winner-text').textContent = `${country.name} wins!`;
    announcement.classList.remove('hidden');
    
    // Start winner animation
    state.winnerAnimation.scale = 1;
    state.winnerAnimation.scaleDirection = 1;
}

// Hide winner announcement
function hideWinnerAnnouncement() {
    document.getElementById('winner-announcement').classList.add('hidden');
}

// Show champion celebration (4 wins!)
function showChampionCelebration(country) {
    const celebration = document.getElementById('champion-celebration');
    const flagDiv = document.getElementById('champion-flag');
    const nameDiv = document.getElementById('champion-name');
    
    // Set champion flag and name
    const img = state.flagImages[country.code];
    if (img) {
        flagDiv.innerHTML = `<img src="${img.src}">`;
    }
    nameDiv.textContent = country.name.toUpperCase();
    
    // Show the celebration overlay
    celebration.classList.remove('hidden');
    
    // Start confetti
    startConfetti();
    
    // Start fireworks
    startFireworks();
}

// Hide champion celebration
function hideChampionCelebration() {
    const celebration = document.getElementById('champion-celebration');
    celebration.classList.add('hidden');
    
    // Clear confetti and fireworks
    document.getElementById('confetti-container').innerHTML = '';
    document.getElementById('fireworks-container').innerHTML = '';
}

// Create confetti effect
function startConfetti() {
    const container = document.getElementById('confetti-container');
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    const shapes = ['square', 'circle'];
    
    // Create confetti pieces continuously for 11 seconds
    let confettiInterval = setInterval(() => {
        for (let i = 0; i < 5; i++) {
            createConfettiPiece(container, colors, shapes);
        }
    }, 100);
    
    // Stop creating new confetti after 11 seconds
    setTimeout(() => {
        clearInterval(confettiInterval);
    }, 11000);
}

function createConfettiPiece(container, colors, shapes) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const left = Math.random() * 100;
    const duration = 3 + Math.random() * 3;
    const size = 8 + Math.random() * 12;
    
    confetti.style.left = `${left}%`;
    confetti.style.backgroundColor = color;
    confetti.style.width = `${size}px`;
    confetti.style.height = `${size}px`;
    confetti.style.animationDuration = `${duration}s`;
    confetti.style.borderRadius = shape === 'circle' ? '50%' : '2px';
    
    container.appendChild(confetti);
    
    // Remove confetti after animation
    setTimeout(() => {
        confetti.remove();
    }, duration * 1000);
}

// Create fireworks effect
function startFireworks() {
    const container = document.getElementById('fireworks-container');
    
    // Launch fireworks at intervals
    let fireworkCount = 0;
    const maxFireworks = 15;
    
    let fireworkInterval = setInterval(() => {
        if (fireworkCount >= maxFireworks) {
            clearInterval(fireworkInterval);
            return;
        }
        
        createFirework(container);
        fireworkCount++;
    }, 700);
}

function createFirework(container) {
    const colors = ['#FFD700', '#FF4500', '#00FF00', '#00BFFF', '#FF1493', '#FFFF00', '#FF69B4', '#7B68EE'];
    const x = 100 + Math.random() * (1080 - 200);
    const y = 200 + Math.random() * (800);
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Create explosion particles
    const particleCount = 20 + Math.floor(Math.random() * 15);
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'firework-particle';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.backgroundColor = color;
        particle.style.boxShadow = `0 0 6px ${color}, 0 0 12px ${color}`;
        
        // Calculate trajectory
        const angle = (i / particleCount) * Math.PI * 2;
        const velocity = 50 + Math.random() * 100;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        
        particle.style.animation = `particleFly 1.5s ease-out forwards`;
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        // Use transform for trajectory
        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(0.3)`, opacity: 0 }
        ], {
            duration: 1500,
            easing: 'ease-out',
            fill: 'forwards'
        });
        
        container.appendChild(particle);
        
        // Remove particle after animation
        setTimeout(() => {
            particle.remove();
        }, 1500);
    }
    
    // Add a bright flash at the center
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.left = `${x - 15}px`;
    flash.style.top = `${y - 15}px`;
    flash.style.width = '30px';
    flash.style.height = '30px';
    flash.style.borderRadius = '50%';
    flash.style.backgroundColor = 'white';
    flash.style.boxShadow = `0 0 30px ${color}, 0 0 60px ${color}`;
    
    flash.animate([
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(3)', opacity: 0 }
    ], {
        duration: 500,
        easing: 'ease-out',
        fill: 'forwards'
    });
    
    container.appendChild(flash);
    
    setTimeout(() => {
        flash.remove();
    }, 500);
}

// Play event TTS audio
function playEventAudio(eventName, delay = 0) {
    setTimeout(() => {
        const audioPath = `assets/tts/${eventName}.mp3`;
        const audio = new Audio(audioPath);
        audio.volume = 1.0;
        audio.play().catch(error => {
            console.warn(`Failed to play event audio ${eventName}:`, error);
        });
    }, delay);
}

// TTS announcement using pre-recorded audio files
function announceWinner(country) {
    const audioPath = `assets/tts/${country.code}.mp3`;
    
    // Create and play the audio
    const audio = new Audio(audioPath);
    audio.volume = 1.0;
    
    audio.play().catch(error => {
        console.warn(`Failed to play TTS audio for ${country.code}:`, error);
        // Fallback to Web Speech API if audio file fails
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`${country.name} wins the round!`);
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            utterance.volume = 1;
            
            const voices = speechSynthesis.getVoices();
            const englishVoice = voices.find(v => v.lang.startsWith('en-')) || 
                                voices.find(v => v.lang.includes('en'));
            if (englishVoice) {
                utterance.voice = englishVoice;
            }
            
            speechSynthesis.speak(utterance);
        }
    });
}

// Reset game
function resetGame() {
    state.gamePhase = 'playing';
    state.winner = null;
    state.ringRotation = 0;
    
    // Reset remaining countries announcements
    state.eventTracking.announced100Remaining = false;
    state.eventTracking.announced50Remaining = false;
    state.eventTracking.announced15Remaining = false;
    state.eventTracking.announced3Remaining = false;
    
    initFlags();
}

// Handle flag-to-flag collisions
function handleFlagCollisions() {
    for (let i = 0; i < state.flags.length; i++) {
        for (let j = i + 1; j < state.flags.length; j++) {
            const a = state.flags[i];
            const b = state.flags[j];
            
            // Skip collisions involving out flags (no hitbox)
            if (a.isOut || b.isOut) {
                continue;
            }
            
            // Skip collision between fully transparent flags
            if (a.opacity <= 0 || b.opacity <= 0) {
                continue;
            }
            
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
    
    // Only update ring rotation and flags if game is playing
    if (state.gamePhase === 'playing') {
        state.ringRotation += CONFIG.ring.rotationSpeed;
        
        // Update and draw flags
        state.flags.forEach(flag => {
            flag.update();
            flag.draw();
        });
        
        // Handle collisions
        handleFlagCollisions();
        
        // Check for winner
        checkWinner();
    } else if (state.gamePhase === 'winner' && state.winner) {
        // Draw winner animation
        drawWinnerFlag();
    }
    
    // Always draw ring
    drawRing();
    
    requestAnimationFrame(gameLoop);
}

// Draw animated winner flag
function drawWinnerFlag() {
    if (!state.winner) return;
    
    // Update animation
    state.winnerAnimation.scale += state.winnerAnimation.scaleDirection * state.winnerAnimation.animationSpeed;
    if (state.winnerAnimation.scale > 1.5 || state.winnerAnimation.scale < 0.8) {
        state.winnerAnimation.scaleDirection *= -1;
    }
    
    // Draw pulsing winner flag at center
    const img = state.flagImages[state.winner.country.code];
    const centerX = CONFIG.width / 2;
    const centerY = CONFIG.height / 2;
    const scaledWidth = 400 * state.winnerAnimation.scale;
    const scaledHeight = 300 * state.winnerAnimation.scale;
    const cornerRadius = 20 * state.winnerAnimation.scale;
    
    ctx.save();
    ctx.globalAlpha = 1;
    
    // Create rounded rectangle clip path
    ctx.beginPath();
    ctx.moveTo(centerX - scaledWidth/2 + cornerRadius, centerY - scaledHeight/2);
    ctx.lineTo(centerX + scaledWidth/2 - cornerRadius, centerY - scaledHeight/2);
    ctx.quadraticCurveTo(centerX + scaledWidth/2, centerY - scaledHeight/2, centerX + scaledWidth/2, centerY - scaledHeight/2 + cornerRadius);
    ctx.lineTo(centerX + scaledWidth/2, centerY + scaledHeight/2 - cornerRadius);
    ctx.quadraticCurveTo(centerX + scaledWidth/2, centerY + scaledHeight/2, centerX + scaledWidth/2 - cornerRadius, centerY + scaledHeight/2);
    ctx.lineTo(centerX - scaledWidth/2 + cornerRadius, centerY + scaledHeight/2);
    ctx.quadraticCurveTo(centerX - scaledWidth/2, centerY + scaledHeight/2, centerX - scaledWidth/2, centerY + scaledHeight/2 - cornerRadius);
    ctx.lineTo(centerX - scaledWidth/2, centerY - scaledHeight/2 + cornerRadius);
    ctx.quadraticCurveTo(centerX - scaledWidth/2, centerY - scaledHeight/2, centerX - scaledWidth/2 + cornerRadius, centerY - scaledHeight/2);
    ctx.closePath();
    ctx.clip();
    
    if (img && img.complete) {
        ctx.drawImage(img, centerX - scaledWidth/2, centerY - scaledHeight/2, scaledWidth, scaledHeight);
    } else {
        ctx.fillStyle = '#888';
        ctx.fillRect(centerX - scaledWidth/2, centerY - scaledHeight/2, scaledWidth, scaledHeight);
        ctx.fillStyle = '#fff';
        ctx.font = `${60 * state.winnerAnimation.scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(state.winner.country.code, centerX, centerY + 20 * state.winnerAnimation.scale);
    }
    
    ctx.restore();
}

// Fetch music tracks from Flask API
async function loadMusicTracks() {
    try {
        const response = await fetch('/api/music');
        const data = await response.json();
        
        if (data.tracks && data.tracks.length > 0) {
            MUSIC_TRACKS = data.tracks;
            console.log(`Loaded ${MUSIC_TRACKS.length} music tracks`);
        } else {
            console.warn('No music tracks found');
        }
    } catch (error) {
        console.error('Failed to load music tracks:', error);
    }
}

// Play random background music
function playRandomMusic() {
    if (MUSIC_TRACKS.length === 0) {
        console.warn('No music tracks available');
        return;
    }
    
    // Get a random track different from the current one
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
    } while (newIndex === currentTrackIndex && MUSIC_TRACKS.length > 1);
    
    currentTrackIndex = newIndex;
    
    // Stop current music if playing
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
    
    // Create new audio element
    backgroundMusic = new Audio(MUSIC_TRACKS[currentTrackIndex]);
    backgroundMusic.volume = 0.30; // Set volume to 30% so it doesn't overpower game sounds
    
    // When song ends, play another random one
    backgroundMusic.addEventListener('ended', playRandomMusic);
    
    // Play the music
    const playPromise = backgroundMusic.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            musicStarted = true;
            pendingMusicStart = false;
            console.log('Background music started');
        }).catch(error => {
            console.warn('Autoplay blocked, waiting for user interaction:', error);
            pendingMusicStart = true;
        });
    }
}

// Attempt to start music on user interaction if autoplay was blocked
function tryStartMusic() {
    if (pendingMusicStart && !musicStarted && backgroundMusic) {
        backgroundMusic.play().then(() => {
            musicStarted = true;
            pendingMusicStart = false;
            console.log('Background music started after user interaction');
            // Remove listeners after successful start
            document.removeEventListener('click', tryStartMusic);
            document.removeEventListener('keydown', tryStartMusic);
            document.removeEventListener('touchstart', tryStartMusic);
        }).catch(error => {
            console.warn('Still unable to play music:', error);
        });
    }
}

// Poll for admin commands
async function pollAdminCommands() {
    try {
        const response = await fetch('/api/admin/command');
        const data = await response.json();
        
        if (data.command) {
            console.log('Admin command received:', data.command);
            executeAdminCommand(data.command, data);
        }
        
        // Update volume if changed
        if (backgroundMusic && data.volume !== undefined) {
            backgroundMusic.volume = data.volume / 100;
        }
        
        // Update rigged country
        if (data.riggedCountry !== undefined) {
            state.riggedCountry = data.riggedCountry;
        }
    } catch (error) {
        // Silently fail - server might not be available
    }
}

// Execute admin commands
function executeAdminCommand(command, data) {
    switch (command) {
        case 'reset':
        case 'new_round':
            hideWinnerAnnouncement();
            resetGame();
            break;
        case 'clear_leaderboard':
            state.leaderboard = {};
            localStorage.removeItem('flagrace-leaderboard');
            updateLeaderboard();
            break;
        case 'skip_track':
            playRandomMusic();
            break;
        case 'toggle_music':
            if (backgroundMusic) {
                if (data.musicPlaying) {
                    backgroundMusic.play().catch(() => {});
                } else {
                    backgroundMusic.pause();
                }
            }
            break;
        case 'set_volume':
            if (backgroundMusic && data.volume !== undefined) {
                backgroundMusic.volume = data.volume / 100;
            }
            break;
        case 'sync_leaderboard':
            syncLeaderboard();
            break;
    }
}

// Report round completion to server
async function reportRoundComplete(winner) {
    try {
        await fetch('/api/admin/round-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                winner: {
                    code: winner.country.code,
                    name: winner.country.name
                }
            })
        });
    } catch (error) {
        // Silently fail
    }
}

// Sync leaderboard bidirectionally with server
async function syncLeaderboard() {
    try {
        // First, fetch the current server leaderboard
        const response = await fetch('/api/admin/leaderboard');
        const data = await response.json();
        
        if (data.leaderboard) {
            // Merge server leaderboard with local state
            // Server takes precedence for existing entries
            state.leaderboard = { ...state.leaderboard, ...data.leaderboard };
            
            // Update localStorage and display
            localStorage.setItem('flagrace-leaderboard', JSON.stringify(state.leaderboard));
            updateLeaderboard();
        }
    } catch (error) {
        // Silently fail
    }
}

// Push local leaderboard changes to server (only called after round completion)
async function pushLeaderboardToServer() {
    try {
        await fetch('/api/admin/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leaderboard: state.leaderboard })
        });
    } catch (error) {
        // Silently fail
    }
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
    
    // Add keyboard listener for reset
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && state.gamePhase === 'winner') {
            e.preventDefault();
            hideWinnerAnnouncement();
            resetGame();
        }
    });
    
    // Add listeners to start music on first user interaction if autoplay blocked
    document.addEventListener('click', tryStartMusic, { once: false });
    document.addEventListener('keydown', tryStartMusic, { once: false });
    document.addEventListener('touchstart', tryStartMusic, { once: false });
    
    // Load assets first
    await loadAssets();
    
    // Load music tracks from backend
    await loadMusicTracks();
    
    // Load leaderboard from localStorage
    const saved = localStorage.getItem('flagrace-leaderboard');
    if (saved) {
        state.leaderboard = JSON.parse(saved);
        updateLeaderboard();
    }
    
    // Sync leaderboard with server periodically (fetch from server)
    setInterval(() => {
        syncLeaderboard();
    }, 5000);
    
    // Poll for admin commands
    setInterval(pollAdminCommands, 1000);
    
    initFlags();
    gameLoop();
    
    // Start background music immediately
    // Will work in OBS browser source and Firefox
    // Chrome will retry on first user interaction if blocked
    playRandomMusic();
}

// Start the game
init();
