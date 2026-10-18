# Segmenta as folhas de sprite: separa cada quadro do fundo magenta.
import sys, json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

def bg_color(a):
    h, w, _ = a.shape
    border = np.concatenate([a[:8].reshape(-1,3), a[-8:].reshape(-1,3), a[:, :8].reshape(-1,3), a[:, -8:].reshape(-1,3)])
    return np.median(border, axis=0)

def fg_mask(a, bg, thr=60):
    d = np.sqrt(((a.astype(float) - bg) ** 2).sum(-1))
    return d > thr

def components(path, dil=9, min_area=3000):
    a = np.array(Image.open(path).convert('RGB'))
    bg = bg_color(a)
    m = fg_mask(a, bg)
    m = ndi.binary_opening(m, iterations=1)
    md = ndi.binary_dilation(m, iterations=dil)
    lab, n = ndi.label(md)
    objs = ndi.find_objects(lab)
    out = []
    for i, sl in enumerate(objs):
        area = (m[sl] & (lab[sl] == i + 1)).sum()
        if area < min_area: continue
        y0, y1 = sl[0].start, sl[0].stop; x0, x1 = sl[1].start, sl[1].stop
        out.append(dict(x0=x0, y0=y0, x1=x1, y1=y1, area=int(area), cy=(y0+y1)/2))
    # agrupa em linhas
    out.sort(key=lambda o: o['cy'])
    rows = []
    for o in out:
        if rows and abs(rows[-1][-1]['cy'] - o['cy']) < 150: rows[-1].append(o)
        else: rows.append([o])
    res = []
    for r in rows: res += sorted(r, key=lambda o: o['x0'])
    return a, bg, res

if __name__ == '__main__':
    for p in sys.argv[1:]:
        a, bg, objs = components(p)
        im = Image.fromarray(a); d = ImageDraw.Draw(im)
        for i, o in enumerate(objs):
            d.rectangle([o['x0'], o['y0'], o['x1'], o['y1']], outline=(0,255,0), width=4)
            d.text((o['x0']+6, o['y0']+6), str(i), fill=(255,255,0))
        im.thumbnail((700, 900)); im.save(p.replace('raw/', 'raw/dbg_').replace('.jpg', '.png'))
        print(p, bg.round(), len(objs), [(i, o['x1']-o['x0'], o['y1']-o['y0']) for i, o in enumerate(objs)])
