// v5 ana dugme etiketi (17 Kas 2026): yalniz siparis veren isletme (masa ayirtma yok, gercek siparis sayfasi var) EN sayfada "Book a table" gormez, "Order online" gorur.
// Ag yok, tarayici yok; sentetik isletmeyle tam uretim.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sharp } from '../lib/gorsel.mjs';
import { denetle, kayitKur } from '../restoran-icerik.mjs';
import { etiketV5 } from '../uret-v5.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('etiketV5: EN siparis -> Order online; EN rezervasyon ve bos eylem sablon varsayilani; karar etiketi her dilde gecer; TR eski davranis', () => {
  const url = 'https://order.example/golden-panda';
  assert.deepEqual(etiketV5({ lang: 'en', resv: url, ct: { url, tur: 'siparis' } }), { label: 'Order online', short: 'Order', short2: 'Order online', ikon: 'bag' });
  assert.equal(etiketV5({ lang: 'en', resv: url, ct: { url, tur: 'rezervasyon' } }), null, 'rezervasyon: Book a table kalir');
  assert.equal(etiketV5({ lang: 'en', resv: url, ct: {} }), null, 'tur belirtilmediyse sablon varsayilani');
  assert.equal(etiketV5({ lang: 'en', resv: null, ct: { tur: 'siparis' } }), null, 'baglanti yoksa etiket yok');
  const ozel = etiketV5({ lang: 'en', resv: url, ct: { url, tur: 'siparis', label: 'Order for pickup', short: 'Pickup' } });
  assert.equal(ozel.label, 'Order for pickup'); assert.equal(ozel.short, 'Pickup'); assert.equal(ozel.ikon, 'bag');
  assert.equal(etiketV5({ lang: 'en', resv: url, ct: { tur: 'rezervasyon', label: 'Reserve' } }).ikon, undefined, 'rezervasyonda cantaya cevrilmez');
  // TR: degismedi
  assert.deepEqual(etiketV5({ lang: 'tr', resv: 'https://www.yemeksepeti.com/r', ct: { tur: 'siparis' }, pl: 'Yemeksepeti' }), { label: 'Sipariş ver', short: 'Sipariş', short2: 'Sipariş ver', ikon: 'bag' });
  assert.equal(etiketV5({ lang: 'tr', resv: url, ct: { tur: 'rezervasyon' } }), null);
  assert.equal(etiketV5({ lang: 'tr', resv: 'https://wa.me/905', ct: { tur: 'siparis' }, pl: 'WhatsApp' }).label, 'WhatsApp\'tan sipariş ver');
  assert.equal(etiketV5({ lang: 'tr', resv: url, ct: { label: 'Masa ayırtın', tur: 'rezervasyon' } }).ikon, undefined);
});

const metin = 'Welcome to Test Kitchen. Small plates and grill in Galway. We cook over charcoal and bake our own bread every morning. Opened in 2019 on Fixture Street.';
const kaynakTxt = '[Mains] Charcoal chicken: €18.50\n[Mains] Lamb skewers: €21\n[Small plates] Flatbread: €6\n[Small plates] Burrata: €12\n[Sides] Fries: €5\n[Desserts] Olive oil cake: €8\n';
const karar = (eylem) => ({
  tur: 'icerik', karar: 'icerik', inceleyen: 'icerik-turu', sablon: 'v5', neden: 'fixture',
  hero: { id: '01', gerekce: 'The grill counter with plates in focus, no text or logo on the frame, sharp across the subject.', reddedilen: [{ id: '02', neden: 'takeaway boxes' }] },
  menu: { kaynak: { tur: 'sayfa', url: 'https://test-kitchen.example/menu', dosya: 'menu-kaynak/sayfa.txt' }, kalemler: [{ n: 'Charcoal chicken', d: 'Half bird', p: '€18.50', cat: 'Mains' }, { n: 'Lamb skewers', p: '€21', cat: 'Mains' }, { n: 'Flatbread', p: '€6', cat: 'Small plates' }, { n: 'Burrata', p: '€12', cat: 'Small plates' }, { n: 'Fries', p: '€5', cat: 'Sides' }, { n: 'Olive oil cake', p: '€8', cat: 'Desserts' }] },
  saat: null, eylem,
  icerik: { slogan: { text: 'Cooked over *charcoal.*', kaynak: 'We cook over charcoal (ana sayfa)' }, eyebrow: 'Small plates and grill, Galway', lede: 'We cook over charcoal and bake our own bread every morning.', foto: { menu: '03', story: '04', contact: '05' }, menu: { kicker: 'Menu', h2: 'Small plates *and grill*' }, story: { kicker: 'Opened in 2019', text: 'We cook over charcoal and bake our own bread every morning.' }, contact: { kicker: 'Find us', h2: 'On Fixture Street' } },
  gozlem: { metin: 'On a phone your opening hours are three taps away from the home page.', kanit: 'once-390.jpg' },
});
const ctx = { ad: 'Test Kitchen', fotoIds: ['01', '02', '03', '04', '05', '06'], metin, kaynakDosya: (f) => (f === 'menu-kaynak/sayfa.txt' ? kaynakTxt : null), kaynaklar: [{ tur: 'sayfa', url: 'https://test-kitchen.example/menu', dosya: 'menu-kaynak/sayfa.txt', robots: 'izinli' }] };

test('icerik karari: siparis eylemi v5 kaydina cta.tur siparis olarak gecer', () => {
  const k = karar({ url: 'https://order.test-kitchen.example/', tur: 'siparis' });
  assert.deepEqual(denetle(k, ctx), []);
  const v = kayitKur(k); assert.equal(v.v5.cta.tur, 'siparis'); assert.equal(v.v5.cta.url, 'https://order.test-kitchen.example/');
});

async function fixture(veri, slug) {
  const R = JSON.parse(fs.readFileSync(path.join(HERE, 'fixture', 'cikarici-sablon.json'), 'utf8'));
  R.slug = slug; const dir = path.join(veri, slug); fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  for (const [i, p] of R.photos.entries()) {
    const w = i === 0 ? 2000 : 1000; const h = i === 0 ? 1334 : 667;
    const buf = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 60 + i * 20, g: 40 + i * 9, b: 30 + i * 5 }, noise: { type: 'gaussian', mean: 110, sigma: 40 } } }).webp({ quality: 70 }).toBuffer();
    fs.writeFileSync(path.join(dir, p.file), buf); p.w = w; p.h = h;
  }
  const logo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="none"/><circle cx="150" cy="150" r="110" fill="#c0392b"/><rect x="290" y="110" width="260" height="80" fill="#c0392b"/></svg>')).png().toBuffer();
  fs.writeFileSync(path.join(dir, R.logo.orig.file), logo); fs.writeFileSync(path.join(dir, R.logo.file), await sharp(logo).webp().toBuffer());
  R.logo.orig.sha256 = crypto.createHash('sha256').update(logo).digest('hex'); R.logo.orig.bytes = logo.length;
  fs.writeFileSync(path.join(dir, 'cikarici.json'), JSON.stringify(R, null, 1));
  return R;
}

const gorunen = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');

test('tam uretim (sentetik): siparis-only isletmenin her dugmesi Order online, baglanti isletmenin siparis sayfasi, Book a table yok; rezervasyon isletmesi degismez', async () => {
  const veri = tmp('sd-veri-'); const out = tmp('sd-out-');
  try {
    const { heroDosyalari } = await import('../lib/hero-sec.mjs'); const { uretV5, pageDirV5 } = await import('../uret-v5.mjs');
    const kos = async (slug, eylem) => {
      const R = await fixture(veri, slug);
      fs.writeFileSync(path.join(veri, slug, 'icerik.json'), JSON.stringify(kayitKur(karar(eylem))));
      await heroDosyalari({ ...R, slug }, { dir: path.join(veri, slug), id: '01', getir: null, adaylar: [{ id: '01', puan: 50, w: 2400, h: 1600 }], inceleme: { inceleyen: 'icerik-turu', gerekce: 'fixture' } });
      const r = await uretV5(slug, { veri, out, log: () => {} }); assert.equal(r.status, 'uretildi', JSON.stringify(r.reasons || (r.report && r.report.warn)));
      return fs.readFileSync(path.join(out, pageDirV5(slug), 'index.html'), 'utf8');
    };
    const siparis = gorunen(await kos('test-order-ie0001', { url: 'https://order.test-kitchen.example/', tur: 'siparis' }));
    assert.ok(siparis.includes('href="https://order.test-kitchen.example/"'), 'ana eylem siparis sayfasi');
    assert.match(siparis, />Order online</); assert.match(siparis, />Order</, 'alt cubuk kisa etiketi');
    assert.doesNotMatch(siparis, /Book a table|>Book</, 'siparis-only isletmede masa ayirtma etiketi yok');
    const rez = gorunen(await kos('test-book-ie0002', { url: 'https://test-kitchen.example/book', tur: 'rezervasyon' }));
    assert.match(rez, />Book a table</); assert.doesNotMatch(rez, />Order online</);
  } finally { fs.rmSync(veri, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); }
});
