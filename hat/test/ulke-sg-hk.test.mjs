// Ulke kapisi testleri (11 Kas 2026): SG acilir, HK bekler (posta adresi + telefon + iki dil zorunlu), yasak ve bekleyen ulkeler hicbir kapidan gecmez.  Ag yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { planOku } from '../dongu.mjs';
import { ULKELER, YASAK_ULKE, BEKLE_ULKE, TEMEL_ULKE, kapaliUlke } from '../../lead/sektorler.mjs';
import { sorgu, bul } from '../../lead/osm.mjs';
import { alanKoku } from '../../lead/eposta.mjs';
import { tzOf, telHref, fmtPrice } from '../../uyarla/lib/metin.mjs';
import { gecici } from './gecici.mjs';

const PLAN = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'plan.json');
const planHam = () => JSON.parse(fs.readFileSync(PLAN, 'utf8'));
const geciciPlan = (o) => { const f = path.join(gecici('ulke-test-'), 'p.json'); fs.writeFileSync(f, JSON.stringify(o)); return f; };

test('SG hedefte: dil en, saat dilimi Asia/Singapore, teklif USD; HK hedefte degil', () => {
  assert.equal(ULKELER.SG.dil, 'en');
  assert.equal(ULKELER.SG.saatDilimi, 'Asia/Singapore');
  assert.equal(ULKELER.SG.teklifPara, 'USD');
  assert.equal(ULKELER.SG.sirketSart, false);
  assert.equal(ULKELER.HK, undefined);
  assert.ok(!TEMEL_ULKE.has('SG'), 'SG yalniz plan.json ulkeler.SG.aktif ile acilir');
});

test('yasak ve bekleyen ulkeler: ULKE-MATRISI 3. ve 4. bolum, hicbiri hedef listesinde degil', () => {
  for (const k of ['DE', 'AT', 'IT', 'ES', 'DK', 'PL', 'CZ', 'SK', 'GR', 'RO', 'LT', 'KR', 'VN', 'ZA', 'SA', 'AE']) assert.ok(YASAK_ULKE.has(k), `yasak: ${k}`);
  for (const k of ['US', 'CA', 'JP', 'CH', 'HK']) assert.ok(BEKLE_ULKE.has(k), `bekle: ${k}`);
  for (const k of [...YASAK_ULKE, ...BEKLE_ULKE]) { assert.equal(ULKELER[k], undefined, `${k} hem hedef hem kapali olamaz`); assert.ok(kapaliUlke(k)); }
  assert.ok(kapaliUlke('hk'), 'kucuk harf de kapali');
  for (const k of Object.keys(ULKELER)) assert.ok(!kapaliUlke(k), `${k} kapali olmamali`);
});

test('her saat dilimi gecerli (ULKELER ve plan.json ulkeler)', () => {
  const p = planHam();
  const hepsi = [...Object.values(ULKELER).map((u) => u.saatDilimi), ...Object.values(p.ulkeler).map((u) => u.saatDilimi)].filter(Boolean);
  for (const tz of hepsi) assert.doesNotThrow(() => new Intl.DateTimeFormat('en-GB', { timeZone: tz }), tz);
  assert.equal(p.ulkeler.SG.saatDilimi, 'Asia/Singapore');
  assert.equal(p.ulkeler.HK.saatDilimi, 'Asia/Hong_Kong');
});

test('plan.json: SG acik (en, USD), HK kapali ve sirada yok', () => {
  const p = planHam();
  assert.equal(p.ulkeler.SG.aktif, true); assert.equal(p.ulkeler.SG.dil, 'en'); assert.equal(p.ulkeler.SG.para, 'USD');
  assert.equal(p.ulkeler.HK.aktif, false); assert.equal(p.ulkeler.HK.dil, 'en'); assert.equal(p.ulkeler.HK.para, 'USD');
  assert.ok(p.sira.some(([u, s]) => u === 'SG' && s === 'konaklama'));
  assert.ok(p.sira.some(([u, s]) => u === 'SG' && s === 'guzellik'));
  assert.ok(!p.sira.some(([u]) => u === 'HK'));
  const okunan = planOku(PLAN);
  assert.ok(okunan.sira.some(([u]) => u === 'SG'), 'SG plandan gecer');
  assert.ok(!okunan.sira.some(([u]) => u === 'HK' || kapaliUlke(u)));
});

test('planOku: temel dort ulke her zaman; SG yalniz aktif=true ve listelenen sektorle; HK ve bekleyenler plan ne derse desin girmez', () => {
  const sektorler = { konaklama: { aktif: true }, guzellik: { aktif: true }, restoran: { aktif: true } };
  const sira = [['IE', 'konaklama'], ['SG', 'konaklama'], ['SG', 'guzellik'], ['HK', 'konaklama'], ['US', 'konaklama'], ['JP', 'konaklama'], ['DE', 'konaklama']];
  const acik = { SG: { aktif: true, sektorler: ['konaklama'] }, HK: { aktif: true, sektorler: ['konaklama'] }, US: { aktif: true, sektorler: ['konaklama'] }, JP: { aktif: true, sektorler: ['konaklama'] }, DE: { aktif: true, sektorler: ['konaklama'] } };
  assert.deepEqual(planOku(geciciPlan({ sektorler, sira, ulkeler: acik })).sira, [['IE', 'konaklama'], ['SG', 'konaklama']]);
  assert.deepEqual(planOku(geciciPlan({ sektorler, sira, ulkeler: { SG: { aktif: false, sektorler: ['konaklama', 'guzellik'] } } })).sira, [['IE', 'konaklama']]);
  assert.deepEqual(planOku(geciciPlan({ sektorler, sira })).sira, [['IE', 'konaklama']], 'ulkeler yoksa SG kapali');
  // TR eskisi gibi: yalniz restoran, yalniz aktifken
  const trSira = [['TR', 'restoran'], ['TR', 'konaklama']];
  assert.deepEqual(planOku(geciciPlan({ sektorler, sira: trSira, ulkeler: { TR: { aktif: true, sektorler: ['restoran', 'konaklama'] } } })).sira, [['TR', 'restoran']]);
  assert.deepEqual(planOku(geciciPlan({ sektorler, sira: trSira, ulkeler: { TR: { aktif: true } } })).sira, [['TR', 'restoran']]);
  assert.deepEqual(planOku(geciciPlan({ sektorler, sira: trSira, ulkeler: { TR: { aktif: false, sektorler: ['restoran'] } } })).sira, []);
});

test('OSM: SG sorgusu ISO alaniyla; HK, US ve yasak ulke icin lead aranmaz (istek atilmadan reddedilir)', async () => {
  assert.match(sorgu('SG', 'konaklama'), /ISO3166-1"="SG"/);
  for (const k of ['HK', 'US', 'DE']) await assert.rejects(() => bul(k, 'konaklama'), /ulke hedefte degil/);
});

test('SG sayfa ayrintilari: saat dilimi, telefon, fiyat isareti, alan adi koku', () => {
  assert.equal(tzOf('Singapore', 'SG'), 'Asia/Singapore');
  assert.equal(tzOf('', 'SG'), 'Asia/Singapore');
  assert.equal(telHref('6234 5678', 'SG'), '+6562345678');
  assert.equal(telHref('65 6234 5678', 'SG'), '+6562345678');
  assert.equal(telHref('+65 9123 4567', 'SG'), '+6591234567');
  assert.equal(fmtPrice('18', 'SG'), '$18');
  assert.equal(alanKoku('www.ornek-kafe.com.sg'), 'ornek-kafe.com.sg');
});
