// Entrada unificada: teclado, toque (multitoque) e gamepad.
'use strict';
(() => {
  const ACTIONS = ['left', 'right', 'down', 'up', 'attack', 'roll', 'special', 'pause', 'confirm', 'jump'];
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    KeyJ: 'attack', KeyZ: 'attack', KeyK: 'roll', KeyX: 'roll', ShiftLeft: 'roll', ShiftRight: 'roll',
    KeyL: 'special', KeyC: 'special', Escape: 'pause', KeyP: 'pause', Enter: 'confirm',
  };
  const src = { key: {}, touch: {}, pad: {} };
  const held = {}, prev = {}, buffer = {}, taps = new Set();
  ACTIONS.forEach(a => { held[a] = prev[a] = false; buffer[a] = 0; });

  const I = Z.input = {
    mode: 'keys', // 'keys' | 'touch' | 'pad' — usado para mostrar os nomes certos dos botões
    down: a => held[a],
    pressed: a => held[a] && !prev[a],
    // consome uma entrada do buffer (aperto recente, ainda não usado)
    take(a) { if (buffer[a] > 0) { buffer[a] = 0; return true; } return false; },
    clear() { ACTIONS.forEach(a => buffer[a] = 0); },
    anyPressed() { return ['attack', 'roll', 'special', 'confirm', 'jump'].some(a => held[a] && !prev[a]); },
    onFirstGesture: null,
  };

  function gesture() { if (I.onFirstGesture) { const f = I.onFirstGesture; I.onFirstGesture = null; f(); } }

  addEventListener('keydown', e => {
    const a = KEYMAP[e.code];
    if (e.code === 'KeyM') Z.audio && Z.audio.toggle();
    if (a) { if (!e.repeat) taps.add(a); src.key[a] = true; e.preventDefault(); }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { if (!e.repeat) taps.add('up'); src.key.up = true; }   // "cima" nos menus
    I.mode = 'keys'; gesture();
  });
  addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) src.key[a] = false; if (e.code === 'ArrowUp' || e.code === 'KeyW') src.key.up = false; });
  addEventListener('blur', () => { src.key = {}; src.touch = {}; });

  // ---------- toque: cada dedo é rastreado e pode deslizar entre botões ----------
  const touchEl = document.getElementById('touch');
  const fingers = new Map();
  function refreshTouch() {
    for (const el of fingers.values()) if (el && !src.touch[el.dataset.k]) taps.add(el.dataset.k);
    src.touch = {};
    document.querySelectorAll('.tb.on').forEach(b => b.classList.remove('on'));
    for (const el of fingers.values()) if (el) { src.touch[el.dataset.k] = true; el.classList.add('on'); }
  }
  function btnAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest('.tb') : null;
  }
  function showTouch() { touchEl.classList.remove('hidden'); I.mode = 'touch'; }
  touchEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    fingers.set(e.pointerId, btnAt(e.clientX, e.clientY));
    refreshTouch(); gesture();
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {}
  });
  addEventListener('pointermove', e => {
    if (!fingers.has(e.pointerId)) return;
    const el = btnAt(e.clientX, e.clientY);
    // só desliza entre botões do mesmo grupo (direcional x ações)
    const old = fingers.get(e.pointerId);
    if (el !== old && (!el || !old || el.parentElement === old.parentElement)) { fingers.set(e.pointerId, el); refreshTouch(); }
  });
  const up = e => { if (fingers.delete(e.pointerId)) refreshTouch(); };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('touchstart', e => { showTouch(); gesture(); }, { passive: true });
  if (matchMedia('(pointer: coarse)').matches) showTouch();
  // toque na tela (fora dos botões) confirma menus
  document.getElementById('game').addEventListener('pointerdown', e => {
    gesture();
    const g = Z.game;
    if (g && (g.dialog || g.state === 'victory')) { src.touch.confirm = true; setTimeout(() => { src.touch.confirm = false; }, 90); }
  });

  // ---------- gamepad ----------
  function pollPad() {
    src.pad = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const b = i => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const any = b(0) || b(1) || b(2) || b(3) || b(9) || Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5 || b(14) || b(15) || b(13);
      if (any) { I.mode = 'pad'; gesture(); }
      if (b(14) || ax < -0.4) src.pad.left = true;
      if (b(15) || ax > 0.4) src.pad.right = true;
      if (b(13) || ay > 0.55) src.pad.down = true;
      if (b(12) || ay < -0.6) src.pad.up = true;
      if (b(0)) src.pad.jump = true;
      if (b(2)) src.pad.attack = true;
      if (b(1) || b(5)) src.pad.roll = true;
      if (b(3) || b(7)) src.pad.special = true;
      if (b(9)) src.pad.pause = true;
      if (b(0)) src.pad.confirm = true;
    }
  }

  I.update = dt => {
    pollPad();
    for (const a of ACTIONS) {
      prev[a] = held[a];
      // toques muito rápidos (aperta e solta entre dois quadros) ainda contam
      held[a] = !!(src.key[a] || src.touch[a] || src.pad[a] || taps.has(a));
      if (held[a] && !prev[a]) buffer[a] = 0.13; else buffer[a] = Math.max(0, buffer[a] - dt);
    }
    taps.clear();
  };

  // nome do botão para mostrar nas placas
  I.label = a => {
    const t = {
      keys: { attack: 'J', roll: 'K', special: 'L', jump: 'Espaço', down: '↓', move: '← →', pause: 'Esc' },
      touch: { attack: 'REDE', roll: 'ROLAR', special: 'BOLHAS', jump: 'PULAR', down: '▼', move: '◀ ▶', pause: '❚❚' },
      pad: { attack: 'X', roll: 'B', special: 'Y', jump: 'A', down: '↓', move: '◀ ▶', pause: 'Start' },
    };
    return t[I.mode][a];
  };
})();
