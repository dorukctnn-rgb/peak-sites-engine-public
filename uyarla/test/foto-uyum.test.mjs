// FOTO UYUMU KAPISI (12 Kas 2026, kalici kural: "fotolari iyi sec, en iyilerini koy", "rastgele foto koyma", "uyumlu olacak!").  Ag yok, tarayici yok.
// Isletmenin kendi kareleri once; logo, harita, ekran goruntusu, ikon, kucuk, bulanik ve grafik kare elenir; stok yalniz ture ya da menuye uyarsa;
// en iyi kare once; uymayan kare yuvaya girmez (icerik denetimi HATA, uretici yuvayi daraltir).  Butun isletme adlari uydurmadir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import crypto from 'node:crypto';
import { sharp } from '../lib/gorsel.mjs';
import { isletmeTuru, stokUyumu, kendiEleme, fotoUyum, fotoPuani, konuOf, menuKelimeleri, yuvaUygun, kararYuvalari, yuvaDenetle, yuvaDaralt, uyumBaglami, sade, EN_AZ, BULANIK } from '../lib/foto-uyum.mjs';
import { denetle } from '../restoran-icerik.mjs';
import { hazirlikKapisi, restoranHazirla } from '../restoran-hazirla.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const ph = (id, o = {}) => ({ id, w: 1600, h: 1067, lapVar: 600, meanL: 0.3, meanS: 0.45, url: `https://ornek-mutfak.example/img/kare-${id}.jpg`, alt: '', cls: '', ...o });

test('isletme turu: sablon > kanca > OSM turu > mutfak', () => {
  assert.equal(isletmeTuru({ sablon: 'burger' }), 'burger'); assert.equal(isletmeTuru({ sablon: 'pizza', kind: 'bakery' }), 'pizza');
  assert.equal(isletmeTuru({ sablon: 'v5', kategori: 'pastane' }), 'pastane');
  for (const [kind, tur] of [['bakery', 'pastane'], ['pastry shop', 'pastane'], ['confectionery', 'pastane'], ['ice cream shop', 'dondurma'], ['kebab house', 'kebap'], ['cafe', 'kafe'], ['bar', 'bar'], ['burger joint', 'burger'], ['pizzeria', 'pizza'], ['burrito and taco bar', 'burrito'], ['restaurant', 'restoran']]) assert.equal(isletmeTuru({ sablon: 'v5', kind }), tur, kind);
  assert.equal(isletmeTuru({ kind: 'restaurant', mutfak: 'coffee_shop' }), 'kafe');
  assert.equal(isletmeTuru({ kind: 'restaurant', ad: 'Liman Dönercisi' }), 'kebap');
  assert.equal(sade('Pâtisserie Çınar ŞİŞ'), 'patisserie cinar sis');
});

test('stok: ture uyan kare girer (burgerciye burger, pastaneye pasta ya da tatli, bara icki ya da bar ortami, pizzaciya pizza)', () => {
  assert.equal(stokUyumu({ alt: 'Juicy cheeseburger with fries' }, { tur: 'burger' }).uyumlu, true);
  assert.equal(stokUyumu({ alt: 'Chocolate cake slice' }, { tur: 'pastane' }).uyumlu, true);
  assert.equal(stokUyumu({ alt: 'Fresh croissants on a tray' }, { tur: 'pastane' }).uyumlu, true);
  assert.equal(stokUyumu({ alt: 'Cocktails on the counter' }, { tur: 'bar' }).uyumlu, true);
  assert.equal(stokUyumu({ alt: 'Cosy pub interior' }, { tur: 'bar' }).uyumlu, true, 'bar ortami');
  assert.equal(stokUyumu({ alt: 'pizza on brown wooden table' }, { tur: 'pizza' }).uyumlu, true);
  assert.equal(stokUyumu({ url: 'https://unsplash.com/photos/margherita-pizza-from-wood-fired-oven-x1' }, { tur: 'pizza' }).uyumlu, true, 'dosya adi da etikettir');
  assert.equal(stokUyumu({ etiketler: ['gelato', 'cone'] }, { tur: 'dondurma' }).uyumlu, true, 'etiket listesi');
  assert.equal(stokUyumu({ alt: 'çikolatalı pasta dilimi' }, { tur: 'pastane', dil: 'tr' }).uyumlu, true, 'TR pastanede pasta tatlidir');
  assert.equal(stokUyumu({ alt: 'Adana kebap ve közlenmiş biber' }, { tur: 'kebap', dil: 'tr' }).uyumlu, true);
});

test('stok: konu disi, eslesmeyen ya da baska turun karesi girmez', () => {
  // tur sozcugu yok
  assert.match(stokUyumu({ alt: 'woman wearing yellow long sleeve shirt' }, { tur: 'burger' }).neden, /eşleşmiyor/);
  assert.match(stokUyumu({ url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd' }, { tur: 'pizza' }).neden, /eşleşmiyor/, 'etiketsiz stok kanitsizdir');
  // baska turun yemegi
  assert.equal(stokUyumu({ alt: 'Juicy cheeseburger with fries' }, { tur: 'pastane' }).uyumlu, false, 'pastaneye burger yok');
  assert.match(stokUyumu({ alt: 'Chocolate cake next to a burger and fries' }, { tur: 'pastane' }).neden, /başka türün/);
  assert.equal(stokUyumu({ alt: 'pizza slice' }, { tur: 'burger' }).uyumlu, false, 'burgerciye pizza yok');
  assert.equal(stokUyumu({ alt: 'pasta carbonara' }, { tur: 'pastane', dil: 'en' }).uyumlu, false, 'yurt disinda pasta makarnadir');
  // konu disi sahne
  assert.match(stokUyumu({ alt: 'Businessman with laptop eating pizza' }, { tur: 'pizza' }).neden, /konu dışı/);
  assert.match(stokUyumu({ alt: 'Mountain landscape at sunrise with coffee' }, { tur: 'kafe' }).neden, /konu dışı/);
  // yakin turler: kafede pasta, pastanede kahve
  assert.equal(stokUyumu({ alt: 'Latte and a slice of carrot cake' }, { tur: 'kafe' }).uyumlu, true);
  assert.equal(stokUyumu({ alt: 'Espresso with croissant and cupcakes' }, { tur: 'pastane' }).uyumlu, true);
});

test('stok: genel restoranda yalniz menusundeki ya da mutfagindaki yemek; menude varsa baska tur de olur', () => {
  const menu = menuKelimeleri([{ n: 'Spaghetti Carbonara', p: '€16' }, { n: 'Grilled Seabass', p: '€24', cat: 'Mains' }, { n: 'Tiramisu', p: '€8' }]);
  assert.equal(stokUyumu({ alt: 'plate of food on a table' }, { tur: 'restoran', menu }).uyumlu, false, 'genel "yemek" sozcugu yetmez');
  assert.equal(stokUyumu({ alt: 'Spaghetti carbonara in a bowl' }, { tur: 'restoran', menu }).uyumlu, true);
  assert.equal(stokUyumu({ alt: 'Tiramisu dessert' }, { tur: 'restoran', menu }).uyumlu, true);
  assert.equal(stokUyumu({ alt: 'Sushi platter' }, { tur: 'restoran', menu }).uyumlu, false);
  assert.equal(stokUyumu({ alt: 'Sushi platter' }, { tur: 'restoran', menu, mutfak: new Set(['sushi']) }).uyumlu, true, 'OSM mutfak etiketi');
  // pizzacinin menusunde burger varsa burger karesi baska tur sayilmaz
  const pm = menuKelimeleri([{ n: 'Smash Burger', p: '€14' }]);
  assert.equal(stokUyumu({ alt: 'burger with fries' }, { tur: 'pizza', menu: pm }).uyumlu, true);
  assert.ok(!menuKelimeleri([{ n: 'Small side salad with fresh herbs', p: '€4' }]).has('small'), 'genel sozcukler menu kaniti degil');
});

test('kendi kareleri: logo, harita, ekran goruntusu, ikon, uretilmis, afis, grafik, bulanik ve cok kucuk elenir; gercek fotograf girer', () => {
  const e = (o, ctx) => (kendiEleme(ph('01', o), ctx) || {}).tur || null;
  assert.equal(e({ url: 'https://x.example/img/our-logo.png' }), 'logo');
  assert.equal(e({ cls: 'site-logo dark-version' }), 'logo');
  assert.equal(e({ url: 'https://x.example/img/brand.jpg' }, { logoAnahtar: 'x.example/img/brand.jpg' }), 'logo', 'sitenin logo dosyasinin kendisi');
  assert.equal(e({ url: 'https://x.example/img/map.jpg' }), 'harita');
  assert.equal(e({ alt: 'Konum haritası' }), 'harita');
  assert.equal(e({ url: 'https://maps.googleapis.com/maps/api/staticmap?center=x' }), 'harita');
  assert.equal(e({ url: 'https://x.example/uploads/Screenshot%202024-11-06%20at%2015.41.25.png' }), 'ekran');
  assert.equal(e({ alt: 'ekran görüntüsü' }), 'ekran');
  assert.equal(e({ url: 'https://x.example/img/icon-cutlery.png', w: 512, h: 512 }), 'ikon');
  assert.equal(e({ alt: 'QR code menu', w: 700, h: 700 }), 'ikon');
  assert.equal(e({ alt: 'plus icon img', w: 1139, h: 720 }), null, 'galeri kaplamasini anlatan alt metni buyuk fotografi elemez');
  assert.equal(e({ isaretler: { uretilmis: ['metadata: x'] } }), 'uretilmis');
  assert.equal(e({ isaretler: { uretilmis: ['olcu: 1376x768 (uretilmis gorsel olcusu; tek basina kanit degil)'] } }), null, 'olcu tek basina kanit degil');
  assert.equal(e({ isaretler: { afis: ['dosya adi/alt: menu', 'kesin: afis ya da menu gorseli (ad ipucu + PNG/dik ya da goruntu analizi)'] } }), 'afis');
  assert.equal(e({ meanS: 0.19, lapVar: 1854 }), null, 'dusuk doygunluk + keskinlik tek basina afis degil (koyu zeminli tabak, havuz)');
  assert.equal(e({ url: 'https://x.example/img/bg.png', palette: [{ hex: '#ffffff' }, { hex: '#000000' }] }), 'grafik');
  assert.equal(e({ lapVar: BULANIK - 3 }), 'bulanik');
  assert.equal(e({ lapVar: 28 }), null, 'yumusak ama bulanik degil');
  assert.equal(e({ w: 500, h: 512 }), 'kucuk');
  assert.equal(e({ url: 'https://x.example/img/maple-glazed-ribs.jpg' }), null, 'sozcuk siniri: maple harita degil');
  assert.equal(e({}), null);
});

test('fotoUyum: kendi kareleri stoktan once, en iyi kare once (cozunurluk, oran, keskinlik, konu); elenenler nedeniyle', () => {
  const photos = [
    ph('01', { w: 1200, h: 800, lapVar: 300 }),
    ph('02', { w: 2400, h: 1600, lapVar: 1500, url: 'https://x.example/img/margherita-pizza.jpg' }),
    ph('03', { w: 1000, h: 1500, lapVar: 900 }), // dik
    ph('04', { url: 'https://x.example/img/logo.png' }),
    ph('05', { w: 3000, h: 2000, url: 'https://images.unsplash.com/photo-1', alt: 'pizza on chopping board', isaretler: { stok: ['adres/alt: unsplash'] } }),
    ph('06', { w: 3000, h: 2000, url: 'https://images.unsplash.com/photo-2', alt: 'office desk', isaretler: { stok: ['adres/alt: unsplash'] } }),
    ph('07', { w: 700, h: 500 }), // yalniz kart
  ];
  const u = fotoUyum(photos, { tur: 'pizza' });
  assert.deepEqual(u.sira.slice(0, 2), ['02', '01'], 'en buyuk, keskin, yatay ve konusu pizza olan kare once');
  assert.equal(u.sira.at(-1), '05', 'ture uyan stok en sonda (kendi kareleri once)');
  assert.ok(u.sira.indexOf('03') < u.sira.indexOf('05'));
  assert.deepEqual(u.elenen.map((x) => [x.id, x.tur]), [['04', 'logo'], ['06', 'stok']]);
  assert.equal(u.uygun.find((x) => x.id === '05').kaynak, 'stok'); assert.equal(u.uygun.find((x) => x.id === '02').konu, 'yemek');
  assert.ok(u.uygun.find((x) => x.id === '07').yalnizKart);
  assert.match(u.ozet, /^7 kare: 5 uygun \(4 kendi, 1 stok\), 2 elendi \(logo 1, stok 1\)$/);
  // dis stok kaynagi (ileride): ayni kural
  const d = fotoUyum([ph('01')], { tur: 'pastane', stok: [{ id: 's1', w: 2000, h: 1300, etiketler: ['croissant', 'bakery'] }, { id: 's2', w: 2000, h: 1300, etiketler: ['burger'] }] });
  assert.deepEqual(d.sira, ['01', 's1']); assert.deepEqual(d.elenen.map((x) => x.id), ['s2']);
});

test('puan ve konu: yemek ve mekan kareleri belirsizden once; dik ve bulanik geriye', () => {
  const ctx = { tur: 'bar', menu: new Set() };
  assert.equal(konuOf(ph('01', { alt: 'Cocktails at the bar' }), ctx), 'yemek');
  assert.equal(konuOf(ph('01', { alt: 'Beer garden in summer' }), ctx), 'yemek', 'bar turunde bira yemek/icecek sayilir');
  assert.equal(konuOf(ph('01', { alt: 'Our terrace at sunset' }), ctx), 'mekan');
  assert.equal(konuOf(ph('01', { alt: 'Our head chef' }), ctx), 'ekip');
  assert.equal(konuOf(ph('01', { url: 'https://x.example/IMG_4411.jpg' }), ctx), 'belirsiz');
  const a = fotoPuani(ph('01', { alt: 'Our terrace' }), ctx).puan; const b = fotoPuani(ph('02'), ctx).puan;
  assert.ok(a > b, 'mekan karesi belirsizden once');
  assert.ok(fotoPuani(ph('03', { w: 1000, h: 1500 }), ctx).puan < b, 'dik kare geriye');
  assert.ok(fotoPuani(ph('04', { lapVar: 60 }), ctx).puan < b, 'yumusak kare geriye');
});

test('yuva: bolum icin en az 800x400, urun kartinda 600x400 yeter; elenen ve olmayan kare yuvaya girmez', () => {
  const u = fotoUyum([ph('01'), ph('02', { w: 700, h: 560 }), ph('03', { url: 'https://x.example/map.png' }), ph('04', { w: 1920, h: 485 })], { tur: 'restoran' });
  assert.deepEqual(yuvaUygun(u, '01'), { ok: true, kaynak: 'kendi' });
  assert.match(yuvaUygun(u, '02').neden, new RegExp(`bölüm için en az ${EN_AZ.w}x${EN_AZ.h}`));
  assert.equal(yuvaUygun(u, '02', { kart: true }).ok, true);
  assert.equal(yuvaUygun(u, '04').ok, true, '1920x485 serit bolumde kullanilabilir');
  assert.match(yuvaUygun(u, '03').neden, /harita/); assert.match(yuvaUygun(u, '99').neden, /fotoğraflarda yok/);
  assert.equal(yuvaUygun(null, '01').ok, true, 'kapi verisi yoksa (eski paket) engel yok');
});

const uyumOrnek = () => fotoUyum([
  ph('01', { w: 2400, h: 1600 }), ph('02'), ph('03'), ph('04', { url: 'https://x.example/img/logo-white.png' }),
  ph('05', { url: 'https://x.example/img/location-map.jpg' }), ph('06', { w: 700, h: 560 }),
  ph('07', { w: 2600, h: 1700, url: 'https://images.unsplash.com/photo-9', alt: 'cheeseburger and fries', isaretler: { stok: ['adres/alt: unsplash'] } }),
], { tur: 'burger' });

test('icerik karari: her yuvadaki kare kapidan gecmeli; logo, harita ve kucuk kare HATA; ana fotograf kendi karesi', () => {
  const u = uyumOrnek();
  const v5 = { tur: 'icerik', karar: 'icerik', sablon: 'v5', hero: { id: '01' }, icerik: { foto: { menu: '02', story: '03', contact: '05', cards: ['02', '03', '06'] }, cards: { items: [{ pic: '02' }, { pic: '03' }, { pic: '06' }] } } };
  assert.deepEqual(kararYuvalari(v5).map((x) => x.yuva), ['hero', 'foto.menu', 'foto.story', 'foto.contact', 'foto.cards[0]', 'foto.cards[1]', 'foto.cards[2]', 'cards.items[0]', 'cards.items[1]', 'cards.items[2]']);
  const H = yuvaDenetle(v5, u);
  assert.equal(H.length, 3, H.join(' | '));
  assert.match(H.join(' | '), /foto\.contact karesi 05 kullanilamaz \(harita/); assert.match(H.join(' | '), /foto\.cards\[2\] karesi 06 kullanilamaz \(çok küçük/);
  // kategori karari: kareler, trio, duo, urun kartlari; marka isareti ve logo karesi yuva degil
  const kat = { tur: 'icerik', karar: 'icerik', sablon: 'burger', hero: { id: '07' }, icerik: { kareler: { trio: ['02', '03', '04'], ziyaret: ['01'] }, trio: [{ id: '02' }], duo: [{ foto: '03' }, { isaret: true }], slider: { foto: { Classic: '06', Double: { id: '05' }, Bos: null } }, isaret: { id: '04', w: 520 }, kategoriEk: { logoFoto: '04' } } };
  const HK = yuvaDenetle(kat, u).join(' | ');
  assert.match(HK, /kareler\.trio\[2\] karesi 04 kullanilamaz \(logo\)/);
  assert.match(HK, /slider\.foto\[Double\] karesi 05 kullanilamaz \(harita/);
  assert.doesNotMatch(HK, /slider\.foto\[Classic\]/, 'urun kartinda 700x560 kare yeter');
  assert.match(HK, /ana fotograf \(07\) stok kare; isletmenin kendi karesi olmali/);
  assert.equal(yuvaDenetle({ ...kat, hero: { id: '01' }, icerik: { kareler: { ziyaret: ['07'] } } }, u).length, 0, 'ture uyan stok bolum yuvasinda kullanilabilir');
  assert.deepEqual(yuvaDenetle(v5, null), []);
});

test('denetle: paketteki foto_uyum ile uymayan kare karari gozden gecire dusurur; eski pakette denetim atlanir', () => {
  const u = uyumOrnek();
  const k = { tur: 'icerik', karar: 'icerik', sablon: 'v5', inceleyen: 'icerik-turu', hero: { id: '01', gerekce: 'kendi sitesinin en buyuk yatay yemek karesi, keskin, yazisiz' }, icerik: { foto: { menu: '02', contact: '05' } } };
  const H = denetle(k, { fotoIds: ['01', '02', '03', '04', '05', '06', '07'], bilgi: { foto_uyum: u } });
  assert.ok(H.some((h) => /foto uyumu: foto\.contact karesi 05 kullanilamaz/.test(h)), H.join(' | '));
  assert.ok(!H.some((h) => /foto uyumu: foto\.menu/.test(h)));
  assert.ok(!denetle(k, { fotoIds: ['01', '02', '05'] }).some((h) => /foto uyumu/.test(h)), 'foto_uyum yoksa (eski paket) bu denetim yok');
});

test('uretici daraltmasi: uymayan kare yuvadan cikar, uyari yazilir; uyan kareler kalir', () => {
  const u = uyumOrnek();
  const d = yuvaDaralt([{ yuva: 'foto.menu', id: '02' }, { yuva: 'foto.contact', id: '05' }, { yuva: 'kareler.trio[2]', id: '04' }, { yuva: 'kareler.ziyaret[0]', id: '07' }], u);
  assert.deepEqual([...d.gecen], ['02', '07']);
  assert.deepEqual(d.uyari, ['foto uyumu: foto.contact karesi 05 uyumsuz (harita ekran görüntüsü); yuva daraltildi', 'foto uyumu: kareler.trio[2] karesi 04 uyumsuz (logo); yuva daraltildi']);
});

// ---- hazirlik kapisi ve paket ----
const isletme = (photos) => ({
  erisim: { ok: true, finalUrl: 'https://ornek-mutfak.example/' }, lead: { sektor: 'restoran', name: 'Ornek Mutfak', kind: 'restaurant', site: 'https://ornek-mutfak.example', region: 'IE', lang: 'en', city: 'Galway' },
  name: { n: 'Ornek Mutfak' }, address: { text: '1 Main Street, Galway' }, phone: '+353 91 000000', hours: { tableOk: true, week: [], byDay: {} },
  logo: { orig: { file: 'img/logo-orijinal.png', w: 600, h: 300, sha256: 'x' }, url: 'https://ornek-mutfak.example/img/brand.png' },
  order: { url: 'https://order.toasttab.com/online/ornek', platform: 'Toast', dogrulama: { durum: 'canli' } }, reservation: null, photos,
});

test('hazirlik kapisi: logo, harita ve ekran goruntusu kullanilabilir fotograf sayilmaz; eski mesaj ayni kalir', () => {
  const dir = tmp('fu-kapi-'); const lead = { slug: 'ornek-mutfak', name: 'Ornek Mutfak' };
  try {
    const iyi = [1, 2, 3, 4, 5].map((i) => ph(`0${i}`));
    let k = hazirlikKapisi(isletme(iyi), lead, dir); assert.equal(k.elendi, null, JSON.stringify(k.elendi)); assert.equal(k.fotoUyum.uygun.length, 5);
    const kotu = [ph('01'), ph('02'), ph('03', { url: 'https://ornek-mutfak.example/img/brand.png' }), ph('04', { url: 'https://ornek-mutfak.example/img/find-us-map.jpg' }), ph('05', { alt: 'Screenshot of our menu page' })];
    k = hazirlikKapisi(isletme(kotu), lead, dir);
    assert.match(k.elendi.join(' | '), /kullanılabilir fotoğraf az \(2; en az 4, 800 px\+; 3 logo, harita, ekran görüntüsü, ikon ya da bulanık kare sayılmadı\)/);
    // yatay 1000 px kosulu da kapidan gecen karelerle
    const yatay = [ph('01', { w: 900, h: 700 }), ph('02', { w: 900, h: 700 }), ph('03', { w: 900, h: 700 }), ph('04', { w: 900, h: 700 }), ph('05', { url: 'https://ornek-mutfak.example/img/logo-banner.jpg', w: 2400, h: 1200 })];
    assert.ok(hazirlikKapisi(isletme(yatay), lead, dir).elendi.some((x) => /1000 px üstünde yatay/.test(x)));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('hazirlik paketi: bilgi.json foto_uyum (en iyi once, elenen nedeniyle), ana fotograf adaylarina logo ve harita girmez', async () => {
  const veri = tmp('fu-veri-'); const slug = 'ornek-mutfak-ie0001'; const dir = path.join(veri, slug);
  try {
    fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
    const kareler = [['01', 1800, 1200], ['02', 1600, 1067], ['03', 1400, 933], ['04', 1600, 1067], ['05', 1600, 1067], ['06', 1600, 1067]];
    const photos = [];
    for (const [i, [id, w, h]] of kareler.entries()) {
      const buf = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 70 + i * 20, g: 50 + i * 9, b: 40 }, noise: { type: 'gaussian', mean: 110, sigma: 40 } } }).jpeg({ quality: 70 }).toBuffer();
      fs.writeFileSync(path.join(dir, 'img', `m${id}.jpg`), buf);
      photos.push(ph(id, { w, h, file: `img/m${id}.jpg`, palette: [{ hex: '#784a28' }, { hex: '#5a3a20' }, { hex: '#a07050' }, { hex: '#302010' }] }));
    }
    photos[3].url = 'https://ornek-mutfak.example/img/brand.png'; // sitenin logo dosyasi
    photos[4].url = 'https://ornek-mutfak.example/img/find-us-map.jpg';
    photos[1].alt = 'Grilled seabass with lemon';
    const logo = await sharp({ create: { width: 600, height: 300, channels: 4, background: { r: 192, g: 57, b: 43, alpha: 1 } } }).png().toBuffer();
    fs.writeFileSync(path.join(dir, 'img', 'logo-orijinal.png'), logo);
    const R = isletme(photos); R.slug = slug; R.logo.orig.sha256 = crypto.createHash('sha256').update(logo).digest('hex');
    R.menu = { items: [{ n: 'Grilled Seabass', p: '€24' }] };
    fs.writeFileSync(path.join(dir, 'cikarici.json'), JSON.stringify(R));
    fs.writeFileSync(path.join(dir, '_home.txt'), ['Menu', 'Soup of the day €7.50', 'Caesar salad €11.00', 'Grilled seabass €24.00', 'Ribeye steak €32.00', 'Chicken curry €18.00', 'Apple tart €8.00', 'Opening hours Monday to Sunday 12pm to 10pm'].join('\n'));
    const k = await restoranHazirla({ slug, site: R.lead.site, region: 'IE', city: 'Galway', kind: 'restaurant', name: 'Ornek Mutfak' }, { veri, polite: null, log: () => {} });
    assert.equal(k.status, 'icerik-bekliyor', JSON.stringify(k.reasons));
    assert.match(k.fotoUyum, /6 kare: 4 uygun \(4 kendi, 0 stok\), 2 elendi \(logo 1, harita 1\)/);
    const bilgi = JSON.parse(fs.readFileSync(path.join(dir, 'paket', 'bilgi.json'), 'utf8'));
    assert.equal(bilgi.foto_uyum.tur, 'restoran'); assert.match(bilgi.foto_uyum.kural, /Uyan kare yoksa yuva boş bırakılır/);
    assert.deepEqual(bilgi.foto_uyum.elenen.map((x) => [x.id, x.tur]), [['04', 'logo'], ['05', 'harita']]);
    assert.equal(bilgi.fotograflar[0].id, '02', 'menudeki yemegi gosteren buyuk yatay kare once'); assert.equal(bilgi.fotograflar[0].konu, 'yemek');
    assert.deepEqual(bilgi.fotograflar.slice(-2).map((x) => [x.id, x.uyum]), [['04', 'elendi'], ['05', 'elendi']]);
    assert.deepEqual(bilgi.fotograflar.map((x) => x.id).slice(0, 4).sort(), ['01', '02', '03', '06']);
    for (const a of bilgi.hero_adaylari) assert.ok(!['04', '05'].includes(a.id), `ana fotograf adayi elenen kare olamaz: ${a.id}`);
    assert.ok(fs.existsSync(path.join(dir, 'paket', 'fotolar.jpg')));
    // pakette uymayan kareyi secen karar denetimden gecmez
    const H = denetle({ tur: 'icerik', karar: 'icerik', sablon: 'v5', inceleyen: 'icerik-turu', hero: { id: '04', gerekce: 'yanlis secim ornegi: sitenin logo dosyasi, ana fotograf olamaz' }, icerik: { foto: {} } }, { fotoIds: bilgi.fotograflar.map((x) => x.id), bilgi });
    assert.ok(H.some((h) => /foto uyumu: hero karesi 04 kullanilamaz \(logo\)/.test(h)), H.join(' | '));
  } finally { fs.rmSync(veri, { recursive: true, force: true }); }
});

test('uyumBaglami: cikarici verisinden tur, dil, menu ve logo adresi', () => {
  const R = { lead: { kind: 'bakery', lang: 'tr', region: 'TR', mutfak: 'pastry' }, name: { n: 'Çınar Pastanesi' }, menu: { items: [{ n: 'Profiterol', p: '₺120' }] }, logo: { url: 'https://x.example/logo.png' } };
  const b = uyumBaglami(R, { sablon: 'v5' });
  assert.equal(b.tur, 'pastane'); assert.equal(b.dil, 'tr'); assert.equal(b.logoUrl, 'https://x.example/logo.png'); assert.equal(b.menuItems.length, 1);
  assert.equal(uyumBaglami({ lead: { kind: 'restaurant' } }, { sablon: 'pizza' }).tur, 'pizza');
});
