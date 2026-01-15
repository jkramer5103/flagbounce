# Technical Specification: Physics-Based Flag Race Stream (Country Marbles)

## 1. Project Overview
A web-based interactive simulation designed for livestreaming (OBS). National flags (sprites) bounce inside a rotating ring with a gap. Flags that exit the gap transition from "linear bounce physics" to "gravitational projectile physics" and stack at the bottom of the screen. The last flag remaining in the circle is the winner.

## 2. Core Mechanics & Physics

### A. The Container (The Ring)
- **Geometry:** A hollow circle (arc) with a defined thickness.
- **The Gap:** A missing segment of the arc (approx. 30° to 45°).
- **Rotation:** The entire ring rotates at a constant angular velocity ($\omega$).
- **Collision:** Flags must detect collisions with the inner wall of the ring.

### B. Flag Behavior (Phase 1: Inside the Ring)
- **Movement:** Linear, constant velocity ($v$). Zero gravity.
- **Collision Response:** Standard elastic reflection against the inner circle boundary.
- **Vector Logic:** When a flag hits the wall, its velocity vector must reflect across the normal of the impact point on the circle's circumference. 
- **Important:** The rotation of the ring should slightly influence the exit angle to ensure dynamic movement.

### C. The Transition (The Exit)
- **Detection:** A flag is "out" if its center point coordinates pass beyond the radius of the ring while within the angular range of the gap.
- **State Change:** Once a flag exits:
    1. Disable ring collision (Allow it to pass "through" the ring walls).
    2. Enable **Global Gravity** ($g$).
    3. Maintain current momentum as the initial velocity for the projectile arc.

### D. Phase 2: Stacking (The Pile)
- **Floor Physics:** A static horizontal boundary at the bottom of the canvas.
- **Stacking:** Flags must have hitboxes (rectangles or circles) to stack on top of each other, creating a visual pile of "losers".

## 3. Assets & Integration

### A. Graphics
- **Sprites:** High-resolution flag icons (PNG/SVG) loaded from a local assets folder.
- **Canvas:** HTML5 Canvas API or a 2D engine (e.g., Matter.js or Phaser.js).

### B. Audio & TTS
- **Win Event:** Triggered when the count of flags inside the ring equals 1.
- **TTS Integration:** The winning Country ID/Name is sent to a TTS engine (Local Web Speech API or AI TTS like ElevenLabs) to announce: *"[Country Name] wins the round!"*

### C. UI Overlay
- **Leaderboard:** A persistent HTML/CSS overlay showing "Round Winners (Top 10)" with a counter for multiple wins.

## 4. Technical Stack
- **Language:** JavaScript (ES6+).
- **Physics:** Custom Vector Math or **Matter.js** (recommended for the stacking logic).
- **Rendering:** Browser-based (to be captured via **OBS Browser Source**).
- **Resolution:** 1080x1920 (Vertical/TikTok/Shorts) or 1920x1080 (Standard).

## 5. Execution Flow
1. **Init:** Load flag sprites and initialize the physics world.
2. **Spawn:** Randomize starting positions and velocity vectors for all flags inside the ring.
3. **Loop:** - Update ring rotation.
    - Check for reflections vs. exits.
    - Apply gravity to "out" flags.
4. **Win Condition:** Identify the last flag, trigger TTS, update the leaderboard.
5. **Reset:** Auto-reload or re-spawn after a 10-second delay.