// Zima: andar, pular, agachar, rolar com janela de invencibilidade, ataque com a rede e jato de bolhas.
'use strict';
(() => {
  const STAND_H = 54, CROUCH_H = 28;
  const RUN = 132, CROUCH_SPEED = 62, ACC = 1400, DEC = 1800, ACC_AIR = 1050;
  const GRAV = 1500, GRAV_FALL = 1800, MAX_FALL = 640;
  const JUMP_V = 500, JUMP_CUT = 0.45, COYOTE = 0.1;      // pulo variável: segurar = mais alto (~4,6 tiles)
  const ROLL_DUR = 0.46, ROLL_SPEED = 235, ROLL_CD = 0.18;
  const IFRAME_START = 0.05, IFRAME_END = 0.22;            // janela de invencibilidade do rolamento
  const ATK_DUR = 0.34, ATK_ON = 0.07, ATK_OFF = 0.19;
  const SPC_DUR = 0.62, SPC_FIRE = 0.3;

  // ---------- sprites do Zima (atlas em alta resolução) ----------
  let atlas, img, whiteImg, ghostImg, SC = 1;
  Z.loadAtlas = () => new Promise((res, rej) => {
    atlas = window.ZIMA_ATLAS; SC = atlas.scale || 1;
    img = new Image();
    img.onload = () => { whiteImg = tinted('#ffffff'); ghostImg = tinted('#7fd0ff'); res(); };
    img.onerror = rej;
    img.src = atlas.image;
  });
  function tinted(col) {
    const c = Z.art.canvas(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  // Desenha um quadro. Ampliar = vizinho mais próximo (pixel art nítido); reduzir = filtro de alta qualidade.
  Z.drawFrame = (ctx, name, x, y, facing, o = {}) => {
    const f = atlas.frames[name]; if (!f) return;
    const [sx, sy, w, h, ax, ay] = f;
    const src = o.white ? whiteImg : o.ghost ? ghostImg : img;
    const s = (o.scale || 1) / SC;
    const ratio = Z.S * s;                       // pixels de tela por pixel do sprite
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.imageSmoothingEnabled = ratio < 0.98;
    if (ratio < 0.98) ctx.imageSmoothingQuality = 'high';
    ctx.translate(Z.snap(x), Z.snap(y));
    ctx.scale(facing * s, s);
    ctx.drawImage(src, sx, sy, w, h, -ax, -ay, w, h);
    ctx.restore();
  };
  Z.animFrame = (anim, t) => {
    const a = atlas.anims[anim];
    let i = Math.floor(t * a.fps);
    i = a.loop ? i % a.frames.length : Math.min(i, a.frames.length - 1);
    return a.frames[i];
  };
  Z.animProgress = (anim, p) => { const a = atlas.anims[anim]; return a.frames[Math.min(a.frames.length - 1, Math.floor(p * a.frames.length))]; };
  // recorte da cabeça de um quadro para retratos de diálogo (fx = início horizontal, fw = largura do recorte)
  Z.drawPortrait = (ctx, x, y, size, name = 'idle_walk0', fx = 0.16, fw = 0.62, flip = false) => {
    const [sx, sy, w] = atlas.frames[name];
    const cut = Math.round(w * fw);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (flip) { ctx.translate(x + size, y); ctx.scale(-1, 1); x = 0; y = 0; }
    ctx.drawImage(img, sx + Math.round(w * fx), sy, cut, cut, x, y, size, size);
    ctx.restore();
  };

  class Player {
    constructor(x, y, save) {
      this.x = x; this.y = y; this.w = 16; this.h = STAND_H;
      this.vx = 0; this.vy = 0; this.facing = 1;
      this.maxHp = 5 + (save.coxinha ? 1 : 0); this.hp = this.maxHp;
      this.maxCar = 3 + (save.chest ? 1 : 0); this.carisma = 1;
      this.state = 'idle'; this.anim = 'idle'; this.animT = 0;
      this.rollT = 0; this.rollCd = 0; this.atkT = 0; this.spcT = 0; this.fired = 0;
      this.invuln = 0; this.hurtT = 0; this.perfectUsed = false; this.crouchT = 0; this.grace = 0;
      this.ghosts = []; this.atkHits = new Set(); this.grounded = true; this.stepT = 0;
      this.coyote = 0; this.jumping = false; this.landT = 0; this.airAttack = false;
      this.lastSafe = { x, y };
    }
    get rolling() { return this.state === 'roll'; }
    get iframes() { return this.rolling && this.rollT >= IFRAME_START && this.rollT <= IFRAME_END; }
    headroom(h = STAND_H) { return !Z.game.level.rectSolid(this.x - this.w / 2 + 0.5, this.y - h, this.x + this.w / 2 - 0.5, this.y - 1); }

    setState(s) { if (this.state !== s) { this.state = s; } }
    setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }

    update(dt, I) {
      const L = Z.game.level;
      this.animT += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      this.grace = Math.max(0, this.grace - dt);
      this.rollCd = Math.max(0, this.rollCd - dt);
      this.landT = Math.max(0, this.landT - dt);
      this.coyote = this.grounded ? COYOTE : Math.max(0, this.coyote - dt);
      if (this.state === 'dead' || this.state === 'kneel') { this.vx = 0; this.physics(dt, L, I); return; }

      const dir = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
      const wantCrouch = I.down('down');
      const canAct = this.state !== 'hurt' && this.state !== 'roll' && this.state !== 'special';

      // pulo (com "coyote time" e buffer de entrada)
      if (canAct && this.state !== 'attack' && this.coyote > 0 && I.take('jump')) {
        if (this.state !== 'crouch' || this.headroom()) this.jump();
      }

      switch (this.state) {
        case 'hurt':
          this.hurtT -= dt; this.vx = Z.approach(this.vx, 0, 600 * dt);
          if (this.hurtT <= 0) this.setState(this.headroom() ? 'idle' : 'crouch');
          break;

        case 'roll': {
          this.rollT += dt;
          const k = this.rollT / ROLL_DUR;
          this.vx = this.facing * ROLL_SPEED * (k < 0.75 ? 1 : 1 - (k - 0.75) * 3);
          if (Math.random() < 0.5) this.ghosts.push({ x: this.x, y: this.y, f: Z.animProgress('roll', k), facing: this.facing, t: 0 });
          if (this.grounded && Math.random() < 0.4) Z.emit(this.x - this.facing * 8, this.y - 2, 1, { color: '#d8c8ac', speed: 40, gravity: -20, life: 0.4, size: 2.5 });
          if (this.rollT >= ROLL_DUR) {
            this.rollCd = ROLL_CD;
            if (this.headroom()) { this.setState('idle'); this.h = STAND_H; } else { this.setState('crouch'); this.crouchT = 1; }
          }
          break;
        }

        case 'attack': {
          this.atkT += dt;
          if (this.grounded && !this.airAttack) this.vx = Z.approach(this.vx, dir * RUN * 0.25, DEC * dt);
          else this.vx = Z.approach(this.vx, dir * RUN, ACC_AIR * dt);     // no ar mantém o controle
          if (this.atkT >= ATK_ON && this.atkT <= ATK_OFF) this.attackHit();
          if (this.atkT > ATK_OFF && this.grounded && I.take('roll') && this.rollCd <= 0) { this.startRoll(dir); break; }
          if (this.atkT >= ATK_DUR) this.setState('idle');
          break;
        }

        case 'special': {
          this.spcT += dt;
          this.vx = Z.approach(this.vx, 0, DEC * dt);
          if (!this.grounded) this.vy = Math.min(this.vy, 30);              // flutua um pouco ao soprar bolhas no ar
          if (this.spcT >= SPC_FIRE && this.fired < 7) {
            const due = Math.min(7, Math.floor((this.spcT - SPC_FIRE) / 0.035) + 1);
            while (this.fired < due) { this.fireBubble(); this.fired++; }
          }
          if (this.spcT >= SPC_DUR) this.setState('idle');
          break;
        }

        default: { // idle / run / crouch (no chão ou no ar)
          const crouching = this.grounded && (wantCrouch || !this.headroom());
          if (crouching && this.state !== 'crouch') { this.setState('crouch'); this.crouchT = 0; }
          if (!crouching && this.state === 'crouch') this.setState('idle');
          if (this.state === 'crouch') this.crouchT += dt;

          const max = this.state === 'crouch' ? CROUCH_SPEED : RUN;
          const acc = this.grounded ? ACC : ACC_AIR;
          if (dir) { this.vx = Z.approach(this.vx, dir * max, acc * dt); this.facing = dir; }
          else this.vx = Z.approach(this.vx, 0, (this.grounded ? DEC : ACC_AIR * 0.7) * dt);
          if (this.state !== 'crouch') this.setState(Math.abs(this.vx) > 10 ? 'run' : 'idle');

          if (I.take('roll') && this.rollCd <= 0 && this.grounded) this.startRoll(dir);
          else if (I.take('attack')) {
            if (this.headroom()) this.startAttack();
            else Z.floatText(this.x, this.y - 40, 'Sem espaço!', '#ccc', { life: 0.6 });
          }
          else if (I.take('special')) {
            if (this.carisma >= 1 && this.headroom()) this.startSpecial();
            else if (this.carisma < 1) { Z.floatText(this.x, this.y - 70, 'Sem Carisma!', '#9fd8ff', { life: 0.9 }); Z.game.hud.flashCarisma = 0.6; }
          }
        }
      }

      this.h = (this.state === 'crouch' || this.state === 'roll') ? CROUCH_H : STAND_H;
      this.physics(dt, L, I);

      if (this.state === 'run' && this.grounded) { this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.28; Z.audio.play('step'); } }
      for (const g of this.ghosts) g.t += dt;
      this.ghosts = this.ghosts.filter(g => g.t < 0.22);

      // queda na água → volta ao último chão seguro
      if (L.waterAt(this.x, this.y + 4)) {
        Z.emit(this.x, this.y, 18, { color: ['#bfe6ff', '#7fc3ea', '#fff'], angle: -Math.PI / 2, spread: 1, speed: 220, size: 2.5 });
        this.x = this.lastSafe.x; this.y = this.lastSafe.y; this.vx = this.vy = 0;
        this.takeDamage(1, this.x + this.facing, true);
      }
      if (this.grounded && this.state !== 'roll' && L.rectSolid(this.x - 9, this.y, this.x - 7, this.y + 2) && L.rectSolid(this.x + 7, this.y, this.x + 9, this.y + 2))
        this.lastSafe = { x: this.x, y: this.y };

      this.updateAnim();
    }

    jump() {
      if (this.state === 'crouch') this.setState('idle');
      this.vy = -JUMP_V; this.jumping = true; this.coyote = 0; this.grounded = false;
      Z.audio.play('jump');
      Z.emit(this.x, this.y - 1, 8, { color: ['#e6dccb', '#c9b9a0'], speed: 70, gravity: 40, life: 0.35, size: 2 });
    }

    physics(dt, L, I) {
      const wasGrounded = this.grounded, vyBefore = this.vy;
      // gravidade: mais leve no topo do pulo segurando o botão, mais pesada na descida
      let g = this.vy > 0 ? GRAV_FALL : GRAV;
      if (this.jumping && I && I.down('jump') && Math.abs(this.vy) < 70) g *= 0.55;
      this.vy = Math.min(MAX_FALL, this.vy + g * dt);
      // soltou o botão subindo → corta o pulo (pulo variável)
      if (this.jumping && this.vy < 0 && I && !I.down('jump')) { this.vy *= JUMP_CUT; this.jumping = false; }
      if (this.vy >= 0) this.jumping = false;
      const r = L.move(this, this.vx * dt, this.vy * dt);
      if (r.ceil) { this.vy = 40; this.jumping = false; }
      else if (r.hitY) this.vy = 0;
      if (r.hitX && this.state !== 'roll') this.vx = 0;
      this.grounded = L.onGround(this);
      if (this.grounded && !wasGrounded) {
        this.airAttack = false;
        if (vyBefore > 260) { this.landT = 0.09; Z.audio.play('land'); Z.emit(this.x, this.y - 1, 8, { color: ['#e6dccb', '#c9b9a0'], speed: 70, gravity: 0, life: 0.3, size: 2 }); }
      }
    }

    startRoll(dir) {
      if (dir) this.facing = dir;
      this.setState('roll'); this.rollT = 0; this.perfectUsed = false; this.h = CROUCH_H;
      Z.audio.play('roll'); Z.game.stats.rolls++;
    }
    startAttack() { this.setState('attack'); this.atkT = 0; this.atkHits.clear(); this.h = STAND_H; this.airAttack = !this.grounded; Z.audio.play('swing'); }
    startSpecial() {
      this.setState('special'); this.spcT = 0; this.fired = 0; this.carisma -= 1; this.h = STAND_H;
      Z.audio.play('bubble');
      Z.emit(this.x + this.facing * 30, this.y - 34, 10, { color: ['#bfe6ff', '#ffffff'], speed: 60, gravity: -40, kind: 'bub', size: 3, life: 0.6 });
    }
    attackRect() {
      const f = this.facing;
      return f > 0 ? { l: this.x + 4, r: this.x + 62, t: this.y - 48, b: this.y - 12 } : { l: this.x - 62, r: this.x - 4, t: this.y - 48, b: this.y - 12 };
    }
    attackHit() {
      const rect = this.attackRect(), G = Z.game;
      for (const e of G.enemies) {
        if (e.dead || this.atkHits.has(e) || !e.hurtbox) continue;
        if (Z.overlap(rect, e.hurtbox())) {
          this.atkHits.add(e);
          e.hurt(1, this.facing, 'melee');
          this.gainCarisma(0.25);
          G.hitstop(0.06); Z.cam.shake(2, 0.1);
          const hb = e.hurtbox();
          Z.emit((Math.max(rect.l, hb.l) + Math.min(rect.r, hb.r)) / 2, (hb.t + hb.b) / 2, 10, { color: ['#ffffff', '#9fd8ff', '#ffe68a'], speed: 170, gravity: 0, life: 0.25, size: 2, glow: true });
          if (this.grounded) this.vx -= this.facing * 40; else this.vy = Math.min(this.vy, -120); // no ar, o acerto dá um impulsinho
        }
      }
      if (!this.atkHits.has('wall') && G.level.hitRect(rect, 1, true)) { this.atkHits.add('wall'); G.hitstop(0.05); }
    }
    fireBubble() {
      const f = this.facing;
      Z.game.projectiles.push(new Z.Bubble(this.x + f * 38, this.y - 32 + Z.rand(-5, 5), f * Z.rand(240, 290), Z.rand(-30, 12)));
      if (this.fired % 2 === 0) Z.audio.play('pop');
    }
    gainCarisma(v) {
      const before = Math.floor(this.carisma);
      this.carisma = Math.min(this.maxCar, this.carisma + v);
      if (Math.floor(this.carisma) > before) { Z.game.hud.flashCarisma = 0.5; Z.audio.play('pickup'); }
    }

    // chamado por inimigos/projéteis. Retorna 'hit' | 'perfect' | 'dodged' | 'immune'
    hurt(dmg, fromX) {
      if (this.state === 'dead') return 'immune';
      if (this.grace > 0) return 'dodged';
      if (this.iframes) {
        if (!this.perfectUsed) {
          this.perfectUsed = true; this.grace = 0.3; // esquiva perfeita protege até o golpe passar
          Z.game.perfectDodge(this);
          return 'perfect';
        }
        return 'dodged';
      }
      if (this.invuln > 0) return 'immune';
      this.takeDamage(dmg, fromX);
      return 'hit';
    }
    takeDamage(dmg, fromX, noKnock) {
      this.hp -= dmg; this.invuln = 1.1; this.jumping = false;
      Z.audio.play('hurt'); Z.cam.shake(4, 0.25); Z.game.hitstop(0.09);
      Z.emit(this.x, this.y - 30, 14, { color: ['#ff5a6a', '#ffffff'], speed: 150, size: 2.5 });
      if (this.hp <= 0) { this.hp = 0; this.setState('dead'); this.vx = 0; Z.game.onPlayerDeath(); return; }
      if (!noKnock) { this.setState('hurt'); this.hurtT = 0.3; this.vx = (this.x < fromX ? -1 : 1) * 170; if (!this.grounded) this.vy = -120; }
      else { this.setState('idle'); }
    }

    updateAnim() {
      switch (this.state) {
        case 'roll': this.anim = 'roll'; break;
        case 'attack': this.anim = 'attack'; break;
        case 'special': this.anim = 'special'; break;
        case 'crouch':
          if (this.crouchT < 0.12) this.setAnim('crouchDown');
          else this.setAnim(Math.abs(this.vx) > 5 ? 'crouchWalk' : 'crouch');
          break;
        case 'hurt': this.setAnim('fall'); break;
        case 'dead': case 'kneel': this.setAnim('kneel'); break;
        default:
          if (!this.grounded) this.setAnim(this.vy < -120 ? 'jump' : this.vy < 120 ? 'apex' : 'fall');
          else if (this.landT > 0) this.setAnim('land');
          else if (this.state === 'run') this.setAnim('run');
          else this.setAnim('idle');
      }
    }
    frame() {
      if (this.state === 'roll') return Z.animProgress('roll', this.rollT / ROLL_DUR);
      if (this.state === 'attack') return Z.animProgress('attack', this.atkT / ATK_DUR);
      if (this.state === 'special') return Z.animProgress('special', this.spcT / SPC_DUR);
      return Z.animFrame(this.anim, this.animT);
    }

    draw(ctx, cam) {
      const L = Z.game.level;
      // sombra suave projetada no chão (encolhe com a altura)
      let gy = this.y;
      for (let k = 0; k < 120 && !L.solidAt(this.x, gy + 1); k += 4) gy += 4;
      gy = Math.floor((gy + 1) / Z.T) * Z.T;
      const hgt = Math.max(0, gy - this.y), sk = Z.clamp(1 - hgt / 140, 0.25, 1);
      ctx.fillStyle = `rgba(25,12,30,${0.32 * sk})`; ctx.beginPath(); ctx.ellipse(this.x - cam.x, gy - cam.y - 0.5, 14 * sk, 2.6 * sk, 0, 0, 7); ctx.fill();
      for (const g of this.ghosts) Z.drawFrame(ctx, g.f, g.x - cam.x, g.y - cam.y, g.facing, { ghost: true, alpha: 0.35 * (1 - g.t / 0.22) });
      if (this.invuln > 0 && this.state !== 'dead' && Math.floor(this.invuln * 14) % 2 === 0) return;
      const x = this.x - cam.x, y = this.y - cam.y;
      Z.drawFrame(ctx, this.frame(), x, y, this.facing);
      if (this.iframes) Z.drawFrame(ctx, this.frame(), x, y, this.facing, { ghost: true, alpha: 0.45 });
      if (Z.game.debug) {
        const b = Z.box(this); ctx.lineWidth = 1 / Z.S; ctx.strokeStyle = this.iframes ? '#0f0' : '#f0f'; ctx.strokeRect(b.l - cam.x, b.t - cam.y, b.r - b.l, b.b - b.t);
        if (this.state === 'attack' && this.atkT >= ATK_ON && this.atkT <= ATK_OFF) { const a = this.attackRect(); ctx.strokeStyle = '#ff0'; ctx.strokeRect(a.l - cam.x, a.t - cam.y, a.r - a.l, a.b - a.t); }
      }
    }
  }
  Z.Player = Player;
  Z.PLAYER = { STAND_H, CROUCH_H, ROLL_DUR, IFRAME_START, IFRAME_END, JUMP_V };
})();
