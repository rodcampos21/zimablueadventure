# Monta o atlas do Zima (assets/zima.png + js/atlas.js) a partir das folhas em raw/.
import os, sys, json
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from extract import run, ROOT, OUT_SCALE
from npc import run_npcs

ANIMS = {
    'idle':       (['idle_walk%d' % i for i in range(8)], 7, True),
    'run':        (['run%d' % i for i in range(8)], 13, True),
    'crouchDown': (['crouch3', 'crouch5', 'crouch6'], 18, False),
    'crouch':     (['crouch7', 'crouch8', 'crouch7', 'crouch6'], 4, True),
    'crouchWalk': (['crouch6', 'crouch7', 'crouch8', 'crouch7'], 9, True),
    'rise':       (['crouch5', 'crouch3'], 18, False),
    'roll':       (['roll%d' % i for i in range(1, 10)], 18, False),
    'attack':     (['attack1', 'attack4', 'attack5', 'attack6', 'attack7', 'attack8'], 20, False),
    'special':    (['special1', 'special2', 'special3', 'special4', 'special5', 'special7', 'special10'], 14, False),
    'kneel':      (['roll10'], 1, True),
    'jump':       (['run0'], 1, True),
    'apex':       (['run4'], 1, True),
    'fall':       (['attack10'], 1, True),
    'land':       (['crouch3'], 1, True),
    # NPC: Thyberius, o Mago (lendo o livro)
    'thyIdle':    (['thy%d' % i for i in range(8)], 6, True),
    # Inimigo comum: Atendente (só arremessa hambúrguer)
    'atIdle':     (['atw0'], 1, True),
    'atWalk':     (['atw%d' % i for i in range(1, 8)], 10, True),
    'atWind':     (['ata1'], 1, True),
    'atThrow':    (['ata2', 'ata3', 'ata4', 'ata5'], 12, False),
    'atHurt':     (['atd2'], 1, True),
    'atDie':      (['atd2', 'atd3', 'atd4', 'atd6'], 8, False),
    'burger':     (['burger'], 1, True),
    # Chefe: Julius, o Comuculturista
    'jIdle':      (['ji%d' % i for i in range(12)], 7, True),
    'jWalk':      (['jw%d' % i for i in range(12)], 11, True),
    'jDashTele':  (['jd0'], 1, True),
    'jDash':      (['jd1', 'jd2', 'jd3'], 12, True),
    'jDashEnd':   (['jd5', 'jd4'], 8, False),
    'jPunchWind': (['jp1'], 1, True),
    'jPunch':     (['jp2'], 1, True),
    'jPunchEnd':  (['jp3', 'jp6'], 8, False),
    'jJab':       (['jp0'], 1, True),
    'jFlex':      (['jp1'], 1, True),
    'jRockPick':  (['jr3', 'jr2', 'jr1', 'jr4'], 6, False),
    'jRockLift':  (['jr5', 'jr6'], 6, False),
    'jRockThrow': (['jr7'], 1, True),
    'rock':       (['rock'], 1, True),
}
EXTRA = ['special8', 'special13']   # efeitos de bolha

def main():
    frames = run()
    frames.update(run_npcs())
    used = []
    for fr, _, _ in ANIMS.values():
        for f in fr:
            if f not in used: used.append(f)
    used += EXTRA
    # empacotamento simples em prateleiras
    W = 2048; x = y = shelf = 0; pos = {}
    for n in used:
        img = frames[n][0]
        if x + img.width + 2 > W: x = 0; y += shelf + 2; shelf = 0
        pos[n] = (x, y); x += img.width + 2; shelf = max(shelf, img.height)
    H = y + shelf
    atlas = Image.new('RGBA', (W, H))
    meta = {}
    for n in used:
        img, ax, ay = frames[n]
        atlas.paste(img, pos[n])
        meta[n] = [pos[n][0], pos[n][1], img.width, img.height, ax, ay]
    os.makedirs(os.path.join(ROOT, 'assets'), exist_ok=True)
    atlas.save(os.path.join(ROOT, 'assets/zima.png'), optimize=True)
    anims = {k: {'frames': v[0], 'fps': v[1], 'loop': v[2]} for k, v in ANIMS.items()}
    with open(os.path.join(ROOT, 'js/atlas.js'), 'w') as f:
        f.write('// Gerado por tools/pack.py — não editar à mão.\n')
        f.write('window.ZIMA_ATLAS = ' + json.dumps({'image': 'assets/zima.png', 'scale': OUT_SCALE, 'frames': meta, 'anims': anims}, separators=(',', ':')) + ';\n')
    print('atlas', W, H, len(used), 'quadros')

if __name__ == '__main__':
    main()
