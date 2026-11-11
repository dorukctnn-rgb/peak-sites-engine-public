// Lead bulucu testleri: OSM suzgeci, kotu site puani, e-posta bulma ve hukuk engelleri.  Ag yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sorgu, leadOf, elenme } from '../osm.mjs';
import { htmlPuan, tarayiciPuan, topla, ESIK } from '../puan.mjs';
import { adresler, cfCoz, enIyi, sirketKaniti, RET_NOTU, epostaBul, SERBEST, alanKoku } from '../eposta.mjs';
import { taraBir } from '../tara.mjs';
import { ULKELER, YASAK_ULKE, SEKTORLER } from '../sektorler.mjs';

test('hedef ulkeler: AU, GB, IE, NZ + TR (Doruk 11 Kas, yalniz restoran, kuyruk anahtarli); US, CA yok', () => {
  assert.deepEqual(Object.keys(ULKELER).sort(), ['AU', 'GB', 'IE', 'NZ', 'TR']);
  for (const k of ['US', 'CA']) { assert.ok(YASAK_ULKE.has(k)); assert.equal(ULKELER[k], undefined); }
  assert.ok(!YASAK_ULKE.has('TR'));
  assert.deepEqual(ULKELER.TR.yalnizSektor, ['restoran']);
  assert.equal(ULKELER.TR.kuyrukAnahtari, 'TR_KUYRUK');
  assert.equal(ULKELER.TR.dil, 'tr');
});

test('osm sorgusu: website etiketi sart, ulke alani ISO ile, tourism=hotel hic yok', () => {
  const q = sorgu('IE', 'konaklama');
  assert.match(q, /ISO3166-1"="IE"/);
  assert.match(q, /\["website"\]/);
  assert.doesNotMatch(q, /hotel/);
  assert.match(sorgu('NZ', 'guzellik', { alan: 'Otago' }), /Otago/);
  assert.throws(() => sorgu('IE', 'yok-sektor'));
});

const el = (tags, id = 1) => ({ type: 'node', id, lat: 1, lon: 2, tags });
test('leadOf: buyuk otel, zincir, buyuk oda sayisi ve kapali isletme elenir; kucuk pansiyon kalir', () => {
  const ok = leadOf(el({ name: 'Rose Cottage B&B', tourism: 'guest_house', website: 'rose-cottage.test', 'addr:city': 'Cork' }), 'IE', 'konaklama');
  assert.equal(ok.elendi, null); assert.equal(ok.tur, 'bed and breakfast'); assert.equal(ok.website, 'http://rose-cottage.test/'); assert.equal(ok.id, 'IE-n1');
  assert.match(leadOf(el({ name: 'Grand Hotel', tourism: 'hotel', website: 'https://grand.ie' }), 'IE', 'konaklama').elendi, /otel/);
  assert.match(leadOf(el({ name: 'Big House', tourism: 'guest_house', rooms: '40', website: 'https://big.ie' }), 'IE', 'konaklama').elendi, /buyuk/);
  assert.match(leadOf(el({ name: 'Premier Inn Cork', tourism: 'guest_house', website: 'https://premierinn.com' }), 'GB', 'konaklama').elendi, /zincir/);
  assert.match(leadOf(el({ name: 'Brand Stay', tourism: 'guest_house', brand: 'X', website: 'https://x.ie' }), 'IE', 'konaklama').elendi, /zincir/);
  assert.match(leadOf(el({ name: 'Old Inn', tourism: 'guest_house', 'disused:tourism': 'guest_house', website: 'https://oldsite.test' }), 'IE', 'konaklama').elendi, /kapali/);
  assert.equal(leadOf(el({ name: 'No Site', tourism: 'guest_house' }), 'IE', 'konaklama'), null);
  assert.equal(leadOf(el({ name: 'Fb Only', tourism: 'guest_house', website: 'https://www.facebook.com/x' }), 'IE', 'konaklama'), null);
});

test('elenme: zincir kuaforler ve spor salonlari', () => {
  assert.match(elenme({ shop: 'hairdresser' }, 'Toni & Guy Dublin', 'https://toniguy.com', 'guzellik'), /zincir/);
  assert.equal(elenme({ shop: 'hairdresser' }, 'Mary Cuts', 'https://marycuts.ie', 'guzellik'), null);
});

test('puan: eski ve bos bir site kotu, iyi bir site degil', () => {
  const kotu = htmlPuan({ html: '<html><body><font>Welcome</font><p>© 2014</p><img src=a.jpg></body></html>'.padEnd(700, ' '), finalUrl: 'http://x.ie/', sektor: 'konaklama', ms: 100 });
  const keys = kotu.map((b) => b.k);
  for (const k of ['https-yok', 'viewport-yok', 'telif-eski', 'eski-teknoloji', 'rezervasyon-yok', 'fiyat-yok', 'gorsel-az']) assert.ok(keys.includes(k), k);
  assert.equal(topla(kotu).kotu, true);
  const iyi = htmlPuan({ html: `<html><head><meta name="viewport" content="width=device-width"></head><body>Rooms from €120 per night <a href="https://app.eviivo.com/x">Book now</a>${'<img src=a.jpg>'.repeat(5)}© ${new Date().getUTCFullYear()}</body></html>`, finalUrl: 'https://x.ie/', sektor: 'konaklama' });
  assert.equal(topla(iyi).kotu, false);
  assert.ok(ESIK >= 3);
});

test('tarayici puani: yatay tasma ve kirik gorsel', () => {
  const b = tarayiciPuan({ tasma: true, scrollW: 900, kirik: 3, yaziMedyan: 11, yukMs: 9000 });
  assert.deepEqual(b.map((x) => x.k).sort(), ['kirik-gorsel', 'kucuk-yazi', 'telefonda-tasma', 'yavas']);
  assert.deepEqual(tarayiciPuan(null), []);
});

test('e-posta: mailto, cloudflare korumasi, gizlenmis ve sahte adresler', () => {
  const enc = (s, k = 0x42) => k.toString(16).padStart(2, '0') + [...s].map((c) => (c.charCodeAt(0) ^ k).toString(16).padStart(2, '0')).join('');
  assert.equal(cfCoz(enc('stay@anchor-house.test')), 'stay@anchor-house.test');
  const l = adresler(`<a href="mailto:Stay@anchor-house.test?subject=x">x</a> bookings [at] anchor-house.test <span data-cfemail="${enc('hello@anchor-house.test')}"></span> <img src="logo@2x.png"> noreply@anchor-house.test you@example.com`);
  assert.ok(l.includes('stay@anchor-house.test')); assert.ok(l.includes('hello@anchor-house.test'));
  assert.ok(!l.some((e) => /noreply|example|2x\.png/.test(e)));
});

test('e-posta secimi: kendi alan adi ve rol adresi once; IE/GB serbest posta alinmaz', () => {
  assert.equal(enIyi(['joe@gmail.com', 'info@anchor-house.test', 'mary@anchor-house.test'], 'www.anchor-house.test', 'IE'), 'info@anchor-house.test');
  assert.equal(enIyi(['joe@gmail.com'], 'www.anchor-house.test', 'IE'), null);
  assert.equal(enIyi(['joe@gmail.com'], 'www.anchor.com.au', 'AU'), 'joe@gmail.com');
  assert.ok(SERBEST.test('a@hotmail.co.uk')); assert.ok(!SERBEST.test('a@anchor-house.test'));
  assert.equal(alanKoku('www.rose.co.nz'), 'rose.co.nz'); assert.equal(alanKoku('mail.rose.ie'), 'rose.ie');
});

test('GB sirket kaniti ve ret notu', () => {
  assert.equal(sirketKaniti('© Seaview Lodge Ltd. All rights'), 'Seaview Lodge Ltd');
  assert.equal(sirketKaniti('Limited time offer for guests'), null);
  assert.match(sirketKaniti('Company No: 01234567'), /01234567/);
  assert.match(sirketKaniti('Registered in England and Wales'), /england/i);
  assert.ok(RET_NOTU.test('No unsolicited marketing emails please')); assert.ok(!RET_NOTU.test('We love guests'));
});

const polite = (pages) => ({ get: async (u) => (pages[u] ? { ok: true, type: 'text/html', text: pages[u], finalUrl: u } : { ok: false, why: 'yok' }) });
test('epostaBul: iletisim sayfasindan adres, ret notu, GB sirket sarti, eposta yok', async () => {
  const home = '<a href="/contact">Contact</a>';
  const r = await epostaBul({ html: home, finalUrl: 'https://anchor-house.test/', ulke: 'IE', polite: polite({ 'https://anchor-house.test/contact': '<a href="mailto:stay@anchor-house.test">mail</a>' }) });
  assert.equal(r.email, 'stay@anchor-house.test'); assert.equal(r.engel, undefined);
  const g = await epostaBul({ html: '<a href="mailto:info@lodge-house.test">m</a>', finalUrl: 'https://lodge-house.test/', ulke: 'GB', polite: polite({}) });
  assert.equal(g.engel, 'sirket-kaniti-yok');
  const g2 = await epostaBul({ html: '<a href="mailto:info@lodge-house.test">m</a> Lodge Holdings Ltd', finalUrl: 'https://lodge-house.test/', ulke: 'GB', polite: polite({}) });
  assert.equal(g2.engel, undefined); assert.equal(g2.sirket, 'Lodge Holdings Ltd');
  const n = await epostaBul({ html: '<p>hello</p>', finalUrl: 'https://x.ie/', ulke: 'IE', polite: polite({}) });
  assert.equal(n.engel, 'eposta-yok');
  const rn = await epostaBul({ html: '<a href="mailto:info@x.ie">m</a> No unsolicited sales calls', finalUrl: 'https://x.ie/', ulke: 'IE', polite: polite({}) });
  assert.equal(rn.engel, 'ret-notu');
  const osm = await epostaBul({ html: '<p>none</p>', finalUrl: 'https://x.ie/', ulke: 'IE', polite: polite({}), osmEmail: 'osm@x.ie' });
  assert.equal(osm.email, null, 'OSM e-postasi tek basina alinmaz');
});

test('taraBir: kotu site + e-posta = aday; iyi site; erisilemeyen; park', async () => {
  const kotuHtml = `<html><body><font>Welcome to our B&B</font> © 2012 <a href="mailto:info@oldsite.test">mail</a><img src=a.jpg></body></html>`.padEnd(800, ' ');
  const mk = (html) => ({ get: async () => ({ ok: true, type: 'text/html', text: html, finalUrl: 'http://oldsite.test/', buf: Buffer.from(html) }) });
  const lead = { id: 'IE-n9', name: 'Old B&B', website: 'http://oldsite.test/', ulke: 'IE', sektor: 'konaklama' };
  const a = await taraBir(lead, { polite: mk(kotuHtml) });
  assert.equal(a.durum, 'aday'); assert.equal(a.email, 'info@oldsite.test'); assert.ok(a.puan >= ESIK);
  const iyi = `<html><head><meta name="viewport" content="width=device-width"></head><body>Rooms from €120 per night <a href="https://app.eviivo.com/x">Book now</a>${'<img src=a.jpg>'.repeat(5)}© ${new Date().getUTCFullYear()} <a href="mailto:info@oldsite.test">m</a></body></html>`.padEnd(800, ' ');
  assert.equal((await taraBir(lead, { polite: mk(iyi) })).durum, 'iyi-site');
  assert.equal((await taraBir(lead, { polite: { get: async () => ({ ok: false, why: 'robots:disallow' }) } })).durum, 'erisilemedi');
  assert.equal((await taraBir(lead, { polite: mk('<html>This domain is for sale</html>'.padEnd(800, ' ')) })).neden, 'park-ya-da-bos');
  assert.equal((await taraBir({ ...lead, elendi: 'zincir' }, { polite: mk('') })).durum, 'elendi');
});

test('sektor tanimlari: her sektorde osm filtresi, rezervasyon deseni ve anahtar kelimeler var', () => {
  for (const [k, S] of Object.entries(SEKTORLER)) { assert.ok(S.osm.length, k); assert.ok(S.rezervasyon instanceof RegExp, k); assert.ok(S.anahtar.fiyat instanceof RegExp, k); assert.equal(typeof S.tur({}), 'string', k); }
});
