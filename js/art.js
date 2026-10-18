// Arte procedural em pixel art: cenário da cidadezinha, inimigos, chefe e objetos.
'use strict';
(() => {
  const A = Z.art = {};
  const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  A.R = R;
  A.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  A.rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  // ---------------- céu e camadas de parallax ----------------
  A.drawSky = (ctx, t) => {
    const g = ctx.createLinearGradient(0, 0, 0, Z.H);
    g.addColorStop(0, '#3d5fa8'); g.addColorStop(0.45, '#8f8fc4'); g.addColorStop(0.75, '#f0b27a'); g.addColorStop(1, '#f7d59a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, Z.W, Z.H);
    // sol de fim de tarde
    ctx.fillStyle = 'rgba(255,240,190,.25)'; ctx.beginPath(); ctx.arc(470, 205, 46, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3c8'; ctx.beginPath(); ctx.arc(470, 205, 26, 0, 7); ctx.fill();
  };

  A.buildLayers = () => {
    const L = {};
    const W = 1280;
    // nuvens
    const cl = A.canvas(W, 120), c1 = cl.getContext('2d'), r1 = A.rng(7);
    for (let i = 0; i < 9; i++) {
      const x = r1() * W, y = 10 + r1() * 70, s = 0.6 + r1() * 0.9;
      for (const dx of [-W, 0, W]) cloud(c1, x + dx, y, s);
    }
    L.clouds = cl;
    // morros distantes
    const hl = A.canvas(W, 200), c2 = hl.getContext('2d');
    for (let x = 0; x < W; x++) {
      const a = 2 * Math.PI * x / W;
      const h1 = 110 + Math.sin(a * 2) * 22 + Math.sin(a * 5 + 1) * 10 + Math.sin(a * 11) * 4;
      const h2 = 70 + Math.sin(a * 3 + 2) * 18 + Math.sin(a * 7) * 8;
      R(c2, x, 200 - h1, 1, h1, '#7d93a8');
      R(c2, x, 200 - h2, 1, h2, '#6f9a6a');
    }
    // cercas e árvores nos morros
    const r2 = A.rng(3);
    for (let i = 0; i < 26; i++) {
      const x = r2() * W, a = 2 * Math.PI * x / W;
      const top = 200 - (70 + Math.sin(a * 3 + 2) * 18 + Math.sin(a * 7) * 8);
      R(c2, x, top - 9, 2, 9, '#4f6b47'); c2.fillStyle = '#5d8457'; c2.beginPath(); c2.arc(x + 1, top - 11, 5, 0, 7); c2.fill();
    }
    L.hills = hl;
    // silhueta da cidade
    const tw = A.canvas(W, 170), c3 = tw.getContext('2d'), r3 = A.rng(11);
    const sil = '#b98a86', silD = '#a77874';
    let x = 0;
    while (x < W) {
      const w = 30 + r3() * 50, h = 30 + r3() * 40;
      R(c3, x, 170 - h, w, h, r3() > 0.5 ? sil : silD);
      c3.fillStyle = '#9d6a66'; c3.beginPath(); c3.moveTo(x - 3, 170 - h); c3.lineTo(x + w / 2, 170 - h - 12); c3.lineTo(x + w + 3, 170 - h); c3.fill();
      for (let wy = 170 - h + 8; wy < 160; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (r3() > 0.45) R(c3, wx, wy, 4, 6, '#f7d79a');
      if (r3() > 0.75) { // palmeira
        const px = x + w + 4; R(c3, px, 120, 2, 50, '#8a6a5a');
        c3.strokeStyle = '#7c8a6a'; c3.lineWidth = 2;
        for (let k = 0; k < 5; k++) { c3.beginPath(); c3.moveTo(px + 1, 120); c3.quadraticCurveTo(px + 1 + Math.cos(k * 1.3) * 10, 112, px + 1 + Math.cos(k * 1.3) * 16, 122); c3.stroke(); }
      }
      x += w + r3() * 12;
    }
    // torre de igreja distante
    R(c3, 300, 70, 22, 100, silD); c3.fillStyle = '#9d6a66'; c3.beginPath(); c3.moveTo(296, 70); c3.lineTo(311, 42); c3.lineTo(326, 70); c3.fill();
    R(c3, 310, 30, 2, 14, '#9d6a66'); R(c3, 306, 34, 10, 2, '#9d6a66');
    L.town = tw;
    return L;
  };
  function cloud(c, x, y, s) {
    c.fillStyle = 'rgba(255,240,235,.85)';
    const parts = [[0, 0, 14], [14, -6, 16], [30, 0, 13], [-12, 4, 10], [42, 4, 9]];
    for (const [dx, dy, r] of parts) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(240,200,200,.6)'; c.fillRect(x - 20 * s, y + 6 * s, 74 * s, 4 * s);
  }

  A.drawLayer = (ctx, img, cam, fx, fy, baseY) => {
    const w = img.width;
    let ox = -((cam.x * fx) % w); if (ox > 0) ox -= w;
    const y = Math.round(baseY - cam.y * fy);
    for (let x = ox; x < Z.W; x += w) ctx.drawImage(img, Math.round(x), y);
  };

  // ---------------- casas e prédios ----------------
  A.house = (c, x, by, w, h, o = {}) => {
    const wall = o.wall || '#e9dcc0', trim = o.trim || '#fff6e4', base = o.base || shade(wall, -0.25);
    R(c, x, by - h, w, h, wall);
    // textura de reboco
    const r = A.rng(Math.floor(x * 13 + h));
    for (let i = 0; i < w * h / 60; i++) R(c, x + r() * w, by - h + r() * h, 2, 1, shade(wall, -0.06));
    R(c, x, by - 10, w, 10, base);                   // barrado
    R(c, x, by - 11, w, 1, shade(base, -0.2));
    R(c, x - 2, by - h, w + 4, 4, trim);             // cornija
    R(c, x - 2, by - h + 4, w + 4, 1, shade(wall, -0.3));
    R(c, x, by - h, 2, h, shade(wall, -0.12)); R(c, x + w - 2, by - h, 2, h, shade(wall, -0.12));
    if (o.roof !== false) { // telhado colonial
      const rc = o.roofColor || '#b24a2e';
      c.fillStyle = rc; c.beginPath();
      c.moveTo(x - 6, by - h); c.lineTo(x + 8, by - h - 16); c.lineTo(x + w - 8, by - h - 16); c.lineTo(x + w + 6, by - h); c.fill();
      for (let yy = by - h - 14; yy < by - h; yy += 4) R(c, x - 4, yy, w + 8, 1, shade(rc, -0.25));
      for (let xx = x - 2; xx < x + w + 4; xx += 5) R(c, xx, by - h - 3, 3, 3, shade(rc, 0.12));
    }
    // janelas
    const nw = o.windows !== undefined ? o.windows : Math.max(1, Math.floor((w - 20) / 28));
    const floors = o.floors || 1;
    for (let f = 0; f < floors; f++) {
      const wy = by - h + 14 + f * 40;
      if (wy + 20 > by - (o.door === false ? 14 : 34) && f > 0) break;
      for (let i = 0; i < nw; i++) {
        const wx = x + (w / (nw + 1)) * (i + 1) - 7;
        if (o.door !== false && f === floors - 1 && floors === 1 && Math.abs(wx + 7 - (x + w / 2)) < 14) continue;
        win(c, wx, wy, o.shutter || '#2f7a62', trim);
      }
    }
    if (o.door !== false) {
      const dx = x + w / 2 - 8;
      R(c, dx - 2, by - 30, 20, 30, trim); R(c, dx, by - 28, 16, 28, o.doorColor || '#6b3f28');
      R(c, dx + 7, by - 28, 2, 28, shade(o.doorColor || '#6b3f28', -0.3)); R(c, dx + 11, by - 15, 2, 2, '#e6c35a');
    }
    if (o.sign) {
      c.font = `8px ${Z.FONT}`;
      const tw = c.measureText(o.sign).width + 10;
      const sx = Math.round(x + w / 2 - tw / 2), sy = by - h + (o.signY || 4) + 2;
      R(c, sx, sy, tw, 13, o.signBg || '#2e3d7a'); R(c, sx, sy + 12, tw, 1, '#000');
      c.fillStyle = o.signFg || '#fff'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(o.sign, sx + 5, sy + 3);
    }
    if (o.posters) for (const px of o.posters) poster(c, x + px, by - 38);
  };
  function win(c, x, y, sh, trim) {
    R(c, x - 2, y - 2, 18, 22, trim);
    R(c, x, y, 14, 18, '#3a2b3e');
    R(c, x + 1, y + 1, 12, 7, '#f6d38c'); // luz de dentro
    R(c, x - 6, y, 6, 18, sh); R(c, x + 14, y, 6, 18, sh);
    for (let k = 2; k < 18; k += 3) { R(c, x - 6, y + k, 6, 1, shade(sh, -0.3)); R(c, x + 14, y + k, 6, 1, shade(sh, -0.3)); }
    R(c, x - 3, y + 18, 20, 2, trim);
  }
  function poster(c, x, y) { // cartaz do rival
    R(c, x, y, 16, 20, '#f2ead2'); R(c, x, y, 16, 5, '#c8323c');
    R(c, x + 5, y + 7, 6, 6, '#c98b5e'); R(c, x + 3, y + 11, 10, 2, '#ddd'); R(c, x + 4, y + 6, 8, 2, '#6b4423');
    R(c, x + 2, y + 15, 12, 3, '#c8323c');
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
    const f = v => Math.round(Z.clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255));
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }
  A.shade = shade;

  A.lamp = (c, x, by) => {
    R(c, x, by - 56, 3, 56, '#2b2b36'); R(c, x - 2, by - 4, 7, 4, '#2b2b36');
    R(c, x - 5, by - 64, 13, 3, '#2b2b36'); R(c, x - 3, by - 61, 9, 7, '#ffe7a3'); R(c, x - 4, by - 54, 11, 2, '#2b2b36');
    c.fillStyle = 'rgba(255,230,160,.18)'; c.beginPath(); c.arc(x + 1, by - 57, 16, 0, 7); c.fill();
  };
  A.ipe = (c, x, by, s = 1, color = '#f2c230') => {
    R(c, x - 2, by - 40 * s, 5, 40 * s, '#5b3f2e');
    c.strokeStyle = '#5b3f2e'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, by - 30 * s); c.lineTo(x - 14 * s, by - 46 * s); c.moveTo(x + 2, by - 34 * s); c.lineTo(x + 16 * s, by - 48 * s); c.stroke();
    const r = A.rng(Math.floor(x));
    for (let i = 0; i < 70; i++) {
      const a = r() * 7, d = r() * 26 * s;
      R(c, x + Math.cos(a) * d * 1.3, by - 52 * s + Math.sin(a) * d * 0.8, 3, 3, r() > 0.25 ? color : shade(color, -0.25));
    }
  };
  A.bunting = (c, x0, x1, y, sag = 10) => {
    const cols = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#7b68ee', '#ff7eb6'];
    c.strokeStyle = '#3b2f2f'; c.lineWidth = 1; c.beginPath();
    for (let x = x0; x <= x1; x += 2) { const t = (x - x0) / (x1 - x0); const yy = y + Math.sin(t * Math.PI) * sag; x === x0 ? c.moveTo(x, yy) : c.lineTo(x, yy); }
    c.stroke();
    let k = 0;
    for (let x = x0 + 4; x < x1 - 4; x += 10) {
      const t = (x - x0) / (x1 - x0), yy = y + Math.sin(t * Math.PI) * sag;
      c.fillStyle = cols[k++ % cols.length]; c.beginPath(); c.moveTo(x - 3, yy); c.lineTo(x + 3, yy); c.lineTo(x, yy + 7); c.fill();
    }
  };
  A.fence = (c, x0, x1, by) => { for (let x = x0; x < x1; x += 8) R(c, x, by - 14, 3, 14, '#8a6a4a'); R(c, x0, by - 11, x1 - x0, 2, '#7a5a3a'); R(c, x0, by - 5, x1 - x0, 2, '#7a5a3a'); };
  A.bush = (c, x, by, w) => { c.fillStyle = '#4f7d45'; for (let i = 0; i < w; i += 7) { c.beginPath(); c.arc(x + i, by - 6, 8, 0, 7); c.fill(); } c.fillStyle = '#5f9452'; for (let i = 3; i < w; i += 9) { c.beginPath(); c.arc(x + i, by - 9, 4, 0, 7); c.fill(); } };

  // ---------------- personagens procedurais ----------------
  // Pombo (origem: centro, base)
  A.pigeon = (c, x, y, facing, t, state, flash) => {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(facing, 1);
    const body = flash ? '#fff' : '#8d90a0', dark = flash ? '#fff' : '#686b7a', neck = flash ? '#fff' : (Math.sin(t * 6) > 0 ? '#5aa182' : '#8b62a8');
    const flap = state === 'dive' ? 0 : Math.sin(t * 28) > 0 ? 1 : 0;
    R(c, -8, -9, 13, 7, body);            // corpo
    R(c, -11, -8, 4, 3, dark);            // cauda
    R(c, 3, -13, 6, 6, body);             // cabeça
    R(c, 2, -9, 5, 3, neck);              // pescoço furta-cor
    R(c, 8, -11, 3, 2, '#3a3a44');        // bico
    R(c, 6, -12, 1, 1, '#ff9a2e');        // olho
    if (state === 'dive') { R(c, -9, -12, 12, 3, dark); }
    else if (flap) { R(c, -6, -18, 9, 9, dark); R(c, -5, -18, 7, 2, body); }
    else { R(c, -7, -4, 10, 4, dark); }
    R(c, -2, -2, 1, 2, '#d9767a'); R(c, 1, -2, 1, 2, '#d9767a');
    c.restore();
  };

  // Cabo eleitoral (origem: centro dos pés)
  A.cabo = (c, x, y, facing, t, state, flash, walk) => {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(facing, 1);
    const F = col => flash ? '#ffffff' : col;
    const leg = walk ? Math.round(Math.sin(t * 12) * 3) : 0;
    R(c, -6 + leg, -14, 5, 14, F('#34508a')); R(c, 1 - leg, -14, 5, 14, F('#34508a')); // pernas
    R(c, -7 + leg, -2, 7, 2, F('#2a1e1a')); R(c, 0 - leg, -2, 7, 2, F('#2a1e1a'));
    R(c, -8, -34, 16, 21, F('#c8323c'));        // camiseta
    R(c, -8, -15, 16, 2, F('#9c1f2a'));
    R(c, -4, -28, 8, 6, F('#ffd34d'));          // número 99
    R(c, -3, -27, 2, 4, F('#c8323c')); R(c, 1, -27, 2, 4, F('#c8323c'));
    R(c, -5, -44, 10, 10, F('#c98b5e'));        // cabeça
    R(c, 1, -40, 2, 2, F('#2a1e1a'));           // olho
    R(c, -1, -36, 5, 1, F('#7a4a3a'));          // boca
    R(c, -6, -47, 12, 4, F('#c8323c')); R(c, 2, -45, 7, 2, F('#9c1f2a')); // boné
    // braço: arremesso
    if (state === 'wind') { R(c, -10, -46, 4, 14, F('#c98b5e')); R(c, -12, -50, 6, 6, F('#f4f1e6')); }
    else if (state === 'throw') { R(c, 6, -32, 12, 4, F('#c98b5e')); }
    else { R(c, 5, -32, 4, 12, F('#c98b5e')); R(c, 4, -24, 7, 8, F('#f4f1e6')); R(c, 5, -23, 5, 2, F('#c8323c')); }
    R(c, -9, -32, 4, 12, F('#b07650'));
    c.restore();
  };

  // Dona Cida (NPC)
  A.cida = (c, x, y, t) => {
    c.save(); c.translate(Math.round(x), Math.round(y));
    const b = Math.round(Math.sin(t * 2) * 0.6);
    R(c, -7, -26, 14, 26, '#7a5fae');                // vestido
    for (let i = 0; i < 8; i++) R(c, -6 + (i * 5) % 12, -24 + i * 3, 2, 2, '#f6c1d9'); // florzinhas
    R(c, -6, -2, 5, 2, '#3b2a2a'); R(c, 1, -2, 5, 2, '#3b2a2a');
    R(c, -5, -36 + b, 10, 10, '#d9a27a');            // cabeça
    R(c, -6, -39 + b, 12, 5, '#d6d6de'); R(c, -2, -42 + b, 6, 4, '#d6d6de'); // coque
    R(c, 2, -33 + b, 2, 2, '#2a1e1a'); R(c, 0, -29 + b, 4, 1, '#a0604a');
    R(c, -1, -34 + b, 6, 3, 'rgba(20,20,40,.25)');   // óculos
    R(c, 7, -30, 2, 30, '#a07a4a'); R(c, 5, -4, 6, 4, '#d8c070'); // vassoura
    c.restore();
  };

  // Coronel Bigodão (origem: centro dos pés)
  A.boss = (c, x, y, facing, t, pose, flash, phase2) => {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(facing, 1);
    const F = col => flash ? '#ffffff' : col;
    const suit = F(phase2 ? '#f3d9d0' : '#f1ece0'), suitD = F(phase2 ? '#d7b0a6' : '#cbc2ad');
    const bob = pose === 'idle' ? Math.round(Math.sin(t * 4) * 1) : 0;
    const lean = pose === 'charge' ? 6 : 0;
    // botas e pernas
    const step = pose === 'charge' ? Math.round(Math.sin(t * 22) * 5) : 0;
    R(c, -16 + step, -26, 12, 24, suitD); R(c, 4 - step, -26, 12, 24, suitD);
    R(c, -18 + step, -6, 15, 6, F('#5a3a22')); R(c, 3 - step, -6, 15, 6, F('#5a3a22'));
    c.translate(lean, bob);
    // barriga e paletó
    c.fillStyle = suit; c.beginPath(); c.ellipse(2, -44, 24, 22, 0, 0, 7); c.fill();
    R(c, -20, -66, 40, 28, suit);
    R(c, -3, -66, 6, 30, F('#e2dccd'));               // camisa
    R(c, -1, -64, 2, 10, F('#a3262f'));               // gravata
    c.strokeStyle = F('#c8323c'); c.lineWidth = 5; c.beginPath(); c.moveTo(-18, -66); c.lineTo(20, -30); c.stroke(); // faixa
    R(c, 6, -50, 6, 6, F('#e6c35a')); R(c, 7, -49, 4, 4, F('#f7e08a')); // medalha
    R(c, -22, -38, 44, 3, suitD);
    // cabeça
    R(c, -11, -86, 22, 20, F('#d39a74'));
    R(c, -11, -72, 22, 6, F('#c58a64'));
    R(c, 3, -81, 4, 3, F('#ffffff')); R(c, 5, -80, 2, 2, F('#2a1e1a'));  // olho
    R(c, -1, -84, 10, 3, F('#d9d9d9'));               // sobrancelha
    R(c, 8, -78, 5, 4, F('#c27a5a'));                 // nariz
    // bigodão
    const ms = pose === 'mega' ? 2 : 0;
    c.fillStyle = F('#eeeeee');
    c.beginPath(); c.moveTo(-6, -72); c.quadraticCurveTo(6, -79 - ms, 18, -72); c.quadraticCurveTo(24, -68, 22, -64); c.quadraticCurveTo(14, -70, 6, -69); c.quadraticCurveTo(-2, -70, -10, -64); c.quadraticCurveTo(-12, -69, -6, -72); c.fill();
    R(c, 0, -73, 10, 2, F('#cfcfcf'));
    // chapéu de coronel
    R(c, -18, -90, 38, 4, F('#6b4423')); R(c, -11, -102, 24, 13, F('#7d5230')); R(c, -11, -92, 24, 3, F('#3b2414'));
    // braços por pose
    const arm = F('#e6dfcf'), hand = F('#d39a74');
    if (pose === 'raise') { R(c, 12, -96, 8, 30, arm); R(c, 12, -104, 8, 8, hand); R(c, 9, -112, 14, 9, F('#f4f1e6')); R(c, 10, -110, 12, 2, F('#c8323c')); }
    else if (pose === 'throw') { R(c, 14, -64, 28, 8, arm); R(c, 40, -64, 7, 8, hand); }
    else if (pose === 'mega') {
      R(c, 14, -66, 18, 8, arm); R(c, 30, -66, 7, 8, hand);
      c.fillStyle = F('#8a8f9a'); c.beginPath(); c.moveTo(34, -66); c.lineTo(52, -76); c.lineTo(52, -50); c.lineTo(34, -58); c.fill();
      R(c, 50, -76, 3, 26, F('#c8323c'));
    }
    else if (pose === 'charge') { R(c, 14, -60, 22, 8, arm); R(c, 34, -60, 7, 8, hand); }
    else { R(c, 16, -64, 8, 26, arm); R(c, 16, -40, 8, 7, hand); }
    R(c, -24, -64, 8, 26, F('#ddd5c3')); R(c, -24, -40, 8, 7, hand);
    if (pose === 'stun') for (let i = 0; i < 3; i++) {
      const a = t * 6 + i * 2.1; R(c, Math.cos(a) * 16 - 2, -108 + Math.sin(a) * 4, 4, 4, '#ffe14d');
    }
    c.restore();
  };

  // objetos
  A.sign = (c, x, by, glow) => {
    R(c, x - 1, by - 22, 3, 22, '#6b4a2e');
    R(c, x - 11, by - 34, 23, 15, glow ? '#c99a5b' : '#a87b47'); R(c, x - 11, by - 20, 23, 2, '#6b4a2e');
    R(c, x - 9, by - 32, 19, 1, '#d8b27a');
    R(c, x, by - 31, 2, 6, '#3b2414'); R(c, x, by - 23, 2, 2, '#3b2414');
  };
  A.bench = (c, x, by, active, t) => {
    if (active) { c.fillStyle = `rgba(150,210,255,${0.18 + Math.sin(t * 3) * 0.06})`; c.beginPath(); c.arc(x, by - 12, 26, 0, 7); c.fill(); }
    R(c, x - 18, by - 10, 3, 10, '#2f4a3a'); R(c, x + 15, by - 10, 3, 10, '#2f4a3a');
    R(c, x - 20, by - 12, 40, 3, '#9a6a3a'); R(c, x - 20, by - 8, 40, 2, '#7a5028');
    R(c, x - 18, by - 24, 3, 12, '#2f4a3a'); R(c, x + 15, by - 24, 3, 12, '#2f4a3a');
    R(c, x - 20, by - 24, 40, 3, '#9a6a3a'); R(c, x - 20, by - 19, 40, 3, '#9a6a3a');
  };
  A.urna = (c, x, by, t, full) => {
    const g = 0.5 + Math.sin(t * 4) * 0.5;
    c.fillStyle = `rgba(120,200,255,${0.15 + g * 0.15})`; c.beginPath(); c.arc(x, by - 14, 20, 0, 7); c.fill();
    R(c, x - 9, by - 8, 18, 8, '#5a5a66');
    R(c, x - 11, by - 26, 22, 18, '#e9e2cc'); R(c, x - 11, by - 26, 22, 3, '#c9c0a6');
    R(c, x - 8, by - 22, 9, 6, full ? '#7fd6ff' : '#4a7f9a');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) R(c, x + 3 + i * 3, by - 22 + j * 3, 2, 2, '#333');
    R(c, x - 8, by - 13, 16, 2, '#2a9d4a');
  };
  A.lever = (c, x, by, on) => {
    R(c, x - 2, by - 40, 5, 40, '#5b5f6a'); R(c, x - 6, by - 44, 13, 8, '#7a808c');
    c.strokeStyle = '#3b2a1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, by - 40);
    c.lineTo(x + (on ? 12 : -12), by - 52); c.stroke();
    R(c, x + (on ? 10 : -15), by - 56, 6, 6, on ? '#4cd964' : '#e63946');
  };
  A.chest = (c, x, by, t) => {
    R(c, x - 10, by - 14, 20, 14, '#8a5a2a'); R(c, x - 11, by - 17, 22, 5, '#a8703a');
    R(c, x - 10, by - 9, 20, 2, '#e6c35a'); R(c, x - 2, by - 12, 4, 5, '#e6c35a');
    if (Math.sin(t * 3) > 0.7) R(c, x + 6, by - 20, 2, 2, '#fff7c0');
  };
  A.coxinha = (c, x, y, t) => {
    const b = Math.round(Math.sin(t * 3) * 2);
    c.fillStyle = 'rgba(255,220,120,.25)'; c.beginPath(); c.arc(x, y - 8 + b, 12, 0, 7); c.fill();
    c.fillStyle = '#c87a2a'; c.beginPath(); c.moveTo(x, y - 18 + b); c.quadraticCurveTo(x + 9, y - 4 + b, x + 6, y + b); c.lineTo(x - 6, y + b); c.quadraticCurveTo(x - 9, y - 4 + b, x, y - 18 + b); c.fill();
    R(c, x - 2, y - 12 + b, 2, 2, '#e8a85a'); R(c, x + 1, y - 7 + b, 2, 2, '#e8a85a');
  };
})();
