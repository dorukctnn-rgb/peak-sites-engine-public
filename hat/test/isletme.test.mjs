// Ayni isletme, baska adresle de olsa ikinci kez yazilmaz (hat/isletme.mjs).  Saf islevler: ozel varlik, ag, dosya yok.  Butun adlar, siteler, telefonlar ve adresler uydurmadir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normYazi, normAd, telAnahtarlari, osmAnahtarlari, siteAnahtari, metindekiSiteler, kimlik, leadKimligi, satirKimligi, indeksOlustur, isletmeIndeksi, bizAlani } from '../isletme.mjs';

const giden = (id, durum = 'sent', kampanya = 'websites') => ({ ts: '2026-11-05T10:00:00Z', id, to: 'ilk.adres@gmail.com', campaign: kampanya, region: 'TR', status: durum });
const satir = (o) => ({ id: 'WS-TR-901', to: 'ilk.adres@gmail.com', name: 'Ornek Lokanta', campaign: 'websites', region: 'TR', subject: 's', body: 'b', ...o });

test('ad: harf boyu, aksan, Turkce harf, bosluk ve dolgu sozcukleri farketmez; yalniz dolgudan olusan ad onlari korur; iki harf ad degildir', () => {
  assert.equal(normYazi('Köşe BURGER & Çay Evi İstanbul'), 'kose burger and cay evi istanbul');
  assert.equal(normAd('Ornek Lokanta Restaurant'), normAd('ORNEKLOKANTA'));
  assert.equal(normAd('The Corner Cafe'), normAd('Corner'));
  assert.equal(normAd('Bar'), 'bar');
  assert.equal(normAd('Ab'), '');
  assert.equal(normAd('Şişli Köftecisi'), normAd('SISLI KOFTECISI'));
});

test('telefon: bicim ne olursa olsun son 9 hane; kisa, tek rakam tekrari ve numara listesi', () => {
  assert.deepEqual([...telAnahtarlari('+90 (212) 555 01 02')], ['125550102']);
  assert.deepEqual([...telAnahtarlari('0212 555 0102')], [...telAnahtarlari('+90 212 555 01 02')]);
  assert.equal(telAnahtarlari('555 0102').size, 0);
  assert.equal(telAnahtarlari('000000000').size, 0);
  assert.equal(telAnahtarlari('+90 212 555 01 02; 0532 111 22 33').size, 2);
  assert.equal(telAnahtarlari(undefined).size, 0);
});

test('OSM: baglantidan ve duz kimlikten, buyuk kucuk harf farketmez', () => {
  assert.deepEqual([...osmAnahtarlari('https://www.openstreetmap.org/node/900001 ve WAY/123456 ve way/42')].sort(), ['node/900001', 'way/123456']);
  assert.equal(osmAnahtarlari('nesne yok').size, 0);
});

test('site: isletmenin kendi alan adi; www, yol ve alt alan katlanir; ortak sayfa sayfa basina; harita, liste ve kendi sayfalarimiz kimseye ait degil', () => {
  assert.equal(siteAnahtari('https://www.Ornek.com/menu?x=1'), 'ornek.com');
  assert.equal(siteAnahtari('http://shop.ornek.co.uk/a'), 'ornek.co.uk');
  assert.equal(siteAnahtari('www.orneklokanta.test'), 'orneklokanta.test');
  assert.equal(siteAnahtari('https://www.facebook.com/ornek.lokanta/'), 'facebook.com/ornek.lokanta');
  assert.equal(siteAnahtari('https://www.facebook.com/'), '');
  assert.equal(siteAnahtari('https://www.instagram.com/p/abc123/'), '');
  assert.equal(siteAnahtari('https://ornek.wixsite.com/ornek'), 'ornek.wixsite.com');
  assert.equal(siteAnahtari('https://www.openstreetmap.org/node/1'), '');
  assert.equal(siteAnahtari('https://peakappsstudio.com/web/demo/r/x-123456/'), '');
  assert.equal(siteAnahtari('site degil'), '');
  assert.deepEqual([...metindekiSiteler('ornek.ie ana sayfa, iletisim bolumu (E MAIL x@x.test)')], ['ornek.ie']);
  assert.deepEqual([...metindekiSiteler('https://www.orneklokanta.test/ (ana sayfa metni)')], ['orneklokanta.test']);
  assert.equal(metindekiSiteler('iletisim sayfasi').size, 0);
  assert.equal(metindekiSiteler('metin.txt satir 47').size, 0);
});

test('kuyruk satiri: _biz, _city, evidence, kaynak satiri ve WH- kimliginden OSM nesnesi', () => {
  const k = satirKimligi(satir({ id: 'WH-AU-n1001', region: 'AU', _biz: { site: 'orneklokanta.test', phone: '0212 555 0102', city: 'Sydney' }, evidence: { phone: '0312 444 33 22' }, _email_source: 'ornek.ie ana sayfa' }));
  assert.deepEqual([...k.site].sort(), ['orneklokanta.test', 'ornek.ie'].sort());
  assert.deepEqual([...k.tel].sort(), ['124443322', '125550102']);
  assert.deepEqual([...k.osm], ['node/1001']);
  assert.ok(k.sehirler.has('sydney') && k.bolge === 'AU');
  assert.deepEqual([...satirKimligi(satir({ id: 'WH-IE-w555777' })).osm], ['way/555777']);
  assert.equal(satirKimligi(null).adlar.size, 0);
});

test('indeks: giden ve serbest kuyruk satiri engeller, eski bekleyen satir engellemez, bekleyen demo satiri engeller; satir kimligi basina tek kayit', () => {
  const idx = isletmeIndeksi({
    sent: [giden('WS-TR-901', 'pending'), giden('WS-TR-901', 'sent'), giden('WS-TR-903', 'pending'), giden('G-1', 'sent', 'golf')],
    queue: [satir(), satir({ id: 'WS-TR-903', name: 'Bekleyen Yer', evidence: { site: 'https://bekleyen.test/' } }),
      satir({ id: 'WS-TR-904', name: 'Eski Bekleyen', _held: 'x', evidence: { site: 'https://eskibekleyen.test/' } }),
      satir({ id: 'WH-AU-n2002', campaign: 'websites-demo', name: 'Hat Bekleyen', region: 'AU', _held: 'hat', _biz: { site: 'hatbekleyen.test' } }),
      satir({ id: 'WD-TR-6', campaign: 'websites-demo-tr', name: 'Demo Serbest', _biz: { phone: '0212 777 88 99' } }),
      satir({ id: 'G-1', campaign: 'golf', name: 'Golf Kulubu', evidence: { site: 'https://golf.test/' } })],
  });
  const bul = (o) => idx.bul(kimlik(o));
  assert.deepEqual(bul({ site: 'https://www.ornek.test/' }), null);
  assert.equal(bul({ site: 'https://bekleyen.test/' }).id, 'WS-TR-903');
  assert.equal(bul({ site: 'https://eskibekleyen.test/' }), null, 'eski websites bekleyen satiri hic engellemez');
  assert.equal(bul({ site: 'https://hatbekleyen.test/' }).durum, 'bekleyen', 'hattin kendi bekleyen satiri engeller');
  assert.equal(bul({ tel: '+90 212 777 88 99' }).id, 'WD-TR-6');
  assert.equal(bul({ site: 'https://golf.test/' }), null, 'baska kampanya websites ailesi degil');
  assert.equal(bul({ osm: 'node/2002' }).id, 'WH-AU-n2002', 'WH- kimliginden OSM nesnesi');
  assert.equal(idx.kayitlar.filter((e) => e.id === 'WS-TR-901').length, 1);
});

test('ad kurali: ayni ad ve ayni sehir; ya da sehir yalniz bir tarafta bilinir ve bolge ayni; iki tarafta da sehir yoksa, baska sehir ya da baska bolge karsilastirilmaz', () => {
  const idx = indeksOlustur();
  idx.ekle(kimlik({ ad: 'Ada Lokanta', bolge: 'TR', sehir: 'İzmir' }), { id: 'A', kampanya: 'websites', durum: 'giden' });
  idx.ekle(kimlik({ ad: 'Nehir Cafe', bolge: 'TR' }), { id: 'B', kampanya: 'websites', durum: 'giden' });
  idx.ekle(kimlik({ ad: 'Liman Kebap', bolge: 'TR' }), { id: 'C', kampanya: 'websites', durum: 'giden' });
  const f = (o) => idx.bul(kimlik(o));
  assert.equal(f({ ad: 'ADA LOKANTA', bolge: 'TR', sehir: 'Izmir' }).neden, 'ad+sehir');
  assert.equal(f({ ad: 'Ada Lokanta', bolge: 'TR', sehir: 'Ankara' }), null);
  assert.equal(f({ ad: 'Ada Lokanta', bolge: 'GB', sehir: 'İzmir' }), null);
  assert.equal(f({ ad: 'Ada Lokanta', bolge: 'TR' }).neden, 'ad');
  assert.equal(f({ ad: 'Nehir', bolge: 'TR', sehir: 'Bursa' }).id, 'B');
  assert.equal(f({ ad: 'Liman Kebap', bolge: 'TR' }), null);
});

test('lead kimligi: ad, bolge, sehir, ilce, site (taramadaki son adres de), telefon, OSM; bizAlani yalniz dolu alanlari yazar', () => {
  const k = leadKimligi({ name: 'Ornek Lokanta', ulke: 'TR', city: 'Ankara', ilce: 'Cankaya', website: 'http://www.orneklokanta.test/', finalUrl: 'https://orneklokanta.test/menu', phone: '+90 312 555 01 02', osm: 'node/900001' });
  assert.deepEqual([...k.site], ['orneklokanta.test']); assert.deepEqual([...k.osm], ['node/900001']); assert.equal(k.tel.size, 1);
  assert.ok(k.sehirler.has('ankara') && k.sehirler.has('cankaya')); assert.equal(k.bolge, 'TR');
  assert.deepEqual(bizAlani(k, 'Ankara'), { site: 'orneklokanta.test', phone: [...k.tel][0], osm: 'node/900001', city: 'Ankara' });
  assert.equal(bizAlani(kimlik({ ad: 'Yalniz Ad' }), ''), null);
  assert.equal(leadKimligi(null).adlar.size, 0);
});
