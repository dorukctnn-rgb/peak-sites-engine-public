// Odul/rozet grafikleri isletme fotografi sayilmaz; gercek fotograflar elenmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rozetMi } from '../lib/rozet.mjs';

test('rozetMi: odul, sertifika, puan rozeti ve hediye karti elenir', () => {
  assert.equal(rozetMi('Best Beauty Salon Finalist PHB Awards 2022', 'https://x.ie/IMG_5009.JPG?format=2500w'), true);
  assert.equal(rozetMi('Phorest 5* Client Experience Gold Award', 'https://x.ie/phorest+5+year+2023.PNG'), true);
  assert.equal(rozetMi('Best Beauty & Makeup Team of the Year (Regional Winner)', 'https://x.ie/IRISH+MAKEUP+24+REGIONAL.jpg'), true);
  assert.equal(rozetMi('', 'https://x.ie/wp-content/uploads/our-award-2023.png'), true, 'dosya adinda odul');
  assert.equal(rozetMi('Gift voucher', 'https://x.ie/a.jpg'), true);
});

test('rozetMi: gercek fotograflar elenmez', () => {
  assert.equal(rozetMi('', 'https://x.ie/IMG_3843+%281%29.webp?format=2500w'), false);
  assert.equal(rozetMi('Garden room with a fireplace', 'https://x.ie/garden-room.jpg'), false);
  assert.equal(rozetMi('Our colour bar', 'https://x.ie/salon-interior.jpg'), false);
  assert.equal(rozetMi(null, null), false);
});
