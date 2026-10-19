// Chefe do tutorial: Coronel Bigodão, o Prefeito Eterno.
'use strict';
(() => {
  const G = () => Z.game;

  class Boss extends Z.Enemy {
    constructor(x, y) {
      super(x, y, 40, 86, 24);
      this.name = 'CORONEL BIGODÃO'; this.title = 'O Prefeito Eterno';
      this.state = 'intro'; this.st = 0; this.facing = -1; this.last = ''; this.phase2 = false; this.vx = 0;
      this.colors = ['#f1ece0', '#c8323c', '#6b4423', '#eeeeee', '#e6c35a'];
    }
    hurtbox() { return { l: this.x - 18, r: this.x + 18, t: this.y - 96, b: this.y }; }
    get pose() {
      return { idle: 'idle', walk: 'idle', stompTele: 'charge', charge: 'charge', stun: 'stun', raise: 'raise', throw: 'throw', megaTele: 'mega', mega: 'mega', roar: 'raise', dying: 'stun', intro: 'idle' }[this.state] || 'idle';
    }
    get contactActive() { return !['stun', 'dying', 'intro'].includes(this.state); }

    start() { this.state = 'idle'; this.st = 1.0; }
    hurt(d, dir, src) {
      if (this.state === 'dying' || this.state === 'intro') return;
      this.hp -= d; this.flash = 0.1;
      Z.audio.play('bossHit');
      if (this.hp <= 0) { this.hp = 0; this.state = 'dying'; this.st = 2.2; Z.audio.music(null); Z.cam.shake(5, 1.5); G().clearEnemyProjectiles(); return; }
      if (!this.phase2 && this.hp <= this.maxHp / 2 && ['idle', 'walk', 'stun'].includes(this.state)) this.enterPhase2();
    }
    enterPhase2() {
      this.phase2 = true; this.state = 'roar'; this.st = 1.3;
      Z.audio.play('stomp'); Z.cam.shake(5, 0.8);
      Z.floatText(this.x, this.y - 120, 'VOCÊS VÃO VER!', '#ff8a8a', { life: 1.5, size: 10 });
      G().clearEnemyProjectiles();
    }
    choose() {
      const p = G().player, dist = Math.abs(p.x - this.x);
      const opts = [];
      if (this.last !== 'charge') opts.push('charge', 'charge');
      if (this.last !== 'flyers') opts.push('flyers', 'flyers');
      if (this.last !== 'mega') opts.push('mega', 'mega');
      if (dist > 260) opts.push('charge');
      const pick = opts[Z.irand(0, opts.length - 1)];
      this.last = pick;
      this.facing = Z.sign(p.x - this.x);
      if (pick === 'charge') { this.state = 'stompTele'; this.st = this.phase2 ? 0.48 : 0.7; Z.audio.play('stomp'); Z.cam.shake(2, 0.2); }
      else if (pick === 'flyers') { this.state = 'raise'; this.st = this.phase2 ? 0.4 : 0.55; this.thrown = 0; Z.audio.play('alert'); }
      else { this.state = 'megaTele'; this.st = this.phase2 ? 0.55 : 0.8; this.waves = 0; Z.audio.play('alert'); }
    }

    update(dt) {
      this.common(dt);
      const g = G(), p = g.player, L = g.level, dx = p.x - this.x;
      this.st -= dt;
      switch (this.state) {
        case 'intro': break;
        case 'idle':
          this.facing = Z.sign(dx);
          if (Math.abs(dx) > 170) L.move(this, this.facing * (this.phase2 ? 55 : 38) * dt, 0);
          if (this.st <= 0) this.choose();
          break;
        case 'stompTele':
          if (Math.random() < 0.5) Z.emit(this.x - this.facing * 14, this.y - 2, 2, { color: '#d8c8a8', speed: 80, gravity: -40, life: 0.4, size: 3 });
          if (this.st <= 0) { this.state = 'charge'; this.vx = this.facing * (this.phase2 ? 400 : 330); }
          break;
        case 'charge': {
          const r = L.move(this, this.vx * dt, 0);
          if (Math.random() < 0.7) Z.emit(this.x - this.facing * 18, this.y - 3, 1, { color: '#d8c8a8', speed: 50, gravity: -30, life: 0.35, size: 4 });
          if (r.hitX) {
            this.state = 'stun'; this.st = this.phase2 ? 0.75 : 1.1; this.vx = 0;
            Z.audio.play('stomp'); Z.cam.shake(6, 0.35);
            Z.emit(this.x + this.facing * 22, this.y - 40, 16, { color: ['#bdb3a6', '#8a8178', '#fff'], speed: 200, size: 3 });
            if (this.phase2) for (let i = 0; i < 3; i++) g.projectiles.push(new Z.Santinho(this.x + Z.rand(-120, 120), g.camView.y - 10, 0, 60, 120 + i * 30)); // santinhos caindo do céu
          }
          break;
        }
        case 'stun':
          if (this.st <= 0) { this.state = 'idle'; this.st = this.phase2 ? 0.35 : 0.7; this.facing = Z.sign(dx); }
          break;
        case 'raise':
          if (this.st <= 0) { this.state = 'throw'; this.st = 0; }
          break;
        case 'throw': {
          const n = this.phase2 ? 5 : 3;
          if (this.st <= 0 && this.thrown < n) {
            // no fim da fase 2 o último santinho vem rasteiro: só rolando
            const low = this.phase2 && this.thrown === n - 1;
            g.projectiles.push(new Z.Santinho(this.x + this.facing * 40, this.y - (low ? 12 : 44 + (this.thrown % 2) * 4), this.facing * (this.phase2 ? 235 : 200)));
            Z.audio.play('throw'); this.thrown++; this.st = this.phase2 ? 0.2 : 0.3;
          }
          if (this.thrown >= n && this.st <= 0) { this.state = 'idle'; this.st = this.phase2 ? 0.55 : 1.0; }
          break;
        }
        case 'megaTele':
          if (this.st <= 0) { this.state = 'mega'; this.st = 0; }
          break;
        case 'mega': {
          const n = this.phase2 ? 2 : 1;
          if (this.st <= 0 && this.waves < n) {
            g.projectiles.push(new Z.Wave(this.x + this.facing * 46, this.y, this.facing, this.phase2 ? 260 : 230));
            Z.audio.play('wave'); Z.cam.shake(2, 0.2); this.waves++; this.st = 0.6;
          }
          if (this.waves >= n && this.st <= 0) { this.state = 'idle'; this.st = this.phase2 ? 0.5 : 0.9; }
          break;
        }
        case 'roar':
          if (Math.random() < 0.4) Z.emit(this.x + Z.rand(-30, 30), this.y - Z.rand(0, 90), 1, { color: '#ff8a8a', speed: 80, gravity: -60, life: 0.5, size: 3 });
          if (this.st <= 0) {
            const a = L.arena;
            g.enemies.push(new Z.Atendente(a.x0 + 70, this.y), new Z.Atendente(a.x1 - 70, this.y));
            this.state = 'idle'; this.st = 0.6;
          }
          break;
        case 'dying':
          if (Math.random() < 0.5) Z.emit(this.x + Z.rand(-30, 30), this.y - Z.rand(0, 90), 4, { color: ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#7b68ee'], kind: 'conf', speed: 200, life: 1.2 });
          if (this.st <= 0) { this.dead = true; g.onBossDefeated(this); }
          break;
      }
      // dano de contato
      if (this.contactActive && Z.overlap(Z.box(p), { l: this.x - 18, r: this.x + 18, t: this.y - 80, b: this.y })) p.hurt(1, this.x);
    }
    draw(ctx, cam) {
      if (this.state === 'dying' && Math.floor(this.st * 16) % 2) return;
      const x = this.x - cam.x, y = this.y - cam.y;
      ctx.fillStyle = 'rgba(25,12,30,.32)'; ctx.beginPath(); ctx.ellipse(x, y - 0.5, 30, 3.5, 0, 0, 7); ctx.fill();
      // telegrafia visível
      if (this.state === 'stompTele' || this.state === 'raise' || this.state === 'megaTele') {
        const k = 0.5 + Math.sin(this.t * 30) * 0.5;
        ctx.fillStyle = `rgba(255,${this.state === 'stompTele' ? 80 : 220},80,${0.15 + k * 0.2})`;
        ctx.beginPath(); ctx.ellipse(x, y - 52, 36, 60, 0, 0, 7); ctx.fill();
        Z.text(ctx, '!', x, y - 132, 18, this.state === 'stompTele' ? '#ff6a6a' : '#ffe14d', 'center', '#3a1a10', Z.FONT2, 800);
      }
      const shake = this.state === 'stompTele' ? Z.rand(-1, 1) : 0;
      Z.art.boss(ctx, x + shake, y, this.facing, this.t, this.pose, this.flash > 0, this.phase2);
      if (this.state === 'megaTele') {
        const r = 6 + (1 - Math.max(0, this.st) / 0.8) * 16;
        ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x + this.facing * 50, y - 62, r, 0, 7); ctx.stroke();
      }
    }
  }
  Z.Boss = Boss;
})();
