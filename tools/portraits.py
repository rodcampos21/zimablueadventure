# Prepara os retratos de diálogo (cartões com moldura) e os rostos para o HUD.
# Uso: python3 tools/portraits.py  -> assets/portraits/<nome>_card.png e <nome>_face.png
import os, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARD = 448     # lado do cartão (suficiente para a qualidade Alta: 112 unidades × 4)
FACE = 160     # lado do rosto recortado (HUD e marcadores)
# nome: (arquivo, recorte do rosto (x0, y0, lado), fundo interno mágico?)
P = {
    'zima': ('zima.jpg', (501, 213, 1067), False),
    'julius': ('julius.jpg', (480, 176, 1120), False),
    'thyberius': ('thyberius.jpg', (545, 75, 1047), True),
}

def key_outside(a, bg):
    """Torna transparente o magenta ligado às bordas da imagem (fora da moldura)."""
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    near = d < 60
    lab, n = ndi.label(near)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    outside = np.isin(lab, border[border > 0])
    outside = ndi.binary_opening(outside, iterations=2) | (outside & (d < 30))
    # borda suave: transição de 2px
    dist_in = ndi.distance_transform_edt(~outside)
    alpha = np.clip(dist_in / 2.5, 0, 1)
    return alpha, d

def magic_backdrop(h, w, seed=3):
    """Fundo noturno com brilhos, para substituir o magenta interno do retrato do mago."""
    y = np.linspace(0, 1, h)[:, None]; x = np.linspace(0, 1, w)[None, :]
    top = np.array([24, 22, 64.]); bot = np.array([64, 44, 118.])
    img = top * (1 - y[..., None]) + bot * y[..., None]
    glow = np.exp(-(((x - 0.5) ** 2) * 4 + ((y - 0.38) ** 2) * 5))[..., None]
    img = img + glow * np.array([70, 60, 110.])
    img = np.broadcast_to(img, (h, w, 3)).copy()
    r = np.random.default_rng(seed)
    for _ in range(140):
        cx, cy, s = r.integers(0, w), r.integers(0, h), r.integers(2, 7)
        img[max(0, cy - s):cy + s, max(0, cx - 1):cx + 1] = [235, 225, 255]
        img[max(0, cy - 1):cy + 1, max(0, cx - s):cx + s] = [235, 225, 255]
    return np.clip(img, 0, 255)

def process(name, fn, face, magic):
    src = Image.open(os.path.join(ROOT, 'raw/portraits', fn)).convert('RGB')
    a = np.array(src).astype(float)
    bg = np.median(np.concatenate([a[:8, :].reshape(-1, 3), a[-8:, :].reshape(-1, 3)]), 0)
    if magic:
        # o fundo do mago é o próprio magenta, dentro da moldura: troca por um céu mágico
        mbg = np.array([166, 64, 108.])
        d = np.sqrt(((a - mbg) ** 2).sum(-1))
        hue = (a[..., 2] > a[..., 1] + 22) & (a[..., 0] > a[..., 1] + 60)      # só magenta de verdade, nunca a pele
        m = np.clip((62 - d) / 22, 0, 1) * hue
        m = ndi.gaussian_filter(m, 0.8)
        back = magic_backdrop(*a.shape[:2])
        a = a * (1 - m[..., None]) + back * m[..., None]
        alpha = np.ones(a.shape[:2])
    else:
        alpha, d = key_outside(a, bg)
        # remove o tom magenta dos pixels de borda
        edge = (alpha > 0) & (alpha < 1)
        a[edge] = a[edge] * 0.6 + np.array([40, 30, 45.]) * 0.4
    rgba = np.dstack([np.clip(a, 0, 255), alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    # rosto (antes de cortar o cartão)
    x0, y0, s = face
    fc = Image.new('RGBA', (s, s), (42, 33, 64, 255)); fc.alpha_composite(im.crop((x0, y0, x0 + s, y0 + s)))
    fc = fc.convert('RGB').resize((FACE, FACE), Image.LANCZOS)
    fc = fc.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    # cartão: recorta o conteúdo e encaixa num quadrado
    bbox = im.getbbox(); im = im.crop(bbox)
    side = max(im.size)
    sq = Image.new('RGBA', (side, side)); sq.alpha_composite(im, ((side - im.width) // 2, side - im.height))
    card = sq.resize((CARD, CARD), Image.LANCZOS)
    out = os.path.join(ROOT, 'assets/portraits'); os.makedirs(out, exist_ok=True)
    card.save(os.path.join(out, f'{name}_card.png'), optimize=True)
    fc.save(os.path.join(out, f'{name}_face.png'), optimize=True)
    return card, fc

if __name__ == '__main__':
    import sys
    cards = [process(n, *v) for n, v in P.items()]
    if len(sys.argv) > 1:
        W = CARD * 3 + FACE * 3 + 60
        sheet = Image.new('RGBA', (W, CARD), (70, 90, 120, 255)); x = 0
        for c, f in cards: sheet.alpha_composite(c, (x, 0)); x += CARD
        for c, f in cards: sheet.paste(f, (x + 10, 10)); x += FACE + 20
        sheet.save(sys.argv[1])
    print('ok')
