// SOKAK LEZZETI yonlendirmesi (12 Kas 2026, yonetici karari: her isletmeye tek demo, stil turune gore).  Rahat ya da hizli yeme-icme -> sokak (burger sablonunun
// varyanti); oturmali restoran, ocakbasi, meyhane, balik -> v5; burger, pizza, burrito/taco ve pastane kararlari degismez.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sablonSec, kategoriOf, sokakUygun, KATEGORILER, SABLONLAR, ONCELIK, oncelik } from '../sablon-sec.mjs';
import { SOKAK_AD, OTURMALI_AD, SOKAK_MUTFAK } from '../../lead/sektorler.mjs';
import { isletmeTuru } from '../lib/foto-uyum.mjs';
import { leadKategori, leadOncelik, leadPB } from '../../hat/on-eleme.mjs';
import { denetle } from '../restoran-icerik.mjs';

test('sokak sablonu kategori listesinde; oncelik: burger en onde, sonra sokak/pizza/burrito, sonra digerleri', () => {
  assert.ok(KATEGORILER.includes('sokak')); assert.ok(SABLONLAR.includes('sokak'));
  assert.equal(oncelik('burger'), 0);
  for (const k of ['sokak', 'pizza', 'burrito']) assert.equal(oncelik(k), 1, k);
  for (const k of ['pastane', null, undefined]) assert.equal(oncelik(k), 2, String(k));
  assert.ok(Object.values(ONCELIK).every((v) => v >= 0));
});

test('OSM mutfak etiketi: kebap, doner, shawarma, lahmacun, pide ... sokak; amenity=restaurant ise adinda sokak sozcugu sart', () => {
  for (const c of ['kebab', 'doner', 'döner', 'shawarma', 'gyros', 'falafel', 'lahmacun', 'pide', 'turkish_pizza', 'kokoreç', 'cig_kofte', 'kumpir', 'fried_chicken', 'kebab;turkish']) assert.equal(kategoriOf({ cuisine: c }).kategori, 'sokak', c);
  assert.equal(kategoriOf({ cuisine: 'kebab', amenity: 'fast_food', ad: 'Corner Grill' }).kategori, 'sokak');
  const o = kategoriOf({ cuisine: 'kebab', amenity: 'restaurant', ad: 'Anatolia Grill' });
  assert.equal(o.kategori, null, 'oturmali kebap restorani v5'); assert.match(o.neden, /oturmali/);
  assert.equal(kategoriOf({ cuisine: 'kebab', amenity: 'restaurant', ad: 'Liman Dönerci' }).kategori, 'sokak', 'adinda sokak sozcugu');
  for (const c of ['turkish', 'mediterranean', 'regional', 'italian']) assert.equal(kategoriOf({ cuisine: c }).kategori, null, c);
});

test('isletme adi: Turkce ekleriyle sokak sozcukleri; oturmali isareti v5', () => {
  for (const ad of ['Deniz Pide ve Lahmacun', 'Kardesler Kebab', 'Liman Dönerci', 'Çiğköfteci Ali Usta', 'Kokoreççi Tayfun', 'Kumpirci Deniz', 'Tostçu Erol', 'Falafel Corner', 'Yaprak Döner Salonu', 'Shawarma Station', 'Gyros Bar', 'Dürümcü Hasan', 'Pideci Mehmet', 'Tavukçu Necati']) assert.equal(kategoriOf({ ad }).kategori, 'sokak', ad);
  for (const ad of ['Adana Ocakbaşı', 'Kebap Restaurant', 'Hamdi Restoran', 'Döner Lokantası', 'Kebab Bistro', 'Balıkçı Kemal Döner']) { const k = kategoriOf({ ad }); assert.equal(k.kategori, null, ad); }
  // yanlis pozitif yok: "durum" bugday, "pidemiz" degil "pide" kokune bakilir, ingilizce "toast" kafe
  for (const ad of ['Durum Pasta Bar', 'Toast Cafe', 'Kebabian Books']) assert.equal(kategoriOf({ ad }).kategori, null, ad);
  assert.ok(SOKAK_AD.test('KEBAPÇI İSKENDER')); assert.ok(OTURMALI_AD.test('Ocakbaşı')); assert.ok(SOKAK_MUTFAK.test('shawarma'));
  assert.equal(sokakUygun({ ad: 'Kardesler Kebab', amenity: 'restaurant' }), true); assert.equal(sokakUygun({ ad: 'Grill House', amenity: 'restaurant' }), false); assert.equal(sokakUygun({ ad: 'Grill House', amenity: 'fast_food' }), true);
});

test('eski kararlar degismez: burger, pizza, burrito once; pastane dukkan etiketi sokak adindan once', () => {
  assert.equal(kategoriOf({ ad: 'Burger & Kebab House' }).kategori, 'burger');
  assert.equal(kategoriOf({ ad: 'Pizza Kebab Corner' }).kategori, 'pizza');
  assert.equal(kategoriOf({ ad: 'Taco Döner' }).kategori, 'burrito');
  assert.equal(kategoriOf({ cuisine: 'kebab;pizza' }).kategori, 'pizza');
  assert.equal(kategoriOf({ ad: 'Karaköy Baklavacısı' }).kategori, 'pastane');
  assert.equal(kategoriOf({ ad: 'Ekmek ve Pide Fırını', tur: 'bakery' }).kategori, 'pastane', 'firin etiketi');
  assert.equal(kategoriOf({ cuisine: 'bakery;kebab' }).kategori, 'pastane', 'ilk mutfak etiketi karar verir');
});

test('sitenin metni: sokak sozcukleri en az 6 kez ve oteki turlerin iki katindan fazla', () => {
  const metin = 'Lahmacun 210 TL. Kaşarlı Pide 350 TL. Kıymalı Pide 475 TL. Kuşbaşılı Pide 520 TL. Karışık Pide 540 TL. Ayran. Döner dürüm 300 TL.';
  assert.equal(kategoriOf({ metin }).kategori, 'sokak');
  assert.equal(kategoriOf({ metin, amenity: 'restaurant', ad: 'Ege Sofrası' }).kategori, null, 'oturmali');
  assert.equal(kategoriOf({ metin: 'kebab kebab kebab' }).kategori, null, 'az gecen sozcuk karar vermez');
  assert.equal(kategoriOf({ metin: 'kebab kebab kebab kebab kebab kebab burger burger burger burger' }).kategori, null, 'acik ustunluk yok');
});

test('sablonSec: sokak lezzeti sokak sablonuna; oturmali v5; sablon birlesmemisse v5 + kategori ipucu', () => {
  assert.equal(sablonSec({ sektor: 'restoran', name: 'Kardesler Kebab', kind: 'kebab house', amenity: 'fast_food' }).sablon, 'sokak');
  assert.equal(sablonSec({ sektor: 'restoran', name: 'Deniz Pide ve Lahmacun', kind: 'restaurant' }).sablon, 'sokak');
  const v = sablonSec({ sektor: 'restoran', name: 'Anatolia Grill', amenity: 'restaurant', mutfak: 'kebab', kind: 'kebab house' });
  assert.equal(v.sablon, 'v5'); assert.match(v.neden, /oturmali/);
  const g = sablonSec({ sektor: 'restoran', name: 'Kardesler Kebab' }, null, ['burger', 'burrito', 'pizza', 'pastane']);
  assert.equal(g.sablon, 'v5'); assert.equal(g.kategori, 'sokak');
  assert.equal(sablonSec({ sektor: 'konaklama', name: 'Kebab Lodge' }).sablon, 'eski');
  assert.equal(sablonSec({ sektor: 'restoran', name: 'Galway Grill', mutfak: 'burger;american', kind: 'burger joint' }).sablon, 'burger');
});

test('foto uyumu ve on eleme sokak turunu tanir', () => {
  assert.equal(isletmeTuru({ sablon: 'sokak' }), 'kebap');
  assert.equal(isletmeTuru({ sablon: 'v5', kategori: 'sokak' }), 'kebap');
  assert.equal(leadKategori({ name: 'Liman Dönerci', amenity: 'fast_food' }), 'sokak');
  assert.equal(leadOncelik({ name: 'Liman Dönerci' }), 1); assert.equal(leadOncelik({ name: 'Burger Lane' }), 0);
  assert.equal(leadPB({ name: 'Liman Dönerci' }), false); assert.equal(leadPB({ name: 'Quay Pizza Co' }), true);
});

test('icerik kapisi (sokak): urun seridi ve menude fotograf yalniz menudeki kalemlerden ve kendi kesimlerinden; kayan yazi yok', () => {
  const kal = ['Kaşarlı Pide (Açık)', 'Kuşbaşılı Pide (Açık)', 'Mevlana Pide (Açık)', 'Lahmacun', 'Çoban Salata', 'Künefe'].map((n, i) => ({ n, p: `${200 + i * 10} TL` }));
  const karar = (ic) => ({ tur: 'icerik', karar: 'icerik', sablon: 'sokak', inceleyen: 'icerik-turu', dil: 'tr', hero: { id: '01', gerekce: 'x' }, menu: { kalemler: kal, kaynak: { tur: 'sayfa', url: 'https://x.example/' } }, eylem: { tur: 'siparis', url: 'https://x.example/siparis' }, icerik: { kategori: 'sokak', aday: [{ text: 'Lezzetler *paylaştıkça güzeldir.*' }], ...ic }, gozlem: { metin: 'Sitede menü yalnızca en altta duruyor ve fiyatlar küçük yazıyla veriliyor.', kanit: 'once-390.jpg' } });
  const sok = (ic) => denetle(karar(ic)).filter((h) => /urunler|menuFoto|kayan yazi/.test(h));
  assert.deepEqual(sok({ urunler: [{ kesme: 'k01', n: 'Kaşarlı Pide (Açık)' }, { kesme: 'k02', n: 'kuşbaşılı pide (açık)' }, { kesme: 'k03', n: 'Mevlana Pide (Açık)' }], menuFoto: { 'Lahmacun': 'k04' } }), []);
  assert.match(sok({ urunler: [{ kesme: 'k01', n: 'Uydurma Pide' }, { kesme: 'k02', n: 'Lahmacun' }, { kesme: 'k03', n: 'Künefe' }] }).join(' | '), /menude yok: Uydurma Pide/);
  assert.match(sok({ urunler: [{ kesme: 'stok-1', n: 'Lahmacun' }, { kesme: 'k02', n: 'Künefe' }, { kesme: 'k03', n: 'Çoban Salata' }] }).join(' | '), /kendi kesimi/);
  assert.match(sok({ urunler: [{ kesme: 'k01', n: 'Lahmacun' }] }).join(' | '), /en az 3/);
  assert.match(sok({ menuFoto: { 'Yok Böyle': 'k01' } }).join(' | '), /menuFoto menude yok/);
  assert.match(sok({ devYazi: ['Pide'] }).join(' | '), /kayan yazi seridi yok/);
});
