// node --test uyarla/test/ust-v5.test.mjs   (ag yok, ozel varlik yok; sharp)
// V5 UST KATMAN (lib/ust-v5.mjs): kayan yazi seridi yok; yemek sahnesi ya da ince ayirici; sekmeli menu; netlik kapisindan gecen fotograflar; galeri; iz verisi.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { sharp } from '../lib/gorsel.mjs';
import { ustHazirla, ustUygula, sahneDosyalari } from '../lib/ust-v5.mjs';
import { ustDosyaDenetimi } from '../lib/ust-kapi.mjs';
import { ustDenetle, kayitKur } from '../restoran-icerik.mjs';

function ham(w, h, tohum) {
  let s = tohum; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const a = Buffer.alloc(w * h * 3); for (let i = 0; i < a.length; i += 3) { a[i] = 90; a[i + 1] = 70; a[i + 2] = 55; }
  for (let n = 0; n < Math.round((w * h) / 9000); n++) {
    const bw = 12 + Math.floor(r() * 90); const bh = 12 + Math.floor(r() * 90); const x0 = Math.floor(r() * (w - bw)); const y0 = Math.floor(r() * (h - bh)); const c = [r() * 255, r() * 255, r() * 255];
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) { const i = (y * w + x) * 3; a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; }
  }
  return a;
}
const foto = (w, h, tohum, bulanik = 0) => { const s = sharp(ham(w, h, tohum), { raw: { width: w, height: h, channels: 3 } }); return (bulanik ? s.blur(bulanik) : s).jpeg({ quality: 92 }).toBuffer(); };

const ITEMS = [
  { n: 'Izgara Köfte', d: 'Közlenmiş biberle', p: '₺420', cat: 'Izgaralar' }, { n: 'Kuzu Pirzola', d: '', p: '₺780', cat: 'Izgaralar' }, { n: 'Karışık Meze', d: 'Altı çeşit', p: '₺310', cat: 'Mezeler' },
  { n: 'Humus', d: '', p: '₺180', cat: 'Mezeler' }, { n: 'Fırın Sütlaç', d: '', p: '₺150', cat: 'Tatlılar' }, { n: 'Kaymaklı Kabak', d: '', p: '₺170', cat: 'Tatlılar' },
];

async function veriKur({ yumusak = [], menuFoto = {}, ust = {}, ekFoto = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ust-v5-')); const imgDir = path.join(dir, 'pg', 'img'); fs.mkdirSync(path.join(dir, 'img'), { recursive: true }); fs.mkdirSync(imgDir, { recursive: true });
  const photos = [];
  for (let i = 1; i <= 7; i++) { const id = String(i).padStart(2, '0'); const buf = await foto(ekFoto[id] ? ekFoto[id][0] : 2000, ekFoto[id] ? ekFoto[id][1] : 1250, 100 + i, yumusak.includes(id) ? 9 : 0); fs.writeFileSync(path.join(dir, 'img', `m${id}.jpg`), buf); photos.push({ id, file: `img/m${id}.jpg`, alt: ITEMS[i - 1] && menuFoto[id] ? '' : '', focus: { x: 0.5, y: 0.5 } }); }
  return { dir, imgDir, R: { photos }, e: { ust } };
}

test('ustHazirla: netlik kapisindan gecen kare menu fotografi olur, yumusak olan elenir ve nedeni raporlanir', async () => {
  const v = await veriKur({ yumusak: ['02'] });
  try {
    v.e.ust = { menuFoto: { 'Izgara Köfte': '01', 'Karışık Meze': '02' }, sekmeFoto: { Mezeler: '03' } };
    const { spec, uyari, rapor } = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: v.e, lang: 'tr', items: ITEMS });
    assert.deepEqual(spec.menu.tabs.map((t) => t.ad), ['Izgaralar', 'Mezeler', 'Tatlılar']);
    const anahtar = Object.keys(spec.menu.fotolar); assert.ok(anahtar.includes('f01') && anahtar.includes('f03') && !anahtar.includes('f02'), anahtar.join());
    assert.equal(spec.menu.yalin, false);
    const meze = spec.menu.tabs[1]; assert.equal(meze.k, 'f03'); assert.equal(meze.items[0].k, undefined, 'yumusak foto satira baglanmaz');
    assert.ok(rapor.elenen.some((x) => x.id === '02' && /yumuşak görüntü/.test(x.neden)), JSON.stringify(rapor.elenen));
    assert.ok(uyari.some((u) => /menü fotoğrafı 02 kullanılmadı/.test(u)));
    assert.ok(fs.existsSync(path.join(v.imgDir, 'mx-f01-900.webp')) && !fs.existsSync(path.join(v.imgDir, 'mx-f02-900.webp')));
    // asla buyutme: panel dosyalari kaynaktan genis degil
    for (const f of fs.readdirSync(v.imgDir).filter((x) => /^mx-f01-\d+\.webp$/.test(x))) assert.ok((await sharp(path.join(v.imgDir, f)).metadata()).width <= 2000);
    // fiyatsiz kalem menuye girmez
    const fiyatsiz = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: v.e, lang: 'tr', items: [...ITEMS, { n: 'Çorba', d: '', p: '', cat: 'Mezeler' }] });
    assert.ok(!fiyatsiz.spec.menu.tabs.flatMap((t) => t.items).some((x) => x.n === 'Çorba'));
  } finally { fs.rmSync(v.dir, { recursive: true, force: true }); }
});

test('ustHazirla: hicbir menu fotografi netlik kapisindan gecmezse menu yalniz metin, kaydirici ve fotograf yok (bos yuva ya da yumusak gorsel yok)', async () => {
  const v = await veriKur({ yumusak: ['01', '02', '03'] });
  try {
    v.e.ust = { menuFoto: { 'Izgara Köfte': '01', Humus: '02' }, sekmeFoto: { Tatlılar: '03' } };
    const { spec, uyari } = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: v.e, lang: 'tr', items: ITEMS });
    assert.equal(spec.menu.yalin, true); assert.deepEqual(spec.menu.fotolar, {}); assert.equal(spec.kaydir, null); assert.equal(spec.menu.varsayilan, null);
    assert.ok(uyari.some((u) => /yalnız metin/.test(u)));
    assert.equal(fs.readdirSync(v.imgDir).filter((x) => /^mx-/.test(x)).length, 0, 'yumusak fotograflarin hicbir dosyasi yazilmaz');
  } finally { fs.rmSync(v.dir, { recursive: true, force: true }); }
});

test('ustHazirla: 4+ fotografli fiyatli yemek varsa kaydirici, galeri en az 3 temiz kare; yumusak kare galeriye girmez', async () => {
  const v = await veriKur({ yumusak: ['07'] });
  try {
    v.e.ust = { menuFoto: { 'Izgara Köfte': '01', 'Kuzu Pirzola': '02', Humus: '03', 'Fırın Sütlaç': '04' }, galeri: { foto: ['05', '06', '07'], h2: 'Mekândan kareler' } };
    const { spec, uyari } = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: v.e, lang: 'tr', items: ITEMS });
    assert.equal(spec.kaydir.items.length, 4); assert.deepEqual(spec.kaydir.items.map((x) => x.p), ['₺420', '₺780', '₺180', '₺150']);
    assert.equal(spec.galeri, null, 'yalniz 2 temiz kare: galeri gosterilmez'); assert.ok(uyari.some((u) => /galeri: yalnız 2 temiz kare/.test(u)));
    v.e.ust.galeri.foto = ['05', '06', '03']; v.e.ust.menuFoto = {};
    const g = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: v.e, lang: 'tr', items: ITEMS });
    assert.equal(g.spec.galeri.items.length, 3); assert.ok(g.spec.galeri.items.every((x) => x.w >= 1280));
  } finally { fs.rmSync(v.dir, { recursive: true, force: true }); }
});

test('sahne: 1920 px ustu ve keskin buyuk dosya -> sahne; kucuk ya da yumusak -> ince ayirici (buyutme yok)', async () => {
  const v = await veriKur({ ekFoto: { '05': [1800, 1100] } });
  try {
    const dosyaAdlari = () => fs.readdirSync(path.join(v.dir, 'ust')).filter((x) => /^sahne-\d+\.webp$/.test(x));
    // kaynak 1800 px, cevrimdisi: dosya yazilmaz
    let r = await sahneDosyalari(v.R, { dir: v.dir, id: '05', getir: null }); assert.equal(r.ok, false); assert.match(r.neden, /1800 px/); assert.equal(dosyaAdlari().length, 0);
    let h = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: { ust: { sahne: { foto: '05', yemek: 'Izgara Köfte' } } }, lang: 'tr', items: ITEMS });
    assert.equal(h.spec.sahne, null); assert.ok(h.uyari.some((u) => /sahne: 1920 px altinda \(1800\)/.test(u)), h.uyari.join(' | '));
    // buyuk surum bulunur (3000 px, keskin)
    const buyuk = await foto(3000, 1875, 205);
    r = await sahneDosyalari({ photos: [{ ...v.R.photos[4], url: 'https://x.example/wp-content/uploads/a-1024x640.jpg' }] }, { dir: v.dir, id: '05', getir: async () => ({ buf: buyuk }) });
    assert.equal(r.ok, true); assert.equal(r.w, 3000); assert.deepEqual(dosyaAdlari().sort(), ['sahne-1024.webp', 'sahne-1600.webp', 'sahne-2400.webp']);
    h = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: { ust: { sahne: { foto: '05', yemek: 'Izgara Köfte', alt: 'Izgara köfte, yanında közlenmiş biber', fx: 0.4, fy: 0.55 } } }, lang: 'tr', items: ITEMS });
    assert.equal(h.spec.sahne.w, 2400); assert.deepEqual(h.spec.sahne.not, { b: 'Izgara Köfte', s: '₺420' }); assert.equal(h.spec.sahne.cx, 40); assert.match(h.spec.sahne.srcset, /sahne-1024\.webp 1024w, img\/sahne-1600\.webp 1600w, img\/sahne-2400\.webp 2400w/);
    assert.ok(fs.existsSync(path.join(v.imgDir, 'sahne-2400.webp')));
    // yemek menude yok ya da kahraman karesi tekrar: sahne yok
    h = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: { ust: { sahne: { foto: '05', yemek: 'Olmayan Yemek' } } }, lang: 'tr', items: ITEMS }); assert.equal(h.spec.sahne, null);
    h = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: { ust: { sahne: { foto: '05', yemek: 'Izgara Köfte' } } }, lang: 'tr', items: ITEMS, heroId: '05' }); assert.equal(h.spec.sahne, null);
    // yumusak buyuk dosya (odak disi): sahne yok, ince ayirici
    const yum = await foto(3000, 1875, 205, 12);
    await sahneDosyalari({ photos: [{ ...v.R.photos[4], url: 'https://x.example/wp-content/uploads/a-1024x640.jpg' }] }, { dir: v.dir, id: '05', getir: async () => ({ buf: yum }) });
    h = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: { ust: { sahne: { foto: '05', yemek: 'Izgara Köfte' } } }, lang: 'tr', items: ITEMS });
    assert.equal(h.spec.sahne, null); assert.ok(h.uyari.some((u) => /sahne fotoğrafı 05 kullanılmadı: yumuşak görüntü/.test(u)), h.uyari.join(' | ')); assert.equal(h.rapor.sahne.ok, false);
  } finally { fs.rmSync(v.dir, { recursive: true, force: true }); }
});

// ---- HTML donusumu ----
const SAYFA = [
  '<!doctype html><html lang="tr"><head><link rel="stylesheet" href="../../_hat1v5/v5.css">', '<link rel="stylesheet" href="theme.css"></head><body>',
  '<section class="hero" aria-labelledby="h1"><div class="hero-media"><img class="hero-img" src="img/hero-2400.webp" alt="" width="2400" height="1344"></div><div class="hero-shade"></div><h1 id="h1">Başlık</h1></section>',
  '<div class="marquee" aria-label="Köfte, Meze"><div class="marquee-in" aria-hidden="true"><span>Köfte</span><span>Meze</span><span>Köfte</span><span>Meze</span></div></div>',
  '<section class="split" id="menu" aria-labelledby="menu-h" data-par><div class="split-pic"></div><div class="split-panel"><span class="kicker rv">Menü</span><h2 class="h2 wr" id="menu-h"><span class="w" style="--i:0"><span>Menü</span></span></h2><p class="p rv">Açıklama</p><ul class="menu"><li class="dish"><h3>Izgara Köfte</h3><span class="pr">₺420</span></li></ul><p class="legend rv">Fiyatlar menüden alındı.</p><a class="btn btn-ghost rv" href="https://example.com/menu">Menüyü aç</a></div></section>',
  '<section class="story" id="hikaye"><h2>Hikâye</h2><p>Metin metin metin.</p></section><footer><h2>Ziyaret</h2></footer>',
  '<script src="../../_hat1v5/v5.js" defer></script></body></html>',
].join('\n');
const MENU = { tabs: [{ ad: 'Izgaralar', items: [{ n: 'Izgara Köfte', d: 'Közlenmiş biberle', p: '₺420', k: 'f01' }, { n: 'Kuzu Pirzola', d: '', p: '₺780' }] }, { ad: 'Mezeler', items: [{ n: 'Humus', d: '', p: '₺180' }] }], fotolar: { f01: { k: 'f01', src: 'img/mx-f01-1400.webp', srcset: 'img/mx-f01-900.webp 900w, img/mx-f01-1400.webp 1400w', mobil: 'img/mx-f01-900.webp', thumb: 'img/mx-f01-t.webp', w: 1400, h: 875, fx: '50%', fy: '50%', alt: 'Izgara Köfte', cap: 'Izgara Köfte', capB: 'Izgaralar' } }, varsayilan: { k: 'f01', src: 'img/mx-f01-1400.webp', srcset: 'img/mx-f01-900.webp 900w, img/mx-f01-1400.webp 1400w', w: 1400, h: 875, fx: '50%', fy: '50%' }, yalin: false, tek: false };

test('ustUygula: kayan yazi seridi HICBIR sayfada kalmaz; sahne yoksa ince ayirici', () => {
  const o = ustUygula(SAYFA, { lang: 'tr', menu: MENU, sahne: null, galeri: null, kaydir: null, iz: null });
  assert.ok(!/marquee/.test(o), 'marquee kaldi'); assert.match(o, /<div class="ayrac" aria-hidden="true"><\/div>/); assert.ok(!/<section class="sahne"/.test(o));
  assert.ok(o.indexOf('class="ayrac"') > o.indexOf('</section>') - 1 && o.indexOf('class="ayrac"') < o.indexOf('id="menu"'), 'ayirac kahraman ile menu arasinda');
});

test('ustUygula: sahne = isletmenin kendi fotografi, yemegin adi ve gercek fiyati; menu sekmeli ve her satir fiyatli', () => {
  const o = ustUygula(SAYFA, { lang: 'tr', menu: MENU, sahne: { src: 'img/sahne-1600.webp', srcset: 'img/sahne-1024.webp 1024w, img/sahne-1600.webp 1600w, img/sahne-2400.webp 2400w', w: 2400, h: 1800, fx: '40%', fy: '55%', cx: 40, cy: 55, alt: 'Izgara köfte', not: { b: 'Izgara Köfte', s: '₺420' } }, hero: { xl: { src: 'img/hero-2400.webp', w: 2400, h: 1344 } }, galeri: null, kaydir: null, iz: null });
  assert.ok(!/marquee/.test(o)); assert.ok(!/class="ayrac"/.test(o)); assert.match(o, /<p class="sahne-not"><b>Izgara Köfte<\/b><span>₺420<\/span><\/p>/);
  assert.match(o, /<section class="hero hero-xl"[^>]*--hero-w:2400px;--hero-h:1344px/); assert.match(o, /<div class="hero-grain"/);
  assert.equal((o.match(/role="tab"/g) || []).length, 2); assert.equal((o.match(/role="tabpanel"/g) || []).length, 2); assert.match(o, /<li class="mx-dish" data-k="f01">/);
  for (const li of o.match(/<li class="mx-dish"[\s\S]*?<\/li>/g)) assert.match(li, /<span class="pr">₺\d+<\/span>/);
  assert.match(o, /class="mx-legend rv">Fiyatlar menüden alındı\./); assert.match(o, /href="https:\/\/example\.com\/menu"/);
  assert.match(o, /<link rel="stylesheet" href="\.\.\/\.\.\/_hat1v5\/ust\.css">/); assert.match(o, /<script src="\.\.\/\.\.\/_hat1v5\/ust\.js" defer><\/script>/);
  assert.match(o, /<script type="application\/json" id="r-ust">\{\}<\/script>/, 'iz verisi yok: bos');
});

test('ustUygula: fiyatsiz menu satiri reddedilir; ikinci uygulama reddedilir; iz yalniz 4+ kesimle yazilir', () => {
  const bozuk = { ...MENU, tabs: [{ ad: 'A', items: [{ n: 'Çorba', d: '', p: '' }] }] };
  assert.throws(() => ustUygula(SAYFA, { lang: 'tr', menu: bozuk }), /fiyatsiz satir/);
  const o = ustUygula(SAYFA, { lang: 'tr', menu: MENU, iz: { src: 'img/iz-abc12345.webp', cell: 288, n: 4 } });
  assert.match(o, /id="r-ust">\{"iz":\{"src":"img\/iz-abc12345\.webp","cell":288,"n":4\}\}</);
  assert.ok(!/"iz"/.test(ustUygula(SAYFA, { lang: 'tr', menu: MENU, iz: { src: 'img/iz-x.webp', cell: 288, n: 3 } })), '3 kesimle iz verisi yazilmaz');
  assert.throws(() => ustUygula(o, { lang: 'tr', menu: MENU }), /zaten uygulanmis/);
});

test('ustUygula: galeri en az 3 kare ve kaydirici en az 4 yemekle; azi gosterilmez', () => {
  const kare = (i) => ({ src: `img/gal-0${i}-960.webp`, srcset: `img/gal-0${i}-960.webp 960w, img/gal-0${i}-1600.webp 1600w`, w: 1600, h: 1000, alt: `Kare ${i}`, fx: '50%', fy: '50%' });
  const kd = (n) => ({ kicker: 'Menü', h2: 'Menüden kareler', onceki: 'Önceki', sonraki: 'Sonraki', items: Array.from({ length: n }, (_, i) => ({ src: `img/mx-f0${i}-900.webp`, w: 900, h: 900, alt: `Yemek ${i}`, n: `Yemek ${i}`, p: '₺100', d: '' })) });
  const o3 = ustUygula(SAYFA, { lang: 'tr', menu: MENU, galeri: { kicker: 'Galeri', h2: 'Mekândan kareler', p: '', items: [kare(1), kare(2), kare(3)] }, kaydir: kd(4) });
  assert.equal((o3.match(/class="gal-item"/g) || []).length, 3); assert.equal((o3.match(/class="kd-card"/g) || []).length, 4); assert.ok(o3.indexOf('id="galeri"') > o3.indexOf('id="hikaye"'));
  const o2 = ustUygula(SAYFA, { lang: 'tr', menu: MENU, galeri: { kicker: 'G', h2: 'Kareler', p: '', items: [kare(1), kare(2)] }, kaydir: kd(3) });
  assert.ok(!/id="galeri"/.test(o2) && !/class="kd"/.test(o2));
});

// ---- kapi: dosya denetimi ----
async function sayfaKur({ html, dosyalar = {}, U = {} }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ust-kapi-')); fs.mkdirSync(path.join(dir, 'img'));
  for (const [ad, buf] of Object.entries(dosyalar)) fs.writeFileSync(path.join(dir, 'img', ad), await buf);
  return { dir, html, U };
}
const UST_VAR = { var: true, sahne: false, ayirac: true };
const SAYFA_UST = (ek = '') => `<link href="../../_hat1v5/ust.css"><script src="../../_hat1v5/ust.js"></script><div class="ayrac"></div>${ek}`;

test('ust kapisi: marquee, yumusak foto, dusuk cozunurluklu sahne, eksik sahne/ayirac ve ust katman yoklugu sorun olur', async () => {
  const webp = (b) => b.then((x) => sharp(x).webp({ quality: 90 }).toBuffer());
  const s = await sayfaKur({ html: SAYFA_UST('<img src="img/hero-2400.webp"><img src="img/mx-f01-1400.webp">'), U: { ust: UST_VAR, heroNetlik: { ok: true } }, dosyalar: { 'hero-2400.webp': webp(foto(2400, 1350, 1)), 'mx-f01-1400.webp': webp(foto(1400, 1100, 2)) } });
  try {
    const iyi = await ustDosyaDenetimi({ sayfaDir: s.dir, html: s.html, U: s.U }); assert.deepEqual(iyi.sorunlar, []); assert.ok(iyi.olcum.netlik.hero.p90 > 220);
    assert.ok((await ustDosyaDenetimi({ sayfaDir: s.dir, html: `${s.html}<div class="marquee"></div>`, U: s.U })).sorunlar.some((x) => /marquee/.test(x)));
    assert.ok((await ustDosyaDenetimi({ sayfaDir: s.dir, html: s.html, U: { ...s.U, ust: { var: false } } })).sorunlar.some((x) => /üst katman uygulanmamış/.test(x)));
    assert.ok((await ustDosyaDenetimi({ sayfaDir: s.dir, html: s.html.replace('<div class="ayrac"></div>', ''), U: s.U })).sorunlar.some((x) => /sahnesi ya da ince ayırıcı/.test(x)));
    assert.ok((await ustDosyaDenetimi({ sayfaDir: s.dir, html: s.html, U: { ...s.U, heroNetlik: { ok: false, neden: 'yumuşak görüntü (netlik p75 20, p90 90)' } } })).sorunlar.some((x) => /ana fotoğraf yumuşak/.test(x)));
  } finally { fs.rmSync(s.dir, { recursive: true, force: true }); }
  const y = await sayfaKur({ html: SAYFA_UST('<img src="img/sahne-1600.webp"><img src="img/gal-a-1600.webp"><img src="img/mx-f09-900.webp">').replace('<div class="ayrac"></div>', '<section class="sahne"></section>'), U: { ust: { var: true, sahne: true } }, dosyalar: { 'sahne-1600.webp': webp(foto(1600, 900, 3)), 'gal-a-1600.webp': webp(foto(1600, 1000, 4, 9)), 'mx-f09-900.webp': webp(foto(900, 900, 5, 9)) } });
  try {
    const r = await ustDosyaDenetimi({ sayfaDir: y.dir, html: y.html, U: y.U });
    assert.ok(r.sorunlar.some((x) => /düşük çözünürlük: sahne sahne-1600\.webp/.test(x)), r.sorunlar.join(' | '));
    assert.ok(r.sorunlar.some((x) => /yumuşak görüntü: galeri gal-a-1600\.webp/.test(x)), r.sorunlar.join(' | '));
    assert.ok(r.sorunlar.some((x) => /yumuşak görüntü: menü paneli mx-f09-900\.webp/.test(x)), r.sorunlar.join(' | '));
  } finally { fs.rmSync(y.dir, { recursive: true, force: true }); }
});

test('ust kapisi: iz varsa en az 4 temiz kesim ve kesim olculeri; iz yoksa yalniz uyari (python yok)', async () => {
  const kes = (ad, o = {}) => ({ ad, kenarKontrast: 80, doluluk: 0.97, kenarTemas: false, ...o });
  const iyiRapor = { durum: 'ok', gecen: ['a', 'b', 'c', 'd'].map((x) => kes(x)), elenen: [] };
  const html = `${SAYFA_UST('<img src="img/iz-0a1b2c3d.webp">')}`;
  const kur = (U) => sayfaKur({ html, U: { ust: { ...UST_VAR, ...U }, heroNetlik: { ok: true } }, dosyalar: { 'iz-0a1b2c3d.webp': sharp({ create: { width: 1152, height: 288, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).webp().toBuffer() } });
  let s = await kur({ iz: 4, izRapor: iyiRapor });
  try { assert.deepEqual((await ustDosyaDenetimi({ sayfaDir: s.dir, html: s.html, U: s.U })).sorunlar, []); } finally { fs.rmSync(s.dir, { recursive: true, force: true }); }
  s = await kur({ iz: 3, izRapor: { ...iyiRapor, gecen: iyiRapor.gecen.slice(0, 3) } });
  try { assert.ok((await ustDosyaDenetimi({ sayfaDir: s.dir, html: s.html, U: s.U })).sorunlar.some((x) => /imleç izinde 3 kesim \(en az 4\)/.test(x))); } finally { fs.rmSync(s.dir, { recursive: true, force: true }); }
  s = await kur({ iz: 4, izRapor: { ...iyiRapor, gecen: [kes('a'), kes('b'), kes('c', { kenarTemas: true }), kes('d', { kenarKontrast: 30 })] } });
  try { const r = await ustDosyaDenetimi({ sayfaDir: s.dir, html: s.html, U: s.U }); assert.ok(r.sorunlar.some((x) => /kesim c: kesim kare kenarına değiyor/.test(x))); assert.ok(r.sorunlar.some((x) => /kesim d: kenar kontrastı 30/.test(x))); } finally { fs.rmSync(s.dir, { recursive: true, force: true }); }
  s = await kur({ iz: 0, izRapor: { durum: 'python-yok', gecen: [], elenen: [{ ad: 'a', neden: 'python/opencv yok' }] } });
  try { const r = await ustDosyaDenetimi({ sayfaDir: s.dir, html: s.html, U: s.U }); assert.deepEqual(r.sorunlar, []); assert.ok(r.uyarilar.some((x) => /imleç izi yok \(python-yok/.test(x))); } finally { fs.rmSync(s.dir, { recursive: true, force: true }); }
});

// ---- icerik karari ----
test('icerik karari: ust blogu dogrulanir (kimlikler, menu adlari, kesim kutulari); menu kaleminin cat alani kayda gecer', () => {
  const ctx = { fotoIds: ['01', '02', '03'] }; const kal = [{ n: 'Humus', p: '₺180', cat: 'Mezeler' }, { n: 'Köfte', p: '₺400', cat: 'Izgaralar' }];
  assert.deepEqual(ustDenetle({ sahne: { foto: '02', yemek: 'Köfte' }, menuFoto: { Humus: '01' }, sekmeFoto: { Mezeler: '03' }, galeri: { foto: ['01', '02', '03'] }, iz: { kesimler: [{ ad: 'humus', foto: '01', kutu: [0.1, 0.1, 0.4, 0.5], elips: true }] } }, ctx, kal), []);
  const h = ustDenetle({ sahne: { foto: '09', yemek: 'Pizza' }, menuFoto: { Pizza: '01', Humus: '09' }, sekmeFoto: { Çorbalar: '01' }, galeri: { foto: ['07'] }, iz: { kesimler: [{ ad: 'X!', foto: '01', kutu: [0, 0, 1, 1] }, { ad: 'ok', foto: '08', kutu: [0.1, 0.1, 0.4, 0.5] }] } }, ctx, kal);
  for (const re of [/ust\.sahne\.foto/, /ust\.sahne\.yemek/, /menuFoto: "Pizza"/, /menuFoto: fotograf yok 09/, /sekmeFoto: bölüm yok|sekmeFoto: bolum yok/, /galeri\.foto yok: 07/, /kesimler\[0\]/, /kesimler\[1\]\.foto yok/]) assert.ok(h.some((x) => re.test(x)), `${re}: ${h.join(' | ')}`);
  const k = { sablon: 'v5', dil: 'tr', hero: { id: '01' }, menu: { kaynak: { tur: 'sayfa', url: 'https://x.example/' }, kalemler: kal }, eylem: { tur: 'telefon' }, icerik: {} };
  assert.deepEqual(kayitKur(k).v5.menu.items, [{ n: 'Humus', d: '', p: '₺180', cat: 'Mezeler' }, { n: 'Köfte', d: '', p: '₺400', cat: 'Izgaralar' }]);
  assert.deepEqual(kayitKur({ ...k, menu: { ...k.menu, kalemler: [{ n: 'Humus', p: '₺180' }] } }).v5.menu.items, [{ n: 'Humus', d: '', p: '₺180' }]);
});

test('1920-2159 px kaynak: sahne ve kahraman icin kaynagin kendi genisligi (buyutmeden) yazilir; sahne 1920 tabanini gecer', async () => {
  const { heroDosyalari } = await import('../lib/hero-sec.mjs');
  const v = await veriKur({ ekFoto: { '05': [2048, 1152] } });
  try {
    const sr = await sahneDosyalari(v.R, { dir: v.dir, id: '05', getir: null }); assert.equal(sr.ok, true); assert.equal(sr.w, 2048);
    const ad = fs.readdirSync(path.join(v.dir, 'ust')).filter((x) => /^sahne-\d+\.webp$/.test(x)).sort(); assert.deepEqual(ad, ['sahne-1024.webp', 'sahne-1600.webp', 'sahne-2048.webp']);
    const h = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: { ust: { sahne: { foto: '05', yemek: 'Izgara Köfte' } } }, lang: 'tr', items: ITEMS });
    assert.equal(h.spec.sahne.w, 2048, h.uyari.join(' | '));
    const hs = await heroDosyalari({ ...v.R, slug: 'x' }, { dir: v.dir, id: '05', getir: null });
    assert.deepEqual(Object.values(hs.secilen.files).map((f) => f.w).sort((a, b) => a - b), [960, 1600, 2048]); assert.equal(hs.duzen, 'tam');
  } finally { fs.rmSync(v.dir, { recursive: true, force: true }); }
});

// ---- telefon: dik ekran yatay fotografi buyutmeden dolduramaz (12 Kas, 390 x 844 @2x) ----
test('heroTelefon: masaustu kahramaninin odak etrafinda dik kesiti, kendi pikseliyle (kucultme ve buyutme yok)', async () => {
  const { heroTelefon, TELEFON } = await import('../lib/ust-v5.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-m-'));
  try {
    for (const [w, h, ew, eh] of [[2048, 1151, 935, 1151], [1920, 1080, 878, 1080], [3200, 1795, 1105, 1360]]) {
      const buf = await sharp(await foto(w, h, 7)).webp({ quality: 80 }).toBuffer();
      const m = await heroTelefon({ buf, focus: { x: 0.9, y: 0.4 }, imgDir: dir });
      assert.deepEqual([m.w, m.h], [ew, eh], `${w}x${h}`); assert.equal(m.src, `img/hero-m-${ew}.webp`);
      const md = await sharp(path.join(dir, `hero-m-${ew}.webp`)).metadata(); assert.deepEqual([md.width, md.height], [ew, eh]); assert.ok(md.width <= w && md.height <= h, 'kaynaktan buyuk olamaz');
      assert.ok(Math.abs(m.w / m.h - Math.min(TELEFON.kutuOran, w / h)) < 0.02 || m.h === TELEFON.kesitEnYuk, 'kutu orani 390:480');
    }
    // odak sola yasliyken kesit soldan baslar, saga yasliyken sagdan biter (kutu kaynak disina tasmaz)
    const soz = await sharp({ create: { width: 2048, height: 1151, channels: 3, background: '#000' } }).composite([{ input: await sharp({ create: { width: 200, height: 1151, channels: 3, background: '#fff' } }).png().toBuffer(), left: 0, top: 0 }]).png().toBuffer();
    const sol = await heroTelefon({ buf: soz, focus: { x: 0.0, y: 0.5 }, imgDir: dir });
    const px = await sharp(path.join(dir, path.basename(sol.src))).resize(10, 1).raw().toBuffer(); assert.ok(px[0] > 200, 'sol seritteki beyaz kesitte');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('ustUygula: telefon kahramani (picture + onyukleme), dik ekrani dolduramayan sahne telefonda ince ayirici, galeri hucresi foto oraniyla en cok 4:3', () => {
  const ON = '<link rel="preload" as="image" href="img/hero-2400.webp" imagesrcset="img/hero-2400.webp 2400w" imagesizes="max(100vw, 179vh)" fetchpriority="high">';
  const sayfa = SAYFA.replace('<link rel="stylesheet" href="theme.css">', `${ON}\n<link rel="stylesheet" href="theme.css">`);
  const sahne = (h) => ({ src: 'img/sahne-1600.webp', srcset: 'img/sahne-1600.webp 1600w, img/sahne-2048.webp 2048w', w: 2048, h, fx: '50%', fy: '50%', cx: 50, cy: 50, alt: 'Köfte', not: { b: 'Izgara Köfte', s: '₺420' } });
  const kare = (w, h, i) => ({ src: `img/gal-0${i}-960.webp`, srcset: `img/gal-0${i}-960.webp 960w, img/gal-0${i}-1600.webp 1600w`, w, h, alt: `Kare ${i}`, fx: '50%', fy: '50%' });
  const S = { lang: 'tr', menu: MENU, hero: { xl: { src: 'img/hero-2048.webp', w: 2048, h: 1151 }, m: { src: 'img/hero-m-935.webp', w: 935, h: 1151 } }, sahne: sahne(1151), galeri: { kicker: 'G', h2: 'Kareler', p: '', items: [kare(1600, 900, 1), kare(800, 1200, 2), kare(1600, 1000, 3)] }, kaydir: null, iz: null };
  const o = ustUygula(sayfa, S);
  assert.match(o, /<section class="hero hero-xl hero-m"[^>]*--hero-mh:1151px/);
  assert.match(o, /<picture class="hero-pic"><source media="\(max-width: 599px\)" srcset="img\/hero-m-935\.webp" type="image\/webp"><img class="hero-img" [^>]*><\/picture>/);
  assert.match(o, /<link rel="preload" as="image" href="img\/hero-m-935\.webp" media="\(max-width: 599px\)"/); assert.match(o, /<link rel="preload" as="image" media="\(min-width: 600px\)" href="img\/hero-2400\.webp"/);
  // sahne 1151 px yuksek: dik telefonu doldurmak icin 1600+ gerekir -> telefonda ince ayirici; sizes yukseklige gore
  assert.match(o, /<section class="sahne sahne-m0"/); assert.match(o, /<\/section>\s*<div class="ayrac-m" aria-hidden="true"><\/div>/); assert.match(o, /sizes="max\(100vw, 189vh\)"/);
  const o2 = ustUygula(sayfa, { ...S, sahne: sahne(1800) }); assert.ok(!/sahne-m0|ayrac-m/.test(o2), '1800 px yuksek kaynak telefonu da doldurur');
  // galeri: hucre orani en cok 4:3 (--am), sizes telefonda hucre yuksekligine, masaustunde 54vh x 1.12'ye gore
  assert.match(o, /--ar:1600 \/ 900;--am:1\.3333;/); assert.match(o, /--ar:800 \/ 1200;--am:0\.6667;/); assert.match(o, /--ar:1600 \/ 1000;--am:1\.3333;/);
  assert.match(o, /sizes="\(max-width: 899px\) 104vw, 108vh"/); assert.match(o, /sizes="\(max-width: 899px\) 78vw, 40vh"/);
  // telefon kahramani yoksa sayfa eskisi gibi (picture yok)
  const o3 = ustUygula(sayfa, { ...S, hero: { xl: S.hero.xl } }); assert.ok(!/<picture|class="hero hero-xl hero-m"/.test(o3));
});

test('menu paneli fotografi: en buyuk surum kaynagin 2048 px\'ine kadar, sizes kutu yuksekligine gore (cover yukseklikten kirpar)', async () => {
  const v = await veriKur({ ekFoto: { '03': [2048, 1152] }, ust: {} });
  try {
    const h = await ustHazirla({ dir: v.dir, imgDir: v.imgDir, R: v.R, e: { ust: { sekmeFoto: { Izgaralar: '03' } } }, lang: 'tr', items: ITEMS });
    const f = Object.values(h.spec.menu.fotolar).find((x) => /f03/.test(x.k)); assert.ok(f, h.uyari.join(' | '));
    assert.equal(f.w, 2048); assert.match(f.srcset, /900w, .*1400w, .*2048w/); assert.ok(fs.existsSync(path.join(v.imgDir, 'mx-f03-2048.webp')));
    const o = ustUygula(SAYFA, { lang: 'tr', menu: h.spec.menu });
    assert.match(o, /sizes="\(max-width: 899px\) 133vw, max\(50vw, 178vh\)"/);
  } finally { fs.rmSync(v.dir, { recursive: true, force: true }); }
});

test('sayfaBuyutme (kapi, hareket acik olcum): kendi pikselinden buyuk gosterilen foto yakalanir, kucuk gosterilen ve kucuk onizleme (mx-thumb) yakalanmaz', async (t) => {
  let browser; try { const { openBrowser } = await import('../lib/ziyaret.mjs'); browser = await openBrowser(); } catch { t.skip('headless tarayici yok'); return; }
  try {
    const { sayfaBuyutme } = await import('../lib/ust-kapi.mjs');
    const uri = async (w, h) => `data:image/png;base64,${(await sharp({ create: { width: w, height: h, channels: 3, background: '#a33' } }).png().toBuffer()).toString('base64')}`;
    const pg = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await pg.setContent(`<body style="margin:0"><img id=a src="${await uri(100, 100)}" style="width:300px;height:300px"><img id=b src="${await uri(400, 400)}" style="width:200px;height:200px"><img class="mx-thumb" src="${await uri(50, 50)}" style="width:300px;height:100px;object-fit:cover"><img src="${await uri(50, 50)}" style="width:100px;height:100px;object-fit:cover;transform:scale(1.5)"></body>`);
    await pg.waitForFunction(() => [...document.images].every((i) => i.complete));
    const s = await pg.evaluate(sayfaBuyutme, 1.08);
    assert.equal(s.length, 2, s.join(' | ')); assert.ok(s.every((x) => /x3\.00$/.test(x)), `300/100 = 3 ve (100/50) x 1.5 transform = 3: ${s.join(' | ')}`);
    await pg.close();
  } finally { await browser.close(); }
});
