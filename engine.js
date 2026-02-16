// ===== ENGINE CORE =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6, TERMINAL_VELOCITY = 15, FRICTION = 0.8;
let BASE_MOVE_SPEED = 6, JUMP_FORCE = 13;

let width, height;
let camera = { x: 0, y: 0, shake: 0 };
let keys = {};
let mouse = { x: 0, y: 0 };
let gameState = 'START';
let enemies = [], particles = [], projectiles = [], platforms = [], pickups = [], orbs = [];
let nextSpawnX = 0, lastPlatformY = 0;
let currentZone = 1, zoneStartX = 0, bossSpawned = false, currentBoss = null;
let playerOrbs = 0;
let enemyProjectiles = [];
let damageNumbers = [];
let slashEffects = [];
let hitFreeze = 0;
let thrownSpear = null; // The single thrown spear in the world

const ZONE_LENGTH = 8000;
const ZONE_DATA = [
    { name: 'Planícies de Esparta', bg1: '#0a0a1a', bg2: '#111', bossName: 'HIDRA', bossHP: 520 },
    { name: 'Templo de Atena', bg1: '#0d0a05', bg2: '#1a1510', bossName: 'MINOTAURO REI', bossHP: 780 },
    { name: 'Mar Egeu', bg1: '#030a15', bg2: '#0a1525', bossName: 'CICLOPE ANCIÃO', bossHP: 1050 },
    { name: 'Submundo', bg1: '#150500', bg2: '#1a0800', bossName: 'QUIMERA PRIMORDIAL', bossHP: 1300 },
    { name: 'Monte Olimpo', bg1: '#0f0f20', bg2: '#151530', bossName: 'ARES', bossHP: 1800 }
];

const UPGRADES = {
    hp: { levels: [15, 25, 40], effects: [50, 50, 50], current: 0 },
    vamp: { levels: [20, 35, 50], effects: [10, 20, 30], current: 0 },
    dmg: { levels: [20, 35, 50], effects: [15, 30, 50], current: 0 },
    dash: { levels: [20, 35, 55], effects: [200, 320, 450], current: 0 },
    speed: { levels: [15, 30, 50], effects: [3, 5, 8], current: 0 },
    aoe: { levels: [20, 35, 55], effects: [15, 25, 40], current: 0 },
    armor: { levels: [20, 40, 65], effects: [10, 20, 30], current: 0 },
    regen: { levels: [25, 45, 70], effects: [0.5, 1, 2], current: 0 },
    wings: { levels: [30, 50, 75], effects: [1, 2, 3], current: 0 },
    magnet: { levels: [10, 20, 35], effects: [100, 200, 300], current: 0 },
    fury: { levels: [15, 30, 50], effects: [3, 5, 8], current: 0 }
};

const WEAPONS = [
    { name: 'Lança de Esparta', emoji: '🔱', dmgMult: 1.0, speedMult: 1.0, range: 115, color: '#C0C0C0', comboNames: ['Thrust', 'Slash', 'Lunge'] },
    { name: 'Lâminas do Caos', emoji: '⛓️', dmgMult: 0.85, speedMult: 0.7, range: 95, color: '#ff6600', comboNames: ['Swing', 'Spin', 'Pull'] },
    { name: 'Machado Leviatã', emoji: '🪓', dmgMult: 1.5, speedMult: 1.4, range: 80, color: '#88ccff', comboNames: ['Chop', 'Cleave', 'Slam'] },
    { name: 'Cestus de Nemeia', emoji: '🥊', dmgMult: 0.7, speedMult: 0.5, range: 60, color: '#ffcc00', comboNames: ['Jab', 'Hook', 'Uppercut'] }
];
let unlockedWeapons = [true, false, false, false];
let hasMedusaHead = false;
let hasApolloBow = false;
let medusaCooldown = 0;
let bowCooldown = 0;
let apolloArrows = [];

function resize() { width = window.innerWidth; height = window.innerHeight; canvas.width = width; canvas.height = height; }
window.addEventListener('resize', resize); resize();

window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
    if (e.code === 'Tab') e.preventDefault();
    keys[e.code] = true;
    if (gameState === 'PLAYING') {
        if (e.code === 'Space') player.jump();
        if (e.code === 'KeyB') openBuildMenu();
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.dash();
        if (e.code === 'KeyQ') player.cycleWeapon();
        if (e.code === 'Digit1') player.selectWeapon(0);
        if (e.code === 'Digit2') player.selectWeapon(1);
        if (e.code === 'Digit3') player.selectWeapon(2);
        if (e.code === 'Digit4') player.selectWeapon(3);
        if (e.code === 'KeyE') player.useMedusa();
        if (e.code === 'KeyR') player.useBow();
    }
    if (gameState === 'BUILD' && e.code === 'KeyB') closeBuildMenu();
});
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
window.addEventListener('mousedown', e => {
    if (gameState === 'PLAYING') {
        if (e.button === 0) player.attack();
        else if (e.button === 2) player.throwSpear();
    }
});

function checkRectCollide(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}
function checkPointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}
function dist(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2); }
function lerp(a, b, t) { return a + (b - a) * t; }

function spawnBlood(x, y, amt) {
    for (let i = 0; i < amt; i++) particles.push(new Particle(x, y, '#8b0000', 8));
    for (let i = 0; i < amt / 2; i++) particles.push(new Particle(x, y, '#cc0000', 6));
}
function spawnSpark(x, y, amt, col) {
    for (let i = 0; i < amt; i++) particles.push(new Particle(x, y, col || '#fff', 5));
}
function spawnDamageNumber(x, y, dmg, color) {
    damageNumbers.push({ x, y, dmg: Math.floor(dmg), vy: -3, life: 1.0, color: color || '#fff' });
}
function spawnSlash(x, y, angle, size, color) {
    slashEffects.push({ x, y, angle, size: size || 60, life: 1.0, color: color || '#fff' });
}

// Check if a point is on or near a platform (for edge checking)
function isGroundBelow(x, y, range) {
    for (let p of platforms) {
        if (x >= p.x && x <= p.x + p.w && y >= p.y - range && y <= p.y + 5) return true;
    }
    return false;
}

// ===== PARTICLE =====
class Particle {
    constructor(x, y, color, speed) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.life = 1.0; this.color = color;
        this.size = Math.random() * 4 + 2;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.12; this.life -= 0.04; }
    draw(ctx, cx, cy) {
        if (this.x - cx < -10 || this.x - cx > width + 10) return;
        ctx.globalAlpha = this.life; ctx.fillStyle = this.color;
        ctx.fillRect(this.x - cx, this.y - cy, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

// ===== ORB =====
class Orb {
    constructor(x, y, value) {
        this.x = x; this.y = y; this.w = 12; this.h = 12;
        this.vy = -3 - Math.random() * 3;
        this.vx = (Math.random() - 0.5) * 4;
        this.value = value || 1; this.life = 300;
        this.grounded = false; this.floatT = Math.random() * 6;
    }
    update() {
        if (!this.grounded) {
            this.vy += 0.3; this.x += this.vx; this.y += this.vy;
            for (let p of platforms) {
                if (this.y + this.h > p.y && this.y < p.y + p.h && this.x + this.w > p.x && this.x < p.x + p.w) {
                    this.y = p.y - this.h; this.vy = 0; this.vx = 0; this.grounded = true;
                }
            }
        }
        this.floatT += 0.08; this.life--;
        let d = dist(this.x, this.y, player.x + player.w / 2, player.y + player.h / 2);
        if (d < player.magnetRange) {
            let angle = Math.atan2(player.y + player.h / 2 - this.y, player.x + player.w / 2 - this.x);
            this.x += Math.cos(angle) * 5; this.y += Math.sin(angle) * 5;
        }
        if (d < 25) { playerOrbs += this.value; this.life = 0; }
    }
    draw(ctx, cx, cy) {
        let dx = this.x - cx, dy = this.y - cy + Math.sin(this.floatT) * 3;
        if (dx < -20 || dx > width + 20) return;
        ctx.shadowBlur = 10; ctx.shadowColor = '#ff0000';
        ctx.fillStyle = '#ff3333';
        ctx.beginPath(); ctx.arc(dx + 6, dy + 6, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8888';
        ctx.beginPath(); ctx.arc(dx + 4, dy + 4, 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// ===== PLATFORM =====
class Platform {
    constructor(x, y, w, h, climbable) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.color = '#2a2a2a';
        this.climbable = climbable === true;
    }
    draw(ctx, cx, cy) {
        if (this.x - cx > width + 100 || this.x + this.w - cx < -100) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - cx, this.y - cy, this.w, this.h);
        ctx.fillStyle = this.climbable ? '#665544' : '#444';
        ctx.fillRect(this.x - cx, this.y - cy, this.w, 4);
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let row = 0; row < this.h; row += 20) {
            let offset = (Math.floor(row / 20) % 2) * 20;
            for (let col = offset; col < this.w; col += 40) {
                ctx.moveTo(this.x + col - cx, this.y + row - cy);
                ctx.lineTo(this.x + col - cx, this.y + row + 20 - cy);
            }
            ctx.moveTo(this.x - cx, this.y + row - cy);
            ctx.lineTo(this.x + this.w - cx, this.y + row - cy);
        }
        ctx.stroke();
        if (this.climbable) {
            ctx.fillStyle = '#445533';
            for (let i = 10; i < this.h - 10; i += 25) {
                ctx.fillRect(this.x - cx + 2, this.y + i - cy, 4, 8);
                ctx.fillRect(this.x + this.w - cx - 6, this.y + i - cy, 4, 8);
            }
        }
    }
}

// ===== THROWN SPEAR (magic return) =====
class ThrownSpear {
    constructor(x, y, angle, dmg, blessing) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * 22; this.vy = Math.sin(angle) * 22;
        this.angle = angle; this.dmg = dmg || 30;
        this.blessing = blessing || null;
        this.state = 'FLYING'; // FLYING, STUCK, RETURNING
        this.stuckTimer = 0;
        this.trail = [];
        this.hitTargets = new Set();
        this.color = blessing === 'zeus' ? '#88ccff' : blessing === 'ares' ? '#ff4400' : blessing === 'poseidon' ? '#aaddff' : 'cyan';
    }
    update() {
        if (this.state === 'FLYING') {
            this.trail.push({ x: this.x, y: this.y, life: 1 });
            if (this.trail.length > 10) this.trail.shift();
            this.trail.forEach(t => t.life -= 0.1);

            this.x += this.vx; this.y += this.vy;
            this.vy += 0.3; // gravity
            this.angle = Math.atan2(this.vy, this.vx);

            // Blessing trail particles
            if (this.blessing && Math.random() < 0.5) {
                spawnSpark(this.x + (Math.random() - 0.5) * 8, this.y + (Math.random() - 0.5) * 8, 1, this.color);
            }

            // Hit enemies while flying
            let targets = [...enemies];
            if (currentBoss && currentBoss.health > 0) targets.push(currentBoss);
            for (let e of targets) {
                if (e.health > 0 && !this.hitTargets.has(e) && checkPointInRect(this.x, this.y, e.x, e.y, e.w, e.h)) {
                    e.takeDamage(this.dmg);
                    e.vx = Math.cos(this.angle) * 8;
                    e.vy = -5;
                    this.hitTargets.add(e);
                    camera.shake = 6;
                    hitFreeze = 5;
                    spawnSpark(this.x, this.y, 8, this.color);
                    spawnBlood(this.x, this.y, 6);
                    // Blessing effect on hit
                    if (this.blessing) player.blessingHitEffect(e, this.x, this.y);
                }
            }

            // Hit platform -> stick + blessing explosion
            for (let p of platforms) {
                if (checkPointInRect(this.x, this.y, p.x, p.y, p.w, p.h)) {
                    this.state = 'STUCK';
                    this.vx = 0; this.vy = 0;
                    this.stuckTimer = 180; // 3 seconds — player can jump on it!
                    spawnSpark(this.x, this.y, 10, this.color);
                    camera.shake = 4;
                    // Blessing impact explosion
                    if (this.blessing === 'zeus') {
                        for (let i = 0; i < 6; i++) spawnSpark(this.x + (Math.random() - 0.5) * 60, this.y - Math.random() * 80, 4, '#88ccff');
                        spawnSlash(this.x, this.y, -Math.PI / 2, 100, '#88ccff');
                    } else if (this.blessing === 'ares') {
                        for (let a = 0; a < Math.PI * 2; a += 0.5) spawnSpark(this.x + Math.cos(a) * 40, this.y + Math.sin(a) * 40, 3, '#ff4400');
                        spawnSlash(this.x, this.y, 0, 80, '#ff4400');
                    } else if (this.blessing === 'poseidon') {
                        for (let i = 0; i < 8; i++) spawnSpark(this.x + (Math.random() - 0.5) * 80, this.y + (Math.random() - 0.5) * 80, 3, '#aaddff');
                    }
                    break;
                }
            }

            // Flies off screen
            if (this.y > lastPlatformY + 500) {
                this.state = 'RETURNING';
            }
        }
        else if (this.state === 'STUCK') {
            this.stuckTimer--;
            if (this.stuckTimer <= 0) {
                this.state = 'RETURNING';
                spawnSpark(this.x, this.y, 8, this.color);
            }
        }
        else if (this.state === 'RETURNING') {
            let px = player.x + player.w / 2;
            let py = player.y + player.h / 2;
            let angle = Math.atan2(py - this.y, px - this.x);
            let speed = 25;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.x += this.vx; this.y += this.vy;
            this.angle = angle + Math.PI;

            this.trail.push({ x: this.x, y: this.y, life: 1 });
            if (this.trail.length > 10) this.trail.shift();
            this.trail.forEach(t => t.life -= 0.1);

            // Hit enemies on return path too
            let targets2 = [...enemies];
            if (currentBoss && currentBoss.health > 0) targets2.push(currentBoss);
            for (let e of targets2) {
                if (e.health > 0 && !this.hitTargets.has(e) && checkPointInRect(this.x, this.y, e.x, e.y, e.w, e.h)) {
                    e.takeDamage(this.dmg * 0.6);
                    this.hitTargets.add(e);
                    spawnSpark(this.x, this.y, 5, this.color);
                    if (this.blessing) player.blessingHitEffect(e, this.x, this.y);
                }
            }

            // Reached player
            let d = dist(this.x, this.y, px, py);
            if (d < 40) {
                thrownSpear = null;
                player.throwCooldown = 0;
                spawnSpark(px, py, 6, this.color);
                return;
            }
        }
    }
    draw(ctx, cx, cy) {
        // Trail
        for (let t of this.trail) {
            if (t.life > 0) {
                ctx.globalAlpha = t.life * 0.5;
                ctx.fillStyle = this.color;
                ctx.fillRect(t.x - cx - 2, t.y - cy - 1, 4, 2);
            }
        }
        ctx.globalAlpha = 1;

        let dx = this.x - cx, dy = this.y - cy;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(this.angle);

        // Shaft
        ctx.fillStyle = '#6d4c3d';
        ctx.fillRect(-20, -2.5, 45, 5);
        // Spearhead
        ctx.fillStyle = '#e0e0e0';
        ctx.shadowBlur = 10; ctx.shadowColor = 'cyan';
        ctx.beginPath();
        ctx.moveTo(25, -6); ctx.lineTo(40, 0); ctx.lineTo(25, 6);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Glow when stuck and about to return
        if (this.state === 'STUCK') {
            let pulse = Math.sin(Date.now() / 100) * 0.3 + 0.5;
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = 'cyan'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }
}

// ===== ENEMY PROJECTILE =====
class EnemyProjectile {
    constructor(x, y, vx, vy, dmg, color) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.dmg = dmg || 10; this.color = color || '#ff6600';
        this.life = 150; this.active = true; this.size = 6;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.life--;
        if (this.life <= 0) this.active = false;
        if (checkPointInRect(this.x, this.y, player.x, player.y, player.w, player.h)) {
            player.takeDamage(this.dmg); this.active = false;
        }
        platforms.forEach(p => { if (checkPointInRect(this.x, this.y, p.x, p.y, p.w, p.h)) this.active = false; });
    }
    draw(ctx, cx, cy) {
        let dx = this.x - cx, dy = this.y - cy;
        if (dx < -20 || dx > width + 20) return;
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(dx, dy, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(dx, dy, this.size * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// ===== PICKUP =====
class Pickup {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.w = 30; this.h = 30;
        this.type = type; this.floatY = 0; this.floatTimer = 0; this.collected = false;
    }
    update() { this.floatTimer += 0.1; this.floatY = Math.sin(this.floatTimer) * 5; }
    draw(ctx, cx, cy) {
        if (this.collected) return;
        if (this.x - cx < -50 || this.x - cx > width + 50) return;
        let dx = this.x - cx + this.w / 2, dy = this.y - cy + this.h / 2 + this.floatY;
        ctx.shadowBlur = 20; ctx.shadowColor = 'gold';
        ctx.strokeStyle = 'rgba(255,215,0,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(dx, dy, 18 + Math.sin(this.floatTimer * 2) * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'gold';
        ctx.font = '24px serif'; ctx.fillText('🪽', dx - 12, dy + 8);
        ctx.shadowBlur = 0;
    }
}

// ===== RENDER HELPERS =====
function updateAndDrawDamageNumbers(ctx, cx, cy) {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        let d = damageNumbers[i];
        d.y += d.vy; d.vy *= 0.95; d.life -= 0.03;
        if (d.life <= 0) { damageNumbers.splice(i, 1); continue; }
        ctx.globalAlpha = d.life;
        ctx.font = 'bold 22px Cinzel, serif';
        ctx.fillStyle = d.color;
        ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        let text = d.dmg === 0 ? 'BLOCK' : String(d.dmg);
        ctx.strokeText(text, d.x - cx, d.y - cy);
        ctx.fillText(text, d.x - cx, d.y - cy);
    }
    ctx.globalAlpha = 1;
}

function updateAndDrawSlashEffects(ctx, cx, cy) {
    for (let i = slashEffects.length - 1; i >= 0; i--) {
        let s = slashEffects[i];
        s.life -= 0.07;
        if (s.life <= 0) { slashEffects.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(s.x - cx, s.y - cy);
        ctx.rotate(s.angle);
        ctx.globalAlpha = s.life * 0.8;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3 + s.life * 5;
        ctx.shadowBlur = 15; ctx.shadowColor = s.color;
        let r = s.size * (1.3 - s.life * 0.5);
        ctx.beginPath(); ctx.arc(0, 0, r, -0.7, 0.7); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.65, -0.5, 0.5); ctx.stroke();
        ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}
