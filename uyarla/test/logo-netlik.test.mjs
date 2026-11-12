// LOGO NETLIK KAPISI (12 Kas 2026, kalici kural): logo her yerde, ozellikle acilista, dogal boyutunun en az yarisinda gosterilir (2x); SVG gecer; bitmap buyutulmez.
// Ag yok.  Son test yerel bir sayfayi headless tarayicida olcer (tarayici yoksa atlanir).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sharp } from '../lib/gorsel.mjs';
import { asilBoyutAdaylari, asilUygun, netBoyut, netCss, logoSorunlari, bosTuval, logoNetlikTara, NET_ORAN } from '../lib/logo-netlik.mjs';
import { logoSec } from '../lib/logo-bul.mjs';
import { sunucu } from '../lib/sunucu.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
// sahte logo: seffaf zeminde uc renkli sekiller (tuvalin tamamini kaplar); bos > 0 ise cevresine seffaf bos tuval eklenir
const png = async (w, h, { bos = 0 } = {}) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="0" y="0" width="100" height="100" rx="18" fill="#1e5aa0"/><circle cx="32" cy="50" r="22" fill="#f2b705"/><rect x="58" y="22" width="30" height="56" fill="#ffffff"/><path d="M10 90 L50 60 L90 90 Z" fill="#c0392b"/></svg>`;
  const logo = await sharp(Buffer.from(svg)).png().toBuffer();
  if (!bos) return logo;
  return sharp({ create: { width: w + bos * 2, height: h + bos * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: logo, left: bos, top: bos }]).png().toBuffer();
};

test('asilBoyutAdaylari: kucuk kopyanin ayni dosyadaki buyuk asli (WordPress, Wix, Squarespace, Next.js, Cloudinary, Shopify); duz adres icin aday yok', () => {
  assert.deepEqual(asilBoyutAdaylari('https://ornek.ie/wp-content/uploads/2017/05/logo-colour-300x97.png'), ['https://ornek.ie/wp-content/uploads/2017/05/logo-colour.png']);
  assert.deepEqual(asilBoyutAdaylari('https://ornek.ie/wp-content/uploads/2024/03/kapak-scaled.jpg'), ['https://ornek.ie/wp-content/uploads/2024/03/kapak.jpg']);
  assert.deepEqual(asilBoyutAdaylari('https://static.wixstatic.com/media/5983c0_abf7180cf42c~mv2.png/v1/fill/w_186,h_148,al_c,q_85/g343.png'), ['https://static.wixstatic.com/media/5983c0_abf7180cf42c~mv2.png']);
  assert.deepEqual(asilBoyutAdaylari('https://images.squarespace-cdn.com/content/v1/61a7/b967/Logo.png?format=1500w'), ['https://images.squarespace-cdn.com/content/v1/61a7/b967/Logo.png']);
  assert.deepEqual(asilBoyutAdaylari('https://www.ornek.com.au/_next/image?url=%2Fimages%2Fmarka_gold.png&w=384&q=75'), ['https://www.ornek.com.au/images/marka_gold.png']);
  assert.deepEqual(asilBoyutAdaylari('https://res.cloudinary.com/x/image/upload/c_fit,w_200/v1712/marka.png'), ['https://res.cloudinary.com/x/image/upload/v1712/marka.png']);
  assert.deepEqual(asilBoyutAdaylari('https://ornek.com/cdn/shop/files/logo_200x.png?v=12'), ['https://ornek.com/cdn/shop/files/logo.png']);
  assert.deepEqual(asilBoyutAdaylari('https://ornek.ie/img/logo.png'), []);
  assert.deepEqual(asilBoyutAdaylari('bozuk adres'), []);
});

test('asilUygun: ayni en/boy orani (%3) ve en az %20 daha genis; baska oran ya da ayni boy reddedilir', () => {
  assert.equal(asilUygun({ w: 300, h: 97 }, { w: 1200, h: 388 }), true);
  assert.equal(asilUygun({ w: 300, h: 97 }, { w: 1200, h: 1200 }), false);
  assert.equal(asilUygun({ w: 300, h: 97 }, { w: 320, h: 103 }), false);
  assert.equal(asilUygun(null, { w: 10, h: 10 }), false);
});

test('netBoyut: baslik, alt bilgi (x1.12) ve acilis dogal boyutun yarisini gecmez; cok kucuk logoda acilis/baslik isletme adini yazar; SVG oldugu gibi', () => {
  // 180 px kare ikon: acilis 230 istenir, en cok 90 olur -> acilista ad yazilir; baslik 64 istenir, 80 px'e kadar (180/2.24) olur -> 64 kalir
  const a = netBoyut({ w: 180, h: 180 }, { baslik: 64, baslikMobil: 48, acilis: 230 });
  assert.equal(a.acilis, 90); assert.equal(a.acilisYazi, true); assert.equal(a.baslik, 64); assert.equal(a.baslikYazi, false);
  // genis yazi logo 1500x605: istenen boyutlar degismez
  const b = netBoyut({ w: 1500, h: 605 }, { baslik: 56, baslikMobil: 40, acilis: 380 });
  assert.deepEqual([b.baslik, b.baslikMobil, b.acilis, b.acilisYazi, b.baslikYazi], [56, 40, 380, false, false]);
  // 120x44 yazi logo: baslik en cok 19 px -> baslikta da ad yazilir
  const c = netBoyut({ w: 120, h: 44 }, { baslik: 40, baslikMobil: 32, acilis: 380 });
  assert.equal(c.baslik, 19); assert.equal(c.baslikYazi, true); assert.equal(c.acilisYazi, true);
  // 300x350 kare: acilis 150 (2x), baslik 64 korunur
  const d = netBoyut({ w: 300, h: 350 }, { baslik: 64, baslikMobil: 48, acilis: 230 });
  assert.equal(d.acilis, 150); assert.equal(d.acilisYazi, false); assert.equal(d.baslik, 64);
  // her sonucta: gosterilen <= dogal / 2 (alt bilgi dahil)
  for (const [w, h] of [[180, 180], [1500, 605], [368, 71], [500, 418], [700, 186]]) {
    const n = netBoyut({ w, h }, { baslik: 64, baslikMobil: 48, acilis: 380 });
    assert.ok(n.acilis <= w / NET_ORAN && (n.acilis * h) / w <= h / NET_ORAN, `${w}x${h} acilis`);
    assert.ok(n.baslik * 1.12 <= h / NET_ORAN + 0.01, `${w}x${h} alt bilgi`);
  }
  const s = netBoyut({ w: 211, h: 60, svg: true }, { baslik: 48, baslikMobil: 36, acilis: 380 });
  assert.deepEqual([s.baslik, s.acilis, s.acilisYazi, s.baslikYazi], [48, 380, false, false]);
});

test('netCss: her raster logo img dogal boyutunun yarisinda durur; SVG icin kural yok', () => {
  const css = netCss([{ file: 'img/logo.png', w: 180, h: 180 }, { file: 'img/logo.svg', w: 200, h: 60, svg: true }]);
  assert.match(css, /:root img\[src="img\/logo\.png"\]\{max-width:90px;max-height:90px\}/);
  assert.doesNotMatch(css, /logo\.svg/);
  assert.equal(netCss([{ file: 'img/logo.svg', w: 10, h: 10, svg: true }]), '');
});

test('logoSorunlari: ayni yer ve dosyada en kotu oran; 2x altindaki her yer bir neden; SVG sayilmaz', () => {
  const S = logoSorunlari([
    { yer: 'acilis', src: 'logo.png', nw: 180, nh: 180, cw: 150, ch: 150, oran: 1.2 },
    { yer: 'acilis', src: 'logo.png', nw: 180, nh: 180, cw: 230, ch: 230, oran: 0.78 },
    { yer: 'baslik', src: 'logo.png', nw: 180, nh: 180, cw: 64, ch: 64, oran: 2.81 },
    { yer: 'acilis', src: 'logo.svg', nw: 211, nh: 60, cw: 380, ch: 108, oran: 0.56, svg: true },
  ], { etiket: '1440' });
  assert.equal(S.length, 1);
  assert.match(S[0], /^1440: logo 2x altinda \(acilis\): logo\.png 180x180 -> 230x230 css \(0\.78x\)$/);
});

test('bosTuval: seffaf kenari genis logo uyari alir, icerige kirpilmis logo almaz', async () => {
  const genis = await bosTuval(await png(200, 120, { bos: 150 }));
  assert.equal(genis.bos, true); assert.ok(genis.icerik < 0.2);
  const dolu = await bosTuval(await png(200, 120));
  assert.equal(dolu.bos, false);
});

test('logoSec: site kucuk kopya gonderdiyse ayni orandaki buyuk asil alinir (bayt degismeden); oran tutmazsa kucuk kalir', async () => {
  const kucuk = await png(300, 97); const buyuk = await png(1200, 388); const kare = await png(800, 800);
  const dir = tmp('logo-netlik-asil-');
  const getir = async (u) => (u.endsWith('logo-renk-300x97.png') ? { buf: kucuk } : u.endsWith('logo-renk.png') ? { buf: buyuk } : null);
  const r = await logoSec({ adaylar: [{ url: 'https://ornek.ie/wp-content/uploads/2017/05/logo-renk-300x97.png', via: 'img-header-logo', puan: 9 }], getir, imgDir: dir });
  assert.equal(r.logo.w, 1200); assert.equal(r.logo.url, 'https://ornek.ie/wp-content/uploads/2017/05/logo-renk.png');
  assert.ok(r.rapor.some((x) => /buyuk asil \(300x97 -> 1200x388\)/.test(x.sonuc)));
  assert.equal(fs.readFileSync(path.join(dir, 'logo-orijinal.png')).equals(buyuk), true, 'asil baytlari aynen saklanir');
  const dir2 = tmp('logo-netlik-asil2-');
  const getir2 = async (u) => (u.endsWith('-300x97.png') ? { buf: kucuk } : { buf: kare });
  const r2 = await logoSec({ adaylar: [{ url: 'https://ornek.ie/wp-content/uploads/2017/05/logo-renk-300x97.png', via: 'img-header-logo', puan: 9 }], getir: getir2, imgDir: dir2 });
  assert.equal(r2.logo.w, 300);
  assert.ok(r2.rapor.some((x) => /asil uymadi/.test(x.sonuc)));
});

test('logoNetlikTara: acilista buyutulen kucuk logo gecmez, buyuk logo gecer (tarayicida, acilis animasyonu durdurularak)', async (t) => {
  let browser = null;
  try { const { openBrowser } = await import('../lib/ziyaret.mjs'); browser = await openBrowser(); } catch { t.skip('headless tarayici yok'); return; }
  const kok = tmp('logo-netlik-sayfa-');
  const sayfa = (logo, w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:16px sans-serif}.intro{position:fixed;inset:0;display:grid;place-items:center;background:#fff;animation:out .6s 1.2s both}.intro-in{animation:in .8s both}
.intro-in img{width:230px;height:auto}@keyframes in{from{opacity:0;transform:scale(.9)}}@keyframes out{to{opacity:0;visibility:hidden}}
.top{position:fixed;top:0;left:0;right:0;height:80px;background:#fff}.brand img{height:40px;width:auto}main{height:2400px}footer .brand img{height:44px}</style></head>
<body><div class="intro"><div class="intro-in"><img src="img/${logo}" alt="" width="${w}" height="${h}"></div></div>
<header class="top"><a class="brand" href="#"><img src="img/${logo}" alt="Marka" width="${w}" height="${h}"></a></header><main></main>
<footer><a class="brand" href="#"><img src="img/${logo}" alt="Marka" width="${w}" height="${h}"></a></footer></body></html>`;
  for (const [ad, w] of [['kucuk', 100], ['buyuk', 600]]) { fs.mkdirSync(path.join(kok, ad, 'img'), { recursive: true }); fs.writeFileSync(path.join(kok, ad, 'img', 'logo.png'), await png(w, w)); fs.writeFileSync(path.join(kok, ad, 'index.html'), sayfa('logo.png', w, w)); }
  const srv = await sunucu(kok);
  try {
    const k = await logoNetlikTara(browser, `${srv.url}/kucuk/index.html`, { genislikler: [['1440', 1440, 900, false]] });
    assert.ok(k.sorunlar.some((s) => /^1440: logo 2x altinda \(acilis\): logo\.png 100x100 -> 230x230 css/.test(s)), k.sorunlar.join(' | '));
    assert.ok(!k.sorunlar.some((s) => /\((baslik|alt bilgi)\)/.test(s)), 'baslik 100/40 = 2.5x ve alt bilgi 100/44 = 2.27x gecer');
    const b = await logoNetlikTara(browser, `${srv.url}/buyuk/index.html`, { genislikler: [['1440', 1440, 900, false]] });
    assert.deepEqual(b.sorunlar, []);
    assert.ok(b.olcum['1440'].some((x) => x.yer === 'acilis' && x.cw >= 200), 'acilis olculdu');
    assert.ok(b.olcum['1440'].some((x) => x.yer === 'alt bilgi'), 'alt bilgi olculdu');
  } finally { await browser.close().catch(() => {}); await srv.close(); }
});
