// Jogador automático para gravar o vídeo showcase da demo.
// Percorre a fase inteira mostrando as mecânicas: pulo, agachar, rolar (esquiva perfeita), rede, bolhas,
// segredo, ponte, baú, chefe e o fim da demo. Controla o jogo enviando eventos de teclado, como um jogador.
'use strict';
window.BOT = (() => {
  const G = () => Z.game, P = () => Z.game.player, LV = () => Z.game.level, T = Z.T;
  const CODES = { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', jump: 'Space', attack: 'KeyJ', roll: 'KeyK', special: 'KeyL', enter: 'Enter' };
  const held = {}; let releaseNext = [];
  const key = (k, v) => { if (!!held[k] === v) return; held[k] = v; window.dispatchEvent(new KeyboardEvent(v ? 'keydown' : 'keyup', { code: CODES[k] })); };
  const tap = k => { key(k, false); key(k, true); releaseNext.push(k); };
  const stopMove = () => { key('left', false); key('right', false); };
  const releaseAll = () => { for (const k in held) key(k, false); };

  let t = 0, taskT = 0, ti = 0, dt = 1 / 30, done = false;
  const m = {};                       // memória dos comportamentos
  let atkCd = 0, jumpHold = 0, lastX = 0, stuckT = 0, specials = 0, rollN = 0;

  // ---------- diálogos: espera o texto aparecer e um tempo de leitura ----------
  function dialog() {
    const d = G().dialog, line = d.lines[d.i], id = d.i + '|' + line.text;
    if (m.line !== id) { m.line = id; m.hold = 0; }
    if (d.chars >= line.text.length) { m.hold += dt; if (m.hold > 1.15 + line.text.length * 0.024) { tap('enter'); m.hold = -99; } }
  }

  // ---------- movimento com obstáculos ----------
  function face(dir) { if (P().facing !== dir) { key(dir > 0 ? 'right' : 'left', true); key(dir > 0 ? 'left' : 'right', false); releaseNext.push(dir > 0 ? 'right' : 'left'); } }
  function jump(hold = 0.42) { if (P().grounded && jumpHold <= 0) { key('jump', true); jumpHold = hold; } }
  function walk(dir) {
    const p = P(), L = LV();
    key(dir > 0 ? 'right' : 'left', true); key(dir > 0 ? 'left' : 'right', false);
    const ahead = (a, b, top, bot) => L.rectSolid(Math.min(p.x + dir * a, p.x + dir * b), p.y - top, Math.max(p.x + dir * a, p.x + dir * b), p.y - bot);
    const low = ahead(4, 30, 54, 30) && !ahead(4, 30, 27, 1);
    key('down', low || (p.state === 'crouch' && !p.headroom()));
    if (!low && ahead(8, 24, 50, 2)) jump();
    // destravar: se não sai do lugar, pula
    if (Math.abs(p.x - lastX) < 0.2 && p.state !== 'attack' && p.state !== 'special') { stuckT += dt; if (stuckT > 0.6) { jump(); stuckT = 0; } } else stuckT = 0;
  }
  function goTo(tx, tol = 6) {
    const p = P(), x = tx * T + 8, dx = x - p.x;
    if (Math.abs(dx) <= tol) { stopMove(); key('down', false); return true; }
    walk(Math.sign(dx));
    return false;
  }

  // ---------- combate com os Atendentes ----------
  function incoming() {
    const p = P();
    for (const q of G().projectiles) {
      if (!q.enemy || q.dead || !(q instanceof Z.Burger)) continue;
      const dx = q.x - p.x;
      if (Math.sign(q.vx) === -Math.sign(dx) && Math.abs(dx) < 110 && q.grav === 0 && Math.abs(q.y - (p.y - 40)) < 26) return q;
    }
    return null;
  }
  function engage() {
    const p = P(), g = G();
    const q = incoming();
    if (q) {                                                   // hambúrguer reto vindo: agacha ou rola (esquiva perfeita)
      const dx = q.x - p.x;
      if (Math.abs(dx) < 44) {
        if (rollN++ % 2 === 0 && p.rollCd <= 0 && p.grounded) { key(dx > 0 ? 'right' : 'left', true); key(dx > 0 ? 'left' : 'right', false); tap('roll'); }
        else { stopMove(); key('down', true); m.duck = 0.35; }
      }
      return true;
    }
    if (m.duck > 0) { m.duck -= dt; stopMove(); key('down', true); return true; }
    let best = null, bd = 1e9;
    for (const e of g.enemies) {
      if (e === g.boss || e.dead || e.dying || !(e instanceof Z.Atendente)) continue;
      const dx = e.x - p.x, dy = Math.abs(e.y - p.y);
      if (dy < 40 && Math.abs(dx) < 250 && Math.abs(dx) < bd) { bd = Math.abs(dx); best = e; }
    }
    if (!best) return false;
    key('down', false);
    const dx = best.x - p.x, dir = Math.sign(dx), dist = Math.abs(dx);
    // bolhas de longe (mostra o especial)
    if (dist > 105 && dist < 210 && p.carisma >= 1 && specials < 3 && !m['sp' + g.enemies.indexOf(best)] && p.state !== 'special') {
      stopMove(); face(dir);
      if (p.facing === dir && p.grounded) { tap('special'); specials++; m['sp' + g.enemies.indexOf(best)] = 1; }
      return true;
    }
    if (dist > 56) { walk(dir); return true; }
    stopMove(); face(dir);
    if (atkCd <= 0 && (p.state === 'idle' || p.state === 'run')) {
      if (Math.random() < 0.25 && p.grounded) { jump(0.25); m.airAtk = 0.12; }
      else tap('attack');
      atkCd = 0.32;
    }
    if (m.airAtk > 0) { m.airAtk -= dt; if (m.airAtk <= 0) tap('attack'); }
    return true;
  }

  // ---------- chefe ----------
  function boss() {
    const g = G(), b = g.boss, p = P();
    if (!b) return false;
    const dx = b.x - p.x, dir = Math.sign(dx), dist = Math.abs(dx);
    key('down', false);
    const st = b.state;
    if (st === 'dash') {
      if (Math.sign(b.vx) === -dir && dist < 80 && p.rollCd <= 0 && p.state !== 'roll') { key(dir > 0 ? 'right' : 'left', true); key(dir > 0 ? 'left' : 'right', false); tap('roll'); }
      else stopMove();
      return;
    }
    if (st === 'dashTele') { stopMove(); face(dir); return; }
    if ((st === 'punchWind' || st === 'punch') && dist < 95) { stopMove(); key('down', true); return; }
    // pedra no ar: corre na direção do Julius (a pedra mira onde o Zima estava)
    const rock = g.projectiles.find(r => r instanceof Z.Rock && !r.dead);
    if (rock && dist > 50) { walk(dir); return; }
    const open = ['stun', 'punchEnd', 'dashEnd', 'rockPick', 'rockLift', 'rockThrow', 'idle', 'walk', 'flex'].includes(st);
    if (open && p.carisma >= 1 && dist > 95 && dist < 220 && (st === 'stun' || st === 'rockPick' || st === 'idle') && p.state !== 'special' && Math.random() < 0.08) {
      stopMove(); face(dir); if (p.facing === dir) tap('special'); return;
    }
    if (dist > 58) { walk(dir); return; }
    stopMove(); face(dir);
    if (atkCd <= 0 && (p.state === 'idle' || p.state === 'run')) { tap('attack'); atkCd = 0.3; }
  }

  // ---------- roteiro ----------
  const tasks = [
    () => taskT > 4.5 && (tap('enter'), true),                                    // tela título com a música do menu
    () => G().state === 'play' && !G().dialog && taskT > 1.2,                       // conversa com o Thyberius
    () => !engage() && goTo(150),                                                     // rodoviária → avenida (malas, marquise, atendentes)
    () => !engage() && goTo(161),                                                     // desce ao córrego
    () => {                                                                          // muro rachado: segredo
      stopMove(); face(-1);
      if (LV().wall.hp <= 0) return taskT > 0.6;
      if (atkCd <= 0 && P().state !== 'attack') { tap('attack'); atkCd = 0.42; }
      return false;
    },
    () => goTo(154, 4) && taskT > 0.3,                                              // pega a Coxinha
    () => taskT > 1.4,                                                               // lê o aviso do segredo
    () => !engage() && goTo(183, 4),                                                  // urna (enche o Carisma) e beira do córrego
    () => {                                                                          // bolhas na alavanca
      stopMove(); face(1);
      if (LV().bridge.lowered) return LV().bridge.anim >= 1 && taskT > 1.6;
      if (P().facing === 1 && P().state !== 'special' && taskT > 0.6 && (m.lever || 0) <= 0) { tap('special'); m.lever = 1.4; }
      m.lever = (m.lever || 0) - dt;
      return false;
    },
    () => goTo(204, 4),                                                              // atravessa a ponte
    () => {                                                                          // sobe nos caixotes
      const p = P();
      if (p.grounded && p.y <= 24 * T + 0.5 && p.x > 205.5 * T) { stopMove(); return true; }
      key('right', true); if (p.x > 204.6 * T) jump(0.45);
      return false;
    },
    () => {                                                                          // salta até a sacada da Matriz
      const p = P();
      if (p.grounded && p.y <= 21 * T + 0.5) { stopMove(); return true; }
      if (taskT < 0.25) return false;
      key('right', true); jump(0.5);
      return false;
    },
    () => goTo(211, 4),
    () => {                                                                          // abre o baú
      stopMove(); face(1);
      if (LV().chest.open) return taskT > 2.6;
      if (atkCd <= 0 && P().state !== 'attack') { tap('attack'); atkCd = 0.45; }
      return false;
    },
    () => !engage() && goTo(233),                                                     // desce da sacada, atendente, banco
    () => G().bossStarted || (!engage() && goTo(252)),                                  // entra na arena do chefe
    () => G().boss && G().boss.state !== 'intro' && !G().dialog,                     // diálogo com o Julius
    () => { if (['dying', 'down', 'getup', 'recruited'].includes(G().boss.state)) { releaseAll(); return true; } boss(); return false; },
    () => { stopMove(); return G().state === 'victory' && G().victoryT > 7; },     // recrutamento e tela de fim
  ];

  function step(d) {
    dt = d;
    for (const k of releaseNext) key(k, false); releaseNext = [];
    if (done) return;
    t += dt; taskT += dt; atkCd -= dt;
    if (jumpHold > 0) { jumpHold -= dt; if (jumpHold <= 0) key('jump', false); }
    const g = G();
    if (g.player && g.player.hp < 2) g.player.hp = 2;        // o vídeo nunca termina numa derrota
    if (g.state === 'play' && g.dialog) { stopMove(); key('down', false); dialog(); return; }
    if (tasks[ti]()) { ti++; taskT = 0; m.line = null; if (ti >= tasks.length) { done = true; releaseAll(); } }
    if (g.player) lastX = g.player.x;
  }
  return { step, get done() { return done; }, get task() { return ti; }, get t() { return t; } };
})();
