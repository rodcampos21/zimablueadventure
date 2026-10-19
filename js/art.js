// Arte procedural em alta definição: céu, parallax, casario do interior, inimigos, chefe e objetos.
// Tudo é desenhado em unidades do mundo; o canvas já vem escalado para a resolução real da tela.
'use strict';
(() => {
  const A = Z.art = {};
  const OUT = '#1d1426';                               // cor do contorno dos personagens

  // ---------------- utilitários ----------------
  const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  A.R = R;
  A.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  A.rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  A.hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = n >> 8 & 255, b = n & 255;
    const f = v => Math.round(Z.clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255));
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }
  A.shade = shade;
  const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
  const rad = (c, x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
  A.lin = lin; A.rad = rad;
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  A.rr = rr;
  const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2); };
  // preenche e contorna o caminho atual
  const fs = (c, fill, lw = 0.9, stroke = OUT) => { c.fillStyle = fill; c.fill(); if (lw) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); } };

  // ---------------- céu ----------------
  A.drawSky = (ctx, t, cam) => {
    ctx.fillStyle = lin(ctx, 0, 0, 0, Z.H, [[0, '#2c4a94'], [0.32, '#6b79bd'], [0.58, '#e3a1a4'], [0.8, '#ffd29a'], [1, '#fff1cf']]);
    ctx.fillRect(0, 0, Z.W, Z.H);
    const sx = 470 - (cam ? cam.x * 0.01 % 40 : 0), sy = 205 - (cam ? cam.y * 0.05 : 0);
    ctx.fillStyle = rad(ctx, sx, sy, 0, 220, [[0, 'rgba(255,240,200,.75)'], [0.15, 'rgba(255,214,150,.4)'], [1, 'rgba(255,190,140,0)']]);
    ctx.fillRect(0, 0, Z.W, Z.H);
    // raios de sol
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = -2.6 + i * 0.36 + Math.sin(t * 0.15 + i) * 0.03;
      ctx.fillStyle = `rgba(255,225,170,${0.05 + (i % 2) * 0.03})`;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - 0.06) * 700, sy + Math.sin(a - 0.06) * 700);
      ctx.lineTo(sx + Math.cos(a + 0.06) * 700, sy + Math.sin(a + 0.06) * 700); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = rad(ctx, sx, sy, 0, 26, [[0, '#fffdf2'], [0.7, '#fff2c4'], [1, 'rgba(255,230,170,0)']]);
    ctx.beginPath(); ctx.arc(sx, sy, 26, 0, 7); ctx.fill();
    // passarinhos distantes
    ctx.strokeStyle = 'rgba(60,40,80,.55)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      const bx = ((t * (9 + i * 2) + i * 140) % 760) - 60, by = 60 + i * 13 + Math.sin(t + i) * 4, f = Math.sin(t * 8 + i) * 1.5;
      ctx.beginPath(); ctx.moveTo(bx - 3, by - f); ctx.quadraticCurveTo(bx - 1, by - 1, bx, by); ctx.quadraticCurveTo(bx + 1, by - 1, bx + 3, by - f); ctx.stroke();
    }
  };

  // ---------------- camadas de parallax (renderizadas na resolução da tela) ----------------
  A.buildLayers = Rz => {
    const L = { R: Rz };
    const W = 1280;
    const mk = (h, fn) => { const cv = A.canvas(W * Rz, h * Rz), c = cv.getContext('2d'); c.scale(Rz, Rz); fn(c); return cv; };
    L.clouds = mk(130, c => {
      const r = A.rng(7);
      for (let i = 0; i < 10; i++) { const x = r() * W, y = 18 + r() * 80, s = 0.55 + r() * 1.0; for (const dx of [-W, 0, W]) cloud(c, x + dx, y, s); }
    });
    L.mountains = mk(200, c => {
      ridge(c, W, 200, 120, [[2, 26], [5, 12], [13, 5]], 3, lin(c, 0, 60, 0, 200, [[0, '#8a87bd'], [1, '#b6a3c8']]));
      ridge(c, W, 200, 88, [[3, 18], [7, 9], [17, 3]], 11, lin(c, 0, 90, 0, 200, [[0, '#9a90bf'], [1, '#c9acc2']]));
      // neblina
      c.fillStyle = lin(c, 0, 120, 0, 200, [[0, 'rgba(255,215,190,0)'], [1, 'rgba(255,215,190,.55)']]); c.fillRect(0, 120, W, 80);
    });
    L.hills = mk(200, c => {
      const top = x => { const a = 2 * Math.PI * x / W; return 200 - (78 + Math.sin(a * 3 + 2) * 20 + Math.sin(a * 7) * 8 + Math.sin(a * 13 + 1) * 3); };
      c.beginPath(); c.moveTo(0, 200); for (let x = 0; x <= W; x += 2) c.lineTo(x, top(x)); c.lineTo(W, 200); c.closePath();
      c.fillStyle = lin(c, 0, 100, 0, 200, [[0, '#7fae68'], [1, '#55834a']]); c.fill();
      // faixas de pasto
      for (let k = 0; k < 4; k++) {
        c.strokeStyle = `rgba(255,255,200,${0.06 + k * 0.02})`; c.lineWidth = 1.2; c.beginPath();
        for (let x = 0; x <= W; x += 4) { const y = top(x) + 14 + k * 16 + Math.sin(x * 0.02 + k) * 3; x === 0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
      }
      const r = A.rng(3);
      for (let i = 0; i < 30; i++) { // árvores
        const x = r() * W, y = top(x) + 4 + r() * 10, s = 0.6 + r() * 0.6;
        R(c, x - 0.6 * s, y - 8 * s, 1.2 * s, 8 * s, '#4a3a30');
        ell(c, x, y - 11 * s, 6 * s, 5 * s); c.fillStyle = '#4c7a45'; c.fill();
        ell(c, x - 1.5 * s, y - 12.5 * s, 3.5 * s, 2.8 * s); c.fillStyle = '#6e9e5a'; c.fill();
      }
      for (let i = 0; i < 6; i++) { // casinhas de fazenda
        const x = r() * W, y = top(x) + 10;
        R(c, x, y - 7, 12, 7, '#f1e8da'); c.fillStyle = '#b5523a'; c.beginPath(); c.moveTo(x - 1.5, y - 7); c.lineTo(x + 6, y - 12); c.lineTo(x + 13.5, y - 7); c.fill();
        R(c, x + 5, y - 4, 2, 4, '#7a4a32');
      }
      for (let i = 0; i < 14; i++) { const x = r() * W, y = top(x) + 20 + r() * 20; ell(c, x, y, 1.8, 1.1); c.fillStyle = r() > 0.5 ? '#fff' : '#d8c7b0'; c.fill(); } // vaquinhas
    });
    L.town = mk(170, c => {
      const r = A.rng(11);
      let x = 0;
      while (x < W) {
        const w = 30 + r() * 46, h = 30 + r() * 38, col = ['#c79285', '#bd8a86', '#d29f8c', '#b8858c'][Math.floor(r() * 4)];
        c.fillStyle = lin(c, 0, 170 - h, 0, 170, [[0, col], [1, shade(col, -0.12)]]); c.fillRect(x, 170 - h, w, h);
        c.fillStyle = '#a5675d'; c.beginPath(); c.moveTo(x - 3, 170 - h); c.lineTo(x + w / 2, 170 - h - 11); c.lineTo(x + w + 3, 170 - h); c.fill();
        for (let wy = 170 - h + 8; wy < 158; wy += 13) for (let wx = x + 6; wx < x + w - 8; wx += 11) if (r() > 0.4) { R(c, wx, wy, 4, 6, r() > 0.3 ? '#ffd98f' : '#8d6a78'); }
        if (r() > 0.7) { const px = x + w + 4; palm(c, px, 170, 46); }
        x += w + r() * 10;
      }
      // torre distante e fios de poste
      c.fillStyle = '#b07c7e'; c.fillRect(300, 66, 22, 104); c.beginPath(); c.moveTo(296, 66); c.lineTo(311, 38); c.lineTo(326, 66); c.fill();
      R(c, 310, 24, 2, 16, '#9b6a70'); R(c, 305, 29, 12, 2, '#9b6a70');
      c.fillStyle = lin(c, 0, 90, 0, 170, [[0, 'rgba(255,214,170,0)'], [1, 'rgba(255,214,170,.42)']]); c.fillRect(0, 90, W, 80);
    });
    return L;
  };
  function ridge(c, W, H, base, waves, seed, fill) {
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 2) {
      const a = 2 * Math.PI * x / W; let h = base;
      waves.forEach(([f, amp], i) => { h += Math.sin(a * f + seed + i) * amp; });
      c.lineTo(x, H - h);
    }
    c.lineTo(W, H); c.closePath(); c.fillStyle = fill; c.fill();
  }
  function palm(c, x, by, h) {
    c.strokeStyle = '#8f6a62'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, by); c.quadraticCurveTo(x + 4, by - h / 2, x + 1, by - h); c.stroke();
    c.strokeStyle = '#7f9a6c'; c.lineWidth = 1.6;
    for (let k = 0; k < 6; k++) { const a = k * 1.05; c.beginPath(); c.moveTo(x + 1, by - h); c.quadraticCurveTo(x + 1 + Math.cos(a) * 10, by - h - 8, x + 1 + Math.cos(a) * 17, by - h + 4); c.stroke(); }
  }
  function cloud(c, x, y, s) {
    const parts = [[0, 0, 15], [15, -7, 17], [32, -1, 14], [-13, 4, 10], [45, 5, 10], [22, 6, 13]];
    c.fillStyle = lin(c, 0, y - 24 * s, 0, y + 16 * s, [[0, 'rgba(255,250,246,.95)'], [0.6, 'rgba(255,226,222,.92)'], [1, 'rgba(232,170,180,.85)']]);
    for (const [dx, dy, r] of parts) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.55)';
    for (const [dx, dy, r] of parts.slice(0, 3)) { c.beginPath(); c.arc(x + dx * s - r * s * 0.25, y + dy * s - r * s * 0.35, r * s * 0.5, 0, 7); c.fill(); }
  }
  A.drawLayer = (ctx, img, R, cam, fx, fy, baseY) => {
    const w = img.width / R, h = img.height / R;
    let ox = -((cam.x * fx) % w); if (ox > 0) ox -= w;
    const y = Z.snap(baseY - cam.y * fy);
    for (let x = ox; x < Z.W; x += w) ctx.drawImage(img, Z.snap(x), y, w + 0.5 / Z.S, h);
  };

  // ---------------- casario ----------------
  A.house = (c, x, by, w, h, o = {}) => {
    const wall = o.wall || '#e9dcc0', trim = o.trim || '#fff8ea', base = o.base || shade(wall, -0.28);
    const top = by - h;
    // parede com luz vinda da esquerda/alto
    c.fillStyle = lin(c, x, top, x + w, by, [[0, shade(wall, 0.1)], [0.6, wall], [1, shade(wall, -0.1)]]);
    c.fillRect(x, top, w, h);
    const r = A.rng(Math.floor(x * 13 + h));
    for (let i = 0; i < w * h / 26; i++) R(c, x + r() * w, top + r() * h, 0.6 + r(), 0.5, r() > 0.5 ? shade(wall, -0.07) : shade(wall, 0.07));
    // manchas de umidade perto do chão
    c.fillStyle = lin(c, 0, by - 26, 0, by - 10, [[0, 'rgba(80,60,40,0)'], [1, 'rgba(80,60,40,.12)']]); c.fillRect(x, by - 26, w, 16);
    // barrado
    R(c, x, by - 10, w, 10, base); R(c, x, by - 10.5, w, 1.2, shade(base, 0.2)); R(c, x, by - 1.5, w, 1.5, shade(base, -0.25));
    // cunhais (pilastras de canto)
    for (const px of [x, x + w - 4]) { R(c, px, top + 4, 4, h - 14, shade(trim, -0.04)); R(c, px + (px === x ? 3.4 : 0), top + 4, 0.6, h - 14, shade(trim, -0.25)); }
    // cornija
    R(c, x - 2.5, top, w + 5, 5, trim); R(c, x - 2.5, top, w + 5, 0.8, '#ffffff'); R(c, x - 2.5, top + 5, w + 5, 1, shade(wall, -0.35));
    c.fillStyle = lin(c, 0, top + 6, 0, top + 14, [[0, 'rgba(40,20,20,.22)'], [1, 'rgba(40,20,20,0)']]); c.fillRect(x, top + 6, w, 8);
    if (o.roof !== false) A.roof(c, x - 6, top, w + 12, 16, o.roofColor || '#b8502f');
    // janelas
    const nw = o.windows !== undefined ? o.windows : Math.max(1, Math.floor((w - 20) / 30));
    const floors = o.floors || 1;
    for (let f = 0; f < floors; f++) {
      const wy = top + 15 + f * 40;
      for (let i = 0; i < nw; i++) {
        const wx = x + (w / (nw + 1)) * (i + 1) - 7;
        if (o.door !== false && Math.abs(wx + 7 - (x + w / 2)) < 15) continue;
        A.window(c, wx, wy, o.shutter || '#2f7a62', trim, r() > 0.45);
      }
    }
    if (o.door !== false) A.door(c, x + w / 2 - 8, by, o.doorColor || '#6b3f28', trim);
    if (o.sign) A.signBoard(c, x + w / 2, top + (o.signY || 5) + 2, o.sign, o.signBg || '#2e3d7a', o.signFg || '#fff');
    if (o.posters) for (const px of o.posters) A.poster(c, x + px, by - 40);
  };
  A.roof = (c, x, y, w, h, col) => {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 13, y - h); c.lineTo(x + w - 13, y - h); c.lineTo(x + w, y); c.closePath();
    c.fillStyle = lin(c, 0, y - h, 0, y, [[0, shade(col, -0.15)], [1, col]]); c.fill();
    c.save(); c.clip();
    for (let row = 0, yy = y - h + 2; yy < y + 2; yy += 3.6, row++) {
      for (let xx = x - 4 + (row % 2) * 2.5; xx < x + w + 4; xx += 5) {
        c.fillStyle = shade(col, 0.12); c.beginPath(); c.arc(xx + 2.5, yy, 2.4, Math.PI, 0); c.fill();
        R(c, xx + 1, yy - 1.6, 1.4, 0.6, shade(col, 0.35));
      }
      R(c, x, yy + 0.5, w, 0.7, shade(col, -0.3));
    }
    c.restore();
    R(c, x + 12, y - h - 1.5, w - 24, 2.2, shade(col, -0.25)); R(c, x + 12, y - h - 1.5, w - 24, 0.7, shade(col, 0.3));
    R(c, x - 1, y - 1, w + 2, 2.2, shade(col, -0.35));
  };
  A.window = (c, x, y, sh, trim, open) => {
    R(c, x - 2.5, y - 2.5, 19, 23.5, trim); R(c, x - 2.5, y - 2.5, 19, 0.7, '#ffffff');
    c.fillStyle = lin(c, x, y, x + 14, y + 18, [[0, '#9fc3e8'], [0.45, '#3a3550'], [1, '#2a2238']]); c.fillRect(x, y, 14, 18);
    if (open) { c.fillStyle = 'rgba(255,214,140,.75)'; c.fillRect(x + 1, y + 6, 12, 11); }
    c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.moveTo(x + 2, y + 18); c.lineTo(x + 7, y); c.lineTo(x + 10, y); c.lineTo(x + 5, y + 18); c.fill();
    R(c, x + 6.6, y, 0.8, 18, trim); R(c, x, y + 8.6, 14, 0.8, trim);
    for (const sx of [x - 7, x + 14]) {
      R(c, sx, y, 7, 18, sh); R(c, sx, y, 7, 0.6, shade(sh, 0.3));
      for (let k = 2; k < 18; k += 2.2) R(c, sx + 0.8, y + k, 5.4, 0.7, shade(sh, -0.35));
      R(c, sx + (sx < x ? 6.3 : 0), y, 0.7, 18, shade(sh, -0.45));
    }
    R(c, x - 4, y + 18, 22, 2.6, trim); R(c, x - 4, y + 20.6, 22, 0.8, 'rgba(0,0,0,.25)');
    // floreira
    R(c, x - 1, y + 21.4, 16, 3.4, '#8a4a2e');
    const fl = ['#ff5d73', '#ffd166', '#f7f7ff', '#ff8fd0'];
    for (let i = 0; i < 6; i++) { c.fillStyle = '#4f8a3f'; ell(c, x + 1 + i * 2.5, y + 21, 1.6, 1.2); c.fill(); c.fillStyle = fl[(i + Math.floor(x)) % 4]; ell(c, x + 1.5 + i * 2.5, y + 20, 0.9, 0.9); c.fill(); }
  };
  A.door = (c, dx, by, col, trim) => {
    R(c, dx - 3, by - 31, 22, 31, trim); R(c, dx - 3, by - 31, 22, 0.7, '#fff');
    c.fillStyle = lin(c, dx, 0, dx + 16, 0, [[0, shade(col, 0.15)], [1, shade(col, -0.2)]]); c.fillRect(dx, by - 29, 16, 29);
    for (const py of [by - 26, by - 13]) for (const px of [dx + 1.6, dx + 8.6]) { R(c, px, py, 5.8, 10, shade(col, -0.25)); R(c, px + 0.6, py + 0.6, 5, 0.6, shade(col, 0.3)); }
    R(c, dx + 7.6, by - 29, 0.8, 29, shade(col, -0.45)); ell(c, dx + 12, by - 14, 0.9, 0.9); c.fillStyle = '#f2cf63'; c.fill();
    R(c, dx - 4, by - 1.5, 24, 1.5, '#9a948c');
  };
  A.signBoard = (c, cx, y, text, bg, fg) => {
    c.font = `400 7px ${Z.FONT}`;
    const tw = c.measureText(text).width + 12;
    const sx = cx - tw / 2;
    R(c, sx + 1.5, y + 1.5, tw, 13, 'rgba(0,0,0,.25)');
    rr(c, sx, y, tw, 13, 1.5); c.fillStyle = lin(c, 0, y, 0, y + 13, [[0, shade(bg, 0.15)], [1, shade(bg, -0.15)]]); c.fill();
    c.lineWidth = 0.8; c.strokeStyle = shade(bg, -0.5); c.stroke();
    R(c, sx + 1, y + 1, tw - 2, 0.6, 'rgba(255,255,255,.35)');
    c.fillStyle = fg; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(text, sx + 6, y + 3.4);
  };
  A.poster = (c, x, y) => { // cartaz do rival
    c.save(); c.translate(x + 8, y + 10); c.rotate((A.hash(Math.floor(x), 3) - 0.5) * 0.12);
    R(c, -8, -10, 16, 21, '#f2ead2'); R(c, -8, -10, 16, 5, '#c8323c'); R(c, -8, 6, 16, 4, '#c8323c');
    ell(c, 0, -0.5, 3.6, 4); c.fillStyle = '#d39a74'; c.fill(); R(c, -4.5, -5, 9, 2, '#6b4423');
    c.fillStyle = '#eee'; c.beginPath(); c.moveTo(-4, 1.5); c.quadraticCurveTo(0, -0.5, 4, 1.5); c.lineTo(0, 2.6); c.fill();
    c.fillStyle = '#fff'; c.font = `400 3px ${Z.FONT}`; c.textAlign = 'center'; c.fillText('BIGODÃO', 0, 6.8);
    R(c, -8, -10, 16, 0.6, 'rgba(255,255,255,.5)'); R(c, -1, -11, 2, 2, '#999');
    c.restore();
  };

  A.lamp = (c, x, by) => {
    c.fillStyle = lin(c, x, 0, x + 3, 0, [[0, '#4a4a5c'], [1, '#1f1f2a']]);
    c.fillRect(x, by - 56, 3, 56);
    R(c, x - 2.5, by - 5, 8, 5, '#2b2b36'); R(c, x - 1.5, by - 30, 6, 2, '#2b2b36');
    c.strokeStyle = '#2b2b36'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + 1.5, by - 55); c.quadraticCurveTo(x + 1.5, by - 64, x + 6, by - 64); c.stroke();
    R(c, x - 5, by - 66, 13, 2.5, '#2b2b36');
    c.fillStyle = lin(c, 0, by - 64, 0, by - 54, [[0, '#fff6c8'], [1, '#ffcf6a']]); c.fillRect(x - 3.5, by - 63.5, 10, 8);
    R(c, x + 1, by - 63.5, 0.8, 8, '#2b2b36'); R(c, x - 4.5, by - 55.5, 12, 2, '#2b2b36');
  };
  A.lampGlow = (ctx, x, y, t) => {
    const f = 1 + Math.sin(t * 7 + x) * 0.04 + Math.sin(t * 13 + x * 2) * 0.03;
    ctx.fillStyle = rad(ctx, x, y, 0, 34 * f, [[0, 'rgba(255,225,150,.55)'], [0.35, 'rgba(255,200,120,.18)'], [1, 'rgba(255,180,100,0)']]);
    ctx.fillRect(x - 40, y - 40, 80, 80);
  };
  A.ipe = (c, x, by, s = 1, color = '#f6c428') => {
    c.fillStyle = lin(c, x - 3, 0, x + 3, 0, [[0, '#6e4a36'], [1, '#3e2a1e']]);
    c.beginPath(); c.moveTo(x - 3 * s, by); c.quadraticCurveTo(x - 1, by - 20 * s, x - 1.5, by - 40 * s); c.lineTo(x + 1.5, by - 40 * s); c.quadraticCurveTo(x + 2, by - 20 * s, x + 3 * s, by); c.fill();
    c.strokeStyle = '#4e3426'; c.lineWidth = 1.6 * s; c.lineCap = 'round';
    for (const [dx, dy] of [[-16, -50], [17, -52], [-6, -58], [8, -60]]) { c.beginPath(); c.moveTo(x, by - 28 * s); c.quadraticCurveTo(x + dx * 0.4 * s, by + dy * 0.7 * s, x + dx * s, by + dy * s); c.stroke(); }
    const r = A.rng(Math.floor(x));
    const cols = [shade(color, -0.3), color, shade(color, 0.25), shade(color, 0.5)];
    for (let layer = 0; layer < 4; layer++) {
      for (let i = 0; i < 46; i++) {
        const a = r() * 7, d = Math.sqrt(r()) * 27 * s;
        const px = x + Math.cos(a) * d * 1.3, py = by - 56 * s + Math.sin(a) * d * 0.75 - layer * 1.5;
        c.fillStyle = cols[layer]; ell(c, px, py, (2.2 - layer * 0.3) * s, (1.8 - layer * 0.25) * s); c.fill();
      }
    }
    for (let i = 0; i < 14; i++) { c.fillStyle = cols[1 + (i % 2)]; ell(c, x + (r() - 0.5) * 60 * s, by - 0.6, 1.3, 0.5); c.fill(); }
  };
  A.bunting = (c, x0, x1, y, sag = 10) => {
    const cols = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#7b68ee', '#ff7eb6'];
    const Y = t => y + Math.sin(t * Math.PI) * sag;
    c.strokeStyle = '#3b2f2f'; c.lineWidth = 0.7; c.beginPath();
    for (let x = x0; x <= x1; x += 2) { const yy = Y((x - x0) / (x1 - x0)); x === x0 ? c.moveTo(x, yy) : c.lineTo(x, yy); }
    c.stroke();
    let k = 0;
    for (let x = x0 + 4; x < x1 - 4; x += 9) {
      const yy = Y((x - x0) / (x1 - x0)), col = cols[k++ % cols.length];
      c.fillStyle = col; c.beginPath(); c.moveTo(x - 3.2, yy); c.lineTo(x + 3.2, yy); c.lineTo(x, yy + 7.5); c.fill();
      c.fillStyle = shade(col, -0.25); c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 3.2, yy); c.lineTo(x, yy + 7.5); c.fill();
    }
  };
  A.fence = (c, x0, x1, by) => {
    for (let x = x0; x < x1; x += 8) { c.fillStyle = lin(c, x, 0, x + 3, 0, [[0, '#a07a52'], [1, '#6e5034']]); c.fillRect(x, by - 15, 3, 15); c.beginPath(); c.moveTo(x, by - 15); c.lineTo(x + 1.5, by - 17); c.lineTo(x + 3, by - 15); c.fill(); }
    for (const yy of [by - 12, by - 6]) { R(c, x0, yy, x1 - x0, 2, '#8a6440'); R(c, x0, yy, x1 - x0, 0.6, '#b08a5e'); }
  };
  A.bush = (c, x, by, w) => {
    const r = A.rng(Math.floor(x));
    for (let i = 0; i < w; i += 6) { ell(c, x + i, by - 6 - r() * 3, 8, 7); c.fillStyle = '#3f6e3a'; c.fill(); }
    for (let i = 3; i < w; i += 6) { ell(c, x + i, by - 9 - r() * 3, 5, 4); c.fillStyle = '#5c9150'; c.fill(); }
    for (let i = 0; i < w; i += 3) { ell(c, x + i + r() * 3, by - 11 - r() * 4, 1.6, 1.2); c.fillStyle = '#86bb6c'; c.fill(); }
  };

  // ---------------- personagens (vetoriais com contorno) ----------------
  // Pombo (origem: centro, base)
  A.pigeon = (c, x, y, facing, t, state, flash) => {
    c.save(); c.translate(x, y); c.scale(facing, 1);
    const F = col => flash ? '#ffffff' : col;
    const flying = state !== 'peck';
    const flap = state === 'dive' ? -0.9 : state === 'peck' ? 0.2 : Math.sin(t * 30) * 0.9;
    // asa de trás
    if (flying) { c.save(); c.translate(-1, -9); c.rotate(-flap - 0.4); ell(c, -5, 0, 8, 3); fs(c, F('#6f7486'), 0.7); c.restore(); }
    // cauda
    c.beginPath(); c.moveTo(-6, -8); c.lineTo(-14, -9); c.lineTo(-14, -5); c.lineTo(-6, -5); c.closePath(); fs(c, F('#5d6274'), 0.7);
    R(c, -14, -9, 2, 4, F('#2b2d38'));
    // corpo
    ell(c, -1, -7, 8.5, 5.5); c.fillStyle = flash ? '#fff' : lin(c, 0, -13, 0, -1, [[0, '#b5b9c9'], [1, '#7a7f93']]); c.fill(); c.lineWidth = 0.8; c.strokeStyle = OUT; c.stroke();
    // pescoço furta-cor
    ell(c, 5, -10, 3.4, 3.6); c.fillStyle = flash ? '#fff' : lin(c, 2, -13, 8, -7, [[0, Math.sin(t * 4) > 0 ? '#4fb08a' : '#8d63b8'], [1, Math.sin(t * 4) > 0 ? '#8d63b8' : '#4fb08a']]); c.fill();
    // cabeça
    ell(c, 7, -14, 3.6, 3.3); fs(c, F('#959bb0'), 0.8);
    c.beginPath(); c.moveTo(10, -14.5); c.lineTo(14, -13.4); c.lineTo(10.2, -12.6); c.closePath(); fs(c, F('#3a3a44'), 0.5);
    ell(c, 10.4, -14.6, 0.9, 0.6); c.fillStyle = F('#f3f3f3'); c.fill();
    ell(c, 8, -14.8, 1.2, 1.2); c.fillStyle = F('#ff8a2e'); c.fill(); ell(c, 8.2, -14.8, 0.55, 0.55); c.fillStyle = '#111'; c.fill();
    R(c, 7.9, -15.4, 0.4, 0.4, '#fff');
    // asa da frente
    c.save(); c.translate(-1, -9);
    if (flying) c.rotate(flap);
    c.beginPath(); c.moveTo(-1, -1); c.quadraticCurveTo(-6, -4, -12, 0); c.quadraticCurveTo(-6, 3, 2, 1); c.closePath();
    fs(c, F('#8a8fa2'), 0.7);
    R(c, -7, -1, 1.2, 2.4, F('#2b2d38')); R(c, -4, -1.3, 1.2, 2.6, F('#2b2d38'));
    c.restore();
    // patinhas
    c.strokeStyle = F('#e07a86'); c.lineWidth = 0.9;
    if (!flying || state === 'peck') { c.beginPath(); c.moveTo(-2, -2); c.lineTo(-2.5, 0); c.moveTo(1.5, -2); c.lineTo(2, 0); c.stroke(); }
    c.restore();
  };

  // Cabo eleitoral (origem: centro dos pés), proporções "cabeçudas" como o Zima
  A.cabo = (c, x, y, facing, t, state, flash, walk) => {
    c.save(); c.translate(x, y); c.scale(facing, 1);
    const F = col => flash ? '#ffffff' : col;
    const sw = walk ? Math.sin(t * 11) * 0.45 : 0;
    const leg = (ox, a, col) => {
      c.save(); c.translate(ox, -18); c.rotate(a);
      rr(c, -2.6, 0, 5.2, 15, 2); fs(c, F(col), 0.8);
      rr(c, -3, 13.5, 8, 4.5, 2); fs(c, F('#f4f4f4'), 0.8); R(c, -3, 16.5, 8, 1.2, F('#c8323c'));
      c.restore();
    };
    leg(-3, -sw, '#2f4f86'); leg(3, sw, '#3a5f9e');
    // braço de trás
    c.save(); c.translate(-6, -33); c.rotate(state === 'wind' ? -2.6 : 0.25 - sw * 0.5);
    rr(c, -2.2, 0, 4.4, 13, 2); fs(c, F('#c08454'), 0.8);
    if (state === 'wind') { c.save(); c.translate(0, 13); c.rotate(0.3); rr(c, -4, -1, 8, 6, 0.8); fs(c, F('#f4f1e6'), 0.7); R(c, -4, -1, 8, 1.6, F('#c8323c')); c.restore(); }
    c.restore();
    // tronco (camiseta)
    rr(c, -8.5, -36, 17, 20, 4); c.fillStyle = flash ? '#fff' : lin(c, -8, -36, 8, -16, [[0, '#e0434d'], [1, '#a8242f']]); c.fill(); c.lineWidth = 0.9; c.strokeStyle = OUT; c.stroke();
    R(c, -8.5, -19, 17, 2, F('#8e1c26'));
    c.fillStyle = F('#ffd34d'); c.font = `400 6px ${Z.FONT}`; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('99', 0.5, -31);
    // cabeça
    ell(c, 0.5, -45, 8.5, 8.2); c.fillStyle = flash ? '#fff' : rad(c, -2, -48, 1, 10, [[0, '#e3a679'], [1, '#bd7f55']]); c.fill(); c.lineWidth = 0.9; c.strokeStyle = OUT; c.stroke();
    ell(c, -6.5, -44, 1.8, 2.4); fs(c, F('#c88a5e'), 0.7);                          // orelha
    ell(c, 5, -46, 1.3, 1.7); c.fillStyle = F('#22161a'); c.fill(); R(c, 5.2, -47, 0.6, 0.6, '#fff');
    R(c, 2.8, -49.5, 4.4, 1, F('#4a2a1a'));                                                 // sobrancelha
    c.strokeStyle = F('#7a3a2a'); c.lineWidth = 0.8; c.beginPath(); c.moveTo(3, -40.5); c.quadraticCurveTo(5.5, state === 'wind' ? -42 : -39.5, 7.5, -41); c.stroke();
    ell(c, 6.8, -43, 1.6, 1); c.fillStyle = 'rgba(230,110,90,.35)'; c.fill();
    // boné
    c.beginPath(); c.moveTo(-8, -48); c.quadraticCurveTo(0, -57, 8.5, -49); c.lineTo(8.5, -48); c.closePath(); fs(c, F('#d73a44'), 0.8);
    rr(c, 4, -49.5, 9, 2.4, 1.2); fs(c, F('#9c1f2a'), 0.7);
    R(c, -2, -55.5, 3, 1.2, F('#ffd34d'));
    // braço da frente
    c.save(); c.translate(6, -33);
    c.rotate(state === 'throw' ? -1.5 : state === 'wind' ? 0.6 : -0.3 + sw * 0.5);
    rr(c, -2.2, 0, 4.4, 13, 2); fs(c, F('#d39260'), 0.8);
    if (state !== 'throw' && state !== 'wind') { c.translate(0, 12); c.rotate(-0.6); rr(c, -1, -4, 7, 9, 0.8); fs(c, F('#f4f1e6'), 0.7); R(c, -1, -4, 7, 1.6, F('#c8323c')); R(c, 0.5, -0.5, 4, 0.5, '#999'); R(c, 0.5, 1.2, 4, 0.5, '#999'); }
    c.restore();
    c.restore();
  };

  // Coronel Bigodão (origem: centro dos pés)
  A.boss = (c, x, y, facing, t, pose, flash, phase2, scale = 1) => {
    c.save(); c.translate(x, y); c.scale(facing * scale, scale);
    const F = col => flash ? '#ffffff' : col;
    const suit = phase2 ? '#f6dfd6' : '#f3eee2', suitD = phase2 ? '#d5aca2' : '#cfc6b0';
    const bob = pose === 'idle' ? Math.sin(t * 4) * 1 : 0;
    const lean = pose === 'charge' ? 0.12 : 0;
    const step = pose === 'charge' ? Math.sin(t * 22) * 0.35 : 0;
    const leg = (ox, a, col) => {
      c.save(); c.translate(ox, -27); c.rotate(a);
      rr(c, -6, 0, 12, 23, 3); fs(c, F(col), 0.9);
      rr(c, -7, 20, 17, 7, 3); fs(c, F('#5a3a22'), 0.9); R(c, -5, 21, 10, 1, F('#8a5a3a'));
      c.restore();
    };
    leg(-8, -step, suitD); leg(8, step, shade(suitD, 0.1));
    c.translate(0, bob); c.rotate(lean);
    // braço de trás
    c.save(); c.translate(-18, -62); c.rotate(pose === 'raise' ? -0.2 : 0.15);
    rr(c, -4.5, 0, 9, 25, 4); fs(c, F(shade(suit, -0.1)), 0.9); ell(c, 0, 26, 4.5, 4); fs(c, F('#d39a74'), 0.8);
    c.restore();
    // paletó e barriga
    c.beginPath(); c.moveTo(-21, -70); c.lineTo(21, -70); c.quadraticCurveTo(30, -46, 26, -28); c.lineTo(-22, -28); c.quadraticCurveTo(-26, -50, -21, -70); c.closePath();
    c.fillStyle = flash ? '#fff' : lin(c, -22, -70, 26, -28, [[0, shade(suit, 0.1)], [0.7, suit], [1, suitD]]); c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
    ell(c, 4, -44, 22, 17); c.fillStyle = flash ? '#fff' : rad(c, -2, -50, 3, 26, [[0, shade(suit, 0.15)], [1, suitD]]); c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
    // camisa, gravata, botões
    c.beginPath(); c.moveTo(-5, -70); c.lineTo(5, -70); c.lineTo(3, -55); c.lineTo(-3, -55); c.closePath(); fs(c, F('#ece6d6'), 0.6);
    c.beginPath(); c.moveTo(-1.5, -68); c.lineTo(1.5, -68); c.lineTo(2.5, -56); c.lineTo(0, -53); c.lineTo(-2.5, -56); c.closePath(); fs(c, F('#a3262f'), 0.6);
    for (const by of [-46, -38]) { ell(c, 6, by, 1.3, 1.3); fs(c, F('#d8cfb8'), 0.5); }
    // faixa de prefeito e medalha
    c.save(); c.beginPath(); c.moveTo(-19, -70); c.lineTo(-11, -70); c.lineTo(25, -32); c.lineTo(17, -30); c.closePath();
    c.fillStyle = flash ? '#fff' : lin(c, -19, -70, 25, -30, [[0, '#e04b55'], [1, '#a42630']]); c.fill(); c.lineWidth = 0.7; c.strokeStyle = OUT; c.stroke();
    R(c, -14, -66, 1, 1, '#ffd34d'); c.restore();
    ell(c, 10, -48, 4, 4); c.fillStyle = flash ? '#fff' : rad(c, 9, -49, 0.5, 4, [[0, '#fff2a8'], [1, '#d9a83a']]); c.fill(); c.lineWidth = 0.7; c.strokeStyle = '#8a5a1a'; c.stroke();
    // cabeça
    ell(c, 1, -80, 12, 12); c.fillStyle = flash ? '#fff' : rad(c, -3, -84, 2, 15, [[0, phase2 ? '#f0a084' : '#e8b08a'], [1, phase2 ? '#c8644a' : '#c4875e']]); c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
    ell(c, -1, -71, 11, 4.5); c.fillStyle = F(phase2 ? '#c8644a' : '#c4875e'); c.fill();           // papada
    ell(c, 7, -77, 2.6, 1.6); c.fillStyle = 'rgba(230,90,80,.45)'; c.fill();                           // bochecha
    ell(c, 5.5, -83, 2.2, 1.6); fs(c, F('#ffffff'), 0.5); ell(c, 6.2, -83, 1, 1); c.fillStyle = '#1a1010'; c.fill();
    c.fillStyle = F('#e8e8ee'); c.beginPath(); c.moveTo(1, -87); c.quadraticCurveTo(6, phase2 ? -86 : -90, 11, -88); c.lineTo(11, -86); c.quadraticCurveTo(6, phase2 ? -84 : -87.5, 1, -85.5); c.fill(); // sobrancelha
    ell(c, 11.5, -79, 2.6, 2.2); fs(c, F('#d08a66'), 0.6);                                              // nariz
    // bigodão
    const ms = pose === 'mega' ? 1.5 : Math.sin(t * 3) * 0.4;
    c.beginPath(); c.moveTo(1, -75); c.quadraticCurveTo(8, -80 - ms, 15, -75); c.quadraticCurveTo(22, -73, 24, -67); c.quadraticCurveTo(19, -71, 13, -70.5);
    c.quadraticCurveTo(7, -72, 1, -70); c.quadraticCurveTo(-6, -71.5, -10, -66); c.quadraticCurveTo(-10, -73, 1, -75); c.closePath();
    c.fillStyle = flash ? '#fff' : lin(c, 0, -80, 0, -66, [[0, '#ffffff'], [1, '#c9c9d4']]); c.fill(); c.lineWidth = 0.9; c.strokeStyle = OUT; c.stroke();
    // chapéu de coronel
    ell(c, 1, -90, 21, 4); fs(c, F('#6b4423'), 0.9);
    c.beginPath(); c.moveTo(-11, -90); c.quadraticCurveTo(-12, -104, 1, -105); c.quadraticCurveTo(14, -104, 13, -90); c.closePath();
    c.fillStyle = flash ? '#fff' : lin(c, -11, -105, 13, -90, [[0, '#8d6038'], [1, '#5e3b1e']]); c.fill(); c.lineWidth = 0.9; c.strokeStyle = OUT; c.stroke();
    R(c, -11.5, -94, 25, 3, F('#3b2414')); c.beginPath(); c.moveTo(-3, -104); c.quadraticCurveTo(1, -101, 5, -104); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.8; c.stroke();
    // braço da frente por pose
    c.save(); c.translate(17, -64);
    const arm = { raise: -2.9, throw: -1.5, mega: -1.45, charge: -1.2, stun: 0.5, idle: 0.25 + Math.sin(t * 4) * 0.05 }[pose] ?? 0.25;
    c.rotate(arm);
    rr(c, -4.5, 0, 9, 25, 4); fs(c, F(shade(suit, 0.04)), 0.9);
    ell(c, 0, 26, 4.6, 4.2); fs(c, F('#d8a07a'), 0.8);
    if (pose === 'raise') { c.save(); c.translate(0, 30); c.rotate(0.2); rr(c, -5, -3, 10, 8, 1); fs(c, F('#f4f1e6'), 0.7); R(c, -5, -3, 10, 2, F('#c8323c')); c.restore(); }
    if (pose === 'mega') {
      c.save(); c.translate(0, 28); c.rotate(1.45);
      c.beginPath(); c.moveTo(0, -3); c.lineTo(20, -9); c.lineTo(20, 9); c.lineTo(0, 3); c.closePath();
      c.fillStyle = flash ? '#fff' : lin(c, 0, -9, 0, 9, [[0, '#c9ced8'], [1, '#7d8494']]); c.fill(); c.lineWidth = 0.9; c.strokeStyle = OUT; c.stroke();
      ell(c, 20, 0, 2.6, 9); fs(c, F('#d73a44'), 0.9); R(c, 3, 3, 4, 6, F('#3a3a48'));
      c.restore();
    }
    c.restore();
    if (pose === 'stun') for (let i = 0; i < 3; i++) {
      const a = t * 6 + i * 2.1, sx = Math.cos(a) * 15, sy = -110 + Math.sin(a) * 4;
      c.fillStyle = '#ffe14d'; c.beginPath();
      for (let k = 0; k < 10; k++) { const rr2 = k % 2 ? 1.2 : 3, aa = k * Math.PI / 5; c.lineTo(sx + Math.cos(aa) * rr2, sy + Math.sin(aa) * rr2); } c.fill();
    }
    c.restore();
  };

  // ---------------- objetos interativos ----------------
  A.sign = (c, x, by, glow) => {
    R(c, x - 1.5, by - 22, 3, 22, '#6b4a2e'); R(c, x - 1.5, by - 22, 1, 22, '#8a6440');
    if (glow) { c.fillStyle = rad(c, x, by - 27, 2, 22, [[0, 'rgba(255,230,160,.45)'], [1, 'rgba(255,230,160,0)']]); c.fillRect(x - 24, by - 50, 48, 46); }
    rr(c, x - 12, by - 35, 24, 15, 1.5); c.fillStyle = lin(c, 0, by - 35, 0, by - 20, [[0, '#c7965a'], [1, '#9c6e3c']]); c.fill(); c.lineWidth = 0.8; c.strokeStyle = '#4e3220'; c.stroke();
    for (let i = 0; i < 3; i++) R(c, x - 11, by - 31 + i * 4, 22, 0.5, 'rgba(80,50,20,.35)');
    for (const nx of [x - 10, x + 9]) { ell(c, nx, by - 33, 0.7, 0.7); c.fillStyle = '#ccc'; c.fill(); }
    rr(c, x - 1.2, by - 32, 2.4, 6.5, 1); c.fillStyle = '#3b2414'; c.fill(); ell(c, x, by - 23.6, 1.3, 1.3); c.fill();
  };
  A.bench = (c, x, by, active, t) => {
    if (active) { c.fillStyle = rad(c, x, by - 12, 2, 30, [[0, `rgba(160,220,255,${0.35 + Math.sin(t * 3) * 0.1})`], [1, 'rgba(160,220,255,0)']]); c.fillRect(x - 32, by - 44, 64, 46); }
    for (const lx of [x - 17, x + 14]) { rr(c, lx, by - 24, 3, 24, 1); c.fillStyle = '#2f4a3a'; c.fill(); }
    for (const [yy, hh] of [[by - 24, 3], [by - 19.5, 3], [by - 12, 3], [by - 8.5, 2.2]]) {
      rr(c, x - 21, yy, 42, hh, 1); c.fillStyle = lin(c, 0, yy, 0, yy + hh, [[0, '#b98250'], [1, '#7a5028']]); c.fill();
      R(c, x - 20, yy + 0.3, 40, 0.5, 'rgba(255,230,190,.5)');
    }
  };
  A.urna = (c, x, by, t, full) => {
    const g = 0.5 + Math.sin(t * 4) * 0.5;
    c.fillStyle = rad(c, x, by - 16, 2, 26, [[0, `rgba(120,200,255,${0.25 + g * 0.2})`], [1, 'rgba(120,200,255,0)']]); c.fillRect(x - 28, by - 44, 56, 46);
    rr(c, x - 9, by - 9, 18, 9, 1); c.fillStyle = '#4c4c5a'; c.fill();
    rr(c, x - 12, by - 28, 24, 20, 2.5); c.fillStyle = lin(c, 0, by - 28, 0, by - 8, [[0, '#f3ecd8'], [1, '#c9bf9f']]); c.fill(); c.lineWidth = 0.8; c.strokeStyle = '#6a6250'; c.stroke();
    rr(c, x - 9, by - 24.5, 10, 7, 1); c.fillStyle = full ? '#9fe6ff' : lin(c, 0, by - 24, 0, by - 17, [[0, '#7fd6ff'], [1, '#3a8fc0']]); c.fill();
    R(c, x - 8, by - 23.5, 4, 0.7, 'rgba(255,255,255,.7)');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { rr(c, x + 2.5 + i * 2.8, by - 25 + j * 2.6, 2.2, 2, 0.4); c.fillStyle = j === 2 && i === 2 ? '#2a9d4a' : '#3a3a44'; c.fill(); }
    R(c, x - 9, by - 14, 18, 2, '#2a9d4a');
  };
  A.lever = (c, x, by, on) => {
    c.fillStyle = lin(c, x - 3, 0, x + 3, 0, [[0, '#7a808c'], [1, '#4a4f5a']]); c.fillRect(x - 2.5, by - 40, 5, 40);
    rr(c, x - 7, by - 46, 14, 9, 2); c.fillStyle = '#8a909c'; c.fill(); c.lineWidth = 0.8; c.strokeStyle = '#30343c'; c.stroke();
    c.strokeStyle = '#4a3220'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, by - 42); c.lineTo(x + (on ? 12 : -12), by - 54); c.stroke();
    ell(c, x + (on ? 12 : -12), by - 55, 3.2, 3.2); c.fillStyle = on ? '#4cd964' : '#e63946'; c.fill(); c.lineWidth = 0.8; c.strokeStyle = OUT; c.stroke();
    ell(c, x + (on ? 11 : -13), by - 56, 1, 1); c.fillStyle = '#fff'; c.fill();
  };
  A.chest = (c, x, by, t, open) => {
    rr(c, x - 11, by - 14, 22, 14, 1.5); c.fillStyle = lin(c, 0, by - 14, 0, by, [[0, '#a8703a'], [1, '#6e4220']]); c.fill(); c.lineWidth = 0.8; c.strokeStyle = OUT; c.stroke();
    if (open) {
      c.fillStyle = rad(c, x, by - 14, 1, 18, [[0, 'rgba(255,240,160,.8)'], [1, 'rgba(255,240,160,0)']]); c.fillRect(x - 20, by - 34, 40, 22);
      rr(c, x - 12, by - 26, 24, 6, 2); c.fillStyle = '#8a5a2a'; c.fill(); c.stroke();
    } else {
      c.beginPath(); c.moveTo(x - 12, by - 13); c.quadraticCurveTo(x, by - 23, x + 12, by - 13); c.closePath(); c.fillStyle = lin(c, 0, by - 22, 0, by - 13, [[0, '#c48a4a'], [1, '#8a5a2a']]); c.fill(); c.stroke();
      rr(c, x - 2.5, by - 15, 5, 6, 1); c.fillStyle = '#f2cf63'; c.fill(); c.stroke();
    }
    for (const bx of [x - 8, x + 6]) R(c, bx, by - 14, 2, 14, '#e6c35a');
    if (!open && Math.sin(t * 3) > 0.6) { c.fillStyle = '#fff7c0'; ell(c, x + 7, by - 19, 1.2, 1.2); c.fill(); }
  };
  A.coxinha = (c, x, y, t) => {
    const b = Math.sin(t * 3) * 2;
    c.fillStyle = rad(c, x, y - 8 + b, 1, 16, [[0, 'rgba(255,220,120,.5)'], [1, 'rgba(255,220,120,0)']]); c.fillRect(x - 18, y - 26 + b, 36, 36);
    c.beginPath(); c.moveTo(x, y - 18 + b); c.quadraticCurveTo(x + 10, y - 4 + b, x + 6, y + b); c.quadraticCurveTo(x, y + 1.5 + b, x - 6, y + b); c.quadraticCurveTo(x - 10, y - 4 + b, x, y - 18 + b); c.closePath();
    c.fillStyle = lin(c, x - 6, y - 18, x + 6, y, [[0, '#f0a54a'], [1, '#a85d1e']]); c.fill(); c.lineWidth = 0.8; c.strokeStyle = '#5a2e10'; c.stroke();
    for (let i = 0; i < 9; i++) { ell(c, x - 4 + (i * 7) % 9, y - 12 + (i * 5) % 11 + b, 0.6, 0.6); c.fillStyle = '#ffd08a'; c.fill(); }
    R(c, x - 3, y - 13 + b, 1.5, 4, 'rgba(255,255,255,.45)');
  };
})();
