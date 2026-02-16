// ===== BASE CHARACTER =====
class Character {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.vx = 0; this.vy = 0; this.health = 100; this.maxHealth = 100;
        this.facingRight = true; this.isGrounded = false; this.flash = 0;
    }
    applyPhysics() {
        this.vy += GRAVITY;
        if (this.vy > TERMINAL_VELOCITY) this.vy = TERMINAL_VELOCITY;
        this.x += this.vx; this.checkHorizontalCollisions();
        this.y += this.vy; this.isGrounded = false; this.checkVerticalCollisions();
        if (this.isGrounded) { this.vx *= FRICTION; if (Math.abs(this.vx) < 0.1) this.vx = 0; }
        else this.vx *= 0.95;
    }
    checkHorizontalCollisions() {
        for (let p of platforms) {
            if (checkRectCollide(this, p)) {
                if (this.vx > 0) this.x = p.x - this.w;
                else if (this.vx < 0) this.x = p.x + p.w;
                this.vx = 0;
            }
        }
    }
    checkVerticalCollisions() {
        for (let p of platforms) {
            if (checkRectCollide(this, p)) {
                if (this.vy > 0) { this.y = p.y - this.h; this.isGrounded = true; this.vy = 0; }
                else if (this.vy < 0) { this.y = p.y + p.h; this.vy = 0; }
            }
        }
    }
    takeDamage(amount) {
        if (this.flash > 0 || this.health <= 0) return;
        this.health -= amount; this.flash = 12;
        this.vy = -6; this.vx = this.facingRight ? -6 : 6;
        spawnBlood(this.x + this.w / 2, this.y + this.h / 2, 12);
        spawnDamageNumber(this.x + this.w / 2, this.y - 10, amount, '#ff4444');
        hitFreeze = 4;
    }
}

// ===== PLAYER (Kratos) =====
class Player extends Character {
    constructor() {
        super(100, 300, 30, 48);
        this.mana = 0; this.hasWings = false; this.jumpCount = 0;
        this.aimAngle = 0; this.spearLength = 60;
        this.attackTimer = 0; this.attackDuration = 14;
        this.throwCooldown = 0; this.isClimbing = false;
        this.dashCooldown = 0; this.isDashing = false; this.dashTimer = 0;
        this.isGliding = false; this.baseDmg = 35;
        this.vampHeal = 0; this.dashDist = 0;
        this.walkFrame = 0; this.walkTimer = 0;
        // Combo system
        this.comboStep = 0;
        this.comboTimer = 0;
        this.comboWindow = 25;
        // Throw animation
        this.throwAnim = 0;
        // Blessing system
        this.activeBlessing = null;
        // Weapon system
        this.currentWeapon = 0; // index into WEAPONS array
        // New upgrade fields
        this.armor = 0;           // % damage reduction
        this.regenRate = 0;       // HP per second
        this.regenAccum = 0;      // accumulator for regen
        this.attackSpeedBonus = 0; // frames reduced from attack duration
        this.aoeBonus = 0;        // extra range on attacks
        this.magnetRange = 120;   // base orb magnet range
        this.furyBonus = 0;       // extra mana per hit
        this.maxJumps = 2;        // max jumps (wings upgrade)
        this.airControl = 1;      // air control multiplier
        this.dashAttackWindow = 0; // frames after dash where attack does 2x
    }
    update() {
        // Walk animation
        if (this.isGrounded && Math.abs(this.vx) > 0.5) {
            this.walkTimer++; if (this.walkTimer > 6) { this.walkTimer = 0; this.walkFrame = (this.walkFrame + 1) % 4; }
        } else { this.walkFrame = 0; }

        // Climbing — only on climbable platforms
        this.isClimbing = false;
        if (keys['KeyW'] || keys['ArrowUp']) {
            for (let p of platforms) {
                if (!p.climbable) continue;
                // Wide detection: within 15px of either side of the wall
                let nearRight = this.x + this.w >= p.x - 5 && this.x + this.w <= p.x + 15;
                let nearLeft = this.x <= p.x + p.w + 5 && this.x >= p.x + p.w - 15;
                let vertOverlap = this.y + this.h > p.y && this.y < p.y + p.h;
                if ((nearRight || nearLeft) && vertOverlap) {
                    // Reached top of wall? Land on top directly
                    if (this.y <= p.y + 20) {
                        // Place player on top of the wall, centered
                        this.x = p.x + (p.w / 2) - (this.w / 2);
                        this.y = p.y - this.h;
                        this.vy = 0; this.vx = 0;
                        this.isGrounded = true;
                        this.isClimbing = false;
                        spawnSpark(this.x + this.w / 2, this.y + this.h, 6, '#886644');
                        break;
                    }
                    this.isClimbing = true; this.vy = -4; this.vx = 0;
                    // Snap to wall
                    if (nearRight) this.x = p.x - this.w;
                    else this.x = p.x + p.w;
                    if (Math.random() < 0.4) spawnSpark(this.x + this.w / 2, this.y + this.h, 1, '#886644');
                    break;
                }
            }
        }
        // Climbing down with S
        if (!this.isClimbing && (keys['KeyS'] || keys['ArrowDown'])) {
            for (let p of platforms) {
                if (!p.climbable) continue;
                let nearRight = this.x + this.w >= p.x - 5 && this.x + this.w <= p.x + 15;
                let nearLeft = this.x <= p.x + p.w + 5 && this.x >= p.x + p.w - 15;
                let vertOverlap = this.y + this.h > p.y && this.y < p.y + p.h - 10;
                if ((nearRight || nearLeft) && vertOverlap) {
                    this.isClimbing = true; this.vy = 2.5; this.vx = 0;
                    break;
                }
            }
        }

        // Dashing — i-frames and dash attack
        if (this.isDashing) {
            this.dashTimer--;
            if (this.dashTimer <= 0) { this.isDashing = false; this.dashAttackWindow = 12; }
            else { this.vx = this.facingRight ? 24 : -24; this.vy = 0; if (Math.random() < 0.6) spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 2, '#88ccff'); }
        }
        if (this.dashAttackWindow > 0) this.dashAttackWindow--;
        if (!this.isDashing && !this.isClimbing) {
            if (keys['KeyD']) { this.vx += 1; this.facingRight = true; }
            else if (keys['KeyA']) { this.vx -= 1; this.facingRight = false; }
        }

        // Gliding
        this.isGliding = false;
        if (this.hasWings && !this.isGrounded && !this.isClimbing && keys['Space'] && this.vy > 0 && this.jumpCount >= 2) {
            this.vy = 1.5; this.isGliding = true;
            if (Math.random() < 0.4) spawnSpark(this.x + this.w / 2, this.y + this.h, 1, '#ffd700');
        }

        // Aim
        let cx = this.x + this.w / 2 - camera.x, cy = this.y + this.h / 2 - camera.y;
        this.aimAngle = Math.atan2(mouse.y - cy, mouse.x - cx);
        this.facingRight = mouse.x > cx;

        if (this.vx > BASE_MOVE_SPEED) this.vx = BASE_MOVE_SPEED;
        if (this.vx < -BASE_MOVE_SPEED) this.vx = -BASE_MOVE_SPEED;

        if (!this.isClimbing) this.applyPhysics();
        else { this.x += this.vx; this.y += this.vy; }

        // Stand on stuck spear as platform
        if (thrownSpear && thrownSpear.state === 'STUCK' && this.vy >= 0) {
            let sx = thrownSpear.x - 20, sy = thrownSpear.y - 3;
            let sw = 40, sh = 6;
            if (this.x + this.w > sx && this.x < sx + sw &&
                this.y + this.h >= sy && this.y + this.h <= sy + sh + 8) {
                this.y = sy - this.h;
                this.vy = 0;
                this.isGrounded = true;
                this.jumpCount = 0;
            }
        }

        if (this.isGrounded) this.jumpCount = 0;
        if (this.y > lastPlatformY + 800) this.health = 0;
        if (this.attackTimer > 0) this.attackTimer--;
        if (this.throwCooldown > 0) this.throwCooldown--;
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.throwAnim > 0) this.throwAnim--;

        // Passive regen
        if (this.regenRate > 0 && this.health > 0 && this.health < this.maxHealth) {
            this.regenAccum += this.regenRate / 60; // 60fps
            if (this.regenAccum >= 1) {
                let heal = Math.floor(this.regenAccum);
                this.health = Math.min(this.maxHealth, this.health + heal);
                this.regenAccum -= heal;
            }
        }

        // Combo timer
        if (this.comboTimer > 0) { this.comboTimer--; if (this.comboTimer <= 0) this.comboStep = 0; }

        pickups.forEach(p => {
            if (!p.collected && checkRectCollide(this, p)) {
                if (p.type === 'WINGS') { this.hasWings = true; document.getElementById('icon-wings').classList.add('active'); document.getElementById('item-pickup').style.display = 'block'; gameState = 'PAUSED'; }
                p.collected = true;
            }
        });
    }
    jump() {
        if (this.isClimbing) {
            this.vy = -JUMP_FORCE; this.vx = this.facingRight ? 8 : -8;
            this.isClimbing = false; this.jumpCount = 1;
            spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 6, '#886644');
        } else if (this.isGrounded) {
            this.vy = -JUMP_FORCE; this.jumpCount = 1;
            spawnSpark(this.x + this.w / 2, this.y + this.h, 4, '#555');
        } else if (this.hasWings && this.jumpCount < this.maxJumps) {
            this.vy = -JUMP_FORCE; this.jumpCount = this.maxJumps;
            spawnSpark(this.x + this.w / 2, this.y + this.h, 12, '#ffd700');
        }
    }
    dash() {
        if (this.dashDist <= 0 || this.dashCooldown > 0) return;
        this.isDashing = true; this.dashTimer = Math.floor(this.dashDist / 20);
        this.dashCooldown = 25;
        spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 14, '#88ccff');
        camera.shake = 4;
    }
    attack() {
        if (this.attackTimer > 0) return;
        let wep = WEAPONS[this.currentWeapon];
        let dmg = Math.floor(this.baseDmg * wep.dmgMult) + (this.mana > 50 ? 25 : 0);
        if (this.activeBlessing) dmg += 15;
        if (this.dashAttackWindow > 0) { dmg *= 2; this.dashAttackWindow = 0; spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 15, '#ffdd44'); }
        let aoeExtra = this.aoeBonus;
        let cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        let slashColor = this.activeBlessing ? this.getBlessingColor() : wep.color;
        let hit = false;
        let targets = [...enemies];
        if (currentBoss && currentBoss.health > 0) targets.push(currentBoss);
        let effectiveDuration = Math.max(4, Math.floor(this.attackDuration * wep.speedMult) - this.attackSpeedBonus);
        let baseRange = wep.range + aoeExtra;

        // ===== WEAPON-SPECIFIC COMBOS =====
        if (this.currentWeapon === 0) {
            // --- LANÇA DE ESPARTA ---
            if (this.comboStep === 0) {
                this.attackTimer = effectiveDuration;
                let thrustDist = baseRange;
                let tipX = cx + Math.cos(this.aimAngle) * thrustDist;
                let tipY = cy + Math.sin(this.aimAngle) * thrustDist;
                let midX = cx + Math.cos(this.aimAngle) * (thrustDist * 0.6);
                let midY = cy + Math.sin(this.aimAngle) * (thrustDist * 0.6);
                spawnSlash(cx, cy, this.aimAngle, 50, slashColor);
                targets.forEach(e => {
                    if (e.health > 0 && (checkPointInRect(tipX, tipY, e.x, e.y, e.w, e.h) || checkPointInRect(midX, midY, e.x, e.y, e.w, e.h))) {
                        e.takeDamage(dmg); e.vx = Math.cos(this.aimAngle) * 8; e.vy = -3;
                        this.mana = Math.min(100, this.mana + 5 + this.furyBonus); hit = true;
                        this.blessingHitEffect(e, cx, cy);
                    }
                });
                this.comboStep = 1; this.comboTimer = this.comboWindow;
            } else if (this.comboStep === 1) {
                this.attackTimer = effectiveDuration;
                let slashRange = 80 + aoeExtra;
                spawnSlash(cx, cy, this.aimAngle, 90, slashColor);
                spawnSlash(cx, cy, this.aimAngle - 0.4, 70, slashColor);
                spawnSlash(cx, cy, this.aimAngle + 0.4, 70, slashColor);
                dmg = Math.floor(dmg * 1.3);
                targets.forEach(e => {
                    if (e.health > 0) {
                        let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                        if (d < slashRange + e.w) {
                            e.takeDamage(dmg); e.vx = Math.cos(this.aimAngle) * 10; e.vy = -5;
                            this.mana = Math.min(100, this.mana + 8 + this.furyBonus); hit = true;
                            this.blessingHitEffect(e, cx, cy);
                        }
                    }
                });
                this.comboStep = 2; this.comboTimer = this.comboWindow;
            } else {
                this.attackTimer = effectiveDuration + 4;
                dmg = Math.floor(dmg * 1.8);
                this.vx = this.facingRight ? 15 : -15; this.vy = -2;
                let lungeRange = 100 + aoeExtra;
                spawnSlash(cx, cy, this.aimAngle, 110, slashColor);
                targets.forEach(e => {
                    if (e.health > 0) {
                        let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                        if (d < lungeRange + e.w) {
                            e.takeDamage(dmg); e.vx = Math.cos(this.aimAngle) * 14; e.vy = -6;
                            this.mana = Math.min(100, this.mana + 12 + this.furyBonus); hit = true;
                            this.blessingHitEffect(e, cx, cy);
                        }
                    }
                });
                this.comboStep = 0; this.comboTimer = 0;
            }
        } else if (this.currentWeapon === 1) {
            // --- LÂMINAS DO CAOS --- fast, medium range
            if (this.comboStep === 0) {
                // SWING — wide horizontal sweep
                this.attackTimer = effectiveDuration;
                spawnSlash(cx, cy, this.aimAngle, 70, slashColor);
                spawnSlash(cx, cy, this.aimAngle + 0.3, 60, slashColor);
                targets.forEach(e => {
                    if (e.health > 0) {
                        let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                        if (d < baseRange + e.w) {
                            e.takeDamage(dmg); e.vx = Math.cos(this.aimAngle) * 6; e.vy = -2;
                            this.mana = Math.min(100, this.mana + 4 + this.furyBonus); hit = true;
                            this.blessingHitEffect(e, cx, cy);
                        }
                    }
                });
                this.comboStep = 1; this.comboTimer = this.comboWindow;
            } else if (this.comboStep === 1) {
                // SPIN — 360 degree attack
                this.attackTimer = effectiveDuration;
                for (let a = 0; a < Math.PI * 2; a += 0.8) spawnSlash(cx, cy, a, 65, slashColor);
                dmg = Math.floor(dmg * 1.2);
                targets.forEach(e => {
                    if (e.health > 0) {
                        let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                        if (d < baseRange + e.w) {
                            e.takeDamage(dmg); e.vy = -4;
                            this.mana = Math.min(100, this.mana + 6 + this.furyBonus); hit = true;
                            this.blessingHitEffect(e, cx, cy);
                        }
                    }
                });
                this.comboStep = 2; this.comboTimer = this.comboWindow;
            } else {
                // PULL — yank enemies closer
                this.attackTimer = effectiveDuration + 2;
                dmg = Math.floor(dmg * 1.4);
                spawnSlash(cx, cy, this.aimAngle + Math.PI, 80, slashColor);
                targets.forEach(e => {
                    if (e.health > 0) {
                        let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                        if (d < baseRange * 1.5 + e.w) {
                            e.takeDamage(dmg);
                            // Pull toward player
                            let pullAngle = Math.atan2(cy - (e.y + e.h / 2), cx - (e.x + e.w / 2));
                            e.vx = Math.cos(pullAngle) * 12; e.vy = Math.sin(pullAngle) * 8;
                            this.mana = Math.min(100, this.mana + 10 + this.furyBonus); hit = true;
                            this.blessingHitEffect(e, cx, cy);
                        }
                    }
                });
                this.comboStep = 0; this.comboTimer = 0;
            }
        } else if (this.currentWeapon === 2) {
            // --- MACHADO LEVIATÃ --- slow, heavy hits
            if (this.comboStep === 0) {
                // CHOP — overhead slam
                this.attackTimer = effectiveDuration;
                spawnSlash(cx, cy, this.aimAngle - 0.5, 60, slashColor);
                spawnSlash(cx, cy, this.aimAngle, 70, slashColor);
                dmg = Math.floor(dmg * 1.1);
                targets.forEach(e => {
                    if (e.health > 0) {
                        let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                        if (d < baseRange + e.w) {
                            e.takeDamage(dmg); e.vx = Math.cos(this.aimAngle) * 5; e.vy = 4;
                            this.mana = Math.min(100, this.mana + 7 + this.furyBonus); hit = true;
                            this.blessingHitEffect(e, cx, cy);
                            // Frost slow
                            if (e.frozenTimer === undefined) e.frozenTimer = 0;
                            e.frozenTimer = 30;
                        }
                    }
                });
                this.comboStep = 1; this.comboTimer = this.comboWindow + 5;
            } else if (this.comboStep === 1) {
                // CLEAVE — wide heavy swing
                this.attackTimer = effectiveDuration + 2;
                dmg = Math.floor(dmg * 1.4);
                spawnSlash(cx, cy, this.aimAngle, 100, slashColor);
                spawnSlash(cx, cy, this.aimAngle - 0.6, 80, slashColor);
                spawnSlash(cx, cy, this.aimAngle + 0.6, 80, slashColor);
                targets.forEach(e => {
                    if (e.health > 0) {
                        let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                        if (d < baseRange + 20 + e.w) {
                            e.takeDamage(dmg); e.vx = Math.cos(this.aimAngle) * 12; e.vy = -6;
                            this.mana = Math.min(100, this.mana + 10 + this.furyBonus); hit = true;
                            this.blessingHitEffect(e, cx, cy);
                        }
                    }
                });
                this.comboStep = 2; this.comboTimer = this.comboWindow + 5;
            } else {
                // SLAM — ground pound with shockwave
                this.attackTimer = effectiveDuration + 6;
                dmg = Math.floor(dmg * 2.0);
                this.vy = 8; // Slam down
                camera.shake = 12;
                let slamRange = baseRange + 40 + aoeExtra;
                spawnSlash(cx, cy, -Math.PI / 2, 120, slashColor);
                targets.forEach(e => {
                    if (e.health > 0) {
                        let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                        if (d < slamRange + e.w) {
                            e.takeDamage(dmg); e.vy = -10; e.vx = (e.x < cx ? -8 : 8);
                            this.mana = Math.min(100, this.mana + 15 + this.furyBonus); hit = true;
                            this.blessingHitEffect(e, cx, cy);
                            if (e.frozenTimer === undefined) e.frozenTimer = 0;
                            e.frozenTimer = 60;
                        }
                    }
                });
                for (let i = 0; i < 8; i++) spawnSpark(cx + (Math.random() - 0.5) * 80, cy + 20, 3, '#88ccff');
                this.comboStep = 0; this.comboTimer = 0;
            }
        } else if (this.currentWeapon === 3) {
            // --- CESTUS DE NEMEIA --- very fast fists
            if (this.comboStep === 0) {
                // JAB — quick punch
                this.attackTimer = effectiveDuration;
                let jabX = cx + Math.cos(this.aimAngle) * baseRange;
                let jabY = cy + Math.sin(this.aimAngle) * baseRange;
                spawnSpark(jabX, jabY, 5, slashColor);
                targets.forEach(e => {
                    if (e.health > 0 && checkPointInRect(jabX, jabY, e.x - 15, e.y - 15, e.w + 30, e.h + 30)) {
                        e.takeDamage(dmg); e.vx = Math.cos(this.aimAngle) * 4;
                        this.mana = Math.min(100, this.mana + 3 + this.furyBonus); hit = true;
                        this.blessingHitEffect(e, cx, cy);
                    }
                });
                this.comboStep = 1; this.comboTimer = this.comboWindow;
            } else if (this.comboStep === 1) {
                // HOOK — side punch with more knockback
                this.attackTimer = effectiveDuration;
                dmg = Math.floor(dmg * 1.2);
                let hookX = cx + Math.cos(this.aimAngle) * (baseRange + 10);
                let hookY = cy + Math.sin(this.aimAngle) * (baseRange + 10);
                spawnSpark(hookX, hookY, 8, slashColor);
                spawnSlash(cx, cy, this.aimAngle + 0.5, 50, slashColor);
                targets.forEach(e => {
                    if (e.health > 0) {
                        let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                        if (d < baseRange + 15 + e.w) {
                            e.takeDamage(dmg); e.vx = Math.cos(this.aimAngle) * 10; e.vy = -3;
                            this.mana = Math.min(100, this.mana + 5 + this.furyBonus); hit = true;
                            this.blessingHitEffect(e, cx, cy);
                        }
                    }
                });
                this.comboStep = 2; this.comboTimer = this.comboWindow;
            } else {
                // UPPERCUT — launches enemies up with AoE stun
                this.attackTimer = effectiveDuration + 3;
                dmg = Math.floor(dmg * 1.8);
                this.vy = -6; // Player jumps slightly
                spawnSlash(cx, cy, -Math.PI / 2, 80, slashColor);
                spawnSpark(cx, cy - 20, 12, slashColor);
                camera.shake = 10;
                let stunRange = baseRange + 30 + aoeExtra;
                targets.forEach(e => {
                    if (e.health > 0) {
                        let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                        if (d < stunRange + e.w) {
                            e.takeDamage(dmg); e.vy = -14; e.vx = 0;
                            this.mana = Math.min(100, this.mana + 10 + this.furyBonus); hit = true;
                            this.blessingHitEffect(e, cx, cy);
                            // Stun
                            if (e.stunTimer === undefined) e.stunTimer = 0;
                            e.stunTimer = 45;
                        }
                    }
                });
                this.comboStep = 0; this.comboTimer = 0;
            }
        }

        if (hit) {
            camera.shake = 6 + this.comboStep * 3;
            hitFreeze = 4 + this.comboStep * 2;
            spawnSpark(cx + Math.cos(this.aimAngle) * 60, cy + Math.sin(this.aimAngle) * 60, 12, slashColor);
        }
    }
    // ===== WEAPON SWITCHING =====
    cycleWeapon() {
        let start = this.currentWeapon;
        do {
            this.currentWeapon = (this.currentWeapon + 1) % 4;
        } while (!unlockedWeapons[this.currentWeapon] && this.currentWeapon !== start);
        this.comboStep = 0; this.comboTimer = 0;
        spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 8, WEAPONS[this.currentWeapon].color);
        updateWeaponHUD();
    }
    selectWeapon(idx) {
        if (idx >= 0 && idx < 4 && unlockedWeapons[idx]) {
            this.currentWeapon = idx;
            this.comboStep = 0; this.comboTimer = 0;
            spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 8, WEAPONS[this.currentWeapon].color);
            updateWeaponHUD();
        }
    }
    // ===== THROW (weapon-dependent) =====
    throwSpear() {
        if (this.currentWeapon === 0) {
            // Lança throw (original)
            if (thrownSpear !== null || this.throwCooldown > 0) return;
            this.throwCooldown = 999;
            this.throwAnim = 15;
            let cx = this.x + this.w / 2, cy = this.y + this.h / 2;
            let dmg = this.baseDmg * 1.5 + (this.mana > 50 ? 30 : 0);
            if (this.activeBlessing) dmg += 25;
            thrownSpear = new ThrownSpear(cx, cy, this.aimAngle, dmg, this.activeBlessing);
            spawnSpark(cx + Math.cos(this.aimAngle) * 20, cy + Math.sin(this.aimAngle) * 20, 10, this.getBlessingColor());
            camera.shake = 5;
            this.vx -= Math.cos(this.aimAngle) * 5; this.vy -= 2;
        } else if (this.currentWeapon === 2) {
            // Machado throw — freezes on impact
            if (thrownSpear !== null || this.throwCooldown > 0) return;
            this.throwCooldown = 999;
            this.throwAnim = 15;
            let cx = this.x + this.w / 2, cy = this.y + this.h / 2;
            let dmg = this.baseDmg * 2.0;
            thrownSpear = new ThrownSpear(cx, cy, this.aimAngle, dmg, 'poseidon'); // frost effect
            spawnSpark(cx + Math.cos(this.aimAngle) * 20, cy + Math.sin(this.aimAngle) * 20, 10, '#88ccff');
            camera.shake = 6;
            this.vx -= Math.cos(this.aimAngle) * 4; this.vy -= 2;
        } else if (this.currentWeapon === 1) {
            // Lâminas — blade recall pull (pulls player forward)
            if (this.throwCooldown > 0) return;
            this.throwCooldown = 30;
            this.throwAnim = 10;
            this.vx = this.facingRight ? 18 : -18;
            this.vy = -5;
            spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 12, '#ff6600');
            camera.shake = 5;
        } else if (this.currentWeapon === 3) {
            // Cestus — ground pound AoE stun
            if (this.throwCooldown > 0) return;
            this.throwCooldown = 45;
            this.throwAnim = 12;
            let cx = this.x + this.w / 2, cy = this.y + this.h / 2;
            camera.shake = 15;
            let stunRange = 120 + this.aoeBonus;
            let targets = [...enemies];
            if (currentBoss && currentBoss.health > 0) targets.push(currentBoss);
            targets.forEach(e => {
                if (e.health > 0) {
                    let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                    if (d < stunRange + e.w) {
                        e.takeDamage(this.baseDmg * 0.5);
                        e.vy = -6;
                        if (e.stunTimer === undefined) e.stunTimer = 0;
                        e.stunTimer = 60;
                        spawnSpark(e.x + e.w / 2, e.y + e.h / 2, 6, '#ffcc00');
                    }
                }
            });
            for (let a = 0; a < Math.PI * 2; a += 0.4) spawnSpark(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50, 3, '#ffcc00');
        }
    }
    // ===== SPECIAL ITEMS =====
    useMedusa() {
        if (!hasMedusaHead || medusaCooldown > 0) return;
        medusaCooldown = 600; // 10 seconds
        let cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        let petrifyRange = 200 + this.aoeBonus;
        camera.shake = 10;
        // Visual
        for (let a = 0; a < Math.PI * 2; a += 0.3) spawnSpark(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60, 4, '#55aa55');
        spawnSpark(cx, cy, 20, '#44ff44');
        // Petrify enemies
        let targets = [...enemies];
        if (currentBoss && currentBoss.health > 0) targets.push(currentBoss);
        targets.forEach(e => {
            if (e.health > 0) {
                let d = dist(cx, cy, e.x + e.w / 2, e.y + e.h / 2);
                if (d < petrifyRange) {
                    if (e.frozenTimer === undefined) e.frozenTimer = 0;
                    e.frozenTimer = 180; // 3 seconds petrified
                    e.vx = 0; e.vy = 0;
                    spawnSpark(e.x + e.w / 2, e.y + e.h / 2, 10, '#888888');
                    spawnDamageNumber(e.x + e.w / 2, e.y - 10, 'PEDRA!', '#aaaaaa');
                }
            }
        });
    }
    useBow() {
        if (!hasApolloBow || bowCooldown > 0) return;
        bowCooldown = 180; // 3 seconds
        let cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        let dmg = this.baseDmg * 1.2;
        // Fire arrow projectile
        let arrow = {
            x: cx, y: cy,
            vx: Math.cos(this.aimAngle) * 18,
            vy: Math.sin(this.aimAngle) * 18,
            dmg: dmg, life: 120, active: true,
            trail: [], hitTargets: new Set()
        };
        apolloArrows.push(arrow);
        spawnSpark(cx + Math.cos(this.aimAngle) * 15, cy + Math.sin(this.aimAngle) * 15, 8, '#ff8800');
        camera.shake = 4;
    }
    takeDamage(amount) {
        // I-frames during dash
        if (this.isDashing) {
            spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 6, '#88ccff');
            spawnDamageNumber(this.x + this.w / 2, this.y - 10, 'DODGE', '#88ccff');
            return;
        }
        // Armor reduces damage
        let reduced = Math.max(1, Math.floor(amount * (1 - this.armor / 100)));
        super.takeDamage(reduced);
    }
    // Called when any attack (melee or throw) hits an enemy
    blessingHitEffect(enemy, cx, cy) {
        if (!this.activeBlessing) return;
        let ex = enemy.x + enemy.w / 2, ey = enemy.y + enemy.h / 2;
        if (this.activeBlessing === 'zeus') {
            // ⚡ Chain lightning to nearby enemies
            spawnSpark(ex, ey, 10, '#88ccff');
            spawnSpark(ex, ey, 6, '#fff');
            let targets = [...enemies];
            if (currentBoss && currentBoss.health > 0) targets.push(currentBoss);
            let chainCount = 0;
            for (let t of targets) {
                if (t === enemy || t.health <= 0) continue;
                let tx = t.x + t.w / 2, ty = t.y + t.h / 2;
                let d = dist(ex, ey, tx, ty);
                if (d < 200) {
                    t.takeDamage(15);
                    t.vy = -5; t.flash = 8;
                    // Lightning arc visual
                    for (let s = 0; s < 4; s++) {
                        let t2 = s / 4;
                        spawnSpark(ex + (tx - ex) * t2 + (Math.random() - 0.5) * 20,
                            ey + (ty - ey) * t2 + (Math.random() - 0.5) * 20, 2, '#88ccff');
                    }
                    spawnSpark(tx, ty, 8, '#88ccff');
                    spawnDamageNumber(tx, ty - 15, 15, '#88ccff');
                    chainCount++;
                    if (chainCount >= 3) break;
                }
            }
        } else if (this.activeBlessing === 'ares') {
            // 🔥 Fire burst
            enemy.takeDamage(20);
            let angle = Math.atan2(ey - cy, ex - cx);
            enemy.vx += Math.cos(angle) * 6;
            enemy.vy = -8;
            for (let i = 0; i < 8; i++) {
                let a = Math.random() * Math.PI * 2;
                let r = 10 + Math.random() * 30;
                spawnSpark(ex + Math.cos(a) * r, ey + Math.sin(a) * r, 3, '#ff4400');
                spawnSpark(ex + Math.cos(a) * r * 0.5, ey + Math.sin(a) * r * 0.5, 2, '#ffaa00');
            }
            spawnDamageNumber(ex, ey - 20, 20, '#ff4400');
        } else if (this.activeBlessing === 'poseidon') {
            // ❄️ Freeze slow
            enemy.vx *= 0.2;
            enemy.speed *= 0.3;
            enemy.flash = 30;
            spawnSpark(ex, ey, 8, '#aaddff');
            spawnSpark(ex, ey - 10, 5, '#88bbee');
            spawnDamageNumber(ex, ey - 20, 'GELO', '#aaddff');
        }
    }
    getBlessingColor() {
        if (this.activeBlessing === 'zeus') return '#88ccff';
        if (this.activeBlessing === 'ares') return '#ff4400';
        if (this.activeBlessing === 'poseidon') return '#aaddff';
        return '#d4af37';
    }
    draw(ctx, cx, cy) {
        let dx = this.x - cx, dy = this.y - cy;
        let centerX = dx + this.w / 2, centerY = dy + this.h / 2;
        let f = this.facingRight ? 1 : -1;
        let isFlash = this.flash > 0;
        if (isFlash) this.flash--;
        let bobY = 0;
        if (this.isGrounded && Math.abs(this.vx) > 0.5) bobY = Math.sin(this.walkTimer * 0.5) * 2;

        // Wings
        if (this.isGliding || (this.hasWings && !this.isGrounded && this.jumpCount >= 2)) {
            let wingFlap = Math.sin(Date.now() / 80) * 8;
            ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
            ctx.beginPath(); ctx.moveTo(centerX - 2, centerY - 8); ctx.lineTo(centerX - 30, centerY - 25 + wingFlap); ctx.lineTo(centerX - 35, centerY - 10 + wingFlap); ctx.lineTo(centerX - 20, centerY + 5); ctx.fill();
            ctx.beginPath(); ctx.moveTo(centerX + 2, centerY - 8); ctx.lineTo(centerX + 30, centerY - 25 + wingFlap); ctx.lineTo(centerX + 35, centerY - 10 + wingFlap); ctx.lineTo(centerX + 20, centerY + 5); ctx.fill();
        }

        // Dash afterimages
        if (this.isDashing) {
            for (let i = 1; i <= 3; i++) { ctx.globalAlpha = 0.15 * (4 - i); ctx.fillStyle = '#88ccff'; let offX = f * -i * 12; ctx.fillRect(dx + offX + 2, dy + 2, this.w - 4, 14); ctx.fillRect(dx + offX, dy + 16, this.w, 20); ctx.fillRect(dx + offX + 4, dy + 36, this.w - 8, 12); }
            ctx.globalAlpha = 1;
        }

        // HEAD
        ctx.fillStyle = isFlash ? '#fff' : '#d4ccc4';
        ctx.fillRect(dx + 5, dy + bobY, 20, 14);
        ctx.fillStyle = '#8b0000'; ctx.fillRect(dx + 5, dy + bobY, 20, 3);
        ctx.fillStyle = isFlash ? '#fff' : '#ffcc00';
        ctx.fillRect(dx + (this.facingRight ? 18 : 8), dy + 5 + bobY, 4, 3);
        // Tattoo
        ctx.fillStyle = '#cc0000';
        if (this.facingRight) { ctx.fillRect(dx + 15, dy + 2 + bobY, 4, 12); ctx.fillRect(dx + 13, dy + 14 + bobY, 6, 8); }
        else { ctx.fillRect(dx + 11, dy + 2 + bobY, 4, 12); ctx.fillRect(dx + 11, dy + 14 + bobY, 6, 8); }
        // TORSO
        ctx.fillStyle = isFlash ? '#fff' : '#c4b8aa'; ctx.fillRect(dx + 3, dy + 14 + bobY, 24, 18);
        ctx.fillStyle = isFlash ? '#eee' : '#a89888';
        ctx.fillRect(dx + 5, dy + 16 + bobY, 8, 4); ctx.fillRect(dx + 17, dy + 16 + bobY, 8, 4);
        // BELT
        ctx.fillStyle = isFlash ? '#ddd' : '#5d4037'; ctx.fillRect(dx + 2, dy + 32 + bobY, 26, 5);
        ctx.fillStyle = '#d4af37'; ctx.fillRect(dx + 12, dy + 32 + bobY, 6, 5);
        // LEGS
        let legOff = this.isGrounded && Math.abs(this.vx) > 0.5 ? Math.sin(this.walkTimer * 0.5) * 3 : 0;
        ctx.fillStyle = isFlash ? '#ddd' : '#6d4c3d';
        ctx.fillRect(dx + 5, dy + 37 + bobY, 8, 11 + legOff); ctx.fillRect(dx + 17, dy + 37 + bobY, 8, 11 - legOff);
        ctx.fillStyle = isFlash ? '#ccc' : '#3e2723';
        ctx.fillRect(dx + 4, dy + 45 + bobY + Math.max(0, legOff), 10, 3); ctx.fillRect(dx + 16, dy + 45 + bobY + Math.max(0, -legOff), 10, 3);
        // Arms
        ctx.fillStyle = isFlash ? '#ddd' : '#8a7b6b';
        ctx.fillRect(dx + (this.facingRight ? 24 : 0), dy + 16 + bobY, 6, 14);

        // Climbing indicator
        if (this.isClimbing) { ctx.fillStyle = 'rgba(255, 200, 100, 0.6)'; ctx.fillRect(dx - 2, dy + 16, 2, 15); ctx.fillRect(dx + this.w, dy + 16, 2, 15); }

        // WEAPON DRAW (depends on currentWeapon)
        let canDrawWeapon = (this.currentWeapon === 0 || this.currentWeapon === 2) ? (thrownSpear === null && this.throwCooldown < 900) : true;
        if (canDrawWeapon) {
            ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(this.aimAngle);
            let off = 0;
            let p = 0;
            if (this.attackTimer > 0) {
                let wep = WEAPONS[this.currentWeapon];
                p = 1 - (this.attackTimer / Math.max(4, Math.floor(this.attackDuration * wep.speedMult)));
            }

            if (this.currentWeapon === 0) {
                // LANÇA DE ESPARTA
                if (this.attackTimer > 0) {
                    if (this.comboStep === 1 || (this.comboStep === 0 && this.comboTimer <= 0)) {
                        if (p < 0.3) off = (p / 0.3) * 50; else off = 50 * (1 - (p - 0.3) / 0.7);
                    } else if (this.comboStep === 2) {
                        ctx.rotate(Math.sin(p * Math.PI) * 1.2);
                    } else { off = Math.sin(p * Math.PI) * 35; }
                }
                ctx.fillStyle = '#6d4c3d'; ctx.fillRect(off - 5, -2.5, this.spearLength + 5, 5);
                ctx.fillStyle = '#8b7355';
                for (let i = 5; i < this.spearLength - 10; i += 12) ctx.fillRect(off + i, -3, 4, 6);
                ctx.fillStyle = this.mana > 50 ? '#ffd700' : '#C0C0C0';
                if (this.mana > 50) { ctx.shadowBlur = 12; ctx.shadowColor = '#ffaa00'; }
                ctx.beginPath(); ctx.moveTo(off + this.spearLength, -7); ctx.lineTo(off + this.spearLength + 28, 0); ctx.lineTo(off + this.spearLength, 7); ctx.fill();
                ctx.fillStyle = this.mana > 50 ? '#fff8e0' : '#e8e8e8';
                ctx.beginPath(); ctx.moveTo(off + this.spearLength + 5, -3); ctx.lineTo(off + this.spearLength + 22, 0); ctx.lineTo(off + this.spearLength + 5, 3); ctx.fill();
            } else if (this.currentWeapon === 1) {
                // LÂMINAS DO CAOS — dual chains with fiery blades
                if (this.attackTimer > 0) {
                    if (this.comboStep === 1) { off = Math.sin(p * Math.PI) * 30; }
                    else if (this.comboStep === 2) { ctx.rotate(p * Math.PI * 2); } // full spin
                    else { off = Math.sin(p * Math.PI * 2) * 25; } // swing oscillation
                }
                // Chain links
                ctx.fillStyle = '#888';
                for (let i = 0; i < 50; i += 8) { ctx.fillRect(off + i, -1, 5, 2); }
                // Blade 1
                ctx.fillStyle = '#ff4400'; ctx.shadowBlur = 8; ctx.shadowColor = '#ff6600';
                ctx.beginPath(); ctx.moveTo(off + 48, -6); ctx.lineTo(off + 68, 0); ctx.lineTo(off + 48, 6);
                ctx.lineTo(off + 52, 0); ctx.fill();
                // Blade 2 (offset below)
                ctx.fillStyle = '#ff6600';
                ctx.beginPath(); ctx.moveTo(off + 40, -4); ctx.lineTo(off + 58, -2); ctx.lineTo(off + 40, 4); ctx.fill();
                // Ember particles
                if (this.attackTimer > 0) {
                    ctx.fillStyle = '#ffcc00'; ctx.globalAlpha = 0.6;
                    ctx.fillRect(off + 55 + Math.random() * 15, -3 + Math.random() * 6, 3, 3);
                    ctx.globalAlpha = 1;
                }
            } else if (this.currentWeapon === 2) {
                // MACHADO LEVIATÃ — heavy axe with ice glow
                if (this.attackTimer > 0) {
                    if (this.comboStep === 0 || (this.comboStep === 2 && this.comboTimer > 0)) {
                        ctx.rotate(Math.sin(p * Math.PI) * -0.8); // chop arc
                    } else if (this.comboStep === 1) {
                        ctx.rotate(Math.sin(p * Math.PI) * 1.4); // cleave swing
                    } else {
                        off = Math.sin(p * Math.PI) * 20; // slam
                    }
                }
                // Handle
                ctx.fillStyle = '#5a3825'; ctx.fillRect(off - 5, -3, 45, 6);
                ctx.fillStyle = '#7a5835';
                ctx.fillRect(off, -2, 3, 4); ctx.fillRect(off + 15, -2, 3, 4); ctx.fillRect(off + 30, -2, 3, 4);
                // Axe head
                ctx.fillStyle = '#88ccff'; ctx.shadowBlur = 10; ctx.shadowColor = '#66aaff';
                ctx.beginPath();
                ctx.moveTo(off + 38, -12); ctx.lineTo(off + 55, -8); ctx.lineTo(off + 58, 0);
                ctx.lineTo(off + 55, 8); ctx.lineTo(off + 38, 12); ctx.lineTo(off + 42, 0); ctx.fill();
                // Ice edge highlight
                ctx.fillStyle = '#cceeFF'; ctx.globalAlpha = 0.7;
                ctx.beginPath(); ctx.moveTo(off + 42, -8); ctx.lineTo(off + 54, -4); ctx.lineTo(off + 55, 0);
                ctx.lineTo(off + 54, 4); ctx.lineTo(off + 42, 8); ctx.lineTo(off + 44, 0); ctx.fill();
                ctx.globalAlpha = 1;
            } else if (this.currentWeapon === 3) {
                // CESTUS DE NEMEIA — golden gauntlets
                if (this.attackTimer > 0) {
                    if (this.comboStep === 0) { off = Math.sin(p * Math.PI) * 25; } // jab
                    else if (this.comboStep === 1) { off = Math.sin(p * Math.PI * 2) * 20; ctx.rotate(0.3); } // hook
                    else { ctx.rotate(-Math.sin(p * Math.PI) * 1.0); off = -Math.sin(p * Math.PI) * 10; } // uppercut
                }
                // Arm wrap
                ctx.fillStyle = '#8B6914';
                ctx.fillRect(off, -3, 20, 6);
                // Gauntlet
                ctx.fillStyle = '#DAA520'; ctx.shadowBlur = 6; ctx.shadowColor = '#ffcc00';
                ctx.fillRect(off + 18, -8, 16, 16);
                // Knuckles
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(off + 28, -6, 5, 4); ctx.fillRect(off + 28, 2, 5, 4);
                ctx.fillRect(off + 26, -2, 5, 4);
                // Lion face emblem
                ctx.fillStyle = '#B8860B';
                ctx.fillRect(off + 20, -4, 6, 8);
            }
            ctx.shadowBlur = 0; ctx.restore();
        }

        // Throw animation (arm extended)
        if (this.throwAnim > 0) {
            ctx.fillStyle = '#c4b8aa';
            let armAngle = this.aimAngle;
            let armLen = 20 * (this.throwAnim / 15);
            ctx.fillRect(centerX + Math.cos(armAngle) * 10 - 3, centerY + Math.sin(armAngle) * 10 - 3, 6, 6);
        }

        // Ira glow
        if (this.mana > 50) {
            ctx.globalAlpha = 0.15 + Math.sin(Date.now() / 150) * 0.08;
            ctx.fillStyle = '#ff4400'; ctx.fillRect(dx - 3, dy - 3, this.w + 6, this.h + 6);
            ctx.globalAlpha = 1;
        }
    }
}

// ===== ENEMY =====
class Enemy extends Character {
    constructor(x, y, type) {
        super(x, y, 30, 45);
        this.type = type; this.patrolStart = x; this.patrolDist = 200;
        this.maxHealth = 60; this.health = 60; this.speed = 3;
        this.attackCooldown = 0; this.orbValue = 2;
        this.animTimer = Math.random() * 100;
        this.platformRef = null; // Track which platform we're on

        switch (type) {
            case 'HARPY': this.w = 30; this.h = 30; this.speed = 4.5; this.maxHealth = 45; this.health = 45; this.orbValue = 2; break;
            case 'MINOTAURO': this.w = 45; this.h = 55; this.speed = 2.5; this.maxHealth = 150; this.health = 150; this.charging = false; this.chargeTimer = 0; this.orbValue = 4; break;
            case 'MEDUSA': this.w = 30; this.h = 45; this.speed = 1; this.maxHealth = 80; this.health = 80; this.orbValue = 3; break;
            case 'CICLOPE': this.w = 50; this.h = 65; this.speed = 1.8; this.maxHealth = 200; this.health = 200; this.orbValue = 5; break;
            case 'ESPARTANO': this.w = 30; this.h = 48; this.speed = 5; this.maxHealth = 100; this.health = 100; this.blocking = false; this.orbValue = 4; break;
            case 'CENTAURO': this.w = 50; this.h = 50; this.speed = 5; this.maxHealth = 120; this.health = 120; this.orbValue = 5; break;
            case 'QUIMERA': this.w = 40; this.h = 35; this.speed = 3.5; this.maxHealth = 130; this.health = 130; this.orbValue = 5; break;
            case 'SOMBRA': this.w = 28; this.h = 45; this.speed = 0; this.maxHealth = 90; this.health = 90; this.teleportTimer = 40; this.orbValue = 6; break;
        }
    }
    takeDamage(amount) {
        if (this.type === 'ESPARTANO' && this.blocking && Math.random() < 0.5) {
            spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 8, '#ffaa00');
            spawnDamageNumber(this.x + this.w / 2, this.y - 10, 0, '#ffaa00');
            hitFreeze = 3; return;
        }
        super.takeDamage(amount);
    }
    // Edge detection — don't walk off platforms
    isNearEdge(dir) {
        let checkX = dir > 0 ? this.x + this.w + 5 : this.x - 5;
        let checkY = this.y + this.h + 10;
        return !isGroundBelow(checkX, checkY, 15);
    }
    updateAI() {
        if (this.health <= 0) return;
        if (Math.abs(this.x - player.x) > width * 1.2) return;
        if (this.attackCooldown > 0) this.attackCooldown--;
        this.animTimer += 0.05;

        let d = dist(this.x + this.w / 2, this.y + this.h / 2, player.x + player.w / 2, player.y + player.h / 2);
        let toPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        let playerDir = player.x > this.x ? 1 : -1;

        switch (this.type) {
            case 'SKELETON':
                if (d < 550) {
                    if (!this.isNearEdge(playerDir)) {
                        if (playerDir > 0) { this.vx += 0.4; this.facingRight = true; } else { this.vx -= 0.4; this.facingRight = false; }
                    } else { this.vx *= 0.5; }
                    if (d < 50 && this.attackCooldown <= 0) { player.takeDamage(14); this.attackCooldown = 20; }
                } else {
                    let patrolDir = this.vx >= 0 ? 1 : -1;
                    if (this.isNearEdge(patrolDir)) { this.vx = -patrolDir * this.speed; this.facingRight = patrolDir < 0; }
                    else if (Math.abs(this.vx) < 0.1) this.vx = this.speed;
                }
                this.applyPhysics(); break;
            case 'HARPY':
                if (d < 550) {
                    this.vx += (playerDir * 0.5); this.y += Math.sin(toPlayer) * 2.5; this.facingRight = playerDir > 0;
                    if (d < 45 && this.attackCooldown <= 0) { player.takeDamage(12); this.attackCooldown = 15; }
                } else {
                    if (this.x > this.patrolStart + this.patrolDist) this.vx = -this.speed;
                    else if (this.x < this.patrolStart - this.patrolDist) this.vx = this.speed;
                }
                this.x += this.vx; this.vx *= 0.93; this.y += Math.sin(Date.now() / 200) * 0.5; this.facingRight = player.x > this.x; break;
            case 'MINOTAURO':
                if (d < 450 && !this.charging && this.attackCooldown <= 0) { this.charging = true; this.chargeTimer = 50; this.facingRight = playerDir > 0; }
                if (this.charging) {
                    this.vx = this.facingRight ? 13 : -13; this.chargeTimer--;
                    if (this.chargeTimer <= 0 || this.isNearEdge(this.facingRight ? 1 : -1)) { this.charging = false; this.attackCooldown = 55; this.vx = 0; }
                    if (d < 55) { player.takeDamage(30); this.charging = false; this.attackCooldown = 55; camera.shake = 15; }
                } else { this.vx *= 0.8; }
                this.applyPhysics(); break;
            case 'MEDUSA':
                this.facingRight = playerDir > 0;
                // Medusa now slowly approaches player
                if (d < 600 && d > 150) {
                    if (!this.isNearEdge(playerDir)) {
                        if (playerDir > 0) this.vx += 0.15; else this.vx -= 0.15;
                    }
                }
                if (d < 600 && this.attackCooldown <= 0) {
                    enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + this.h / 2, Math.cos(toPlayer) * 5.5, Math.sin(toPlayer) * 5.5, 12, '#00ff66'));
                    this.attackCooldown = 50;
                }
                this.applyPhysics(); break;
            case 'CICLOPE':
                this.facingRight = playerDir > 0;
                if (d < 600) {
                    if (!this.isNearEdge(playerDir)) { if (playerDir > 0) this.vx += 0.2; else this.vx -= 0.2; } else this.vx *= 0.5;
                    if (this.attackCooldown <= 0) { enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y, Math.cos(toPlayer) * 4, -6, 20, '#887766')); this.attackCooldown = 65; }
                    if (d < 80) { player.takeDamage(18); this.attackCooldown = Math.max(this.attackCooldown, 30); camera.shake = 8; }
                }
                this.applyPhysics(); break;
            case 'ESPARTANO':
                this.blocking = d < 200 && d > 60;
                if (d < 550) {
                    if (!this.isNearEdge(playerDir)) { if (playerDir > 0) { this.vx += 0.6; this.facingRight = true; } else { this.vx -= 0.6; this.facingRight = false; } } else this.vx *= 0.5;
                    if (d < 50 && this.attackCooldown <= 0) { player.takeDamage(18); this.attackCooldown = 15; }
                }
                this.applyPhysics(); break;
            case 'CENTAURO':
                this.facingRight = playerDir > 0;
                if (d < 200) {
                    let awayDir = playerDir > 0 ? -1 : 1;
                    if (!this.isNearEdge(awayDir)) this.vx += awayDir * 0.4; else this.vx *= 0.5;
                } else if (d < 600) {
                    if (this.attackCooldown <= 0) { enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + 10, Math.cos(toPlayer) * 10, Math.sin(toPlayer) * 10, 10, '#ffcc00')); this.attackCooldown = 30; }
                } else {
                    if (!this.isNearEdge(playerDir)) { if (playerDir > 0) this.vx += 0.4; else this.vx -= 0.4; } else this.vx *= 0.5;
                }
                this.applyPhysics(); break;
            case 'QUIMERA':
                let targetY = player.y - 100;
                if (this.y > targetY) this.vy -= 0.45; else this.vy += 0.3;
                if (playerDir > 0) { this.vx += 0.35; this.facingRight = true; } else { this.vx -= 0.35; this.facingRight = false; }
                if (d < 450 && this.attackCooldown <= 0) {
                    for (let i = -1; i <= 1; i++) enemyProjectiles.push(new EnemyProjectile(this.x + this.w / 2, this.y + this.h, Math.cos(toPlayer + i * 0.2) * 6, Math.sin(toPlayer + i * 0.2) * 6, 8, '#ff4400'));
                    this.attackCooldown = 40;
                }
                this.x += this.vx; this.y += this.vy; this.vx *= 0.93; this.vy *= 0.93; break;
            case 'SOMBRA':
                this.teleportTimer--;
                if (this.teleportTimer <= 0) {
                    spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 10, '#8800ff');
                    this.x = player.x + (Math.random() > 0.5 ? 60 : -60); this.y = player.y - 15;
                    spawnSpark(this.x + this.w / 2, this.y + this.h / 2, 10, '#8800ff');
                    this.teleportTimer = 50 + Math.random() * 40;
                    if (d < 90) player.takeDamage(22);
                }
                this.facingRight = playerDir > 0; this.applyPhysics(); break;
        }
    }
    draw(ctx, cx, cy) {
        if (this.health <= 0) return;
        if (this.x - cx < -60 || this.x - cx > width + 60) return;
        let dx = this.x - cx, dy = this.y - cy;
        let isFlash = this.flash > 0;
        if (isFlash) this.flash--;
        let anim = this.animTimer;

        switch (this.type) {
            case 'SKELETON':
                ctx.fillStyle = isFlash ? '#fff' : '#e8e0d0'; ctx.fillRect(dx + 5, dy, 20, 16);
                ctx.fillStyle = '#000'; ctx.fillRect(dx + 8, dy + 5, 5, 5); ctx.fillRect(dx + 17, dy + 5, 5, 5);
                ctx.fillStyle = isFlash ? '#fff' : '#ff4444'; ctx.fillRect(dx + 9, dy + 6, 3, 3); ctx.fillRect(dx + 18, dy + 6, 3, 3);
                ctx.fillStyle = isFlash ? '#fff' : '#d0c8b8'; ctx.fillRect(dx + 8, dy + 12, 14, 5);
                ctx.fillStyle = isFlash ? '#fff' : '#d4ccc0'; ctx.fillRect(dx + 6, dy + 18, 18, 14);
                ctx.fillStyle = '#1a1a1a'; for (let i = 0; i < 3; i++) ctx.fillRect(dx + 10, dy + 20 + i * 4, 10, 2);
                ctx.fillStyle = isFlash ? '#fff' : '#c8c0b0';
                let sOff = Math.sin(anim * 2) * 2;
                ctx.fillRect(dx + 8, dy + 33, 5, 12 + sOff); ctx.fillRect(dx + 17, dy + 33, 5, 12 - sOff);
                ctx.fillStyle = '#888'; ctx.fillRect(dx + (this.facingRight ? 25 : -15), dy + 15, 3, 25);
                break;
            case 'HARPY':
                let wf = Math.sin(Date.now() / 60) * 12;
                ctx.fillStyle = isFlash ? '#fff' : '#5577aa';
                ctx.beginPath(); ctx.moveTo(dx + 15, dy + 12); ctx.lineTo(dx - 15, dy + wf); ctx.lineTo(dx - 5, dy + 15); ctx.fill();
                ctx.beginPath(); ctx.moveTo(dx + 15, dy + 12); ctx.lineTo(dx + 45, dy + wf); ctx.lineTo(dx + 35, dy + 15); ctx.fill();
                ctx.fillStyle = isFlash ? '#fff' : '#8899bb'; ctx.fillRect(dx + 8, dy + 8, 14, 16);
                ctx.fillStyle = isFlash ? '#fff' : '#aabbdd'; ctx.fillRect(dx + 9, dy, 12, 10);
                ctx.fillStyle = '#ff0'; ctx.fillRect(dx + 11, dy + 3, 3, 3); ctx.fillRect(dx + 17, dy + 3, 3, 3);
                ctx.fillStyle = '#554'; ctx.fillRect(dx + 8, dy + 24, 4, 6); ctx.fillRect(dx + 18, dy + 24, 4, 6);
                break;
            case 'MINOTAURO':
                ctx.fillStyle = isFlash ? '#fff' : '#8b6914';
                ctx.beginPath(); ctx.moveTo(dx, dy + 10); ctx.lineTo(dx - 8, dy - 8); ctx.lineTo(dx + 8, dy + 5); ctx.fill();
                ctx.beginPath(); ctx.moveTo(dx + this.w, dy + 10); ctx.lineTo(dx + this.w + 8, dy - 8); ctx.lineTo(dx + this.w - 8, dy + 5); ctx.fill();
                ctx.fillStyle = isFlash ? '#fff' : '#6b3a2a'; ctx.fillRect(dx + 5, dy, this.w - 10, 18);
                ctx.fillStyle = this.charging ? '#ff0000' : '#ff6600'; ctx.fillRect(dx + 10, dy + 4, 5, 4); ctx.fillRect(dx + this.w - 15, dy + 4, 5, 4);
                ctx.fillStyle = isFlash ? '#fff' : '#7b4a3a'; ctx.fillRect(dx + 2, dy + 18, this.w - 4, 24);
                ctx.fillStyle = isFlash ? '#fff' : '#6b3a2a';
                let mOff = this.charging ? Math.sin(anim * 6) * 4 : Math.sin(anim * 2) * 2;
                ctx.fillRect(dx + 5, dy + 42, 12, 13 + mOff); ctx.fillRect(dx + this.w - 17, dy + 42, 12, 13 - mOff);
                if (this.charging) { ctx.globalAlpha = 0.3; ctx.fillStyle = '#ff2200'; ctx.fillRect(dx - 8, dy - 5, this.w + 16, this.h + 10); ctx.globalAlpha = 1; }
                break;
            case 'MEDUSA':
                ctx.fillStyle = isFlash ? '#fff' : '#00cc44';
                for (let i = 0; i < 7; i++) { let sx = dx + 3 + i * 4, sw = Math.sin(anim * 3 + i * 1.2) * 6; ctx.fillRect(sx, dy - 6 + sw, 3, 10); }
                ctx.fillStyle = isFlash ? '#fff' : '#33aa55'; ctx.fillRect(dx + 5, dy + 4, 20, 14);
                ctx.fillStyle = this.attackCooldown < 20 ? '#ffff00' : '#ff00ff'; ctx.fillRect(dx + 8, dy + 8, 4, 4); ctx.fillRect(dx + 18, dy + 8, 4, 4);
                ctx.fillStyle = isFlash ? '#fff' : '#2a8b4a'; ctx.fillRect(dx + 4, dy + 18, 22, 18);
                ctx.fillStyle = isFlash ? '#fff' : '#2a8b4a'; ctx.fillRect(dx + 8, dy + 36, 14, 9);
                break;
            case 'CICLOPE':
                ctx.fillStyle = isFlash ? '#fff' : '#9b8365'; ctx.fillRect(dx + 8, dy, this.w - 16, 22);
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx + this.w / 2, dy + 12, 9, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ff3300'; ctx.beginPath(); ctx.arc(dx + this.w / 2, dy + 12, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(dx + this.w / 2, dy + 12, 2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = isFlash ? '#fff' : '#8b7355'; ctx.fillRect(dx + 3, dy + 22, this.w - 6, 28);
                ctx.fillStyle = isFlash ? '#fff' : '#9b8365'; ctx.fillRect(dx - 5, dy + 24, 10, 18); ctx.fillRect(dx + this.w - 5, dy + 24, 10, 18);
                ctx.fillStyle = isFlash ? '#fff' : '#7a6345'; ctx.fillRect(dx + 5, dy + 50, 14, 15); ctx.fillRect(dx + this.w - 19, dy + 50, 14, 15);
                break;
            case 'ESPARTANO':
                ctx.fillStyle = isFlash ? '#fff' : '#cc2222'; ctx.fillRect(dx + 2, dy, this.w - 4, 16);
                ctx.fillStyle = isFlash ? '#fff' : '#ff4444'; ctx.fillRect(dx + 10, dy - 6, 10, 8);
                ctx.fillStyle = '#111'; ctx.fillRect(dx + 8, dy + 7, 14, 4);
                ctx.fillStyle = '#ffcc00'; ctx.fillRect(dx + 10, dy + 8, 3, 2); ctx.fillRect(dx + 17, dy + 8, 3, 2);
                ctx.fillStyle = isFlash ? '#fff' : '#bb2222'; ctx.fillRect(dx + 3, dy + 16, this.w - 6, 18);
                ctx.fillStyle = '#daa520'; ctx.fillRect(dx + 3, dy + 32, this.w - 6, 4);
                ctx.fillStyle = isFlash ? '#fff' : '#8b0000'; ctx.fillRect(dx + 5, dy + 36, 8, 12); ctx.fillRect(dx + 17, dy + 36, 8, 12);
                if (this.blocking) { let sx = this.facingRight ? dx - 10 : dx + this.w; ctx.fillStyle = '#daa520'; ctx.fillRect(sx, dy + 5, 10, 28); ctx.fillStyle = '#cc2222'; ctx.fillRect(sx + 3, dy + 14, 4, 10); }
                ctx.fillStyle = '#ccc'; ctx.fillRect(dx + this.w / 2 + (this.facingRight ? 15 : -18), dy + 12, 3, 22);
                break;
            case 'CENTAURO':
                ctx.fillStyle = isFlash ? '#fff' : '#7b5b3a'; ctx.fillRect(dx + 5, dy + 28, 40, 16);
                ctx.fillStyle = isFlash ? '#fff' : '#6b4b2a';
                let cOff = Math.sin(anim * 3) * 3;
                ctx.fillRect(dx + 8, dy + 44, 6, 6 + cOff); ctx.fillRect(dx + 32, dy + 44, 6, 6 + cOff);
                ctx.fillStyle = isFlash ? '#fff' : '#c4a882'; ctx.fillRect(dx + 15, dy + 10, 18, 20);
                ctx.fillStyle = isFlash ? '#fff' : '#c4a882'; ctx.fillRect(dx + 18, dy, 12, 12);
                ctx.fillStyle = '#333'; ctx.fillRect(dx + 18, dy, 12, 4);
                ctx.fillStyle = '#ff6600'; ctx.fillRect(dx + 20, dy + 5, 3, 3); ctx.fillRect(dx + 26, dy + 5, 3, 3);
                break;
            case 'QUIMERA':
                let qf = Math.sin(Date.now() / 70) * 8;
                ctx.fillStyle = isFlash ? '#fff' : '#773300';
                ctx.beginPath(); ctx.moveTo(dx + 20, dy + 8); ctx.lineTo(dx - 10, dy + qf); ctx.lineTo(dx + 5, dy + 15); ctx.fill();
                ctx.beginPath(); ctx.moveTo(dx + 20, dy + 8); ctx.lineTo(dx + 50, dy + qf); ctx.lineTo(dx + 35, dy + 15); ctx.fill();
                ctx.fillStyle = isFlash ? '#fff' : '#cc8833'; ctx.fillRect(dx + 5, dy + 10, 30, 16);
                ctx.fillStyle = isFlash ? '#fff' : '#dda040'; ctx.fillRect(dx + (this.facingRight ? 28 : -3), dy + 5, 15, 14);
                ctx.fillStyle = '#ff0000'; let eyeX = this.facingRight ? dx + 35 : dx + 2; ctx.fillRect(eyeX, dy + 9, 3, 3); ctx.fillRect(eyeX + 5, dy + 9, 3, 3);
                ctx.fillStyle = isFlash ? '#fff' : '#bb7722'; ctx.fillRect(dx + 8, dy + 26, 5, 9); ctx.fillRect(dx + 27, dy + 26, 5, 9);
                break;
            case 'SOMBRA':
                let pulse = Math.sin(Date.now() / 200) * 0.3;
                ctx.globalAlpha = 0.5 + pulse;
                ctx.fillStyle = isFlash ? '#fff' : '#4400aa'; ctx.fillRect(dx + 2, dy + 5, this.w - 4, this.h - 10);
                ctx.fillStyle = isFlash ? '#fff' : '#220066'; ctx.fillRect(dx, dy, this.w, 15);
                ctx.fillStyle = '#ff00ff'; ctx.shadowBlur = 8; ctx.shadowColor = '#ff00ff';
                ctx.fillRect(dx + 6, dy + 7, 4, 4); ctx.fillRect(dx + 18, dy + 7, 4, 4); ctx.shadowBlur = 0;
                ctx.fillStyle = isFlash ? '#fff' : '#330088';
                for (let i = 0; i < 3; i++) { let wy = Math.sin(anim * 3 + i * 2) * 5; ctx.fillRect(dx + 4 + i * 8, dy + this.h - 12 + wy, 6, 10); }
                ctx.fillStyle = '#888'; let scyX = this.facingRight ? dx + this.w : dx - 8; ctx.fillRect(scyX, dy + 5, 3, 30);
                ctx.globalAlpha = 1; break;
        }

        // Health bar
        let barW = Math.max(this.w, 30), barX = dx + (this.w - barW) / 2;
        ctx.fillStyle = '#333'; ctx.fillRect(barX, dy - 12, barW, 6);
        let hpR = this.health / this.maxHealth;
        ctx.fillStyle = hpR > 0.5 ? '#44bb44' : hpR > 0.25 ? '#ddaa00' : '#ff3333';
        ctx.fillRect(barX + 1, dy - 11, (barW - 2) * hpR, 4);
    }
}
