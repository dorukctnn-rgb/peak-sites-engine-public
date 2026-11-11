// Guzellik sektoru testleri: randevu motoru, hizmet listesi (menu cikaricisiyla), model, kapi kurali, salon olmayan lead'lerin elenmesi, sayfa HTML'i.  Ag yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randevuMotoru, gomuluMotor, model, kapiKural, menuSuz, MENU_SOZCUK, ETIKET } from '../../uyarla/sektor/guzellik.mjs';
import { profil } from '../../uyarla/sektor/index.mjs';
import { menuLinks, pageIsMenu, menuFromText } from '../../uyarla/lib/menu.mjs';
import { elenme } from '../../lead/osm.mjs';
import { sayfaHtml } from '../../uyarla/lib/sayfa.mjs';
import { yasakVar } from '../../uyarla/lib/sozluk.mjs';

test('profil: guzellik ve konaklama bulunur, restoran profilsiz', () => {
  assert.equal(profil({ sektor: 'guzellik' }).AD, 'guzellik');
  assert.equal(profil({ sektor: 'konaklama' }).AD, 'konaklama');
  assert.equal(profil({ sektor: undefined }), null);
});

test('randevu motoru: gercek motor kazanir, sosyal medya olmaz, gomulu motor taninir', () => {
  const m = randevuMotoru([{ href: 'https://www.instagram.com/x', text: 'Book' }, { href: 'https://www.fresha.com/a/rose-hair', text: 'Book now' }], 'https://rose.ie/');
  assert.equal(m.motor, 'fresha.com'); assert.equal(m.external, true);
  const own = randevuMotoru([{ href: '/book-appointment', text: 'Book an appointment' }], 'https://rose.ie/');
  assert.equal(own.external, false); assert.match(own.url, /book-appointment/);
  assert.equal(randevuMotoru([{ href: '/about', text: 'About' }], 'https://rose.ie/'), null);
  assert.equal(gomuluMotor('<iframe src="https://widget.phorest.com/x"></iframe>'), 'widget.phorest.com');
  assert.equal(gomuluMotor('<script src="https://rose.ie/app.js"></script>'), null);
});

test('hizmet sayfasi baglantilari: prices/services/treatments menu sayilir, blog ve gift voucher sayilmaz', () => {
  const links = [{ href: '/prices', text: 'Price List' }, { href: '/treatments', text: 'Treatments' }, { href: '/blog/prices-up', text: 'Blog' }, { href: '/gift-vouchers', text: 'Gift vouchers' }, { href: '/contact', text: 'Contact' }, { href: 'https://other.ie/prices', text: 'Prices' }];
  const out = menuLinks(links, 'https://rose.ie/', MENU_SOZCUK).map((x) => new URL(x.url).pathname);
  assert.ok(out.includes('/prices') && out.includes('/treatments'));
  assert.ok(!out.includes('/blog/prices-up') && !out.includes('/gift-vouchers') && !out.includes('/contact'));
  assert.ok(!menuLinks([{ href: '/prices', text: 'Prices' }], 'https://rose.ie/').length, 'varsayilan (restoran) sozcuk fiyat listesini menu saymaz');
  assert.equal(pageIsMenu('https://rose.ie/prices', '<title>Salon prices</title>', MENU_SOZCUK), true);
  assert.equal(pageIsMenu('https://rose.ie/about', '<title>About us</title><h1>Welcome</h1>', MENU_SOZCUK), false);
});

test('fiyat listesi: ad + fiyat satirlari kategori basliklariyla okunur, "from" adin sonunda kalmaz', () => {
  const html = `<h2>Cuts</h2><p>Ladies Cut & Blow Dry from €45</p><p>Gents Cut €22</p><p>Children Cut €15</p><h2>Colour</h2><p>Full Head Colour from €70</p><p>Half Head Highlights €85</p>`;
  const it = menuFromText(html, { lang: 'en' });
  assert.ok(it.length >= 4, `kalem sayisi ${it.length}`);
  assert.ok(it.every((x) => !/\bfrom$/i.test(x.n)), it.map((x) => x.n).join(' | '));
  assert.ok(it.some((x) => x.cat === 'Colour'));
});

test('hizmet suzgeci: yalniz para birimi simgeli fiyatlar; adres/telefon/saat parcalari hizmet degil', () => {
  const s = menuSuz([{ n: 'Ladies Cut', p: '€45' }, { n: 'Donnybrook 4', p: '4', cat: 'CONTACTS' }, { n: 'Opening hours', p: '€9' }, { n: 'Gents Cut', p: '£22' }, { n: '12', p: '€5' }, { n: 'Full Set Gel Nails', p: '$60' }]);
  assert.deepEqual(s.map((x) => x.n), ['Ladies Cut', 'Gents Cut', 'Full Set Gel Nails']);
  assert.deepEqual(menuSuz(null), []);
});

test('model: formda yalniz sitedeki kalem adlari, motor adresi, saat/oda alanlari bos', () => {
  const R = { guzellik: { motor: { url: 'https://www.fresha.com/a/rose', external: true, motor: 'fresha.com' } }, menu: { items: [{ n: 'Ladies Cut', p: '€45' }, { n: 'Gents Cut', p: '€22' }, { n: 'Ladies Cut', p: '€45' }, { n: 'Nothing priced', p: '' }] } };
  const m = model(R, { region: 'IE' });
  assert.deepEqual(m.hizmetler, ['Ladies Cut', 'Gents Cut']);
  assert.equal(m.bookUrl, 'https://www.fresha.com/a/rose'); assert.equal(m.bookHost, 'fresha.com');
  assert.deepEqual(m.odalar, []); assert.equal(m.fromP, null);
  const own = model({ guzellik: { motor: { url: 'https://rose.ie/book', external: false } }, menu: { items: [] } }, {});
  assert.equal(own.bookHost, null); assert.equal(own.bookUrl, 'https://rose.ie/book');
});

test('kapi kurali: ne hizmet listesi ne randevu baglantisi varsa gozden gecir', () => {
  assert.equal(kapiKural({ guzellik: { motor: null }, menu: { items: [] } }, { menuItems: 0 }).why.length, 1);
  assert.equal(kapiKural({ guzellik: { motor: { url: 'https://x.ie/book' } }, menu: { items: [] } }, { menuItems: 0 }).why.length, 0);
  assert.equal(kapiKural({ guzellik: { motor: null }, menu: { items: [] } }, { menuItems: 0, menuLink: 'https://x.ie/prices' }).why.length, 0);
  const iyi = kapiKural({ guzellik: { motor: { url: 'https://x.ie/book' } } }, { menuItems: 9 });
  assert.deepEqual(iyi, { why: [], warn: [] });
  assert.equal(kapiKural({ guzellik: { motor: null } }, { menuItems: 9 }).warn.length, 1);
});

test('lead eleme: malzeme, okul, solaryum, klinik ve zincir salon sayilmaz; sade salon kalir', () => {
  const e = (n) => elenme({}, n, 'https://x.ie', 'guzellik');
  for (const n of ["O'Reilly's Hair & Beauty Supplies", 'Kreative Salon Supplies', 'The Hairdressing Academy', 'The Sun Bar', 'Ailish Laser Skin Clinic']) assert.ok(e(n), n);
  for (const n of ['Caroline Hair', 'Silk Beauty Spa', '3B’s Barber Shop & Hair Salon']) assert.equal(e(n), null, n);
  assert.ok(elenme({}, 'Toni & Guy Cork', 'https://x.ie', 'guzellik'));
  // ayni ad konaklamada elenmez (kural yalniz guzellige ozel)
  assert.equal(elenme({}, 'Clinic View Guest House', 'https://x.ie', 'konaklama'), null);
});

test('sayfa: hizmet formu hizmet adlarini sunar; motor varsa ana eylem ona gider ve form yoktur; yasak kisaltma ve restoran sozcugu yok', () => {
  const pal = { t: { bg: '#fff', bg2: '#f5f5f5', ink: '#111', muted: '#555', line: '#ddd', accent: '#a33', accentInk: '#fff', accentHi: '#b44', accentText: '#a33', accent2: '#c66', accent2Text: '#a33', deep: '#222', onDeep: '#fff', shade: '#000', heroInk: '#fff', heroAccent: '#fff' } };
  const photo = (i) => ({ id: `0${i}`, name: `p0${i}`, w: 1600, h: 1000, focus: { x: 0.5, y: 0.5 }, alt: '' });
  const base = (kon) => ({
    lang: 'en', name: 'Rose Hair', cityLabel: 'Cork', slogan: { parts: [{ t: 'Hair in Cork', em: false }], text: 'Hair in Cork' }, variant: 'bolme', fx: 'firca', dark: false, palette: pal, font: { display: { family: 'Inter', via: 'x', weight: 600 }, text: { family: 'Inter', via: 'x' } }, fontFaceCss: '', fontPreload: [],
    caps: false, ls: 0, emStyle: 'normal', size: {}, btnR: '8px', cardR: '10px', shadeA: 0.9, shadeM: 0.7, kb: { step: 7, total: 21, ov: 1.4 }, map: { bg: '#eee', road: '#ddd', fine: '#eee' }, fallback: { display: 'serif', text: 'sans-serif' },
    logo: null, hero: [photo(1), photo(2), photo(3)], gallery: [photo(1), photo(2), photo(3)], menuVis: [], signature: [], story: null, bookPic: photo(2), eyebrow: 'Hair salon · Cork', lede: '', stats: [], hoursOk: false, hoursTable: null, hoursSummary: [], hoursNote: null, week: null, tz: null, statusOk: false,
    slots: null, firstSlots: ['10:00', '11:00'], address: 'Main Street, Cork', phone: '021 123 4567', tel: '+353211234567', mapsUrl: 'https://maps.example/x', social: {}, reservationHost: null, menu: { groups: [{ name: 'Cuts', items: [{ n: 'Ladies Cut', p: '€45', d: '' }, { n: 'Gents Cut', p: '€22', d: '' }, { n: 'Kids Cut', p: '€15', d: '' }] }], link: null }, menuCards: [], h12: false,
    sektor: 'guzellik', etiket: ETIKET, kon,
  });
  const form = sayfaHtml(base({ odalar: [], olanak: [], giris: {}, fromP: null, hizmetler: ['Ladies Cut', 'Gents Cut'], bookUrl: null, bookHost: null, ota: false }));
  assert.match(form, /<form id="rez"/); assert.match(form, /name="kisi"[^>]*value="Ladies Cut"[^>]*checked/); assert.match(form, /Book an appointment/);
  assert.match(form, /Services and prices/);
  const direkt = sayfaHtml(base({ odalar: [], olanak: [], giris: {}, fromP: null, hizmetler: ['Ladies Cut'], bookUrl: 'https://www.fresha.com/a/rose', bookHost: 'fresha.com', ota: false }));
  assert.doesNotMatch(direkt, /<form id="rez"/); assert.match(direkt, /href="https:\/\/www\.fresha\.com\/a\/rose"/); assert.match(direkt, /See available times/);
  for (const h of [form, direkt]) { assert.ok(!yasakVar('kisaltma', h.replace(/<script[\s\S]*?<\/script>/g, ''))); assert.doesNotMatch(h.replace(/<script[\s\S]*?<\/script>/g, ''), /Book a table|Dishes and prices|From the kitchen|\bguests?\b/i); }
});
