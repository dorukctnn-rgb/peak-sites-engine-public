// Anadil duzeyinde Turkce (12 Kas 2026): ekler, cumle ici gun adlari, sablon nitelemeleri ve TR icerik denetimindeki "dusuk Turkce" listesi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { trBulunma } from '../lib/slogan.mjs';
import { trAyrilma, sayiAyrilmaEki, KM } from '../lib/kategori-metin.mjs';
import { DAYS, DAYS_CUMLE, T } from '../lib/metin.mjs';
import { trYapay } from '../restoran-icerik.mjs';

test('bulunma eki: kaynastirma n yalniz iyelikli birlesik adlarda', () => {
  const b = (p) => trBulunma(p).replace(/^.*’/, '');
  assert.equal(b('Kayseri'), 'de'); assert.equal(b('Denizli'), 'de'); assert.equal(b('Kastamonu'), 'da'); assert.equal(b('Bayraklı'), 'da');
  assert.equal(b('Konyaaltı'), 'nda'); assert.equal(b('Kaleiçi'), 'nde'); assert.equal(b('Beyoğlu'), 'nda'); assert.equal(b('Nişantaşı'), 'nda');
  assert.equal(b('Bağdat Caddesi'), 'nde'); assert.equal(b('Odunpazarı'), 'nda'); assert.equal(b('Eminönü'), 'nde');
  assert.equal(b('Beşiktaş'), 'ta'); assert.equal(b('Ürgüp'), 'te'); assert.equal(b('Kadıköy'), 'de'); assert.equal(b('Antalya'), 'da'); assert.equal(b('Tekirdağ'), 'da');
});

test('ayrilma eki sayinin okunusuna gore (fiyat ve yil)', () => {
  assert.equal(trAyrilma('₺450'), "₺450'den"); assert.equal(trAyrilma('₺90'), "₺90'dan"); assert.equal(trAyrilma('₺40'), "₺40'tan");
  assert.equal(trAyrilma('₺1.960'), "₺1.960'tan"); assert.equal(trAyrilma('₺1.000'), "₺1.000'den"); assert.equal(trAyrilma('450 TL'), "450 TL'den");
  assert.deepEqual([1971, 1963, 1990, 1966, 1980, 2000, 1945].map(sayiAyrilmaEki), ['den', 'ten', 'dan', 'dan', 'den', 'den', 'ten']);
  assert.equal(KM.tr.from('₺450'), "₺450'den başlayan fiyatlarla");
});

test('durum satirinda gun adi kucuk harf; tablo basliklari buyuk harf kalir', () => {
  assert.deepEqual(DAYS_CUMLE.tr, ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi']);
  assert.equal(DAYS.tr[1], 'Pazartesi'); assert.equal(DAYS_CUMLE.en[1], 'Monday');
  assert.equal(KM.tr.daysCumle[1], 'pazartesi'); assert.equal(KM.tr.days[1], 'Pazartesi'); assert.deepEqual(KM.en.daysCumle, KM.en.days);
  assert.equal(T.tr.menuLegend('Örnek Lokanta'), 'Yemekler ve fiyatlar Örnek Lokanta sitesinden alındı; güncel fiyat ve alerjen bilgisi için servis ekibine sorabilirsiniz.');
});

test('dusuk Turkce listesi canli sayfalardaki ornekleri yakalar, dogal cumleye dokunmaz', () => {
  for (const kotu of ['Lezzetli seçkilerimizi keşfedin', 'Şehirde köfteden yola çıkıldı; menü yıllar içinde zenginleşti.', 'Günlük tencereden ızgaraya',
    'Fiyatlar ornek.com menü sayfasındaki gibidir.', 'Rezervasyon kabul edilmemektedir.', 'Taze malzemeler; damak sulandıran bir hamburger',
    'Ürünleri kendi bahçemizde üretiyor ya da yerel olarak tedarik ediyoruz.', 'Derin yeşil bir tabakta çorba', 'Deniz mahsüllü mezeler', 'Doğum günü, yıldönümü ve nişan',
    '1985’ten bu güne', 'Kremamsı dokusuyla', 'Akışkan çikolatayla mono adet pasta', 'Yanında lahana turşu, zeytin', 'Günlük tencereden *ızgaraya*']) assert.ok(trYapay(kotu).length, kotu);
  for (const iyi of ['Menüden öne çıkanlar', 'Köftemizle tanındık; bugün menümüzde kebaptan balığa kadar pek çok lezzet var.', 'Çorbadan tatlıya',
    "Fiyatlar ornek.com'daki menüden alındı.", 'Rezervasyon almıyoruz.', 'Koyu yeşil bir tabakta çorba', 'Deniz mahsullü mezeler', 'Doğum günü, yıl dönümü ve nişan',
    '1985’ten bugüne', 'Kremsi dokusuyla', 'Yanında lahana turşusu, zeytin', 'Yanında turşu, salata ve ekmek']) assert.deepEqual(trYapay(iyi), [], iyi);
});
