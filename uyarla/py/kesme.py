# KESME TEZGAHI v5 (restoran imlec izi): isletmenin KENDI yemek fotografindan tek tabak / kase / yemek keser.
# Klasik GrabCut (model yok). Pastane kesme.py'nin genisletilmisi: kutu ipucu, elips uydurma (tabak kenari temiz), haric cokgen, kalite olcusu.
#   python -I kesme-v5.py spec.json outDir onizleme.jpg
# spec: [{ "ad": "ezme", "src": "<dosya>", "kutu": [x0,y0,x1,y1] (0..1 goreli),
#          "elips": true (tabak/kase: maskeyi uydurulan elipsle birlestir), "ic": 0.5 (kesin on plan elipsi orani),
#          "haric": [[[x,y],...]] (goreli cokgenler, kesin arka plan; or. catal), "max": 480 }]
# Kalite (her kesim icin JSON satiri):
#   kenarTemas: maske kaynak karenin kenarina degiyor mu (kesik tabak = RED)
#   kenarKontrast: maske sinirinin hemen ici ile hemen disi arasindaki ortalama renk farki (0..441); dusukse kesim belirsiz
#   doluluk: maskenin kendi dis buke (convex hull) alanina orani (tabakta ~0.95+; dusukse dis kenar tirtikli)
#   alan: maske / kutu alani
import sys, json, os
import numpy as np, cv2
from PIL import Image, ImageOps

spec = json.load(open(sys.argv[1], encoding='utf8')); out = sys.argv[2]; prev = sys.argv[3]
os.makedirs(out, exist_ok=True)
rapor = []
tiles = []
for s in spec:
    im = ImageOps.exif_transpose(Image.open(s['src'])).convert('RGB'); W, H = im.size
    x0, y0, x1, y1 = s['kutu']; x0, x1 = x0 * W, x1 * W; y0, y1 = y0 * H, y1 * H
    bw, bh = x1 - x0, y1 - y0
    m = max(bw, bh) * 0.12
    rx0, ry0, rx1, ry1 = int(max(0, x0 - m)), int(max(0, y0 - m)), int(min(W, x1 + m)), int(min(H, y1 + m))
    roi = np.array(im.crop((rx0, ry0, rx1, ry1)))[:, :, ::-1].copy()
    sc = min(1.0, 900 / max(roi.shape[:2]))
    small = cv2.resize(roi, (int(roi.shape[1] * sc), int(roi.shape[0] * sc)), interpolation=cv2.INTER_AREA) if sc < 1 else roi.copy()
    sh, sw = small.shape[:2]
    bx0, by0, bx1, by1 = (x0 - rx0) * sc, (y0 - ry0) * sc, (x1 - rx0) * sc, (y1 - ry0) * sc
    cx, cy, ax, ay = (bx0 + bx1) / 2, (by0 + by1) / 2, (bx1 - bx0) / 2, (by1 - by0) / 2
    mask = np.full((sh, sw), cv2.GC_BGD, np.uint8)
    cv2.rectangle(mask, (int(bx0), int(by0)), (int(bx1), int(by1)), int(cv2.GC_PR_BGD), -1)
    ic = s.get('ic', 0.55)
    cv2.ellipse(mask, (int(cx), int(cy)), (max(1, int(ax * 0.92)), max(1, int(ay * 0.92))), 0, 0, 360, int(cv2.GC_PR_FGD), -1)
    cv2.ellipse(mask, (int(cx), int(cy)), (max(1, int(ax * ic)), max(1, int(ay * ic))), 0, 0, 360, int(cv2.GC_FGD), -1)
    for poly in s.get('haric', []):
        pts = np.array([[(px * W - rx0) * sc, (py * H - ry0) * sc] for px, py in poly], np.int32)
        cv2.fillPoly(mask, [pts], int(cv2.GC_BGD))
    bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(small, mask, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8)
    if n > 1: big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); fg = np.where(lab == big, 255, 0).astype(np.uint8)
    k = max(3, int(round(min(sh, sw) / 140)) | 1)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k * 2 + 1, k * 2 + 1)))
    cnts, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    fg = np.zeros_like(fg); cv2.drawContours(fg, cnts, -1, 255, -1)
    if s.get('elips') and cnts:
        c = max(cnts, key=cv2.contourArea)
        if len(c) >= 5 and s.get('ikinci', True):
            # ikinci gecis: ilk elipsle yeniden kur (dis halka kesin arka plan, ic kesin on plan, kenar bandi belirsiz)
            (ex, ey), (ea, eb), ea_rot = cv2.fitEllipse(c)
            m2 = np.full((sh, sw), cv2.GC_BGD, np.uint8)
            dK = s.get('disK', 1.10)
            cv2.ellipse(m2, ((ex, ey), (ea * dK, eb * dK), ea_rot), int(cv2.GC_PR_BGD), -1)
            cv2.ellipse(m2, ((ex, ey), (ea * 0.985, eb * 0.985), ea_rot), int(cv2.GC_PR_FGD), -1)
            cv2.ellipse(m2, ((ex, ey), (ea * 0.86, eb * 0.86), ea_rot), int(cv2.GC_FGD), -1)
            for poly in s.get('tasmaIzin', []):  # garniturun tasabilecegi bolge (goreli cokgen)
                pts = np.array([[(px * W - rx0) * sc, (py * H - ry0) * sc] for px, py in poly], np.int32)
                pm = np.zeros_like(m2); cv2.fillPoly(pm, [pts], 1); m2[(pm == 1) & (m2 == cv2.GC_BGD)] = cv2.GC_PR_BGD
            for poly in s.get('haric', []):
                pts = np.array([[(px * W - rx0) * sc, (py * H - ry0) * sc] for px, py in poly], np.int32)
                cv2.fillPoly(m2, [pts], int(cv2.GC_BGD))
            bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
            cv2.grabCut(small, m2, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
            fg = np.where((m2 == cv2.GC_FGD) | (m2 == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
            n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8)
            if n > 1: big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); fg = np.where(lab == big, 255, 0).astype(np.uint8)
            fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k * 2 + 1, k * 2 + 1)))
            cnts, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            fg = np.zeros_like(fg); cv2.drawContours(fg, cnts, -1, 255, -1)
            c = max(cnts, key=cv2.contourArea)
        if len(c) >= 5:
            (ex, ey), (ea, eb), ea_rot = cv2.fitEllipse(c)
            el = np.zeros_like(fg); cv2.ellipse(el, ((ex, ey), (ea * s.get('elipsK', 0.985), eb * s.get('elipsK', 0.985)), ea_rot), 255, -1)
            # tabak kenari: uydurulan elips; elipsin disina tasan garnitur yalniz elipse bitisikse kalir
            disari = cv2.bitwise_and(fg, cv2.bitwise_not(el))
            if s.get('tasma', True):
                n2, lab2, st2, _ = cv2.connectedComponentsWithStats(disari, 8)
                keep = np.zeros_like(fg)
                for i in range(1, n2):
                    if st2[i, cv2.CC_STAT_AREA] > (sh * sw) * 0.0015: keep[lab2 == i] = 255
                fg = cv2.bitwise_or(el, keep)
            else:
                fg = el
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    for poly in s.get('haric', []):
        pts = np.array([[(px * W - rx0) * sc, (py * H - ry0) * sc] for px, py in poly], np.int32)
        cv2.fillPoly(fg, [pts], 0)
    big_m = cv2.resize(fg, (roi.shape[1], roi.shape[0]), interpolation=cv2.INTER_LINEAR)
    blur = max(1.0, 1.2 / sc * 0.5)
    alpha = cv2.GaussianBlur(big_m, (0, 0), blur)
    alpha = np.clip((alpha.astype(np.float32) - 40) * 255 / 175, 0, 255).astype(np.uint8)
    # kalite
    hard = (alpha > 128).astype(np.uint8)
    full = np.zeros((H, W), np.uint8); full[ry0:ry1, rx0:rx1] = hard
    temas = bool(full[0, :].any() or full[-1, :].any() or full[:, 0].any() or full[:, -1].any())
    er = cv2.erode(hard, np.ones((5, 5), np.uint8)); di = cv2.dilate(hard, np.ones((5, 5), np.uint8))
    ic_hal = (hard - er).astype(bool); dis_hal = (di - hard).astype(bool)
    rgb = roi[:, :, ::-1].astype(np.float32)
    # sinir boyunca yerel fark: her sinir pikselinde 4 px icerisi ile 4 px disari (normal yonu yerine bulanik ortalamalar)
    ici = cv2.blur(rgb * hard[:, :, None], (9, 9)) / np.maximum(cv2.blur(hard.astype(np.float32), (9, 9))[:, :, None], 1e-3)
    disi = cv2.blur(rgb * (1 - hard)[:, :, None], (9, 9)) / np.maximum(cv2.blur((1 - hard).astype(np.float32), (9, 9))[:, :, None], 1e-3)
    sinir = cv2.morphologyEx(hard, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)).astype(bool)
    kontrast = float(np.linalg.norm((ici - disi)[sinir], axis=1).mean()) if sinir.any() else 0.0
    cs, _ = cv2.findContours(hard, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cs, key=cv2.contourArea) if cs else None
    doluluk = float(cv2.contourArea(c) / max(1.0, cv2.contourArea(cv2.convexHull(c)))) if c is not None else 0.0
    alan = float(hard.sum() / max(1.0, bw * bh))
    ys, xs = np.where(alpha > 8)
    if not len(xs): print('BOS', s['ad']); continue
    qx0, qy0, qx1, qy1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgba = np.dstack([roi[:, :, ::-1], alpha])[qy0:qy1, qx0:qx1]
    # yari saydam kenarda arka plan rengi kalmasin: kenar piksellerinin rengini iceriden yay (renk tasmasi temizligi)
    a = rgba[:, :, 3].astype(np.float32) / 255
    inner = (a > 0.98).astype(np.uint8)
    if inner.any():
        dist, lbl = cv2.distanceTransformWithLabels(1 - inner, cv2.DIST_L2, 3, labelType=cv2.DIST_LABEL_PIXEL)
        iy, ix = np.where(inner == 1); idx = np.zeros(lbl.max() + 1, np.int64); idx[lbl[iy, ix]] = iy * inner.shape[1] + ix
        src = rgba[:, :, :3].reshape(-1, 3); near = src[idx[lbl]].reshape(rgba.shape[0], rgba.shape[1], 3)
        edge = (a > 0) & (a <= 0.98)
        rgba[:, :, :3][edge] = near[edge]
    if s.get('ton'):  # yalniz pozlama duzeltmesi (karanlik cekim): gama + kazanc + hafif doygunluk; icerik degismez
        g, kz, dy = s['ton'].get('gama', 1.0), s['ton'].get('kazanc', 1.0), s['ton'].get('doygunluk', 1.0)
        f = np.clip(((rgba[:, :, :3].astype(np.float32) / 255) ** g) * kz, 0, 1)
        if dy != 1.0:
            gr = f.mean(axis=2, keepdims=True); f = np.clip(gr + (f - gr) * dy, 0, 1)
        rgba[:, :, :3] = (f * 255 + 0.5).astype(np.uint8)
    h, w = rgba.shape[:2]; side = int(max(w, h) * 1.04)
    can = np.zeros((side, side, 4), np.uint8); oy, ox = (side - h) // 2, (side - w) // 2; can[oy:oy + h, ox:ox + w] = rgba
    img = Image.fromarray(can, 'RGBA'); mx = s.get('max', 480)
    if side > mx: img = img.resize((mx, mx), Image.LANCZOS)
    img.save(os.path.join(out, s['ad'] + '.png'), optimize=True)
    r = {'ad': s['ad'], 'kaynak': os.path.basename(s['src']), 'kaynakPx': [W, H], 'kesitPx': [int(w), int(h)], 'cikti': img.size[0],
         'kenarTemas': temas, 'kenarKontrast': round(kontrast, 1), 'doluluk': round(doluluk, 3), 'alan': round(alan, 3)}
    rapor.append(r); print(json.dumps(r, ensure_ascii=False))
    t = img.resize((220, 220), Image.LANCZOS)
    a1 = Image.new('RGB', (220, 220), (28, 26, 24)); a1.paste(t, (0, 0), t)
    b1 = Image.new('RGB', (220, 220), (250, 246, 238)); b1.paste(t, (0, 0), t)
    c1 = Image.new('RGB', (220, 220), (200, 30, 60)); c1.paste(t, (0, 0), t)
    tiles.append((a1, b1, c1))
json.dump(rapor, open(os.path.join(out, 'kesme-rapor.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
if tiles:
    cv = Image.new('RGB', (220 * len(tiles), 660), 'white')
    for i, (a1, b1, c1) in enumerate(tiles): cv.paste(a1, (i * 220, 0)); cv.paste(b1, (i * 220, 220)); cv.paste(c1, (i * 220, 440))
    cv.save(prev, quality=88)
