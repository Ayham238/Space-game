// ============================================
// GALACTIC DEFENDER - Space Shooter Game
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// --- Game State ---
let gameRunning = false;
let score = 0;
let round = 1;
let maxRounds = 100;
let roundTransition = false;
let roundAnnounceTimer = 0;

// --- Stars Background ---
const stars = [];
const NUM_STARS = 300;
for (let i = 0; i < NUM_STARS; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2.5 + 0.5,
        speed: Math.random() * 1.5 + 0.3,
        brightness: Math.random() * 0.7 + 0.3
    });
}

// Nebula clouds
const nebulae = [];
for (let i = 0; i < 5; i++) {
    nebulae.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 200 + 100,
        color: ['rgba(123,47,247,', 'rgba(0,240,255,', 'rgba(255,45,149,'][Math.floor(Math.random() * 3)],
        speed: Math.random() * 0.2 + 0.05
    });
}

// --- Player (Spaceship) ---
const player = {
    x: 0, y: 0,
    width: 40, height: 50,
    speed: 5,
    hp: 100,
    maxHp: 100,
    shootCooldown: 0,
    shootRate: 12,
    holdTime: 0,
    laserThreshold: 30, // frames to hold before laser activates (~0.5s)
    laserDuration: 0,
    laserMaxDuration: 90, // 1.5 seconds at 60fps
    laserActive: false,
    invincible: 0
};

// --- Input ---
const keys = {};
let mouseDown = false;
let mouseX = 0, mouseY = 0;

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
canvas.addEventListener('mousedown', e => { mouseDown = true; mouseX = e.clientX; mouseY = e.clientY; });
canvas.addEventListener('mouseup', () => { mouseDown = false; player.holdTime = 0; player.laserActive = false; player.laserDuration = 0; });
canvas.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    mouseDown = true; 
    mouseX = e.changedTouches[0].clientX; 
    mouseY = e.changedTouches[0].clientY; 
}, { passive: false });

canvas.addEventListener('touchmove', e => { 
    e.preventDefault();
    mouseX = e.changedTouches[0].clientX; 
    mouseY = e.changedTouches[0].clientY; 
}, { passive: false });

canvas.addEventListener('touchend', e => { 
    e.preventDefault();
    mouseDown = false; 
    player.holdTime = 0; 
    player.laserActive = false; 
    player.laserDuration = 0; 
}, { passive: false });

// --- Mobile Controls Logic ---
const mobileControls = document.getElementById('mobileControls');
const joystickArea = document.getElementById('joystickArea');
const joystickThumb = document.getElementById('joystickThumb');
const fireBtn = document.getElementById('fireBtn');

let joystickActive = false;
let joystickCenter = { x: 0, y: 0 };
let joystickVector = { x: 0, y: 0 };

if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    mobileControls.style.display = 'block';
}

joystickArea.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    joystickActive = true;
    let touch = e.changedTouches[0];
    let rect = joystickArea.getBoundingClientRect();
    joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoystick(touch.clientX, touch.clientY);
}, { passive: false });

joystickArea.addEventListener('touchmove', e => {
    e.preventDefault();
    e.stopPropagation();
    if (joystickActive) {
        let touch = e.changedTouches[0];
        updateJoystick(touch.clientX, touch.clientY);
    }
}, { passive: false });

joystickArea.addEventListener('touchend', e => {
    e.preventDefault();
    e.stopPropagation();
    joystickActive = false;
    joystickVector = { x: 0, y: 0 };
    joystickThumb.style.transform = `translate(-50%, -50%)`;
}, { passive: false });

function updateJoystick(clientX, clientY) {
    let dx = clientX - joystickCenter.x;
    let dy = clientY - joystickCenter.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    let maxDistance = 40; 
    
    if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
    }
    
    joystickVector = { x: dx / maxDistance, y: dy / maxDistance };
    joystickThumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

fireBtn.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    mouseDown = true;
    mouseX = player.x;
    mouseY = player.y - 1000; // Aim forward
}, { passive: false });

fireBtn.addEventListener('touchmove', e => {
    e.preventDefault();
    e.stopPropagation();
}, { passive: false });

fireBtn.addEventListener('touchend', e => {
    e.preventDefault();
    e.stopPropagation();
    mouseDown = false;
    player.holdTime = 0;
    player.laserActive = false;
    player.laserDuration = 0;
}, { passive: false });

// --- Projectiles ---
let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let explosions = [];

// --- Spawn Enemies for Round ---
function spawnRound(r) {
    enemies = [];
    let count = 3 + Math.floor(r * 1.5);
    if (count > 60) count = 60;

    for (let i = 0; i < count; i++) {
        let type = 'basic';
        if (r >= 10 && Math.random() < 0.3) type = 'fast';
        if (r >= 25 && Math.random() < 0.2) type = 'tank';
        if (r >= 50 && Math.random() < 0.15) type = 'elite';
        if (r >= 75 && Math.random() < 0.1) type = 'boss';

        let hp, speed, size, color, shootRate, damage, scoreVal;

        switch (type) {
            case 'basic':
                hp = 10 + r * 2;
                speed = 1 + Math.random() * 0.5;
                size = 25;
                color = '#44ff44';
                shootRate = 120 - Math.min(r, 60);
                damage = 5;
                scoreVal = 10;
                break;
            case 'fast':
                hp = 8 + r;
                speed = 2.5 + Math.random();
                size = 20;
                color = '#ffff00';
                shootRate = 80;
                damage = 4;
                scoreVal = 20;
                break;
            case 'tank':
                hp = 40 + r * 4;
                speed = 0.5 + Math.random() * 0.3;
                size = 40;
                color = '#ff6600';
                shootRate = 150;
                damage = 12;
                scoreVal = 40;
                break;
            case 'elite':
                hp = 60 + r * 5;
                speed = 1.5 + Math.random() * 0.5;
                size = 35;
                color = '#ff00ff';
                shootRate = 50;
                damage = 10;
                scoreVal = 60;
                break;
            case 'boss':
                hp = 200 + r * 10;
                speed = 0.3 + Math.random() * 0.2;
                size = 55;
                color = '#ff0044';
                shootRate = 40;
                damage = 20;
                scoreVal = 150;
                break;
        }

        enemies.push({
            x: Math.random() * (canvas.width - 100) + 50,
            y: -size - Math.random() * 400,
            size, hp, maxHp: hp, speed, color, type,
            shootCooldown: Math.floor(Math.random() * shootRate),
            shootRate, damage, scoreVal,
            targetY: 60 + Math.random() * (canvas.height * 0.35),
            wobbleOffset: Math.random() * Math.PI * 2,
            arrived: false
        });
    }
}

// --- Drawing Functions ---

function drawStars() {
    for (let s of stars) {
        s.y += s.speed;
        if (s.y > canvas.height) {
            s.y = 0;
            s.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.brightness})`;
        ctx.fill();
    }
}

function drawNebulae() {
    for (let n of nebulae) {
        n.y += n.speed;
        if (n.y - n.radius > canvas.height) {
            n.y = -n.radius;
            n.x = Math.random() * canvas.width;
        }
        let grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
        grad.addColorStop(0, n.color + '0.06)');
        grad.addColorStop(1, n.color + '0)');
        ctx.fillStyle = grad;
        ctx.fillRect(n.x - n.radius, n.y - n.radius, n.radius * 2, n.radius * 2);
    }
}

function drawSpaceship(x, y, w, h, invincible) {
    ctx.save();
    ctx.translate(x, y);

    // Engine glow
    let glowIntensity = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
    let engineGrad = ctx.createRadialGradient(0, h * 0.4, 2, 0, h * 0.5, 20);
    engineGrad.addColorStop(0, `rgba(0,200,255,${glowIntensity})`);
    engineGrad.addColorStop(0.5, `rgba(123,47,247,${glowIntensity * 0.5})`);
    engineGrad.addColorStop(1, 'rgba(123,47,247,0)');
    ctx.fillStyle = engineGrad;
    ctx.fillRect(-20, h * 0.2, 40, 40);

    // Engine flames
    ctx.beginPath();
    ctx.moveTo(-8, h * 0.35);
    ctx.lineTo(0, h * 0.35 + 15 + Math.random() * 10);
    ctx.lineTo(8, h * 0.35);
    ctx.fillStyle = '#00ccff';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-4, h * 0.35);
    ctx.lineTo(0, h * 0.35 + 8 + Math.random() * 6);
    ctx.lineTo(4, h * 0.35);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Ship body
    if (invincible > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
        ctx.globalAlpha = 0.4;
    }

    // Main hull
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.5);           // nose
    ctx.lineTo(-w * 0.15, -h * 0.1);   // left shoulder
    ctx.lineTo(-w * 0.5, h * 0.35);    // left wing tip
    ctx.lineTo(-w * 0.2, h * 0.25);    // left wing inner
    ctx.lineTo(-w * 0.15, h * 0.4);    // left tail
    ctx.lineTo(w * 0.15, h * 0.4);     // right tail
    ctx.lineTo(w * 0.2, h * 0.25);     // right wing inner
    ctx.lineTo(w * 0.5, h * 0.35);     // right wing tip
    ctx.lineTo(w * 0.15, -h * 0.1);    // right shoulder
    ctx.closePath();

    let bodyGrad = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.4);
    bodyGrad.addColorStop(0, '#a0d8ff');
    bodyGrad.addColorStop(0.4, '#4488bb');
    bodyGrad.addColorStop(1, '#1a3355');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.strokeStyle = '#66ccff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.15, w * 0.08, h * 0.12, 0, 0, Math.PI * 2);
    let cockpitGrad = ctx.createRadialGradient(0, -h * 0.18, 1, 0, -h * 0.15, h * 0.12);
    cockpitGrad.addColorStop(0, '#ffffff');
    cockpitGrad.addColorStop(0.3, '#00eeff');
    cockpitGrad.addColorStop(1, '#004466');
    ctx.fillStyle = cockpitGrad;
    ctx.fill();

    // Wing accents
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, h * 0.33);
    ctx.lineTo(-w * 0.15, h * 0.1);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w * 0.45, h * 0.33);
    ctx.lineTo(w * 0.15, h * 0.1);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawAlien(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    let pulse = 0.9 + Math.sin(Date.now() * 0.005 + enemy.wobbleOffset) * 0.1;
    let s = enemy.size * pulse;

    // Glow
    let glowGrad = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 1.5);
    glowGrad.addColorStop(0, enemy.color.replace(')', ',0.2)').replace('rgb', 'rgba'));
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(-s * 1.5, -s * 1.5, s * 3, s * 3);

    // Body - different shapes by type
    ctx.beginPath();
    if (enemy.type === 'boss') {
        // Hexagon boss
        for (let i = 0; i < 6; i++) {
            let angle = (Math.PI / 3) * i - Math.PI / 2;
            let px = Math.cos(angle) * s;
            let py = Math.sin(angle) * s;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    } else if (enemy.type === 'tank') {
        // Square-ish
        ctx.rect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
    } else if (enemy.type === 'fast') {
        // Triangle
        ctx.moveTo(0, -s);
        ctx.lineTo(-s * 0.8, s * 0.6);
        ctx.lineTo(s * 0.8, s * 0.6);
        ctx.closePath();
    } else if (enemy.type === 'elite') {
        // Diamond
        ctx.moveTo(0, -s);
        ctx.lineTo(-s * 0.7, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(s * 0.7, 0);
        ctx.closePath();
    } else {
        // Circle
        ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
    }

    ctx.fillStyle = enemy.color;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Eyes
    let eyeSize = s * 0.15;
    ctx.beginPath();
    ctx.arc(-s * 0.2, -s * 0.1, eyeSize, 0, Math.PI * 2);
    ctx.arc(s * 0.2, -s * 0.1, eyeSize, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-s * 0.2, -s * 0.1, eyeSize * 0.5, 0, Math.PI * 2);
    ctx.arc(s * 0.2, -s * 0.1, eyeSize * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // HP bar
    if (enemy.hp < enemy.maxHp) {
        let barW = s * 1.4;
        let barH = 4;
        let barY = -s - 10;
        ctx.fillStyle = 'rgba(255,0,0,0.5)';
        ctx.fillRect(-barW / 2, barY, barW, barH);
        ctx.fillStyle = '#00ff44';
        ctx.fillRect(-barW / 2, barY, barW * (enemy.hp / enemy.maxHp), barH);
    }

    ctx.restore();
}

function drawBullet(b) {
    ctx.save();
    ctx.translate(b.x, b.y);

    if (b.isLaser) {
        // Laser beam bullet - elongated and bright
        let grad = ctx.createLinearGradient(0, -12, 0, 12);
        grad.addColorStop(0, '#ff00ff');
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, '#ff00ff');
        ctx.fillStyle = grad;
        ctx.fillRect(-3, -12, 6, 24);

        // Outer glow
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(255,0,255,0.4)';
        ctx.fillRect(-5, -14, 10, 28);
        ctx.shadowBlur = 0;
    } else {
        // Normal bullet
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00f0ff';
        ctx.fill();
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

function drawEnemyBullet(b) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4444';
    ctx.fill();
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawLaserBeam() {
    if (!player.laserActive) return;

    let angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    let len = Math.max(canvas.width, canvas.height) * 1.5;
    let endX = player.x + Math.cos(angle) * len;
    let endY = player.y + Math.sin(angle) * len;

    // Wide glow
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(255,0,255,0.15)';
    ctx.lineWidth = 30;
    ctx.stroke();

    // Medium glow
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(255,100,255,0.4)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Core beam
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Check hits on enemies with laser
    for (let e of enemies) {
        let dist = distToLine(player.x, player.y, endX, endY, e.x, e.y);
        if (dist < e.size) {
            e.hp -= 1.5; // 1.5x damage applied per frame (scaled)
            spawnParticles(e.x, e.y, e.color, 1);
        }
    }
}

function distToLine(x1, y1, x2, y2, px, py) {
    let A = px - x1;
    let B = py - y1;
    let C = x2 - x1;
    let D = y2 - y1;
    let dot = A * C + B * D;
    let lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.sqrt((px - xx) * (px - xx) + (py - yy) * (py - yy));
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 20 + Math.random() * 20,
            maxLife: 40,
            color,
            size: Math.random() * 3 + 1
        });
    }
}

function spawnExplosion(x, y, color, size) {
    explosions.push({ x, y, color, radius: 0, maxRadius: size, life: 20 });
    spawnParticles(x, y, color, 15);
}

// --- Update Functions ---

function updatePlayer() {
    let moveX = 0;
    let moveY = 0;

    if (keys['w'] || keys['arrowup']) moveY -= player.speed;
    if (keys['s'] || keys['arrowdown']) moveY += player.speed;
    if (keys['a'] || keys['arrowleft']) moveX -= player.speed;
    if (keys['d'] || keys['arrowright']) moveX += player.speed;

    if (joystickActive) {
        moveX += joystickVector.x * player.speed;
        moveY += joystickVector.y * player.speed;
    }

    player.x += moveX;
    player.y += moveY;

    // Clamp to screen
    player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
    player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));

    if (player.invincible > 0) player.invincible--;

    // Shooting
    if (mouseDown) {
        player.holdTime++;

        if (player.holdTime >= player.laserThreshold) {
            // Activate laser beam
            player.laserActive = true;
            player.laserDuration++;
            if (player.laserDuration >= player.laserMaxDuration) {
                // Laser ran out
                player.laserActive = false;
                mouseDown = false; // Force release
                player.holdTime = 0;
                player.laserDuration = 0;
            }
        } else {
            // Normal shooting
            if (player.shootCooldown <= 0) {
                let angle = Math.atan2(mouseY - player.y, mouseX - player.x);
                bullets.push({
                    x: player.x,
                    y: player.y - player.height * 0.4,
                    vx: Math.cos(angle) * 8,
                    vy: Math.sin(angle) * 8,
                    damage: 10 + Math.floor(round / 10),
                    isLaser: false
                });
                player.shootCooldown = player.shootRate;
            }
        }
    }

    if (player.shootCooldown > 0) player.shootCooldown--;
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // Off screen
        if (b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) {
            bullets.splice(i, 1);
            continue;
        }

        // Hit enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            let dist = Math.sqrt((b.x - e.x) ** 2 + (b.y - e.y) ** 2);
            if (dist < e.size) {
                e.hp -= b.damage;
                spawnParticles(b.x, b.y, e.color, 5);
                bullets.splice(i, 1);
                break;
            }
        }
    }
}

function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        let b = enemyBullets[i];
        b.x += b.vx;
        b.y += b.vy;

        if (b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) {
            enemyBullets.splice(i, 1);
            continue;
        }

        // Hit player
        let dist = Math.sqrt((b.x - player.x) ** 2 + (b.y - player.y) ** 2);
        if (dist < 20 && player.invincible <= 0) {
            player.hp -= b.damage;
            player.invincible = 30;
            spawnParticles(player.x, player.y, '#ff4444', 8);
            enemyBullets.splice(i, 1);
            if (player.hp <= 0) {
                gameOver();
                return;
            }
        }
    }
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];

        // Move to target position
        if (!e.arrived) {
            if (e.y < e.targetY) {
                e.y += e.speed * 2;
            } else {
                e.arrived = true;
            }
        } else {
            // Wobble side to side
            e.x += Math.sin(Date.now() * 0.002 + e.wobbleOffset) * e.speed;
            e.x = Math.max(e.size, Math.min(canvas.width - e.size, e.x));
        }

        // Shooting
        if (e.arrived) {
            e.shootCooldown--;
            if (e.shootCooldown <= 0) {
                let angle = Math.atan2(player.y - e.y, player.x - e.x);
                enemyBullets.push({
                    x: e.x,
                    y: e.y + e.size * 0.5,
                    vx: Math.cos(angle) * 3,
                    vy: Math.sin(angle) * 3,
                    damage: e.damage
                });
                e.shootCooldown = e.shootRate;
            }
        }

        // Check death
        if (e.hp <= 0) {
            spawnExplosion(e.x, e.y, e.color, e.size * 2);
            score += e.scoreVal;
            enemies.splice(i, 1);
        }

        // Collision with player
        let dist = Math.sqrt((e.x - player.x) ** 2 + (e.y - player.y) ** 2);
        if (dist < e.size + 15 && player.invincible <= 0) {
            player.hp -= e.damage;
            player.invincible = 60;
            spawnParticles(player.x, player.y, '#ff4444', 10);
            if (player.hp <= 0) {
                gameOver();
                return;
            }
        }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        let ex = explosions[i];
        ex.radius += (ex.maxRadius - ex.radius) * 0.2;
        ex.life--;
        if (ex.life <= 0) explosions.splice(i, 1);
    }
}

function drawParticles() {
    for (let p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawExplosions() {
    for (let ex of explosions) {
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
        ctx.fillStyle = ex.color;
        ctx.globalAlpha = ex.life / 20 * 0.4;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// --- HUD Update ---
function updateHUD() {
    document.getElementById('healthFill').style.width = Math.max(0, player.hp / player.maxHp * 100) + '%';
    document.getElementById('healthText').textContent = Math.max(0, Math.ceil(player.hp));
    document.getElementById('scoreValue').textContent = score;
    document.getElementById('roundValue').textContent = round;
    document.getElementById('enemyValue').textContent = enemies.length;

    let laserPct = 0;
    if (player.laserActive) {
        laserPct = (1 - player.laserDuration / player.laserMaxDuration) * 100;
    } else if (mouseDown && player.holdTime > 0) {
        laserPct = Math.min(player.holdTime / player.laserThreshold * 100, 100);
    }
    document.getElementById('laserFill').style.width = laserPct + '%';
}

// --- Round Management ---
function checkRoundComplete() {
    if (enemies.length === 0 && !roundTransition) {
        roundTransition = true;
        roundAnnounceTimer = 120; // 2 seconds

        if (round >= maxRounds) {
            winGame();
            return;
        }

        round++;
        // Small heal between rounds
        player.hp = Math.min(player.maxHp, player.hp + 10);

        document.getElementById('announceRound').textContent = round;
        document.getElementById('roundAnnounce').style.display = 'block';
    }

    if (roundTransition) {
        roundAnnounceTimer--;
        if (roundAnnounceTimer <= 0) {
            roundTransition = false;
            document.getElementById('roundAnnounce').style.display = 'none';
            spawnRound(round);
        }
    }
}

// --- Game Flow ---
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('winScreen').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';

    score = 0;
    round = 1;
    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
    player.hp = player.maxHp;
    player.invincible = 60;
    player.holdTime = 0;
    player.laserActive = false;
    player.laserDuration = 0;

    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    explosions = [];
    roundTransition = false;

    spawnRound(1);
    gameRunning = true;

    if (!window._gameLoopStarted) {
        window._gameLoopStarted = true;
        gameLoop();
    }
}

function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = 'Score: ' + score;
    document.getElementById('finalRound').textContent = 'Round Reached: ' + round;
    document.getElementById('gameOverScreen').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
}

function winGame() {
    gameRunning = false;
    document.getElementById('winScore').textContent = 'Score: ' + score;
    document.getElementById('winScreen').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
}

// --- Main Game Loop ---
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawNebulae();
    drawStars();

    if (gameRunning) {
        updatePlayer();
        updateBullets();
        updateEnemyBullets();
        updateEnemies();
        updateParticles();
        updateExplosions();
        checkRoundComplete();

        // Draw everything
        drawExplosions();

        for (let b of bullets) drawBullet(b);
        for (let b of enemyBullets) drawEnemyBullet(b);
        for (let e of enemies) drawAlien(e);

        drawLaserBeam();
        drawSpaceship(player.x, player.y, player.width, player.height, player.invincible);
        drawParticles();

        updateHUD();
    }

    requestAnimationFrame(gameLoop);
}

// Make startGame globally accessible
window.startGame = startGame;
