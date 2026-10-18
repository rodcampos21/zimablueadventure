// Laço principal, estados (título, jogo, pausa, morte, vitória), HUD, diálogos e salvamento.
'use strict';
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const I = Z.input;
  const SAVE_KEY = 'zima_save_v1';

  const AREAS = [[0, 'Rodoviária'], [40, 'Rua do Comércio'], [75, 'Praça dos Pombos'], [110, 'Rua dos Cabos Eleitorais'], [160, 'Córrego Manso'], [198, 'Largo da Matriz'], [240, 'Prefeitura Municipal']];

  const g = Z.game = {
    state: 'loading', t: 0, freeze: 0, slow: 0, debug: /debug/.test(location.search),
    level: null, player: null, enemies: [], projectiles: [], pickups: [], boss: null,
    stats: { time: 0, deaths: 0, perfects: 0, kills: 0, rolls: 0 },
    hud: { flashCarisma: 0, banner: null, msg: null },
    dialog: null, save: null, menu: null, camView: { x: 0, y: 0 }, area: -1, petals: [],
  };

  // ---------------- salvamento ----------------
  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.cp) return s; } catch (_) {}
    return null;
  }
  function freshSave() { return { cp: 'start', coxinha: false, wall: false, bridge: false, intro: false }; }
  g.writeSave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(g.save)); } catch (_) {} };
  g.saveFlag = (k, v) => { g.save[k] = v; g.writeSave(); };

  // ---------------- efeitos globais ----------------
  g.hitstop = t => { g.freeze = Math.max(g.freeze, t); };
  g.perfectDodge = p => {
    g.slow = 0.55; g.stats.perfects++;
    p.gainCarisma(0.5);
    Z.audio.play('perfect');
    Z.floatText(p.x, p.y - 72, 'ESQUIVA PERFEITA!', '#9fe0ff', { size: 8, life: 1.2 });
    Z.emit(p.x, p.y - 16, 20, { color: ['#9fe0ff', '#ffffff'], speed: 160, gravity: 0, drag: 3, life: 0.5, size: 2 });
    g.hud.perfectFlash = 0.35;
  };
  g.clearEnemyProjectiles = () => { for (const pr of g.projectiles) if (pr.enemy) { pr.dead = true; } };

  // ---------------- montagem do mundo ----------------
  function buildWorld(save) {
    g.save = save;
    g.level = Z.makeLevel(save);
    g.level.prerender();
    const sp = g.level.spawns[save.cp] || g.level.spawns.start;
    g.player = new Z.Player(sp.x, sp.y, save);
    spawnEnemies();
    g.projectiles = []; g.pickups = []; Z.particles.length = 0; Z.texts.length = 0;
    g.boss = null; g.bossStarted = false; Z.cam.lock = null;
    Z.cam.follow(g.player, g.level, 0, true);
    g.area = -1; g.inBench = null;
  }
  function spawnEnemies() {
    g.enemies = g.level.enemies.map(e => e.type === 'pombo' ? new Z.Pombo(e.x, e.y) : new Z.Cabo(e.x, e.y));
  }

  function startGame(cont) {
    const s = cont && loadSave() || freshSave();
    if (!cont) { g.stats = { time: 0, deaths: 0, perfects: 0, kills: 0, rolls: 0 }; }
    buildWorld(s);
    g.state = 'play'; g.fade = 1;
    Z.audio.music('town');
    if (!s.intro) {
      g.save.intro = true; g.writeSave();
      g.openDialog([
        { who: 'Dona Cida', text: 'Zima, meu filho! Que bom que você voltou pra Vila Azul.' },
        { who: 'Dona Cida', text: 'O Coronel Bigodão manda nessa prefeitura desde 1985. Ninguém tem coragem de concorrer com ele...' },
        { who: 'Zima', text: 'Pois eu tenho, Dona Cida. Começa aqui, na minha cidade. Depois: a Presidência!' },
        { who: 'Dona Cida', text: 'Então leva essa rede de bolhas do seu avô. E cuidado com os pombos da praça!' },
      ]);
    }
  }

  // ---------------- diálogo ----------------
  g.openDialog = (lines, onDone) => { g.dialog = { lines, i: 0, chars: 0, onDone }; I.clear(); };
  function updateDialog(dt) {
    const d = g.dialog, line = d.lines[d.i];
    const before = Math.floor(d.chars);
    d.chars = Math.min(line.text.length, d.chars + dt * 45);
    if (Math.floor(d.chars) > before && Math.floor(d.chars) % 3 === 0) Z.audio.play('text');
    if (I.take('attack') || I.take('confirm') || I.take('special') || I.take('roll')) {
      if (d.chars < line.text.length) d.chars = line.text.length;
      else if (++d.i >= d.lines.length) { const f = d.onDone; g.dialog = null; I.clear(); f && f(); }
      else d.chars = 0;
    }
  }
  function drawDialog() {
    const d = g.dialog, line = d.lines[d.i];
    const x = 40, y = Z.H - 96, w = Z.W - 80, h = 80;
    ctx.fillStyle = 'rgba(20,14,38,.92)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#e9c46a'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    const isZima = line.who === 'Zima';
    ctx.font = `8px ${Z.FONT}`;
    const nw = ctx.measureText(line.who).width;
    ctx.fillStyle = isZima ? '#2e5d8a' : line.who.startsWith('Coronel') ? '#8a2a2a' : '#6b4f8a';
    ctx.fillRect(x + 10, y - 10, nw + 16, 16);
    Z.text(ctx, line.who, x + 18, y - 6, 8, '#fff', 'left', null);
    const lines = Z.wrap(ctx, line.text.slice(0, Math.floor(d.chars)), w - 28, 8);
    lines.forEach((l, i) => Z.text(ctx, l, x + 14, y + 16 + i * 14, 8, '#f6f1e6', 'left', null));
    if (d.chars >= line.text.length && Math.floor(g.t * 3) % 2) Z.text(ctx, '▼', x + w - 18, y + h - 16, 8, '#e9c46a', 'left', null);
  }

  // ---------------- morte, chefe, vitória ----------------
  g.onPlayerDeath = () => {
    g.stats.deaths++; g.deadT = 2.2; Z.audio.play('death'); Z.audio.music(null);
  };
  function respawn() {
    const s = g.save;
    const keepCar = g.player.carisma;
    buildWorld(s);
    g.player.carisma = Math.max(1, keepCar);
    g.state = 'play'; g.fade = 1; Z.audio.music('town');
  }
  function startBoss() {
    g.bossStarted = true;
    const L = g.level;
    L.closeGate();
    Z.cam.lock = { x0: L.arena.x0, x1: L.arena.x1 };
    g.boss = new Z.Boss(L.bossSpawn.x, L.bossSpawn.y);
    g.enemies.push(g.boss);
    g.player.vx = 0;
    Z.audio.music(null);
    setTimeout(() => {
      g.openDialog([
        { who: 'Coronel Bigodão', text: 'Ora, ora... o tal do Zima. Quarenta anos que essa cidade vota em mim, rapaz!' },
        { who: 'Zima', text: 'O povo merece escolha, Coronel. Vim pra um debate.' },
        { who: 'Coronel Bigodão', text: 'Debate? Aqui o debate é no grito! SEGURANÇAS, SANTINHOS, MEGAFONE!' },
      ], () => { g.boss.start(); Z.audio.music('boss'); g.hud.bossShow = 0; });
    }, 500);
  }
  g.onBossDefeated = boss => {
    Z.emit(boss.x, boss.y - 50, 80, { color: ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#7b68ee', '#ffffff'], kind: 'conf', speed: 320, gravity: 200, life: 2.2 });
    Z.audio.play('victory');
    g.level.openGate();
    g.openDialog([
      { who: 'Coronel Bigodão', text: 'Impossível... quarenta anos... derrotado por... BOLHAS?!' },
      { who: 'Zima', text: 'Não foram as bolhas, Coronel. Foi o povo querendo mudança.' },
      { who: 'Dona Cida', text: 'ZIMA PREFEITO! E depois... quem sabe Brasília!' },
    ], () => {
      g.state = 'victory'; g.victoryT = 0; Z.audio.music('victory');
      try { localStorage.removeItem(SAVE_KEY); localStorage.setItem('zima_cleared', '1'); } catch (_) {}
    });
  };

  // ---------------- atualização ----------------
  function update(dt) {
    g.t += dt;
    I.update(dt);
    if (I.pressed('pause') && (g.state === 'play' || g.state === 'pause') && !g.dialog) togglePause();

    if (g.state === 'title') { updateTitle(dt); return; }
    if (g.state === 'pause') { updatePause(); return; }
    if (g.state === 'victory') { g.victoryT += dt; Z.updateParticles(dt); if (g.victoryT > 1.5 && (I.take('confirm') || I.take('attack'))) toTitle(); return; }
    if (g.state !== 'play') return;

    g.fade = Math.max(0, (g.fade || 0) - dt * 2);
    g.hud.flashCarisma = Math.max(0, g.hud.flashCarisma - dt);
    g.hud.perfectFlash = Math.max(0, (g.hud.perfectFlash || 0) - dt);
    if (g.hud.banner) { g.hud.banner.t += dt; if (g.hud.banner.t > 3) g.hud.banner = null; }
    if (g.hud.msg) { g.hud.msg.t += dt; if (g.hud.msg.t > 3.2) g.hud.msg = null; }

    if (g.dialog) { updateDialog(dt); Z.cam.follow(g.player, g.level, dt); return; }

    if (g.player.state === 'dead') {
      g.deadT -= dt; Z.updateParticles(dt); Z.updateTexts(dt);
      if (g.deadT <= 0) respawn();
      return;
    }

    if (g.freeze > 0) { g.freeze -= dt; return; }
    let wdt = dt;
    if (g.slow > 0) { g.slow -= dt; wdt = dt * 0.32; }
    g.stats.time += dt;

    const L = g.level, p = g.player;
    L.update(wdt);
    p.update(wdt, I);
    for (const e of g.enemies) if (!e.dead) {
      e.update(wdt);
      const touching = e.contactOn ? e.contactOn() : e.contact;
      if (touching && e !== g.boss && Z.overlap(Z.box(p), e.hurtbox())) p.hurt(1, e.x);
    }
    g.enemies = g.enemies.filter(e => !e.dead || e === g.boss && !g.boss.dead);
    for (const pr of g.projectiles) pr.update(wdt);
    g.projectiles = g.projectiles.filter(pr => !pr.dead);
    for (const pk of g.pickups) pk.update(wdt);
    g.pickups = g.pickups.filter(pk => !pk.dead);
    // golpe da rede também rebate santinhos
    if (p.state === 'attack' && p.atkT >= 0.07 && p.atkT <= 0.19) {
      const r = p.attackRect();
      for (const pr of g.projectiles) if (pr.enemy && pr.breakable && !pr.dead && Z.overlap(r, pr.box())) { pr.destroy(); p.gainCarisma(0.1); Z.audio.play('hit'); }
    }
    interactions(wdt);
    Z.updateParticles(wdt); Z.updateTexts(wdt);
    updatePetals(wdt);
    Z.cam.follow(p, L, dt);

    // nome da área
    const tx = p.x / Z.T;
    let a = 0; for (let i = 0; i < AREAS.length; i++) if (tx >= AREAS[i][0]) a = i;
    if (a !== g.area) { if (g.area !== -1 || g.stats.time < 1) g.hud.banner = { text: AREAS[a][1], t: 0 }; g.area = a; }

    if (!g.bossStarted && p.x > L.arena.trigger) startBoss();
  }

  function interactions(dt) {
    const p = g.player, L = g.level;
    // bancos (checkpoint)
    let onBench = null;
    for (const b of L.benches) if (Math.abs(p.x - b.x) < 22 && Math.abs(p.y - b.y) < 8) onBench = b;
    if (onBench && g.inBench !== onBench.id) {
      const isNew = g.save.cp !== onBench.id;
      p.hp = p.maxHp;
      g.save.cp = onBench.id; g.writeSave();
      Z.audio.play('checkpoint');
      Z.floatText(onBench.x, onBench.y - 40, isNew ? 'Progresso salvo' : 'Vida recuperada', '#bfe6ff', { life: 1.6 });
      Z.emit(onBench.x, onBench.y - 14, 16, { color: ['#bfe6ff', '#ffffff'], speed: 60, gravity: -60, life: 0.9, size: 2 });
      if (isNew && p.state !== 'roll') { p.state = 'kneel'; p.vx = 0; setTimeout(() => { if (p.state === 'kneel') p.state = 'idle'; }, 750); }
    }
    g.inBench = onBench ? onBench.id : null;
    // urna de carisma
    const u = L.urna;
    if (Math.abs(p.x - u.x) < 16 && Math.abs(p.y - u.y) < 8 && u.cd <= 0 && p.carisma < 3) {
      p.carisma = 3; u.cd = 1.5; g.hud.flashCarisma = 0.6; Z.audio.play('pickup');
      Z.floatText(u.x, u.y - 40, 'Carisma cheio!', '#9fe0ff');
    }
    // coxinha secreta
    const c = L.coxinha;
    if (c && Math.abs(p.x - c.x) < 14 && Math.abs(p.y - c.y) < 20) {
      L.coxinha = null; p.maxHp++; p.hp = p.maxHp; g.saveFlag('coxinha', true);
      Z.audio.play('heal');
      g.hud.msg = { title: 'COXINHA DA VÓ', text: '+1 de vida máxima. Segredo encontrado!', t: 0 };
      Z.emit(c.x, c.y - 10, 24, { color: ['#ffe68a', '#c87a2a', '#ffffff'], speed: 140, life: 0.8 });
    }
  }

  function updatePetals(dt) {
    if (g.petals.length < 40 && Math.random() < dt * 5) {
      g.petals.push({ x: g.camView.x + Z.rand(0, Z.W + 120), y: g.camView.y - 8, vx: Z.rand(-28, -10), vy: Z.rand(14, 26), t: 0, ph: Z.rand(0, 6), c: Math.random() < 0.7 ? '#f2c230' : '#f07ab0' });
    }
    for (const q of g.petals) { q.t += dt; q.x += (q.vx + Math.sin(q.t * 2 + q.ph) * 12) * dt; q.y += q.vy * dt; }
    g.petals = g.petals.filter(q => q.y < g.camView.y + Z.H + 10 && q.t < 20);
  }

  // ---------------- pausa ----------------
  function togglePause() {
    if (g.state === 'play') { g.state = 'pause'; g.menu = { items: ['Continuar', 'Voltar ao banco', 'Recomeçar tutorial', 'Menu inicial'], sel: 0 }; I.clear(); }
    else { g.state = 'play'; g.menu = null; I.clear(); }
  }
  function menuNav(m) {
    if (I.pressed('down')) { m.sel = (m.sel + 1) % m.items.length; Z.audio.play('select'); }
    if (I.pressed('up') || I.pressed('jump')) { m.sel = (m.sel + m.items.length - 1) % m.items.length; Z.audio.play('select'); }
    if (g.tapSel !== undefined) { const s = g.tapSel; g.tapSel = undefined; m.sel = s; return true; }
    return I.take('confirm') || I.take('attack');
  }
  function updatePause() {
    const m = g.menu;
    if (!menuNav(m)) return;
    const it = m.items[m.sel];
    Z.audio.play('select');
    if (it === 'Continuar') togglePause();
    else if (it === 'Voltar ao banco') { g.menu = null; respawn(); }
    else if (it === 'Recomeçar tutorial') { g.menu = null; try { localStorage.removeItem(SAVE_KEY); } catch (_) {} startGame(false); }
    else if (it === 'Menu inicial') { g.menu = null; toTitle(); }
  }

  // ---------------- título ----------------
  function toTitle() {
    g.state = 'title';
    const has = !!loadSave();
    g.menu = { items: has ? ['Continuar', 'Novo jogo'] : ['Começar'], sel: 0 };
    g.titleCam = { x: 0, y: 0 };
    Z.audio.music('town');
    I.clear();
  }
  function updateTitle(dt) {
    g.titleCam.x += dt * 30;
    Z.updateParticles(dt);
    const m = g.menu;
    if (!menuNav(m)) return;
    Z.audio.play('select');
    const it = m.items[m.sel];
    startGame(it === 'Continuar');
  }

  // ---------------- desenho ----------------
  function drawBackground(cam) {
    Z.art.drawSky(ctx, g.t);
    const Ly = g.layers;
    Z.art.drawLayer(ctx, Ly.clouds, { x: cam.x + g.t * 6, y: cam.y }, 0.05, 0.02, 20);
    Z.art.drawLayer(ctx, Ly.hills, cam, 0.12, 0.1, 85);
    ctx.fillStyle = '#6f9a6a'; ctx.fillRect(0, Math.round(285 - cam.y * 0.1), Z.W, Z.H);
    Z.art.drawLayer(ctx, Ly.town, cam, 0.3, 0.3, 150);
    ctx.fillStyle = '#7a8f5e'; ctx.fillRect(0, Math.round(320 - cam.y * 0.3), Z.W, Z.H);
  }

  function drawWorld() {
    const L = g.level, cam = g.camView, A = Z.art;
    drawBackground(cam);
    L.drawBack(ctx, cam);
    L.drawTiles(ctx, cam, g.t);
    // objetos
    for (const s of L.signs) A.sign(ctx, s.x - cam.x, s.y - cam.y, nearSign() === s);
    for (const b of L.benches) A.bench(ctx, b.x - cam.x, b.y - cam.y, g.save.cp === b.id, g.t);
    A.urna(ctx, L.urna.x - cam.x, L.urna.y - cam.y, g.t, L.urna.cd > 0);
    A.lever(ctx, L.lever.x - cam.x, L.lever.y - cam.y, L.lever.on);
    A.chest(ctx, L.chest.x - cam.x, L.chest.y - cam.y, g.t);
    if (L.coxinha) A.coxinha(ctx, L.coxinha.x - cam.x, L.coxinha.y - cam.y, g.t);
    A.cida(ctx, L.npc.x - cam.x, L.npc.y - cam.y, g.t);
    for (const pk of g.pickups) pk.draw(ctx, cam);
    for (const e of g.enemies) if (!e.dead || e === g.boss) e.draw(ctx, cam);
    g.player.draw(ctx, cam);
    for (const pr of g.projectiles) pr.draw(ctx, cam);
    Z.drawParticles(ctx, cam);
    for (const q of g.petals) { ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x - cam.x), Math.round(q.y - cam.y), 2, Math.sin(q.t * 5 + q.ph) > 0 ? 2 : 1); }
    Z.drawTexts(ctx, cam);
    if (g.debug) {
      for (const e of g.enemies) { const b = e.hurtbox(); ctx.strokeStyle = '#f00'; ctx.strokeRect(b.l - cam.x, b.t - cam.y, b.r - b.l, b.b - b.t); }
    }
    // vinheta
    const v = ctx.createRadialGradient(Z.W / 2, Z.H / 2, Z.H * 0.45, Z.W / 2, Z.H / 2, Z.W * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,10,40,.35)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, Z.W, Z.H);
    if (g.hud.perfectFlash > 0) { ctx.fillStyle = `rgba(140,210,255,${g.hud.perfectFlash * 0.5})`; ctx.fillRect(0, 0, Z.W, Z.H); }
    if (g.slow > 0) { ctx.strokeStyle = 'rgba(160,220,255,.5)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, Z.W - 6, Z.H - 6); }
  }

  function nearSign() {
    const p = g.player; let best = null, bd = 34;
    for (const s of g.level.signs) { const d = Math.abs(p.x - s.x); if (d < bd && Math.abs(p.y - s.y) < 20) { bd = d; best = s; } }
    return best;
  }
  function signText(t) {
    return t.replace('{MOVE}', I.label('move')).replace('{DOWN}', I.label('down')).replace('{ATK}', I.label('attack'))
      .replace('{ROLL}', I.label('roll')).replace('{SPC}', I.label('special'));
  }

  function drawHUD() {
    const p = g.player;
    // vida
    for (let i = 0; i < p.maxHp; i++) heart(12 + i * 15, 12, i < p.hp);
    // carisma
    for (let i = 0; i < 3; i++) {
      const fillK = Z.clamp(p.carisma - i, 0, 1), x = 18 + i * 18, y = 36, r = 7;
      ctx.fillStyle = 'rgba(20,14,40,.6)'; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, 7); ctx.fill();
      if (fillK > 0) {
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
        ctx.fillStyle = fillK >= 1 ? '#7fd6ff' : '#4a8fb8'; ctx.fillRect(x - r, y + r - fillK * r * 2, r * 2, fillK * r * 2);
        ctx.restore();
      }
      ctx.strokeStyle = g.hud.flashCarisma > 0 && Math.floor(g.t * 16) % 2 ? '#ffffff' : '#bfe6ff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 4, 2, 2);
    }
    // chefe
    const b = g.boss;
    if (b && g.bossStarted && !b.dead && b.state !== 'intro') {
      const w = 300, x = (Z.W - w) / 2, y = Z.H - 28;
      Z.text(ctx, b.name, Z.W / 2, y - 14, 8, '#ffd6a0', 'center');
      ctx.fillStyle = '#140f26'; ctx.fillRect(x - 2, y - 2, w + 4, 10);
      ctx.fillStyle = '#4a1a24'; ctx.fillRect(x, y, w, 6);
      ctx.fillStyle = b.phase2 ? '#ff5a3a' : '#e63946'; ctx.fillRect(x, y, Math.round(w * b.hp / b.maxHp), 6);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x, y, Math.round(w * b.hp / b.maxHp), 2);
    }
    // placa próxima
    const s = nearSign();
    if (s && !g.dialog) {
      const lines = Z.wrap(ctx, signText(s.text), 360, 8);
      const h = lines.length * 13 + 14, w = 384, x = (Z.W - w) / 2, y = 52;
      ctx.fillStyle = 'rgba(58,36,20,.94)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#d8b27a'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      lines.forEach((l, i) => Z.text(ctx, l, Z.W / 2, y + 8 + i * 13, 8, '#fff3d6', 'center', null));
    }
    // nome da área (estilo Hollow Knight)
    const bn = g.hud.banner;
    if (bn) {
      const a = Math.min(1, bn.t / 0.4, (3 - bn.t) / 0.6);
      ctx.globalAlpha = Z.clamp(a, 0, 1);
      Z.text(ctx, bn.text.toUpperCase(), Z.W / 2, 22, 10, '#fff6dc', 'center');
      ctx.fillStyle = '#fff6dc'; ctx.fillRect(Z.W / 2 - 90, 38, 180, 1);
      ctx.globalAlpha = 1;
    }
    const m = g.hud.msg;
    if (m) {
      const a = Z.clamp(Math.min(m.t / 0.3, (3.2 - m.t) / 0.5), 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(20,14,38,.88)'; ctx.fillRect(Z.W / 2 - 170, 120, 340, 54);
      Z.text(ctx, m.title, Z.W / 2, 132, 10, '#ffe68a', 'center', null);
      Z.text(ctx, m.text, Z.W / 2, 154, 8, '#fff', 'center', null);
      ctx.globalAlpha = 1;
    }
  }
  function heart(x, y, full) {
    const P = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
    const s = 2;
    for (let j = 0; j < P.length; j++) for (let i = 0; i < 7; i++) if (P[j][i] === 'X') {
      const edge = j === 0 || i === 0 || i === 6 || P[j][i - 1] !== 'X' || P[j][i + 1] !== 'X' || !P[j + 1] || P[j + 1][i] !== 'X';
      ctx.fillStyle = full ? (j === 1 && i === 1 ? '#ffd0d8' : edge ? '#b3243c' : '#ff4d6d') : (edge ? '#5a4a6a' : '#2a2140');
      ctx.fillRect(x + i * s - 7, y + j * s - 6, s, s);
    }
  }

  function drawMenu(m, y0, title) {
    if (title) Z.text(ctx, title, Z.W / 2, y0 - 30, 12, '#fff', 'center');
    g.menuRects = [];
    m.items.forEach((it, i) => {
      const y = y0 + i * 26, w = 220, x = Z.W / 2 - w / 2;
      const sel = i === m.sel;
      ctx.fillStyle = sel ? 'rgba(80,140,220,.85)' : 'rgba(20,14,38,.75)'; ctx.fillRect(x, y, w, 20);
      ctx.strokeStyle = sel ? '#bfe6ff' : '#5a4a7a'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 19);
      Z.text(ctx, it, Z.W / 2, y + 6, 8, '#fff', 'center', null);
      g.menuRects.push({ x, y, w, h: 20, i });
    });
  }

  function drawTitle() {
    const cam = { x: Math.round(g.titleCam.x), y: 120 };
    drawBackground(cam);
    ctx.fillStyle = 'rgba(20,14,38,.25)'; ctx.fillRect(0, 0, Z.W, Z.H);
    Z.drawParticles(ctx, { x: 0, y: 0 });
    // logo
    const bob = Math.sin(g.t * 2) * 2;
    Z.text(ctx, 'ZIMA', Z.W / 2, 34 + bob, 32, '#7fd6ff', 'center', '#140f26');
    Z.text(ctx, 'BLUE ADVENTURE', Z.W / 2, 74 + bob, 14, '#fff6dc', 'center', '#140f26');
    Z.text(ctx, '— Rumo à Presidência —', Z.W / 2, 98, 8, '#ffd6a0', 'center');
    // Zima
    Z.drawFrame(ctx, Z.animFrame('idle', g.t), 130, 290, 1, { scale: 2 });
    ctx.fillStyle = 'rgba(20,10,30,.3)'; ctx.fillRect(100, 289, 60, 3);
    if (Math.random() < 0.05) Z.emit(Z.rand(0, Z.W), Z.H + 5, 1, { color: '#d8f2ff', kind: 'bub', speed: 30, angle: -Math.PI / 2, spread: 0.3, gravity: -20, life: 4, size: 5 });
    drawMenu(g.menu, 170);
    const hint = I.mode === 'touch' ? 'Toque numa opção' : I.mode === 'pad' ? 'A para confirmar' : '↑ ↓ e Enter';
    Z.text(ctx, hint, Z.W / 2, 250, 8, '#d8d0e8', 'center');
    if (I.mode === 'keys') Z.text(ctx, '← → andar · ↓ agachar · J rede · K rolar · L bolhas', Z.W / 2, 330, 8, '#bfb6d6', 'center');
    if (localStorage.getItem('zima_cleared')) Z.text(ctx, '★ Tutorial concluído', Z.W - 10, Z.H - 14, 8, '#ffe68a', 'right');
  }

  function drawVictory() {
    drawWorld();
    ctx.fillStyle = `rgba(20,14,38,${Math.min(0.85, g.victoryT)})`; ctx.fillRect(0, 0, Z.W, Z.H);
    Z.drawParticles(ctx, g.camView);
    if (g.victoryT < 0.6) return;
    Z.text(ctx, 'FIM DO TUTORIAL', Z.W / 2, 50, 16, '#ffe68a', 'center');
    Z.text(ctx, 'Zima venceu o debate na Vila Azul!', Z.W / 2, 82, 8, '#fff', 'center');
    const st = g.stats, mm = Math.floor(st.time / 60), ss = Math.floor(st.time % 60);
    const rows = [
      ['Tempo', `${mm}:${String(ss).padStart(2, '0')}`],
      ['Derrotas', st.deaths],
      ['Esquivas perfeitas', st.perfects],
      ['Adversários vencidos', st.kills],
      ['Segredos', g.save.coxinha ? '1/1' : '0/1'],
    ];
    rows.forEach(([k, v], i) => {
      Z.text(ctx, k, 180, 120 + i * 20, 8, '#cfc6e6', 'left');
      Z.text(ctx, String(v), 460, 120 + i * 20, 8, '#fff', 'right');
    });
    Z.text(ctx, 'Próximo capítulo: a Campanha Estadual (e o Pulo do Gato!)', Z.W / 2, 240, 8, '#9fe0ff', 'center');
    if (g.victoryT > 1.5 && Math.floor(g.t * 2) % 2) Z.text(ctx, I.mode === 'touch' ? 'Toque para continuar' : 'Enter para continuar', Z.W / 2, 290, 8, '#fff', 'center');
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    if (g.state === 'loading') { ctx.fillStyle = '#140f26'; ctx.fillRect(0, 0, Z.W, Z.H); Z.text(ctx, 'Carregando...', Z.W / 2, Z.H / 2, 8, '#fff', 'center'); return; }
    if (g.state === 'title') { drawTitle(); return; }
    if (g.state === 'victory') { drawVictory(); return; }
    const v = Z.cam.view();
    g.camView = { x: Z.clamp(v.x, 0, g.level.pw - Z.W), y: Z.clamp(v.y, 0, g.level.ph - Z.H) };
    drawWorld();
    drawHUD();
    if (g.dialog) drawDialog();
    if (g.player.state === 'dead') {
      const k = Z.clamp(1 - g.deadT / 2.2, 0, 1);
      ctx.fillStyle = `rgba(40,8,20,${k * 0.85})`; ctx.fillRect(0, 0, Z.W, Z.H);
      if (k > 0.3) {
        Z.text(ctx, 'VOCÊ PERDEU ESSA...', Z.W / 2, 150, 12, '#ff8a9a', 'center');
        Z.text(ctx, 'mas a campanha continua!', Z.W / 2, 176, 8, '#fff', 'center');
      }
    }
    if (g.fade > 0) { ctx.fillStyle = `rgba(20,14,38,${g.fade})`; ctx.fillRect(0, 0, Z.W, Z.H); }
    if (g.state === 'pause') {
      ctx.fillStyle = 'rgba(20,14,38,.7)'; ctx.fillRect(0, 0, Z.W, Z.H);
      drawMenu(g.menu, 130, 'PAUSADO');
      const tips = [`${I.label('move')} andar · ${I.label('down')} agachar`, `${I.label('attack')} rede · ${I.label('roll')} rolar · ${I.label('special')} bolhas`];
      tips.forEach((t, i) => Z.text(ctx, t, Z.W / 2, 260 + i * 16, 8, '#cfc6e6', 'center'));
    }
  }

  // ---------------- toque/clique nos menus ----------------
  canvas.addEventListener('pointerdown', e => {
    if (!g.menuRects || !(g.state === 'title' || g.state === 'pause')) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * Z.W, y = (e.clientY - r.top) / r.height * Z.H;
    let hit = false;
    for (const m of g.menuRects) if (x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) { g.tapSel = m.i; hit = true; }
    // no título, tocar em qualquer lugar confirma a opção destacada
    if (!hit && g.state === 'title') g.tapSel = g.menu.sel;
    Z.audio.init();
  });

  // ---------------- tela e botões ----------------
  function resize() {
    const s = Math.min(innerWidth / Z.W, innerHeight / Z.H);
    canvas.style.width = Math.floor(Z.W * s) + 'px'; canvas.style.height = Math.floor(Z.H * s) + 'px';
  }
  addEventListener('resize', resize); resize();
  document.getElementById('btnPause').addEventListener('click', () => { if (g.state === 'play' || g.state === 'pause') togglePause(); });
  const bs = document.getElementById('btnSound');
  bs.addEventListener('click', () => { Z.audio.init(); Z.audio.toggle(); });
  if (Z.audio.muted) bs.classList.add('off');
  document.getElementById('btnFull').addEventListener('click', () => {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!document.fullscreenElement && req) {
      Promise.resolve(req.call(el)).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (_) {} }).catch(() => {});
    } else if (document.exitFullscreen) document.exitFullscreen();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && g.state === 'play' && !g.dialog) togglePause(); });
  addEventListener('keydown', e => { if (e.code === 'F2') g.debug = !g.debug; });

  // ---------------- laço ----------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
    try { update(dt); render(); } catch (err) { console.error(err); g.lastError = String(err && err.stack || err); }
    requestAnimationFrame(frame);
  }

  async function boot() {
    requestAnimationFrame(frame);
    try { await Promise.race([document.fonts.load(`8px ${Z.FONT}`), new Promise(r => setTimeout(r, 2500))]); } catch (_) {}
    await Z.loadAtlas();
    g.layers = Z.art.buildLayers();
    I.onFirstGesture = () => Z.audio.init();
    toTitle();
  }
  // a primeira interação também liga o áudio (exigência dos navegadores)
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => Z.audio.init(), { once: true, passive: true }));
  boot();
})();
