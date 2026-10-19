# Recorta NPCs e inimigos de folhas organizadas em células (ex.: Thyberius, o Mago; Atendente).
import os, sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from extract import cut_frame, OUT_SCALE, ROOT
from julius import run_julius

def cut_cell(full, box, scale, pick='largest'):
    """Recorta um elemento dentro de uma célula. pick='largest' pega o maior;
    pick=(x, y) pega o elemento mais próximo desse ponto (coordenadas da folha)."""
    x0, y0, x1, y1 = box
    a = full[y0:y1, x0:x1]
    border = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    d = np.sqrt(((a.astype(float) - bg) ** 2).sum(-1))
    hard = ndi.binary_opening(d > 60, iterations=1)
    lab, n = ndi.label(ndi.binary_dilation(hard, iterations=6))
    objs = ndi.find_objects(lab)
    if pick == 'largest':
        sizes = ndi.sum(hard, lab, range(1, n + 1))
        k = int(np.argmax(sizes)) + 1
    else:
        px, py = pick[0] - x0, pick[1] - y0
        def dist(i):
            sl = objs[i]
            cx, cy = (sl[1].start + sl[1].stop) / 2, (sl[0].start + sl[0].stop) / 2
            return (cx - px) ** 2 + (cy - py) ** 2
        k = min(range(n), key=dist) + 1
    return cut_frame(a, bg, d, lab, dict(sl=objs[k - 1], lab=k), scale)

# ---- Thyberius: 8 células numa faixa ----
def thyberius():
    full = np.array(Image.open(os.path.join(ROOT, 'raw/thyberius.jpg')).convert('RGB'))
    cw = full.shape[1] / 8; scale = 62 * OUT_SCALE / 400
    return {f'thy{i}': cut_cell(full, (int(i * cw + 12), 612, int((i + 1) * cw - 10), 1180), scale) for i in range(8)}

# ---- Atendente: grades 4×2 ----
GRID_X = [(8, 585), (609, 1188), (1212, 1790), (1814, 2394)]
GRID_Y = [(270, 883), (908, 1505)]
def cell(c, r): return (GRID_X[c][0], GRID_Y[r][0], GRID_X[c][1], GRID_Y[r][1])
def atendente():
    out = {}
    scale = 60 * OUT_SCALE / 536
    for name, sheet in [('ata', 'ataque'), ('atd', 'dano'), ('atw', 'andar')]:
        full = np.array(Image.open(os.path.join(ROOT, f'raw/atendente_{sheet}.jpg')).convert('RGB'))
        for i in range(8):
            c, r = i % 4, i // 4
            if name == 'ata' and i == 7: continue   # última célula do ataque: só um efeito (usamos partículas)
            out[f'{name}{i}'] = cut_cell(full, cell(c, r), scale)
            if name == 'ata' and i == 2:      # o hambúrguer arremessado vira o projétil
                img, ax, ay = cut_cell(full, cell(c, r), scale * 1.15, pick=(1760, 485))
                s = img.height                                  # descarta o rastro de velocidade à esquerda
                img = img.crop((img.width - s, 0, img.width, s))
                out['burger'] = (img, s // 2, s // 2)
    return out

def run_npcs():
    frames = {}
    frames.update(thyberius())
    frames.update(atendente())
    frames.update(run_julius())
    return frames

if __name__ == '__main__':
    fr = run_npcs()
    W = sum(f[0].width for f in fr.values()) + 10 * len(fr)
    H = max(f[0].height for f in fr.values()) + 20
    c = Image.new('RGBA', (W, H), (120, 150, 190, 255)); x = 5
    for k, (img, ax, ay) in fr.items():
        c.alpha_composite(img, (x, H - 10 - img.height)); x += img.width + 10
    c.save(sys.argv[1])
    print({k: v[0].size for k, v in fr.items()})
