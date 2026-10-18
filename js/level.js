// Fase tutorial: "Vila Azul do Interior". Mapa de tiles, objetos, colisão e pintura do cenário.
'use strict';
(() => {
  const T = Z.T;
  const COLS = 284, ROWS = 34;
  const E = 0, G = 1, BRK = 2, BRIDGE = 3, GATE = 4, WATER = 5, SOBRADO = 6;

  // Textos das placas (tokens trocados conforme o controle em uso)
  const SIGNS = [
    { tx: 30, row: 14, text: '{MOVE} para andar. A Prefeitura fica lá pra frente!' },
    { tx: 46, row: 17, text: 'Teto baixo! Segure {DOWN} para agachar e passar por baixo da marquise.' },
    { tx: 79, row: 20, text: 'Pombos bravos! Ataque com {ATK}. Cada acerto enche seu CARISMA.' },
    { tx: 113, row: 22, text: 'Os cabos do Coronel jogam santinhos na altura da cabeça. Agache ({DOWN}) ou role ({ROLL}).' },
    { tx: 119, row: 22, text: 'Role no ÚLTIMO instante: se o golpe passar durante o giro, é ESQUIVA PERFEITA (ganha Carisma)!' },
    { tx: 176, row: 28, text: 'A ponte está erguida! Acerte a alavanca do outro lado com BOLHAS ({SPC}). Gasta 1 Carisma. Sem Carisma? Encoste na Urna.' },
    { tx: 207, row: 28, text: 'Um baú lá no alto da sacada... Volte quando souber PULAR.' },
    { tx: 235, row: 28, text: 'Prefeitura Municipal. O Coronel Bigodão te espera. Lembre: rolar atravessa a investida!' },
  ];

  Z.makeLevel = save => {
    const grid = new Uint8Array(COLS * ROWS);
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) grid[y * COLS + x] = v; };
    const fill = (x0, x1, y0, y1, v) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, v); };
    const ground = (x0, x1, top) => fill(x0, x1, top, ROWS, G);

    ground(0, 40, 14);        // Rodoviária
    ground(40, 75, 17);       // Rua do Comércio
    ground(75, 110, 20);      // Praça dos Pombos
    ground(110, 160, 22);     // Rua dos Cabos + banco
    ground(160, 185, 28);     // Córrego
    fill(185, 195, 31, ROWS, G); fill(185, 195, 29, 31, WATER);
    ground(195, COLS, 28);    // Igreja + Prefeitura
    fill(0, 1, 0, ROWS, G); fill(COLS - 1, COLS, 0, ROWS, G); // bordas
    fill(52, 61, 0, 15, SOBRADO);                              // marquise baixa
    fill(150, 159, 23, 28, E);                                 // porão secreto
    fill(159, 160, 23, 28, BRK);                               // muro rachado
    fill(210, 217, 21, 22, G);                                 // sacada da igreja (inalcançável)

    const L = {
      cols: COLS, rows: ROWS, pw: COLS * T, ph: ROWS * T, grid,
      wall: { tx: 159, ty0: 23, ty1: 27, hp: save.wall ? 0 : 3, shake: 0 },
      bridge: { tx0: 185, tx1: 194, ty: 28, lowered: !!save.bridge, anim: save.bridge ? 1 : 0 },
      gate: { tx: 243, ty0: 22, ty1: 27, closed: false, anim: 0 },
      arena: { x0: 243 * T, x1: (COLS - 1) * T, trigger: 250 * T },
      signs: SIGNS.map(s => ({ x: s.tx * T + 8, y: s.row * T, text: s.text })),
      benches: [{ id: 'b1', x: 148 * T + 8, y: 22 * T }, { id: 'b2', x: 231 * T + 8, y: 28 * T }],
      spawns: { start: { x: 15 * T, y: 14 * T }, b1: { x: 148 * T + 8, y: 22 * T }, b2: { x: 231 * T + 8, y: 28 * T } },
      npc: { x: 22 * T, y: 14 * T },
      urna: { x: 170 * T + 8, y: 28 * T, cd: 0 },
      coxinha: save.coxinha ? null : { x: 154 * T + 8, y: 28 * T },
      lever: { x: 197 * T + 8, y: 28 * T, on: !!save.bridge },
      chest: { x: 213 * T + 8, y: 21 * T },
      enemies: [
        { type: 'pombo', x: 86 * T, y: 15 * T }, { type: 'pombo', x: 97 * T, y: 14 * T }, { type: 'pombo', x: 105 * T, y: 15 * T },
        { type: 'cabo', x: 127 * T, y: 22 * T }, { type: 'cabo', x: 139 * T, y: 22 * T },
        { type: 'cabo', x: 205 * T, y: 28 * T }, { type: 'pombo', x: 222 * T, y: 23 * T },
      ],
      bossSpawn: { x: 272 * T, y: 28 * T },
    };

    L.tile = (tx, ty) => (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) ? G : grid[ty * COLS + tx];
    L.solidT = (tx, ty) => {
      const v = L.tile(tx, ty);
      if (v === G || v === SOBRADO) return true;
      if (v === BRK) return L.wall.hp > 0;
      if (v === BRIDGE) return false;
      if (tx >= L.bridge.tx0 && tx <= L.bridge.tx1 && ty === L.bridge.ty) return L.bridge.lowered;
      if (tx === L.gate.tx && ty >= L.gate.ty0 && ty <= L.gate.ty1) return L.gate.closed;
      return false;
    };
    L.solidAt = (x, y) => L.solidT(Math.floor(x / T), Math.floor(y / T));
    L.rectSolid = (l, t, r, b) => {
      for (let ty = Math.floor(t / T); ty <= Math.floor((b - 0.01) / T); ty++)
        for (let tx = Math.floor(l / T); tx <= Math.floor((r - 0.01) / T); tx++) if (L.solidT(tx, ty)) return true;
      return false;
    };
    L.waterAt = (x, y) => L.tile(Math.floor(x / T), Math.floor(y / T)) === WATER;

    // move um corpo (x = centro, y = pés) resolvendo colisões por eixo
    L.move = (e, dx, dy) => {
      const res = { hitX: false, hitY: false, ground: false, ceil: false };
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6));
      const sx = dx / steps, sy = dy / steps;
      for (let s = 0; s < steps; s++) {
        if (sx) {
          e.x += sx;
          const t = e.y - e.h + 0.5, b = e.y - 0.5;
          if (sx > 0) { const r = e.x + e.w / 2; if (L.rectSolid(r - 0.01, t, r, b)) { e.x = Math.floor(r / T) * T - e.w / 2 - 0.01; res.hitX = true; } }
          else { const l = e.x - e.w / 2; if (L.rectSolid(l, t, l + 0.01, b)) { e.x = (Math.floor(l / T) + 1) * T + e.w / 2 + 0.01; res.hitX = true; } }
        }
        if (sy) {
          e.y += sy;
          const l = e.x - e.w / 2 + 0.5, r = e.x + e.w / 2 - 0.5;
          if (sy > 0) { if (L.rectSolid(l, e.y - 0.01, r, e.y)) { e.y = Math.floor(e.y / T) * T; res.hitY = res.ground = true; } }
          else { const t = e.y - e.h; if (L.rectSolid(l, t, r, t + 0.01)) { e.y = (Math.floor(t / T) + 1) * T + e.h; res.hitY = res.ceil = true; } }
        }
      }
      return res;
    };
    L.onGround = e => L.rectSolid(e.x - e.w / 2 + 0.5, e.y, e.x + e.w / 2 - 0.5, e.y + 1);

    // golpe em tiles quebráveis; retorna true se acertou
    L.hitRect = (rect, dmg) => {
      const w = L.wall;
      if (w.hp <= 0) return false;
      const wr = { l: w.tx * T, r: (w.tx + 1) * T, t: w.ty0 * T, b: (w.ty1 + 1) * T };
      if (!Z.overlap(rect, wr)) return false;
      w.hp -= dmg; w.shake = 0.2;
      Z.emit(w.tx * T + 4, rect.t + 10, 8, { color: ['#8a8178', '#6b5a4a', '#bdb3a6'], speed: 140, size: 3 });
      if (w.hp <= 0) {
        w.hp = 0; Z.audio.play('break'); Z.cam.shake(4, 0.3);
        for (let ty = w.ty0; ty <= w.ty1; ty++) Z.emit(w.tx * T + 8, ty * T + 8, 10, { color: ['#8a8178', '#6b5a4a', '#bdb3a6'], speed: 180, size: 4, life: 1 });
        Z.floatText(w.tx * T + 8, w.ty0 * T, 'Uma passagem secreta!', '#ffe68a', { life: 2 });
        Z.game.saveFlag('wall', true);
      } else Z.audio.play('hit');
      return true;
    };

    L.closeGate = () => { L.gate.closed = true; L.gate.anim = 0; Z.audio.play('gate'); Z.cam.shake(3, 0.3); };
    L.openGate = () => { L.gate.closed = false; };
    L.lowerBridge = () => {
      if (L.bridge.lowered) return;
      L.bridge.lowered = true; L.lever.on = true; Z.audio.play('lever'); setTimeout(() => Z.audio.play('bridge'), 150);
      Z.floatText(L.lever.x, L.lever.y - 64, 'A ponte desceu!', '#9fe0ff', { life: 2 });
      Z.game.saveFlag('bridge', true);
    };

    L.prerender = () => { L.decor = paintDecor(L); L.tiles = paintTiles(L); };
    L.update = dt => {
      if (L.bridge.lowered) L.bridge.anim = Math.min(1, L.bridge.anim + dt * 1.6);
      if (L.gate.closed) L.gate.anim = Math.min(1, L.gate.anim + dt * 4);
      L.wall.shake = Math.max(0, L.wall.shake - dt);
      L.urna.cd = Math.max(0, L.urna.cd - dt);
    };
    L.drawBack = (ctx, cam) => ctx.drawImage(L.decor, cam.x, cam.y, Z.W, Z.H, 0, 0, Z.W, Z.H);
    L.drawTiles = (ctx, cam, t) => {
      ctx.drawImage(L.tiles, cam.x, cam.y, Z.W, Z.H, 0, 0, Z.W, Z.H);
      drawDynamic(ctx, L, cam, t);
    };
    return L;
  };

  // ---------------- pintura dos tiles ----------------
  function paintTiles(L) {
    const c = Z.art.canvas(L.pw, L.ph).getContext('2d'), R = Z.art.R;
    const solid = (x, y) => { const v = L.tile(x, y); return v === G; };
    const rnd = Z.art.rng(42);
    for (let ty = 0; ty < L.rows; ty++) for (let tx = 0; tx < L.cols; tx++) {
      if (L.tile(tx, ty) !== G) continue;
      const x = tx * T, y = ty * T;
      const grass = tx >= 160 && tx < 200;
      R(c, x, y, T, T, '#6b4a35');
      for (let i = 0; i < 4; i++) R(c, x + rnd() * 14, y + rnd() * 14, 2 + rnd() * 2, 2, rnd() > 0.5 ? '#5a3d2b' : '#7a5741');
      if (rnd() > 0.85) R(c, x + rnd() * 10, y + rnd() * 10, 4, 3, '#8e8274');
      const top = !solid(tx, ty - 1) && L.tile(tx, ty - 1) !== SOBRADO;
      if (top) {
        if (grass) {
          R(c, x, y, T, 5, '#5e9a48'); R(c, x, y + 5, T, 2, '#4a7d3a');
          for (let i = 0; i < 4; i++) R(c, x + rnd() * 15, y - 2, 1, 3, '#6fb056');
        } else { // paralelepípedo
          R(c, x, y, T, 7, '#5e574f');
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
            const ox = j === 1 ? 4 : 0;
            R(c, x + ox + i * 8 + 1, y + j * 3 + 1, 6, 2, rnd() > 0.5 ? '#a39a8f' : '#958c81');
          }
          R(c, x, y, T, 1, '#c4bcb0'); R(c, x, y + 7, T, 1, '#4a3a2c');
        }
      }
      if (!solid(tx - 1, ty) && L.tile(tx - 1, ty) !== BRK) { R(c, x, y, 2, T, '#4a3324'); if (top) R(c, x, y, 2, 7, '#4a443d'); }
      if (!solid(tx + 1, ty) && L.tile(tx + 1, ty) !== BRK) { R(c, x + T - 2, y, 2, T, '#4a3324'); if (top) R(c, x + T - 2, y, 2, 7, '#4a443d'); }
      if (!solid(tx, ty + 1) && ty + 1 < L.rows) R(c, x, y + T - 2, T, 2, '#3b281c');
    }
    // sobrado da marquise (tiles 52..60, linhas 0..14)
    const sx = 52 * T, sw = 9 * T, sb = 15 * T;
    R(c, sx, 0, sw, sb, '#d9734e');
    for (let wy = 30; wy < sb - 60; wy += 46) for (let i = 0; i < 3; i++) {
      const wx = sx + 18 + i * 44;
      R(c, wx - 2, wy - 2, 20, 30, '#fbe9d0'); R(c, wx, wy, 16, 26, '#3a2b3e'); R(c, wx + 1, wy + 1, 14, 10, '#f6d38c');
      R(c, wx - 3, wy + 26, 22, 3, '#fbe9d0'); R(c, wx - 5, wy + 29, 26, 4, '#4b4b5a'); // sacadinha
    }
    R(c, sx, sb - 34, sw, 4, '#fbe9d0');
    // toldo listrado
    for (let i = 0; i < sw; i += 12) { R(c, sx + i, sb - 30, 6, 24, '#e63946'); R(c, sx + i + 6, sb - 30, 6, 24, '#f6f1e6'); }
    for (let i = 0; i < sw; i += 12) { c.fillStyle = i % 24 ? '#f6f1e6' : '#e63946'; c.beginPath(); c.arc(sx + i + 6, sb - 6, 6, 0, Math.PI); c.fill(); }
    R(c, sx, sb - 30, sw, 2, '#9c1f2a');
    c.font = `8px ${Z.FONT}`; c.textAlign = 'center'; c.textBaseline = 'top';
    R(c, sx + sw / 2 - 40, sb - 54, 80, 14, '#3b2414'); c.fillStyle = '#ffe08a'; c.fillText('PADARIA', sx + sw / 2, sb - 51);
    return c.canvas;
  }

  // ---------------- pintura do cenário (fundo da fase) ----------------
  function paintDecor(L) {
    const c = Z.art.canvas(L.pw, L.ph).getContext('2d'), A = Z.art, R = A.R;
    const gy = row => row * T;

    // --- Rodoviária ---
    A.house(c, 190, gy(14), 220, 96, { wall: '#e8d9b0', sign: 'RODOVIÁRIA', windows: 4, shutter: '#2e5d8a', roofColor: '#8a3a2a' });
    R(c, 200, gy(14) - 40, 200, 6, '#2e5d8a');
    A.lamp(c, 430, gy(14)); A.ipe(c, 480, gy(14), 1.1);
    A.house(c, 520, gy(14), 110, 70, { wall: '#c05b7a', windows: 2, shutter: '#f2e6c9', trim: '#fff1f6' });
    // ônibus
    const bx = 20, by = gy(14);
    R(c, bx, by - 58, 150, 48, '#e9e2cc'); R(c, bx, by - 34, 150, 10, '#2e5d8a'); R(c, bx, by - 58, 150, 4, '#cfc6ae');
    for (let i = 0; i < 6; i++) R(c, bx + 8 + i * 23, by - 52, 18, 14, '#7fb3d9');
    R(c, bx + 136, by - 52, 12, 30, '#7fb3d9');
    R(c, bx, by - 14, 150, 4, '#3a3a44');
    for (const wx of [bx + 26, bx + 120]) { c.fillStyle = '#222'; c.beginPath(); c.arc(wx, by - 8, 9, 0, 7); c.fill(); R(c, wx - 3, by - 11, 6, 6, '#999'); }
    c.font = `8px ${Z.FONT}`; c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('VIAÇÃO AZUL', bx + 10, by - 32);

    // --- Rua do Comércio ---
    A.house(c, 650, gy(17), 160, 90, { wall: '#7fb87a', sign: 'FARMÁCIA', signBg: '#1f6a3a', shutter: '#f5f0e0', trim: '#f7ffef' });
    // interior escuro sob a marquise
    R(c, 52 * T, gy(15), 9 * T, 2 * T, '#3a2626');
    R(c, 52 * T + 20, gy(15) + 6, 50, 14, '#8a5a3a'); R(c, 52 * T + 22, gy(15) + 4, 46, 3, '#c9a27a');
    for (let i = 0; i < 4; i++) { c.fillStyle = '#e8b65a'; c.beginPath(); c.arc(52 * T + 30 + i * 10, gy(15) + 3, 4, 0, 7); c.fill(); }
    R(c, 52 * T + 96, gy(15) + 2, 30, 28, '#5a3a3a');
    A.house(c, 985, gy(17), 200, 96, { wall: '#e8c547', sign: 'MERCEARIA', signBg: '#8a3a2a', shutter: '#2f6f9a', windows: 4 });
    A.bunting(c, 640, 1200, gy(17) - 130, 16);
    A.lamp(c, 820, gy(17)); A.lamp(c, 1192, gy(17));

    // --- Praça dos Pombos ---
    const pg = gy(20);
    A.ipe(c, 1250, pg, 1.3); A.ipe(c, 1720, pg, 1.2, '#f07ab0');
    coreto(c, 1480, pg);
    A.bush(c, 1300, pg, 60); A.bush(c, 1610, pg, 70);
    benchDecor(c, 1370, pg); benchDecor(c, 1600, pg);
    A.lamp(c, 1330, pg); A.lamp(c, 1650, pg);
    A.bunting(c, 1380, 1580, pg - 120, 12);

    // --- Rua dos Cabos ---
    const cg = gy(22);
    A.house(c, 1775, cg, 140, 84, { wall: '#5fa8a0', sign: 'BAR DO ZÉ', signBg: '#6b3f28', shutter: '#f2e6c9', posters: [8, 112] });
    A.house(c, 1930, cg, 150, 96, { wall: '#e9e1cf', shutter: '#8a3a2a', posters: [10, 40, 120], windows: 3 });
    A.house(c, 2095, cg, 140, 80, { wall: '#d9734e', shutter: '#2f6f62', trim: '#fbe9d0', posters: [100] });
    A.ipe(c, 2290, cg, 1.2); A.lamp(c, 2330, cg); A.lamp(c, 2420, cg);
    A.house(c, 2440, cg, 110, 74, { wall: '#7aa5d6', shutter: '#f5f0e0', door: false, windows: 2 });
    // porão secreto
    R(c, 150 * T, gy(23), 9 * T, 5 * T, '#3a2a2a');
    for (let y = gy(23); y < gy(28); y += 8) for (let x = 150 * T + ((y / 8) % 2) * 8; x < 159 * T; x += 16) R(c, x, y, 15, 7, '#4a3434');
    R(c, 150 * T + 20, gy(28) - 30, 30, 30, '#5a4040'); R(c, 150 * T + 22, gy(28) - 28, 26, 2, '#7a5a4a'); // caixote

    // --- Córrego ---
    const rg = gy(28);
    A.fence(c, 2580, 2700, rg); A.bush(c, 2760, rg, 60); A.ipe(c, 2650, rg, 1.4);
    A.ipe(c, 2900, rg, 1.1, '#f07ab0'); A.fence(c, 3140, 3200, rg);
    // margem de pedras do córrego
    for (let i = 0; i < 10; i++) { c.fillStyle = '#6a6f78'; c.beginPath(); c.arc(185 * T + i * 16 + 8, gy(29) + 2, 5, 0, 7); c.fill(); }
    // muro de pedra do penhasco (fundo)
    for (let y = gy(22); y < rg; y += 10) for (let x = 2560; x < 2620; x += 14) R(c, x + ((y / 10) % 2) * 7, y, 12, 8, 'rgba(90,80,70,.35)');

    // --- Igreja Matriz ---
    igreja(c, 3200, rg);
    A.lamp(c, 3640, rg); A.ipe(c, 3690, rg, 1.2);

    // --- Prefeitura ---
    prefeitura(c, 3880, rg);
    A.bunting(c, 3870, 4500, rg - 190, 20);
    return c.canvas;
  }

  function benchDecor(c, x, by) { Z.art.bench(c, x, by, false, 0); }
  function coreto(c, x, by) {
    const R = Z.art.R;
    R(c, x - 80, by - 14, 160, 14, '#e9e1cf'); R(c, x - 80, by - 16, 160, 3, '#c9bfa6');
    for (let i = -3; i <= 3; i++) { R(c, x + i * 24 - 2, by - 80, 5, 66, '#f6f1e6'); }
    R(c, x - 80, by - 40, 160, 3, '#e6dccb');
    for (let i = -76; i < 76; i += 6) R(c, x + i, by - 38, 2, 22, '#e6dccb');
    c.fillStyle = '#2f6f62'; c.beginPath(); c.moveTo(x - 92, by - 80); c.lineTo(x, by - 122); c.lineTo(x + 92, by - 80); c.fill();
    R(c, x - 92, by - 82, 184, 4, '#245a4f'); R(c, x - 1, by - 136, 3, 16, '#e6c35a');
  }
  function igreja(c, x, by) {
    const A = Z.art, R = A.R;
    A.house(c, x, by, 380, 112, { wall: '#f4efe2', roof: false, door: false, windows: 0 });
    // torre
    R(c, x + 150, by - 230, 80, 230, '#f4efe2'); R(c, x + 150, by - 230, 80, 4, '#fff');
    c.fillStyle = '#5a7fb0'; c.beginPath(); c.moveTo(x + 144, by - 230); c.lineTo(x + 190, by - 280); c.lineTo(x + 236, by - 230); c.fill();
    R(c, x + 189, by - 300, 3, 22, '#e6c35a'); R(c, x + 182, by - 292, 17, 3, '#e6c35a');
    c.fillStyle = '#3a2b3e'; c.beginPath(); c.arc(x + 190, by - 190, 14, Math.PI, 0); c.fill(); R(c, x + 176, by - 190, 28, 20, '#3a2b3e');
    c.fillStyle = '#d8b04a'; c.beginPath(); c.arc(x + 190, by - 180, 7, 0, 7); c.fill(); // sino
    // frontão
    c.fillStyle = '#f4efe2'; c.beginPath(); c.moveTo(x, by - 112); c.lineTo(x + 70, by - 150); c.lineTo(x + 150, by - 150); c.lineTo(x + 150, by - 112); c.fill();
    c.beginPath(); c.moveTo(x + 230, by - 112); c.lineTo(x + 230, by - 150); c.lineTo(x + 310, by - 150); c.lineTo(x + 380, by - 112); c.fill();
    // porta em arco
    R(c, x + 170, by - 60, 40, 60, '#6b3f28'); c.fillStyle = '#6b3f28'; c.beginPath(); c.arc(x + 190, by - 60, 20, Math.PI, 0); c.fill();
    R(c, x + 189, by - 78, 2, 78, '#4a2a18');
    for (const wx of [x + 40, x + 100, x + 270, x + 330]) { R(c, wx - 8, by - 92, 16, 30, '#5a7fb0'); c.fillStyle = '#5a7fb0'; c.beginPath(); c.arc(wx, by - 92, 8, Math.PI, 0); c.fill(); R(c, wx - 1, by - 98, 2, 36, '#f4efe2'); }
    R(c, x, by - 10, 380, 10, '#5a7fb0');
    c.font = `8px ${Z.FONT}`; c.fillStyle = '#5a7fb0'; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText('IGREJA MATRIZ', x + 190, by - 132);
  }
  function prefeitura(c, x, by) {
    const A = Z.art, R = A.R;
    A.house(c, x, by, 620, 150, { wall: '#efe0b8', roofColor: '#8a3a2a', door: false, windows: 0 });
    for (let i = 0; i < 8; i++) { const cx = x + 40 + i * 76; R(c, cx, by - 140, 12, 130, '#fff8e6'); R(c, cx - 3, by - 142, 18, 4, '#e6d6b0'); R(c, cx - 3, by - 14, 18, 4, '#e6d6b0'); }
    for (let i = 0; i < 7; i++) { const wx = x + 66 + i * 76; R(c, wx, by - 120, 28, 36, '#3a2b3e'); R(c, wx + 2, by - 118, 24, 12, '#f6d38c'); R(c, wx - 4, by - 84, 36, 4, '#4b4b5a'); }
    R(c, x + 160, by - 196, 300, 50, '#efe0b8'); c.fillStyle = '#efe0b8';
    c.beginPath(); c.moveTo(x + 150, by - 196); c.lineTo(x + 310, by - 230); c.lineTo(x + 470, by - 196); c.fill();
    c.font = `8px ${Z.FONT}`; c.fillStyle = '#6b3f28'; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText('PREFEITURA MUNICIPAL', x + 310, by - 180);
    c.fillStyle = '#8a3a2a'; c.fillText('ADM. CORONEL BIGODÃO (DESDE 1985)', x + 310, by - 164);
    R(c, x + 590, by - 260, 3, 260, '#777'); R(c, x + 593, by - 258, 30, 20, '#2a9d4a'); R(c, x + 603, by - 252, 10, 8, '#e9c46a');
  }

  // ---------------- tiles dinâmicos ----------------
  function drawDynamic(ctx, L, cam, t) {
    const R = Z.art.R;
    // água do córrego
    const wx = 185 * T - cam.x, wy = 29 * T - cam.y;
    ctx.fillStyle = 'rgba(70,140,190,.85)'; ctx.fillRect(wx, wy + 4, 10 * T, 2 * T - 4);
    for (let i = 0; i < 10 * T; i += 4) R(ctx, wx + i, wy + 3 + Math.round(Math.sin(t * 3 + i * 0.2) * 1.5), 3, 2, '#bfe6ff');
    // ponte
    const b = L.bridge;
    if (b.lowered) {
      const len = (b.tx1 - b.tx0 + 1) * T, ang = (1 - easeOut(b.anim)) * Math.PI / 2;
      ctx.save(); ctx.translate((b.tx1 + 1) * T - cam.x, b.ty * T - cam.y); ctx.rotate(ang);
      for (let i = 0; i < len; i += 8) { R(ctx, -i - 8, 0, 7, 7, '#8a5a2a'); R(ctx, -i - 8, 0, 7, 2, '#a8703a'); }
      R(ctx, -len, 2, len, 2, '#5a3a1a');
      ctx.restore();
    } else {
      // ponte erguida (em pé na margem direita)
      const x0 = (b.tx1 + 1) * T - cam.x - 8, y0 = b.ty * T - cam.y;
      for (let i = 0; i < 10 * T; i += 8) { R(ctx, x0, y0 - i - 8, 7, 7, '#8a5a2a'); R(ctx, x0, y0 - i - 8, 2, 7, '#a8703a'); }
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 3, y0 - 160); ctx.lineTo(x0 + 30, y0 - 40); ctx.stroke();
    }
    // muro rachado
    const w = L.wall;
    if (w.hp > 0) {
      const sh = w.shake > 0 ? Math.round(Z.rand(-1, 1)) : 0;
      for (let ty = w.ty0; ty <= w.ty1; ty++) {
        const x = w.tx * T - cam.x + sh, y = ty * T - cam.y;
        R(ctx, x, y, T, T, '#6b4a35'); R(ctx, x, y, 2, T, '#4a3324');
        R(ctx, x + 3, y + 3, 4, 3, '#5a3d2b'); R(ctx, x + 9, y + 10, 4, 2, '#7a5741');
        // rachaduras sutis
        if (ty % 2 === 0) { R(ctx, x + 6, y + 2, 1, 6, '#2a1a10'); R(ctx, x + 7, y + 8, 1, 5, '#2a1a10'); }
        else { R(ctx, x + 10, y + 4, 1, 5, '#2a1a10'); R(ctx, x + 9, y + 9, 1, 4, '#2a1a10'); }
        if (w.hp < 3) R(ctx, x + 3, y + 6 + (ty % 3), 8, 1, '#2a1a10');
        if (w.hp < 2) R(ctx, x + 2, y + 11, 10, 1, '#2a1a10');
      }
    }
    // portão da arena
    const g = L.gate;
    if (g.closed) {
      const h = (g.ty1 - g.ty0 + 1) * T, drop = (1 - easeOut(g.anim)) * h;
      const x = g.tx * T - cam.x, y = g.ty0 * T - cam.y - drop;
      for (let i = 0; i < T; i += 5) R(ctx, x + i, y, 3, h, '#3a3a48');
      for (let j = 6; j < h; j += 18) R(ctx, x, y + j, T, 3, '#4a4a5a');
      for (let i = 0; i < T; i += 5) R(ctx, x + i, y + h - 4, 3, 4, '#8a8a9a');
    }
  }
  const easeOut = k => 1 - Math.pow(1 - k, 3);
})();
