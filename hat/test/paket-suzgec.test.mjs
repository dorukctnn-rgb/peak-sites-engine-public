// PAKET ON SUZGECI birim testleri (hat/paket-suzgec.mjs): yemek sayimi, saat ayristirma ('late', celisen satirlar), zincir isaretleri, logo rozeti, ana fotograf kurali,
// uretilmis kare uyarisi, kardes paketler ve puanlama / siralama.  Bu dosya herkese acik depoda: ornek metinler UYDURMA ya da genel (gercek isletme verisi yok).
// GERCEK ornekler (17-18 Kas turunda icerik turunun kabul ve reddettigi 96 paket; kesinlik / duyarlilik olcumu) ozel veri deposunda: motor/hat/test/ozel-paket-suzgec.test.mjs
// (node hat/ozel-getir.mjs ile calisma aninda gelir).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { yemekAdlari, menuOlc, heroOlc, logoOlc, saatGirdileri, saatCoz, saatCop, zincirOlc, uretilmisKare, kardesler, puanla, suzgec, kararVerilmis, slugDosyasi, paketSuz, paketleriBul, MIN_PUAN } from '../paket-suzgec.mjs';

const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'paket-suzgec-'));
test.after(() => fs.rmSync(gecici, { recursive: true, force: true }));

function temel(slug = 't', ad = 'T') {
  return {
    slug, ad, bolge: 'AU', sablon: 'v5',
    menu: { kind: 'metin', adet: 12, notlar: [] }, hero: { kendi: 8, buyuk: 5, yatay: 5, enGenis: 4000, stokVar: false, stokTur: true, tur: 'restoran', enIyiBuyukAday: 70 },
    logo: { var: true, w: 600, h: 300, svg: false, rozet: false, kisa: 300, uzun: 600 },
    saat: { acik: 7, kapali: 0, bilinmeyen: 0, gec: false, celiski: [], tutarsiz: false, kucukFark: false, cop: [], girdi: 7 },
    zincir: { sert: [], yumusak: [] }, guc: { agirliklar: [], toplam: 0 }, fotoSayisi: 9, eski: 3, uretilmis: { n: 0, toplam: 0 }, eylem: 'siparis', eylemUrl: true, telefonVar: true,
  };
}

test('yemekAdlari: fiyatli satir, [GRUP] ad: fiyat, baslik ve gezinti yemek sayilmaz', () => {
  const fiyatli = '[Starters] Chicken Satay Skewers(4 sticks): $11.90\n[Starters] Crackers Served with homemade peanut sauce: $7.50\n[Grilled] Grill Marinated Chicken Come with salad and sauce: $18.90\n[Rice and noodles] Roti (2 per serve): $4.50\n[Rice and noodles] Peanut Sauce: $3.50\n[Soft drinks] Soft Drinks Can: $4\n[Soft drinks] Soft Drink Bottle 1.2 L: $5.50';
  assert.ok(yemekAdlari(fiyatli).adlar.length >= 6);
  const siparis = '[CURRY PUFF SET] Vegetarian (2pcs): $6.50\n[SATAY 2 pcs] Chicken (2pcs): $10.40\n[PLAIN ROTI] ROTI ONLY (no curry sauce): $9.00\n[TEH TARIK] Malaysian Milk Tea: $6.90\n[MILO] Malaysian Chocolate milk: $6.90\n[BANGKOK] Malaysian lemon lime bitter: $10.90';
  assert.ok(yemekAdlari(siparis).dogrulandi);
  const bosluk = 'Skip to content\nFind Us\nTiktok\nOur Story\nView Our Menus\nBreakfast\nTry our European-inspired breakfast to start your day.\nLunch\nOur lunch menu features classic Italian homestyled food.\nFresh Salad\nWe offer a healthy and freshness salad.\nCoffee\nFinest coffee served to you by our talented barista.\nDrinks\nQuench your thirst with our wide range of drinks, we are fully licensed.\nPowered by WordPress';
  const y = yemekAdlari(bosluk); assert.equal(y.dogrulandi, false); assert.ok(y.adlar.length < 6, `baslik/gezinti yemek sayildi: ${y.adlar}`);
});
test('yemekAdlari: bufe / seans fiyati ve saat satirlari yemek degil; sayi ile biten kisa satir (PDF menu) fiyatli yemek', () => {
  const bufe = 'Mon-Thu Dinner $39.90 Adult\nFri-Sun Lunch $34.90 Adult\nChild $19.90\nExpress lunch $24.90 Adult\nSenior $29.90 per person\nSurcharge on public holidays $5.00';
  assert.equal(yemekAdlari(bufe).adlar.length, 0);
  const pdf = 'Pad Thai Chicken 18.5\nGreen Curry Beef 20\nTom Yum Goong 21.5\nMassaman Lamb 22\nPad See Ew Chicken 18.5\nSticky Rice with Mango 11\nThai Iced Tea 6';
  assert.ok(yemekAdlari(pdf).dogrulandi);
});
test('yemekAdlari: ad + aciklama cifti yalniz aciklama yemek icerirse sayilir (pazarlama paragrafi sayilmaz)', () => {
  const m = ['Kitfo', 'Minced beef seasoned with spiced butter and chilli, served with injera', 'Doro Wat', 'Chicken stew slow cooked with berbere, onion, garlic, served with egg', 'Shiro', 'Ground chickpeas cooked with garlic, onion and spices, served with bread', 'Tibs', 'Sauteed lamb with onion, rosemary and green chilli served warm',
    'Gomen', 'Collard greens simmered with garlic, ginger and spices, served with rice', 'Misir', 'Red lentils cooked in berbere sauce with onion, garlic and spices'].join('\n');
  assert.ok(yemekAdlari(m).dogrulandi);
  const pazarlama = ['Our Story', 'Welcome', 'Coogee is a wonderful neighbourhood with beautiful people around it', 'Beach Street', 'A place to meet friends and enjoy the sunshine with everyone around', 'Events', 'Come and celebrate with us at our lovely venue by the sea', 'Gift', 'Treat someone you love to something truly special this year'].join('\n');
  assert.equal(yemekAdlari(pazarlama).dogrulandi, false);
});

test('saat: "11am - late", "til late", ve "late" ile biten gunler yakalanir; "until late afternoon" yakalanmaz', () => {
  assert.equal(saatCoz(saatGirdileri('MON – THU: 11:30am – late\nFRI – SUN: 11am – late')).gec, true);
  assert.equal(saatCoz(saatGirdileri('Monday - Thursday 11:30 AM - Late\nFriday - Saturday 11:30 AM - 1:00 AM\nSunday 11:30 AM - 10:00 PM')).gec, true);
  assert.equal(saatCoz(saatGirdileri('Mon-Sun 8am - 4pm\nBreakfast served until late afternoon')).gec, false);
});
test('saat: gun araligi haftayi sarar (Thursday - Tuesday) ve kapali + acik ayni gun celiski sayilir', () => {
  const girdi = saatGirdileri('We are a licensed restaurant. Thursday - Tuesday 5PM - 10PM\nOpening Hours\nThursday - Monday\n5 PM - 10 PM\nTuesday - Wednesday\nClosed');
  const c = saatCoz(girdi);
  assert.ok(c.celiski.length >= 1 && /hem kapali hem acik/.test(c.celiski[0]), `celiski: ${JSON.stringify(c.celiski)}`);
});
test('saat: ogle + aksam bolunmus servis celiski degil; tutarli duz liste temiz', () => {
  const c = saatCoz(saatGirdileri('Lunch (Thu - Sun, 11am - 2:30pm)\nDinner (Tue - Sun, 5pm - 9pm)\nMonday closed'));
  assert.deepEqual(c.celiski, []); assert.equal(c.gec, false);
  const d = saatCoz(saatGirdileri('Monday: Closed\nTuesday: 5:00 pm – 9:30 pm\nWednesday: 5:00 pm – 9:30 pm\nThursday: 5:00 pm – 9:30 pm\nFriday: 5:00 pm – 10:00 pm\nSaturday: 5:00 pm – 10:00 pm\nSunday: 5:00 pm – 9:30 pm'));
  assert.deepEqual(d.celiski, []); assert.equal(d.kapali.has(1), true); assert.equal(d.acik.size, 6);
});
test('saat: ayni gunun saatleri 1 saatten fazla farkli iki satir celiski; 30 dk fark yalniz kucuk fark', () => {
  assert.ok(saatCoz(saatGirdileri('Mon - Fri 11am - 2pm\nMon - Fri 5pm - 9pm')).celiski.length === 0, 'ayrik servisler (ogle + aksam)');
  assert.ok(saatCoz(saatGirdileri('Mon - Fri 9am - 5pm\nMon - Fri 11am - 9pm')).celiski.length >= 1);
  const k = saatCoz(saatGirdileri('Sunday 5pm - 9:30pm\nSunday 5pm - 9pm')); assert.deepEqual(k.celiski, []); assert.equal(k.kucukFark, true);
});
test('saat: ayni saat bir yerde Tue-Sun, baska yerde Wed-Sun yazilmis (alt kume) -> tutarsiz', () => {
  const c = saatCoz(saatGirdileri('Breakfast & Lunch\nTuesday - Sunday\n8am - 3pm\nOpening Hours\nBreakfast & Lunch\nWednesday - Sunday\n8am - 3pm'));
  assert.equal(c.tutarsiz, true);
});
test('saat: tatil, fiyatli teklif ve paragraf satirlari saat sayilmaz', () => {
  const c = saatCoz(saatGirdileri('Good Friday: Closed\nChristmas Day closed\nMONDAY-SUNDAY 12pm-8pm €10.00 lunch special\nMon - Sun 11am - 9pm'));
  assert.deepEqual(c.celiski, []); assert.equal(c.acik.size, 7);
});
test('saat: bilgi.json kaydinda anlamsiz aralik (sabah acilip gece 3te kapanan, 00:00 baslayan) yakalanir', () => {
  assert.ok(saatCop({ week: [[480, 900], [540, 300]], byDay: ['08:00-15:00', '09:00-03:00, 00:00-05:00'] }).length >= 1);
  assert.deepEqual(saatCop({ week: [[1020, 60], [660, 900]], byDay: ['17:00-01:00', '11:00-15:00'] }), []); // bar: aksam acilip ertesi gun 1'de kapanir
});
test('saat: Turkce gun adlari ve "her gun"', () => {
  const c = saatCoz(saatGirdileri('Her gün 09:00 - 23:00\nPazar 10:00 - 22:00'));
  assert.equal(c.acik.size, 7);
});

test('zincir: grup / kardes / franchise / merkez ofis / konumlar / sube / kapanis isaretleri', () => {
  assert.ok(zincirOlc('The Harbour Cafe is part of Acme Hospitality Group').sert.length);
  assert.ok(zincirOlc('Love this place? Check out our sister restaurants:').sert.length);
  assert.ok(zincirOlc('Head Office & Branches').sert.length);
  assert.ok(zincirOlc('See our Example locations, opening hours and contact details below.').sert.length);
  assert.ok(zincirOlc('Visit Our Stores\nLocations\nFind us').sert.length);
  assert.ok(zincirOlc('Batman Şube:\nŞırnak Şube\n').sert.length);
  assert.ok(zincirOlc('Franchise opportunities available').sert.length);
  assert.ok(zincirOlc('Our last day was October 4th. Thank you.').sert.length);
  assert.deepEqual(zincirOlc('We were part of the party. The group chat finally made it out. Find our location on Main Street.').sert, []);
  assert.deepEqual(zincirOlc('Welcome to our family kitchen in Carina Heights.').sert, []);
});
test('zincir: kardes paketler (ayni ad kok) toplu elenir', () => {
  const o = (slug, ad) => ({ slug, ad });
  const k = kardesler([o('al-x-gb1', 'Al Xyz'), o('al-x-2-gb2', 'Al Xyz 2'), o('al-x-express-gb3', 'Al Xyz Express'), o('baska-bir-yer', 'Baska Bir Yer')]);
  assert.ok(k.has('al-x-gb1') && k.has('al-x-2-gb2') && k.has('al-x-express-gb3')); assert.equal(k.has('baska-bir-yer'), false);
});

test('logo: odul / degerlendirme rozeti, cok kucuk bitmap elenir; SVG her zaman gecer', () => {
  const l = (kaynak, boyut, dosya = 'img/logo-orijinal.png') => logoOlc({ logo: { kaynak, boyut, dosya } });
  assert.equal(l('https://x.test/Restaurant-Guru-Logo-2.jpg', '463x322').rozet, true);
  assert.equal(l('https://x.test/tripadvisor-travellers-choice-2025.png', '300x300').rozet, true);
  assert.equal(l('https://x.test/best-of-the-best-award.png', '300x300').rozet, true);
  assert.equal(l('https://x.test/logo-header.png', '753x300').rozet, false);
  const kucuk = puanla({ ...temel(), logo: l('https://x.test/logo.png', '114x60') }); assert.ok(kucuk.sert.some((s) => s.k === 'logo'));
  assert.equal(puanla({ ...temel(), logo: l('https://x.test/logo.svg', '', 'img/logo-orijinal.svg') }).sert.some((s) => s.k === 'logo'), false);
  assert.equal(puanla({ ...temel(), logo: l('https://x.test/logo.png', '200x100') }).sert.some((s) => s.k === 'logo'), false);
  assert.ok(puanla({ ...temel(), logo: l('https://x.test/logo.png', '300x300', 'img/logo-orijinal.png') }).puan < puanla(temel()).puan, 'kucuk logo daha dusuk puan');
});

test('ana fotograf: kendi 2400 px+ kare ya da yemegi acikca uyan tur (stok ana fotograf); aksi halde sert ret', () => {
  const f = (w, h, k = 'kendi', u = 'uygun') => ({ w, h, kaynak: k, uyum: u });
  assert.equal(heroOlc({ fotograflar: [f(3606, 2944)], sablon: 'v5', mutfak: 'thai', ad: 'X' }).yatay, 1);
  assert.equal(heroOlc({ fotograflar: [f(2944, 3606)], sablon: 'v5' }).yatay, 0); // dikey: uzun kenar 2400+ ama yatay degil
  assert.equal(heroOlc({ fotograflar: [f(2944, 3606)], sablon: 'v5' }).buyuk, 1);
  assert.equal(heroOlc({ fotograflar: [f(3000, 2000, 'kendi', 'elendi')], sablon: 'v5' }).buyuk, 0); // elenen kare sayilmaz
  const rd = (h) => puanla({ ...temel(), hero: h });
  assert.equal(rd(heroOlc({ fotograflar: [f(1500, 1001)], sablon: 'v5', mutfak: 'malaysian', ad: 'Ornek' })).sert.some((s) => s.k === 'hero'), false); // stok turu
  assert.equal(rd(heroOlc({ fotograflar: [f(1500, 1001)], sablon: 'v5', mutfak: null, ad: 'Bar Ornek', tur: 'restaurant' })).sert.some((s) => s.k === 'hero'), true);
  assert.equal(rd(heroOlc({ fotograflar: [f(1500, 1001), f(1600, 1000, 'stok')], sablon: 'v5', ad: 'Bar Ornek' })).sert.some((s) => s.k === 'hero'), false); // listede uygun stok kare var
});

test('uretilmis gorsel uyarisi: 3 ve fazla kare -> sert, 1-2 kare -> yumusak', () => {
  assert.deepEqual(uretilmisKare('3/10 kare uretilmis gorsel olcusunde (1376x768, 1024x1024)'), { n: 3, toplam: 10 });
  assert.deepEqual(uretilmisKare(null), { n: 0, toplam: 0 });
  assert.ok(puanla({ ...temel(), uretilmis: { n: 4, toplam: 14 } }).sert.some((s) => s.k === 'foto'));
  const y = puanla({ ...temel(), uretilmis: { n: 1, toplam: 14 } }); assert.equal(y.sert.length, 0); assert.ok(y.yumusak.some((s) => s.k === 'uretilmis-foto'));
});

test('menuOlc: menu-kaynak dosyalari (txt + PDF metni) okunur; PDF metni yoksa dogrulanamayan menu, afis gorseli menu degil', () => {
  const pk = path.join(gecici, 'menu1', 'paket'); fs.mkdirSync(path.join(pk, 'menu-kaynak'), { recursive: true });
  fs.writeFileSync(path.join(pk, 'menu-kaynak', 'menu-1.pdf'), 'x');
  const pdfYok = menuOlc(pk, { menu_kaynaklari: [{ tur: 'pdf' }] }, { pdfMetin: () => null }); assert.equal(pdfYok.kind, 'pdf-resim');
  const pdfVar = menuOlc(pk, { menu_kaynaklari: [{ tur: 'pdf' }] }, { pdfMetin: () => 'Pad Thai Chicken 18.5\nGreen Curry Beef 20\nTom Yum Goong 21.5\nMassaman Lamb 22\nPad See Ew Chicken 18.5\nSticky Rice with Mango 11\nThai Iced Tea 6\n' + 'x'.repeat(200) });
  assert.equal(pdfVar.kind, 'metin');
  const pk2 = path.join(gecici, 'menu2', 'paket'); fs.mkdirSync(pk2, { recursive: true });
  assert.equal(menuOlc(pk2, { menu_kaynaklari: [{ tur: 'gorsel', url: 'https://x.test/feed-images/882452516_17911715799584768_nfull.webp', px: '640x800' }] }).kind, 'yok');
  assert.equal(menuOlc(pk2, { menu_kaynaklari: [{ tur: 'gorsel', url: 'https://x.test/OZEL-MENU-2026.png', px: '3508x2479' }] }).kind, 'gorsel');
  assert.equal(menuOlc(pk2, { menu_kaynaklari: [{ tur: 'siparis-sitesi', kalem: 0 }] }).kind, 'yok');
});

test('temel ozellik seti sert kural gecer ve MIN_PUAN ustunde; menu yok / saat late / rozet logo ayri ayri sert ret', () => {
  const r = puanla(temel()); assert.equal(r.gecer, true); assert.ok(r.puan >= MIN_PUAN, String(r.puan));
  assert.equal(puanla({ ...temel(), menu: { kind: 'yok', adet: 2, notlar: [] } }).sert[0].k, 'menu');
  assert.equal(puanla({ ...temel(), saat: { ...temel().saat, gec: true } }).sert[0].k, 'saat');
  assert.equal(puanla({ ...temel(), logo: { var: true, w: 400, h: 300, svg: false, rozet: true, kisa: 300, uzun: 400 } }).sert[0].k, 'logo');
  assert.equal(puanla({ ...temel(), zincir: { sert: ['x'], yumusak: [] } }).sert[0].k, 'zincir');
});
test('suzgec(): ilk N kisa listeyi puan sirasiyla verir, elenenleri nedenle ayirir, kardes paketleri eler', () => {
  const a = temel('a-au1', 'Alfa'); const b = { ...temel('b-au2', 'Beta'), fotoSayisi: 5, eski: 0 }; const c = { ...temel('c-au3', 'Gama'), menu: { kind: 'yok', adet: 0, notlar: [] } };
  const d1 = temel('d-au4', 'Delta Yer'); const d2 = temel('d2-au5', 'Delta Yer 2');
  const r = suzgec([b, a, c, d1, d2], { ilk: 2 });
  assert.deepEqual(r.liste.map((x) => x.slug), ['a-au1', 'b-au2']); // fotograf sayisi ve zayif site puani yuksek olan once
  assert.ok(r.elenenler.every((e) => e.sert.length > 0 && !e.gecer));
  assert.deepEqual(r.elenenler.map((e) => e.slug).sort(), ['c-au3', 'd-au4', 'd2-au5']);
  assert.equal(r.hepsi.length, 5);
});

test('CLI yardimcilari: karar verilmis paketler, slug dosyasi ve zaman suzgeci paketleri atlar', () => {
  const kok = path.join(gecici, 'cli'); const veri = path.join(kok, 'veri');
  for (const s of ['a-au1', 'b-au2', 'c-au3']) { const pk = path.join(veri, s, 'paket'); fs.mkdirSync(pk, { recursive: true }); fs.writeFileSync(path.join(pk, 'bilgi.json'), '{}'); fs.writeFileSync(path.join(veri, s, 'kapi.json'), JSON.stringify({ status: 'icerik-bekliyor' })); }
  fs.mkdirSync(path.join(kok, 'u1', 'karar', 'w2a'), { recursive: true }); fs.writeFileSync(path.join(kok, 'u1', 'karar', 'w2a', 'a-au1.json'), '{}');
  fs.writeFileSync(path.join(kok, 'haric.txt'), '# on bakista elenenler\nb-au2\n');
  assert.deepEqual([...kararVerilmis(kok)], ['a-au1']); assert.deepEqual([...kararVerilmis(path.join(kok, 'yok'))], []);
  assert.deepEqual([...slugDosyasi(path.join(kok, 'haric.txt'))], ['b-au2']);
  const dirs = paketleriBul(veri, { durum: 'icerik-bekliyor' }); assert.equal(dirs.length, 3);
  const kalan = paketSuz(dirs, { haric: new Set([...kararVerilmis(kok), ...slugDosyasi(path.join(kok, 'haric.txt'))]) });
  assert.deepEqual(kalan.map((d) => path.basename(path.dirname(d))), ['c-au3']);
  assert.equal(paketSuz(dirs, { yeniSonra: Date.now() + 60000 }).length, 0, 'gelecek zamandan eski hepsi atlanir');
  assert.equal(paketSuz(dirs, { yeniSonra: Date.now() - 600000 }).length, 3);
});

test('menu: yalniz icecek sekmesi / icecek menusu alinmis paket 6 yemek saymaz (kanit partisi: yemek sekmeleri pakette yok)', () => {
  const pk = path.join(gecici, 'icecek', 'paket'); fs.mkdirSync(path.join(pk, 'menu-kaynak'), { recursive: true });
  fs.writeFileSync(path.join(pk, 'menu-kaynak', 'sayfa.txt'), [['Iced Latte', 6], ['Cold Brew Coffee', 6.5], ['Fresh Orange Juice', 7], ['Mango Smoothie', 8.5], ['Chocolate Milkshake', 9], ['Lemon Lime Soda', 5], ['Sparkling Water', 4], ['Ginger Beer', 6]].map(([a, f]) => `[Cold Beverages] ${a}: $${f}`).join('\n'));
  const m = menuOlc(pk, { menu_kaynaklari: [] });
  assert.equal(m.kind, 'icecek'); assert.ok(m.icecek >= 6 && m.yemek < 6);
  assert.equal(puanla({ ...temel(), menu: m }).sert[0].k, 'menu');
  // yemek + icecek karisik menu gecer; "Tea Cake" gibi tek eslesme yemek sayisini dusurmez
  const pk2 = path.join(gecici, 'karisik', 'paket'); fs.mkdirSync(path.join(pk2, 'menu-kaynak'), { recursive: true });
  fs.writeFileSync(path.join(pk2, 'menu-kaynak', 'sayfa.txt'), [['Chicken Burger', 15], ['Beef Burger', 16], ['Caesar Salad', 14], ['Fish and Chips', 18], ['Margherita Pizza', 17], ['Tea Cake', 6], ['Banana Bread', 7], ['Flat White', 4.5], ['Latte', 4.5]].map(([a, f]) => `[Menu] ${a}: $${f}`).join('\n'));
  assert.equal(menuOlc(pk2, { menu_kaynaklari: [] }).kind, 'metin');
});
test('saat: ayni gunun kapanisi 1 saat farkli iki sayfa (8:30-16:00 / 8:30-15:00) celiski', () => {
  const c = saatCoz(saatGirdileri('Monday - Friday 8:30am - 4pm\nMonday - Friday 8:30am - 3pm'));
  assert.ok(c.celiski.length >= 1, JSON.stringify(c.celiski));
});
test('ana fotograf: yalniz tur uyumu (pakette stok kare yok) -> sert kurali gecer ama stok yamasi bekler; listede stok kare varsa hazir', () => {
  const f = (w, h, k = 'kendi') => ({ w, h, kaynak: k, uyum: 'uygun' });
  const bekleyen = puanla({ ...temel(), hero: heroOlc({ fotograflar: [f(1500, 1001)], sablon: 'v5', mutfak: 'malaysian', ad: 'Ornek' }) });
  assert.equal(bekleyen.gecer, true); assert.deepEqual(bekleyen.bekleyen, ['stok-yama']);
  const hazir = puanla({ ...temel(), hero: heroOlc({ fotograflar: [f(1500, 1001), f(1600, 1000, 'stok')], sablon: 'v5', mutfak: 'malaysian', ad: 'Ornek' }) });
  assert.deepEqual(hazir.bekleyen, []);
  const a = temel('a-au1', 'Alfa'); const b = { ...temel('b-au2', 'Beta'), hero: heroOlc({ fotograflar: [f(1500, 1001)], sablon: 'v5', mutfak: 'thai', ad: 'Beta' }) };
  const r = suzgec([a, b], { ilk: 5 });
  assert.deepEqual(r.liste.map((x) => x.slug), ['a-au1']); assert.deepEqual(r.stokBekleyen.map((x) => x.slug), ['b-au2']); assert.equal(r.gecenler.length, 2);
});
