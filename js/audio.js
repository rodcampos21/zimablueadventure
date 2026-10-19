// Áudio sintetizado com Web Audio (efeitos + trilhas simples), sem arquivos externos.
'use strict';
(() => {
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('zima_mute') === '1'; } catch (_) {}

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(freq, dur, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    const v = o.vol !== undefined ? o.vol : 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise(dur, o = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol || 0.3, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t0); s.stop(t0 + dur);
  }

  const SFX = {
    swing: () => noise(0.12, { freq: 2400, to: 700, q: 0.8, vol: 0.25 }),
    hit: () => { tone(220, 0.09, { to: 90, vol: 0.3 }); noise(0.08, { freq: 900, vol: 0.25 }); },
    roll: () => noise(0.3, { freq: 500, to: 1500, q: 0.6, vol: 0.18 }),
    perfect: () => [880, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.18, { type: 'triangle', delay: i * 0.05, vol: 0.22 })),
    bubble: () => { for (let i = 0; i < 4; i++) tone(Z.rand(500, 900), 0.08, { type: 'sine', to: Z.rand(1200, 1800), delay: i * 0.05, vol: 0.18 }); },
    pop: () => tone(Z.rand(900, 1300), 0.05, { type: 'sine', to: 300, vol: 0.15 }),
    hurt: () => { tone(300, 0.25, { type: 'sawtooth', to: 70, vol: 0.28 }); noise(0.15, { freq: 400, vol: 0.2 }); },
    step: () => noise(0.03, { freq: 300, vol: 0.06 }),
    jump: () => { tone(320, 0.12, { type: 'square', to: 620, vol: 0.12 }); noise(0.06, { freq: 900, vol: 0.08 }); },
    chest: () => [523, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.25, { type: 'triangle', delay: i * 0.08, vol: 0.2 })),
    land: () => noise(0.07, { freq: 220, vol: 0.15 }),
    break: () => { noise(0.4, { freq: 300, to: 80, vol: 0.4, filter: 'lowpass' }); tone(90, 0.3, { type: 'square', to: 40, vol: 0.2 }); },
    lever: () => { tone(400, 0.05, { vol: 0.2 }); tone(260, 0.12, { delay: 0.06, vol: 0.2 }); },
    bridge: () => { for (let i = 0; i < 6; i++) noise(0.08, { freq: 200 + i * 40, vol: 0.2, delay: i * 0.07 }); tone(70, 0.5, { type: 'triangle', delay: 0.4, vol: 0.3 }); },
    pickup: () => [660, 880, 1320].forEach((f, i) => tone(f, 0.12, { type: 'triangle', delay: i * 0.06, vol: 0.22 })),
    heal: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, { type: 'triangle', delay: i * 0.07, vol: 0.2 })),
    checkpoint: () => [392, 494, 587, 784].forEach((f, i) => tone(f, 0.6, { type: 'triangle', delay: i * 0.03, vol: 0.12 })),
    coo: () => { tone(420, 0.12, { type: 'sine', to: 300, vol: 0.12 }); tone(380, 0.15, { type: 'sine', to: 260, delay: 0.14, vol: 0.12 }); },
    throw: () => noise(0.1, { freq: 3000, to: 1500, vol: 0.12 }),
    stomp: () => { tone(80, 0.3, { type: 'square', to: 35, vol: 0.35 }); noise(0.25, { freq: 150, vol: 0.35, filter: 'lowpass' }); },
    wave: () => tone(160, 0.6, { type: 'sawtooth', to: 520, vol: 0.15 }),
    alert: () => { tone(988, 0.07, { vol: 0.15 }); tone(1318, 0.1, { delay: 0.07, vol: 0.15 }); },
    gate: () => { noise(0.5, { freq: 250, vol: 0.35, filter: 'lowpass' }); tone(60, 0.5, { vol: 0.25 }); },
    bossHit: () => { tone(160, 0.12, { to: 70, vol: 0.35 }); noise(0.1, { freq: 600, vol: 0.3 }); },
    death: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { type: 'triangle', delay: i * 0.18, vol: 0.25 })),
    victory: () => [523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, i === 6 ? 0.8 : 0.16, { type: 'square', delay: i * 0.13, vol: 0.16 })),
    text: () => tone(Z.rand(700, 760), 0.025, { vol: 0.05 }),
    select: () => tone(880, 0.08, { type: 'triangle', vol: 0.2 }),
  };

  // ---------- música: sequenciador simples em estilo baião ----------
  const N = s => { if (!s || s === '.') return 0; const m = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }; const o = +s[s.length - 1]; let n = m[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0); return 440 * Math.pow(2, (n + (o - 4) * 12 - 9) / 12); };
  const SONGS = {
    town: {
      bpm: 104,
      lead: 'G4 . B4 D5 . B4 C5 . A4 . F#4 A4 . G4 . . E4 . G4 B4 . G4 A4 . F#4 . D4 F#4 A4 . G4 . D5 . C5 B4 . A4 B4 . G4 . E4 G4 . F#4 E4 . D4 . F#4 A4 . C5 B4 . A4 G4 . . . . . .',
      bass: 'G2 . . D3 G2 . . D3 C3 . . G2 D3 . . A2 E2 . . B2 E2 . . B2 D3 . . A2 D3 . . F#2 G2 . . D3 C3 . . G2 A2 . . E3 D3 . . A2 E2 . . B2 C3 . . G2 D3 . . A2 G2 . . . . . . .',
    },
    boss: {
      bpm: 150,
      lead: 'E4 E4 G4 E4 A4 . G4 E4 B4 . A4 G4 E4 . D4 E4 E4 E4 G4 E4 A4 . B4 C5 B4 . A4 G4 A4 . . . C5 . B4 A4 G4 . A4 B4 E4 . G4 F#4 E4 . . . D5 C5 B4 A4 B4 . G4 E4 F#4 G4 A4 B4 E4 . . .',
      bass: 'E2 . E3 E2 . E2 E3 . E2 . E3 E2 . E2 E3 . C2 . C3 C2 . C2 C3 . D2 . D3 D2 . D2 D3 . A1 . A2 A1 . A1 A2 . C2 . C3 C2 . C2 C3 . B1 . B2 B1 . B1 B2 . B1 . B2 B1 B1 B1 B2 B2',
    },
    victory: { bpm: 120, lead: 'C5 . E5 G5 . E5 C5 . D5 . F5 A5 . G5 . . E5 . G5 C6 . B5 A5 . G5 . . . . . . .', bass: 'C3 . G2 . C3 . G2 . D3 . A2 . G2 . . . C3 . G2 . E3 . G2 . C3 . . . . . . .' },
  };
  let song = null, step = 0, nextTime = 0, timer = null;
  function schedule() {
    if (!ctx || !song) return;
    const s = SONGS[song], spb = 60 / s.bpm / 2;
    const L = s.lead.split(' '), B = s.bass.split(' ');
    while (nextTime < ctx.currentTime + 0.2) {
      const d = nextTime - ctx.currentTime;
      const l = N(L[step % L.length]), b = N(B[step % B.length]);
      if (l) tone(l, spb * 1.6, { type: 'square', vol: 0.08, delay: d, bus: musicBus });
      if (b) tone(b, spb * 1.8, { type: 'triangle', vol: 0.3, delay: d, bus: musicBus });
      if (song !== 'victory' && step % 2 === 0) noiseHat(d, step % 4 === 0 ? 0.05 : 0.025);
      step++; nextTime += spb;
      if (song === 'victory' && step >= L.length) { song = null; break; }
    }
  }
  function noiseHat(delay, vol) {
    const t0 = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t0); s.stop(t0 + 0.05);
  }

  // ---------- músicas em arquivo (ex.: tema do menu) ----------
  const TRACKS = Object.assign({ menu: 'assets/audio/menu.mp3' }, window.ZIMA_TRACKS || {});
  const TRACK_VOL = 0.6;
  const players = {};
  let fileTrack = null, unlocked = false;
  function trackEl(name) {
    if (!players[name]) { const a = new Audio(TRACKS[name]); a.loop = true; a.preload = 'auto'; a.volume = 0; players[name] = a; }
    return players[name];
  }
  function fade(a, to, ms, done) {
    clearInterval(a._fade);
    const from = a.volume, t0 = performance.now();
    a._fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { clearInterval(a._fade); done && done(); }
    }, 30);
  }
  function startFileTrack() {
    if (!fileTrack || !unlocked) return;
    const a = trackEl(fileTrack);
    const p = a.play(); if (p && p.catch) p.catch(() => {});
    fade(a, muted ? 0 : TRACK_VOL, 600);
  }
  function stopFileTracks(except) {
    for (const [n, a] of Object.entries(players)) if (n !== except && !a.paused) fade(a, 0, 500, () => { a.pause(); a.currentTime = 0; });
  }

  Z.audio = {
    init() {
      init(); if (ctx && ctx.state === 'suspended') ctx.resume(); if (!timer) timer = setInterval(schedule, 50);
      if (!unlocked) { unlocked = true; startFileTrack(); }
    },
    play(name) { try { SFX[name] && SFX[name](); } catch (_) {} },
    music(name) {
      if (TRACKS[name]) {                       // trilha gravada: para o sintetizador e toca o arquivo em loop
        song = null;
        if (fileTrack === name) return;
        fileTrack = name; stopFileTracks(name); startFileTrack();
        return;
      }
      if (fileTrack) { stopFileTracks(); fileTrack = null; }
      if (song === name) return;
      song = name; step = 0; if (ctx) nextTime = ctx.currentTime + 0.1;
    },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('zima_mute', muted ? '1' : '0'); } catch (_) {}
      if (master) master.gain.value = muted ? 0 : 0.8;
      if (fileTrack && players[fileTrack]) fade(players[fileTrack], muted ? 0 : TRACK_VOL, 200);
      const b = document.getElementById('btnSound'); if (b) b.classList.toggle('off', muted);
    },
  };
})();
