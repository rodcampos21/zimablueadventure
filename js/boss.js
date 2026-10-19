// Chefe da demo: Julius, o Comuculturista.
// Ataques: soco (curta distância), investida (dash que machuca) e arremesso de pedra.
// Ao ser derrotado ele cai, fica zonzo, levanta e entra para a campanha do Zima.
'use strict';
(() => {
  const G = () => Z.game;
  const BARKS = {
    punch: ['TOMA!', 'Sente o bíceps!', 'Supino neles!'],
    dash: ['LÁ VAI TREM!', 'Sai da frente!', 'Cardio!'],
    rock: ['Pedra do povo!', 'Pega, camarada!', 'Agachamento terra!'],
  };
  const bark = (b, kind) => { if (Math.random() < 0.55) Z.floatText(b.x, b.y - 112, BARKS[kind][Z.irand(0, BARKS[kind].length - 1)], '#ffd6a0', { size: 11, life: 0.9 }); };
  const OUT = ['dying', 'down', 'getup', 'recruited'];

  class Boss extends Z.Enemy {
    constructor(x, y) {
      super(x, y, 40, 90, 26);
      this.name = 'JULIUS, O COMUCULTURISTA';
      this.state = 'intro'; this.st = 0; this.facing = -1; this.last = []; this.phase2 = false; this.vx = 0;
      this.colors = ['#c8262e', '#6a7380', '#e8b48a', '#2e2a22', '#f2c230'];
      this.anim = 'jIdle'; this.animT = 0; this.combo = 0; this.fallA = 0;
    }
    hurtbox() {
      if (OUT.includes(this.state)) return { l: -9, r: -8, t: -9, b: -8 };
      return { l: this.x - 20, r: this.x + 20, t: this.y - 92, b: this.y };
    }
    contactOn() { return false; }
    setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }
    start() { this.state = 'idle'; this.st = 0.9; }
    get speedK() { return this.phase2 ? 1.3 : 1; }

    hurt(d) {
      if (this.state === 'intro' || OUT.includes(this.state)) return;
      this.hp -= d; this.flash = 0.1;
      Z.audio.play('bossHit');
      if (this.hp <= 0) {
        this.hp = 0; this.state = 'dying'; this.st = 0;
        Z.audio.music(null); Z.cam.shake(5, 0.6); G().clearEnemyProjectiles(); G().hitstop(0.25);
        Z.floatText(this.x, this.y - 118, 'AI, MEU DELTOIDE!', '#ffb0b0', { size: 13, life: 1.6 });
        return;
      }
      if (!this.phase2 && this.hp <= this.maxHp / 2 && ['idle', 'walk', 'stun'].includes(this.state)) this.enterPhase2();
    }
    enterPhase2() {
      this.phase2 = true; this.state = 'flex'; this.st = 1.4;
      Z.audio.play('stomp'); Z.cam.shake(5, 0.8);
      Z.floatText(this.x, this.y - 124, 'AGORA É TREINO DE VERDADE!', '#ff9a8a', { size: 13, life: 1.6 });
      G().clearEnemyProjectiles();
    }

    choose() {
      const p = G().player, dist = Math.abs(p.x - this.x);
      this.facing = Z.sign(p.x - this.x);
      const recent = k => this.last.slice(-2).filter(v => v === k).length;
      let pick;
      if (dist < 78 && recent('punch') < 2) pick = 'punch';
      else {
        const opts = [];
        if (recent('dash') < 2) opts.push('dash', 'dash');
        if (recent('rock') < 2) opts.push('rock', 'rock');
        if (dist > 260) opts.push('dash');
        if (dist < 150 && recent('punch') < 2) opts.push('walk', 'walk');
        pick = opts[Z.irand(0, opts.length - 1)] || 'dash';
      }
      this.last.push(pick); if (this.last.length > 4) this.last.shift();
      if (pick === 'punch') { this.state = 'punchWind'; this.st = this.phase2 ? 0.34 : 0.48; this.combo = this.phase2 ? 1 : 0; Z.audio.play('alert'); }
      else if (pick === 'dash') { this.state = 'dashTele'; this.st = this.phase2 ? 0.5 : 0.72; Z.audio.play('stomp'); Z.cam.shake(2, 0.2); }
      else if (pick === 'rock') { this.state = 'rockPick'; this.st = this.phase2 ? 0.5 : 0.7; this.thrown2 = false; }
      else { this.state = 'walk'; this.st = 1.1; }
    }

    update(dt) {
      this.common(dt); this.animT += dt;
      const g = G(), p = g.player, L = g.level, dx = p.x - this.x, K = this.speedK;
      this.st -= dt;
      switch (this.state) {
        case 'intro': this.facing = Z.sign(dx); this.setAnim('jIdle'); break;

        case 'idle':
          this.facing = Z.sign(dx); this.setAnim('jIdle');
          if (this.st <= 0) this.choose();
          break;

        case 'walk':                                          // caminha até o Zima para socar
          this.facing = Z.sign(dx); this.setAnim('jWalk');
          L.move(this, this.facing * 64 * K * dt, 0);
          if (Math.abs(dx) <= 72) { this.state = 'punchWind'; this.st = this.phase2 ? 0.3 : 0.42; this.combo = this.phase2 ? 1 : 0; Z.audio.play('alert'); }
          else if (this.st <= 0) { this.state = 'idle'; this.st = 0.1; }
          break;

        // ----- soco -----
        case 'punchWind':
          this.setAnim('jPunchWind');
          if (this.st <= 0) { this.state = 'punch'; this.st = 0.16; this.hitDone = false; Z.audio.play('swing'); L.move(this, this.facing * 10, 0); bark(this, 'punch'); }
          break;
        case 'punch': {
          this.setAnim(this.combo === 2 ? 'jJab' : 'jPunch');
          if (!this.hitDone && Z.overlap(Z.box(p), this.punchRect())) {
            const res = p.hurt(1, this.x);
            if (res !== 'immune') this.hitDone = true;
            if (res === 'hit') { Z.cam.shake(4, 0.2); Z.emit(p.x, p.y - 40, 10, { color: ['#ffd27a', '#ffffff'], speed: 160, gravity: 0, life: 0.3, size: 2, glow: true }); }
          }
          if (this.st <= 0) {
            if (this.combo === 1) { this.combo = 2; this.state = 'punchWind'; this.st = 0.22; this.facing = Z.sign(dx); }
            else { this.state = 'punchEnd'; this.st = this.phase2 ? 0.35 : 0.5; }
          }
          break;
        }
        case 'punchEnd':
          this.setAnim('jPunchEnd');
          if (this.st <= 0) { this.state = 'idle'; this.st = this.phase2 ? 0.35 : 0.7; }
          break;

        // ----- investida -----
        case 'dashTele':
          this.setAnim('jDashTele');
          if (Math.random() < 0.6) Z.emit(this.x - this.facing * 16, this.y - 2, 2, { color: '#d8c8a8', speed: 80, gravity: -40, life: 0.4, size: 2.5 });
          if (this.st <= 0) { this.state = 'dash'; this.st = 0.62; this.vx = this.facing * (this.phase2 ? 420 : 350); this.dashHit = false; Z.audio.play('roll'); bark(this, 'dash'); }
          break;
        case 'dash': {
          this.setAnim('jDash');
          const r = L.move(this, this.vx * dt, 0);
          if (Math.random() < 0.8) Z.emit(this.x - this.facing * 20, this.y - 3, 1, { color: '#d8c8a8', speed: 50, gravity: -30, life: 0.35, size: 3.5 });
          if (!this.dashHit && Z.overlap(Z.box(p), this.dashRect())) { if (p.hurt(1, this.x) !== 'immune') this.dashHit = true; }
          if (r.hitX) {
            this.state = 'stun'; this.st = this.phase2 ? 0.8 : 1.15; this.vx = 0;
            Z.audio.play('stomp'); Z.cam.shake(6, 0.35);
            Z.emit(this.x + this.facing * 22, this.y - 50, 18, { color: ['#bdb3a6', '#8a8178', '#fff'], speed: 200, size: 2.5 });
            // na fase 2, a pancada na parede derruba pedrinhas do alto
            if (this.phase2) for (let i = 0; i < 2; i++) g.projectiles.push(new Z.Rock(this.x - this.facing * Z.rand(60, 220), g.camView.y - 10, 0, 40, 700, 0.7));
          } else if (this.st <= 0) { this.state = 'dashEnd'; this.st = 0.4; }
          break;
        }
        case 'dashEnd':
          this.setAnim('jDashEnd'); this.vx = Z.approach(this.vx, 0, 1400 * dt); L.move(this, this.vx * dt, 0);
          if (this.st <= 0) { this.state = 'idle'; this.st = this.phase2 ? 0.3 : 0.6; }
          break;
        case 'stun':
          this.setAnim('jIdle');
          if (this.st <= 0) { this.state = 'idle'; this.st = this.phase2 ? 0.25 : 0.5; this.facing = Z.sign(dx); }
          break;

        // ----- pedra -----
        case 'rockPick':
          this.setAnim('jRockPick');
          if (this.st <= 0) { this.state = 'rockLift'; this.st = this.phase2 ? 0.32 : 0.45; this.facing = Z.sign(dx); Z.audio.play('alert'); }
          break;
        case 'rockLift':
          this.setAnim('jRockLift'); this.facing = Z.sign(dx);
          if (this.st <= 0) { this.throwRock(); this.state = 'rockThrow'; this.st = 0.45; bark(this, 'rock'); }
          break;
        case 'rockThrow':
          this.setAnim('jRockThrow');
          if (this.st <= 0) {
            if (this.phase2 && !this.thrown2) { this.thrown2 = true; this.state = 'rockLift'; this.st = 0.3; }
            else { this.state = 'idle'; this.st = this.phase2 ? 0.4 : 0.8; }
          }
          break;

        case 'flex':
          this.setAnim('jFlex');
          if (Math.random() < 0.4) Z.emit(this.x + Z.rand(-26, 26), this.y - Z.rand(10, 96), 1, { color: '#ff9a8a', speed: 70, gravity: -60, life: 0.5, size: 2, glow: true });
          if (this.st <= 0) { this.state = 'idle'; this.st = 0.4; }
          break;

        // ----- derrota: tomba, fica zonzo e levanta -----
        case 'dying':
          this.fallA = Math.min(1, this.fallA + dt * 2.6);
          if (Math.random() < 0.5) Z.emit(this.x + Z.rand(-30, 30), this.y - Z.rand(0, 90), 3, { color: ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#7b68ee'], kind: 'conf', speed: 180, life: 1.2 });
          if (this.fallA >= 1) {
            this.state = 'down'; this.st = 2.0;
            Z.audio.play('stomp'); Z.cam.shake(7, 0.45);
            Z.emit(this.x - this.facing * 50, this.y - 4, 26, { color: ['#d8c8a8', '#bdb3a6'], speed: 160, gravity: -20, life: 0.8, size: 3 });
          }
          break;
        case 'down':
          if (this.st <= 0) { this.state = 'getup'; Z.audio.play('jump'); }
          break;
        case 'getup':
          this.fallA = Math.max(0, this.fallA - dt * 1.6);
          this.makeRoom(dt);
          if (this.fallA <= 0) { this.state = 'recruited'; this.facing = Z.sign(dx); g.onBossDefeated(this); }
          break;
        case 'recruited': this.makeRoom(dt); this.facing = Z.sign(dx); this.setAnim(this.cheer ? 'jFlex' : 'jIdle'); break;
      }
    }

    // depois da luta, não fica em cima do Zima: afasta-se (ou empurra o Zima de leve se estiver na parede)
    makeRoom(dt) {
      const g = G(), p = g.player, dx = p.x - this.x;
      if (Math.abs(dx) >= 58) return;
      const r = g.level.move(this, -Z.sign(dx) * 110 * dt, 0);
      if (r.hitX) g.level.move(p, Z.sign(dx) * 110 * dt, 0);
    }
    punchRect() { const f = this.facing; return f > 0 ? { l: this.x + 12, r: this.x + 74, t: this.y - 76, b: this.y - 32 } : { l: this.x - 74, r: this.x - 12, t: this.y - 76, b: this.y - 32 }; }
    dashRect() { return { l: this.x - 22, r: this.x + 22, t: this.y - 72, b: this.y }; }
    throwRock() {
      const g = G(), p = g.player, f = this.facing;
      const sx = this.x + f * 22, sy = this.y - 92;
      const dx = p.x - sx, grav = 820;
      const T = Z.clamp(Math.abs(dx) / 300, 0.55, 1.05);
      const vx = dx / T, vy = (p.y - 12 - sy - 0.5 * grav * T * T) / T;
      g.projectiles.push(new Z.Rock(sx, sy, vx, vy, grav, 1, this.phase2));
      Z.audio.play('throw'); Z.cam.shake(1.5, 0.1);
    }

    draw(ctx, cam) {
      const x = this.x - cam.x, y = this.y - cam.y;
      if (['dashTele', 'punchWind', 'rockLift'].includes(this.state)) {           // telegrafia
        const k = 0.5 + Math.sin(this.t * 30) * 0.5;
        ctx.fillStyle = `rgba(255,${this.state === 'dashTele' ? 80 : 210},80,${0.12 + k * 0.18})`;
        ctx.beginPath(); ctx.ellipse(x, y - 48, 40, 60, 0, 0, 7); ctx.fill();
        Z.text(ctx, '!', x, y - 124, 18, this.state === 'dashTele' ? '#ff6a6a' : '#ffe14d', 'center', '#3a1a10', Z.FONT2, 800);
      }
      if (this.state === 'dying' || this.state === 'down' || this.state === 'getup') { this.drawFallen(ctx, x, y); return; }
      const shake = this.state === 'dashTele' || this.state === 'flex' ? Z.rand(-1, 1) : 0;
      const f = Z.animFrame(this.anim, this.animT);
      Z.drawFrame(ctx, f, x + shake, y, this.facing);
      if (this.flash > 0) Z.drawFrame(ctx, f, x + shake, y, this.facing, { white: true, alpha: 0.7 });
      if (this.state === 'stun') this.stars(ctx, x, y - 104);
      if (G().debug && this.state === 'punch') { const r = this.punchRect(); ctx.strokeStyle = '#ff0'; ctx.lineWidth = 1 / Z.S; ctx.strokeRect(r.l - cam.x, r.t - cam.y, r.r - r.l, r.b - r.t); }
    }
    // queda: gira o sprite em torno dos pés, tombando para trás (longe do Zima)
    drawFallen(ctx, x, y) {
      const e = this.state === 'getup' ? this.fallA : 1 - Math.pow(1 - this.fallA, 3);
      const bounce = this.state === 'down' && this.st > 1.6 ? Math.abs(Math.sin((2 - this.st) * 16)) * 5 * (this.st - 1.6) * 2.5 : 0;
      ctx.save();
      ctx.translate(Z.snap(x), Z.snap(y - e * 17 - bounce));
      ctx.rotate(-this.facing * e * Math.PI / 2 * 0.98);
      Z.drawFrame(ctx, 'ji0', 0, 0, this.facing);
      ctx.restore();
      if (this.state === 'down') this.stars(ctx, x - this.facing * 96, y - 30);
    }
    stars(ctx, cx, cy) {
      for (let i = 0; i < 3; i++) {
        const a = this.t * 6 + i * 2.1, sx = cx + Math.cos(a) * 16, sy = cy + Math.sin(a) * 4;
        ctx.fillStyle = '#ffe14d'; ctx.beginPath();
        for (let k = 0; k < 10; k++) { const r2 = k % 2 ? 1.2 : 3, aa = k * Math.PI / 5; ctx.lineTo(sx + Math.cos(aa) * r2, sy + Math.sin(aa) * r2); }
        ctx.fill();
      }
    }
  }
  Z.Boss = Boss;
})();
