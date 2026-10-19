# Recorta NPCs de folhas organizadas em células com moldura (ex.: Thyberius, o Mago).
import os, sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from extract import cut_frame, TARGET_H, OUT_SCALE, ROOT

# nome, arquivo, número de células, (y0, y1) da faixa das células, altura do personagem na folha (px), altura no jogo (unidades)
NPCS = [
    ('thy', 'raw/thyberius.jpg', 8, (612, 1180), 400, 62),
]

def run_npcs():
    frames = {}
    for name, path, n, (y0, y1), ref_h, world_h in NPCS:
        full = np.array(Image.open(os.path.join(ROOT, path)).convert('RGB'))
        cw = full.shape[1] / n
        for i in range(n):
            x0, x1 = int(i * cw + 12), int((i + 1) * cw - 10)
            a = full[y0:y1, x0:x1]
            border = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
            bg = np.median(border, axis=0)
            d = np.sqrt(((a.astype(float) - bg) ** 2).sum(-1))
            hard = ndi.binary_opening(d > 60, iterations=1)
            lab, _ = ndi.label(ndi.binary_dilation(hard, iterations=6))
            sizes = ndi.sum(hard, lab, range(1, lab.max() + 1))
            big = int(np.argmax(sizes)) + 1
            sl = ndi.find_objects(lab)[big - 1]
            comp = dict(sl=sl, lab=big)
            frames[f'{name}{i}'] = cut_frame(a, bg, d, lab, comp, world_h * OUT_SCALE / ref_h)
    return frames

if __name__ == '__main__':
    fr = run_npcs()
    W = sum(f[0].width for f in fr.values()) + 10 * len(fr)
    H = max(f[0].height for f in fr.values()) + 20
    c = Image.new('RGBA', (W, H), (120, 150, 190, 255)); x = 5
    for k, (img, ax, ay) in fr.items():
        c.alpha_composite(img, (x, H - 10 - img.height)); x += img.width + 10
    c.resize((W * 2, H * 2), Image.NEAREST).save(sys.argv[1])
    print({k: v[0].size for k, v in fr.items()})
