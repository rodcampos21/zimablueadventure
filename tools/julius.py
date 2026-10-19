# Recorta o chefe Julius, o Comuculturista, das 5 folhas (grade 6×2 com linhas finas).
# As figuras atravessam as linhas da grade, então primeiro apagamos as linhas e depois
# separamos cada figura por componentes conectados.
import os, sys, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from extract import cut_frame, OUT_SCALE, ROOT

WORLD_H = 96          # altura do Julius em pé no jogo (o Zima tem ~64)
REF_H = 799           # altura do Julius em pé na folha (pixels)
SHEETS = [('jd', 'investida'), ('ji', 'parado'), ('jp', 'soco'), ('jr', 'pedra'), ('jw', 'andar')]

def load(sheet):
    a = np.array(Image.open(os.path.join(ROOT, f'raw/julius_{sheet}.jpg')).convert('RGB'))
    bg = np.median(np.concatenate([a[:20].reshape(-1, 3), a[-20:].reshape(-1, 3)]), 0)
    return a, bg

def erase_grid(a, bg, line=(86, 24, 56)):
    a = a.copy()
    H, W, _ = a.shape
    band = np.zeros((H, W), bool)
    for x in range(400, W, 400): band[:, x - 8:x + 9] = True
    band[884:904, :] = True
    af = a.astype(float)
    dl = np.sqrt(((af - np.array(line)) ** 2).sum(-1))
    db = np.sqrt(((af - bg) ** 2).sum(-1))
    purple = (af[..., 2] > af[..., 1] + 18) & (af[..., 0] > af[..., 2])   # tons entre a linha e o fundo
    kill = band & ((dl < 40) | (purple & (db < 110)))
    a[kill] = bg.astype(np.uint8)
    return a

def components(a, bg, dil=7, min_area=2500):
    d = np.sqrt(((a.astype(float) - bg) ** 2).sum(-1))
    hard = ndi.binary_opening(d > 60, iterations=1)
    lab, n = ndi.label(ndi.binary_dilation(hard, iterations=dil))
    comps = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        area = (hard & (lab == i + 1))[sl].sum()
        if area < min_area: continue
        comps.append(dict(sl=sl, lab=i + 1, row=0 if (sl[0].start + sl[0].stop) / 2 < 896 else 1, x0=sl[1].start, area=int(area)))
    comps.sort(key=lambda o: (o['row'], o['x0']))
    return d, lab, comps

def run_julius(debug=None):
    frames = {}
    scale = WORLD_H * OUT_SCALE / REF_H
    for prefix, sheet in SHEETS:
        a, bg = load(sheet)
        a = erase_grid(a, bg)
        d, lab, comps = components(a, bg)
        for i, c in enumerate(comps):
            frames[f'{prefix}{i}'] = cut_frame(a, bg, d, lab, c, scale)
        if sheet == 'pedra':
            # a pedra solta (no quadro do arremesso) vira o projétil
            crop = a[1130:1290, 1940:2110]
            dd = np.sqrt(((crop.astype(float) - bg) ** 2).sum(-1))
            hard = ndi.binary_opening(dd > 55, iterations=1)
            lb, n = ndi.label(ndi.binary_dilation(hard, iterations=2))
            objs = ndi.find_objects(lb)
            k = max(range(n), key=lambda j: (hard & (lb == j + 1)).sum()) + 1
            img, ax, ay = cut_frame(crop, bg, dd, lb, dict(sl=objs[k - 1], lab=k), scale * 1.05)
            frames['rock'] = (img, img.width // 2, img.height // 2)
        if debug:
            im = Image.fromarray(a); dr = ImageDraw.Draw(im)
            for i, c in enumerate(comps):
                sl = c['sl']; dr.rectangle([sl[1].start, sl[0].start, sl[1].stop, sl[0].stop], outline=(0, 255, 0), width=4)
                dr.text((sl[1].start + 8, sl[0].start + 8), f'{prefix}{i}', fill=(255, 255, 0))
            im.thumbnail((900, 700)); im.save(os.path.join(debug, f'jul_{sheet}.png'))
    return frames

if __name__ == '__main__':
    out = sys.argv[1]
    fr = run_julius(debug=out)
    print(len(fr), {k: v[0].size for k, v in fr.items()})
