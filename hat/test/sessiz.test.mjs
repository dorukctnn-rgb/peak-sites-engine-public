// hat/sessiz-ozet.mjs: herkese acik gunluge yalniz temizlenmis ozet satirlari gider.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ozetSatirlari, temizle, kirli } from '../sessiz-ozet.mjs';

test('sessiz ozet: yalniz onekli satirlar; slug ve e-posta benzeri deger "?"; metin dizisi adede doner', () => {
  const g = [
    'isletme: ornek-isletme-ie1234 kim@ornek.test',
    'DONGU BITTI ' + JSON.stringify({ tarandi: { 'IE-restoran': 4 }, uretim: { hazir: 1, 'bar-ie1234': 2 }, hata: ['osm IE: zaman asimi'] }),
    '# tests 5', '# pass 5', 'UYGULANDI {"hazir":1} -> calisma/son/liste.json', 'OZET https://ornek.test/x',
  ].join('\n');
  const s = ozetSatirlari(g);
  assert.deepEqual(s, ['DONGU BITTI {"tarandi":{"IE-restoran":4},"uretim":{"hazir":1,"?":2},"hata":1}', '# tests 5', '# pass 5', 'UYGULANDI {"hazir":1}', 'OZET ?']);
  assert.ok(!s.join('\n').includes('@'));
});

test('sessiz ozet: temizle ve kirli', () => {
  assert.deepEqual(temizle({ a: ['x', 'y'], b: [{ c: 'kim@x.test' }], d: 'kisa', e: 'x'.repeat(41) }), { a: 2, b: [{ c: '?' }], d: 'kisa', e: '?' });
  assert.ok(kirli('lara-tr0042')); assert.ok(kirli('www.ornek.test')); assert.ok(!kirli('gozden-gecir'));
});
