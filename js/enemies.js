// Inimigos: Atendente (arremessa hambúrguer); projéteis (bolhas, hambúrguer, santinhos e onda sonora do chefe) e itens.
'use strict';
(() => {
  const G = () => Z.game;

  class Enemy {
    constructor(x, y, w, h, hp) { this.x = x; this.y = y; this.w = w; this.h = h; this.hp = hp; this.maxHp = hp; this.flash = 0; this.dead = false; this.facing = -1; this.t = Z.rand(0, 3); this.contact = true; this.kb = 0; }
    hurtbox() { return Z.box(this); }
    hurt(d, dir) {
      this.hp -= d; this.flash = 0.12; this.kb = dir * 140;
      Z.audio.play('hit');
      if (this.hp <= 0) this.die();
      else this.onHurt && this.onHurt(dir);
    }
    die() {
      this.dead = true;
      Z.emit(this.x, this.y - this.h / 2, 14, { color: this.colors || ['#fff'], speed: 160, size: 3, life: 0.7 });
      Z.emit(this.x, this.y - this.h / 2, 6, { color: '#ffffff', speed: 60, gravity: -30, kind: 'shrink', size: 6, life: 0.4 });
      G().stats.kills++;
      // sempre solta um voto de carisma; às vezes um pão de queijo
      G().pickups.push(new Pickup(this.x, this.y - this.h / 2, 'carisma'));
      if (Math.random() < 0.35) G().pickups.push(new Pickup(this.x, this.y - this.h / 2, 'heal'));
    }
    common(dt) { this.t += dt; this.flash = Math.max(0, this.flash - dt); }
  }

  // ---------------- Atendente (inimigo comum: só arremessa hambúrguer) ----------------
  const NOBOX = { l: -9, r: -8, t: -9, b: -8 };
  const THROW_T = 0.36;
  class Atendente extends Enemy {
    constructor(x, y) {
      super(x, y, 18, 54, 3);
      this.hx = x; this.state = 'walk'; this.cd = Z.rand(0.8, 1.6); this.dir = Math.random() < 0.5 ? -1 : 1;
      this.colors = ['#d8262e', '#1e1e24', '#f2c230', '#e9b07a'];
    }
    hurtbox() { return this.dying ? NOBOX : Z.box(this); }
    contactOn() { return false; }                   // não machuca encostando: o único ataque é o hambúrguer
    die() {
      // fica caído um instante antes de sumir; solta os itens já
      this.dying = true; this.dieT = 0; this.state = 'dying';
      G().stats.kills++;
      Z.emit(this.x, this.y - 30, 12, { color: this.colors, speed: 140, size: 2, life: 0.6 });
      G().pickups.push(new Pickup(this.x, this.y - 27, 'carisma'));
      if (Math.random() < 0.35) G().pickups.push(new Pickup(this.x, this.y - 27, 'heal'));
    }
    onHurt() { this.state = 'hurt'; this.st = 0.3; }
    throwBurger() {
      const p = G().player, f = this.facing;
      const sx = this.x + f * 16, sy = this.y - 44;
      const dx = p.x - sx;
      if (Math.abs(dx) < 120) {
        // de perto: arremesso reto na altura do peito (agache, pule ou role)
        G().projectiles.push(new Burger(sx, sy, f * 235, 0, 0));
      } else {
        // de longe: arremesso em arco mirando onde o Zima está (saia do lugar!)
        const g = 700, T = Z.clamp(Math.abs(dx) / 260, 0.55, 1.1);
        const vx = dx / T, vy = (p.y - 14 - sy - 0.5 * g * T * T) / T;
        G().projectiles.push(new Burger(sx, sy, vx, vy, g));
      }
      Z.audio.play('throw');
    }
    update(dt) {
      this.common(dt);
      if (this.dying) { this.dieT += dt; if (this.dieT > 1.7) { this.dead = true; Z.emit(this.x, this.y - 10, 8, { color: '#ffffff', speed: 50, gravity: -40, kind: 'shrink', size: 5, life: 0.4 }); } return; }
      const p = G().player, dx = p.x - this.x, L = G().level;
      const aware = Math.abs(dx) < 300 && Math.abs(p.y - this.y) < 130 && p.state !== 'dead';
      let vx = 0;
      if (this.kb) { vx = this.kb; this.kb = Z.approach(this.kb, 0, 600 * dt); }
      this.cd -= dt;
      switch (this.state) {
        case 'walk':
          if (aware) {
            this.facing = Z.sign(dx);
            if (Math.abs(dx) > 220) vx += this.facing * 34;          // aproxima-se até ter o Zima a tiro
            if (this.cd <= 0) { this.state = 'wind'; this.st = 0.5; Z.audio.play('alert'); }
          } else {
            vx += this.dir * 30; this.facing = this.dir;
            if (Math.abs(this.x - this.hx) > 56) this.dir = Z.sign(this.hx - this.x);
          }
          break;
        case 'wind':
          this.st -= dt; this.facing = Z.sign(dx);
          if (this.st <= 0) { this.throwBurger(); this.state = 'throw'; this.st = THROW_T; }
          break;
        case 'throw':
          this.st -= dt;
          if (this.st <= 0) { this.state = 'walk'; this.cd = Z.rand(1.5, 2.3); }
          break;
        case 'hurt':
          this.st -= dt;
          if (this.st <= 0) { this.state = 'walk'; this.cd = Math.max(this.cd, 0.7); }
          break;
      }
      const ahead = this.x + Z.sign(vx || 1) * 12;
      if (vx && !L.solidAt(ahead, this.y + 4)) vx = 0;          // não cai de beiradas
      L.move(this, vx * dt, 0);
      this.walking = Math.abs(vx) > 5;
    }
    frame() {
      switch (this.state) {
        case 'dying': return Z.animFrame('atDie', this.dieT);
        case 'hurt': return Z.animFrame('atHurt', 0);
        case 'wind': return Z.animFrame('atWind', 0);
        case 'throw': return Z.animProgress('atThrow', 1 - this.st / THROW_T);
        default: return this.walking ? Z.animFrame('atWalk', this.t) : Z.animFrame('atIdle', 0);
      }
    }
    draw(ctx, cam) {
      if (this.dying && this.dieT > 1.15 && Math.floor(this.dieT * 14) % 2) return;
      const x = this.x - cam.x, y = this.y - cam.y, f = this.frame();
      Z.drawFrame(ctx, f, x, y, this.facing);
      if (this.flash > 0) Z.drawFrame(ctx, f, x, y, this.facing, { white: true, alpha: 0.75 });
      if (this.state === 'wind') {
        Z.text(ctx, '!', x, y - 76, 14, '#ffe14d', 'center', '#3a1a10', Z.FONT2, 800);
        // hambúrguer na mão, pronto para sair
        Z.drawFrame(ctx, 'burger', x - this.facing * 10, y - 62 + Math.sin(this.t * 30) * 0.6, this.facing, { scale: 0.8 });
      }
    }
  }

  // ---------------- projéteis ----------------
  class Bubble {
    constructor(x, y, vx, vy) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.r = Z.rand(4, 7); this.t = 0; this.life = 1.15; this.dead = false; this.player = true; this.ph = Z.rand(0, 6); }
    box() { return { l: this.x - this.r, r: this.x + this.r, t: this.y - this.r, b: this.y + this.r }; }
    pop() {
      this.dead = true; Z.audio.play('pop');
      Z.emit(this.x, this.y, 6, { color: ['#d8f2ff', '#ffffff'], speed: 70, gravity: 0, life: 0.25, size: 2 });
    }
    update(dt) {
      const g = G(), L = g.level;
      this.t += dt; this.vy -= 18 * dt;
      this.x += this.vx * dt; this.y += (this.vy + Math.sin(this.t * 10 + this.ph) * 30) * dt;
      this.vx *= (1 - 0.35 * dt);
      if (this.t > this.life) { this.pop(); return; }
      const b = this.box();
      for (const e of g.enemies) {
        if (e.dead || !e.hurtbox) continue;
        if (Z.overlap(b, e.hurtbox())) { e.hurt(0.5, Z.sign(this.vx), 'bubble'); this.pop(); g.hitstop(0.02); return; }
      }
      for (const p of g.projectiles) if (p.enemy && p.breakable && !p.dead && Z.overlap(b, p.box())) { p.destroy(); this.pop(); return; }
      const lv = L.lever;
      if (!lv.on && Z.overlap(b, { l: lv.x - 10, r: lv.x + 10, t: lv.y - 60, b: lv.y - 26 })) { L.lowerBridge(); this.pop(); return; }
      if (L.hitRect(b, 1)) { this.pop(); return; }
      if (L.solidAt(this.x, this.y)) this.pop();
    }
    draw(ctx, cam) {
      const x = this.x - cam.x, y = this.y - cam.y, r = this.r * (1 + Math.sin(this.t * 14 + this.ph) * 0.06);
      ctx.fillStyle = Z.art.rad(ctx, x - r * 0.3, y - r * 0.3, r * 0.1, r, [[0, 'rgba(255,255,255,.05)'], [0.7, 'rgba(170,220,255,.18)'], [1, 'rgba(200,240,255,.55)']]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(230,248,255,.95)'; ctx.lineWidth = 0.7; ctx.stroke();
      // reflexo furta-cor
      ctx.strokeStyle = 'rgba(255,160,230,.55)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0.3, 1.4); ctx.stroke();
      ctx.strokeStyle = 'rgba(140,255,210,.45)'; ctx.beginPath(); ctx.arc(x, y, r * 0.78, 3.4, 4.2); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x - r * 0.4, y - r * 0.45, r * 0.22, r * 0.14, -0.6, 0, 7); ctx.fill();
    }
  }

  class Santinho {
    constructor(x, y, vx, vy = 0, grav = 0) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.grav = grav; this.t = 0; this.dead = false; this.enemy = true; this.breakable = true; }
    box() { return { l: this.x - 5, r: this.x + 5, t: this.y - 4, b: this.y + 4 }; }
    destroy() { this.dead = true; Z.emit(this.x, this.y, 6, { color: ['#f4f1e6', '#c8323c'], speed: 90, size: 2, life: 0.5 }); }
    update(dt) {
      const g = G(); this.t += dt;
      this.vy += this.grav * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.t > 3 || g.level.solidAt(this.x, this.y)) { this.destroy(); return; }
      if (Z.overlap(this.box(), Z.box(g.player))) {
        const r = g.player.hurt(1, this.x);
        if (r === 'hit') this.destroy();
      }
    }
    draw(ctx, cam) {
      ctx.save(); ctx.translate(this.x - cam.x, this.y - cam.y);
      ctx.rotate(Math.sin(this.t * 9) * 0.25); ctx.scale(Math.cos(this.t * 14), 1);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-4.2, -3.2, 10, 8);
      ctx.fillStyle = Z.art.lin(ctx, 0, -4, 0, 4, [[0, '#ffffff'], [1, '#ddd6c2']]); ctx.fillRect(-5, -4, 10, 8);
      ctx.fillStyle = '#c8323c'; ctx.fillRect(-5, -4, 10, 2.2); ctx.fillRect(-5, 2.6, 10, 1.4);
      ctx.fillStyle = '#d39a74'; ctx.beginPath(); ctx.arc(0, 0.2, 1.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#eee'; ctx.fillRect(-1.8, 1, 3.6, 0.8);
      ctx.lineWidth = 0.5; ctx.strokeStyle = '#6a5a4a'; ctx.strokeRect(-5, -4, 10, 8);
      ctx.restore();
    }
  }

  class Burger extends Santinho {
    box() { return { l: this.x - 5.5, r: this.x + 5.5, t: this.y - 5, b: this.y + 5 }; }
    destroy() {
      this.dead = true; Z.audio.play('pop');
      Z.emit(this.x, this.y, 12, { color: ['#d9993f', '#f0c070', '#5fae3a', '#d8302a', '#6a3a1c', '#ffd34d'], speed: 130, size: 2.2, life: 0.55 });
    }
    draw(ctx, cam) {
      const x = this.x - cam.x, y = this.y - cam.y;
      ctx.fillStyle = 'rgba(25,12,30,.18)'; ctx.beginPath(); ctx.ellipse(x, y + 6, 5, 1.2, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(Z.snap(x), Z.snap(y)); ctx.rotate(this.t * 7 * Z.sign(this.vx || 1));
      Z.drawFrame(ctx, 'burger', 0, 0, 1);
      ctx.restore();
    }
  }

  class Wave {
    constructor(x, y, dir, speed = 235) { this.x = x; this.y = y; this.vx = dir * speed; this.t = 0; this.dead = false; this.enemy = true; this.w = 22; this.h = 22; }
    box() { return { l: this.x - this.w / 2, r: this.x + this.w / 2, t: this.y - this.h, b: this.y }; }
    update(dt) {
      const g = G(); this.t += dt; this.x += this.vx * dt;
      if (Math.random() < 0.6) Z.emit(this.x, this.y - 2, 1, { color: '#e8d8a8', speed: 40, gravity: -30, life: 0.3, size: 2 });
      if (g.level.solidAt(this.x + Z.sign(this.vx) * 12, this.y - 8) || this.t > 4) { this.dead = true; return; }
      if (Z.overlap(this.box(), Z.box(g.player))) g.player.hurt(1, this.x);
    }
    draw(ctx, cam) {
      const x = this.x - cam.x, y = this.y - cam.y, d = Z.sign(this.vx);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = Z.art.rad(ctx, x, y - 10, 1, 22, [[0, 'rgba(255,220,140,.45)'], [1, 'rgba(255,200,120,0)']]); ctx.fillRect(x - 24, y - 34, 48, 34);
      ctx.restore();
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i === 0 ? '#fff6c8' : i === 1 ? 'rgba(255,214,120,.8)' : 'rgba(255,170,90,.5)';
        ctx.lineWidth = 2.2 - i * 0.5;
        ctx.beginPath(); ctx.arc(x - d * (i * 7), y - 2, 12 + (this.t * 8 % 3), d > 0 ? -1.3 : Math.PI - 0.27, d > 0 ? 0.27 : Math.PI + 1.3); ctx.stroke();
      }
    }
  }

  // ---------------- itens ----------------
  class Pickup {
    constructor(x, y, kind) { this.x = x; this.y = y; this.kind = kind; this.vx = Z.rand(-60, 60); this.vy = -160; this.t = 0; this.dead = false; this.w = 8; this.h = 8; }
    update(dt) {
      const g = G(), p = g.player, L = g.level;
      this.t += dt;
      const dx = p.x - this.x, dy = (p.y - 26) - this.y, d = Math.hypot(dx, dy);
      if (this.t > 0.4 && d < 60 && p.state !== 'dead') { this.x += dx / d * 220 * dt; this.y += dy / d * 220 * dt; }
      else {
        this.vy = Math.min(400, this.vy + 900 * dt);
        const r = L.move(this, this.vx * dt, this.vy * dt);
        if (r.hitY) { this.vy *= -0.35; this.vx *= 0.6; }
        if (r.hitX) this.vx *= -0.5;
      }
      if (this.t > 10) this.dead = true;
      if (d < 14 && p.state !== 'dead') {
        this.dead = true;
        if (this.kind === 'heal') {
          if (p.hp < p.maxHp) { p.hp++; Z.floatText(p.x, p.y - 64, '+1 vida', '#ffb3c0'); } Z.audio.play('heal');
        } else { p.gainCarisma(0.25); Z.audio.play('pop'); }
      }
    }
    draw(ctx, cam) {
      if (this.t > 8 && Math.floor(this.t * 10) % 2) return;
      const x = this.x - cam.x, y = this.y - cam.y;
      if (this.kind === 'heal') { // pão de queijo
        ctx.fillStyle = Z.art.rad(ctx, x - 1.5, y - 6, 0.5, 6, [[0, '#ffe8a0'], [1, '#c98a2a']]); ctx.beginPath(); ctx.arc(x, y - 4.5, 5, 0, 7); ctx.fill();
        ctx.lineWidth = 0.6; ctx.strokeStyle = '#7a4a14'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x - 2.5, y - 7.5, 2, 1);
      } else {
        const s = 2.5 + Math.sin(this.t * 10) * 0.8;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = Z.art.rad(ctx, x, y - 4, 0.5, 8, [[0, 'rgba(160,225,255,.8)'], [1, 'rgba(160,225,255,0)']]); ctx.fillRect(x - 8, y - 12, 16, 16);
        ctx.restore();
        ctx.fillStyle = '#bfeaff'; ctx.beginPath(); ctx.moveTo(x, y - 4 - s * 1.6); ctx.lineTo(x + 1, y - 5); ctx.lineTo(x + s * 1.6, y - 4); ctx.lineTo(x + 1, y - 3); ctx.lineTo(x, y - 4 + s * 1.6); ctx.lineTo(x - 1, y - 3); ctx.lineTo(x - s * 1.6, y - 4); ctx.lineTo(x - 1, y - 5); ctx.fill();
      }
    }
  }

  Z.Enemy = Enemy; Z.Atendente = Atendente;
  Z.Bubble = Bubble; Z.Santinho = Santinho; Z.Burger = Burger; Z.Wave = Wave; Z.Pickup = Pickup;
})();
