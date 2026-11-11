import test from 'node:test'; import assert from 'node:assert/strict';
import { parseSaatler } from '../lib/saat.mjs';
const M = (h, m = 0) => h * 60 + m;
test('tek satir aralik', () => {
  const r = parseSaatler(['Opening Hours', 'Mon-Fri 5pm - 10pm', 'Sat & Sun 12pm-11pm']);
  assert.deepEqual(r.week[1], [M(17), M(22)]); assert.deepEqual(r.week[5], [M(17), M(22)]);
  assert.deepEqual(r.week[6], [M(12), M(23)]); assert.deepEqual(r.week[0], [M(12), M(23)]);
});
test('iki satir gun / saat', () => {
  const r = parseSaatler(['Monday', 'Closed', 'Tuesday', '5:00pm – 9:30pm', 'Wednesday', '5:00pm – 9:30pm', 'Thursday', '5:00pm – 10:00pm']);
  assert.equal(r.week[1], null); assert.deepEqual(r.week[2], [M(17), M(21, 30)]); assert.deepEqual(r.week[4], [M(17), M(22)]);
});
test('turkce', () => {
  const r = parseSaatler(['Çalışma Saatleri', 'Pazartesi - Cuma 09:00 - 22:00', 'Cumartesi 10:00-00:00', 'Pazar Kapalı']);
  assert.deepEqual(r.week[3], [M(9), M(22)]); assert.deepEqual(r.week[6], [M(10), 1440]); assert.equal(r.week[0], null);
});
test('gece yarisini asan', () => {
  const r = parseSaatler(['Fri-Sat 5pm - 1am', 'Daily 11am-3pm']);
  assert.deepEqual(r.week[5], [M(17), M(25)]);
});
test('her gun', () => { const r = parseSaatler(['Her gün 10:00-23:00']); assert.deepEqual(r.week[4], [M(10), M(23)]); assert.equal(r.known, 7); });
test('json-ld', () => {
  const r = parseSaatler([], [{ openingHoursSpecification: [{ dayOfWeek: ['Monday', 'Tuesday', 'Wednesday'], opens: '17:00', closes: '22:00' }, { dayOfWeek: 'https://schema.org/Friday', opens: '17:00:00', closes: '23:30:00' }] }]);
  assert.deepEqual(r.week[2], [M(17), M(22)]); assert.deepEqual(r.week[5], [M(17), M(23, 30)]);
});
test('cop satir tabloya girmez', () => { assert.equal(parseSaatler(['Call us on 0412 345 678', 'Sunday 12 July 2026 tickets']), null); });
import { saatDenetle } from '../lib/saat.mjs';
test('| ile ayrilmis ve bitisik gun gruplari bolunur (Mon-Fri | Sat-Sun)', () => {
  for (const line of ['Mon-Fri 7am – 4pm | Sat-Sun 8am – 3pm', 'Mon-Fri 7am-4pm Sat-Sun 8am-3pm']) {
    const r = parseSaatler([line]);
    assert.deepEqual(r.week[3], [M(7), M(16)]); assert.deepEqual(r.week[6], [M(8), M(15)]); assert.deepEqual(r.week[0], [M(8), M(15)]);
    assert.equal(r.conflict, false);
  }
});
test('ayni gun iki araligi (ogle + aksam) bolunmez', () => {
  const r = parseSaatler(['Mon–Fri 12–3pm, 5–10pm']); assert.equal(r.rows[0].t, '12:00–15:00, 17:00–22:00');
});
test('ayni saat iki kez yazilirsa cakisma degil; ilk araligin icindeki menu bolumu saati cakisma degil', () => {
  assert.equal(parseSaatler(['Mon-Sun 9am-10pm', 'Daily 9am-10pm']).conflict, false);
  assert.equal(parseSaatler(['Mon-Sun 9am-10pm', 'Breakfast Mon-Sun 9am-11am']).conflict, false);
});
test('ayni gun farkli yerde farkli yazilmissa cakisma: tablo gizlenir', () => {
  const r = parseSaatler(['Mon-Fri 9am-5pm', 'Mon-Fri 11am-11pm', 'Sat-Sun 10am-4pm']);
  assert.equal(r.conflict, true); assert.equal(r.tableOk, false);
});
test('00:00-00:00 bazi gunlerde yazilmissa o gun kapalidir (24 saat degil)', () => {
  const r = parseSaatler([], [{ openingHoursSpecification: [{ dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '11:30', closes: '22:00' }, { dayOfWeek: 'Monday', opens: '00:00', closes: '00:00' }] }]);
  const d = saatDenetle(r); assert.equal(d.issue, null); assert.equal(d.hours.week[1], null); assert.equal(d.hours.byDay[1], 'closed'); assert.deepEqual(d.hours.week[2], [M(11, 30), M(22)]);
});
test('kayitli saat denetimi: ust uste binen aralik ve cakisan satir tabloyu gizler', () => {
  const bad = { week: [[480, 960], [420, 900], [420, 900], [420, 900], [420, 900], [420, 900], [480, 960]], rows: [{ d: [1, 2, 3, 4, 5], t: '07:00–16:00, 08:00–15:00' }, { d: [6, 0], t: '08:00–16:00' }], byDay: [], known: 7, tableOk: true };
  assert.equal(saatDenetle(bad).issue, 'ust-uste'); assert.equal(saatDenetle(bad).hours, null);
  const bad2 = { week: [[480, 960], [420, 900], [420, 900], [420, 900], [420, 900], [420, 900], [480, 960]], rows: [{ d: [1, 2, 3, 4, 5], t: '07:00–16:00' }, { d: [1, 2, 3, 4, 5], t: '10:00–22:00' }, { d: [6, 0], t: '08:00–16:00' }], byDay: [], known: 7, tableOk: true };
  assert.equal(saatDenetle(bad2).issue, 'cakisma');
  const ok = { week: [[540, 1440], [540, 1440], [540, 1440], [540, 1440], [540, 1440], [420, 1440], [420, 1440]], rows: [{ d: [1, 2, 3, 4], t: '09:00–00:00' }, { d: [5, 6, 0], t: '07:00–00:00' }, { d: [1, 2, 3, 4], t: '09:00–11:00' }], byDay: [], known: 7, tableOk: true };
  assert.equal(saatDenetle(ok).issue, null); assert.ok(saatDenetle(ok).hours);
});
