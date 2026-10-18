// Inimigos (Pombo, Cabo Eleitoral), projéteis (bolhas, santinhos, onda sonora) e itens.
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

  // ---------------- Pombo da Praça ----------------
  class Pombo extends Enemy {
    constructor(x, y) { super(x, y, 18, 13, 2); this.hx = x; this.hy = y; this.state = 'hover'; this.cd = Z.rand(0.5, 1.5); this.colors = ['#8d90a0', '#686b7a', '#5aa182', '#ffffff']; }
    update(dt) {
      this.common(dt);
      const p = G().player, dx = p.x - this.x, dy = (p.y - 30) - this.y;
      this.cd -= dt;
      if (this.kb) { this.x += this.kb * dt; this.kb = Z.approach(this.kb, 0, 500 * dt); }
      switch (this.state) {
        case 'hover':
          this.x = Z.lerp(this.x, this.hx + Math.sin(this.t * 1.3) * 28, 2 * dt);
          this.y = Z.lerp(this.y, this.hy + Math.sin(this.t * 2.6) * 6, 3 * dt);
          this.facing = Z.sign(dx);
          if (this.cd <= 0 && Math.abs(dx) < 150 && Math.abs(p.x - this.hx) < 200 && dy > -20 && dy < 150 && p.state !== 'dead') {
            this.state = 'alert'; this.st = 0.45; Z.audio.play('coo');
          }
          break;
        case 'alert':
          this.st -= dt; this.y -= 20 * dt;
          if (this.st <= 0) {
            const tx = p.x, ty = p.y - 2, d = Math.hypot(tx - this.x, ty - this.y) || 1;
            this.vx = (tx - this.x) / d * 270; this.vy = (ty - this.y) / d * 270;
            this.facing = Z.sign(this.vx); this.state = 'dive'; this.st = 1.3;
          }
          break;
        case 'dive': {
          this.st -= dt; this.x += this.vx * dt; this.y += this.vy * dt;
          const L = G().level;
          if (L.solidAt(this.x, this.y)) {
            // pousa e fica bicando o chão: a hora de bater!
            this.y = Math.floor(this.y / Z.T) * Z.T; this.state = 'peck'; this.st = 1.2;
            Z.emit(this.x, this.y, 5, { color: '#c9b9a0', speed: 50, gravity: 0, life: 0.3, size: 2 });
          } else if (this.st <= 0) { this.state = 'return'; this.cd = 1.5; }
          break;
        }
        case 'peck':
          this.st -= dt;
          if (this.st <= 0) { this.state = 'return'; this.cd = 1.6; }
          break;
        case 'return': {
          const rx = this.hx - this.x, ry = this.hy - this.y, d = Math.hypot(rx, ry);
          if (d < 4) { this.state = 'hover'; break; }
          this.x += rx / d * 95 * dt; this.y += ry / d * 95 * dt; this.facing = Z.sign(rx);
          break;
        }
      }
    }
    contactOn() { return this.state === 'dive'; }
    onHurt() { if (this.state === 'dive' || this.state === 'alert') { this.state = 'return'; this.cd = 1.8; } }
    draw(ctx, cam) {
      const peckBob = this.state === 'peck' && Math.sin(this.t * 18) > 0 ? 2 : 0;
      Z.art.pigeon(ctx, this.x - cam.x, this.y - cam.y + peckBob, this.facing, this.t, this.state === 'peck' ? 'dive' : this.state, this.flash > 0);
      if (this.state === 'alert') Z.text(ctx, '!', Math.round(this.x - cam.x), Math.round(this.y - cam.y - 28), 10, '#ffe14d', 'center');
    }
  }

  // ---------------- Cabo Eleitoral do Coronel ----------------
  class Cabo extends Enemy {
    constructor(x, y) { super(x, y, 18, 48, 3); this.hx = x; this.state = 'walk'; this.cd = Z.rand(0.6, 1.2); this.dir = -1; this.colors = ['#c8323c', '#34508a', '#f4f1e6', '#ffd34d']; }
    update(dt) {
      this.common(dt);
      const p = G().player, dx = p.x - this.x, L = G().level;
      const aware = Math.abs(dx) < 290 && Math.abs(p.y - this.y) < 70 && p.state !== 'dead';
      let vx = 0;
      if (this.kb) { vx = this.kb; this.kb = Z.approach(this.kb, 0, 600 * dt); }
      this.cd -= dt;
      switch (this.state) {
        case 'walk':
          if (aware) {
            this.facing = Z.sign(dx);
            // mantém distância
            if (Math.abs(dx) < 90) vx += -this.facing * 35; else if (Math.abs(dx) > 200) vx += this.facing * 30;
            if (this.cd <= 0) { this.state = 'wind'; this.st = 0.5; Z.audio.play('alert'); }
          } else {
            vx += this.dir * 28; this.facing = this.dir;
            if (Math.abs(this.x - this.hx) > 50) this.dir = Z.sign(this.hx - this.x);
          }
          break;
        case 'wind':
          this.st -= dt; this.facing = Z.sign(dx);
          if (this.st <= 0) {
            G().projectiles.push(new Santinho(this.x + this.facing * 12, this.y - 44, this.facing * 175));
            Z.audio.play('throw'); this.state = 'throw'; this.st = 0.3;
          }
          break;
        case 'throw':
          this.st -= dt;
          if (this.st <= 0) { this.state = 'walk'; this.cd = Z.rand(1.4, 2.1); }
          break;
      }
      // não cai de beiradas
      const ahead = this.x + Z.sign(vx || 1) * 12;
      if (vx && !L.solidAt(ahead, this.y + 4)) vx = 0;
      L.move(this, vx * dt, 0);
      this.walking = Math.abs(vx) > 5;
    }
    onHurt() { if (this.state === 'wind') { this.state = 'walk'; this.cd = 0.9; } }
    draw(ctx, cam) {
      Z.art.cabo(ctx, this.x - cam.x, this.y - cam.y, this.facing, this.t, this.state, this.flash > 0, this.walking);
      if (this.state === 'wind') Z.text(ctx, '!', Math.round(this.x - cam.x), Math.round(this.y - cam.y - 64), 10, '#ffe14d', 'center');
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
      const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
      ctx.fillStyle = 'rgba(190,230,255,.22)'; ctx.beginPath(); ctx.arc(x, y, this.r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d8f2ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, this.r, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - Math.round(this.r * 0.5), y - Math.round(this.r * 0.5), 2, 2);
      ctx.fillStyle = 'rgba(255,170,230,.6)'; ctx.fillRect(x + Math.round(this.r * 0.3), y + Math.round(this.r * 0.2), 1, 2);
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
      ctx.save(); ctx.translate(Math.round(this.x - cam.x), Math.round(this.y - cam.y));
      const sx = Math.cos(this.t * 14);
      ctx.scale(sx, 1);
      ctx.fillStyle = '#f4f1e6'; ctx.fillRect(-5, -4, 10, 8);
      ctx.fillStyle = '#c8323c'; ctx.fillRect(-5, -4, 10, 2);
      ctx.fillStyle = '#c98b5e'; ctx.fillRect(-2, -1, 4, 3);
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
      const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y), d = Z.sign(this.vx);
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i === 0 ? '#fff6c8' : i === 1 ? 'rgba(255,214,120,.8)' : 'rgba(255,170,90,.5)';
        ctx.lineWidth = 2;
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
      const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
      if (this.kind === 'heal') { // pão de queijo
        ctx.fillStyle = '#e9b94a'; ctx.beginPath(); ctx.arc(x, y - 4, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#f7d77a'; ctx.fillRect(x - 2, y - 7, 3, 2);
      } else {
        const s = 2 + Math.round(Math.sin(this.t * 10));
        ctx.fillStyle = '#9fe0ff'; ctx.fillRect(x - 1, y - 4 - s, 2, s * 2 + 2); ctx.fillRect(x - 1 - s, y - 4, s * 2 + 2, 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 4, 2, 2);
      }
    }
  }

  Z.Enemy = Enemy; Z.Pombo = Pombo; Z.Cabo = Cabo;
  Z.Bubble = Bubble; Z.Santinho = Santinho; Z.Wave = Wave; Z.Pickup = Pickup;
})();
