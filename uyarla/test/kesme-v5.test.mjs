// node --test uyarla/test/kesme-v5.test.mjs   (ag yok, ozel varlik yok; sharp + python/opencv)
// KESME (lib/kesme-v5.mjs + py/kesme.py + py/iz-atlas.py): imlec izi icin tabak kesimi ve kalite kapisi.  Python/opencv yoksa kesme testleri atlanir;
// KESME_ZORUNLU=1 (GitHub Actions kesme-kontrol is akisi) iken atlanmaz, python yoksa HATA verir (bulutta iz sessizce kapanmasin).
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { sharp } from '../lib/gorsel.mjs';
import { kesimGecerli, kesimKalite, kesimYap, pythonBul, pythonSifirla, KESME_ESIK } from '../lib/kesme-v5.mjs';

test('kesim tanimi: ad, foto kimligi ve kutu denetlenir', () => {
  assert.equal(kesimGecerli({ ad: 'ezme', foto: '05', kutu: [0.1, 0.1, 0.4, 0.5] }), null);
  assert.match(kesimGecerli({ ad: 'Ezme!', foto: '05', kutu: [0.1, 0.1, 0.4, 0.5] }), /ad/);
  assert.match(kesimGecerli({ ad: 'ezme', foto: '5', kutu: [0.1, 0.1, 0.4, 0.5] }), /foto/);
  assert.match(kesimGecerli({ ad: 'ezme', foto: '05', kutu: [0.1, 0.1, 0.12, 0.5] }), /kutu/);
  assert.match(kesimGecerli({ ad: 'ezme', foto: '05', kutu: [0.5, 0.1, 0.1, 0.5] }), /kutu/);
  assert.match(kesimGecerli({ ad: 'ezme', foto: '05', kutu: [0, 0, 1.2, 0.5] }), /kutu/);
  assert.match(kesimGecerli(null), /ad/);
});

test('kesim kalitesi: kenara deger, tirtikli (doluluk) ve belirsiz (kontrast) kesim elenir; esikler 4 kesim, 0.95, 45', () => {
  assert.deepEqual([KESME_ESIK.enAz, KESME_ESIK.doluluk, KESME_ESIK.kenarKontrast], [4, 0.95, 45]);
  assert.deepEqual(kesimKalite({ kenarTemas: false, doluluk: 0.97, kenarKontrast: 80 }), []);
  assert.equal(kesimKalite({ kenarTemas: true, doluluk: 0.97, kenarKontrast: 80 }).length, 1);
  assert.match(kesimKalite({ kenarTemas: false, doluluk: 0.9, kenarKontrast: 80 })[0], /doluluk/);
  assert.match(kesimKalite({ kenarTemas: false, doluluk: 0.97, kenarKontrast: 30 })[0], /kontrast/);
  assert.equal(kesimKalite({ kenarTemas: true, doluluk: 0.5, kenarKontrast: 1 }).length, 3);
  assert.equal(kesimKalite(null).length, 1);
});

const ZORUNLU = process.env.KESME_ZORUNLU === '1';
const PY = pythonBul();
if (ZORUNLU) test('python ve opencv kurulu (KESME_ZORUNLU)', () => { assert.ok(PY, 'python/opencv yok: iz bulutta calismaz'); });
const atla = !PY && !ZORUNLU && 'python/opencv yok';

// deterministik sahne: ahsap benzeri dokulu koyu zemin, uzerinde beyaz tabak + renkli yemek (merkezde), kutu = tabagin etrafi
function sahne(w, h, tabaklar, tohum = 11) {
  let s = tohum; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const a = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; const g = 40 + 18 * Math.sin(x / 23 + Math.sin(y / 41)) + r() * 14; a[i] = g * 1.1; a[i + 1] = g * 0.8; a[i + 2] = g * 0.55; }
  tabaklar.forEach((t, k) => {
    const cols = [[205, 70, 50], [90, 150, 70], [225, 175, 70], [150, 95, 55]][k % 4];
    for (let y = Math.max(0, t.cy - t.r - 2); y < Math.min(h, t.cy + t.r + 2); y++) for (let x = Math.max(0, t.cx - t.r - 2); x < Math.min(w, t.cx + t.r + 2); x++) {
      const d = Math.hypot(x - t.cx, y - t.cy); if (d > t.r) continue; const i = (y * w + x) * 3; const n = r() * 10;
      if (d > t.r * 0.62) { a[i] = 236 - n; a[i + 1] = 234 - n; a[i + 2] = 226 - n; } else { a[i] = cols[0] + n * 2; a[i + 1] = cols[1] + n * 2; a[i + 2] = cols[2] + n; }
    }
  });
  return sharp(a, { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 92 }).toBuffer();
}

async function kur(tabaklar, W = 1600, H = 1000) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kesme-v5-')); fs.mkdirSync(path.join(dir, 'img'));
  fs.writeFileSync(path.join(dir, 'img', 'm01.webp'), await sahne(W, H, tabaklar));
  const kesimler = tabaklar.map((t, i) => ({ ad: `tabak-${i + 1}`, foto: '01', kutu: [Math.max(0, (t.cx - t.r * 1.08) / W), Math.max(0, (t.cy - t.r * 1.08) / H), Math.min(1, (t.cx + t.r * 1.08) / W), Math.min(1, (t.cy + t.r * 1.08) / H)], elips: true }));
  return { dir, R: { photos: [{ id: '01', file: 'img/m01.webp' }] }, kesimler };
}

test('kesme: dort belirgin tabak temiz kesilir, kalite gecer, atlas hucre basina bir tabak', { skip: atla, timeout: 180000 }, async () => {
  const k = await kur([{ cx: 330, cy: 300, r: 190 }, { cx: 1000, cy: 330, r: 210 }, { cx: 420, cy: 760, r: 170 }, { cx: 1150, cy: 760, r: 180 }]);
  try {
    const r = kesimYap({ kesimler: k.kesimler, R: k.R, kaynakDizin: k.dir, calisma: path.join(k.dir, 'c') });
    assert.equal(r.durum, 'ok', JSON.stringify({ d: r.durum, e: r.elenen, g: (r.gecen || []).length }));
    assert.equal(r.gecen.length, 4); assert.equal(r.atlas.n, 4); assert.equal(r.atlas.hucre, KESME_ESIK.hucre);
    for (const g of r.gecen) assert.deepEqual(kesimKalite(g.rapor), [], `${g.ad}: ${JSON.stringify(g.rapor)}`);
    const m = await sharp(r.atlas.file).metadata(); assert.equal(m.width, 4 * KESME_ESIK.hucre); assert.equal(m.height, KESME_ESIK.hucre); assert.ok(m.hasAlpha);
  } finally { fs.rmSync(k.dir, { recursive: true, force: true }); }
});

test('kesme: ucu kadraj disina tasan tabak (kenara degiyor) elenir; geriye 4 temiz kalmazsa iz yok (yetersiz)', { skip: atla, timeout: 180000 }, async () => {
  const k = await kur([{ cx: 330, cy: 300, r: 190 }, { cx: 1000, cy: 330, r: 210 }, { cx: 420, cy: 760, r: 170 }, { cx: 1560, cy: 760, r: 150 }]);
  try {
    const r = kesimYap({ kesimler: k.kesimler, R: k.R, kaynakDizin: k.dir, calisma: path.join(k.dir, 'c') });
    assert.equal(r.durum, 'yetersiz'); assert.equal(r.atlas, null); assert.ok(r.gecen.length <= 3);
    assert.ok(r.elenen.some((x) => /kenar/.test(x.neden)), JSON.stringify(r.elenen));
  } finally { fs.rmSync(k.dir, { recursive: true, force: true }); }
});

test('kesme: gecersiz tanim ve eksik fotograf elenir, hicbiri cokmez', { skip: atla, timeout: 60000 }, async () => {
  const k = await kur([{ cx: 330, cy: 300, r: 190 }]);
  try {
    const r = kesimYap({ kesimler: [{ ad: 'X!', foto: '01', kutu: [0, 0, 1, 1] }, { ad: 'yok', foto: '09', kutu: [0.1, 0.1, 0.4, 0.5] }], R: k.R, kaynakDizin: k.dir, calisma: path.join(k.dir, 'c') });
    assert.equal(r.durum, 'yetersiz'); assert.equal(r.elenen.length, 2);
  } finally { fs.rmSync(k.dir, { recursive: true, force: true }); }
});

test('kesme: kesim listesi bos ise sessizce kesim-yok; python bulunamazsa python-yok (hata degil, iz kapanir ve nedeni raporlanir)', async () => {
  assert.equal(kesimYap({ kesimler: [], R: {}, kaynakDizin: '.', calisma: os.tmpdir() }).durum, 'kesim-yok');
  const eskiPath = process.env.PATH; const eskiPy = process.env.PEAK_PYTHON;
  try {
    process.env.PATH = ''; process.env.PEAK_PYTHON = ''; pythonSifirla();
    const r = kesimYap({ kesimler: [{ ad: 'ezme', foto: '01', kutu: [0.1, 0.1, 0.4, 0.5] }], R: { photos: [] }, kaynakDizin: '.', calisma: path.join(os.tmpdir(), 'kesme-yok') });
    assert.equal(r.durum, 'python-yok'); assert.equal(r.atlas, null); assert.match(r.elenen[0].neden, /python/);
  } finally { process.env.PATH = eskiPath; if (eskiPy === undefined) delete process.env.PEAK_PYTHON; else process.env.PEAK_PYTHON = eskiPy; pythonSifirla(); }
});
