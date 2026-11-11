// Notr etiketler: eski etiket esleme tablosu (ozel sozlukte) ve ozel varlik getirici.  Testler sahte tablo kullanir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eskiEtiketCoz, eskiDalCoz, eskiDosyaCoz } from '../etiket.mjs';
import { ozelGetir, izinliMi } from '../ozel-getir.mjs';

const T = { inceleyen: { 'eski-a': 'icerik-turu', 'eski-b': 'son-goz' }, anahtar: { eskiAlan: 'sonGoz', eskiIcerik: 'sonGozIcerik' }, dosya: { 'ESKI.json': 'SON-GOZ-KUTUSU.json' }, dal: [['eski/b-', 'karar/songoz-'], ['eski/a-', 'karar/icerik-']] };

test('eskiEtiketCoz: inceleyen degeri ve alan adlari derinde cevrilir; bilinmeyen deger ve yeni veri aynen kalir', () => {
  const k = { tur: 'son', karar: 'yayinla', inceleyen: 'eski-b', icerik: { tur: 'icerik', inceleyen: 'eski-a' }, liste: [{ eskiAlan: true }], eskiIcerik: { hero: '03' } };
  const y = eskiEtiketCoz(k, T);
  assert.equal(y.inceleyen, 'son-goz'); assert.equal(y.icerik.inceleyen, 'icerik-turu'); assert.deepEqual(y.liste, [{ sonGoz: true }]); assert.deepEqual(y.sonGozIcerik, { hero: '03' });
  assert.equal(eskiEtiketCoz({ inceleyen: 'son-goz' }, T).inceleyen, 'son-goz');
  assert.equal(eskiEtiketCoz({ inceleyen: 'baska' }, T).inceleyen, 'baska');
  assert.equal(eskiEtiketCoz(null, T), null);
  assert.deepEqual(eskiEtiketCoz({ inceleyen: 'eski-b' }, {}), { inceleyen: 'eski-b' }, 'tablo bossa degismez');
});

test('eskiDalCoz ve eskiDosyaCoz: eski onek yeni oneke, yeni ad aynen', () => {
  assert.equal(eskiDalCoz('eski/b-202611121432', T), 'karar/songoz-202611121432');
  assert.equal(eskiDalCoz('eski/a-202611121432', T), 'karar/icerik-202611121432');
  assert.equal(eskiDalCoz('karar/icerik-202611121432', T), 'karar/icerik-202611121432');
  assert.equal(eskiDosyaCoz('ESKI.json', T), 'SON-GOZ-KUTUSU.json'); assert.equal(eskiDosyaCoz('X.json', T), 'X.json');
});

test('ozelGetir: yalniz izinli yollar kopyalanir; izinsiz dosya varsa hicbir sey kopyalanmaz', () => {
  const k = fs.mkdtempSync(path.join(os.tmpdir(), 'ozel-kaynak-')); const h = fs.mkdtempSync(path.join(os.tmpdir(), 'ozel-hedef-'));
  try {
    const yaz = (f, t = 'x') => { fs.mkdirSync(path.dirname(path.join(k, 'motor', f)), { recursive: true }); fs.writeFileSync(path.join(k, 'motor', f), t); };
    yaz('mail/sablon.mjs'); yaz('uyarla/sablon-pizza/site.css'); yaz('uyarla/data/v5-elle.json', '{}'); yaz('inceleme/ornek/v5.json', '{}'); yaz('hat/ozel-sozluk.json', '{}'); yaz('hat/test/ozel-hat.test.mjs');
    assert.deepEqual(ozelGetir({ kaynak: k, hedef: h }), { dosya: 6 });
    assert.ok(fs.existsSync(path.join(h, 'uyarla', 'sablon-pizza', 'site.css')));
    yaz('hat/dongu.mjs');
    const h2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ozel-hedef2-'));
    assert.throws(() => ozelGetir({ kaynak: k, hedef: h2 }), /izinli listede olmayan/);
    assert.equal(fs.readdirSync(h2).length, 0, 'yarim kopya yok');
    fs.rmSync(h2, { recursive: true, force: true });
  } finally { fs.rmSync(k, { recursive: true, force: true }); fs.rmSync(h, { recursive: true, force: true }); }
  assert.ok(izinliMi('mail/sablon.mjs')); assert.ok(!izinliMi('mail/alt/x.mjs')); assert.ok(!izinliMi('hat/kuyruk.mjs')); assert.ok(!izinliMi('../disari.json'));
});
