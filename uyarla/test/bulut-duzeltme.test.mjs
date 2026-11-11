// Bulut turunda gercek ciktilardan bulunan kusurlarin duzeltmeleri (10 Kas): telefon dizisi, kapali isletme, oda olmayan basliklar, logo olarak odul rozeti, bos kahraman, sektor sloganlari.
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { telefonMu, extractPhone } from '../v2lib/scrape.mjs';
import { kapaliMi } from '../lib/kapali.mjs';
import { odalarBul } from '../sektor/konaklama.mjs';
import { rozetMi } from '../lib/rozet.mjs';
import { sloganSec, gerceklikler } from '../lib/slogan.mjs';
import { kahramanBosMu } from '../kapi.mjs';

test('telefonMu: sayfalama ve yil listesi telefon degildir; gercek numaralar gecer', () => {
  assert.equal(telefonMu('9 10 11 12 13 14 15'), false);
  assert.equal(telefonMu('2019 2020 2021 2022'), false);
  assert.equal(telefonMu('0000000000'), false);
  for (const ok of ['+353 (0)87 1234567', '+353861234567', '0238846493', '+64 21 123 4567', '(02) 9876 5432', '+353 27 123456']) assert.equal(telefonMu(ok), true, ok);
  assert.equal(extractPhone('<a href="tel:9 10 11 12 13 14 15">x</a><a href="tel:+353861234567">y</a>'), '+353861234567');
});

test('kapaliMi: kalici kapanis ve salgin donemi kapanisi yakalanir; gunluk "closed" cumleleri yakalanmaz', () => {
  assert.ok(kapaliMi('UNFORTUNATELY AFTER MORE THAN 20 YEARS ; WE HAVE DECIDED THAT WE WILL NO LONGER BE OPERATING AS GUEST ACCOMMODATION AND WE THANK YOU'));
  assert.ok(kapaliMi('Unfortunately, the Tea Rooms and Accommodation are now closed in line with government guidelines.'));
  assert.ok(kapaliMi('We are permanently closed. Thank you for the years.'));
  assert.ok(kapaliMi('The business has ceased trading.'));
  assert.equal(kapaliMi('The kitchen is closed on Mondays. We are open Tuesday to Sunday for dinner.'), null);
  assert.equal(kapaliMi('Reception is closed after 10pm; late arrivals can use the key safe.'), null);
  assert.equal(kapaliMi('We no longer accept cash payments.'), null);
  assert.equal(kapaliMi(''), null);
});

test('odalarBul: aciklama, olanak, oran, yeme-icme basliklari ve cumle parcalari oda sayilmaz', () => {
  const blok = (n) => `<h3>${n}</h3><p>A bright en-suite room with a king bed and garden view. Sleeps 2. From €90 per night.</p>`;
  for (const n of ['Description', 'YOUR GUESTHOUSE FACILITIES', 'Dining room', 'Room & Rates', 'Each hermitage has..', 'Sitting Room Suite']) assert.equal(odalarBul(blok(n)).length, 0, n);
  for (const n of ['Double Room', 'The Heaney Room', 'Garden Suite Superior Room', 'Family Rooms', 'Self Catering Cottage', 'Twin Room']) assert.equal(odalarBul(blok(n)).length, 1, n);
});

test('rozetMi: "accolades_Logo_6.png" bir odul rozetidir', () => {
  assert.equal(rozetMi('', 'https://www.cullinansdoolin.com/cr/assets/Image/accolades_Logo_6.png'), true);
  assert.equal(rozetMi('', 'https://x.ie/images/rosette-2023.png'), true);
  assert.equal(rozetMi('', 'https://x.ie/images/room-3.jpg'), false);
});

test('slogan: konaklamada tur ifadesi sektorun turu, sitenin "Restaurant" satiri degil; "Our Rooms" slogan olmaz', () => {
  const R = { lead: { sektor: 'konaklama', kind: 'bed and breakfast', lang: 'en', city: 'Bantry' }, name: { n: 'Bridge View House' }, slogan: { cands: [{ t: 'Restaurant', tag: 'span', top: 100 }, { t: 'Our Rooms', tag: 'h2', top: 200 }], title: 'Bantry Bed and Breakfast', desc: '' } };
  const f = gerceklikler(R, 'en'); assert.equal(f.kindPhrase, 'bed and breakfast');
  const s = sloganSec(R, { lang: 'en', slug: 'bridge-view-house-ie3179' });
  assert.ok(!/^restaurant$/i.test(s.text), s.text); assert.ok(!/^our rooms$/i.test(s.text), s.text);
  const R2 = { ...R, slogan: { cands: [{ t: 'Our Rooms', tag: 'h2', top: 200 }], title: '', desc: '' } };
  const s2 = sloganSec(R2, { lang: 'en', slug: 'x' }); assert.ok(!/^our rooms$/i.test(s2.text), s2.text);
  assert.match(s2.text, /bed and breakfast/i);
});

test('kahramanBosMu: siyah ya da tek renk alan bos, fotograf degil', async () => {
  const siyah = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#000' } }).png().toBuffer();
  const noise = Buffer.alloc(800 * 600 * 3); for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) % 251;
  const foto = await sharp(noise, { raw: { width: 800, height: 600, channels: 3 } }).png().toBuffer();
  assert.equal(await kahramanBosMu(siyah, { x: 400, y: 0, w: 400, h: 600 }, 1), true);
  assert.equal(await kahramanBosMu(foto, { x: 400, y: 0, w: 400, h: 600 }, 1), false);
  assert.equal(await kahramanBosMu(foto, null, 1), false);
});

test('uretimPuani: orta derecede kotu siteler en kotulerden once; logo adayi yoksa geri', async () => {
  const { uretimPuani, malzemeOlc } = await import('../../lead/puan.mjs');
  const sira = [{ id: 'a', puan: 14 }, { id: 'b', puan: 6 }, { id: 'c', puan: 7 }, { id: 'd', puan: 4 }, { id: 'e', puan: 6, malzeme: { logo: false } }].sort((x, y) => uretimPuani(y) - uretimPuani(x)).map((x) => x.id);
  assert.deepEqual(sira, ['b', 'c', 'e', 'd', 'a']);
  const m = malzemeOlc('<html><head><meta property="og:image" content="/img/hero.jpg"></head><body><img src="/wp-content/uploads/a-300x200.jpg"><img data-src="/uploads/room1.jpg"><img src="/img/logo.png"><div style="background-image:url(/img/view.webp)"></div><a href="/gallery">Gallery</a></body></html>', 'https://x.ie/');
  assert.equal(m.foto, 4, 'og:image, kucuk resim adi normallesir, data-src, css arka plan; logo sayilmaz'); assert.equal(m.galeri, true);
});

test('fiyatVarMi: mailde "fiyatlariniz" yalniz sayfada gercek fiyat varsa', async () => {
  const { fiyatVarMi } = await import('../../hat/uygula.mjs');
  assert.equal(fiyatVarMi({ sektor: 'konaklama', kon: { odalar: 5, fromP: null }, menuItems: 3 }), false, 'oda sayisi fiyat degil');
  assert.equal(fiyatVarMi({ sektor: 'konaklama', kon: { odalar: 3, fromP: '€120' } }), true);
  assert.equal(fiyatVarMi({ sektor: 'guzellik', menuItems: 2 }), false);
  assert.equal(fiyatVarMi({ sektor: 'guzellik', menuItems: 12 }), true);
  assert.equal(fiyatVarMi(null), false);
});

test('konaklama: oda basligi altyazisi fiyat yoksa "prices" demez', async () => {
  const { ETIKET } = await import('../sektor/konaklama.mjs');
  assert.match(ETIKET.en.roomsSub('Rose Cottage', true), /prices/);
  assert.doesNotMatch(ETIKET.en.roomsSub('Rose Cottage', false), /prices/);
});
