// Núcleo: constantes, utilitários, partículas, textos flutuantes e câmera.
// O mundo usa unidades fixas (640×360). A tela desenha em resolução nativa: 1 unidade = Z.S pixels.
'use strict';
const Z = window.Z = {};

Z.W = 640; Z.H = 360; Z.T = 16;
Z.S = 1;                                   // escala atual (pixels reais por unidade do mundo)
Z.FONT = "'Press Start 2P', ui-monospace, monospace";          // letreiros e títulos (retrô)
Z.FONT2 = "'Baloo 2', 'Trebuchet MS', system-ui, sans-serif";    // textos corridos (nítidos em HD)

Z.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
Z.lerp = (a, b, t) => a + (b - a) * t;
Z.rand = (a, b) => a + Math.random() * (b - a);
Z.irand = (a, b) => Math.floor(Z.rand(a, b + 1));
Z.sign = v => v < 0 ? -1 : 1;
Z.approach = (v, target, step) => v < target ? Math.min(v + step, target) : Math.max(v - step, target);
Z.snap = v => Math.round(v * Z.S) / Z.S;   // alinha ao pixel real da tela (sem tremer, sem borrar)

// retângulo de uma entidade ancorada no centro dos pés
Z.box = e => ({ l: e.x - e.w / 2, r: e.x + e.w / 2, t: e.y - e.h, b: e.y });
Z.overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

// ---------- partículas ----------
Z.particles = [];
Z.emit = (x, y, n, o = {}) => {
  for (let i = 0; i < n; i++) {
    const ang = o.angle !== undefined ? o.angle + Z.rand(-(o.spread || 3.14), o.spread || 3.14) : Z.rand(0, Math.PI * 2);
    const sp = Z.rand(o.speedMin || 30, o.speed || 120);
    Z.particles.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      life: Z.rand(o.lifeMin || 0.25, o.life || 0.6), t: 0,
      size: o.size || 2, color: Array.isArray(o.color) ? o.color[Z.irand(0, o.color.length - 1)] : (o.color || '#fff'),
      g: o.gravity !== undefined ? o.gravity : 300, drag: o.drag || 0, kind: o.kind || 'sq', glow: !!o.glow,
    });
  }
};
Z.updateParticles = dt => {
  const P = Z.particles;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.t += dt;
    if (p.t >= p.life) { P.splice(i, 1); continue; }
    p.vy += p.g * dt; p.vx *= (1 - p.drag * dt); p.vy *= (1 - p.drag * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
};
Z.drawParticles = (ctx, cam) => {
  for (const p of Z.particles) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = Math.min(1, a * 1.5);
    const x = p.x - cam.x, y = p.y - cam.y;
    if (p.kind === 'bub') {
      const r = p.size * (0.6 + a * 0.4);
      ctx.fillStyle = 'rgba(200,235,255,.18)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = p.color; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.45, y - r * 0.5, r * 0.3, r * 0.3);
    } else if (p.kind === 'conf') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.t * 12 + p.vx); ctx.scale(1, Math.cos(p.t * 9 + p.vy));
      ctx.fillStyle = p.color; ctx.fillRect(-2, -1, 4, 2); ctx.restore();
    } else {
      const s = Math.max(0.5, p.size * (p.kind === 'shrink' ? a : 1));
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else { ctx.fillStyle = p.color; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    }
  }
  ctx.globalAlpha = 1;
};

// ---------- textos flutuantes ----------
Z.texts = [];
Z.floatText = (x, y, text, color = '#fff', o = {}) =>
  Z.texts.push({ x, y, text, color, t: 0, life: o.life || 1.1, size: o.size || 11, vy: o.vy !== undefined ? o.vy : -28 });
Z.updateTexts = dt => {
  for (let i = Z.texts.length - 1; i >= 0; i--) {
    const f = Z.texts[i]; f.t += dt; f.y += f.vy * dt;
    if (f.t > f.life) Z.texts.splice(i, 1);
  }
};
Z.drawTexts = (ctx, cam) => {
  for (const f of Z.texts) {
    const a = Z.clamp((f.life - f.t) / 0.3, 0, 1);
    const pop = Math.min(1, f.t / 0.12);
    ctx.globalAlpha = a;
    Z.text(ctx, f.text, f.x - cam.x, f.y - cam.y, f.size * (0.7 + 0.3 * pop), f.color, 'center', '#1a1030', Z.FONT2, 800);
  }
  ctx.globalAlpha = 1;
};

// texto com contorno suave, nítido em qualquer resolução
Z.text = (ctx, str, x, y, size = 8, color = '#fff', align = 'left', outline = '#140f26', font = Z.FONT, weight = 400) => {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = 'top';
  if (outline) {
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1.2, size * 0.28);
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
};

// quebra texto em linhas que cabem numa largura
Z.wrap = (ctx, str, maxW, size, font = Z.FONT, weight = 400) => {
  ctx.font = `${weight} ${size}px ${font}`;
  const out = [];
  for (const para of str.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
};

// ---------- câmera ----------
Z.cam = {
  x: 0, y: 0, shakeT: 0, shakeMag: 0, lock: null,
  shake(mag, t) { this.shakeMag = Math.max(this.shakeMag, mag); this.shakeT = Math.max(this.shakeT, t); },
  follow(p, level, dt, snap) {
    const look = p.facing * 46;
    let tx = p.x + look - Z.W / 2, ty = p.y - Z.H * 0.72;
    let minX = 0, maxX = level.pw - Z.W;
    if (this.lock) { minX = this.lock.x0; maxX = this.lock.x1 - Z.W; }
    tx = Z.clamp(tx, minX, Math.max(minX, maxX));
    ty = Z.clamp(ty, 0, level.ph - Z.H);
    if (snap) { this.x = tx; this.y = ty; }
    else {
      this.x = Z.lerp(this.x, tx, 1 - Math.pow(0.0015, dt));
      // no ar a câmera vertical é mais preguiçosa (não balança a cada pulo)
      const k = p.grounded ? 0.004 : 0.08;
      this.y = Z.lerp(this.y, ty, 1 - Math.pow(k, dt));
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.ox = Z.rand(-1, 1) * this.shakeMag; this.oy = Z.rand(-1, 1) * this.shakeMag;
      if (this.shakeT <= 0) this.shakeMag = 0;
    } else { this.ox = this.oy = 0; }
  },
  view() { return { x: Z.snap(this.x + (this.ox || 0)), y: Z.snap(this.y + (this.oy || 0)) }; },
};
