// ===== MAIN GAME LOOP =====
let player;

// ===== ZONE ENEMY POOL =====
function getEnemyTypeForZone(zone) {
    const pools = {
        1: ['SKELETON', 'SKELETON', 'HARPY'],
        2: ['SKELETON', 'HARPY', 'MINOTAURO', 'MEDUSA'],
        3: ['SKELETON', 'HARPY', 'MINOTAURO', 'CICLOPE', 'ESPARTANO'],
        4: ['HARPY', 'MINOTAURO', 'CENTAURO', 'QUIMERA', 'ESPARTANO'],
        5: ['ESPARTANO', 'CENTAURO', 'QUIMERA', 'SOMBRA', 'CICLOPE'],
        6: ['ESPARTANO', 'CENTAURO', 'QUIMERA', 'SOMBRA', 'CICLOPE'],
        7: ['SOMBRA', 'QUIMERA', 'CENTAURO', 'ESPARTANO', 'CICLOPE', 'SOMBRA']
    };
    let pool = pools[zone] || pools[1];
    return pool[Math.floor(Math.random() * pool.length)];
}

// ===== PROCEDURAL GENERATION =====
function generateChunk() {
    let chunkType = Math.random();
    let chunkLength = 200 + Math.random() * 300;
    let zoneProgress = (nextSpawnX - zoneStartX);

    if (nextSpawnX === 0) {
        lastPlatformY = height - 100;
        platforms.push(new Platform(-200, lastPlatformY, 1500, 50));
        nextSpawnX = 1300;
        return;
    }

    // Boss gate at end of zone
    if (zoneProgress > ZONE_LENGTH && !bossSpawned) {
        // Create boss arena — large with elevated platforms
        let arenaY = height - 150;
        let arenaW = 1200;
        // Main floor
        platforms.push(new Platform(nextSpawnX, arenaY, arenaW, 50));
        // Walls on sides (taller)
        platforms.push(new Platform(nextSpawnX - 30, arenaY - 400, 30, 450));
        platforms.push(new Platform(nextSpawnX + arenaW, arenaY - 400, 30, 450));
        // Elevated side platforms for retreating
        platforms.push(new Platform(nextSpawnX + 40, arenaY - 150, 180, 20));
        platforms.push(new Platform(nextSpawnX + arenaW - 220, arenaY - 150, 180, 20));
        // Higher mid platforms
        platforms.push(new Platform(nextSpawnX + 300, arenaY - 260, 150, 20));
        platforms.push(new Platform(nextSpawnX + arenaW - 450, arenaY - 260, 150, 20));
        // Boss
        currentBoss = new Boss(nextSpawnX + arenaW / 2, arenaY - 100, currentZone);
        bossSpawned = true;
        lastPlatformY = arenaY;
        nextSpawnX += arenaW + 100;
        return;
    }

    if (bossSpawned) return; // Don't generate past boss

    if (chunkType < 0.80) {
        // GROUND RUN — dominant chunk type for combat focus
        lastPlatformY += (Math.random() - 0.3) * 60;
        lastPlatformY = Math.max(100, Math.min(height - 50, lastPlatformY));
        chunkLength = 250 + Math.random() * 350; // wider platforms
        platforms.push(new Platform(nextSpawnX, lastPlatformY, chunkLength, 50));

        // Always spawn at least one enemy
        enemies.push(new Enemy(nextSpawnX + chunkLength * 0.3, lastPlatformY - 60, getEnemyTypeForZone(currentZone)));
        if (Math.random() > 0.2) {
            enemies.push(new Enemy(nextSpawnX + chunkLength / 2, lastPlatformY - 60, getEnemyTypeForZone(currentZone)));
        }
        if (Math.random() > 0.4) {
            enemies.push(new Enemy(nextSpawnX + chunkLength * 0.8, lastPlatformY - 60, getEnemyTypeForZone(currentZone)));
        }
        nextSpawnX += chunkLength + Math.random() * 80; // smaller gaps

    } else if (chunkType < 0.92) {
        // FLOATING ISLANDS
        let numIslands = 2 + Math.floor(Math.random() * 2); // fewer islands
        for (let i = 0; i < numIslands; i++) {
            let w = 100 + Math.random() * 100;
            let hY = lastPlatformY + (Math.random() - 0.5) * 200;
            hY = Math.max(200, Math.min(height - 100, hY));
            platforms.push(new Platform(nextSpawnX, hY, w, 20));
            if (Math.random() > 0.5) {
                enemies.push(new Enemy(nextSpawnX + w / 2, hY - 60, getEnemyTypeForZone(currentZone)));
            }
            lastPlatformY = hY;
            nextSpawnX += w + 80 + Math.random() * 100;
        }

    } else if (chunkType < 0.97) {
        // TOWER (climbable!) — NO separate top platform
        let baseY = lastPlatformY;
        let wallH = 180 + Math.floor(Math.random() * 120);
        let topY = baseY - wallH;
        if (topY < 120) { topY = 120; wallH = baseY - topY; }
        // Single wide climbable wall — player stands directly on top
        platforms.push(new Platform(nextSpawnX, topY, 60, wallH, true));
        if (Math.random() > 0.5) enemies.push(new Enemy(nextSpawnX + 15, topY - 55, getEnemyTypeForZone(currentZone)));
        // Add a regular ground platform on the other side to continue
        let nextGroundY = topY + Math.floor(Math.random() * 100);
        if (nextGroundY > height - 80) nextGroundY = height - 120;
        platforms.push(new Platform(nextSpawnX + 100, nextGroundY, 200 + Math.random() * 150, 40));
        lastPlatformY = nextGroundY;
        nextSpawnX += 350 + Math.random() * 100;

    } else {
        // CANYON (wall jump section) — NO top bridges
        let depth = 150 + Math.random() * 100;
        let canyonY = lastPlatformY;
        let topY = canyonY - depth;
        if (topY < 120) topY = 120;
        // Wide climbable walls — player stands directly on top
        platforms.push(new Platform(nextSpawnX, topY, 50, canyonY - topY, true));
        platforms.push(new Platform(nextSpawnX + 160, topY, 50, canyonY - topY, true));
        if (Math.random() > 0.4) enemies.push(new Enemy(nextSpawnX + 90, canyonY - 80, 'HARPY'));
        // Continue platform after canyon
        platforms.push(new Platform(nextSpawnX + 250, topY + 50, 200 + Math.random() * 100, 40));
        lastPlatformY = topY + 50;
        nextSpawnX += 500;
    }

    // Wings drop in zone 1
    if (!player.hasWings && nextSpawnX - zoneStartX > 2500 && Math.random() < 0.04) {
        pickups.push(new Pickup(nextSpawnX - 50, lastPlatformY - 100, 'WINGS'));
    }
}

function cleanupWorld() {
    let cullX = camera.x - 500;
    platforms = platforms.filter(p => p.x + p.w > cullX);
    enemies = enemies.filter(e => e.x > cullX);
    particles = particles.filter(p => p.x > cullX);
    projectiles = projectiles.filter(p => p.x > cullX);
    pickups = pickups.filter(p => p.x > cullX);
    orbs = orbs.filter(o => o.x > cullX && o.life > 0);
    enemyProjectiles = enemyProjectiles.filter(p => p.active && p.x > cullX);
}
// ===== BUILD MENU =====
let blessingsOwned = { zeus: false, ares: false, poseidon: false };
const BLESSING_COSTS = { zeus: 20, ares: 25, poseidon: 20 };
const BLESSING_COLORS = { zeus: '#88ccff', ares: '#ff4400', poseidon: '#aaddff' };
const BLESSING_EMOJIS = { zeus: '⚡', ares: '🔥', poseidon: '❄️', none: '⚔️' };

function openBuildMenu() {
    if (gameState !== 'PLAYING') return;
    gameState = 'BUILD';
    document.getElementById('build-menu').style.display = 'flex';
    updateBuildUI();
}
function closeBuildMenu() {
    document.getElementById('build-menu').style.display = 'none';
    gameState = 'PLAYING';
    loop();
}
function updateBuildUI() {
    document.getElementById('build-orbs').innerText = playerOrbs;

    // Blessings
    let names = ['zeus', 'ares', 'poseidon'];
    for (let name of names) {
        let el = document.getElementById('build-' + name);
        let costEl = document.getElementById('cost-' + name);
        let effectEl = document.getElementById('effect-' + name);
        el.classList.remove('maxed', 'equipped');
        el.style.borderColor = '';
        if (blessingsOwned[name]) {
            if (player.activeBlessing === name) {
                costEl.innerText = '🟢 EQUIPADO';
                effectEl.innerText = '✨ Ativo na lança!';
                el.style.borderColor = BLESSING_COLORS[name];
                el.style.boxShadow = '0 0 25px ' + BLESSING_COLORS[name];
                el.classList.add('equipped');
            } else {
                costEl.innerText = '🔵 Clique para EQUIPAR';
                effectEl.innerText = 'Comprado — clique para usar';
                el.style.borderColor = '#555';
            }
        } else {
            costEl.innerText = `Custo: ${BLESSING_COSTS[name]} Orbes`;
            effectEl.innerText = 'Não comprado';
        }
    }

    // Blessing indicator
    let bi = document.getElementById('blessing-indicator');
    let ab = player.activeBlessing || 'none';
    bi.innerHTML = BLESSING_EMOJIS[ab];
    if (ab !== 'none') {
        bi.style.borderColor = BLESSING_COLORS[ab];
        bi.style.boxShadow = '0 0 10px ' + BLESSING_COLORS[ab];
    } else { bi.style.borderColor = '#888'; bi.style.boxShadow = 'none'; }

    // Generic upgrade display helper
    function showUpgrade(key, label, valueStr) {
        let lvl = UPGRADES[key].current;
        let elLvl = document.getElementById('level-' + key);
        let elEff = document.getElementById('effect-' + key);
        let elCost = document.getElementById('cost-' + key);
        let elCard = document.getElementById('build-' + key);
        if (elLvl) elLvl.innerText = `Nível ${lvl}`;
        if (elEff) elEff.innerText = valueStr;
        if (elCard) elCard.classList.remove('maxed');
        let cost = lvl < 3 ? UPGRADES[key].levels[lvl] : Math.floor(UPGRADES[key].levels[2] * Math.pow(1.5, lvl - 2));
        if (elCost) elCost.innerText = `Custo: ${cost} Orbes`;
    }

    showUpgrade('hp', 'Vitalidade', `Atual: ${player.maxHealth} HP`);
    showUpgrade('vamp', 'Vampirismo', `${player.vampHeal} HP/kill`);
    showUpgrade('dmg', 'Força', `Atual: ${player.baseDmg} dano`);
    showUpgrade('dash', 'Dash', UPGRADES.dash.current > 0 ? `Dash: ${player.dashDist}px + i-frames` : 'Bloqueado');
    showUpgrade('speed', 'Velocidade', UPGRADES.speed.current > 0 ? `-${player.attackSpeedBonus} frames` : 'Normal');
    showUpgrade('aoe', 'Alcance', UPGRADES.aoe.current > 0 ? `+${player.aoeBonus}px range` : 'Normal');
    showUpgrade('armor', 'Armadura', `${player.armor}% redução`);
    showUpgrade('regen', 'Regeneração', `${player.regenRate} HP/seg`);
    showUpgrade('wings', 'Asas+', UPGRADES.wings.current > 0 ? `${player.maxJumps} pulos` : 'Normal');
    showUpgrade('magnet', 'Magnetismo', `${player.magnetRange}px range`);
    showUpgrade('fury', 'Ira', UPGRADES.fury.current > 0 ? `+${player.furyBonus} IRA/hit` : 'Normal');

    if (UPGRADES.dash.current > 0) document.getElementById('icon-dash').classList.add('active');
}

function buyOrEquipBlessing(name) {
    if (!blessingsOwned[name]) {
        if (playerOrbs < BLESSING_COSTS[name]) return;
        playerOrbs -= BLESSING_COSTS[name];
        blessingsOwned[name] = true;
        player.activeBlessing = name;
        camera.shake = 8;
        spawnSpark(player.x + player.w / 2, player.y + player.h / 2, 25, BLESSING_COLORS[name]);
    } else {
        if (player.activeBlessing === name) player.activeBlessing = null;
        else player.activeBlessing = name;
    }
    updateBuildUI();
}

function buyUpgrade(type) {
    let up = UPGRADES[type];
    let lvl = up.current;
    let cost = lvl < 3 ? up.levels[lvl] : Math.floor(up.levels[2] * Math.pow(1.5, lvl - 2));
    if (playerOrbs < cost) return;
    playerOrbs -= cost;
    let effect = lvl < 3 ? up.effects[lvl] : up.effects[2];
    up.current++;

    switch (type) {
        case 'hp': player.maxHealth += effect; player.health = player.maxHealth; break;
        case 'vamp': player.vampHeal += (lvl < 3 ? effect - (lvl > 0 ? up.effects[lvl - 1] : 0) : 10); document.getElementById('icon-vamp').classList.add('active'); break;
        case 'dmg': player.baseDmg += effect; break;
        case 'dash': player.dashDist += (lvl < 3 ? effect - (lvl > 0 ? up.effects[lvl - 1] : 0) : 100); document.getElementById('icon-dash').classList.add('active'); break;
        case 'speed': player.attackSpeedBonus += effect; break;
        case 'aoe': player.aoeBonus += effect; break;
        case 'armor': player.armor += effect; break;
        case 'regen': player.regenRate += (lvl < 3 ? effect - (lvl > 0 ? up.effects[lvl - 1] : 0) : 1); break;
        case 'wings': player.maxJumps += 1; player.hasWings = true; document.getElementById('icon-wings').classList.add('active'); break;
        case 'magnet': player.magnetRange += effect; break;
        case 'fury': player.furyBonus += effect; break;
    }
    updateBuildUI();
}

// ===== ZONE TRANSITION =====
function advanceZone() {
    if (currentZone >= 7) {
        // DLC Victory — Zeus defeated!
        gameState = 'VICTORY';
        document.getElementById('dlc-victory-screen').style.display = 'flex';
        return;
    }
    if (currentZone >= 5 && !dlcActive) {
        // Base game Victory — offer DLC
        gameState = 'VICTORY';
        document.getElementById('victory-screen').style.display = 'flex';
        return;
    }
    currentZone++;
    bossSpawned = false; currentBoss = null;
    zoneStartX = nextSpawnX;

    document.getElementById('zone-name').innerText = `Zona ${currentZone} — ${ZONE_DATA[currentZone - 1].name}`;

    // Transition effect
    let transEl = document.getElementById('zone-transition');
    document.getElementById('zone-trans-title').innerText = currentZone >= 6 ? `⚡ DLC — Zona ${currentZone}` : `Zona ${currentZone}`;
    document.getElementById('zone-trans-sub').innerText = ZONE_DATA[currentZone - 1].name;
    transEl.style.display = 'flex';
    setTimeout(() => { transEl.style.display = 'none'; }, 2500);
}

function startDLC() {
    dlcActive = true;
    document.getElementById('victory-screen').style.display = 'none';
    gameState = 'PLAYING';
    advanceZone();
    loop();
}

// ===== CAMERA =====
function updateCamera() {
    let targetX = player.x - width / 3;
    let targetY = player.y - height / 1.5;
    camera.x += (targetX - camera.x) * 0.1;
    camera.y += (targetY - camera.y) * 0.1;
    if (camera.shake > 0) {
        camera.x += (Math.random() - 0.5) * camera.shake;
        camera.y += (Math.random() - 0.5) * camera.shake;
        camera.shake *= 0.9;
        if (camera.shake < 0.5) camera.shake = 0;
    }
}

// ===== INIT =====
function init() {
    player = new Player();
    platforms = []; enemies = []; pickups = []; particles = [];
    projectiles = []; orbs = []; enemyProjectiles = [];
    damageNumbers = []; slashEffects = []; hitFreeze = 0;
    thrownSpear = null;
    nextSpawnX = 0; currentZone = 1; zoneStartX = 0;
    bossSpawned = false; currentBoss = null; playerOrbs = 0;
    dlcActive = false;
    UPGRADES.hp.current = 0; UPGRADES.vamp.current = 0;
    UPGRADES.dmg.current = 0; UPGRADES.dash.current = 0;
    UPGRADES.speed.current = 0; UPGRADES.aoe.current = 0;
    UPGRADES.armor.current = 0; UPGRADES.regen.current = 0;
    UPGRADES.wings.current = 0; UPGRADES.magnet.current = 0;
    UPGRADES.fury.current = 0;
    // Reset weapons
    unlockedWeapons = [true, false, false, false];
    hasMedusaHead = false; hasApolloBow = false;
    medusaCooldown = 0; bowCooldown = 0;
    apolloArrows = [];

    document.getElementById('zone-name').innerText = `Zona 1 — ${ZONE_DATA[0].name}`;
    document.getElementById('icon-wings').classList.remove('active');
    document.getElementById('icon-dash').classList.remove('active');
    document.getElementById('icon-vamp').classList.remove('active');
    document.getElementById('boss-bar').style.display = 'none';
    document.getElementById('build-menu').style.display = 'none';
    document.querySelectorAll('.build-card').forEach(c => c.classList.remove('maxed'));

    while (nextSpawnX < width * 2) generateChunk();
    gameState = 'PLAYING';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('victory-screen').style.display = 'none';
    document.getElementById('dlc-victory-screen').style.display = 'none';
    updateWeaponHUD();
    loop();
}

// ===== MAIN LOOP =====
function loop() {
    if (gameState !== 'PLAYING') return;
    requestAnimationFrame(loop);

    // Hitstop: skip game updates but still draw
    if (hitFreeze > 0) {
        hitFreeze--;
        // Still draw the frame (frozen)
        drawFrame();
        return;
    }

    player.update();
    updateCamera();

    // Generation
    if (!bossSpawned && camera.x + width * 1.5 > nextSpawnX) generateChunk();
    cleanupWorld();

    // Cooldowns for special items
    if (medusaCooldown > 0) medusaCooldown--;
    if (bowCooldown > 0) bowCooldown--;

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        // Frozen / stun effects
        if (e.frozenTimer && e.frozenTimer > 0) { e.frozenTimer--; e.vx *= 0.3; }
        if (e.stunTimer && e.stunTimer > 0) { e.stunTimer--; e.vx = 0; e.vy = Math.min(e.vy, 0); }
        if (!(e.stunTimer > 0)) e.updateAI();
        if (e.health <= 0) {
            spawnBlood(e.x + e.w / 2, e.y + e.h / 2, 20);
            for (let j = 0; j < e.orbValue; j++) orbs.push(new Orb(e.x + e.w / 2, e.y + e.h / 2, 1));
            if (player.vampHeal > 0) {
                player.health = Math.min(player.maxHealth, player.health + player.vampHeal);
                spawnSpark(player.x + player.w / 2, player.y, 5, '#00ff00');
            }
            enemies.splice(i, 1);
        }
    }

    // Boss
    if (currentBoss) {
        currentBoss.updateAI();
        document.getElementById('boss-bar').style.display = 'block';
        document.getElementById('boss-name').innerText = currentBoss.name;
        document.getElementById('boss-bar-fill').style.width = Math.max(0, (currentBoss.health / currentBoss.maxHealth) * 100) + '%';

        // Frozen / stun on boss
        if (currentBoss.frozenTimer && currentBoss.frozenTimer > 0) { currentBoss.frozenTimer--; currentBoss.vx *= 0.3; }
        if (currentBoss.stunTimer && currentBoss.stunTimer > 0) { currentBoss.stunTimer--; }

        if (currentBoss.health <= 0) {
            spawnBlood(currentBoss.x + currentBoss.w / 2, currentBoss.y + currentBoss.h / 2, 40);
            for (let j = 0; j < 20; j++) orbs.push(new Orb(currentBoss.x + currentBoss.w / 2, currentBoss.y + currentBoss.h / 2, 2));
            camera.shake = 20;
            document.getElementById('boss-bar').style.display = 'none';
            // WEAPON / ITEM DROP
            let bossZone = currentBoss.zone;
            let dropName = '';
            if (bossZone === 1 && !unlockedWeapons[1]) { unlockedWeapons[1] = true; dropName = '⛓️ Lâminas do Caos'; }
            else if (bossZone === 2 && !unlockedWeapons[2]) { unlockedWeapons[2] = true; dropName = '🪓 Machado Leviatã'; }
            else if (bossZone === 3 && !unlockedWeapons[3]) { unlockedWeapons[3] = true; dropName = '🥊 Cestus de Nemeia'; }
            else if (bossZone === 4 && !hasMedusaHead) { hasMedusaHead = true; dropName = '🐍 Cabeça de Medusa'; }
            else if (bossZone === 5 && !hasApolloBow) { hasApolloBow = true; dropName = '🏹 Arco de Apolo'; }
            else if (bossZone === 6) { dropName = '🔥 Chama do Titã'; playerOrbs += 30; }
            else if (bossZone === 7) { dropName = '⚡ Raio de Zeus'; }
            if (dropName) {
                document.getElementById('item-pickup').style.display = 'flex';
                document.getElementById('item-name').innerText = dropName;
                document.getElementById('item-desc').innerText = bossZone <= 3 ? 'Nova arma! Troque com Q ou 1-4' : bossZone === 4 ? 'Pressione E para petrificar!' : bossZone === 5 ? 'Pressione R para atirar flechas!' : bossZone === 6 ? '+30 Orbes! Poder dos Titãs absorvido!' : '⚡ O poder supremo é seu!';
                gameState = 'PICKUP';
                updateWeaponHUD();
            }
            currentBoss = null;
            setTimeout(advanceZone, dropName ? 0 : 1500);
        }
    }

    // Thrown spear (magic return)
    if (thrownSpear) {
        thrownSpear.update();
    }

    // Player projectiles (legacy, kept for compatibility)
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.update();
        let targets = [...enemies];
        if (currentBoss && currentBoss.health > 0) targets.push(currentBoss);
        for (let e of targets) {
            if (e.health > 0 && p.active && checkPointInRect(p.x, p.y, e.x, e.y, e.w, e.h)) {
                e.takeDamage(p.dmg);
                p.active = false;
                spawnSpark(p.x, p.y, 5, 'cyan');
            }
        }
        if (!p.active) projectiles.splice(i, 1);
    }

    // Apollo arrows
    for (let i = apolloArrows.length - 1; i >= 0; i--) {
        let a = apolloArrows[i];
        a.x += a.vx; a.y += a.vy; a.life--;
        a.trail.push({ x: a.x, y: a.y, t: 10 });
        if (a.trail.length > 15) a.trail.shift();
        a.trail.forEach(t => t.t--);
        // Hit enemies
        let targets = [...enemies];
        if (currentBoss && currentBoss.health > 0) targets.push(currentBoss);
        targets.forEach(e => {
            if (e.health > 0 && !a.hitTargets.has(e) && checkPointInRect(a.x, a.y, e.x, e.y, e.w, e.h)) {
                e.takeDamage(a.dmg);
                a.hitTargets.add(e);
                spawnSpark(a.x, a.y, 8, '#ff6600');
                spawnDamageNumber(a.x, a.y - 10, Math.floor(a.dmg), '#ff8800');
                // Fire damage over time (set burning)
                if (e.burnTimer === undefined) e.burnTimer = 0;
                e.burnTimer = 120;
                camera.shake = 4;
            }
        });
        if (a.life <= 0) { apolloArrows.splice(i, 1); continue; }
        // Off screen
        if (a.x < camera.x - 200 || a.x > camera.x + width + 200 || a.y > height + 200) apolloArrows.splice(i, 1);
    }

    // Enemy projectiles
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        enemyProjectiles[i].update();
        // Add gravity to rocks
        if (enemyProjectiles[i].color === '#887766') enemyProjectiles[i].vy += 0.15;
        if (!enemyProjectiles[i].active) enemyProjectiles.splice(i, 1);
    }

    // Orbs
    for (let i = orbs.length - 1; i >= 0; i--) {
        orbs[i].update();
        if (orbs[i].life <= 0) orbs.splice(i, 1);
    }

    pickups.forEach(p => p.update());

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    if (player.health <= 0) { gameOver(); return; }

    drawFrame();
}

function drawFrame() {
    // ===== DRAW =====
    let zd = ZONE_DATA[currentZone - 1];
    ctx.fillStyle = zd.bg1;
    ctx.fillRect(0, 0, width, height);

    // Parallax mountains
    ctx.fillStyle = zd.bg2;
    ctx.beginPath(); ctx.moveTo(0, height);
    for (let i = 0; i <= width; i += 80) {
        let wx = camera.x * 0.3 + i;
        let mh = 200 + Math.sin(wx * 0.005) * 100 + Math.cos(wx * 0.02) * 50;
        ctx.lineTo(i, height - mh);
    }
    ctx.lineTo(width, height); ctx.fill();

    // Second mountain layer (closer)
    ctx.fillStyle = zd.bg2 + '88';
    ctx.beginPath(); ctx.moveTo(0, height);
    for (let i = 0; i <= width; i += 60) {
        let wx = camera.x * 0.6 + i;
        let mh = 120 + Math.sin(wx * 0.008 + 1) * 70 + Math.cos(wx * 0.03) * 30;
        ctx.lineTo(i, height - mh);
    }
    ctx.lineTo(width, height); ctx.fill();

    // Zone 4 lava glow
    if (currentZone === 4) {
        ctx.fillStyle = `rgba(255, ${60 + Math.sin(Date.now() / 500) * 30}, 0, 0.15)`;
        ctx.fillRect(0, height - 120, width, 120);
    }
    // Zone 5 lightning flashes
    if (currentZone === 5 && Math.random() < 0.003) {
        ctx.fillStyle = 'rgba(200, 200, 255, 0.15)';
        ctx.fillRect(0, 0, width, height);
    }
    // Zone 6 cosmic glow
    if (currentZone === 6) {
        ctx.fillStyle = `rgba(80, 60, 200, ${0.05 + Math.sin(Date.now() / 800) * 0.03})`;
        ctx.fillRect(0, 0, width, height);
        // Floating cosmic particles
        if (Math.random() < 0.02) {
            let sx = Math.random() * width, sy = Math.random() * height * 0.5;
            ctx.fillStyle = 'rgba(150, 130, 255, 0.3)';
            ctx.beginPath(); ctx.arc(sx, sy, Math.random() * 3 + 1, 0, Math.PI * 2); ctx.fill();
        }
    }
    // Zone 7 constant lightning storm
    if (currentZone === 7) {
        // Golden storm sky
        ctx.fillStyle = `rgba(255, 200, 0, ${0.03 + Math.sin(Date.now() / 300) * 0.02})`;
        ctx.fillRect(0, 0, width, height);
        // Frequent lightning flashes
        if (Math.random() < 0.015) {
            ctx.fillStyle = `rgba(255, 255, 200, ${0.1 + Math.random() * 0.15})`;
            ctx.fillRect(0, 0, width, height);
        }
        // Lightning bolts in background
        if (Math.random() < 0.008) {
            let lx = Math.random() * width;
            ctx.strokeStyle = `rgba(255, 230, 100, ${0.3 + Math.random() * 0.4})`;
            ctx.lineWidth = 2 + Math.random() * 3;
            ctx.beginPath(); ctx.moveTo(lx, 0);
            let ly = 0;
            while (ly < height * 0.6) {
                lx += (Math.random() - 0.5) * 40;
                ly += 20 + Math.random() * 30;
                ctx.lineTo(lx, ly);
            }
            ctx.stroke();
        }
    }

    platforms.forEach(p => p.draw(ctx, camera.x, camera.y));
    pickups.forEach(p => p.draw(ctx, camera.x, camera.y));
    orbs.forEach(o => o.draw(ctx, camera.x, camera.y));
    enemies.forEach(e => e.draw(ctx, camera.x, camera.y));
    if (currentBoss) currentBoss.draw(ctx, camera.x, camera.y);
    player.draw(ctx, camera.x, camera.y);
    if (thrownSpear) thrownSpear.draw(ctx, camera.x, camera.y);
    projectiles.forEach(p => p.draw(ctx, camera.x, camera.y));
    enemyProjectiles.forEach(p => p.draw(ctx, camera.x, camera.y));
    particles.forEach(p => p.draw(ctx, camera.x, camera.y));

    // Slash effects (on top of everything)
    updateAndDrawSlashEffects(ctx, camera.x, camera.y);
    // Damage numbers (topmost)
    updateAndDrawDamageNumbers(ctx, camera.x, camera.y);

    // Hit freeze flash
    if (hitFreeze > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(0, 0, width, height);
    }

    // Apollo arrows draw
    apolloArrows.forEach(a => {
        // Trail
        a.trail.forEach(t => {
            ctx.globalAlpha = t.t / 10 * 0.5;
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(a.x - camera.x - (a.x - t.x), a.y - camera.y - (a.y - t.y) - 2, 4, 4);
        });
        ctx.globalAlpha = 1;
        // Arrow
        let angle = Math.atan2(a.vy, a.vx);
        ctx.save();
        ctx.translate(a.x - camera.x, a.y - camera.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#8B4513'; ctx.fillRect(-12, -1, 18, 2); // shaft
        ctx.fillStyle = '#ff6600'; ctx.shadowBlur = 6; ctx.shadowColor = '#ff4400';
        ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(14, 0); ctx.lineTo(6, 4); ctx.fill(); // head
        ctx.shadowBlur = 0;
        ctx.restore();
    });

    // Frozen/stone overlay on enemies
    enemies.forEach(e => {
        if (e.frozenTimer && e.frozenTimer > 0) {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = e.frozenTimer > 60 ? '#999' : '#aaddff';
            ctx.fillRect(e.x - camera.x, e.y - camera.y, e.w, e.h);
            ctx.globalAlpha = 1;
        }
        if (e.stunTimer && e.stunTimer > 0) {
            let spin = Date.now() / 200;
            ctx.fillStyle = '#ffcc00';
            for (let s = 0; s < 3; s++) {
                let sa = spin + s * 2.1;
                ctx.fillRect(e.x + e.w / 2 - camera.x + Math.cos(sa) * 12 - 2, e.y - 8 - camera.y + Math.sin(sa) * 5 - 2, 4, 4);
            }
        }
    });
    if (currentBoss) {
        if (currentBoss.frozenTimer && currentBoss.frozenTimer > 0) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = currentBoss.frozenTimer > 60 ? '#999' : '#aaddff';
            ctx.fillRect(currentBoss.x - camera.x, currentBoss.y - camera.y, currentBoss.w, currentBoss.h);
            ctx.globalAlpha = 1;
        }
    }

    // Weapon HUD bar
    let hudY = height - 60;
    let hudX = width / 2 - 100;
    for (let i = 0; i < 4; i++) {
        let wx = hudX + i * 52;
        ctx.fillStyle = unlockedWeapons[i] ? (player.currentWeapon === i ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.4)') : 'rgba(0,0,0,0.15)';
        ctx.fillRect(wx, hudY, 48, 48);
        if (player.currentWeapon === i) {
            ctx.strokeStyle = WEAPONS[i].color; ctx.lineWidth = 2;
            ctx.strokeRect(wx, hudY, 48, 48);
        }
        ctx.fillStyle = unlockedWeapons[i] ? '#fff' : '#555';
        ctx.font = '20px serif'; ctx.textAlign = 'center';
        ctx.fillText(WEAPONS[i].emoji, wx + 24, hudY + 28);
        ctx.font = '10px monospace';
        ctx.fillText(i + 1, wx + 24, hudY + 44);
    }
    // Special items
    let siX = hudX + 4 * 52 + 10;
    if (hasMedusaHead) {
        ctx.fillStyle = medusaCooldown > 0 ? 'rgba(0,0,0,0.5)' : 'rgba(0,80,0,0.4)';
        ctx.fillRect(siX, hudY, 48, 48);
        ctx.fillStyle = medusaCooldown > 0 ? '#666' : '#44ff44';
        ctx.font = '20px serif'; ctx.textAlign = 'center';
        ctx.fillText('🐍', siX + 24, hudY + 28);
        ctx.font = '10px monospace'; ctx.fillText('E', siX + 24, hudY + 44);
        if (medusaCooldown > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            let cdH = (medusaCooldown / 600) * 48;
            ctx.fillRect(siX, hudY + 48 - cdH, 48, cdH);
        }
    }
    siX += 52;
    if (hasApolloBow) {
        ctx.fillStyle = bowCooldown > 0 ? 'rgba(0,0,0,0.5)' : 'rgba(80,40,0,0.4)';
        ctx.fillRect(siX, hudY, 48, 48);
        ctx.fillStyle = bowCooldown > 0 ? '#666' : '#ff8800';
        ctx.font = '20px serif'; ctx.textAlign = 'center';
        ctx.fillText('🏹', siX + 24, hudY + 28);
        ctx.font = '10px monospace'; ctx.fillText('R', siX + 24, hudY + 44);
        if (bowCooldown > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            let cdH = (bowCooldown / 180) * 48;
            ctx.fillRect(siX, hudY + 48 - cdH, 48, cdH);
        }
    }

    // HUD updates
    document.getElementById('health-fill').style.width = (player.health / player.maxHealth * 100) + '%';
    document.getElementById('mana-fill').style.width = player.mana + '%';
    document.getElementById('score-dist').innerText = Math.max(0, Math.floor(player.x / 100));
    document.getElementById('orb-count').innerText = playerOrbs;
}

function updateWeaponHUD() {
    // Called when weapons change — currently HUD is canvas-based so nothing DOM to update
}

function startGame() { init(); }
function resetGame() { init(); }
function closePickup() {
    document.getElementById('item-pickup').style.display = 'none';
    gameState = 'PLAYING'; loop();
}
function gameOver() {
    gameState = 'GAMEOVER';
    document.getElementById('final-dist').innerText = Math.floor(player.x / 100);
    document.getElementById('game-over-screen').style.display = 'flex';
}
