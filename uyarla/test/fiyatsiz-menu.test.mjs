// Fiyatsiz menu (17 Kas 2026, koordinator karari): isletme fiyat yayimlamiyorsa menu yemekleri fiyatsiz gosterilir; fiyat ASLA uydurulmaz.  Yalniz v5.
// Ag yok, tarayici yok; sentetik isletmeyle tam uretim.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sharp } from '../lib/gorsel.mjs';
import { denetle, kayitKur } from '../restoran-icerik.mjs';
import { fiyatsizMenuMetni } from '../restoran-hazirla.mjs';
import { yenidenHazirlik, kapiBitti } from '../lib/surum.mjs';
import { fiyatVarMi } from '../../hat/uygula.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

const metin = 'Welcome to Test Kitchen. Small plates and grill in Galway. We cook over charcoal and bake our own bread every morning. Opened in 2019 on Fixture Street.';
const kaynakTxt = '## https://test-kitchen.example/menu\nCharcoal chicken\nHalf bird with herbs\nLamb skewers\nFlatbread\nBurrata\nFries\nOlive oil cake\nBaklava &amp; tea\n';
const kalemler = () => [{ n: 'Charcoal chicken', d: 'Half bird with herbs', p: '', cat: 'Mains' }, { n: 'Lamb skewers', p: '', cat: 'Mains' }, { n: 'Flatbread', p: '', cat: 'Small plates' }, { n: 'Burrata', p: '', cat: 'Small plates' }, { n: 'Fries', p: '', cat: 'Sides' }, { n: 'Olive oil cake', p: '', cat: 'Desserts' }];
const karar = () => ({
  tur: 'icerik', karar: 'icerik', inceleyen: 'icerik-turu', sablon: 'v5', neden: 'fixture',
  hero: { id: '01', gerekce: 'The grill counter with plates in focus, no text or logo on the frame, sharp across the subject.', reddedilen: [{ id: '02', neden: 'takeaway boxes' }] },
  menu: { fiyatsiz: true, kaynak: { tur: 'sayfa', url: 'https://test-kitchen.example/menu', dosya: 'menu-kaynak/sayfa-fiyatsiz.txt' }, kalemler: kalemler() },
  saat: null, eylem: { url: 'https://test-kitchen.example/book', tur: 'rezervasyon' },
  icerik: { slogan: { text: 'Cooked over *charcoal.*', kaynak: 'We cook over charcoal (ana sayfa)' }, eyebrow: 'Small plates and grill, Galway', lede: 'We cook over charcoal and bake our own bread every morning.', foto: { menu: '03', story: '04', contact: '05' }, menu: { kicker: 'Menu', h2: 'Small plates *and grill*' }, story: { kicker: 'Opened in 2019', text: 'We cook over charcoal and bake our own bread every morning.' }, contact: { kicker: 'Find us', h2: 'On Fixture Street' } },
  gozlem: { metin: 'On a phone your opening hours are three taps away from the home page.', kanit: 'once-390.jpg' },
});
const kaynak = () => ({ tur: 'sayfa', url: 'https://test-kitchen.example/menu', dosya: 'menu-kaynak/sayfa-fiyatsiz.txt', fiyatsiz: true, robots: 'izinli (cikarici okudu)' });
const ctx = () => ({ ad: 'Test Kitchen', fotoIds: ['01', '02', '03', '04', '05', '06'], metin, kaynakDosya: (f) => (f === 'menu-kaynak/sayfa-fiyatsiz.txt' ? kaynakTxt : null), kaynaklar: [kaynak()] });

test('fiyatsiz menu denetimi: gecerli karar gecer; fiyat, kategori sablonu, kaynakta olmayan yemek, fiyatli kaynak, fiyat sozu ve az kalem reddedilir', () => {
  assert.deepEqual(denetle(karar(), ctx()), []);
  const bozuk = (f, c = ctx()) => { const k = karar(); f(k); return denetle(k, c).join(' | '); };
  assert.match(bozuk((k) => { k.menu.kalemler[1].p = '€21'; }), /fiyatsiz menude fiyat yazilmaz/);
  assert.match(bozuk((k) => { k.sablon = 'burger'; k.icerik = { kategori: 'burger', sec: 0, aday: [{ text: 'Cooked over *charcoal.*', kaynak: 'x' }] }; }), /yalniz v5/);
  assert.match(bozuk((k) => { k.menu.kalemler[2].n = 'Pizza Napoli'; }), /yemek adi kaynakta yok: Pizza Napoli/);
  assert.match(bozuk((k) => { k.menu.kalemler = k.menu.kalemler.slice(0, 5); }), /en az 6 kalem/);
  assert.match(bozuk((k) => { k.icerik.menu.legend = 'Prices are taken from the site.'; }), /fiyatsiz menude fiyat sozu gecmez/);
  assert.match(bozuk((k) => { k.icerik.menu.legend = 'Fiyatlar sitesinden alındı.'; k.dil = 'tr'; }), /fiyat sozu gecmez/);
  assert.match(bozuk((k) => { k.menu.fiyatsiz = 'evet'; }), /menu.fiyatsiz true/);
  // fiyatli kaynak varken fiyatsiz yazilamaz
  assert.match(bozuk(() => {}, { ...ctx(), kaynaklar: [kaynak(), { tur: 'sayfa', url: 'https://test-kitchen.example/menu2', dosya: 'menu-kaynak/sayfa.txt', robots: 'izinli' }] }), /fiyatli satirlar var/);
  // fiyatli menu kurali degismedi: fiyatsiz bayrak yokken bos fiyat hatadir
  assert.match(bozuk((k) => { delete k.menu.fiyatsiz; }), /fiyat bicimi/);
  // HTML varligi ve Turkce I/i: kaynakta "&amp;", "KÖFTE"
  const k2 = karar(); k2.menu.kalemler[5] = { n: 'Baklava & tea', p: '', cat: 'Desserts' }; assert.deepEqual(denetle(k2, ctx()), []);
  const k3 = karar(); k3.menu.kalemler[0].n = 'Köfte Izgara'; const c3 = { ...ctx(), kaynakDosya: (f) => (f === 'menu-kaynak/sayfa-fiyatsiz.txt' ? `${kaynakTxt}KÖFTE IZGARA\n` : null) }; assert.deepEqual(denetle(k3, c3), []);
});

test('kayit bicimi: fiyatsiz bayragi v5 menu kaydina gecer, bos fiyat "undefined" olmaz', () => {
  const k = karar(); k.menu.kalemler[0].p = undefined;
  const v = kayitKur(k); assert.equal(v.v5.menu.fiyatsiz, true); assert.equal(v.v5.menu.items.length, 6); assert.ok(v.v5.menu.items.every((x) => x.p === ''));
  const f = kayitKur({ ...karar(), menu: { ...karar().menu, fiyatsiz: undefined, kalemler: kalemler().map((x) => ({ ...x, p: '€5' })) } }); assert.equal(f.v5.menu.fiyatsiz, undefined);
});

test('fiyatsizMenuMetni: menu sayfasinin ozgun satirlari (gezinti ve ana sayfa satirlari atilir, HTML varliklari cozulur); menu adresi olmayan ya da az satirli sayfa null', () => {
  const d = tmp('fz-');
  try {
    const nav = 'ANASAYFA\nHAKKIMIZDA\nMENÜ\nİLETİŞİM';
    const menu = ['Izgara K&ouml;fte', 'Mercimek &ccedil;orbası', 'Adana kebap', 'Lahmacun', 'Pide çeşitleri', 'Künefe', 'Sütlaç', 'Ayran', 'Şalgam', 'Çay'];
    fs.writeFileSync(path.join(d, '_home.txt'), `${nav}\nHoş geldiniz\n`);
    fs.writeFileSync(path.join(d, '_sayfalar.txt'), `## https://ornek.example/menu\n${nav}\n${menu.join('\n')}\nTelif Hakkı Saklıdır\n\n## https://ornek.example/hakkimizda\n${nav}\nTelif Hakkı Saklıdır\nKuruluş hikayemiz\n`);
    const r = fiyatsizMenuMetni(d); assert.ok(r, 'menu sayfasi bulundu'); assert.deepEqual(r.urls, ['https://ornek.example/menu']);
    assert.match(r.metin, /Izgara Köfte/); assert.match(r.metin, /Mercimek çorbası/); assert.doesNotMatch(r.metin, /ANASAYFA|HAKKIMIZDA|&ouml;/); assert.doesNotMatch(r.metin, /Telif/);
    // menu adresi yok -> null
    fs.writeFileSync(path.join(d, '_sayfalar.txt'), `## https://ornek.example/hakkimizda\n${menu.join('\n')}\n`); assert.equal(fiyatsizMenuMetni(d), null);
    // az satir -> null
    fs.writeFileSync(path.join(d, '_sayfalar.txt'), `## https://ornek.example/menu\n${menu.slice(0, 4).join('\n')}\n`); assert.equal(fiyatsizMenuMetni(d), null);
    // fiyatli satirlar fiyatsiz kaynak sayilmaz
    fs.writeFileSync(path.join(d, '_sayfalar.txt'), `## https://ornek.example/menu\n${menu.map((x) => `${x} 120 TL`).join('\n')}\n`); assert.equal(fiyatsizMenuMetni(d), null);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('yenidenHazirlik: yalniz "kaynak bulunamadi" nedeniyle eski surumde elenmis restoran bir kez yeniden hazirliktan gecer; baska neden, yasak ve yeni surum gecmez', () => {
  const k = (reasons, extra = {}) => ({ status: 'elendi', sektor: 'restoran', onKapiSurum: 2, reasons, ...extra });
  const MENU = 'fiyatlı menü kaynağı yok ya da robots.txt izin vermiyor (kaynak bulunamadı)';
  assert.equal(yenidenHazirlik(k([MENU])), true);
  assert.equal(yenidenHazirlik(k([MENU], { onKapiSurum: undefined })), true);
  assert.equal(yenidenHazirlik(k([MENU], { onKapiSurum: 3 })), false, 'yeni surumde elenen nihai');
  assert.equal(yenidenHazirlik(k(['fiyatlı menü kaynağı yok ya da robots.txt izin vermiyor (siparis-sitesi: yasak)'])), false, 'robots yasagi: yeniden denenmez');
  assert.equal(yenidenHazirlik(k([MENU, 'telefon yok'])), false);
  assert.equal(yenidenHazirlik(k(['logo yok (sitenin kendi logo dosyası bulunamadı)'])), false);
  assert.equal(yenidenHazirlik(k([MENU], { sektor: 'konaklama' })), false);
  // eski kural aynen: surum 1 + saat/adres nedeni
  assert.equal(yenidenHazirlik(k(['adres yok'], { onKapiSurum: 1 })), true); assert.equal(yenidenHazirlik(k(['adres yok'])), false, 'surum 2 saat/adres nedeni yeniden denenmez');
  const d = tmp('sr-'); try { const f = path.join(d, 'kapi.json'); fs.writeFileSync(f, JSON.stringify(k([MENU]))); assert.equal(kapiBitti(f), false, 'yeniden uretime girer'); fs.writeFileSync(f, JSON.stringify(k([MENU], { onKapiSurum: 3 }))); assert.equal(kapiBitti(f), true); } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('fiyatVarMi: fiyatsiz sayfa mailde fiyat sozu aldirmaz', () => {
  assert.equal(fiyatVarMi({ sektor: 'restoran', menuItems: 8 }), true);
  assert.equal(fiyatVarMi({ sektor: 'restoran', menuItems: 8, fiyatsiz: true }), false);
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

test('tam uretim (sentetik): fiyatsiz menu sayfada yemek adi ve aciklamasiyla durur, fiyat dugumu ve para birimi yok; menuItems adli kalem; taslak notu "fiyat" demez', async () => {
  const veri = tmp('fzv-'); const out = tmp('fzo-');
  try {
    const { heroDosyalari } = await import('../lib/hero-sec.mjs'); const { uretV5, pageDirV5 } = await import('../uret-v5.mjs');
    const kos = async (slug, k) => {
      const R = await fixture(veri, slug);
      fs.writeFileSync(path.join(veri, slug, 'icerik.json'), JSON.stringify(kayitKur(k)));
      await heroDosyalari({ ...R, slug }, { dir: path.join(veri, slug), id: '01', getir: null, adaylar: [{ id: '01', puan: 50, w: 2400, h: 1600 }], inceleme: { inceleyen: 'icerik-turu', gerekce: 'fixture' } });
      const r = await uretV5(slug, { veri, out, log: () => {} }); assert.equal(r.status, 'uretildi', JSON.stringify(r.reasons || (r.report && r.report.warn)));
      return { r, html: fs.readFileSync(path.join(out, pageDirV5(slug), 'index.html'), 'utf8') };
    };
    const { r, html } = await kos('test-fiyatsiz-ie0001', karar());
    const g = gorunen(html);
    assert.equal(r.report.menuItems, 6); assert.equal(r.report.fiyatsiz, true);
    assert.match(g, />Charcoal chicken</); assert.match(g, />Half bird with herbs</); assert.match(g, />Olive oil cake</);
    assert.doesNotMatch(g, /class="pr"/, 'fiyat dugumu yok'); assert.doesNotMatch(g, /[€£$₺]\s?\d/, 'para birimi yok');
    assert.doesNotMatch(g, /Text, prices and photos/); assert.match(g, /Text and photos come from the venue/);
    // fiyatli menu degismedi
    const fk = karar(); delete fk.menu.fiyatsiz; fk.menu.kalemler = fk.menu.kalemler.map((x, i) => ({ ...x, p: `€${10 + i}` })); fk.menu.kaynak = { tur: 'sayfa', url: 'https://test-kitchen.example/menu', dosya: 'menu-kaynak/sayfa.txt' };
    const { r: r2, html: h2 } = await kos('test-fiyatli-ie0002', fk); assert.equal(r2.report.menuItems, 6); assert.equal(r2.report.fiyatsiz, false); assert.match(gorunen(h2), /class="pr">€10</); assert.match(gorunen(h2), /Text, prices and photos/);
  } finally { fs.rmSync(veri, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); }
});
