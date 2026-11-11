// Kart fotografi (11 Kas, pizza-foto): kaydiricidaki her pizza karti YALNIZ o pizzanin isletmenin kendi sitesindeki fotografini tasir; yoksa kart oldugu gibi.
// Eslestirici (dosya adi / alt / baslik), plan (elle karar, bastirma, tekrar yok, kucuk kare yok), 5:4 kirpma ve sentetik pizzaciyla tam uretim.  Ag yok.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sharp } from '../lib/gorsel.mjs';
import { adTasir, kartFotoBul, kartFotoPlan, kartKirp, kenarAcik, ORAN } from '../lib/kart-foto.mjs';
import { kayitKur } from '../restoran-icerik.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('kart fotografi: ad dosya adinda, alt metninde ya da baslikta yan yana gecmeli; geriye yalniz genel sozcukler kalmali', () => {
  const I = 'Il Birrificio Pizzeria';
  const evet = [['Il-Birrificio-Pizza-1-scaled.jpg', 'Il Birrificio'], ['san-daniels.png', 'San Daniele'], ['capricciosa-pizza-scaled.jpg', 'Capricciosa'], ['Pizza-napoletana-scaled.jpg', 'Napoletana'],
    ['POLPETTE-E-PECORINO-scaled.jpg', 'Polpette e Pecorino'], ['Polpette-e-Pecorino-Il-Birrificio-.jpg', 'Polpette e Pecorino'], ['pizza-margherita-1-scaled.jpg', 'Margherita (V)'], ['margherita!!.png', 'Margherita (V)'], ['Diavola-1024x683.jpg', 'Diavola']];
  const hayir = [['Top-Italian-Cuisine-Restaurant-Near-Me-IL-Birrificio-Pizzeria.jpg', 'Il Birrificio'], ['Contact-IL-Birrificio-Italian-Restaurant-Camberwell.jpg', 'Il Birrificio'], ['Il-Birrificio-on-Toorak-Road-Camberwell.jpg', 'Il Birrificio'],
    ['Polpette-al-sugo-1-scaled.jpg', 'Polpette e Pecorino'], ['PizzaPomodoroMenu_Social Media-11.jpg', 'Pizza Bread'], ['baby-margherita.jpg', 'Margherita (V)'], ['IMG_5842.JPG', 'Margherita (V)'],
    ['Hawaiian-Pizza-Ham-Pineapple-768x403.jpg', 'Hawaiian'], ['A margherita on a wooden board with flour and basil', 'Margherita (V)'], ['pizza.jpg', 'Pizza']];
  for (const [m, a] of evet) assert.equal(adTasir(m, a, I), true, `${a} <- ${m}`);
  for (const [m, a] of hayir) assert.equal(adTasir(m, a, I), false, `${a} x ${m}`);
});

test('kart fotografi: plan elle karari onceler, null bastirir, bir kare iki kartta kullanilmaz; yer tutucu, kucuk kare ve haric kare eslesmez', () => {
  const P = [
    { id: '01', file: 'img/o01.jpg', url: 'https://x.example/wp-content/uploads/capricciosa-pizza-scaled.jpg', w: 2560, h: 1707 },
    { id: '02', file: 'img/o02.jpg', url: 'https://x.example/wp-content/uploads/capricciosa-2.jpg', w: 1200, h: 900 },
    { id: '03', file: 'img/o03.jpg', url: 'https://x.example/wp-content/uploads/diavola.jpg', w: 500, h: 400 },
    { id: '04', file: 'img/o04.png', url: 'https://x.example/wp-content/uploads/woocommerce-placeholder.png', w: 1200, h: 1200, alt: 'Calzone' },
    { id: '05', file: 'img/o05.jpg', url: 'https://x.example/wp-content/uploads/napoletana.jpg', w: 1600, h: 1200 },
    { id: '06', file: 'img/o06.jpg', url: 'https://static.wixstatic.com/media/18845f_41697fa285fb4b07b8cca46b60cbe47c~mv2.png', w: 1448, h: 1086, alt: 'A margherita on a wooden board' },
  ];
  assert.equal(kartFotoBul(P, 'Capricciosa').id, '01', 'en buyuk dosya adi eslesmesi');
  assert.equal(kartFotoBul(P, 'Diavola'), null, '500 px kare kart icin kucuk (buyutme yok)');
  assert.equal(kartFotoBul(P, 'Calzone'), null, 'yer tutucu eslesmez');
  assert.equal(kartFotoBul(P, 'Napoletana', { haric: ['05'] }), null, 'haric kare eslesmez');
  assert.equal(kartFotoBul(P, 'Margherita (V)'), null, 'Wix ortam kimligi ve tarif cumlesi ad degildir: elle karar gerekir');
  const plan = kartFotoPlan({ secim: ['Margherita (V)', 'Capricciosa', 'Napoletana', 'Diavola', 'Quattro'], foto: { 'Margherita (V)': { id: '06', kirp: { left: 548, top: 127, width: 900, height: 720 }, kaynak: 'ana sayfa: margherita!!.png' }, Napoletana: null } }, P);
  const by = Object.fromEntries(plan.map((k) => [k.ad, k]));
  assert.equal(by['Margherita (V)'].id, '06'); assert.equal(by['Margherita (V)'].oto, false); assert.deepEqual(by['Margherita (V)'].kirp, { left: 548, top: 127, width: 900, height: 720 });
  assert.equal(by.Capricciosa.id, '01'); assert.equal(by.Capricciosa.oto, true); assert.match(by.Capricciosa.kaynak, /^dosya adi: capricciosa-pizza-scaled\.jpg/);
  assert.equal(by.Napoletana.id, null); assert.equal(by.Napoletana.bastirildi, true); assert.equal(by.Napoletana.aday.id, '05', 'bastirilan kartin adayi raporda kalir');
  assert.equal(by.Diavola.id, null); assert.equal(by.Quattro.id, null);
  // ayni kare iki karta gitmez: "Capricciosa" ve "Capricciosa Bianca" ayni dosyayi isteyemez (ikinci kart ikinci kareyi alir ya da bos kalir)
  const p2 = kartFotoPlan({ secim: ['Capricciosa', 'Capricciosa'] }, P);
  assert.notEqual(p2[0].id, p2[1].id);
  // elle verilen kare yoksa kart fotografsiz ve raporda gorunur
  const p3 = kartFotoPlan({ secim: ['Capricciosa'], foto: { Capricciosa: '99' } }, P);
  assert.equal(p3[0].id, null); assert.match(p3[0].kaynak, /kare 99 yok/); assert.equal(p3[0].aday.id, '01');
});

test('kart fotografi: 5:4 kirpma kaynagin icinde kalir, odak noktasini izler, elle kirpma aynen', () => {
  for (const md of [{ width: 2560, height: 1707 }, { width: 3024, height: 4032 }, { width: 1448, height: 1086 }]) {
    for (const odak of [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]) {
      const c = kartKirp(md, { odak });
      assert.ok(c.left >= 0 && c.top >= 0 && c.left + c.width <= md.width && c.top + c.height <= md.height, JSON.stringify({ md, odak, c }));
      assert.ok(Math.abs(c.width / c.height - ORAN) < 0.01, `oran ${c.width}x${c.height}`);
    }
  }
  assert.deepEqual(kartKirp({ width: 1448, height: 1086 }, { kirp: { left: 548, top: 127, width: 900, height: 720 } }), { left: 548, top: 127, width: 900, height: 720 });
  assert.equal(kartKirp({ width: 2560, height: 1707 }, { odak: { x: 0.1, y: 0.5 } }).left, 0);
});

test('kart fotografi: beyaz zeminli urun karesi kose olcusuyle bulunur (kenara degen kabuk ya da bardak tek koseyi bozar)', async () => {
  const ham = async (svg) => { const o = await sharp(Buffer.from(svg)).resize(48, 38, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return kenarAcik(o.data, o.info.width, o.info.height, o.info.channels); };
  const W = 500, H = 400; const pizza = '<ellipse cx="250" cy="200" rx="245" ry="170" fill="#c8552d"/>';
  assert.equal((await ham(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fbfbf8"/>${pizza}</svg>`)).acik, true, 'beyaz masa');
  assert.equal((await ham(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fbfbf8"/>${pizza}<rect x="440" y="300" width="60" height="100" fill="#3a0d12"/></svg>`)).acik, true, 'bir kosede bardak');
  assert.equal((await ham(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#5b5e60"/>${pizza}</svg>`)).acik, false, 'celik tezgah');
  assert.equal((await ham(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f3c9a0"/>${pizza}</svg>`)).acik, false, 'doygun acik renk beyaz sayilmaz');
});

// ---- sentetik pizzaci: uc kendi urun fotografi (biri kucuk), bir yer tutucu; kaydirici dort kart ----
async function pizzaci(veri, slug) {
  const R = JSON.parse(fs.readFileSync(path.join(HERE, 'fixture', 'cikarici-sablon.json'), 'utf8'));
  R.slug = slug; R.lead.name = 'Test Pizzeria'; if (R.name) R.name.n = 'Test Pizzeria'; const dir = path.join(veri, slug); fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  const kare = async (file, w, h, i) => { const b = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 90 + i * 20, g: 50 + i * 9, b: 30 }, noise: { type: 'gaussian', mean: 110, sigma: 40 } } }).jpeg({ quality: 70 }).toBuffer(); fs.writeFileSync(path.join(dir, file), b); };
  for (const [i, p] of R.photos.entries()) { await kare(p.file, 1000, 667, i); p.w = 1000; p.h = 667; }
  const urun = [['21', 'charcoal-chicken-pizza-scaled.jpg', 1600, 1067], ['22', 'lamb-skewers.jpg', 520, 400], ['23', 'woocommerce-placeholder.png', 1200, 1200]];
  for (const [id, ad, w, h] of urun) { const file = `img/o${id}.jpg`; await kare(file, w, h, +id); R.photos.push({ id, file, url: `https://test-kitchen.example/wp-content/uploads/${ad}`, via: 'elle', w, h, alt: '', ozgun: true }); }
  const logo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><circle cx="150" cy="150" r="110" fill="#c0392b"/><rect x="290" y="110" width="260" height="80" fill="#c0392b"/></svg>')).png().toBuffer();
  fs.writeFileSync(path.join(dir, R.logo.orig.file), logo); fs.writeFileSync(path.join(dir, R.logo.file), await sharp(logo).webp().toBuffer());
  R.logo.orig.sha256 = crypto.createHash('sha256').update(logo).digest('hex'); R.logo.orig.bytes = logo.length;
  fs.writeFileSync(path.join(dir, 'cikarici.json'), JSON.stringify(R, null, 1));
  return R;
}
const karar = (slider, { w = false } = {}) => ({
  tur: 'icerik', karar: 'icerik', inceleyen: 'icerik-turu', sablon: 'pizza', neden: 'fixture',
  hero: { id: '01', gerekce: 'fixture frame, sharp, no text', reddedilen: [] },
  menu: { kaynak: { tur: 'sayfa', url: 'https://test-kitchen.example/menu', dosya: 'menu-kaynak/sayfa.txt' }, kalemler: [{ n: 'Charcoal chicken', d: 'Chicken, mozzarella, basil', p: '€18.50', cat: 'Pizze' }, { n: 'Lamb skewers', d: 'Lamb, onion, tomato', p: '€21', cat: 'Pizze' }, { n: w ? 'Flatbread (W)' : 'Flatbread', d: 'Olive oil, rosemary', p: '€6', cat: 'Pizze' }, { n: 'Calzone', d: 'Ham, mushroom, mozzarella', p: '€16', cat: 'Pizze' }, { n: 'Fries', p: '€5', cat: 'Sides' }, { n: 'Olive oil cake', p: '€8', cat: 'Desserts' }] },
  saat: { satirlar: ['Monday to Sunday 12pm to 10pm'], kaynak: 'fixture' }, eylem: { url: 'https://test-pizzeria.orderyoyo.ie/', tur: 'siparis', platform: 'Order YoYo' },
  icerik: { kategori: 'pizza', sec: 0, aday: [{ text: 'Cooked over *charcoal.*', kaynak: 'fixture' }], kareler: { ziyaret: ['05'] }, ustYazi: 'Pizza, Galway', lede: 'We cook over charcoal and bake our own bread every morning.', eylem: 'Order for pickup', eylemKisa: 'Order', kategoriEk: { adres: '1 Fixture Street, Galway, H91 X000' }, slider },
  gozlem: { metin: 'fixture', kanit: 'once-390.jpg' },
});
const kartlar = (html) => (html.match(/<article class="card slide[^"]*"[\s\S]*?<\/article>/g) || []).map((a) => ({ ad: /aria-label="No\. \d+, ([^"]+)"/.exec(a)[1], foto: /class="slide-f"/.test(a), a }));

test('tam uretim (sentetik pizzaci): kendi fotografi olan kartta fotograf (5:4, 480/960, srcset, tembel), olmayanda kart oldugu gibi; fotografsiz kaydirici eskisiyle ayni', async () => {
  const veri = tmp('kf-veri-'); const out = tmp('kf-out-'); const slug = 'test-pizzeria-ie0001';
  try {
    const { uretKategori, pageDir } = await import('../uret-kategori.mjs'); const { tamamla } = await import('../kategori-tamamla.mjs');
    await pizzaci(veri, slug);
    const yaz = (slider, o) => { fs.writeFileSync(path.join(veri, slug, 'icerik.json'), JSON.stringify(kayitKur(karar(slider, o)))); tamamla(slug, { veri }); };
    yaz({ h2: 'Pick a pizza', grup: 'Pizze', secim: ['Charcoal chicken', 'Lamb skewers', 'Flatbread', 'Calzone'] });
    const rap = await uretKategori(slug, { veri, out, log: () => {} });
    const html = fs.readFileSync(path.join(out, pageDir(slug), 'index.html'), 'utf8');
    const K = kartlar(html); assert.equal(K.length, 4);
    // fotografi olan kart fotografsiz kalmaz
    for (const k of rap.kartFoto) if (k.aday && !k.bastirildi) assert.ok(k.id, `kendi fotografi olan kart fotografsiz: ${k.ad}`);
    assert.deepEqual(K.map((k) => k.foto), [true, false, false, false], 'yalniz adini tasiyan buyuk kare; kucuk kare ve yer tutucu yok');
    assert.match(html, /<div class="slides has-f" id="slides"/, 'koyu zeminli kare: acik kart zemini yok');
    const img = /<figure class="slide-f"><img ([^>]+)>/.exec(K[0].a)[1];
    assert.match(img, /src="img\/k21-960\.webp" srcset="img\/k21-480\.webp 480w, img\/k21-960\.webp 960w"/); assert.match(img, /loading="lazy"/); assert.match(img, /sizes="\(max-width: 599px\)/);
    assert.match(img, /alt="Charcoal chicken pizza at Test Pizzeria"/);
    assert.doesNotMatch(html, /Pomodoro/, 'kahraman yedek alt metni baska isletmenin adini tasimaz'); assert.match(html, /alt="A pizza at Test Pizzeria"/);
    for (const w of [480, 960]) { const md = await sharp(path.join(out, pageDir(slug), 'img', `k21-${w}.webp`)).metadata(); assert.equal(md.width, w); assert.ok(Math.abs(md.width / md.height - ORAN) < 0.01, `5:4 ${md.width}x${md.height}`); }
    assert.match(K[1].a, /class="slide-m"/, 'fotografsiz kartta 3D malzemeler kalir'); assert.doesNotMatch(K[1].a, /<img/);
    assert.equal(rap.kartFoto.find((k) => k.ad === 'Charcoal chicken').kaynak, 'dosya adi: charcoal-chicken-pizza-scaled.jpg');
    for (const f of rap.dosyalar) assert.ok(f.w <= 1600, `buyutme yok ${f.f}`);
    const css = fs.readFileSync(path.join(out, '_hat1k', 'pizza.css'), 'utf8'); assert.match(css, /\.slide-f \{[^}]*aspect-ratio: 5 \/ 4/); assert.match(css, /\.slides\.has-f \{ align-items: stretch; \}/);
    // elle bastirma: goz dogrulamasi "bu o pizza degil" derse kart fotografsiz; hic fotografli kart yoksa kaydirici eskisiyle ayni (has-f yok, slide-f yok)
    yaz({ h2: 'Pick a pizza', grup: 'Pizze', secim: ['Charcoal chicken', 'Lamb skewers', 'Flatbread', 'Calzone'], foto: { 'Charcoal chicken': null } });
    const rap2 = await uretKategori(slug, { veri, out, log: () => {} });
    const html2 = fs.readFileSync(path.join(out, pageDir(slug), 'index.html'), 'utf8');
    assert.match(html2, /<div class="slides" id="slides"/); assert.doesNotMatch(html2, /slide-f|slide-foto/);
    assert.equal(rap2.kartFoto[0].bastirildi, true); assert.equal(rap2.kartFoto[0].aday, '21');
    assert.ok(!fs.existsSync(path.join(out, pageDir(slug), 'img', 'k21-960.webp')), 'kullanilmayan kart dosyasi temizlenir');
    // beyaz zeminli urun karesi: fotografli kartlar acik kart zemini alir (dosya ayni kirpma); (W) beyaz taban rozeti, (V) eskisi gibi
    const beyaz = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067"><rect width="1600" height="1067" fill="#fbfbf8"/><ellipse cx="800" cy="534" rx="760" ry="470" fill="#c8552d"/></svg>')).jpeg({ quality: 80 }).toBuffer();
    fs.writeFileSync(path.join(veri, slug, 'img', 'o21.jpg'), beyaz);
    yaz({ h2: 'Pick a pizza', grup: 'Pizze', secim: ['Charcoal chicken', 'Lamb skewers', 'Flatbread (W)', 'Calzone'] }, { w: true });
    const rap3 = await uretKategori(slug, { veri, out, log: () => {} });
    const html3 = fs.readFileSync(path.join(out, pageDir(slug), 'index.html'), 'utf8');
    assert.match(html3, /<div class="slides has-f f-acik" id="slides"/); assert.equal(rap3.kartFoto[0].zemin.acik, true);
    assert.ok(html3.includes('<h3 class="slide-n">Flatbread <span class="v v-w" title="white base">W</span></h3>'), 'W rozeti');
    const css3 = fs.readFileSync(path.join(out, '_hat1k', 'pizza.css'), 'utf8'); assert.ok(css3.includes('.f-acik .slide-foto { background: var(--paper); color: var(--paper-ink);'), 'acik kart zemini kurali');
  } finally { fs.rmSync(veri, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); }
});
