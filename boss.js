// ===== BOSS CLASS =====
class Boss extends Character {
    constructor(x, y, zone) {
        let data = ZONE_DATA[zone - 1];
        super(x, y, 70, 80);
        this.zone = zone; this.name = data.bossName;
        this.maxHealth = data.bossHP; this.health = data.bossHP;
        this.attackCooldown = 0; this.phase = 1;
        this.attackPattern = 0; this.patternTimer = 0;
        this.specialTimer = 0; // For special attacks
        this.summons = []; // For boss summons
    }

    takeDamage(amount) {
        if (this.flash > 0 || this.health <= 0) return;
        this.health -= amount; this.flash = 8;
        spawnBlood(this.x + this.w / 2, this.y + this.h / 2, 15);
        camera.shake = 8;
        let hpRatio = this.health / this.maxHealth;
        if (hpRatio < 0.3 && this.phase < 3) {
            this.phase = 3; // Final enrage
            spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 30, '#ffd700');
            camera.shake = 15;
        } else if (hpRatio < 0.6 && this.phase < 2) {
            this.phase = 2; // Enrage
            spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 20, '#ff0000');
            camera.shake = 12;
        }
    }

    updateAI() {
        if (this.health <= 0) return;
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.specialTimer > 0) this.specialTimer--;
        this.patternTimer++;
        let d = dist(this.x + this.w / 2, this.y + this.h / 2, player.x + player.w / 2, player.y + player.h / 2);
        let toPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        let rate = this.phase === 3 ? 0.5 : this.phase === 2 ? 0.7 : 1.0;
        this.facingRight = player.x > this.x;

        switch (this.zone) {
            case 1: { // Hidra
                if (this.x < player.x) this.vx += 0.15; else this.vx -= 0.15;
                if (this.attackCooldown <= 0) {
                    let heads = this.phase === 3 ? 7 : this.phase === 2 ? 5 : 3;
                    for (let i = 0; i < heads; i++) {
                        let a = toPlayer + (i - Math.floor(heads / 2)) * 0.25;
                        enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + 20, Math.cos(a) * 6, Math.sin(a) * 6, 14, '#44ff44'));
                    }
                    this.attackCooldown = Math.floor(55 * rate);
                }
                // Phase 2: poison puddles on ground
                if (this.phase >= 2 && this.patternTimer % Math.floor(120 * rate) === 0) {
                    for (let i = -2; i <= 2; i++) {
                        enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2 + i * 50, this.y + this.h, 0, 4, 10, '#22aa22'));
                    }
                }
                // Phase 3: heal burst + mega salvo
                if (this.phase === 3 && this.specialTimer <= 0) {
                    this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.05);
                    spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 12, '#44ff44');
                    spawnDamageNumber(this.x + this.w / 2, this.y - 20, 'REGEN', '#44ff44');
                    for (let i = 0; i < 8; i++) {
                        let a = (Math.PI * 2 / 8) * i;
                        enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + this.h / 2, Math.cos(a) * 5, Math.sin(a) * 5, 12, '#66ff66'));
                    }
                    this.specialTimer = Math.floor(200 * rate);
                }
                this.applyPhysics(); break;
            }

            case 2: { // Minotauro Rei
                let cycleLen = Math.floor(150 * rate);
                let cyclePos = this.patternTimer % cycleLen;
                if (cyclePos < 50) {
                    // Charge
                    this.vx = this.facingRight ? 14 : -14;
                    if (d < 60) { player.takeDamage(35); camera.shake = 18; }
                } else if (cyclePos === 50) {
                    // Stomp - shockwave
                    this.vx = 0;
                    let waves = this.phase >= 2 ? 5 : 3;
                    for (let i = -waves; i <= waves; i++) {
                        enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + this.h, i * 3.5, -2, 18, '#aa5500'));
                    }
                    camera.shake = 12;
                }
                // Phase 2: leaps + ground slam
                if (this.phase >= 2 && this.specialTimer <= 0) {
                    // Jump toward player
                    this.vy = -18;
                    this.vx = this.facingRight ? 10 : -10;
                    this.specialTimer = Math.floor(100 * rate);
                }
                // Ground slam when landing from leap
                if (this.phase >= 2 && this.isGrounded && this.vy === 0 && this.specialTimer > Math.floor(80 * rate)) {
                    for (let i = -5; i <= 5; i++) {
                        enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + this.h, i * 4, -3, 20, '#cc6600'));
                    }
                    camera.shake = 15;
                }
                // Phase 3: triple consecutive charges
                if (this.phase === 3 && cyclePos >= 60 && cyclePos < 90) {
                    this.vx = this.facingRight ? 16 : -16;
                    if (d < 65) { player.takeDamage(30); camera.shake = 12; }
                }
                this.applyPhysics(); break;
            }

            case 3: { // Ciclope Ancião
                if (this.x < player.x) this.vx += 0.12; else this.vx -= 0.12;
                if (this.attackCooldown <= 0) {
                    let rocks = this.phase === 3 ? 6 : this.phase === 2 ? 4 : 2;
                    for (let i = 0; i < rocks; i++) {
                        enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2 + (i - rocks / 2) * 20, this.y,
                            Math.cos(toPlayer) * (3 + i), -7, 20, '#887766'));
                    }
                    this.attackCooldown = Math.floor(65 * rate);
                }
                if (d < 80) { player.takeDamage(22); camera.shake = 8; }
                // Phase 2: eye laser beam (continuous line of projectiles)
                if (this.phase >= 2 && this.patternTimer % Math.floor(180 * rate) < 30) {
                    enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + 25,
                        Math.cos(toPlayer) * 12, Math.sin(toPlayer) * 12, 18, '#ff3300'));
                    if (this.patternTimer % 3 === 0)
                        spawnSpark(this.x + this.w / 2, this.y + 25, 3, '#ff6600');
                }
                // Phase 3: spawn mini-ciclopes
                if (this.phase === 3 && this.specialTimer <= 0) {
                    for (let i = -1; i <= 1; i += 2) {
                        let ex = this.x + i * 100;
                        let ey = this.y + 15;
                        enemies.push(new Enemy(ex, ey, 'CICLOPE'));
                        spawnSpark(ex + 25, ey + 30, 10, '#887766');
                    }
                    spawnDamageNumber(this.x + this.w / 2, this.y - 30, 'INVOCA!', '#ff6644');
                    this.specialTimer = Math.floor(350 * rate);
                }
                this.applyPhysics(); break;
            }

            case 4: { // Quimera Primordial
                let tgtY = player.y - 150;
                if (this.y > tgtY) this.vy -= 0.5; else this.vy += 0.25;
                if (this.x < player.x) this.vx += 0.2; else this.vx -= 0.2;

                // Alternate elemental attacks based on phase
                let element = this.patternTimer % 300 < 100 ? 'fire' : this.patternTimer % 300 < 200 ? 'ice' : 'poison';
                if (this.phase >= 2) element = this.patternTimer % 150 < 50 ? 'fire' : this.patternTimer % 150 < 100 ? 'ice' : 'poison';

                if (this.attackCooldown <= 0) {
                    let count = this.phase === 3 ? 10 : this.phase === 2 ? 8 : 5;
                    let color = element === 'fire' ? '#ff4400' : element === 'ice' ? '#88ccff' : '#44ff44';
                    let speed = element === 'fire' ? 4 : element === 'ice' ? 3 : 3.5;
                    let dmg = element === 'fire' ? 14 : element === 'ice' ? 10 : 12;

                    for (let i = 0; i < count; i++) {
                        enemyProjectiles.push(new EnemyProjectile(
                            this.x + this.w / 2 + (Math.random() - 0.5) * 250, this.y + this.h,
                            (Math.random() - 0.5) * 3, speed + Math.random() * 2, dmg, color));
                    }
                    this.attackCooldown = Math.floor(40 * rate);
                }
                // Phase 3: bombing run — dive and sweep
                if (this.phase === 3 && this.specialTimer <= 0) {
                    this.vy = 8; this.vx = this.facingRight ? 12 : -12;
                    for (let i = 0; i < 6; i++) {
                        let delay = i * 5;
                        setTimeout(() => {
                            if (this.health > 0) {
                                enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + this.h, 0, 5, 15, '#ff6600'));
                            }
                        }, delay * 16);
                    }
                    camera.shake = 10;
                    this.specialTimer = Math.floor(200 * rate);
                }
                this.x += this.vx; this.y += this.vy;
                this.vx *= 0.93; this.vy *= 0.93; break;
            }

            case 5: { // Ares
                // Aggressive melee
                if (d < 100) {
                    if (this.attackCooldown <= 0) {
                        player.takeDamage(25);
                        this.attackCooldown = 18;
                        camera.shake = 10;
                        spawnSlash(this.x + this.w / 2, this.y + this.h / 2, toPlayer, 80, '#ff2200');
                    }
                }
                if (this.x < player.x) this.vx += 0.4; else this.vx -= 0.4;

                // Slash waves — more frequent and denser
                if (this.patternTimer % Math.floor(80 * rate) === 0) {
                    let waves = this.phase === 3 ? 4 : this.phase === 2 ? 3 : 2;
                    for (let w = 0; w < waves; w++) {
                        for (let i = -2; i <= 2; i++) {
                            let a = toPlayer + i * 0.2 + w * 0.1;
                            let spd = 7 + w * 2;
                            enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + this.h / 2,
                                Math.cos(a) * spd, Math.sin(a) * spd, 18, '#ff2200'));
                        }
                    }
                }

                // Phase 2: teleport dash combos
                if (this.phase >= 2 && this.patternTimer % Math.floor(50 * rate) === 0) {
                    spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 15, '#ff0000');
                    this.x = player.x + (Math.random() > 0.5 ? 120 : -120);
                    spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 15, '#ff0000');
                    // Immediate slash after teleport
                    if (d < 150) {
                        player.takeDamage(20); camera.shake = 8;
                    }
                }

                // Phase 3: orbital projectiles + clone
                if (this.phase === 3) {
                    // Orbiting projectiles
                    if (this.patternTimer % 120 === 0) {
                        for (let i = 0; i < 6; i++) {
                            let a = (Math.PI * 2 / 6) * i + this.patternTimer * 0.02;
                            enemyProjectiles.push(new EnemyProjectile(
                                this.x + this.w / 2 + Math.cos(a) * 80,
                                this.y + this.h / 2 + Math.sin(a) * 80,
                                Math.cos(a + Math.PI / 2) * 4,
                                Math.sin(a + Math.PI / 2) * 4, 15, '#ff4400'));
                        }
                    }
                    // Clone attack
                    if (this.specialTimer <= 0) {
                        // Spawn a powerful enemy as "clone"
                        let cloneX = player.x + (Math.random() > 0.5 ? 200 : -200);
                        enemies.push(new Enemy(cloneX, this.y, 'ESPARTANO'));
                        spawnSpark(cloneX + 15, this.y + 25, 15, '#ff0000');
                        spawnDamageNumber(this.x + this.w / 2, this.y - 30, 'CLONE!', '#ff4444');
                        this.specialTimer = Math.floor(250 * rate);
                    }
                }
                this.applyPhysics(); break;
            }
        }
    }

    draw(ctx, cx, cy) {
        if (this.health <= 0) return;
        let dx = this.x - cx, dy = this.y - cy;

        // Aura — gets more intense with phases
        let auraColor = this.phase === 3 ? 'rgba(255,200,0,0.2)' : this.phase === 2 ? 'rgba(255,0,0,0.15)' : 'rgba(200,150,0,0.1)';
        let auraSize = this.phase === 3 ? 15 : 10;
        ctx.fillStyle = auraColor;
        ctx.fillRect(dx - auraSize, dy - auraSize, this.w + auraSize * 2, this.h + auraSize * 2);

        if (this.flash > 0) { this.flash--; ctx.fillStyle = '#fff'; }
        else {
            const bossColors = ['#2a6b2a', '#8b3a2a', '#5a5a7a', '#993300', '#cc0000'];
            ctx.fillStyle = bossColors[this.zone - 1];
        }
        ctx.fillRect(dx, dy, this.w, this.h);

        // Boss-specific visuals
        switch (this.zone) {
            case 1: // Hidra
                ctx.fillStyle = '#1a5a1a';
                let headCount = this.phase === 3 ? 5 : 3;
                for (let i = 0; i < headCount; i++) {
                    let hx = dx + 10 + i * (50 / headCount), hy = dy - 15 + Math.sin(Date.now() / 200 + i) * 8;
                    ctx.fillRect(hx, hy, 10, 20);
                } break;
            case 2: // Minotauro Rei
                ctx.fillStyle = '#daa520';
                ctx.fillRect(dx - 8, dy, 10, 18); ctx.fillRect(dx + this.w - 2, dy, 10, 18);
                if (this.phase >= 2) {
                    ctx.fillStyle = '#ff4400';
                    ctx.fillRect(dx - 12, dy - 5, 14, 22); ctx.fillRect(dx + this.w + 2, dy - 5, 14, 22);
                }
                break;
            case 3: // Ciclope
                ctx.fillStyle = '#fff'; ctx.beginPath();
                ctx.arc(dx + this.w / 2, dy + 25, 15, 0, Math.PI * 2); ctx.fill();
                let eyeColor = this.phase >= 2 && (this.patternTimer % Math.floor(180) < 30) ? '#ff0000' : '#f00';
                ctx.fillStyle = eyeColor; ctx.beginPath();
                ctx.arc(dx + this.w / 2, dy + 25, this.phase >= 2 ? 10 : 8, 0, Math.PI * 2); ctx.fill();
                if (this.phase >= 2) {
                    ctx.shadowBlur = 15; ctx.shadowColor = '#ff3300';
                    ctx.fillRect(dx + this.w / 2 - 2, dy + 25 - 2, 4, 4);
                    ctx.shadowBlur = 0;
                }
                break;
            case 4: // Quimera
                ctx.fillStyle = '#ff6600';
                for (let i = 0; i < 3; i++) {
                    let fy = dy + this.h + Math.sin(Date.now() / 80 + i * 2) * 8;
                    ctx.fillRect(dx + 10 + i * 20, fy, 12, 15);
                }
                if (this.phase >= 2) { // Extra heads
                    ctx.fillStyle = '#88ccff';
                    ctx.fillRect(dx - 10, dy + 10 + Math.sin(Date.now() / 150) * 5, 12, 15);
                    ctx.fillStyle = '#44ff44';
                    ctx.fillRect(dx + this.w - 2, dy + 10 + Math.sin(Date.now() / 180) * 5, 12, 15);
                }
                break;
            case 5: // Ares
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(dx + 5, dy + 2, this.w - 10, 12); // Helmet
                ctx.fillStyle = '#ff4400';
                let swd = this.facingRight ? 1 : -1;
                ctx.fillRect(dx + this.w / 2 + swd * 30, dy + 15, 8, 50); // Sword
                if (this.phase >= 2) { // Second sword
                    ctx.fillRect(dx + this.w / 2 - swd * 30, dy + 18, 6, 45);
                }
                break;
        }

        // Phase glow
        if (this.phase === 3) {
            let pulse = Math.sin(Date.now() / 100) * 0.15 + 0.3;
            ctx.globalAlpha = pulse;
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(dx - 6, dy - 6, this.w + 12, this.h + 12);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2;
            ctx.strokeRect(dx - 4, dy - 4, this.w + 8, this.h + 8);
        } else if (this.phase === 2) {
            ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2;
            ctx.strokeRect(dx - 3, dy - 3, this.w + 6, this.h + 6);
        }
    }
}
