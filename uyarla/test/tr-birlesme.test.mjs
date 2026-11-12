// TR pazari + cikarici guclendirme (#2) + pizza kart fotografi (#3, #4) birlesmesi (12 Kas 2026): iki tarafin davranisi birlikte korunur.  Ag yok.
// ESKI sira ayni: once siparis-tr (dongusuz import), sonra siparis.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eylemAdaylariTr, platformHepsi, TR_PLATFORMLAR } from '../lib/siparis-tr.mjs';
import { eylemAdaylari, saglayiciOf, platformOf } from '../lib/siparis.mjs';
import { hazirlikKapisi } from '../restoran-hazirla.mjs';
import { sharp } from '../lib/gorsel.mjs';
import { kayitKur } from '../restoran-icerik.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('siparis: TR saglayicilari ortak listede (iframe/betik de bulunur); WhatsApp hatti yalniz TR yolunda eylem; yurt disi yolu degismez', () => {
  const base = 'https://kaleici.com.tr/';
  assert.deepEqual(saglayiciOf('https://www.yemeksepeti.com/restaurant/ab12/kaleici-meyhane'), { ad: 'Yemeksepeti', tur: 'siparis' });
  assert.equal(platformOf('https://www.getir.com/yemek/restoran/abc'), 'Getir Yemek');
  assert.equal(platformHepsi('https://wa.me/905321112233'), 'WhatsApp'); assert.equal(platformOf('https://wa.me/905321112233'), null, 'WhatsApp ortak listede degil');
  assert.deepEqual(TR_PLATFORMLAR.map((p) => p[0]), ['Yemeksepeti', 'Getir Yemek', 'Trendyol Yemek', 'Migros Yemek', 'WhatsApp']);
  const ys = [{ href: 'https://www.yemeksepeti.com/restaurant/ab12/kaleici-meyhane', text: 'Sipariş ver' }];
  const e = eylemAdaylariTr({ links: ys, html: '', base }); assert.equal(e.siparis.platform, 'Yemeksepeti'); assert.equal(e.siparis.kanit, 'baglanti');
  const wa = [{ href: 'https://wa.me/905321112233', text: 'WhatsApp' }];
  assert.equal(eylemAdaylariTr({ links: wa, html: '', base }).siparis.platform, 'WhatsApp');
  assert.equal(eylemAdaylari({ links: wa, html: '', base: 'https://x.ie/' }).siparis, null, 'yurt disinda wa.me siparis baglantisi sayilmaz');
  // baglanti degil, gomulu pencere: ortak tarama TR saglayicisini da bulur; TR yolu da ayni sonucu verir
  const html = '<div><iframe src="https://www.yemeksepeti.com/restaurant/zz9/kaleici"></iframe></div>';
  assert.equal(eylemAdaylari({ links: [], html, base }).siparis.platform, 'Yemeksepeti'); assert.equal(eylemAdaylari({ links: [], html, base }).siparis.kanit, 'iframe');
  assert.equal(eylemAdaylariTr({ links: [], html, base }).siparis.kanit, 'iframe');
  // yurt disi saglayicisi TR yolunda da bulunur (yedek)
  assert.equal(eylemAdaylariTr({ links: [{ href: 'https://deliveroo.co.uk/menu/london/x', text: 'Order' }], html: '', base }).siparis.platform, 'deliveroo');
  assert.equal(eylemAdaylariTr({ links: [], html: '', base }).siparis, null);
});

// ---- hazirlik kapisi (TR + yurt disi) ----
const trR = () => ({
  erisim: { ok: true }, lead: { sektor: 'restoran', name: 'Kaleiçi Meyhane', kind: 'restaurant', lang: 'tr', region: 'TR' }, name: { n: 'Kaleiçi Meyhane' },
  address: { text: 'Hesapçı Sokak No: 4, Kaleiçi, Antalya' }, phone: '+90 242 123 45 67', hours: { tableOk: true },
  logo: { orig: { file: 'img/logo-orijinal.png' } }, order: null, reservation: null,
  photos: [1, 2, 3, 4, 5].map((i) => ({ id: `0${i}`, w: 1600, h: 1000, meanS: 0.5, lapVar: 400 })),
});
test('hazirlikKapisi: telefon eylemi (kendi numarasi) TR\'de ve 12 Kas\'tan beri yurt disinda gecer; olu siparis baglantisi telefonla kurtarilmaz; TR ayri rezervasyon sayfasi', () => {
  const dir = tmp('tr-birlesme-'); const lead = { slug: 'kaleici', name: 'Kaleiçi Meyhane', region: 'TR', site: 'https://kaleici.com.tr/' };
  try {
    let k = hazirlikKapisi(trR(), lead, dir); assert.equal(k.elendi, null, JSON.stringify(k.elendi));
    assert.equal(k.eylem.tur, 'telefon'); assert.equal(k.eylem.url, null); assert.ok(k.eksik.some((x) => /^eylem telefon/.test(x)));
    assert.equal(k.eylem.etiket, 'Hemen arayın'); assert.equal(k.eylem.kisa, 'Ara');
    // yurt disi isletmesi (12 Kas 2026, kapi verimi): yalniz telefon da eylemdir; etiket Ingilizce (genel: sablon "Call <numara>" yazar, rezervasyon sozu varsa "Call to book")
    const IE = () => ({ ...trR(), lead: { ...trR().lead, lang: 'en', region: 'IE', name: 'Quay Kitchen' }, name: { n: 'Quay Kitchen' }, address: { text: '12 Quay Street, Galway' }, phone: '+353 91 123 4567' });
    const ie = { slug: 'quay', name: 'Quay Kitchen', region: 'IE', site: 'https://quay.example/' };
    k = hazirlikKapisi(IE(), ie, dir); assert.equal(k.elendi, null, JSON.stringify(k.elendi)); assert.equal(k.eylem.tur, 'telefon'); assert.equal(k.eylem.etiket, null); assert.equal(k.eylem.kisa, 'Call');
    fs.writeFileSync(path.join(dir, '_home.txt'), 'Bookings by phone only. Call us to book a table.');
    k = hazirlikKapisi(IE(), ie, dir); assert.equal(k.eylem.etiket, 'Call to book'); fs.writeFileSync(path.join(dir, '_home.txt'), '');
    // telefon da yoksa eylem yok
    const R0 = IE(); R0.phone = null; k = hazirlikKapisi(R0, ie, dir); assert.match((k.elendi || []).join(' | '), /gerçek sipariş ya da rezervasyon bağlantısı da telefon da yok/);
    // olu siparis baglantisi: kategori sablonlari onu dugme yapardi; telefon yedegi kullanilmaz
    const R3 = trR(); R3.order = { url: 'https://www.yemeksepeti.com/restaurant/olu/x', platform: 'Yemeksepeti', dogrulama: { durum: 'olu' } };
    k = hazirlikKapisi(R3, lead, dir); assert.match(k.elendi.join(' | '), /bağlantı açılmıyor/);
    // canli baglanti telefondan once gelir
    const R4 = trR(); R4.order = { url: 'https://www.yemeksepeti.com/restaurant/ok/x', platform: 'Yemeksepeti', dogrulama: { durum: 'canli' } };
    k = hazirlikKapisi(R4, lead, dir); assert.equal(k.elendi, null); assert.equal(k.eylem.tur, 'siparis'); assert.equal(k.eylem.dogrulama.durum, 'canli');
    // isletmenin kendi sitesindeki ayri rezervasyon sayfasi
    const R5 = trR(); R5.reservation = { url: '/rezervasyon', external: false };
    k = hazirlikKapisi(R5, lead, dir); assert.equal(k.eylem.tur, 'rezervasyon'); assert.equal(k.eylem.url, 'https://kaleici.com.tr/rezervasyon'); assert.equal(k.eylem.platform, 'kendi rezervasyon sayfası');
    // stok / uretilmis kare TR'de de sayilmaz (#2 kurali)
    const R6 = trR(); R6.photos[0].isaretler = { stok: ['adres/alt: unsplash'] }; R6.photos[1].isaretler = { uretilmis: ['metadata: c2pa'] };
    k = hazirlikKapisi(R6, lead, dir); assert.match(k.elendi.join(' | '), /kullanılabilir fotoğraf az \(3; en az 4, 800 px\+; 2 stok, üretilmiş görsel ya da afiş sayılmadı\)/);
    // adres ve telefon cikaricidan gelmediyse sitenin Turkce metninde aranir
    const R7 = trR(); R7.address = null; R7.phone = null; delete R7.lead.osmAdres;
    fs.writeFileSync(path.join(dir, '_home.txt'), 'Hesapçı Sokak No: 4 Kaleiçi\nRezervasyon: 0242 123 45 67\nHer gün 12:00 - 24:00');
    k = hazirlikKapisi(R7, lead, dir); assert.equal(k.elendi, null, JSON.stringify(k.elendi)); assert.ok(k.eksik.includes('adres (metin.txt icinde)') && k.eksik.includes('telefon (metin.txt icinde)'));
    // zincir: Turkce metin (TR) elenir; yurt disi kural TR'de de gecerli
    fs.writeFileSync(path.join(dir, '_home.txt'), 'Bayilik başvurusu için bize yazın'); assert.match(hazirlikKapisi(trR(), lead, dir).elendi[0], /zincir/);
    fs.writeFileSync(path.join(dir, '_home.txt'), 'We have 7 locations across the country'); assert.match(hazirlikKapisi(trR(), lead, dir).elendi[0], /zincir/);
    // TR'de Turkiye adresi hedef disi degil; baska ulke adresi hedef disi
    fs.writeFileSync(path.join(dir, '_home.txt'), '');
    const R8 = trR(); R8.address = { text: 'Hesapçı Sokak No: 4, Antalya, Türkiye' }; assert.equal(hazirlikKapisi(R8, lead, dir).elendi, null);
    const R9 = trR(); R9.address = { text: '12 Hauptstrasse, Berlin, Germany' }; assert.match(hazirlikKapisi(R9, lead, dir).elendi[0], /hedef ulke/);
    // ayni Turkiye adresi yurt disi islemesinde hedef disi (yasak yer adi kurali)
    assert.match(hazirlikKapisi(R8, { ...lead, region: 'IE' }, dir).elendi.join(' | '), /hedef ulke/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- TR pizza sayfasi: kart fotografi (#3/#4) Turkce arayuzle ----
async function trPizzaci(veri, slug) {
  const R = JSON.parse(fs.readFileSync(path.join(HERE, 'fixture', 'cikarici-sablon.json'), 'utf8'));
  R.slug = slug; R.lead.name = 'Test Pizzeria'; R.lead.lang = 'tr'; R.lead.region = 'TR'; R.lead.city = 'Antalya'; if (R.name) R.name.n = 'Test Pizzeria';
  const dir = path.join(veri, slug); fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  const kare = async (file, w, h, i) => { const b = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 90 + i * 20, g: 50 + i * 9, b: 30 }, noise: { type: 'gaussian', mean: 110, sigma: 40 } } }).jpeg({ quality: 70 }).toBuffer(); fs.writeFileSync(path.join(dir, file), b); };
  for (const [i, p] of R.photos.entries()) { await kare(p.file, 1000, 667, i); p.w = 1000; p.h = 667; }
  const file = 'img/o21.jpg'; await kare(file, 1600, 1067, 21);
  R.photos.push({ id: '21', file, url: 'https://test-kitchen.example/wp-content/uploads/tavuklu-pizza-scaled.jpg', via: 'elle', w: 1600, h: 1067, alt: '', ozgun: true });
  const logo = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><circle cx="150" cy="150" r="110" fill="#c0392b"/><rect x="290" y="110" width="260" height="80" fill="#c0392b"/></svg>')).png().toBuffer();
  fs.writeFileSync(path.join(dir, R.logo.orig.file), logo); fs.writeFileSync(path.join(dir, R.logo.file), await sharp(logo).webp().toBuffer());
  R.logo.orig.sha256 = crypto.createHash('sha256').update(logo).digest('hex'); R.logo.orig.bytes = logo.length;
  fs.writeFileSync(path.join(dir, 'cikarici.json'), JSON.stringify(R, null, 1));
}
const trKarar = () => ({
  tur: 'icerik', karar: 'icerik', inceleyen: 'icerik-turu', sablon: 'pizza', neden: 'fixture', dil: 'tr',
  hero: { id: '01', gerekce: 'fixture frame, sharp, no text', reddedilen: [] },
  menu: { kaynak: { tur: 'sayfa', url: 'https://test-kitchen.example/menu', dosya: 'menu-kaynak/sayfa.txt' }, kalemler: [{ n: 'Tavuklu', d: 'Tavuk, mozzarella, fesleğen', p: '₺320', cat: 'Pizzalar' }, { n: 'Kuzu şiş', d: 'Kuzu, soğan, domates', p: '₺410', cat: 'Pizzalar' }, { n: 'Pide (W)', d: 'Zeytinyağı, biberiye', p: '₺120', cat: 'Pizzalar' }, { n: 'Kalzone (V)', d: 'Mantar, mozzarella', p: '₺290', cat: 'Pizzalar' }, { n: 'Patates', p: '₺90', cat: 'Yanlar' }, { n: 'Zeytinyağlı kek', p: '₺140', cat: 'Tatlılar' }] },
  saat: { satirlar: ['Her gün 12:00 - 22:00'], kaynak: 'fixture' }, eylem: { tur: 'telefon' },
  icerik: { kategori: 'pizza', sec: 0, aday: [{ text: 'Odun ateşinde *pişer.*', kaynak: 'fixture' }], kareler: { ziyaret: ['05'] }, ustYazi: 'Pizza, Antalya', lede: 'Hamurumuzu her sabah kendimiz yoğururuz.', kategoriEk: { adres: 'Hesapçı Sokak No: 4, Antalya', telefon: '+90 242 123 45 67' }, slider: { h2: 'Bir pizza seçin', grup: 'Pizzalar', secim: ['Tavuklu', 'Kuzu şiş', 'Pide (W)', 'Kalzone (V)'] } },
  gozlem: { metin: 'fixture', kanit: 'once-390.jpg' },
});
test('TR pizza sayfasi: kart fotografi (kendi karesi) + Turkce kart metinleri, rozet basliklari ve eylem; yurt disi metni karismaz', async () => {
  const veri = tmp('trb-veri-'); const out = tmp('trb-out-'); const slug = 'test-pizzeria-tr0001';
  try {
    const { uretKategori, pageDir } = await import('../uret-kategori.mjs'); const { tamamla } = await import('../kategori-tamamla.mjs');
    await trPizzaci(veri, slug);
    fs.writeFileSync(path.join(veri, slug, 'icerik.json'), JSON.stringify(kayitKur(trKarar()))); tamamla(slug, { veri });
    const rap = await uretKategori(slug, { veri, out, log: () => {} });
    const html = fs.readFileSync(path.join(out, pageDir(slug), 'index.html'), 'utf8');
    assert.match(html, /<html lang="tr"/);
    const K = (html.match(/<article class="card slide[^"]*"[\s\S]*?<\/article>/g) || []);
    assert.equal(K.length, 4);
    assert.match(K[0], /class="slide-f"/); assert.match(K[0], /alt="Tavuklu pizzası, Test Pizzeria"/, 'kart fotografi Turkce alt metin');
    assert.ok(rap.kartFoto.find((k) => k.ad === 'Tavuklu').id, 'kendi fotografi olan kart fotografsiz kalmadi');
    for (const a of K) assert.match(a, /<span>Bunu sipariş et<\/span>/);
    assert.ok(html.includes('<span class="v v-w" title="beyaz taban">W</span>'), 'W rozeti Turkce');
    assert.ok(html.includes('<span class="v" title="vejetaryen">V</span>'), 'V rozeti Turkce');
    assert.doesNotMatch(html, /Order this one|white base|vegetarian|A pizza at|pizza at Test/);
    assert.match(html, /aria-label="Önceki pizza"/);
  } finally { fs.rmSync(veri, { recursive: true, force: true }); fs.rmSync(out, { recursive: true, force: true }); }
});
