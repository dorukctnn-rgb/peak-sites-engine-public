// Konaklama sektoru testleri: rezervasyon motoru, oda bulma, olanaklar, giris/cikis, kapi kurali.  Ag yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rezervasyonMotoru, gomuluMotor, otaVar, odaLinkleri, odalarBul, olanaklar, girisCikis, model, kapiKural, MOTOR } from '../../uyarla/sektor/konaklama.mjs';

test('rezervasyon: gercek motor kazanir, Booking.com ana eylem olmaz, gomulu motor taninir', () => {
  const m = rezervasyonMotoru([{ href: 'https://www.booking.com/hotel/ie/x.html', text: 'Book' }, { href: 'https://app.eviivo.com/x', text: 'Book now' }], 'https://rose.ie/');
  assert.equal(m.motor, 'app.eviivo.com'); assert.equal(m.external, true);
  assert.equal(rezervasyonMotoru([{ href: 'https://www.booking.com/hotel/ie/x.html', text: 'Book' }], 'https://rose.ie/'), null);
  assert.equal(otaVar([{ href: 'https://www.airbnb.ie/rooms/1', text: 'x' }]), true);
  const own = rezervasyonMotoru([{ href: '/book-now', text: 'Book now' }], 'https://rose.ie/');
  assert.equal(own.external, false); assert.match(own.url, /book-now/);
  assert.equal(gomuluMotor('<iframe src="https://secure.beds24.com/booking.php?x=1"></iframe>'), 'secure.beds24.com');
  assert.ok(MOTOR.test('app.eviivo.com') && !MOTOR.test('booking.com'));
});

test('oda sayfasi baglantilari', () => {
  const u = odaLinkleri([{ href: '/rooms', text: 'Our Rooms' }, { href: '/contact', text: 'Contact' }, { href: 'https://other.com/rooms', text: 'Rooms' }, { href: '/rooms/garden-suite', text: 'Garden Suite' }], 'https://rose.ie/');
  assert.deepEqual(u, ['https://rose.ie/rooms', 'https://rose.ie/rooms/garden-suite']);
});

test('odalar: baslik + fiyat; genel basliklar oda sayilmaz', () => {
  const html = `<h2>Our Rooms</h2><h3>Garden Suite</h3><p>A bright en-suite double room with a garden view. Sleeps 2. From €120 per night.</p>
  <h3>Breakfast</h3><p>Served from 8am with full Irish breakfast every morning at the house.</p>
  <h3>Family Room</h3><p>Sleeps 4, two double beds, en-suite shower room. €160 a night.</p><h3>Gift vouchers</h3><p>Buy a gift voucher for a friend.</p>`;
  const o = odalarBul(html);
  assert.deepEqual(o.map((x) => x.n), ['Garden Suite', 'Family Room']);
  assert.equal(o[0].p, '€120'); assert.equal(o[0].per, 'night'); assert.ok(o[0].oz.some((z) => z.k === 'sleeps' && z.v === 2));
  assert.equal(o[1].p, '€160');
});

test('olanaklar yalniz metinde gecenler; giris/cikis', () => {
  const t = 'We offer free wifi and free parking. Dogs welcome. Check-in from 3pm, check-out by 10:30am. Full Irish breakfast.';
  assert.deepEqual(olanaklar(t).map((x) => x.k), ['wifi', 'parking', 'fullbreakfast', 'pets']);
  assert.deepEqual(olanaklar('Nothing special here'), []);
  assert.deepEqual(girisCikis(t), { in: '3pm', out: '10:30am' });
  assert.deepEqual(girisCikis('no times'), { in: null, out: null });
});

test('model: dogru para birimi, "from" fiyat, motor adresi', () => {
  const R = { konaklama: { odalar: [{ n: 'Garden Suite', p: '120', per: 'night', oz: [{ k: 'sleeps', v: 2 }] }, { n: 'Family', p: '160', per: 'night', oz: [] }], olanak: [{ label: 'Free Wi-Fi' }], giris: { in: '3pm', out: '11am' }, motor: { url: 'https://app.eviivo.com/x', external: true, motor: 'app.eviivo.com' }, ota: false } };
  const m = model(R, { region: 'IE' });
  assert.equal(m.fromP, '€120'); assert.equal(m.odalar[0].p, '€120'); assert.equal(m.bookUrl, 'https://app.eviivo.com/x'); assert.deepEqual(m.olanak, ['Free Wi-Fi']);
  assert.equal(model(R, { region: 'NZ' }).fromP, '$120');
});

test('kapi kurali: oda bilgisi ve rezervasyon yoksa elenir', () => {
  assert.equal(kapiKural({ konaklama: { odalar: [], motor: null } }).why.length, 1);
  assert.equal(kapiKural({ konaklama: { odalar: [{ n: 'a' }, { n: 'b' }], motor: null } }).why.length, 0);
  assert.equal(kapiKural({ konaklama: { odalar: [], motor: { url: 'https://x' } } }).why.length, 0);
});

test('odalar: ayrintiyi baslikta tasiyan oda basliklari (ad - tip - m2 - fiyat)', () => {
  const html = `<h3>The Seamus Heaney Room &#8211; Small Double Room &#8211; 12 SQM &#8211;  From €120</h3><h3>The Samuel Beckett Room &#8211; Standard Double Room &#8211; 15 SQM &#8211; Tariff €135.00</h3><h3>Take a look around our Kinsale Boutique Accommodation</h3>`;
  const o = odalarBul(html);
  assert.deepEqual(o.map((x) => x.n), ['The Seamus Heaney Room', 'The Samuel Beckett Room']);
  assert.deepEqual(o.map((x) => x.p), ['€120', '€135.00']);
});

test('imgUrlleri: lightbox buyuk dosya, srcset en buyugu, data-src; betik icindekiler sayilmaz', async () => {
  const { imgUrlleri } = await import('../../uyarla/cikar.mjs');
  const h = `<a href="/gallery/big1.jpg"><img src="/gallery/thumb1.jpg"></a><img srcset="/a-400.jpg 400w, /a-1600.jpg 1600w" src="/a-400.jpg"><img data-src="https://cdn.x.com/r2.webp"><script>var x='<img src="/no.jpg">'</script><img src="/logo.svg"><img src="data:image/png;base64,AAA">`;
  assert.deepEqual(imgUrlleri(h, 'https://rose.ie/rooms/'), ['https://rose.ie/gallery/big1.jpg', 'https://rose.ie/gallery/thumb1.jpg', 'https://rose.ie/a-1600.jpg', 'https://rose.ie/a-400.jpg', 'https://cdn.x.com/r2.webp']);
  assert.deepEqual(imgUrlleri('', 'https://x.ie/'), []);
});
