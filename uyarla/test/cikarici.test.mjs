// Cikarici guclendirme (12 Kas 2026): fotograf toplama, en buyuk surum, gercek piksel, stok/uretilmis/afis isaretleri, logo, siparis ve rezervasyon baglantisi, baglanti canlilik denemesi,
// hazirlik kapisi.  Ag yok (yalniz yerel http sunucusu); tarayici yok.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto'; import http from 'node:http';
import { sharp } from '../lib/gorsel.mjs';
import { srcsetAyir, srcsetEnBuyuk, htmlFotolari, enBuyukSurumler, kanonikAnahtar, fotoUrlMu, isaretler, kesinStok, kesinUretilmis, kesinAfis, topluUretilmis, altSayfaSec, adaylariOlc, fotoTopla, domAdaylari } from '../lib/foto-topla.mjs';
import { logoAdaylari, logoSec, svgDosyasi, kayitliAlan, guvenilirHost } from '../lib/logo-bul.mjs';
import { saglayiciOf, saglayiciBaglantilari, eylemAdaylari, siparisBul, baglantiDogrula, PLATFORMLAR } from '../lib/siparis.mjs';
import { Polite } from '../v2lib/polite.mjs';
import { onKapi, hazirlikKapisi } from '../restoran-hazirla.mjs';
import { menuKaynakVar, ozetle } from '../olcum-cikarici.mjs';
import { imgUrlleri } from '../cikar.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
// gercek fotograf gibi (renkli gurultu); tohum ayri tohum ayri goruntu
async function foto(w, h, tohum = 1, format = 'jpeg') {
  const buf = Buffer.alloc(w * h * 3); let x = tohum * 2654435761 >>> 0;
  for (let i = 0; i < buf.length; i++) { x = (x * 1664525 + 1013904223) >>> 0; buf[i] = 40 + ((x >>> 24) % 170); }
  const im = sharp(buf, { raw: { width: w, height: h, channels: 3 } });
  return format === 'png' ? im.png().toBuffer() : im.jpeg({ quality: 80 }).toBuffer();
}

test('srcset: virgullu Wix adresleri bozulmaz; en buyuk aday secilir', () => {
  const wix = 'https://static.wixstatic.com/media/a~mv2.jpg/v1/fill/w_980,h_654,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/a.jpg 980w, https://static.wixstatic.com/media/a~mv2.jpg/v1/fill/w_1920,h_1280,al_c,q_85/a.jpg 1920w, https://static.wixstatic.com/media/a~mv2.jpg/v1/fill/w_480,h_320/a.jpg 480w';
  const a = srcsetAyir(wix); assert.equal(a.length, 3); assert.equal(a[0].w, 980); assert.ok(a[0].u.includes('w_980,h_654,al_c'));
  assert.equal(srcsetEnBuyuk(wix).w, 1920);
  assert.equal(srcsetEnBuyuk('a.jpg 1x, b.jpg 2x').u, 'b.jpg');
  assert.equal(srcsetEnBuyuk('a-300.jpg 300w,a-900.jpg 900w').u, 'a-900.jpg'); // bosluksuz virgul
  assert.equal(srcsetEnBuyuk(''), null);
});

test('htmlFotolari: img srcset, picture, data-src, noscript, CSS arka plan, og, twitter, JSON-LD, preload, poster, data-* ayarlari, galeri baglantisi; betik icindeki metin sayilmaz', () => {
  const html = `<html><head>
    <meta property="og:image" content="/img/og.jpg"><meta name="twitter:image" content="https://cdn.x.com/tw.jpg">
    <link rel="preload" as="image" imagesrcset="/img/pre-800.jpg 800w, /img/pre-2400.jpg 2400w" href="/img/pre-800.jpg">
    <style>.hero{background-image:url(/img/css-hero.jpg)} .x{background:#fff url('/img/css2.webp') no-repeat}</style>
    <script type="application/ld+json">{"@type":"Restaurant","image":["https://x.ie/ld1.jpg",{"@type":"ImageObject","url":"https://x.ie/ld2.jpg"}],"logo":"https://x.ie/logo.png"}</script>
    <script>var a = "https://x.ie/in-script.jpg";</script>
    </head><body>
    <img src="/img/a-300.jpg" srcset="/img/a-300.jpg 300w, /img/a-1600.jpg 1600w">
    <picture><source srcset="/img/p-800.webp 800w, /img/p-2000.webp 2000w" type="image/webp"><img src="/img/p-800.jpg"></picture>
    <img data-src="/img/lazy1.jpg" src="data:image/gif;base64,R0lGOD"> <img data-lazy-src="/img/lazy2.jpg" class="lazy">
    <noscript><img src="/img/noscript.jpg"></noscript>
    <div style="background-image:url('/img/inline.jpg')"></div>
    <div data-settings='{"background_image":{"url":"https:\\/\\/x.ie\\/wp\\/elementor-bg.jpg"}}'></div>
    <a href="/big/gal1.jpg"><img src="/thumbs/gal1.jpg"></a>
    <video poster="/img/poster.jpg"></video><a href="/menu.pdf">m</a>
  </body></html>`;
  const u = htmlFotolari(html, 'https://x.ie/').map((c) => c.url);
  for (const beklenen of ['https://x.ie/img/og.jpg', 'https://cdn.x.com/tw.jpg', 'https://x.ie/img/pre-2400.jpg', 'https://x.ie/img/css-hero.jpg', 'https://x.ie/img/css2.webp', 'https://x.ie/ld1.jpg', 'https://x.ie/ld2.jpg', 'https://x.ie/img/a-1600.jpg', 'https://x.ie/img/p-2000.webp', 'https://x.ie/img/lazy1.jpg', 'https://x.ie/img/lazy2.jpg', 'https://x.ie/img/noscript.jpg', 'https://x.ie/img/inline.jpg', 'https://x.ie/wp/elementor-bg.jpg', 'https://x.ie/big/gal1.jpg', 'https://x.ie/img/poster.jpg']) assert.ok(u.includes(beklenen), `eksik: ${beklenen}`);
  assert.ok(!u.some((x) => /in-script|logo\.png|menu\.pdf|data:/.test(x)), 'betik ici / logo / pdf sayilmaz');
  const k = Object.fromEntries(htmlFotolari(html, 'https://x.ie/').map((c) => [c.url, c.kaynak]));
  assert.equal(k['https://x.ie/img/og.jpg'], 'og'); assert.equal(k['https://x.ie/img/css-hero.jpg'], 'css'); assert.equal(k['https://x.ie/img/inline.jpg'], 'css-satir-ici'); assert.equal(k['https://x.ie/ld1.jpg'], 'json-ld');
});

test('enBuyukSurumler: Wix, Squarespace, WordPress, Shopify, Webflow, GoDaddy, Drupal, Cloudflare; orijinal adres hep son', () => {
  const wix = 'https://static.wixstatic.com/media/11062b_abc~mv2.jpg/v1/fill/w_600,h_400,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/11062b_abc~mv2.jpg';
  assert.equal(enBuyukSurumler(wix)[0], 'https://static.wixstatic.com/media/11062b_abc~mv2.jpg');
  assert.ok(enBuyukSurumler(wix).some((u) => /\/v1\/fit\/w_2560/.test(u)), 'cok buyuk orijinal icin fit yedegi');
  assert.equal(enBuyukSurumler('https://static.wixstatic.com/media/x~mv2.png/v1/crop/x_0,y_0,w_100,h_100/fill/w_90,h_90/x.png')[0], 'https://static.wixstatic.com/media/x~mv2.png');
  assert.equal(enBuyukSurumler('https://images.squarespace-cdn.com/content/v1/5/abc/IMG_1.jpg?format=500w')[0], 'https://images.squarespace-cdn.com/content/v1/5/abc/IMG_1.jpg?format=2500w');
  assert.equal(enBuyukSurumler('https://images.squarespace-cdn.com/content/v1/5/abc/IMG_1.jpg', { orijinal: true })[0], 'https://images.squarespace-cdn.com/content/v1/5/abc/IMG_1.jpg?format=original');
  const wp = enBuyukSurumler('https://x.ie/wp-content/uploads/2023/05/pizza-1024x683.jpg?resize=300%2C200');
  assert.equal(wp[0], 'https://x.ie/wp-content/uploads/2023/05/pizza.jpg'); assert.equal(wp[wp.length - 1], 'https://x.ie/wp-content/uploads/2023/05/pizza-1024x683.jpg?resize=300%2C200');
  assert.equal(enBuyukSurumler('https://x.ie/wp-content/uploads/a-scaled.jpg')[0], 'https://x.ie/wp-content/uploads/a.jpg');
  assert.equal(enBuyukSurumler('https://cdn.shopify.com/s/files/1/0001/files/burger_2048x.jpg?v=123&width=800')[0], 'https://cdn.shopify.com/s/files/1/0001/files/burger.jpg?v=123');
  assert.equal(enBuyukSurumler('https://cdn.shopify.com/s/files/1/0001/files/burger_600x600_crop_center.jpg?v=9')[0], 'https://cdn.shopify.com/s/files/1/0001/files/burger.jpg?v=9');
  assert.equal(enBuyukSurumler('https://cdn.prod.website-files.com/5f/6a_hero-p-800.jpg')[0], 'https://cdn.prod.website-files.com/5f/6a_hero.jpg');
  assert.equal(enBuyukSurumler('https://uploads-ssl.webflow.com/5f/6a_hero-p-500.jpeg')[0], 'https://uploads-ssl.webflow.com/5f/6a_hero.jpeg');
  assert.equal(enBuyukSurumler('https://img1.wsimg.com/isteam/ip/abc-123/photo.jpg/:/rs=w:600,h:400,cg:true,m/cr=w:600,h:400')[0], 'https://img1.wsimg.com/isteam/ip/abc-123/photo.jpg');
  assert.equal(enBuyukSurumler('https://x.ie/sites/default/files/styles/medium/public/pics/a.jpg')[0], 'https://x.ie/sites/default/files/pics/a.jpg');
  assert.equal(enBuyukSurumler('https://x.ie/cdn-cgi/image/width=400,quality=80/uploads/a.jpg')[0], 'https://x.ie/uploads/a.jpg');
  for (const u of [wix, 'https://x.ie/a-300x200.jpg', 'https://x.ie/plain.jpg', 'not a url']) assert.equal(enBuyukSurumler(u).at(-1), u);
  assert.ok(enBuyukSurumler('https://x.ie/a-300x200.jpg').length <= 4);
  // ayni goruntunun varyantlari ayni anahtar
  const a = kanonikAnahtar('https://x.ie/wp-content/uploads/pizza-300x200.jpg'); const b = kanonikAnahtar('https://x.ie/wp-content/uploads/pizza-scaled.jpg'); const c = kanonikAnahtar('https://x.ie/wp-content/uploads/pizza.jpg');
  assert.equal(a, c); assert.equal(b, c);
  assert.equal(kanonikAnahtar(wix), kanonikAnahtar('https://static.wixstatic.com/media/11062b_abc~mv2.jpg'));
});

test('fotoUrlMu: sozcuk sinirli; close-up ve sealed elenmez, logo/ikon/sosyal elenir', () => {
  for (const ok of ['https://x.ie/img/close-up-burger.jpg', 'https://x.ie/img/sealed-jar-of-honey.jpg', 'https://x.ie/uploads/2023/05/pizza.jpg', 'https://x.ie/images/IMG_2231.jpeg', 'https://x.ie/flagstaff-view.jpg']) assert.equal(fotoUrlMu(ok), true, ok);
  for (const bad of ['https://x.ie/images/logo.png', 'https://x.ie/images/icons/phone.png', 'https://x.ie/img/facebook.png', 'https://x.ie/a.svg', 'https://x.ie/a.gif', 'https://x.ie/img/award-2023.jpg', 'https://maps.googleapis.com/maps/api/staticmap?x=1', 'https://x.ie/img/tripadvisor-badge.png']) assert.equal(fotoUrlMu(bad), false, bad);
});

test('isaretler: stok (adres, metadata), uretilmis (metadata, dosya adi, olcu), yazili afis (kesin yalniz ad + PNG/dik/goruntu)', () => {
  assert.ok(kesinStok(isaretler({ url: 'https://images.unsplash.com/photo-1514326640560-7d063ef2aed5?w=1600' })));
  assert.ok(kesinStok(isaretler({ url: 'https://static.wixstatic.com/media/nsplsh_4a6d6e~mv2.jpg' })));
  assert.ok(kesinStok(isaretler({ url: 'https://img1.wsimg.com/isteam/stock/5kzyBwq/:/rs=w:1200' })));
  assert.ok(!kesinStok(isaretler({ url: 'https://x.ie/uploads/pizza.jpg', alt: 'wood fired pizza' })));
  const iptc = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), Buffer.from('....Photoshop 3.0 8BIM Credit Shutterstock ....'), Buffer.alloc(50)]);
  assert.ok(kesinStok(isaretler({ url: 'https://x.ie/a.jpg', buf: iptc })));
  const c2pa = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('<x:xmpmeta> http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia </x:xmpmeta>')]);
  const u1 = isaretler({ url: 'https://x.ie/a.jpg', buf: c2pa }); assert.ok(kesinUretilmis(u1), JSON.stringify(u1));
  assert.ok(kesinUretilmis(isaretler({ url: 'https://x.ie/uploads/DALL-E-pizza-oven.png' })));
  const olcu = isaretler({ url: 'https://x.ie/a.jpg', w: 1376, h: 768 }); assert.equal(olcu.uretilmis.length, 1); assert.equal(kesinUretilmis(olcu), false, 'olcu tek basina kesin degil');
  assert.equal(isaretler({ url: 'https://x.ie/a.jpg', w: 1920, h: 1080 }).uretilmis.length, 0);
  // afis
  assert.ok(kesinAfis(isaretler({ url: 'https://x.ie/menu1.png', w: 778, h: 849 })), 'menu PNG');
  assert.ok(kesinAfis(isaretler({ url: 'https://x.ie/christmas-flyer.jpg', w: 800, h: 1100 })), 'dik afis');
  assert.ok(!kesinAfis(isaretler({ url: 'https://x.ie/our-menu-10.jpg', w: 960, h: 540 })), 'yatay yemek fotografi: yalniz isaret');
  assert.equal(isaretler({ url: 'https://x.ie/our-menu-10.jpg', w: 960, h: 540 }).afis.length, 1);
  assert.ok(kesinAfis(isaretler({ url: 'https://x.ie/a.jpg', w: 1200, h: 800, a: { meanS: 0.1, lapVar: 2500, flat: 0.4 } })), 'yazi izlenimi');
  // toplu uretilmis
  const ph = (w, h) => ({ w, h }); assert.deepEqual(topluUretilmis([ph(1376, 768), ph(1376, 768), ph(1376, 768), ph(1376, 768), ph(2000, 1300)]), { olcu: '1376x768', adet: 4, toplam: 5 });
  assert.equal(topluUretilmis([ph(1376, 768), ph(1376, 768), ph(2000, 1300), ph(1800, 1200), ph(1900, 1200)]), null);
  assert.equal(topluUretilmis([ph(1024, 1024), ph(1024, 1024)]), null, 'en az 3 kare');
});

test('altSayfaSec: galeri > hakkinda > menu; baska alan adi, pdf, blog, gizlilik, ana sayfa elenir; www ayni sayilir; en cok 6', () => {
  const l = (href, text = '') => ({ href, text });
  const links = [l('/menu', 'Menu'), l('/gallery', 'Gallery'), l('/about-us', 'About'), l('https://www.x.ie/contact', 'Contact'), l('https://facebook.com/x', 'Facebook'), l('/menu.pdf', 'PDF menu'), l('/blog/our-gallery-opening', 'post'), l('/privacy', 'Privacy'), l('/', 'Home'), l('https://other.ie/gallery', 'x'), l('/photos', 'Photos'), l('/our-story', 'Story'), l('/food', 'Food'), l('/drinks', 'Drinks'), l('/events', 'Events'), l('/gift-vouchers', 'Gift')];
  const s = altSayfaSec(links, 'https://x.ie/', { en: 6 });
  assert.equal(s.length, 6); assert.ok(['https://x.ie/gallery', 'https://x.ie/photos'].includes(s[0].url));
  const urls = s.map((x) => x.url);
  assert.ok(!urls.some((u) => /other\.ie|facebook|\.pdf|blog|privacy|gift|^https:\/\/x\.ie\/$/.test(u)));
  assert.ok(urls.indexOf('https://x.ie/about-us') < urls.indexOf('https://x.ie/menu'));
  assert.equal(altSayfaSec(links, 'https://x.ie/', { yapildi: new Set(['https://x.ie/gallery']), en: 2 })[0].url, 'https://x.ie/photos');
  assert.deepEqual(altSayfaSec([], 'https://x.ie/'), []);
});

test('adaylariOlc: en buyuk surum indirilir, gercek piksel olculur, ayni goruntu bir kez, kucuk ve rozet elenir, isaret yazilir', async () => {
  const kucuk = await foto(500, 330, 1); const buyuk = await foto(2400, 1600, 2); const orta = await foto(1200, 800, 3); const yedek = await foto(1500, 1000, 4);
  const istekler = [];
  const veri = {
    'https://x.ie/wp-content/uploads/pizza.jpg': buyuk, 'https://x.ie/wp-content/uploads/pizza-300x200.jpg': kucuk,
    'https://x.ie/img/hall.jpg': orta, 'https://x.ie/img/tiny.jpg': kucuk, 'https://images.unsplash.com/photo-9?w=1600': yedek,
  };
  const getir = async (u) => { istekler.push(u); return veri[u] ? { buf: veri[u] } : null; };
  const adaylar = [
    { url: 'https://x.ie/wp-content/uploads/pizza-300x200.jpg', kaynak: 'img', pre: 30 },
    { url: 'https://x.ie/wp-content/uploads/pizza-1024x683.jpg', kaynak: 'img', pre: 29 }, // ayni goruntu
    { url: 'https://x.ie/img/hall.jpg', kaynak: 'og', pre: 20 },
    { url: 'https://x.ie/img/tiny.jpg', kaynak: 'img', pre: 10 },
    { url: 'https://x.ie/img/award-2023.jpg', kaynak: 'img', alt: 'Award winner 2023', pre: 9 },
    { url: 'https://images.unsplash.com/photo-9?w=1600', kaynak: 'img', pre: 8 },
  ];
  const onceden = new Map([['https://x.ie/wp-content/uploads/pizza-300x200.jpg', { buf: kucuk }]]);
  const r = await adaylariOlc({ adaylar, getir, onceden });
  const w = r.tutulan.map((t) => t.w).sort((a, b) => b - a);
  assert.deepEqual(w, [2400, 1500, 1200], 'pizza buyuk surumle, hall, unsplash');
  const pizza = r.tutulan.find((t) => t.w === 2400); assert.equal(pizza.buyukSurum, true); assert.equal(pizza.url, 'https://x.ie/wp-content/uploads/pizza.jpg');
  assert.ok(r.tutulan.find((t) => t.w === 1500).isaret.stok.length === 1, 'unsplash stok');
  assert.ok(r.elenen.some((e) => e.neden === 'kucuk'), 'tiny.jpg'); assert.ok(r.elenen.some((e) => e.neden === 'odul/rozet'));
  assert.ok(!istekler.includes('https://x.ie/wp-content/uploads/pizza-300x200.jpg'), 'tarayicinin kopyasi varken kucuk surum yeniden indirilmez');
  // tarayici zaten 2400 px kopyasini indirdiyse ag acilmaz
  const istek2 = []; const r2 = await adaylariOlc({ adaylar: [{ url: 'https://x.ie/big.jpg', kaynak: 'img', pre: 1 }], getir: async (u) => { istek2.push(u); return null; }, onceden: new Map([['https://x.ie/big.jpg', { buf: buyuk }]]) });
  assert.equal(r2.tutulan.length, 1); assert.equal(istek2.length, 0);
  // butce
  const r3 = await adaylariOlc({ adaylar, getir, onceden: new Map(), butce: 1 }); assert.ok(r3.indirilen <= 1);
});

test('fotoTopla: ana sayfada az foto varsa galeri alt sayfasindan tamamlar; en buyuk surum; isaretler ve rapor yazilir', async () => {
  const dir = tmp('cikarici-foto-'); const img = {};
  for (let i = 1; i <= 8; i++) img[`https://x.ie/gal/g${i}.jpg`] = await foto(1600 + i * 40, 1000, 10 + i);
  img['https://x.ie/img/hero.jpg'] = await foto(2000, 1200, 99);
  const getir = async (u) => (img[u] ? { buf: img[u] } : null);
  const galeriHtml = Object.keys(img).filter((u) => u.includes('/gal/')).map((u) => `<a href="${u}"><img src="${u.replace('/gal/', '/gal/t-')}"></a>`).join('');
  const home = { html: '<html><head><meta property="og:image" content="/img/hero.jpg"></head><body><a href="/gallery">Gallery</a></body></html>', imgs: [], links: [{ href: '/gallery', text: 'Gallery' }, { href: '/about', text: 'About' }], imgBodies: new Map() };
  const alinan = [];
  const sayfaAl = async (url) => { alinan.push(url); return url.endsWith('/gallery') ? { html: `<html><body>${galeriHtml}</body></html>`, finalUrl: url } : { html: '<html><body>about</body></html>', finalUrl: url }; };
  const r = await fotoTopla({ home, base: 'https://x.ie/', sayfaAl, getir, dir });
  assert.ok(r.photos.length >= 8, `foto ${r.photos.length}`); assert.ok(alinan[0].endsWith('/gallery'), 'once galeri');
  assert.ok(r.photos.every((p) => fs.existsSync(path.join(dir, p.file)) && p.gercekPiksel === `${p.w}x${p.h}`));
  assert.ok(r.photos.some((p) => p.sayfa && p.sayfa.endsWith('/gallery')) && r.photos.some((p) => p.kaynak === 'og'));
  assert.ok(r.rapor.altSayfaSayisi >= 1 && r.rapor.kaynaklar['a-href'] >= 8);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('domAdaylari: altbilgi ve kucuk ust bilgi gorselleri elenir; srcset en buyugu ve lightbox buyuk dosya aday olur', () => {
  const im = (o) => ({ url: 'https://x.ie/a.jpg', big: '', ss: '', nw: 800, nh: 600, alt: '', cls: '', via: 'img', vis: true, inHeader: false, inFooter: false, rw: 600, rh: 400, top: 300, ...o });
  const c = domAdaylari([im({ url: 'https://x.ie/footer.jpg', inFooter: true }), im({ url: 'https://x.ie/nav.jpg', inHeader: true, rw: 120 }), im({ url: 'https://x.ie/s-300.jpg', ss: 'https://x.ie/s-1600.jpg' }), im({ url: 'https://x.ie/t.jpg', big: 'https://x.ie/big.jpg' }), im({ url: 'https://x.ie/logo.png' }), im({ url: 'https://x.ie/small.jpg', nw: 100, nh: 100 })]);
  assert.deepEqual(c.map((x) => x.url).sort(), ['https://x.ie/big.jpg', 'https://x.ie/s-1600.jpg']);
});

test('imgUrlleri (eski ek yol) degismedi', () => {
  assert.deepEqual(imgUrlleri('', 'https://x.ie/'), []);
  assert.ok(imgUrlleri('<img src="/a.jpg">', 'https://x.ie/').includes('https://x.ie/a.jpg'));
});

// ---- logo ----
test('logoAdaylari: JSON-LD, og:logo, header img, ana sayfa baglantisi, satir ici SVG, favicon; sosyal/platform/odul logolari elenir; SVG one gecer', () => {
  const html = `<html><head><meta property="og:logo" content="/brand/og-logo.png">
    <script type="application/ld+json">{"@type":"Restaurant","logo":{"@type":"ImageObject","url":"https://x.ie/ld-logo.svg"}}</script>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="icon" href="/fav-32.png" sizes="32x32">
    </head><body><header><a href="/"><img src="/img/brand-mark.png" alt="Pizzeria Roma"></a></header>
    <img src="/img/tripadvisor-logo.png" alt="Tripadvisor logo"><img src="/img/wix-logo.png" alt="Made with Wix logo"></body></html>`;
  const imgs = [
    { url: 'https://x.ie/img/brand-mark.png', via: 'img', vis: true, inHeader: true, inFooter: false, rw: 180, rh: 60, top: 20, alt: 'Pizzeria Roma', cls: '', homeLink: true },
    { url: 'https://x.ie/img/site-logo-dark.svg', via: 'img', vis: true, inHeader: false, inFooter: false, rw: 100, rh: 40, top: 800, alt: 'logo', cls: 'site-logo' },
    { url: 'https://x.ie/img/tripadvisor-logo.png', via: 'img', vis: true, inHeader: false, inFooter: true, rw: 100, rh: 40, top: 3000, alt: 'Tripadvisor logo', cls: '' },
    { url: 'https://x.ie/img/hero.jpg', via: 'img', vis: true, inHeader: false, inFooter: false, rw: 1400, rh: 800, top: 100, alt: 'pizza', cls: '' },
    { url: 'https://x.ie/css/bg-logo.png', via: 'bg', vis: true, inHeader: true, inFooter: false, rw: 140, rh: 50, top: 10, alt: '', cls: 'navbar-logo' },
  ];
  const svg = '<svg viewBox="0 0 120 40" width="120" height="40"><style>.a{fill:#c33}</style><path class="a" d="M0 0h120v40H0z"/></svg>'.padEnd(260, ' ');
  const bagimli = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 3h18v18H3z"/></svg>'.padEnd(260, ' ');
  const svgler = [{ svg, rw: 120, rh: 40, top: 20, inHeader: true, cls: 'brand-mark', label: 'Pizzeria Roma' }, { svg: bagimli, rw: 48, rh: 48, top: 20, inHeader: true, cls: 'menu-toggle icon', label: 'menu' }];
  const a = logoAdaylari({ html, base: 'https://x.ie/', imgs, svgler });
  const urls = a.map((x) => x.url || 'SVG');
  assert.ok(urls.includes('https://x.ie/ld-logo.svg') && urls.includes('https://x.ie/brand/og-logo.png') && urls.includes('https://x.ie/img/brand-mark.png') && urls.includes('SVG') && urls.includes('https://x.ie/css/bg-logo.png') && urls.includes('https://x.ie/img/site-logo-dark.svg'));
  assert.ok(urls.includes('https://x.ie/favicon.svg') && urls.includes('https://x.ie/apple-touch-icon.png'));
  assert.ok(!urls.some((u) => /tripadvisor|wix-logo|fav-32|hero/.test(u)), urls.join(' | '));
  assert.equal(a.filter((x) => x.svg).length, 1, 'yalniz kendi basina cizilebilen satir ici SVG');
  assert.equal(a[0].via, 'ld');
});

test('logo: ucuncu tarafin dosyasi (odeme ortagi) logo degildir; kendi alan adi ve site kurucu CDN kabul; .com.au / .co.nz kayitli alan', () => {
  assert.equal(kayitliAlan('www.sofiaburwood.com.au'), 'sofiaburwood.com.au'); assert.equal(kayitliAlan('assets.zwift.com.au'), 'zwift.com.au'); assert.equal(kayitliAlan('cdn.x.ie'), 'x.ie'); assert.equal(kayitliAlan('a.b.thaichef.co.nz'), 'thaichef.co.nz');
  assert.equal(guvenilirHost('https://assets.zwift.com.au/RetailerLogos/1/logo.svg', 'https://sofiaburwood.com.au/'), false);
  assert.equal(guvenilirHost('https://static.wixstatic.com/media/a.png', 'https://sofiaburwood.com.au/'), true);
  assert.equal(guvenilirHost('https://www.sofiaburwood.com.au/img/l.png', 'https://sofiaburwood.com.au/'), true);
  const a = logoAdaylari({ html: '<script type="application/ld+json">{"@type":"Restaurant","logo":"https://assets.zwift.com.au/RetailerLogos/5827/120x75rgb.png"}</script>', base: 'https://noipizzeria.com.au/', imgs: [{ url: 'https://noipizzeria.com.au/img/noi-logo.png', via: 'img', vis: true, inHeader: true, rw: 120, rh: 60, top: 10, alt: 'Noi', cls: 'logo' }] });
  assert.deepEqual(a.map((x) => x.url), ['https://noipizzeria.com.au/img/noi-logo.png']);
});

test('saglayiciBaglantilari: hediye karti (giftcards.nowbookit.com) rezervasyon sayilmaz', () => {
  const r = saglayiciBaglantilari('<a href="https://giftcards.nowbookit.com/cards/card-selection?accountid=1">Gift</a><a href="https://bookings.nowbookit.com/?accountid=2">Book</a>', 'https://x.ie/');
  assert.deepEqual(r.map((x) => x.url), ['https://bookings.nowbookit.com/?accountid=2']);
});

test('svgDosyasi ve logoSec: baytlar DEGISMEZ (sha256), SVG tercih, satir ici SVG yalniz xmlns eklenir, buyuk raster ham baytiyla ayrica saklanir', async () => {
  const s1 = svgDosyasi('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#c33"/></svg>');
  assert.equal(s1.not, null); assert.equal(s1.buf.toString(), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#c33"/></svg>');
  const s2 = svgDosyasi('<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#c33"/></svg>'); assert.match(s2.buf.toString(), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox/); assert.match(s2.not, /xmlns/);
  // raster logo (seffaf PNG) + SVG dosya: SVG kazanir; bayt aynen
  const png = await sharp({ create: { width: 420, height: 140, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: await sharp({ create: { width: 300, height: 60, channels: 4, background: '#c33333' } }).png().toBuffer(), left: 60, top: 40 }]).png().toBuffer();
  const svgBuf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100" width="300" height="100"><rect x="10" y="30" width="280" height="40" fill="#336699"/></svg>');
  const dir = tmp('cikarici-logo-');
  const getir = async (u) => ({ buf: u.endsWith('.svg') ? svgBuf : png });
  const r = await logoSec({ adaylar: [{ url: 'https://x.ie/logo.png', via: 'img-header-logo', puan: 9 }, { url: 'https://x.ie/logo.svg', via: 'img-logo-adli', puan: 7 }], getir, imgDir: dir });
  assert.equal(r.logo.orig.svg, true); assert.equal(sha(fs.readFileSync(path.join(dir, path.basename(r.logo.orig.file)))), sha(svgBuf)); assert.equal(r.logo.orig.sha256, sha(svgBuf));
  // yalniz PNG: bayt aynen
  const dir2 = tmp('cikarici-logo2-'); const r2 = await logoSec({ adaylar: [{ url: 'https://x.ie/logo.png', via: 'img-header-logo', puan: 9 }], getir, imgDir: dir2 });
  assert.equal(r2.logo.orig.sha256, sha(png)); assert.equal(r2.logo.orig.bytes, png.length); assert.ok(!r2.logo.orig.ham);
  // satir ici SVG
  const dir3 = tmp('cikarici-logo3-'); const r3 = await logoSec({ adaylar: [{ svg: '<svg viewBox="0 0 300 100" width="300" height="100"><rect x="10" y="30" width="280" height="40" fill="#336699"/></svg>', via: 'svg-satir-ici', puan: 6 }], getir, imgDir: dir3 });
  assert.equal(r3.logo.via, 'svg-satir-ici'); assert.match(r3.logo.not, /xmlns/);
  // olmayan / kucuk / duz adaylar elenir, rapor yazilir
  const dir4 = tmp('cikarici-logo4-'); const bos = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).png().toBuffer();
  const r4 = await logoSec({ adaylar: [{ url: 'https://x.ie/yok.png', via: 'ld', puan: 10 }, { url: 'https://x.ie/kucuk.png', via: 'img-header', puan: 5 }], getir: async (u) => (u.includes('kucuk') ? { buf: bos } : null), imgDir: dir4 });
  assert.equal(r4.logo, null); assert.deepEqual(r4.rapor.map((x) => x.sonuc.split(' ')[0]), ['indirilemedi', 'kucuk']);
  for (const d of [dir, dir2, dir3, dir4]) fs.rmSync(d, { recursive: true, force: true });
});

// ---- siparis / rezervasyon ----
test('saglayiciOf: istenen butun siparis ve rezervasyon saglayicilari taninir', () => {
  const siparis = { 'Order YoYo': 'https://orderyoyo.com/restaurant/x', Mobi2Go: 'https://x.mobi2go.com/order', Wowapps: 'https://x.wowapps.com/menu', deliveroo: 'https://deliveroo.ie/menu/dublin/x/y', 'Uber Eats': 'https://www.ubereats.com/ie/store/x/abc', 'Just Eat': 'https://www.just-eat.ie/restaurants-x/menu', DoorDash: 'https://www.doordash.com/store/x-1/', Menulog: 'https://www.menulog.com.au/restaurant-x/menu', 'Square Online': 'https://x.square.site/', Toast: 'https://order.toasttab.com/online/x', ChowNow: 'https://ordering.chownow.com/order/123/locations/456', Flipdish: 'https://x.flipdish.co/', GloriaFood: 'https://www.restaurantlogin.com/api/fb/_x' };
  for (const [ad, u] of Object.entries(siparis)) { const s = saglayiciOf(u); assert.ok(s, u); assert.equal(s.tur, 'siparis', u); assert.equal(s.ad.toLowerCase(), ad.toLowerCase(), u); }
  const rez = { OpenTable: 'https://www.opentable.com.au/r/x-melbourne', SevenRooms: 'https://www.sevenrooms.com/reservations/x', NowBookIt: 'https://nowbookit.com/venues/x', ResDiary: 'https://bookings.resdiary.com/widget/Standard/X/123', Quandoo: 'https://www.quandoo.co.uk/place/x', TheFork: 'https://www.thefork.ie/restaurant/x-r123' };
  for (const [ad, u] of Object.entries(rez)) { const s = saglayiciOf(u); assert.ok(s, u); assert.equal(s.tur, 'rezervasyon', u); assert.equal(s.ad, ad); }
  assert.equal(saglayiciOf('https://x.ie/contact'), null); assert.ok(PLATFORMLAR.length >= 30);
});

test('saglayiciBaglantilari: iframe, betik (OpenTable yukleyici -> restoran sayfasi), data-href ve JSON icindeki baglantilar; preconnect, css ve saglayici ana sayfasi sayilmaz', () => {
  const html = `<head><link rel="preconnect" href="https://www.opentable.com/"><link rel="stylesheet" href="https://order.toasttab.com/x.css">
    <script src="//www.opentable.com/widget/reservation/loader?rid=1234&type=standard&theme=standard&iframe=true"></script></head>
    <body><iframe src="https://www.sevenrooms.com/reservations/pizzeria-roma?venues=x"></iframe>
    <button data-href="https://www.ubereats.com/ie/store/roma/abc123">Order</button>
    <script type="application/json">{"orderUrl":"https:\\/\\/order.toasttab.com\\/online\\/roma-1"}</script>
    <a href="https://www.deliveroo.ie/">Deliveroo</a></body>`;
  const r = saglayiciBaglantilari(html, 'https://x.ie/'); const u = r.map((x) => x.url);
  assert.ok(u.includes('https://www.opentable.com/restref/client/?rid=1234'), u.join(' ')); assert.ok(u.includes('https://www.sevenrooms.com/reservations/pizzeria-roma?venues=x'));
  assert.ok(u.includes('https://www.ubereats.com/ie/store/roma/abc123')); assert.ok(u.includes('https://order.toasttab.com/online/roma-1'));
  assert.ok(!u.some((x) => /preconnect|\.css|deliveroo\.ie\/$|^https:\/\/www\.opentable\.com\/$/.test(x)), u.join(' '));
  assert.equal(r.find((x) => /sevenrooms/.test(x.url)).kanit, 'iframe'); assert.equal(r.find((x) => /restref/.test(x.url)).kanit, 'betik');
  const e = eylemAdaylari({ links: [], html, base: 'https://x.ie/' });
  assert.match(e.siparis.url, /ubereats|toasttab/); assert.match(e.rezervasyon.url, /opentable|sevenrooms/); assert.equal(e.rezervasyon.external, true);
});

test('siparisBul: kendi ana sayfana giden "order online" baslik baglantisi siparis degildir; gercek /order yolu ve platform sayilir', () => {
  const l = (href, text) => ({ href, text });
  assert.equal(siparisBul([l('https://x.ie/index.html', 'Cafe, Take Away, order online'), l('https://www.x.ie/?fbclid=abc', 'or Order online!')], 'https://x.ie/'), null);
  assert.equal(siparisBul([l('/order-online', 'Order Online')], 'https://x.ie/').url, 'https://x.ie/order-online');
  assert.equal(siparisBul([l('https://www.just-eat.ie/restaurants-x/menu', 'Just Eat')], 'https://x.ie/').platform, 'Just Eat');
  assert.equal(siparisBul([l('https://www.easigrub.com/100214_x_onlinemenu.php', 'Order online')], 'https://x.ie/').external, true);
});

// baglanti canlilik: yerel http sunucusu
function sunucu() {
  const s = http.createServer((q, r) => {
    const u = q.url;
    if (u === '/robots.txt') { r.writeHead(200, { 'content-type': 'text/plain' }); return r.end('User-agent: *\nDisallow: /yasak\n'); }
    if (u === '/ok') { r.writeHead(200); return r.end('x'); }
    if (u === '/yonlendir') { r.writeHead(302, { location: '/ok' }); return r.end(); }
    if (u === '/ana') { r.writeHead(302, { location: '/' }); return r.end(); }
    if (u === '/') { r.writeHead(200); return r.end('home'); }
    if (u === '/yok') { r.writeHead(404); return r.end('nope'); }
    if (u === '/head405') { if (q.method === 'HEAD') { r.writeHead(405); return r.end(); } r.writeHead(200); return r.end('get ok'); }
    if (u === '/cf403') { r.writeHead(403, { server: 'cloudflare', 'cf-ray': 'abc-DUB' }); return r.end('blocked'); }
    if (u === '/bot403') { r.writeHead(403, { server: 'AkamaiGHost' }); return r.end('blocked'); }
    if (u === '/s500') { r.writeHead(503); return r.end(); }
    r.writeHead(404); r.end();
  });
  return new Promise((res) => s.listen(0, '127.0.0.1', () => res({ s, url: `http://127.0.0.1:${s.address().port}` })));
}
test('baglantiDogrula: yalniz ag istegi; 2xx canli, 404 olu, HEAD 405 -> GET, Cloudflare 403 muhtemelen canli, baska 403 dogrulanamadi, robots yasagi istek acmaz, DNS yok olu', async () => {
  const { s, url } = await sunucu();
  const polite = new Polite({ gapMs: 1, hostGapMs: 1, timeoutMs: 4000 });
  try {
    assert.equal((await baglantiDogrula(`${url}/ok`, polite)).durum, 'canli');
    assert.equal((await baglantiDogrula(`${url}/yonlendir`, polite)).durum, 'canli');
    assert.equal((await baglantiDogrula(`${url}/yok`, polite)).durum, 'olu');
    const h = await baglantiDogrula(`${url}/head405`, polite); assert.equal(h.durum, 'canli'); assert.match(h.yontem, /GET/);
    const cf = await baglantiDogrula(`${url}/cf403`, polite); assert.equal(cf.durum, 'muhtemelen-canli'); assert.match(cf.neden, /Cloudflare/);
    assert.equal((await baglantiDogrula(`${url}/bot403`, polite)).durum, 'dogrulanamadi');
    assert.equal((await baglantiDogrula(`${url}/s500`, polite)).durum, 'dogrulanamadi');
    const rb = await baglantiDogrula(`${url}/yasak/x`, polite); assert.equal(rb.durum, 'dogrulanamadi'); assert.match(rb.neden, /robots/);
    assert.equal((await baglantiDogrula(`${url}/ana`, polite)).durum, 'canli', 'kok sayfaya yonlenmek tek basamakli yolda olu sayilmaz');
    const kapali = await sunucu(); const olu = kapali.url; await new Promise((r) => kapali.s.close(r)); // kapanmis yerel port: baglanti reddi
    const dead = await baglantiDogrula(`${olu}/x`, new Polite({ gapMs: 1, hostGapMs: 1, timeoutMs: 3000 }));
    assert.equal(dead.durum, 'olu', JSON.stringify(dead)); // baglanti reddi / DNS yok: bagli degil
  } finally { s.close(); }
});

// ---- hazirlik kapisi ----
const iyiR = () => ({
  erisim: { ok: true }, lead: { sektor: 'restoran', name: 'Roma', kind: 'restaurant' }, name: { n: 'Roma' }, address: { text: '1 Main Street, Galway' }, phone: '+353 91 123456', hours: { tableOk: true },
  logo: { orig: { file: 'img/logo-orijinal.png' } }, order: { url: 'https://order.toasttab.com/online/roma', platform: 'Toast', dogrulama: { durum: 'muhtemelen-canli' } }, reservation: null,
  photos: [1, 2, 3, 4, 5].map((i) => ({ id: `0${i}`, w: 1600, h: 1000, meanS: 0.5, lapVar: 400 })),
});
test('hazirlikKapisi/onKapi: stok, uretilmis ve afis kareleri sayilmaz; olu siparis baglantisi eylem degil; muhtemelen-canli gecer; kosullar saglaninca gecer', () => {
  const dir = tmp('cikarici-kapi-'); const lead = { slug: 'roma', name: 'Roma' };
  let k = hazirlikKapisi(iyiR(), lead, dir); assert.equal(k.elendi, null, JSON.stringify(k.elendi)); assert.equal(k.eylem.tur, 'siparis'); assert.equal(k.eylem.dogrulama.durum, 'muhtemelen-canli');
  // 3 kare stok / uretilmis / afis -> 2 kare kalir
  const R = iyiR(); R.photos[0].isaretler = { stok: ['adres/alt: unsplash'] }; R.photos[1].isaretler = { uretilmis: ['metadata: c2pa'] }; R.photos[2].isaretler = { afis: ['dosya adi/alt: menu', 'kesin: afis ya da menu gorseli (ad ipucu + PNG/dik ya da goruntu analizi)'] };
  k = hazirlikKapisi(R, lead, dir); assert.match(k.elendi.join(' | '), /kullanılabilir fotoğraf az \(2; en az 4, 800 px\+; 3 stok, üretilmiş görsel ya da afiş sayılmadı\)/);
  // yalniz isaret (kesin degil) sayilir
  const R2 = iyiR(); R2.photos[0].isaretler = { afis: ['dosya adi/alt: menu'] }; R2.photos[1].isaretler = { uretilmis: ['olcu: 1376x768 (uretilmis gorsel olcusu; tek basina kanit degil)'] };
  assert.equal(hazirlikKapisi(R2, lead, dir).elendi, null);
  // olu siparis baglantisi
  const R3 = iyiR(); R3.order.dogrulama = { durum: 'olu' }; k = hazirlikKapisi(R3, lead, dir); assert.match(k.elendi.join(' | '), /bağlantı açılmıyor/);
  // olu siparis ama canli dis rezervasyon
  R3.reservation = { url: 'https://www.sevenrooms.com/reservations/roma', external: true, dogrulama: { durum: 'canli' } }; k = hazirlikKapisi(R3, lead, dir); assert.equal(k.elendi, null); assert.equal(k.eylem.tur, 'rezervasyon');
  // logo yok, yatay 1000 px yok
  const R4 = iyiR(); R4.logo = null; R4.photos.forEach((p) => { p.w = 900; p.h = 700; }); k = hazirlikKapisi(R4, lead, dir);
  assert.ok(k.elendi.some((x) => /^logo yok/.test(x)) && k.elendi.some((x) => /1000 px üstünde yatay/.test(x)));
  // zincir ve hedef disi ulke eski gibi
  fs.writeFileSync(path.join(dir, '_home.txt'), 'We have 7 locations across the country'); assert.match(hazirlikKapisi(iyiR(), lead, dir).elendi[0], /zincir/);
  fs.writeFileSync(path.join(dir, '_home.txt'), ''); const R5 = iyiR(); R5.address = { text: '12 Main St, Victoria BC V8W 1A1' }; assert.match(hazirlikKapisi(R5, lead, dir).elendi[0], /hedef ulke/);
  assert.match(hazirlikKapisi(null, lead, dir).elendi[0], /cikarici\.json yok/);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(typeof onKapi, 'function');
});

test('olcum araci: menuKaynakVar ve once/sonra ozeti', () => {
  assert.equal(menuKaynakVar({ menu: { items: [1, 2, 3, 4].map((i) => ({ n: `x${i}`, p: '5' })), pdfs: [] } }), 'sayfa');
  assert.equal(menuKaynakVar({ menu: { items: [], pdfs: ['https://x.ie/menu.pdf'] } }), 'pdf');
  assert.equal(menuKaynakVar({ menu: { items: [], pdfs: [] }, photos: [{ url: 'https://x.ie/img/Menu-1.jpg', alt: '' }] }), 'gorsel');
  assert.equal(menuKaynakVar({ menu: { items: [] }, order: { url: 'https://x' } }), 'siparis-sitesi');
  assert.equal(menuKaynakVar({ menu: { items: [] } }), null);
  assert.equal(menuKaynakVar({ menu: { items: [] } }, '$5\n$6\n$7\n$8\n$9\n$10'), 'metin');
  const o = ozetle([{ slug: 'a', once: { gecer: false, reasons: ['logo yok (x)', 'adres yok'] }, sonra: { gecer: true, reasons: [] } }, { slug: 'b', once: { gecer: false, reasons: ['adres yok'] }, sonra: { gecer: false, reasons: ['adres yok'] } }]);
  assert.equal(o.once.gecen, 0); assert.equal(o.sonra.gecen, 1); assert.deepEqual(o.yeniGecen, ['a']); assert.equal(o.once.nedenler['adres yok'], 2); assert.equal(o.sonra.nedenler['adres yok'], 1);
});
