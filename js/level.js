// Fase tutorial: Capitão Leônidas Marques. Mapa de tiles, objetos, colisão e pintura do cenário em HD.
// O cenário estático é pintado em blocos (chunks) na resolução real da tela e guardado em cache.
'use strict';
(() => {
  const T = Z.T;
  const COLS = 284, ROWS = 34;
  const E = 0, G = 1, BRK = 2, BRIDGE = 3, GATE = 4, WATER = 5, SOBRADO = 6, CRATE = 7, BALCONY = 8;
  const CH = 512;                 // largura de cada bloco do cenário (unidades do mundo)
  const chunks = new Map();       // blocos já pintados (a parte estática não muda entre recomeços)
  let chunkR = 0;

  // Textos das placas (tokens trocados conforme o controle em uso)
  const SIGNS = [
    { tx: 26, row: 14, text: '{MOVE} para andar e {JUMP} para pular. Segure o pulo para ir mais alto!' },
    { tx: 46, row: 17, text: 'Teto baixo! Segure {DOWN} para agachar e passar por baixo da marquise.' },
    { tx: 79, row: 20, text: 'Atendentes do Coronel arremessam hambúrgueres! Ataque com {ATK} (dá para atacar no ar). Cada acerto enche seu CARISMA. Dica: a rede também rebate o hambúrguer.' },
    { tx: 113, row: 22, text: 'De perto o hambúrguer vem reto, na altura do peito: agache ({DOWN}), pule ou role ({ROLL}). De longe ele vem em arco: saia do lugar!' },
    { tx: 119, row: 22, text: 'Role no ÚLTIMO instante: se o golpe passar durante o giro, é ESQUIVA PERFEITA (ganha Carisma)!' },
    { tx: 176, row: 28, text: 'A ponte está erguida e o córrego é largo demais para pular. Acerte a alavanca com BOLHAS ({SPC}). Sem Carisma? Encoste na Urna.' },
    { tx: 203, row: 28, text: 'Um baú na sacada da Matriz! Suba pelos caixotes com {JUMP} e abra com a rede.' },
    { tx: 235, row: 28, text: 'Prefeitura de Capitão Leônidas Marques. Um brutamontes guarda a porta! Agache sob o soco, role através da investida e saia de baixo da pedra.' },
  ];

  Z.makeLevel = save => {
    const grid = new Uint8Array(COLS * ROWS);
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) grid[y * COLS + x] = v; };
    const fill = (x0, x1, y0, y1, v) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, v); };
    const ground = (x0, x1, top) => fill(x0, x1, top, ROWS, G);

    ground(0, 40, 14);        // Rodoviária
    ground(40, 75, 17);       // Rua do Comércio
    ground(75, 110, 20);      // Praça do Coreto
    ground(110, 160, 22);     // Avenida Central + banco
    ground(160, 185, 28);     // Córrego
    fill(185, 195, 31, ROWS, G); fill(185, 195, 29, 31, WATER);
    ground(195, COLS, 28);    // Igreja + Prefeitura
    fill(0, 1, 0, ROWS, G); fill(COLS - 1, COLS, 0, ROWS, G); // bordas
    fill(52, 61, 0, 15, SOBRADO);                              // marquise baixa
    fill(150, 159, 23, 28, E);                                 // porão secreto
    fill(159, 160, 23, 28, BRK);                               // muro rachado
    fill(33, 35, 12, 14, CRATE);                               // malas na rodoviária (primeiro pulo)
    fill(206, 208, 24, 28, CRATE);                             // caixotes até a sacada
    fill(210, 217, 21, 22, BALCONY);                           // sacada da igreja

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
      chest: { x: 214 * T, y: 21 * T, open: !!save.chest, hits: 0 },
      lights: [[431.5, 14], [821.5, 17], [1193.5, 17], [1331.5, 20], [1651.5, 20], [2331.5, 22], [2421.5, 22], [3641.5, 28]].map(([x, r]) => ({ x, y: r * T - 59 })),
      enemies: [
        { type: 'atendente', x: 89 * T, y: 20 * T }, { type: 'atendente', x: 103 * T, y: 20 * T },
        { type: 'atendente', x: 127 * T, y: 22 * T }, { type: 'atendente', x: 140 * T, y: 22 * T },
        { type: 'atendente', x: 176 * T, y: 28 * T }, { type: 'atendente', x: 222 * T, y: 28 * T },
      ],
      bossSpawn: { x: 272 * T, y: 28 * T },
    };

    L.tile = (tx, ty) => (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) ? G : grid[ty * COLS + tx];
    L.solidT = (tx, ty) => {
      const v = L.tile(tx, ty);
      if (v === G || v === SOBRADO || v === CRATE || v === BALCONY) return true;
      if (v === BRK) return L.wall.hp > 0;
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

    // golpe em coisas quebráveis (muro rachado, baú); retorna true se acertou
    L.hitRect = (rect, dmg, melee) => {
      const ch = L.chest;
      if (melee && !ch.open && Z.overlap(rect, { l: ch.x - 11, r: ch.x + 11, t: ch.y - 20, b: ch.y })) {
        ch.open = true; Z.game.openChest(ch); return true;
      }
      const w = L.wall;
      if (w.hp <= 0) return false;
      const wr = { l: w.tx * T, r: (w.tx + 1) * T, t: w.ty0 * T, b: (w.ty1 + 1) * T };
      if (!Z.overlap(rect, wr)) return false;
      w.hp -= dmg; w.shake = 0.2;
      Z.emit(w.tx * T + 4, rect.t + 10, 8, { color: ['#8a8178', '#6b5a4a', '#bdb3a6'], speed: 140, size: 2.5 });
      if (w.hp <= 0) {
        w.hp = 0; Z.audio.play('break'); Z.cam.shake(4, 0.3);
        for (let ty = w.ty0; ty <= w.ty1; ty++) Z.emit(w.tx * T + 8, ty * T + 8, 10, { color: ['#8a8178', '#6b5a4a', '#bdb3a6'], speed: 180, size: 3.5, life: 1 });
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

    L.update = dt => {
      if (L.bridge.lowered) L.bridge.anim = Math.min(1, L.bridge.anim + dt * 1.6);
      if (L.gate.closed) L.gate.anim = Math.min(1, L.gate.anim + dt * 4);
      L.wall.shake = Math.max(0, L.wall.shake - dt);
      L.urna.cd = Math.max(0, L.urna.cd - dt);
    };

    // ---------- cache do cenário em blocos (compartilhado entre recomeços) ----------
    const makeChunk = i => {
      const R = chunkR;
      const cv = Z.art.canvas(CH * R, L.ph * R), c = cv.getContext('2d');
      c.scale(R, R); c.translate(-i * CH, 0);
      const x0 = i * CH, x1 = x0 + CH;
      paintDecor(c, L, x0, x1);
      paintTiles(c, L, Math.max(0, Math.floor(x0 / T) - 1), Math.min(COLS - 1, Math.ceil(x1 / T) + 1));
      return cv;
    };
    L.setResolution = R => { if (Math.abs(R - chunkR) > 0.01) { chunkR = R; chunks.clear(); } };
    L.chunk = i => {
      let cv = chunks.get(i);
      if (!cv) {
        cv = makeChunk(i); chunks.set(i, cv);
        // mantém poucos blocos na memória (celulares)
        if (chunks.size > 5) { const far = [...chunks.keys()].sort((a, b) => Math.abs(b - i) - Math.abs(a - i))[0]; chunks.delete(far); }
      }
      return cv;
    };
    // pinta antecipadamente o próximo bloco, um por quadro
    L.prefetch = camX => {
      const i = Math.floor((camX + Z.W / 2) / CH);
      for (const j of [i, i + 1, i - 1]) if (j >= 0 && j * CH < L.pw && !chunks.has(j)) { L.chunk(j); return; }
    };
    L.drawStatic = (ctx, cam) => {
      const i0 = Math.max(0, Math.floor(cam.x / CH)), i1 = Math.floor((cam.x + Z.W) / CH);
      const was = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      for (let i = i0; i <= i1 && i * CH < L.pw; i++) {
        const cv = L.chunk(i);
        ctx.drawImage(cv, Z.snap(i * CH - cam.x), -cam.y, CH + 1 / Z.S, cv.height / chunkR);
      }
      ctx.imageSmoothingEnabled = was;
    };
    L.drawDynamic = (ctx, cam, t) => drawDynamic(ctx, L, cam, t);
    L.drawLights = (ctx, cam, t) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const l of L.lights) { const x = l.x - cam.x, y = l.y - cam.y; if (x > -50 && x < Z.W + 50 && y > -50 && y < Z.H + 50) Z.art.lampGlow(ctx, x, y, t); }
      ctx.restore();
    };
    return L;
  };

  // ---------------- tiles ----------------
    function paintTiles(c, L, tx0, tx1) {
    const A = Z.art, R = A.R, h = A.hash;
    const solid = (x, y) => { const v = L.tile(x, y); return v === G; };
    for (let tx = tx0; tx <= tx1; tx++) {
      let run = 0;
      for (let ty = 0; ty < ROWS; ty++) {
        const v = L.tile(tx, ty), x = tx * T, y = ty * T;
        run = v === G ? run + 1 : 0;
        if (v === CRATE) { crate(c, x, y, tx, ty); continue; }
        if (v === BALCONY) { balcony(c, x, y, tx); continue; }
        if (v !== G) continue;
        const border = tx === 0 || tx === COLS - 1;
        if (border) { masonry(c, x, y, tx, ty); continue; }
        const depth = run - 1;
        const grass = tx >= 160 && tx < 200;
        // terra com estratos (mais quente perto da superfície)
        const k = Math.min(1, depth / 8);
        c.fillStyle = A.lin(c, 0, y, 0, y + T, [[0, mixc('#8a5f40', '#4c3222', k)], [1, mixc('#7c543a', '#43291b', Math.min(1, k + 0.12))]]);
        c.fillRect(x, y, T + 0.05, T + 0.05);
        for (let i = 0; i < 7; i++) { const r1 = h(tx * 7 + i, ty * 13), r2 = h(tx * 3 + i, ty * 5 + 1); R(c, x + r1 * 15, y + r2 * 15, 0.8 + r1, 0.6, r2 > 0.5 ? 'rgba(255,220,180,.12)' : 'rgba(0,0,0,.18)'); }
        if (h(tx, ty * 3) > 0.62) { // pedrinha
          const px = x + 3 + h(tx * 5, ty) * 10, py = y + 3 + h(tx, ty * 7) * 10, s = 1.4 + h(tx * 2, ty * 9) * 2;
          A.R; c.fillStyle = '#5c544c'; c.beginPath(); c.ellipse(px, py + 0.4, s + 0.4, s * 0.75 + 0.4, 0, 0, 7); c.fill();
          c.fillStyle = '#9a9086'; c.beginPath(); c.ellipse(px, py, s, s * 0.7, 0, 0, 7); c.fill();
          R(c, px - s * 0.5, py - s * 0.4, s * 0.6, 0.6, '#c9c0b6');
        }
        if (depth > 1 && h(tx * 11, ty * 17) > 0.88) { c.strokeStyle = 'rgba(60,35,20,.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x + 2, y); c.quadraticCurveTo(x + 9, y + 7, x + 6, y + 16); c.stroke(); }
        const top = !solid(tx, ty - 1) && L.tile(tx, ty - 1) !== SOBRADO;
        if (top) {
          // sombra de oclusão sob a superfície
          c.fillStyle = A.lin(c, 0, y, 0, y + T, [[0, 'rgba(20,10,5,.35)'], [1, 'rgba(20,10,5,0)']]); c.fillRect(x, y, T + 0.05, T);
          if (grass) {
            c.fillStyle = A.lin(c, 0, y - 1, 0, y + 6, [[0, '#7fbf5c'], [1, '#447a36']]); c.fillRect(x, y - 0.5, T + 0.05, 6);
            for (let i = 0; i < 9; i++) {
              const bx = x + h(tx * 9 + i, ty) * 16, bh = 2 + h(tx + i, ty * 3) * 3.5;
              c.fillStyle = i % 3 ? '#6aa94e' : '#8fd06a';
              c.beginPath(); c.moveTo(bx - 0.8, y + 1); c.lineTo(bx + 0.3, y - bh); c.lineTo(bx + 0.9, y + 1); c.fill();
            }
            if (h(tx, ty + 99) > 0.7) { c.fillStyle = h(tx, 5) > 0.5 ? '#fff6e0' : '#ffd34d'; c.beginPath(); c.arc(x + h(tx, 7) * 14 + 1, y - 2, 1, 0, 7); c.fill(); }
          } else {
            // meio-fio + calçamento de paralelepípedos
            c.fillStyle = '#463e36'; c.fillRect(x, y, T + 0.05, 10);
            for (let row = 0; row < 2; row++) {
              const off = (row + tx) % 2 ? 0 : 3.5;
              for (let sx = -off; sx < T; sx += 7) {
                const w = 6.2, rx = Math.max(x, x + sx), rw = Math.min(x + T, x + sx + w) - rx;
                if (rw <= 0.5) continue;
                const ry = y + 3 + row * 3.4, j = h(tx * 31 + Math.floor(sx), ty + row);
                const base = j > 0.66 ? '#a59c90' : j > 0.33 ? '#9a9286' : '#b0a89b';
                A.rr(c, rx + 0.3, ry, rw - 0.6, 3, 0.9); c.fillStyle = A.lin(c, 0, ry, 0, ry + 3, [[0, A.shade(base, 0.22)], [1, A.shade(base, -0.28)]]); c.fill();
              }
            }
            c.fillStyle = A.lin(c, 0, y, 0, y + 3, [[0, '#e7e1d6'], [1, '#a8a096']]); c.fillRect(x, y - 0.2, T + 0.05, 3);
            R(c, x, y + 2.8, T + 0.05, 0.5, 'rgba(0,0,0,.35)');
            if (tx % 3 === 0) R(c, x, y, 0.5, 2.8, 'rgba(0,0,0,.25)');
          }
        }
        const leftOpen = !solid(tx - 1, ty) && L.tile(tx - 1, ty) !== BRK, rightOpen = !solid(tx + 1, ty) && L.tile(tx + 1, ty) !== BRK;
        if (leftOpen) rockEdge(c, x, y, 1, tx, ty, top);
        if (rightOpen) rockEdge(c, x + T, y, -1, tx, ty, top);
        if (!solid(tx, ty + 1) && ty + 1 < ROWS && L.tile(tx, ty + 1) !== WATER) { c.fillStyle = A.lin(c, 0, y + T - 3, 0, y + T, [[0, 'rgba(20,10,5,0)'], [1, 'rgba(20,10,5,.6)']]); c.fillRect(x, y + T - 3, T, 3); }
      }
    }
    // sobrado da marquise (tiles 52..60, linhas 0..14)
    if (tx0 <= 61 && tx1 >= 52) sobrado(c);
  }
  function mixc(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  function rockEdge(c, x, y, dir, tx, ty, top) {
    const A = Z.art;
    for (let i = 0; i < 3; i++) {
      const ry = y + 1 + i * 5.2, rw = 2.6 + A.hash(tx + i, ty) * 1.6;
      A.rr(c, dir > 0 ? x : x - rw, ry, rw, 4.6, 1.2); c.fillStyle = i % 2 ? '#6e5a48' : '#7d6853'; c.fill();
    }
    A.R(c, dir > 0 ? x : x - 0.8, y, 0.8, T, 'rgba(15,8,4,.6)');
    if (top) A.R(c, dir > 0 ? x : x - 2, y - 0.2, 2, 3, '#cfc8bd');
  }
  function masonry(c, x, y, tx, ty) {
    const A = Z.art;
    A.R(c, x, y, T, T, '#5a5048');
    for (let r = 0; r < 4; r++) {
      const off = (r + ty) % 2 ? 0 : 4;
      for (let sx = -off; sx < T; sx += 8) {
        const rx = Math.max(x, x + sx), rw = Math.min(x + T, x + sx + 7.4) - rx; if (rw <= 0.5) continue;
        c.fillStyle = A.lin(c, 0, y + r * 4, 0, y + r * 4 + 3.6, [[0, '#9a8f84'], [1, '#6c635a']]); c.fillRect(rx, y + r * 4 + 0.2, rw, 3.6);
      }
    }
  }
  function balcony(c, x, y, tx) {
    const A = Z.art, R = A.R;
    c.fillStyle = A.lin(c, 0, y, 0, y + 7, [[0, '#f4efe2'], [1, '#bdb29a']]); c.fillRect(x, y, T + 0.05, 7);
    R(c, x, y, T + 0.05, 1, '#ffffff'); R(c, x, y + 7, T + 0.05, 1.2, '#8a8070');
    // mísulas
    if (tx % 2 === 0) { c.fillStyle = '#d8cfba'; c.beginPath(); c.moveTo(x + 4, y + 8); c.lineTo(x + 12, y + 8); c.lineTo(x + 8, y + 15); c.fill(); }
  }
  function crate(c, x, y, tx, ty) {
    const A = Z.art;
    A.rr(c, x + 0.4, y + 0.4, T - 0.8, T - 0.8, 1); c.fillStyle = A.lin(c, x, y, x + T, y + T, [[0, '#c99a5e'], [1, '#8a5e30']]); c.fill();
    c.lineWidth = 0.8; c.strokeStyle = '#4a2e14'; c.stroke();
    for (let i = 1; i < 4; i++) A.R(c, x + 1, y + i * 4, T - 2, 0.6, 'rgba(70,40,15,.55)');
    c.strokeStyle = '#6e4620'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + 2, y + 2); c.lineTo(x + T - 2, y + T - 2); c.stroke();
    A.R(c, x + 1, y + 1, T - 2, 0.6, 'rgba(255,230,180,.5)');
    if (tx < 100) { A.rr(c, x + 4, y + 5, 8, 4, 1); c.fillStyle = (tx + ty) % 2 ? '#2e5d8a' : '#c8323c'; c.fill(); } // etiqueta de mala
  }
  function sobrado(c) {
    const A = Z.art, R = A.R;
    const sx = 52 * T, sw = 9 * T, sb = 15 * T;
    c.fillStyle = A.lin(c, sx, 0, sx + sw, sb, [[0, '#e8875e'], [1, '#c4613f']]); c.fillRect(sx, 0, sw, sb);
    const r = A.rng(52);
    for (let i = 0; i < 500; i++) R(c, sx + r() * sw, r() * sb, 0.6 + r(), 0.5, r() > 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.07)');
    for (const px of [sx, sx + sw - 4]) R(c, px, 0, 4, sb - 30, '#fbe9d0');
    for (let wy = 26; wy < sb - 64; wy += 46) {
      R(c, sx, wy - 10, sw, 2.5, '#fbe9d0');
      for (let i = 0; i < 3; i++) {
        const wx = sx + 22 + i * 42;
        A.window(c, wx, wy, '#2f6f62', '#fbe9d0', (i + wy) % 3 !== 0);
        // sacadinha de ferro
        R(c, wx - 6, wy + 24, 26, 1.2, '#30303c'); for (let k = 0; k < 26; k += 3) R(c, wx - 6 + k, wy + 24, 0.8, 7, '#30303c'); R(c, wx - 6, wy + 30.4, 26, 1.4, '#30303c');
      }
    }
    R(c, sx, sb - 36, sw, 5, '#fbe9d0'); R(c, sx, sb - 36, sw, 0.8, '#fff');
    // toldo listrado com sombreamento
    for (let i = 0; i < sw; i += 12) {
      c.fillStyle = A.lin(c, 0, sb - 31, 0, sb - 7, [[0, '#f0525d'], [1, '#b8303a']]); c.fillRect(sx + i, sb - 31, 6, 24);
      c.fillStyle = A.lin(c, 0, sb - 31, 0, sb - 7, [[0, '#ffffff'], [1, '#d8d2c6']]); c.fillRect(sx + i + 6, sb - 31, 6, 24);
    }
    for (let i = 0; i < sw; i += 12) for (const [o, col] of [[0, '#c8323c'], [6, '#e8e2d6']]) { c.fillStyle = col; c.beginPath(); c.arc(sx + i + o + 3, sb - 7, 3, 0, Math.PI); c.fill(); }
    R(c, sx, sb - 31, sw, 1.5, '#8e1c26');
    c.fillStyle = A.lin(c, 0, sb - 31, 0, sb - 24, [[0, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(sx, sb - 31, sw, 7);
    A.signBoard(c, sx + sw / 2, sb - 56, 'PADARIA', '#3b2414', '#ffe08a');
  }

  // ---------------- cenário (fundo da fase) ----------------
  function paintDecor(c, L, x0, x1) {
    const A = Z.art, R = A.R;
    const gy = row => row * T;
    const D = (a, b, fn) => { if (b >= x0 - 8 && a <= x1 + 8) fn(); };

    // --- Rodoviária ---
    D(180, 420, () => {
      A.house(c, 190, gy(14), 220, 98, { wall: '#efe2bd', sign: 'RODOVIÁRIA', windows: 4, shutter: '#2e5d8a', roofColor: '#9a3f2a' });
      R(c, 200, gy(14) - 42, 200, 6, '#2e5d8a'); R(c, 200, gy(14) - 42, 200, 1, '#5f8fc0');
      // relógio
      c.fillStyle = '#fff'; c.beginPath(); c.arc(300, gy(14) - 106, 7, 0, 7); c.fill(); c.lineWidth = 1; c.strokeStyle = '#2e3d7a'; c.stroke();
      c.beginPath(); c.moveTo(300, gy(14) - 106); c.lineTo(300, gy(14) - 111); c.moveTo(300, gy(14) - 106); c.lineTo(303.5, gy(14) - 105); c.stroke();
    });
    D(420, 640, () => { A.lamp(c, 430, gy(14)); A.ipe(c, 480, gy(14), 1.1); A.house(c, 520, gy(14), 112, 72, { wall: '#d4708f', windows: 2, shutter: '#f2e6c9', trim: '#fff1f6' }); });
    D(10, 190, () => { welcome(c, 96, gy(14)); bus(c, 20, gy(14)); });

    // --- Rua do Comércio ---
    D(640, 830, () => { A.house(c, 650, gy(17), 160, 92, { wall: '#86c17f', sign: 'FARMÁCIA', signBg: '#1f6a3a', shutter: '#f5f0e0', trim: '#f7ffef' }); A.lamp(c, 820, gy(17)); });
    D(832, 980, () => {
      // interior sob a marquise
      c.fillStyle = A.lin(c, 0, gy(15), 0, gy(17), [[0, '#2a1a1a'], [1, '#4a2e28']]); c.fillRect(52 * T, gy(15), 9 * T, 2 * T);
      R(c, 52 * T + 18, gy(15) + 8, 56, 16, '#7a4a2a'); R(c, 52 * T + 18, gy(15) + 8, 56, 2, '#c9a27a');
      for (let i = 0; i < 5; i++) { c.fillStyle = A.rad(c, 52 * T + 26 + i * 10, gy(15) + 5, 0.5, 4.5, [[0, '#ffd78a'], [1, '#c98a3a']]); c.beginPath(); c.arc(52 * T + 26 + i * 10, gy(15) + 5, 4.2, 0, 7); c.fill(); }
      R(c, 52 * T + 96, gy(15) + 2, 30, 30, '#3a2424'); R(c, 52 * T + 99, gy(15) + 6, 24, 10, '#ffcf8a');
    });
    D(980, 1200, () => { A.house(c, 985, gy(17), 200, 98, { wall: '#efcb4c', sign: 'MERCEARIA', signBg: '#8a3a2a', shutter: '#2f6f9a', windows: 4 }); A.lamp(c, 1192, gy(17)); });
    D(640, 1200, () => A.bunting(c, 640, 1200, gy(17) - 132, 16));

    // --- Praça do Coreto ---
    const pg = gy(20);
    D(1200, 1780, () => {
      A.ipe(c, 1250, pg, 1.3); A.ipe(c, 1720, pg, 1.2, '#f07ab0');
      A.bush(c, 1300, pg, 60); A.bush(c, 1610, pg, 70);
      A.bench(c, 1370, pg, false, 0); A.bench(c, 1600, pg, false, 0);
      A.lamp(c, 1330, pg); A.lamp(c, 1650, pg);
      coreto(c, 1480, pg);
      A.bunting(c, 1390, 1570, pg - 124, 10);
    });

    // --- Avenida Central ---
    const cg = gy(22);
    D(1770, 2240, () => {
      A.house(c, 1775, cg, 140, 86, { wall: '#6cb3aa', sign: 'BAR DO ZÉ', signBg: '#6b3f28', shutter: '#f2e6c9', posters: [10, 112] });
      A.house(c, 1930, cg, 150, 98, { wall: '#eee6d4', shutter: '#8a3a2a', posters: [12, 42, 122], windows: 3 });
      A.house(c, 2095, cg, 140, 82, { wall: '#e07d55', shutter: '#2f6f62', trim: '#fbe9d0', posters: [104] });
    });
    D(2240, 2560, () => {
      A.ipe(c, 2290, cg, 1.2); A.lamp(c, 2330, cg); A.lamp(c, 2420, cg);
      A.house(c, 2440, cg, 112, 76, { wall: '#86b0e0', shutter: '#f5f0e0', door: false, windows: 2 });
    });
    // porão secreto
    D(2400, 2545, () => {
      c.fillStyle = A.lin(c, 0, gy(23), 0, gy(28), [[0, '#241818'], [1, '#3e2a2a']]); c.fillRect(150 * T, gy(23), 9 * T, 5 * T);
      for (let y = gy(23); y < gy(28); y += 8) for (let x = 150 * T + ((y / 8) % 2) * 8; x < 159 * T; x += 16) { A.rr(c, x + 0.5, y + 0.5, 15, 7, 1); c.fillStyle = 'rgba(120,80,70,.35)'; c.fill(); }
      crate(c, 150 * T + 20, gy(28) - 16, 1, 1); crate(c, 150 * T + 36, gy(28) - 16, 2, 1); crate(c, 150 * T + 28, gy(28) - 32, 3, 2);
      c.fillStyle = A.rad(c, 154 * T + 8, gy(26), 2, 40, [[0, 'rgba(255,200,120,.25)'], [1, 'rgba(255,200,120,0)']]); c.fillRect(150 * T, gy(23), 9 * T, 5 * T);
    });

    // --- Córrego ---
    const rg = gy(28);
    D(2560, 3220, () => {
      for (let y = gy(22); y < rg; y += 9) for (let x = 2560; x < 2640; x += 13) { A.rr(c, x + ((y / 9) % 2) * 6, y, 12, 8, 2); c.fillStyle = 'rgba(110,95,80,.35)'; c.fill(); }
      A.fence(c, 2580, 2700, rg); A.bush(c, 2760, rg, 60); A.ipe(c, 2650, rg, 1.4);
      A.ipe(c, 2900, rg, 1.1, '#f07ab0'); A.fence(c, 3140, 3200, rg);
      for (let i = 0; i < 10; i++) { c.fillStyle = A.lin(c, 0, gy(29) - 3, 0, gy(29) + 6, [[0, '#8a909a'], [1, '#55585f']]); c.beginPath(); c.ellipse(185 * T + i * 16 + 8, gy(29) + 2, 6, 4, 0, 0, 7); c.fill(); }
    });

    // --- Igreja Matriz ---
    D(3190, 3600, () => igreja(c, 3200, rg));
    D(3600, 3760, () => { A.lamp(c, 3640, rg); A.ipe(c, 3690, rg, 1.2); });

    // --- Prefeitura ---
    D(3860, 4544, () => { prefeitura(c, 3880, rg); A.bunting(c, 3870, 4500, rg - 142, 10); });
  }

  // placa de boas-vindas da cidade
  function welcome(c, cx, by) {
    const A = Z.art, R = A.R;
    for (const px of [cx - 70, cx + 66]) { c.fillStyle = A.lin(c, px, 0, px + 4, 0, [[0, '#8a8a96'], [1, '#55555f']]); c.fillRect(px, by - 112, 4, 112); }
    A.rr(c, cx - 78, by - 132, 156, 36, 4); c.fillStyle = A.lin(c, 0, by - 132, 0, by - 96, [[0, '#2f8f4e'], [1, '#1d6a36']]); c.fill();
    c.lineWidth = 1.4; c.strokeStyle = '#f6f1e6'; A.rr(c, cx - 75, by - 129, 150, 30, 3); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = '#fff';
    c.font = `400 6px ${Z.FONT}`; c.fillText('BEM-VINDO A', cx, by - 125);
    c.font = `400 7px ${Z.FONT}`; c.fillText('CAPITÃO LEÔNIDAS', cx, by - 116.5);
    c.fillText('MARQUES', cx, by - 107.5);
  }
  function bus(c, bx, by) {
    const A = Z.art, R = A.R;
    A.rr(c, bx, by - 60, 152, 50, 5); c.fillStyle = A.lin(c, 0, by - 60, 0, by - 10, [[0, '#f6f1e2'], [1, '#cfc6ae']]); c.fill(); c.lineWidth = 1; c.strokeStyle = '#2a2a36'; c.stroke();
    R(c, bx, by - 36, 152, 11, '#2e5d8a'); R(c, bx, by - 36, 152, 1.2, '#6b9bd0'); R(c, bx, by - 27, 152, 2, '#e9c46a');
    for (let i = 0; i < 6; i++) {
      A.rr(c, bx + 8 + i * 22.5, by - 54, 18, 14, 1.5); c.fillStyle = A.lin(c, 0, by - 54, 0, by - 40, [[0, '#cfe8ff'], [1, '#5f8fc0']]); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(bx + 10 + i * 22.5, by - 40); c.lineTo(bx + 16 + i * 22.5, by - 54); c.lineTo(bx + 19 + i * 22.5, by - 54); c.lineTo(bx + 13 + i * 22.5, by - 40); c.fill();
    }
    A.rr(c, bx + 136, by - 54, 13, 32, 1.5); c.fillStyle = A.lin(c, 0, by - 54, 0, by - 22, [[0, '#cfe8ff'], [1, '#5f8fc0']]); c.fill();
    R(c, bx + 148, by - 22, 4, 4, '#ffe9a8');
    R(c, bx, by - 15, 152, 4, '#3a3a44');
    for (const wx of [bx + 28, bx + 120]) {
      c.fillStyle = '#1a1a22'; c.beginPath(); c.arc(wx, by - 8, 9, 0, 7); c.fill();
      c.fillStyle = A.rad(c, wx, by - 8, 1, 5, [[0, '#e0e0e8'], [1, '#7a7a88']]); c.beginPath(); c.arc(wx, by - 8, 4.5, 0, 7); c.fill();
    }
    c.font = `400 7px ${Z.FONT}`; c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('VIAÇÃO AZUL', bx + 10, by - 33.5);
  }
  function coreto(c, x, by) {
    const A = Z.art, R = A.R;
    R(c, x - 84, by - 16, 168, 16, '#e9e1cf'); R(c, x - 84, by - 16, 168, 1.2, '#fff'); R(c, x - 84, by - 4, 168, 4, '#b8ad96');
    for (let i = -82; i < 82; i += 9) R(c, x + i, by - 12, 7, 6, '#d6ccb6');
    for (let i = -3; i <= 3; i++) { c.fillStyle = A.lin(c, x + i * 24 - 2.5, 0, x + i * 24 + 2.5, 0, [[0, '#ffffff'], [1, '#cfc7b6']]); c.fillRect(x + i * 24 - 2.5, by - 82, 5, 66); }
    R(c, x - 82, by - 42, 164, 2.5, '#e6dccb');
    for (let i = -78; i < 78; i += 5) R(c, x + i, by - 40, 1.4, 24, '#e6dccb');
    c.fillStyle = A.lin(c, 0, by - 126, 0, by - 82, [[0, '#2f7f70'], [1, '#225a50']]); c.beginPath(); c.moveTo(x - 96, by - 82); c.lineTo(x, by - 126); c.lineTo(x + 96, by - 82); c.fill();
    for (let k = -88; k < 88; k += 8) { c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, by - 126); c.lineTo(x + k, by - 83); c.stroke(); }
    R(c, x - 96, by - 84, 192, 4, '#1b4a42');
    for (let i = -92; i < 92; i += 6) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x + i + 3, by - 80, 2.6, 0, Math.PI); c.fill(); }
    R(c, x - 1, by - 140, 2.5, 16, '#e6c35a'); c.fillStyle = '#e6c35a'; c.beginPath(); c.arc(x + 0.2, by - 141, 2.6, 0, 7); c.fill();
  }
  function igreja(c, x, by) {
    const A = Z.art, R = A.R;
    A.house(c, x, by, 380, 114, { wall: '#f6f1e4', roof: false, door: false, windows: 0 });
    // frontões
    c.fillStyle = A.lin(c, 0, by - 154, 0, by - 114, [[0, '#ffffff'], [1, '#ebe4d2']]);
    c.beginPath(); c.moveTo(x, by - 114); c.lineTo(x + 70, by - 154); c.lineTo(x + 150, by - 154); c.lineTo(x + 150, by - 114); c.fill();
    c.beginPath(); c.moveTo(x + 230, by - 114); c.lineTo(x + 230, by - 154); c.lineTo(x + 310, by - 154); c.lineTo(x + 380, by - 114); c.fill();
    R(c, x, by - 116, 380, 3, '#d8cfba');
    // torre
    c.fillStyle = A.lin(c, x + 150, 0, x + 230, 0, [[0, '#ffffff'], [1, '#ddd4c0']]); c.fillRect(x + 150, by - 234, 80, 234);
    for (const yy of [by - 234, by - 160]) { R(c, x + 146, yy, 88, 5, '#fffaf0'); R(c, x + 146, yy + 5, 88, 1, '#c9bfa8'); }
    c.fillStyle = A.lin(c, 0, by - 288, 0, by - 234, [[0, '#7aa0d0'], [1, '#4a70a8']]); c.beginPath(); c.moveTo(x + 144, by - 234); c.lineTo(x + 190, by - 288); c.lineTo(x + 236, by - 234); c.fill();
    R(c, x + 189, by - 310, 3, 24, '#e6c35a'); R(c, x + 181.5, by - 302, 18, 3, '#e6c35a');
    c.fillStyle = '#2e2438'; c.beginPath(); c.arc(x + 190, by - 194, 15, Math.PI, 0); c.fill(); R(c, x + 175, by - 194, 30, 22, '#2e2438');
    c.fillStyle = A.rad(c, x + 188, by - 186, 1, 9, [[0, '#ffe9a0'], [1, '#c09030']]); c.beginPath(); c.arc(x + 190, by - 184, 8, Math.PI, 0); c.lineTo(x + 198, by - 178); c.lineTo(x + 182, by - 178); c.fill();
    // relógio da torre
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 190, by - 150, 10, 0, 7); c.fill(); c.lineWidth = 1.2; c.strokeStyle = '#4a70a8'; c.stroke();
    c.beginPath(); c.moveTo(x + 190, by - 150); c.lineTo(x + 190, by - 157); c.moveTo(x + 190, by - 150); c.lineTo(x + 195, by - 148); c.strokeStyle = '#222'; c.stroke();
    // porta principal
    c.fillStyle = A.lin(c, x + 170, 0, x + 210, 0, [[0, '#7a4a2e'], [1, '#4e2c18']]); c.fillRect(x + 170, by - 62, 40, 62);
    c.beginPath(); c.arc(x + 190, by - 62, 20, Math.PI, 0); c.fill();
    R(c, x + 189.4, by - 80, 1.2, 80, '#2e1a0e');
    c.lineWidth = 2; c.strokeStyle = '#e6dccb'; c.beginPath(); c.arc(x + 190, by - 62, 22, Math.PI, 0); c.stroke();
    // vitrais
    for (const wx of [x + 40, x + 100, x + 270, x + 330]) {
      c.fillStyle = A.lin(c, 0, by - 100, 0, by - 62, [[0, '#ffd166'], [0.5, '#4a70a8'], [1, '#c8323c']]);
      c.beginPath(); c.moveTo(wx - 8, by - 62); c.lineTo(wx - 8, by - 94); c.arc(wx, by - 94, 8, Math.PI, 0); c.lineTo(wx + 8, by - 62); c.fill();
      c.lineWidth = 1.5; c.strokeStyle = '#e6dccb'; c.stroke(); R(c, wx - 0.6, by - 100, 1.2, 38, '#e6dccb'); R(c, wx - 8, by - 80, 16, 1.2, '#e6dccb');
    }
    R(c, x, by - 10, 380, 10, '#4a70a8'); R(c, x, by - 10, 380, 1, '#7aa0d0');
    // sacada (onde fica o baú)
    R(c, 210 * T - 4, by - 116, 7 * T + 8, 2, '#c9bfa8');
    c.font = `400 8px ${Z.FONT}`; c.fillStyle = '#4a70a8'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('IGREJA', x + 92, by - 140); c.fillText('MATRIZ', x + 300, by - 140);
  }
  function prefeitura(c, x, by) {
    const A = Z.art, R = A.R;
    A.house(c, x, by, 620, 152, { wall: '#f1e2b8', roofColor: '#9a3f2a', door: false, windows: 0 });
    for (let i = 0; i < 8; i++) {
      const cx = x + 40 + i * 76;
      c.fillStyle = A.lin(c, cx, 0, cx + 12, 0, [[0, '#ffffff'], [0.5, '#fff6dc'], [1, '#d8c9a2']]); c.fillRect(cx, by - 140, 12, 128);
      R(c, cx - 3, by - 143, 18, 4, '#e6d6b0'); R(c, cx - 3, by - 14, 18, 4, '#e6d6b0');
      for (let k = 2; k < 12; k += 3) R(c, cx + k, by - 138, 0.6, 124, 'rgba(160,140,100,.25)');
    }
    for (let i = 0; i < 7; i++) {
      const wx = x + 66 + i * 76;
      A.window(c, wx + 7, by - 118, '#2f6f62', '#fff8ea', i % 2 === 0);
    }
    c.fillStyle = A.lin(c, 0, by - 236, 0, by - 146, [[0, '#fff3cf'], [1, '#e8d6a8']]);
    c.fillRect(x + 160, by - 198, 300, 52);
    c.beginPath(); c.moveTo(x + 148, by - 198); c.lineTo(x + 310, by - 236); c.lineTo(x + 472, by - 198); c.fill();
    R(c, x + 148, by - 200, 324, 3, '#fffaf0'); R(c, x + 148, by - 197, 324, 1, '#c9b88f');
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 310, by - 214, 8, 0, 7); c.fill(); c.lineWidth = 1; c.strokeStyle = '#9a3f2a'; c.stroke();
    c.font = `400 8px ${Z.FONT}`; c.fillStyle = '#6b3f28'; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText('PREFEITURA MUNICIPAL', x + 310, by - 188);
    c.font = `400 6.5px ${Z.FONT}`; c.fillStyle = '#2e5d8a'; c.fillText('CAPITÃO LEÔNIDAS MARQUES', x + 310, by - 175);
    c.font = `400 5px ${Z.FONT}`; c.fillStyle = '#9a3f2a'; c.fillText('ADM. CORONEL BIGODÃO (DESDE 1985)', x + 310, by - 162);
    // escadaria
    for (let k = 0; k < 3; k++) R(c, x + 230 - k * 8, by - 4 - k * 0, 160 + k * 16, 0, '#ccc');
    // mastro e bandeira
    R(c, x + 590, by - 262, 3, 262, '#8a8a96'); R(c, x + 590, by - 262, 1, 262, '#c4c4d0');
    c.fillStyle = A.lin(c, x + 593, 0, x + 625, 0, [[0, '#2a9d4a'], [1, '#1f7a38']]);
    c.beginPath(); c.moveTo(x + 593, by - 260); c.quadraticCurveTo(x + 609, by - 254, x + 625, by - 260); c.lineTo(x + 625, by - 238); c.quadraticCurveTo(x + 609, by - 232, x + 593, by - 238); c.fill();
    c.fillStyle = '#e9c46a'; c.beginPath(); c.moveTo(x + 609, by - 256); c.lineTo(x + 620, by - 249); c.lineTo(x + 609, by - 242); c.lineTo(x + 598, by - 249); c.fill();
    c.fillStyle = '#2e5d8a'; c.beginPath(); c.arc(x + 609, by - 249, 3.5, 0, 7); c.fill();
  }

  // ---------------- tiles dinâmicos ----------------
  function drawDynamic(ctx, L, cam, t) {
    const A = Z.art, R = A.R;
    // água do córrego
    const wx = 185 * T - cam.x, wy = 29 * T - cam.y;
    if (wx < Z.W && wx + 160 > 0) {
      ctx.fillStyle = A.lin(ctx, 0, wy, 0, wy + 2 * T, [[0, 'rgba(110,185,220,.92)'], [1, 'rgba(30,70,110,.95)']]); ctx.fillRect(wx, wy + 3, 10 * T, 2 * T - 3);
      ctx.strokeStyle = 'rgba(220,245,255,.85)'; ctx.lineWidth = 0.9; ctx.beginPath();
      for (let i = 0; i <= 10 * T; i += 2) { const yy = wy + 3 + Math.sin(t * 3 + i * 0.18) * 1.2; i ? ctx.lineTo(wx + i, yy) : ctx.moveTo(wx + i, yy); } ctx.stroke();
      for (let k = 0; k < 7; k++) { const sx = wx + ((k * 37 + t * 14) % 160), sy = wy + 10 + (k % 3) * 6; R(ctx, sx, sy, 6, 0.7, 'rgba(255,255,255,.4)'); }
    }
    // ponte
    const b = L.bridge;
    const plank = (px, py, w, h) => { ctx.fillStyle = A.lin(ctx, 0, py, 0, py + h, [[0, '#b07a42'], [1, '#6e4420']]); ctx.fillRect(px, py, w, h); R(ctx, px, py, w, 0.7, '#d8a46a'); };
    if (b.lowered) {
      const len = (b.tx1 - b.tx0 + 1) * T, ang = (1 - easeOut(b.anim)) * Math.PI / 2;
      ctx.save(); ctx.translate((b.tx1 + 1) * T - cam.x, b.ty * T - cam.y); ctx.rotate(ang);
      for (let i = 0; i < len; i += 8) plank(-i - 8, 0, 7.4, 7);
      R(ctx, -len, 2.5, len, 1.6, '#4a2e14');
      ctx.restore();
      if (b.anim >= 1) { ctx.strokeStyle = '#6a5a40'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(b.tx0 * T - cam.x, b.ty * T - cam.y - 14); ctx.quadraticCurveTo((b.tx0 + 5) * T - cam.x, b.ty * T - cam.y - 6, (b.tx1 + 1) * T - cam.x, b.ty * T - cam.y - 14); ctx.stroke(); }
    } else {
      const x0 = (b.tx1 + 1) * T - cam.x - 8, y0 = b.ty * T - cam.y;
      for (let i = 0; i < 10 * T; i += 8) plank(x0, y0 - i - 8, 7, 7.4);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x0 + 3, y0 - 160); ctx.lineTo(x0 + 30, y0 - 40); ctx.stroke();
    }
    // muro rachado
    const w = L.wall;
    if (w.hp > 0) {
      const sh = w.shake > 0 ? Z.rand(-1, 1) : 0;
      for (let ty = w.ty0; ty <= w.ty1; ty++) {
        const x = w.tx * T - cam.x + sh, y = ty * T - cam.y;
        ctx.fillStyle = A.lin(ctx, 0, y, 0, y + T, [[0, '#6c4b34'], [1, '#56392a']]); ctx.fillRect(x, y, T, T);
        for (let r = 0; r < 3; r++) { A.rr(ctx, x + 1 + (r % 2) * 3, y + 1 + r * 5, 11, 4, 1); ctx.fillStyle = 'rgba(150,120,95,.35)'; ctx.fill(); }
        ctx.strokeStyle = '#1e120a'; ctx.lineWidth = 0.7; ctx.beginPath();
        if (ty % 2 === 0) { ctx.moveTo(x + 6, y); ctx.lineTo(x + 8, y + 6); ctx.lineTo(x + 6.5, y + 16); } else { ctx.moveTo(x + 10, y); ctx.lineTo(x + 9, y + 9); ctx.lineTo(x + 11, y + 16); }
        if (w.hp < 3) { ctx.moveTo(x + 2, y + 7); ctx.lineTo(x + 8, y + 9); ctx.lineTo(x + 14, y + 6); }
        if (w.hp < 2) { ctx.moveTo(x + 3, y + 13); ctx.lineTo(x + 12, y + 12); }
        ctx.stroke();
      }
    }
    // portão da arena
    const g = L.gate;
    if (g.closed) {
      const h = (g.ty1 - g.ty0 + 1) * T, drop = (1 - easeOut(g.anim)) * h;
      const x = g.tx * T - cam.x, y = g.ty0 * T - cam.y - drop;
      for (let i = 0; i < T; i += 5) { ctx.fillStyle = A.lin(ctx, x + i, 0, x + i + 3, 0, [[0, '#6a6a7c'], [1, '#2a2a36']]); ctx.fillRect(x + i, y, 3, h); }
      for (let j = 6; j < h; j += 18) { R(ctx, x, y + j, T, 3, '#4a4a5a'); R(ctx, x, y + j, T, 0.7, '#8a8a9c'); }
      for (let i = 0; i < T; i += 5) { ctx.fillStyle = '#9a9aac'; ctx.beginPath(); ctx.moveTo(x + i, y + h - 4); ctx.lineTo(x + i + 1.5, y + h); ctx.lineTo(x + i + 3, y + h - 4); ctx.fill(); }
    }
  }
  const easeOut = k => 1 - Math.pow(1 - k, 3);
})();
