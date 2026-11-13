# iz atlasi (v5 restoran imlec izi): kesim PNG'leri -> tek satir WebP atlas, hucre basina bir tabak, yumusak golge dosyada pismis.
#   python iz-atlas.py out.webp hucre a.png b.png ...
import sys
from PIL import Image, ImageFilter
out = sys.argv[1]; cell = int(sys.argv[2]); fs = sys.argv[3:]
A = Image.new('RGBA', (cell * len(fs), cell), (0, 0, 0, 0))
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGBA')
    bb = im.getbbox(); im = im.crop(bb)
    s = (cell * 0.84) / max(im.size); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    x = (cell - im.width) // 2; y = (cell - im.height) // 2 - round(cell * 0.02)
    # golge: tabagin alfa maskesi, asagi kaydirilmis ve bulanik
    sh = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
    a = im.split()[3].point(lambda v: int(v * 0.42))
    blk = Image.new('RGBA', im.size, (20, 14, 10, 255)); blk.putalpha(a)
    sh.paste(blk, (x, y + round(cell * 0.05)), blk)
    sh = sh.filter(ImageFilter.GaussianBlur(cell * 0.036))
    c = Image.new('RGBA', (cell, cell), (0, 0, 0, 0)); c.alpha_composite(sh); c.alpha_composite(im, (x, y))
    A.paste(c, (i * cell, 0))
A.save(out, 'WEBP', quality=84, alpha_quality=90, method=6)
print(out, A.size)
