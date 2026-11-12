// Pastane (12 Kas 2026): pastane, firin ve tatlici (shop=bakery|pastry|confectionery) tespit edilir ve sablonu (sablon-pastane) birlestigi icin
// pastane sablonuna gider.  Mevcut uc kategori (burger, burrito, pizza) kararlari degismez ve her zaman once denenir.  Ag yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sablonSec, kategoriOf, KATEGORILER, KANCA_KATEGORILER, SABLONLAR } from '../sablon-sec.mjs';
import { gerceklikler, sablonlar } from '../lib/slogan.mjs';

test('pastane sablonu birlesti: KATEGORILER ve SABLONLAR onu icerir, kanca listesi bos', () => {
  assert.deepEqual(KATEGORILER, ['burger', 'burrito', 'pizza', 'pastane']);
  assert.deepEqual(KANCA_KATEGORILER, []);
  assert.ok(SABLONLAR.includes('pastane'), 'uretici ve icerik denetimi pastane sablonunu kabul eder');
  assert.ok(!KATEGORILER.some((k) => KANCA_KATEGORILER.includes(k)));
});

test('tespit: OSM dukkan turu, cuisine, ad ve site metni pastane der', () => {
  // OSM shop etiketinden gelen tur (lead/sektorler.mjs restoran.tur)
  for (const tur of ['bakery', 'pastry shop', 'confectionery']) assert.equal(kategoriOf({ tur }).kategori, 'pastane', tur);
  assert.match(kategoriOf({ tur: 'bakery' }).neden, /OSM dukkan turu=bakery/);
  // cuisine
  for (const c of ['bakery', 'patisserie', 'pastry;coffee_shop', 'cake', 'dessert', 'donut', 'baklava']) assert.equal(kategoriOf({ cuisine: c }).kategori, 'pastane', c);
  // ad (Ingilizce ve Turkce)
  for (const ad of ['Rye Street Bakery', 'Maison Pâtisserie', 'Güzel Pastanesi', 'Çınar Tatlıcısı', 'Karaköy Baklavacısı', 'The Cake Shop', 'Crumbs Bakehouse']) assert.equal(kategoriOf({ ad }).kategori, 'pastane', ad);
  // site metni: en az 6 kez ve digerlerinin iki katindan fazla
  const metin = 'Fresh croissants and pastries every morning. Our cakes, cupcakes and macarons. Sourdough loaves. Brownies and doughnuts.';
  assert.equal(kategoriOf({ metin }).kategori, 'pastane');
  assert.equal(kategoriOf({ metin: 'cake cake cake' }).kategori, null, 'az gecen sozcuk karar vermez');
  // ipucu yoksa kategori yok; kafe, bar, dondurma pastane degildir
  for (const tur of ['cafe', 'bar', 'restaurant', 'ice cream shop', 'kebab house']) assert.equal(kategoriOf({ tur }).kategori, null, tur);
  assert.equal(kategoriOf({ cuisine: 'ice_cream' }).kategori, null);
});

test('mevcut uc kategori HER ZAMAN once: kanca eski kararlari degistirmez', () => {
  assert.equal(kategoriOf({ cuisine: 'bakery;pizza' }).kategori, 'pizza');
  assert.equal(kategoriOf({ cuisine: 'pizza', tur: 'bakery' }).kategori, 'pizza');
  assert.equal(kategoriOf({ ad: 'Pizza Bakery', tur: 'bakery' }).kategori, 'pizza');
  assert.equal(kategoriOf({ ad: 'Burger Bakery', cuisine: 'dessert' }).kategori, 'burger');
  assert.equal(kategoriOf({ ad: 'Taco Pastane' }).kategori, 'burrito');
  // bir pizzacinin menusundeki tatlilar onu pastane ya da v5 yapmaz: metin sayimi yalniz eski uc kategori uzerinden, pastane sonra
  const pizzaci = 'pizza margherita pizza pizzas wood-fired pizza pizza pizza cake cake cake cake cake cake';
  assert.equal(kategoriOf({ metin: pizzaci }).kategori, 'pizza');
  // pastane sozcugu 6+ ama pizza da cok: acik ustunluk yok, kategori yok
  assert.equal(kategoriOf({ metin: 'pizza pizza pizza pizza cakes cakes cakes cakes cakes cakes cakes' }).kategori, null);
});

test('sablonSec: pastane ve firin pastane sablonuna gider; digerleri aynen', () => {
  for (const lead of [
    { sektor: 'restoran', name: 'Rye Street', kind: 'bakery' },
    { sektor: 'restoran', name: 'Maison Sucre', kind: 'pastry shop' },
    { sektor: 'restoran', name: 'Sweet Corner', kind: 'confectionery' },
    { sektor: 'restoran', name: 'Kale Fırın', kind: 'bakery' },
    { sektor: 'restoran', name: 'Güzel Pastanesi', kind: 'restaurant' },
  ]) {
    const s = sablonSec(lead);
    assert.equal(s.sablon, 'pastane', lead.name); assert.equal(s.kategori, undefined, lead.name);
    assert.ok(SABLONLAR.includes(s.sablon), 'sablon her zaman uretici ve denetimin bildigi bir sablon');
  }
  // hazir listesi daraltilirsa (or. sablon geri cekilirse) ayni lead v5'e duser ve ipucunu tasir
  const eski = ['burger', 'burrito', 'pizza'];
  const g = sablonSec({ sektor: 'restoran', name: 'Rye Street', kind: 'bakery' }, null, eski);
  assert.equal(g.sablon, 'v5'); assert.equal(g.kategori, 'pastane'); assert.match(g.neden, /pastane.*henuz birlesmedi.*v5/);
  // kafe, bar, restoran, dondurma ve kebap: v5, kancasiz
  for (const kind of ['cafe', 'bar', 'restaurant', 'ice cream shop', 'kebab house']) { const s = sablonSec({ sektor: 'restoran', name: 'Lina Rooftop', kind }); assert.equal(s.sablon, 'v5', kind); assert.equal(s.kategori, undefined, kind); }
  // eski kararlar
  assert.equal(sablonSec({ sektor: 'restoran', name: 'Galway Grill', mutfak: 'burger;american', kind: 'burger joint' }).sablon, 'burger');
  assert.equal(sablonSec({ sektor: 'restoran', name: 'Pizza Pomodoro', kind: 'pizzeria' }).sablon, 'pizza');
  assert.equal(sablonSec({ sektor: 'restoran', name: 'Casa', mutfak: 'mexican' }).sablon, 'burrito');
  assert.equal(sablonSec({ sektor: 'konaklama', name: 'Bakery Lodge', kind: 'bakery' }).sablon, 'eski');
  assert.equal(sablonSec({ sektor: 'guzellik', name: 'Cake Nails' }).sablon, 'eski');
});

test('sablonSec: cikarici metninden de pastane (R.menu, R.ek)', () => {
  const R = { name: { n: 'Sade' }, tagline: 'Baked daily', ek: { paragraflar: ['Croissants, pastries and cakes made every morning.', 'Our sourdough loaves and cupcakes sell out by noon.'] }, menu: { items: [{ n: 'Almond croissant', cat: 'Pastries' }, { n: 'Carrot cake', cat: 'Cakes' }, { n: 'Brownie', cat: 'Cakes' }] } };
  const s = sablonSec({ sektor: 'restoran', name: 'Sade', kind: 'restaurant' }, R);
  assert.equal(s.sablon, 'pastane'); assert.match(s.neden, /sitenin metninde/);
});

test('slogan: yeni turlerin adi (EN ve TR); bilinmeyen tur restoran kalir', () => {
  const R = (kind, city) => ({ lead: { name: 'Zeta', kind, category: kind, lang: 'tr', city, sektor: 'restoran' }, name: { n: 'Zeta' }, address: { text: '' } });
  const trYer = (kind) => (sablonlar(gerceklikler(R(kind, 'Kadıköy'), 'tr'), 'tr').find((x) => x.id === 'tr-yer-tur') || {}).text;
  assert.match(trYer('bakery'), /fırın/); assert.match(trYer('pastry shop'), /pastane/); assert.match(trYer('confectionery'), /tatlıcı/);
  assert.match(trYer('ice cream shop'), /dondurmacı/); assert.match(trYer('kebab house'), /kebapçı/); assert.match(trYer('cafe'), /kafe/); assert.match(trYer('restaurant'), /restoran/);
  assert.match(trYer('burger joint'), /restoran/, 'eski davranis degismedi');
  // EN: ad icinde & varsa sitedeki kategori yolu kapali; yedek tur adi dogru olmali
  const en = (kind) => gerceklikler({ lead: { name: 'Salt & Flour', kind, category: kind, lang: 'en', city: 'Cork', sektor: 'restoran' }, name: { n: 'Salt & Flour' }, address: { text: '' } }, 'en').kindPhrase;
  assert.equal(en('bakery'), 'bakery'); assert.equal(en('pastry shop'), 'pastry shop'); assert.equal(en('confectionery'), 'confectionery'); assert.equal(en('ice cream shop'), 'ice cream shop');
  assert.equal(en('cafe'), 'café'); assert.equal(en('restaurant'), 'restaurant');
});
