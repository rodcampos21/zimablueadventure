// Laço principal, estados (título, jogo, pausa, opções, morte, vitória), HUD, diálogos e salvamento.
// Renderização em HD: o canvas tem o tamanho real da tela (com devicePixelRatio) e o mundo é escalado por Z.S.
'use strict';
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const I = Z.input;
  const SAVE_KEY = 'zima_save_v1', SET_KEY = 'zima_settings_v1';

  const AREAS = [[0, 'Rodoviária'], [40, 'Rua do Comércio'], [75, 'Praça do Coreto'], [110, 'Avenida Central'], [160, 'Córrego Manso'], [198, 'Largo da Matriz'], [240, 'Prefeitura Municipal']];
  const QUALITY = [['Alta', 4], ['Média', 2.5], ['Leve', 1.5]];     // limite de pixels reais por unidade do mundo

  const g = Z.game = {
    state: 'loading', t: 0, freeze: 0, slow: 0, debug: /debug/.test(location.search),
    level: null, player: null, enemies: [], projectiles: [], pickups: [], boss: null,
    stats: { time: 0, deaths: 0, perfects: 0, kills: 0, rolls: 0 },
    hud: { flashCarisma: 0, banner: null, msg: null },
    dialog: null, save: null, menu: null, camView: { x: 0, y: 0 }, area: -1, petals: [],
    settings: { bright: 1.0, contrast: 1.05, quality: 0 },
  };

  // ---------------- ajustes de imagem ----------------
  // celulares começam em qualidade Média (mais leve para a bateria); dá para trocar em Imagem
  if (matchMedia('(pointer: coarse)').matches) g.settings.quality = 1;
  try { Object.assign(g.settings, JSON.parse(localStorage.getItem(SET_KEY)) || {}); } catch (_) {}
  function applySettings() {
    const s = g.settings;
    canvas.style.filter = `brightness(${s.bright}) contrast(${s.contrast}) saturate(1.06)`;
    try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch (_) {}
    resize();
  }

  // ---------------- salvamento ----------------
  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.cp) return s; } catch (_) {}
    return null;
  }
  function freshSave() { return { cp: 'start', coxinha: false, wall: false, bridge: false, chest: false, mission: false }; }
  g.writeSave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(g.save)); } catch (_) {} };
  g.saveFlag = (k, v) => { g.save[k] = v; g.writeSave(); };

  // ---------------- efeitos globais ----------------
  g.hitstop = t => { g.freeze = Math.max(g.freeze, t); };
  g.perfectDodge = p => {
    g.slow = 0.55; g.stats.perfects++;
    p.gainCarisma(0.5);
    Z.audio.play('perfect');
    Z.floatText(p.x, p.y - 74, 'ESQUIVA PERFEITA!', '#9fe0ff', { size: 13, life: 1.2 });
    Z.emit(p.x, p.y - 16, 24, { color: ['#9fe0ff', '#ffffff'], speed: 160, gravity: 0, drag: 3, life: 0.5, size: 1.6, glow: true });
    g.hud.perfectFlash = 0.35;
  };
  g.clearEnemyProjectiles = () => { for (const pr of g.projectiles) if (pr.enemy) pr.dead = true; };
  g.openChest = ch => {
    const p = g.player;
    p.maxCar++; p.carisma = p.maxCar; g.saveFlag('chest', true);
    Z.audio.play('chest'); g.hitstop(0.08);
    g.hud.msg = { title: 'MEDALHA DO AVÔ', text: '+1 de Carisma máximo: mais bolhas para a campanha!', t: 0 };
    Z.emit(ch.x, ch.y - 14, 30, { color: ['#ffe68a', '#ffffff', '#9fe0ff'], speed: 180, life: 0.9, size: 1.8, glow: true });
  };

  // ---------------- montagem do mundo ----------------
  function buildWorld(save) {
    g.save = save;
    g.level = Z.makeLevel(save);
    g.level.setResolution(chunkRes());
    const sp = g.level.spawns[save.cp] || g.level.spawns.start;
    g.player = new Z.Player(sp.x, sp.y, save);
    g.enemies = g.level.enemies.map(e => new Z.Atendente(e.x, e.y));
    g.projectiles = []; g.pickups = []; Z.particles.length = 0; Z.texts.length = 0;
    g.boss = null; g.bossStarted = false; Z.cam.lock = null;
    Z.cam.follow(g.player, g.level, 0, true);
    g.area = -1; g.inBench = null;
  }

  function startGame(cont) {
    const s = cont && loadSave() || freshSave();
    if (!cont) g.stats = { time: 0, deaths: 0, perfects: 0, kills: 0, rolls: 0 };
    buildWorld(s);
    g.state = 'play'; g.fade = 1;
    Z.audio.music('town');
    if (!s.mission) {
      g.save.mission = true; g.writeSave();
      g.openDialog([
        { who: 'Thyberius', text: 'Ah, Zima! As estrelas me avisaram que você desceria deste ônibus hoje.' },
        { who: 'Thyberius', text: 'Sou Thyberius, o Mago. Há décadas o Coronel Bigodão enfeitiça esta cidade com santinhos e promessas vazias.' },
        { who: 'Zima', text: 'Vim mudar isso. Meu sonho é a Presidência... mas por onde eu começo?' },
        { who: 'Thyberius', text: 'Pelo começo, meu jovem. Sua missão: RECRUTAR ALIADOS e chegar à Prefeitura de Capitão Leônidas Marques.' },
        { who: 'Thyberius', text: 'Encantei sua rede: agora ela sopra bolhas de carisma. Vá! E cuidado com os atendentes do Coronel: eles arremessam hambúrgueres.' },
      ], () => { g.hud.msg = { title: 'NOVA MISSÃO', text: 'Recrutar aliados e chegar à Prefeitura de Capitão Leônidas Marques.', t: 0 }; Z.audio.play('chest'); });
    }
  }

  // ---------------- diálogo ----------------
  g.openDialog = (lines, onDone) => { g.dialog = { lines, i: 0, chars: 0, onDone }; I.clear(); };
  function updateDialog(dt) {
    const d = g.dialog, line = d.lines[d.i];
    const before = Math.floor(d.chars);
    d.chars = Math.min(line.text.length, d.chars + dt * 48);
    if (Math.floor(d.chars) > before && Math.floor(d.chars) % 3 === 0) Z.audio.play('text');
    if (I.take('attack') || I.take('confirm') || I.take('special') || I.take('roll') || I.take('jump')) {
      if (d.chars < line.text.length) d.chars = line.text.length;
      else if (++d.i >= d.lines.length) { const f = d.onDone; g.dialog = null; I.clear(); f && f(); }
      else d.chars = 0;
    }
  }
  const SPEAKER = { 'Zima': '#3a74b0', 'Thyberius': '#3b3f9a', 'Coronel Bigodão': '#a8323a' };
  const MISSION = 'Recrutar aliados e chegar à Prefeitura de Capitão Leônidas Marques';
  function drawPortrait(who, x, y, s) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, 7); ctx.clip();
    ctx.fillStyle = Z.art.lin(ctx, 0, y, 0, y + s, [[0, '#ffe2b0'], [1, '#e7a07a']]); ctx.fillRect(x, y, s, s);
    if (who === 'Zima') Z.drawPortrait(ctx, x + s * 0.04, y + s * 0.06, s * 0.98);
    else if (who === 'Thyberius') Z.drawPortrait(ctx, x + s * 0.06, y + s * 0.1, s * 0.92, 'thy0', 0.22, 0.56, true);
    else Z.art.boss(ctx, x + s / 2 - 2, y + s * 2.32, 1, g.t, 'idle', false, false, s / 44);
    ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = SPEAKER[who] || '#e9c46a'; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2, 0, 7); ctx.stroke();
    ctx.lineWidth = 0.8; ctx.strokeStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s / 2 + 1.6, 0, 7); ctx.stroke();
  }
  function panel(x, y, w, h, tone = 'night') {
    ctx.save();
    ctx.shadowColor = 'rgba(10,5,20,.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    Z.art.rr(ctx, x, y, w, h, 7);
    ctx.fillStyle = tone === 'wood' ? Z.art.lin(ctx, 0, y, 0, y + h, [[0, 'rgba(92,58,32,.96)'], [1, 'rgba(58,34,18,.96)']])
      : Z.art.lin(ctx, 0, y, 0, y + h, [[0, 'rgba(36,26,66,.95)'], [1, 'rgba(18,12,36,.95)']]);
    ctx.fill(); ctx.restore();
    Z.art.rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6.5); ctx.lineWidth = 1; ctx.strokeStyle = tone === 'wood' ? '#d8b27a' : 'rgba(233,196,106,.85)'; ctx.stroke();
    Z.art.rr(ctx, x + 3, y + 3, w - 6, h - 6, 4.5); ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.stroke();
  }
  function drawDialog() {
    const d = g.dialog, line = d.lines[d.i];
    const x = 34, y = Z.H - 104, w = Z.W - 68, h = 88;
    panel(x, y, w, h);
    drawPortrait(line.who, x + 10, y + 12, 62);
    ctx.font = `800 12px ${Z.FONT2}`;
    const nw = ctx.measureText(line.who).width + 18;
    Z.art.rr(ctx, x + 84, y - 9, nw, 18, 9); ctx.fillStyle = SPEAKER[line.who] || '#6b4f8a'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#fff6dc'; ctx.stroke();
    Z.text(ctx, line.who, x + 93, y - 6.5, 12, '#fff', 'left', null, Z.FONT2, 800);
    const lines = Z.wrap(ctx, line.text.slice(0, Math.floor(d.chars)), w - 104, 13.5, Z.FONT2, 600);
    lines.forEach((l, i) => Z.text(ctx, l, x + 86, y + 16 + i * 17, 13.5, '#f6f1e6', 'left', null, Z.FONT2, 600));
    if (d.chars >= line.text.length) Z.text(ctx, '▼', x + w - 16, y + h - 18 + Math.sin(g.t * 6) * 1.5, 10, '#e9c46a', 'left', null, Z.FONT2, 800);
  }

  // ---------------- morte, chefe, vitória ----------------
  g.onPlayerDeath = () => { g.stats.deaths++; g.deadT = 2.2; Z.audio.play('death'); Z.audio.music(null); };
  function respawn() {
    const keepCar = g.player.carisma;
    buildWorld(g.save);
    g.player.carisma = Math.max(1, Math.min(g.player.maxCar, keepCar));
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
        { who: 'Coronel Bigodão', text: 'Ora, ora... o tal do Zima. Quarenta anos que Capitão Leônidas Marques vota em mim, rapaz!' },
        { who: 'Zima', text: 'O povo merece escolha, Coronel. Vim pra um debate.' },
        { who: 'Coronel Bigodão', text: 'Debate? Aqui o debate é no grito! SEGURANÇAS, SANTINHOS, MEGAFONE!' },
      ], () => { g.boss.start(); Z.audio.music('boss'); });
    }, 500);
  }
  g.onBossDefeated = boss => {
    Z.emit(boss.x, boss.y - 50, 90, { color: ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#7b68ee', '#ffffff'], kind: 'conf', speed: 320, gravity: 200, life: 2.2 });
    Z.audio.play('victory');
    g.level.openGate();
    g.openDialog([
      { who: 'Coronel Bigodão', text: 'Impossível... quarenta anos... derrotado por... BOLHAS?!' },
      { who: 'Zima', text: 'Não foram as bolhas, Coronel. Foi o povo querendo mudança.' },
      { who: 'Thyberius', text: 'A primeira prefeitura é sua, Zima! Agora siga recrutando aliados... o caminho até Brasília é longo.' },
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
    else if (I.pressed('pause') && g.state === 'options') closeOptions();

    if (g.state === 'title') { updateTitle(dt); return; }
    if (g.state === 'pause' || g.state === 'options') { updateMenu(); return; }
    if (g.state === 'victory') { g.victoryT += dt; Z.updateParticles(dt); if (g.victoryT > 1.5 && (I.take('confirm') || I.take('attack') || I.take('jump'))) toTitle(); return; }
    if (g.state !== 'play') return;

    g.fade = Math.max(0, (g.fade || 0) - dt * 2);
    g.hud.flashCarisma = Math.max(0, g.hud.flashCarisma - dt);
    g.hud.perfectFlash = Math.max(0, (g.hud.perfectFlash || 0) - dt);
    if (g.hud.banner) { g.hud.banner.t += dt; if (g.hud.banner.t > 3) g.hud.banner = null; }
    if (g.hud.msg) { g.hud.msg.t += dt; if (g.hud.msg.t > 3.4) g.hud.msg = null; }
    g.level.prefetch(g.camView.x);

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
    interactions();
    Z.updateParticles(wdt); Z.updateTexts(wdt);
    updatePetals(wdt);
    Z.cam.follow(p, L, dt);

    const tx = p.x / Z.T;
    let a = 0; for (let i = 0; i < AREAS.length; i++) if (tx >= AREAS[i][0]) a = i;
    if (a !== g.area) { if (g.area !== -1 || g.stats.time < 1) g.hud.banner = { text: AREAS[a][1], t: 0 }; g.area = a; }

    if (!g.bossStarted && p.x > L.arena.trigger) startBoss();
  }

  function interactions() {
    const p = g.player, L = g.level;
    let onBench = null;
    for (const b of L.benches) if (Math.abs(p.x - b.x) < 22 && Math.abs(p.y - b.y) < 8) onBench = b;
    if (onBench && g.inBench !== onBench.id) {
      const isNew = g.save.cp !== onBench.id;
      p.hp = p.maxHp;
      g.save.cp = onBench.id; g.writeSave();
      Z.audio.play('checkpoint');
      Z.floatText(onBench.x, onBench.y - 42, isNew ? 'Progresso salvo' : 'Vida recuperada', '#bfe6ff', { life: 1.6 });
      Z.emit(onBench.x, onBench.y - 14, 18, { color: ['#bfe6ff', '#ffffff'], speed: 60, gravity: -60, life: 0.9, size: 1.6, glow: true });
      if (isNew && p.state !== 'roll') { p.state = 'kneel'; p.vx = 0; setTimeout(() => { if (p.state === 'kneel') p.state = 'idle'; }, 750); }
    }
    g.inBench = onBench ? onBench.id : null;
    const u = L.urna;
    if (Math.abs(p.x - u.x) < 16 && Math.abs(p.y - u.y) < 8 && u.cd <= 0 && p.carisma < p.maxCar) {
      p.carisma = p.maxCar; u.cd = 1.5; g.hud.flashCarisma = 0.6; Z.audio.play('pickup');
      Z.floatText(u.x, u.y - 42, 'Carisma cheio!', '#9fe0ff');
    }
    const c = L.coxinha;
    if (c && Math.abs(p.x - c.x) < 14 && Math.abs(p.y - c.y) < 20) {
      L.coxinha = null; p.maxHp++; p.hp = p.maxHp; g.saveFlag('coxinha', true);
      Z.audio.play('heal');
      g.hud.msg = { title: 'COXINHA DA VÓ', text: '+1 de vida máxima. Segredo encontrado!', t: 0 };
      Z.emit(c.x, c.y - 10, 26, { color: ['#ffe68a', '#c87a2a', '#ffffff'], speed: 140, life: 0.8, size: 1.8, glow: true });
    }
  }

  function updatePetals(dt) {
    if (g.petals.length < 46 && Math.random() < dt * 6) {
      g.petals.push({ x: g.camView.x + Z.rand(0, Z.W + 140), y: g.camView.y - 8, vx: Z.rand(-30, -10), vy: Z.rand(14, 26), t: 0, ph: Z.rand(0, 6), c: Math.random() < 0.7 ? '#f6c428' : '#f07ab0' });
    }
    for (const q of g.petals) { q.t += dt; q.x += (q.vx + Math.sin(q.t * 2 + q.ph) * 12) * dt; q.y += q.vy * dt; }
    g.petals = g.petals.filter(q => q.y < g.camView.y + Z.H + 10 && q.t < 20);
  }

  // ---------------- menus (pausa, opções, título) ----------------
  const pct = v => Math.round(v * 100) + '%';
  function optionItems() {
    const s = g.settings;
    return [
      { label: () => `Brilho: ${pct(s.bright)}`, adj: d => { s.bright = Z.clamp(+(s.bright + d * 0.05).toFixed(2), 0.7, 1.4); applySettings(); } },
      { label: () => `Contraste: ${pct(s.contrast)}`, adj: d => { s.contrast = Z.clamp(+(s.contrast + d * 0.05).toFixed(2), 0.8, 1.4); applySettings(); } },
      { label: () => `Qualidade: ${QUALITY[s.quality][0]}`, adj: d => { s.quality = (s.quality + (d > 0 ? 1 : QUALITY.length - 1)) % QUALITY.length; applySettings(); } },
      { label: () => 'Restaurar padrão', act: () => { Object.assign(s, { bright: 1, contrast: 1.05, quality: 0 }); applySettings(); } },
      { label: () => 'Voltar', act: () => closeOptions() },
    ];
  }
  function openOptions() { g.prevState = g.state; g.prevMenu = g.menu; g.state = 'options'; g.menu = { items: optionItems(), sel: 0, title: 'IMAGEM' }; I.clear(); }
  function closeOptions() { g.state = g.prevState || 'title'; g.menu = g.prevMenu; I.clear(); }
  function togglePause() {
    if (g.state === 'play') {
      g.state = 'pause';
      g.menu = { title: 'PAUSADO', sel: 0, items: [
        { label: () => 'Continuar', act: () => togglePause() },
        { label: () => 'Imagem (brilho, contraste)', act: () => openOptions() },
        { label: () => 'Voltar ao banco', act: () => { g.menu = null; respawn(); } },
        { label: () => 'Recomeçar tutorial', act: () => { g.menu = null; try { localStorage.removeItem(SAVE_KEY); } catch (_) {} startGame(false); } },
        { label: () => 'Menu inicial', act: () => { g.menu = null; toTitle(); } },
      ] };
      I.clear();
    } else { g.state = 'play'; g.menu = null; I.clear(); }
  }
  function updateMenu() {
    const m = g.menu; if (!m) return;
    if (I.pressed('down')) { m.sel = (m.sel + 1) % m.items.length; Z.audio.play('select'); }
    if (I.pressed('up')) { m.sel = (m.sel + m.items.length - 1) % m.items.length; Z.audio.play('select'); }
    const it = m.items[m.sel];
    if (it.adj && (I.pressed('left') || I.pressed('right'))) { it.adj(I.pressed('right') ? 1 : -1); Z.audio.play('select'); }
    let go = I.take('confirm') || I.take('attack') || I.take('jump');
    if (g.tapSel !== undefined) { m.sel = g.tapSel; g.tapSel = undefined; go = true; }
    if (!go) return;
    const cur = m.items[m.sel];
    Z.audio.play('select');
    if (cur.act) cur.act(); else if (cur.adj) cur.adj(1);
  }
  function toTitle() {
    g.state = 'title';
    const has = !!loadSave();
    g.menu = { sel: 0, items: [
      ...(has ? [{ label: () => 'Continuar', act: () => startGame(true) }] : []),
      { label: () => has ? 'Novo jogo' : 'Começar', act: () => startGame(false) },
      { label: () => 'Imagem', act: () => openOptions() },
    ] };
    g.titleCam = { x: 0, y: 0 };
    Z.audio.music('town');
    I.clear();
  }
  function updateTitle(dt) {
    g.titleCam.x += dt * 30;
    Z.updateParticles(dt);
    updateMenu();
  }

  // ---------------- desenho ----------------
  function drawBackground(cam) {
    Z.art.drawSky(ctx, g.t, cam);
    const Ly = g.layers, R = Ly.R;
    Z.art.drawLayer(ctx, Ly.clouds, R, { x: cam.x + g.t * 6, y: cam.y }, 0.05, 0.02, 14);
    Z.art.drawLayer(ctx, Ly.mountains, R, cam, 0.06, 0.06, 70);
    Z.art.drawLayer(ctx, Ly.hills, R, cam, 0.13, 0.1, 96);
    ctx.fillStyle = '#55834a'; ctx.fillRect(0, Z.snap(296 - cam.y * 0.1) - 0.5, Z.W, Z.H);
    Z.art.drawLayer(ctx, Ly.town, R, cam, 0.3, 0.3, 150);
    ctx.fillStyle = '#c9a48a'; ctx.fillRect(0, Z.snap(320 - cam.y * 0.3) - 0.5, Z.W, Z.H);
    // neblina quente entre o fundo e a fase
    ctx.fillStyle = Z.art.lin(ctx, 0, 120, 0, Z.H, [[0, 'rgba(255,214,170,0)'], [1, 'rgba(255,200,160,.22)']]); ctx.fillRect(0, 120, Z.W, Z.H);
  }

  function drawWorld() {
    const L = g.level, cam = g.camView, A = Z.art;
    drawBackground(cam);
    L.drawStatic(ctx, cam);
    L.drawDynamic(ctx, cam, g.t);
    for (const s of L.signs) if (Math.abs(s.x - cam.x - Z.W / 2) < Z.W) A.sign(ctx, s.x - cam.x, s.y - cam.y, nearSign() === s);
    for (const b of L.benches) A.bench(ctx, b.x - cam.x, b.y - cam.y, g.save.cp === b.id, g.t);
    A.urna(ctx, L.urna.x - cam.x, L.urna.y - cam.y, g.t, L.urna.cd > 0);
    A.lever(ctx, L.lever.x - cam.x, L.lever.y - cam.y, L.lever.on);
    A.chest(ctx, L.chest.x - cam.x, L.chest.y - cam.y, g.t, L.chest.open);
    if (L.coxinha) A.coxinha(ctx, L.coxinha.x - cam.x, L.coxinha.y - cam.y, g.t);
    drawWizard(L.npc, cam);
    for (const pk of g.pickups) pk.draw(ctx, cam);
    for (const e of g.enemies) if (!e.dead || e === g.boss) {
      // sombra dos inimigos que andam no chão
      if (e.h > 20 && !e.dying) { ctx.fillStyle = 'rgba(25,12,30,.28)'; ctx.beginPath(); ctx.ellipse(e.x - cam.x, e.y - cam.y - 0.5, e.w * 0.8, 2.4, 0, 0, 7); ctx.fill(); }
      e.draw(ctx, cam);
    }
    g.player.draw(ctx, cam);
    for (const pr of g.projectiles) pr.draw(ctx, cam);
    Z.drawParticles(ctx, cam);
    L.drawLights(ctx, cam, g.t);
    for (const q of g.petals) {
      ctx.save(); ctx.translate(q.x - cam.x, q.y - cam.y); ctx.rotate(q.t * 3 + q.ph);
      ctx.fillStyle = q.c; ctx.beginPath(); ctx.ellipse(0, 0, 1.6, 0.8 + Math.abs(Math.sin(q.t * 4 + q.ph)) * 0.6, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    Z.drawTexts(ctx, cam);
    if (g.debug) for (const e of g.enemies) { const b = e.hurtbox(); ctx.lineWidth = 1 / Z.S; ctx.strokeStyle = '#f00'; ctx.strokeRect(b.l - cam.x, b.t - cam.y, b.r - b.l, b.b - b.t); }
    grade();
    if (g.hud.perfectFlash > 0) { ctx.fillStyle = `rgba(140,210,255,${g.hud.perfectFlash * 0.45})`; ctx.fillRect(0, 0, Z.W, Z.H); }
    if (g.slow > 0) { ctx.strokeStyle = 'rgba(160,220,255,.5)'; ctx.lineWidth = 5; ctx.strokeRect(2.5, 2.5, Z.W - 5, Z.H - 5); }
  }
  // Thyberius, o Mago: vira para o Zima, com brilho mágico no livro
  function drawWizard(n, cam) {
    const x = n.x - cam.x, y = n.y - cam.y, p = g.player;
    const facing = p.x < n.x ? -1 : 1;
    ctx.fillStyle = 'rgba(25,12,30,.3)'; ctx.beginPath(); ctx.ellipse(x, y - 0.5, 15, 2.6, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const k = 0.75 + Math.sin(g.t * 2.4) * 0.25;
    ctx.fillStyle = Z.art.rad(ctx, x + facing * 12, y - 38, 1, 26 * k, [[0, 'rgba(160,190,255,.55)'], [0.4, 'rgba(120,140,255,.18)'], [1, 'rgba(120,140,255,0)']]);
    ctx.fillRect(x + facing * 12 - 30, y - 68, 60, 60);
    ctx.restore();
    Z.drawFrame(ctx, Z.animFrame('thyIdle', g.t), x, y, facing);
    if (Math.random() < 0.08) Z.emit(n.x + facing * Z.rand(6, 20), n.y - Z.rand(34, 44), 1, { color: ['#bfd4ff', '#ffe68a', '#ffffff'], speed: 18, gravity: -30, life: 1.2, size: 1.3, glow: true });
    // balão quando o Zima chega perto (depois da conversa)
    if (!g.dialog && g.save.mission && Math.abs(p.x - n.x) < 70 && Math.abs(p.y - n.y) < 30) {
      const txt = 'Recrute aliados, Zima! A Prefeitura fica a leste.';
      ctx.font = `700 11px ${Z.FONT2}`;
      const w = ctx.measureText(txt).width + 16, bx = x - w / 2, by = y - 92;
      Z.art.rr(ctx, bx, by, w, 18, 8); ctx.fillStyle = 'rgba(255,250,238,.96)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#3b3f9a'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,250,238,.96)'; ctx.beginPath(); ctx.moveTo(x - 4, by + 17.5); ctx.lineTo(x + 4, by + 17.5); ctx.lineTo(x, by + 23); ctx.fill();
      Z.text(ctx, txt, x, by + 3, 11, '#2a2350', 'center', null, Z.FONT2, 700);
    }
  }

  // gradação de cor: luz dourada no alto, sombra fria embaixo e vinheta
  function grade() {
    ctx.fillStyle = Z.art.lin(ctx, 0, 0, 0, Z.H, [[0, 'rgba(255,190,120,.10)'], [0.45, 'rgba(255,190,120,0)'], [0.8, 'rgba(40,20,80,0)'], [1, 'rgba(40,20,80,.16)']]);
    ctx.fillRect(0, 0, Z.W, Z.H);
    ctx.fillStyle = Z.art.rad(ctx, Z.W / 2, Z.H * 0.52, Z.H * 0.42, Z.W * 0.66, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(18,8,34,.38)']]);
    ctx.fillRect(0, 0, Z.W, Z.H);
  }

  function nearSign() {
    const p = g.player; let best = null, bd = 34;
    for (const s of g.level.signs) { const d = Math.abs(p.x - s.x); if (d < bd && Math.abs(p.y - s.y) < 20) { bd = d; best = s; } }
    return best;
  }
  function signText(t) {
    return t.replace(/\{MOVE\}/g, I.label('move')).replace(/\{DOWN\}/g, I.label('down')).replace(/\{ATK\}/g, I.label('attack'))
      .replace(/\{ROLL\}/g, I.label('roll')).replace(/\{SPC\}/g, I.label('special')).replace(/\{JUMP\}/g, I.label('jump'));
  }

  function heart(x, y, k, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const path = () => { ctx.beginPath(); ctx.moveTo(0, 4); ctx.bezierCurveTo(-7, -1, -6.5, -7.5, -2.8, -7.5); ctx.bezierCurveTo(-1.2, -7.5, -0.2, -6.4, 0, -5.2); ctx.bezierCurveTo(0.2, -6.4, 1.2, -7.5, 2.8, -7.5); ctx.bezierCurveTo(6.5, -7.5, 7, -1, 0, 4); ctx.closePath(); };
    path(); ctx.fillStyle = 'rgba(30,14,40,.7)'; ctx.fill();
    if (k > 0) {
      ctx.save(); path(); ctx.clip();
      ctx.fillStyle = Z.art.lin(ctx, 0, -8, 0, 4, [[0, '#ff7a8e'], [1, '#c41f42']]); ctx.fillRect(-8, 4 - 12 * k, 16, 12 * k);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-3, -4.6, 1.8, 1.1, -0.5, 0, 7); ctx.fill();
      ctx.restore();
    }
    path(); ctx.lineWidth = 1; ctx.strokeStyle = '#1d1426'; ctx.stroke();
    ctx.restore();
  }
  function bubbleIcon(x, y, k, flash) {
    const r = 6.5;
    ctx.fillStyle = 'rgba(20,14,40,.55)'; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, 7); ctx.fill();
    if (k > 0) {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
      ctx.fillStyle = Z.art.lin(ctx, 0, y - r, 0, y + r, [[0, k >= 1 ? '#bff0ff' : '#7ab8d8'], [1, k >= 1 ? '#3fa6e0' : '#2a6a98']]);
      ctx.fillRect(x - r, y + r - k * r * 2, r * 2, k * r * 2); ctx.restore();
    }
    ctx.lineWidth = 1; ctx.strokeStyle = flash ? '#ffffff' : '#d8f2ff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - 2.4, y - 2.8, 1.6, 1, -0.6, 0, 7); ctx.fill();
  }

  function drawHUD() {
    const p = g.player;
    // retrato + vida + carisma
    ctx.save(); ctx.shadowColor = 'rgba(10,5,20,.5)'; ctx.shadowBlur = 6;
    Z.art.rr(ctx, 8, 8, 34 + Math.max(p.maxHp * 15, p.maxCar * 17) + 10, 44, 10); ctx.fillStyle = 'rgba(20,14,40,.45)'; ctx.fill(); ctx.restore();
    drawPortrait('Zima', 12, 12, 36);
    for (let i = 0; i < p.maxHp; i++) heart(58 + i * 15, 22, Z.clamp(p.hp - i, 0, 1));
    for (let i = 0; i < p.maxCar; i++) bubbleIcon(58 + i * 17, 40, Z.clamp(p.carisma - i, 0, 1), g.hud.flashCarisma > 0 && Math.floor(g.t * 16) % 2);
    // missão principal
    if (g.save.mission && !g.dialog && !g.bossStarted) {
      Z.text(ctx, '★ Missão', 12, 58, 10.5, '#ffe68a', 'left', '#1d1430', Z.FONT2, 800);
      Z.text(ctx, MISSION, 12, 70, 10.5, '#f6f1e6', 'left', '#1d1430', Z.FONT2, 700);
    }
    // chefe
    const b = g.boss;
    if (b && g.bossStarted && !b.dead && b.state !== 'intro') {
      const w = 320, x = (Z.W - w) / 2, y = Z.H - 26;
      Z.text(ctx, b.name, Z.W / 2, y - 18, 12, '#ffe6c0', 'center', '#2a0e14', Z.FONT2, 800);
      Z.art.rr(ctx, x - 3, y - 3, w + 6, 12, 6); ctx.fillStyle = 'rgba(20,8,16,.85)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#e9c46a'; ctx.stroke();
      const fw = w * b.hp / b.maxHp;
      if (fw > 0) { Z.art.rr(ctx, x, y, fw, 6, 3); ctx.fillStyle = Z.art.lin(ctx, 0, y, 0, y + 6, [[0, b.phase2 ? '#ff8a5a' : '#ff5a6a'], [1, b.phase2 ? '#b8301a' : '#9c1f32']]); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 2, y + 1, Math.max(0, fw - 4), 1.2); }
      ctx.fillStyle = '#e9c46a'; ctx.fillRect(x + w / 2 - 0.5, y - 2, 1, 10);
    }
    // placa próxima
    const s = nearSign();
    if (s && !g.dialog && !g.hud.msg) {
      const lines = Z.wrap(ctx, signText(s.text), 372, 13, Z.FONT2, 700);
      const h = lines.length * 16 + 16, w = 396, x = (Z.W - w) / 2, y = 90;
      panel(x, y, w, h, 'wood');
      lines.forEach((l, i) => Z.text(ctx, l, Z.W / 2, y + 8 + i * 16, 13, '#fff3d6', 'center', null, Z.FONT2, 700));
    }
    // nome da área (estilo Hollow Knight)
    const bn = g.hud.banner;
    if (bn) {
      const a = Z.clamp(Math.min(bn.t / 0.4, (3 - bn.t) / 0.6), 0, 1);
      ctx.globalAlpha = a;
      Z.text(ctx, bn.text.toUpperCase(), Z.W / 2, 20, 11, '#fff6dc', 'center', '#1d1430');
      const lw = 90 + 60 * Math.min(1, bn.t / 0.6);
      ctx.fillStyle = Z.art.lin(ctx, Z.W / 2 - lw, 0, Z.W / 2 + lw, 0, [[0, 'rgba(255,246,220,0)'], [0.5, '#fff6dc'], [1, 'rgba(255,246,220,0)']]); ctx.fillRect(Z.W / 2 - lw, 37, lw * 2, 1);
      ctx.globalAlpha = 1;
    }
    const m = g.hud.msg;
    if (m) {
      const a = Z.clamp(Math.min(m.t / 0.3, (3.4 - m.t) / 0.5), 0, 1);
      ctx.globalAlpha = a;
      const ml = Z.wrap(ctx, m.text, 340, 13, Z.FONT2, 700);
      panel(Z.W / 2 - 185, 112, 370, 44 + ml.length * 16);
      Z.text(ctx, m.title, Z.W / 2, 124, 11, '#ffe68a', 'center', null);
      ml.forEach((l, i) => Z.text(ctx, l, Z.W / 2, 145 + i * 16, 13, '#fff', 'center', null, Z.FONT2, 700));
      ctx.globalAlpha = 1;
    }
  }

  function drawMenu(m, y0) {
    if (m.title) Z.text(ctx, m.title, Z.W / 2, y0 - 34, 14, '#fff6dc', 'center', '#1d1430');
    g.menuRects = [];
    m.items.forEach((it, i) => {
      const y = y0 + i * 28, w = 250, x = Z.W / 2 - w / 2, sel = i === m.sel;
      Z.art.rr(ctx, x, y, w, 22, 11);
      ctx.fillStyle = sel ? Z.art.lin(ctx, 0, y, 0, y + 22, [[0, '#6fb0f0'], [1, '#2f6fb8']]) : 'rgba(20,14,40,.72)'; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = sel ? '#e6f4ff' : 'rgba(180,160,220,.5)'; ctx.stroke();
      const label = it.label();
      Z.text(ctx, label, Z.W / 2, y + 3.5, 13, '#fff', 'center', null, Z.FONT2, sel ? 800 : 600);
      if (sel && it.adj) { Z.text(ctx, '◀', x + 12, y + 4, 11, '#fff', 'center', null, Z.FONT2, 800); Z.text(ctx, '▶', x + w - 12, y + 4, 11, '#fff', 'center', null, Z.FONT2, 800); }
      g.menuRects.push({ x, y, w, h: 22, i });
    });
  }

  function drawTitle() {
    const cam = { x: g.titleCam.x, y: 120 };
    drawBackground(cam);
    ctx.fillStyle = Z.art.lin(ctx, 0, 0, 0, Z.H, [[0, 'rgba(20,14,38,.35)'], [0.5, 'rgba(20,14,38,0)'], [1, 'rgba(20,14,38,.45)']]); ctx.fillRect(0, 0, Z.W, Z.H);
    Z.drawParticles(ctx, { x: 0, y: 0 });
    const bob = Math.sin(g.t * 2) * 2;
    ctx.save(); ctx.shadowColor = 'rgba(10,20,60,.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.font = `400 40px ${Z.FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = '#141032'; ctx.strokeText('ZIMA', Z.W / 2, 26 + bob);
    ctx.fillStyle = Z.art.lin(ctx, 0, 26, 0, 66, [[0, '#d8f6ff'], [0.5, '#7fd6ff'], [1, '#2f7fd0']]); ctx.fillText('ZIMA', Z.W / 2, 26 + bob);
    ctx.restore();
    Z.text(ctx, 'BLUE ADVENTURE', Z.W / 2, 74 + bob, 15, '#fff6dc', 'center', '#141032');
    Z.text(ctx, 'Rumo à Presidência', Z.W / 2, 96, 15, '#ffd6a0', 'center', '#3a1a20', Z.FONT2, 800);
    Z.drawFrame(ctx, Z.animFrame('idle', g.t), 92, 312, 1, { scale: 2.2 });
    if (Math.random() < 0.06) Z.emit(Z.rand(0, Z.W), Z.H + 5, 1, { color: '#d8f2ff', kind: 'bub', speed: 30, angle: -Math.PI / 2, spread: 0.3, gravity: -20, life: 4, size: 5 });
    if (g.state !== 'title') return;          // nas opções, o menu é desenhado por cima
    drawMenu(g.menu, 170);
    const hint = I.mode === 'touch' ? 'Toque numa opção' : I.mode === 'pad' ? 'A para confirmar' : '↑ ↓ e Enter';
    Z.text(ctx, hint, Z.W / 2, 262, 12, '#e8e0f8', 'center', '#1d1430', Z.FONT2, 700);
    if (I.mode === 'keys') Z.text(ctx, '← → andar · Espaço pular · ↓ agachar · J rede · K rolar · L bolhas', Z.W / 2, 334, 12, '#e8e0f8', 'center', '#1d1430', Z.FONT2, 700);
    let cleared = false; try { cleared = !!localStorage.getItem('zima_cleared'); } catch (_) {}
    if (cleared) Z.text(ctx, '★ Tutorial concluído', Z.W - 12, 12, 12, '#ffe68a', 'right', '#1d1430', Z.FONT2, 800);
  }

  function drawVictory() {
    drawWorld();
    ctx.fillStyle = `rgba(20,14,38,${Math.min(0.85, g.victoryT)})`; ctx.fillRect(0, 0, Z.W, Z.H);
    Z.drawParticles(ctx, g.camView);
    if (g.victoryT < 0.6) return;
    Z.text(ctx, 'FIM DO TUTORIAL', Z.W / 2, 44, 20, '#ffe68a', 'center', '#2a1430');
    Z.text(ctx, 'Zima venceu o debate em Capitão Leônidas Marques!', Z.W / 2, 78, 15, '#fff', 'center', null, Z.FONT2, 700);
    const st = g.stats, mm = Math.floor(st.time / 60), ss = Math.floor(st.time % 60);
    const rows = [['Tempo', `${mm}:${String(ss).padStart(2, '0')}`], ['Derrotas', st.deaths], ['Esquivas perfeitas', st.perfects], ['Adversários vencidos', st.kills],
      ['Segredos', `${(g.save.coxinha ? 1 : 0) + (g.save.chest ? 1 : 0)}/2`]];
    panel(170, 106, 300, rows.length * 22 + 14);
    rows.forEach(([k, v], i) => {
      Z.text(ctx, k, 186, 114 + i * 22, 13, '#cfc6e6', 'left', null, Z.FONT2, 600);
      Z.text(ctx, String(v), 454, 114 + i * 22, 13, '#fff', 'right', null, Z.FONT2, 800);
    });
    Z.text(ctx, 'Missão continua: recrutar aliados pela região!', Z.W / 2, 256, 13, '#9fe0ff', 'center', null, Z.FONT2, 700);
    if (g.victoryT > 1.5 && Math.floor(g.t * 2) % 2) Z.text(ctx, I.mode === 'touch' ? 'Toque para continuar' : 'Enter para continuar', Z.W / 2, 296, 13, '#fff', 'center', null, Z.FONT2, 700);
  }

  function render() {
    ctx.setTransform(Z.S, 0, 0, Z.S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (g.state === 'loading') { ctx.fillStyle = '#140f26'; ctx.fillRect(0, 0, Z.W, Z.H); Z.text(ctx, 'Carregando...', Z.W / 2, Z.H / 2, 10, '#fff', 'center'); return; }
    if (g.state === 'title' || (g.state === 'options' && g.prevState === 'title')) {
      drawTitle();
      if (g.state === 'options') {
        ctx.fillStyle = 'rgba(20,14,38,.72)'; ctx.fillRect(0, 0, Z.W, Z.H); drawMenu(g.menu, 120);
        Z.text(ctx, '◀ ▶ ajustam o valor', Z.W / 2, 276, 12, '#cfc6e6', 'center', null, Z.FONT2, 700);
      }
      return;
    }
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
        Z.text(ctx, 'VOCÊ PERDEU ESSA...', Z.W / 2, 146, 15, '#ff8a9a', 'center', '#2a0810');
        Z.text(ctx, 'mas a campanha continua!', Z.W / 2, 174, 15, '#fff', 'center', null, Z.FONT2, 700);
      }
    }
    if (g.fade > 0) { ctx.fillStyle = `rgba(20,14,38,${g.fade})`; ctx.fillRect(0, 0, Z.W, Z.H); }
    if (g.state === 'pause' || g.state === 'options') {
      ctx.fillStyle = 'rgba(20,14,38,.7)'; ctx.fillRect(0, 0, Z.W, Z.H);
      drawMenu(g.menu, 112);
      if (g.state === 'pause') {
        const tips = [`${I.label('move')} andar · ${I.label('jump')} pular · ${I.label('down')} agachar`, `${I.label('attack')} rede · ${I.label('roll')} rolar · ${I.label('special')} bolhas`];
        tips.forEach((t, i) => Z.text(ctx, t, Z.W / 2, 268 + i * 18, 13, '#cfc6e6', 'center', null, Z.FONT2, 700));
        Z.text(ctx, '★ ' + MISSION, Z.W / 2, 318, 12, '#ffe68a', 'center', null, Z.FONT2, 800);
      } else Z.text(ctx, '◀ ▶ ajustam o valor', Z.W / 2, 268, 12, '#cfc6e6', 'center', null, Z.FONT2, 700);
    }
  }

  // ---------------- toque/clique nos menus ----------------
  canvas.addEventListener('pointerdown', e => {
    if (!g.menuRects || !['title', 'pause', 'options'].includes(g.state)) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * Z.W, y = (e.clientY - r.top) / r.height * Z.H;
    let hit = false;
    for (const m of g.menuRects) if (x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) {
      const it = g.menu.items[m.i];
      // nos ajustes, tocar à esquerda/direita do botão diminui/aumenta
      if (it.adj) { m.i === g.menu.sel ? it.adj(x < m.x + m.w / 2 ? -1 : 1) : (g.menu.sel = m.i); Z.audio.play('select'); }
      else g.tapSel = m.i;
      hit = true;
    }
    if (!hit && g.state === 'title') g.tapSel = g.menu.sel;
    Z.audio.init();
  });

  // ---------------- tela em resolução nativa ----------------
  function chunkRes() { return Math.min(Z.S, 3); }
  function resize() {
    const s = Math.min(innerWidth / Z.W, innerHeight / Z.H);
    const cssW = Math.floor(Z.W * s), cssH = Math.floor(Z.H * s);
    const dpr = window.devicePixelRatio || 1;
    const cap = QUALITY[g.settings.quality][1];
    const S = Math.max(1, Math.min(cssH * dpr / Z.H, cap));
    canvas.width = Math.round(Z.W * S); canvas.height = Math.round(Z.H * S);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    Z.S = canvas.height / Z.H;
    const R = chunkRes();
    if (!g.layers || Math.abs(g.layers.R - R) > 0.01) { if (g.layersReady) g.layers = Z.art.buildLayers(R); }
    if (g.level) g.level.setResolution(R);
  }
  let rzT = 0;
  addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(resize, 120); });
  resize();
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
    try { await Promise.race([Promise.all([document.fonts.load(`400 8px ${Z.FONT}`), document.fonts.load(`700 12px ${Z.FONT2}`), document.fonts.load(`800 12px ${Z.FONT2}`)]), new Promise(r => setTimeout(r, 2500))]); } catch (_) {}
    await Z.loadAtlas();
    g.layersReady = true; g.layers = Z.art.buildLayers(chunkRes());
    applySettings();
    I.onFirstGesture = () => Z.audio.init();
    toTitle();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => Z.audio.init(), { once: true, passive: true }));
  boot();
})();
