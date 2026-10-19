# Grava um vídeo showcase da demo (MP4 1080p 30 fps, com músicas e efeitos sonoros do jogo).
# O jogo roda num navegador sem tela, avançando exatamente 1/30 s por quadro (relógio virtual),
# guiado por tools/showcase_bot.js. Depois a trilha é montada a partir do registro de músicas e efeitos.
#
# Uso: python3 -m http.server 8765 (na raiz do projeto, em outro terminal)
#      python3 tools/record_showcase.py saida.mp4 [--fonts pasta_com_ttfs] [--dry]
import sys, os, json, base64, subprocess, time, argparse
import numpy as np
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS, SR = 30, 44100
W, H = 1920, 1080

CLOCK = r"""
(() => {
  let vt = 0; const cbs = [], timers = [];
  window.__vt = 0;
  window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
  performance.now = () => vt;
  const realST = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...a) => { if (window.__realTimers) return realST(fn, ms, ...a); timers.push({ at: vt + (ms || 0), fn, a }); return timers.length; };
  window.__step = () => {
    vt += 1000 / 30; window.__vt = vt / 1000;
    for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= vt) { const tm = timers.splice(i, 1)[0]; try { tm.fn(...tm.a); } catch (e) { console.error(e); } }
    const list = cbs.splice(0); for (const cb of list) cb(vt);
  };
})();
"""

LOGGER = r"""
(() => {
  window.__log = { music: [], sfx: [] };
  const A = Z.audio, play = A.play.bind(A), music = A.music.bind(A);
  A.play = n => { window.__log.sfx.push([window.__vt, n]); play(n); };
  A.music = n => { window.__log.music.push([window.__vt, n]); music(n); };
  window.__log.music.push([window.__vt, 'menu']);
})();
"""

def font_css(folder):
    def face(fam, fn, weight):
        b = base64.b64encode(open(os.path.join(folder, fn), 'rb').read()).decode()
        return f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{weight};font-display:block;src:url(data:font/ttf;base64,{b}) format('truetype');}}"
    return face('Press Start 2P', 'PressStart2P-Regular.ttf', '400') + face('Baloo 2', 'Baloo2[wght].ttf', '400 800')

def decode_mp3(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()

def build_audio(log, sfx_pcm, dur, out_wav):
    n = int(dur * SR) + SR
    mix = np.zeros((n, 2), np.float32)
    files = {'menu': 'assets/audio/menu.mp3', 'town': 'assets/audio/exploracao.mp3', 'boss': 'assets/audio/chefe.mp3'}
    tracks = {k: decode_mp3(os.path.join(ROOT, v)) for k, v in files.items()}
    # ---- músicas (mesma lógica do jogo: troca com fade, faixa repete em loop) ----
    segs, cur = [], None
    for t, name in log['music']:
        if name in files:
            if cur and cur[1] == name: continue
            if cur: segs.append((cur[0], t, cur[1]))
            cur = (t, name)
        else:
            if cur: segs.append((cur[0], t, cur[1])); cur = None
            if name in sfx_pcm: add(mix, sfx_pcm[name], t)       # jingle sintetizado (ex.: vitória)
    if cur: segs.append((cur[0], dur, cur[1]))
    for t0, t1, name in segs:
        a = tracks[name]; i0 = int(t0 * SR); i1 = min(n, int((t1 + 0.5) * SR))
        L = i1 - i0
        if L <= 0: continue
        reps = int(np.ceil(L / len(a)))
        seg = np.tile(a, (reps, 1))[:L] * 0.6
        fi = min(L, int(0.6 * SR)); seg[:fi] *= np.linspace(0, 1, fi)[:, None]
        fo = min(L, int(0.5 * SR)); seg[-fo:] *= np.linspace(1, 0, fo)[:, None]
        mix[i0:i1] += seg
    # ---- efeitos ----
    for t, name in log['sfx']:
        if name in sfx_pcm: add(mix, sfx_pcm[name], t)
    peak = np.abs(mix).max()
    if peak > 0.98: mix *= 0.98 / peak
    pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
    import wave
    with wave.open(out_wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def add(mix, clip, t):
    i0 = int(t * SR); i1 = min(len(mix), i0 + len(clip))
    if i1 > i0: mix[i0:i1] += clip[:i1 - i0]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out'); ap.add_argument('--fonts'); ap.add_argument('--dry', action='store_true')
    ap.add_argument('--url', default='http://localhost:8765/index.html'); ap.add_argument('--max', type=float, default=600)
    ap.add_argument('--shots', help='pasta para salvar quadros de teste (modo --dry)')
    args = ap.parse_args()
    tmp_video = args.out + '.video.mp4'; tmp_wav = args.out + '.audio.wav'
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--mute-audio'])
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        if args.fonts:
            css = font_css(args.fonts)
            pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=css))
        pg.add_init_script(CLOCK)
        pg.goto(args.url); pg.evaluate("localStorage.clear()"); pg.reload()
        for _ in range(400):
            pg.evaluate("__step()"); time.sleep(0.02)
            if pg.evaluate("Z.game && Z.game.state === 'title'"): break
        pg.evaluate("Z.audio.init(); Z.game.menu.sel = 0;")
        pg.add_script_tag(path=os.path.join(ROOT, 'tools/showcase_bot.js'))
        pg.evaluate(LOGGER)
        pg.evaluate("window.__vt = 0")
        enc = None
        if not args.dry:
            enc = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp_video], stdin=subprocess.PIPE)
        frames, t0 = 0, time.time()
        cap = "document.getElementById('game').toDataURL('image/jpeg', 0.92)"
        while frames < args.max * FPS:
            res = pg.evaluate(f"(() => {{ BOT.step(1/30); __step(); if (BOT.done) return null; return {'null' if args.dry else cap}; }})()")
            frames += 1
            if BOT_DONE(res, pg): break
            if enc and res: enc.stdin.write(base64.b64decode(res.split(',', 1)[1]))
            if args.dry and args.shots and frames % 150 == 0:      # (page.screenshot espera um rAF real: usamos o canvas)
                jpg = pg.evaluate(cap)
                open(os.path.join(args.shots, f'dry_{frames:05d}.jpg'), 'wb').write(base64.b64decode(jpg.split(',', 1)[1]))
            if frames % 300 == 0:
                info = pg.evaluate("JSON.stringify({task: BOT.task, st: Z.game.state, x: Z.game.player && Math.round(Z.game.player.x / 16), hp: Z.game.player && Z.game.player.hp, boss: Z.game.boss && Z.game.boss.hp, err: Z.game.lastError || null})")
                print(f'{frames / FPS:6.1f}s  {info}  ({time.time() - t0:.0f}s reais)', flush=True)
        dur = frames / FPS
        print('duração', round(dur, 1), 's  erros:', errs[:3], flush=True)
        print('stats', pg.evaluate("JSON.stringify({stats: Z.game.stats, save: Z.game.save})"), flush=True)
        log = pg.evaluate("window.__log")
        json.dump(log, open(args.out + '.log.json', 'w'))
        if args.dry: b.close(); return
        enc.stdin.close(); enc.wait()
        # renderiza cada efeito usado (e o jingle de vitória) com o próprio motor de áudio do jogo
        pg.evaluate("window.__realTimers = true")
        names = sorted({n for _, n in log['sfx']})
        sfx = {}
        for n in names:
            b64 = pg.evaluate("([n]) => Z.audio.renderOffline('sfx', n, 1.6)", [n])
            sfx[n] = np.frombuffer(base64.b64decode(b64), '<i2').reshape(-1, 2).astype(np.float32) / 32767
        if any(n == 'victory' for _, n in log['music']):
            b64 = pg.evaluate("Z.audio.renderOffline('song', 'victory', 5)")
            sfx['victory_song'] = np.frombuffer(base64.b64decode(b64), '<i2').reshape(-1, 2).astype(np.float32) / 32767
            log['music'] = [(t, 'victory_song' if n == 'victory' else n) for t, n in log['music']]
        b.close()
    build_audio(log, sfx, dur, tmp_wav)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', tmp_video, '-i', tmp_wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                    '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11', '-shortest', '-movflags', '+faststart', args.out], check=True)
    os.remove(tmp_video); os.remove(tmp_wav)
    print('ok', args.out)

def BOT_DONE(res, pg):
    return res is None and pg.evaluate("BOT.done")

if __name__ == '__main__':
    main()
