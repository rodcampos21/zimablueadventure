# Extrai quadros das folhas de sprite do Zima, remove o fundo e monta o atlas do jogo.
# Uso: python3 tools/extract.py   (gera assets/zima.png e js/atlas.js)
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from segment import bg_color

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_H = 64          # altura do Zima em pé, em pixels do jogo
REF_H = {'big': 483, 'crouch': 217}

SHEETS = {
    'attack':    ('raw/attack.jpg', 9, 3000, 'big'),
    'crouch':    ('raw/crouch.jpg', 3, 800, 'crouch'),
    'idle_walk': ('raw/idle_walk.jpg', 9, 3000, 'big'),
    'roll':      ('raw/roll.jpg', 9, 3000, 'big'),
    'special':   ('raw/special.jpg', 9, 3000, 'big'),
    'run':       ('raw/run.jpg', 9, 3000, 'big'),
}

def segment(a, bg, dil, min_area):
    d = np.sqrt(((a.astype(float) - bg) ** 2).sum(-1))
    hard = ndi.binary_opening(d > 60, iterations=1)
    lab, _ = ndi.label(ndi.binary_dilation(hard, iterations=dil))
    comps = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        reg = (lab == i + 1)
        area = (hard & reg)[sl].sum()
        if area < min_area: continue
        comps.append(dict(sl=sl, lab=i + 1, cy=(sl[0].start + sl[0].stop) / 2, x0=sl[1].start))
    comps.sort(key=lambda o: o['cy'])
    rows = []
    for o in comps:
        if rows and abs(rows[-1][-1]['cy'] - o['cy']) < 0.3 * (o['sl'][0].stop - o['sl'][0].start): rows[-1].append(o)
        else: rows.append([o])
    ordered = []
    for r in rows: ordered += sorted(r, key=lambda o: o['x0'])
    return d, hard, lab, ordered

def split_wide(d, hard, lab, comp, ref_w):
    """Divide componentes que juntaram dois quadros (coluna com menos pixels)."""
    sl = comp['sl']; w = sl[1].stop - sl[1].start
    if w < ref_w * 1.7: return [comp]
    m = (hard & (lab == comp['lab']))[sl]
    col = m.sum(0); mid = w // 2; win = w // 4
    cut = mid - win + int(np.argmin(col[mid - win: mid + win]))
    a = dict(comp, sl=(sl[0], slice(sl[1].start, sl[1].start + cut)))
    b = dict(comp, sl=(sl[0], slice(sl[1].start + cut, sl[1].stop)))
    return [a, b]

def cut_frame(a, bg, d, lab, comp, scale):
    pad = 6
    y0 = max(0, comp['sl'][0].start - pad); y1 = min(a.shape[0], comp['sl'][0].stop + pad)
    x0 = max(0, comp['sl'][1].start - pad); x1 = min(a.shape[1], comp['sl'][1].stop + pad)
    region = ndi.binary_dilation(lab == comp['lab'], iterations=3)[y0:y1, x0:x1]
    # restringe ao corte horizontal (para componentes divididos)
    cx0, cx1 = comp['sl'][1].start - x0, comp['sl'][1].stop - x0
    region[:, :max(0, cx0)] = False; region[:, cx1:] = False
    px = a[y0:y1, x0:x1].astype(float); dd = d[y0:y1, x0:x1]
    alpha = np.clip((dd - 45) / 55, 0, 1) * region
    # remove o "vazamento" do magenta nas bordas
    al = np.maximum(alpha, 1e-3)[..., None]
    col = np.clip((px - (1 - al) * bg) / al, 0, 255)
    rgba = np.dstack([col * alpha[..., None], alpha * 255]).astype(np.float32)
    # reduz com média (pré-multiplicado)
    H, W = alpha.shape
    nw, nh = max(1, round(W * scale)), max(1, round(H * scale))
    chans = [np.array(Image.fromarray(rgba[..., i]).resize((nw, nh), Image.BOX)) for i in range(4)]
    A = chans[3] / 255.0
    rgb = np.stack(chans[:3], -1) / np.maximum(A, 1e-3)[..., None]
    A = np.where(A > 0.45, 1.0, 0.0)          # borda nítida, estilo pixel art
    out = np.dstack([np.clip(rgb, 0, 255), A * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    bbox = img.getbbox(); img = img.crop(bbox)
    o = np.array(img)
    # âncora: centro de massa dos pixels escuros (terno/cabelo) e base dos pés
    lum = o[..., :3].mean(-1); dark = (o[..., 3] > 0) & (lum < 70)
    ys, xs = np.nonzero(dark if dark.sum() > 20 else o[..., 3] > 0)
    ax = float(xs.mean()); ay = float(np.nonzero(o[..., 3] > 0)[0].max() + 1)
    return img, round(ax), round(ay)

def run(select=None, contact=None):
    frames = {}
    for name, (path, dil, mina, ref) in SHEETS.items():
        a = np.array(Image.open(os.path.join(ROOT, path)).convert('RGB'))
        bg = bg_color(a)
        d, hard, lab, comps = segment(a, bg, dil, mina)
        ref_w = REF_H[ref] * 0.95
        allc = []
        for c in comps: allc += split_wide(d, hard, lab, c, ref_w)
        scale = TARGET_H / REF_H[ref]
        for i, c in enumerate(allc):
            frames[f'{name}{i}'] = cut_frame(a, bg, d, lab, c, scale)
    if contact:
        names = list(frames)
        cw, ch = 140, 90; cols = 12
        sheet = Image.new('RGBA', (cols * cw, ((len(names) + cols - 1) // cols) * ch), (60, 70, 90, 255))
        dr = ImageDraw.Draw(sheet)
        for k, n in enumerate(names):
            img, ax, ay = frames[n]
            bx, by = (k % cols) * cw, (k // cols) * ch
            sheet.alpha_composite(img, (bx + 50 - ax, by + 78 - ay))
            dr.line([bx + 50, by + 78, bx + 50, by + 74], fill=(255, 0, 0))
            dr.text((bx + 2, by + 2), n, fill=(255, 255, 0))
        sheet.save(contact)
    return frames

if __name__ == '__main__':
    run(contact=sys.argv[1] if len(sys.argv) > 1 else None)
