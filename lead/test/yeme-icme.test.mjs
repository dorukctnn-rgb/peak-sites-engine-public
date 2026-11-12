// Yeme-icme odagi (12 Kas 2026): restoran ailesi OSM etiketleri (kafe, dondurma, pastane, firin, tatlici), tur adlari, zincir ve toptan elemesi, TR ayni aile.  Ag yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sorgu, leadOf, elenme } from '../osm.mjs';
import { SEKTORLER, ULKELER, SEKTOR_ZINCIR, TR_ZINCIR } from '../sektorler.mjs';

const el = (tags, id = 777001) => ({ type: 'node', id, lat: 36.9, lon: 30.7, tags: { website: 'https://isletme.example', ...tags } });
const lead = (tags, ulke = 'IE') => leadOf(el(tags), ulke, 'restoran');

test('osm sorgusu: restoran ailesi amenity (restaurant, fast_food, bar, pub, cafe, ice_cream) ve shop (bakery, pastry, confectionery); website sart', () => {
  const q = sorgu('IE', 'restoran');
  assert.match(q, /amenity"~"\^\(restaurant\|fast_food\|bar\|pub\|cafe\|ice_cream\)\$"/);
  assert.match(q, /shop"~"\^\(bakery\|pastry\|confectionery\)\$"/);
  // her etiket kumesi icin ayri nwr satiri ve ikisinde de website filtresi
  const satirlar = q.match(/nwr\[[^;]+;/g) || [];
  assert.equal(satirlar.length, 2);
  for (const s of satirlar) assert.match(s, /\["website"\]\(area\.a\);$/);
  // TR il kodu ve ulke alani
  assert.match(sorgu('TR', 'restoran', { alan: 'TR-07' }), /area\["ISO3166-2"="TR-07"\]->\.a;/);
  assert.match(sorgu('TR', 'restoran'), /area\["ISO3166-1"="TR"\]\[admin_level=2\]->\.a;/);
  // eski etiketler duruyor
  for (const t of ['restaurant', 'fast_food', 'bar', 'pub']) assert.ok(SEKTORLER.restoran.osm.join(' ').includes(t), t);
});

test('TR: restoran anahtari yeme-icme ailesinin tamami; ayri TR sektoru yok', () => {
  assert.deepEqual(ULKELER.TR.yalnizSektor, ['restoran']);
  assert.match(SEKTORLER.restoran.ad, /kafe/); assert.match(SEKTORLER.restoran.ad, /pastane/); assert.match(SEKTORLER.restoran.ad, /fırın/); assert.match(SEKTORLER.restoran.ad, /bar/);
  // TR'de pastane, firin, kafe, bar bu aile icinde lead olur
  for (const [tags, tur] of [[{ name: 'Güzel Pastane', shop: 'pastry' }, 'pastry shop'], [{ name: 'Kale Fırın', shop: 'bakery' }, 'bakery'], [{ name: 'Çınar Kafe', amenity: 'cafe' }, 'cafe'], [{ name: 'Liman Bar', amenity: 'bar' }, 'bar'], [{ name: 'Tatlıcı Hasan', shop: 'confectionery' }, 'confectionery']]) {
    const l = lead(tags, 'TR'); assert.equal(l.ulke, 'TR'); assert.equal(l.sektor, 'restoran'); assert.equal(l.tur, tur, tags.name); assert.equal(l.elendi, null, tags.name);
  }
});

test('tur adlari: dukkan etiketi once; sonra burger, pizza, Meksika, kebap; sonra kafe, bar, restoran', () => {
  const tur = (tags) => lead(tags).tur;
  assert.equal(tur({ name: 'Rye Street', shop: 'bakery' }), 'bakery');
  assert.equal(tur({ name: 'Maison Sucre', shop: 'pastry' }), 'pastry shop');
  assert.equal(tur({ name: 'Sweet Corner', shop: 'confectionery' }), 'confectionery');
  assert.equal(tur({ name: 'Cone Club', amenity: 'ice_cream' }), 'ice cream shop');
  assert.equal(tur({ name: 'Bean Counter', amenity: 'cafe' }), 'cafe');
  assert.equal(tur({ name: 'The Harbour Bar', amenity: 'bar' }), 'bar');
  assert.equal(tur({ name: 'The Old Pub', amenity: 'pub' }), 'bar');
  assert.equal(tur({ name: 'Anatolia Grill', amenity: 'restaurant', cuisine: 'kebab' }), 'kebab house');
  assert.equal(tur({ name: 'Liman Dönerci', amenity: 'fast_food' }), 'kebab house');
  assert.equal(tur({ name: 'Smash Bros', amenity: 'fast_food', cuisine: 'burger' }), 'burger joint');
  assert.equal(tur({ name: 'Napoli', amenity: 'restaurant', cuisine: 'pizza' }), 'pizzeria');
  assert.equal(tur({ name: 'Casa', amenity: 'restaurant', cuisine: 'mexican' }), 'burrito and taco bar');
  assert.equal(tur({ name: 'Lina', amenity: 'restaurant' }), 'restaurant');
  // dukkan etiketi amenity'den once: kafe de olan firin firindir
  assert.equal(tur({ name: 'Crumb', shop: 'bakery', amenity: 'cafe' }), 'bakery');
  // lead satiri dukkan ve amenity alanlarini tasir (hat/dongu.mjs listeEtiketEski bunu okur)
  const l = lead({ name: 'Crumb', shop: 'bakery' }); assert.equal(l.dukkan, 'bakery'); assert.equal(l.amenity, null);
  const m = lead({ name: 'Lina', amenity: 'restaurant' }); assert.equal(m.dukkan, null); assert.ok('dukkan' in m);
  // restoran disi sektorlerin lead satiri degismedi
  assert.ok(!('dukkan' in leadOf(el({ name: 'Rose Cottage', tourism: 'guest_house' }), 'IE', 'konaklama')));
});

test('zincir ve franchise elemesi kafe, firin, dondurma ve pub icin de calisir; eski adlar durur', () => {
  const ele = (name, tags = {}, ulke = 'IE') => leadOf(el({ name, amenity: 'cafe', ...tags }), ulke, 'restoran').elendi;
  for (const ad of ['Starbucks Grafton Street', 'Costa Coffee Cork', 'Greggs', 'Gloria Jean\'s Coffees Sydney', 'Bakers Delight Parramatta', 'Brumby\'s Bakery Perth', 'Banjo\'s Bakery Cafe', 'Krispy Kreme Dublin', 'Gail\'s Bakery Hampstead', 'Baskin-Robbins Auckland', 'BrewDog Cardiff', 'Hungry Horse Leeds', 'The Coffee Club Brisbane', 'Ya Kun Kaya Toast', 'Paris Baguette Orchard']) {
    assert.match(ele(ad) || '', /zincir/, ad);
  }
  for (const ad of ['McDonald\'s', 'Nando\'s Dublin', 'Pizza Hut', 'Subway', 'Five Guys']) assert.match(ele(ad, { amenity: 'fast_food' }) || '', /zincir/, ad);
  for (const ad of ['Simit Sarayı Kadıköy', 'Kahve Dünyası Nişantaşı', 'MADO Bağdat Caddesi', 'Divan Pastaneleri', 'Karaköy Güllüoğlu', 'Baskin Robbins Ankara', 'Halk Ekmek Büfesi', 'Ekmek Fabrikası Antalya', 'Hafız Mustafa 1864', 'Starbucks Alsancak']) {
    assert.match(ele(ad, {}, 'TR') || '', /zincir/, ad);
  }
  // marka etiketi olan sube her zaman elenir
  assert.match(ele('Corner Beans', { brand: 'Corner Beans' }) || '', /zincir/);
  assert.match(ele('Corner Beans', { 'brand:wikidata': 'Q1' }) || '', /zincir/);
  // bagimsiz isletme kalir
  for (const [ad, tags, ulke] of [['Sunrise Cafe', {}, 'IE'], ['Rye Street Bakery', { shop: 'bakery', amenity: undefined }, 'GB'], ['Maison Sucre', { shop: 'pastry', amenity: undefined }, 'AU'], ['Cone Club', { amenity: 'ice_cream' }, 'NZ'], ['The Wren Pub', { amenity: 'pub' }, 'IE'], ['Güzel Pastane', { shop: 'pastry', amenity: undefined }, 'TR'], ['Çınar Kafe', {}, 'TR']]) {
    assert.equal(ele(ad, tags, ulke), null, ad);
  }
  // regexler dogrudan: yaygin sozcuklerle yanlis alarm yok
  for (const ad of ['Old Pub', 'Joe\'s Bakery', 'Sunrise Cafe', 'Wonderwall Cafe', 'Paul\'s Place', 'Brew House', 'The Crown Inn']) assert.ok(!SEKTOR_ZINCIR.test(ad), ad);
  for (const ad of ['Güzel Pastane', 'Kale Fırın', 'Çınar Tatlıcısı', 'Çınar Kafe', 'Liman Bar']) assert.ok(!TR_ZINCIR.test(ad), ad);
});

test('toptan, fabrika ve malzeme tedarikcisi pastane sayilmaz; kantin ve otel elemesi durur', () => {
  const ele = (name, tags = {}, ulke = 'IE') => leadOf(el({ name, shop: 'bakery', ...tags }), ulke, 'restoran').elendi;
  for (const ad of ['Bakery Wholesale Ltd', 'Cake Supplies Direct', 'Artisan Bread Factory', 'Crumb Distributors']) assert.match(ele(ad) || '', /toptan|fabrika|tedarik/, ad);
  for (const ad of ['Börek Fabrikası Antalya', 'Toptan Pasta Evi', 'Imalatçı Fırın']) assert.match(ele(ad, {}, 'TR') || '', /toptan|fabrika|tedarik/, ad);
  assert.equal(ele('Rye Street Bakery'), null);
  assert.match(ele('University Bakery') || '', /restoran degil/);
  assert.match(elenme({ amenity: 'cafe' }, 'Resort Cafe', 'https://x.example', 'restoran') || '', /restoran degil/);
  // konaklama ve guzellik elemesi bu sozcuklerden etkilenmez
  assert.equal(elenme({ tourism: 'guest_house' }, 'Wholesale Lodge', 'https://x.example', 'konaklama'), null);
  // kapali isletme: disused:shop
  assert.match(elenme({ 'disused:shop': 'bakery' }, 'Old Crust', 'https://x.example', 'restoran') || '', /kapali/);
});
