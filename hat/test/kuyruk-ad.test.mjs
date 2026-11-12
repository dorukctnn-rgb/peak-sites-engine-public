// hat/kuyruk.mjs: isletme adi (sitenin adi, basligi, logo alt metni, OSM adi) ve peak-outreach denetimi (12 Kas 2026, hat mail sesi).  Mail sablonu ve ad temizligi ozel katmandan gelir
// (hat/ozel-getir.mjs): bu test ozel varlik ister (tam paketle kosar).  Butun adlar, siteler ve adresler uydurmadir.
// PEAK_OUTREACH_KOKU (peak-outreach klonu, main) verilirse son test satirlari peak-outreach'in KENDI denetiminden (lintDemoText, validateRow, checkBody) gecirir; yoksa atlanir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { satirlarKur, satirGecerliMi, adAdaylari, KAMPANYA } from '../kuyruk.mjs';
import { adAdaylariOku } from '../uygula.mjs';
import { adBitisikDuzelt } from '../../uyarla/cikar.mjs';
import { mailDenetle } from '../../mail/sablon.mjs';

const PO = process.env.PEAK_OUTREACH_KOKU || '';
const poVar = !!PO && fs.existsSync(path.join(PO, 'src', 'lint-websites-demo.mjs')) && fs.existsSync(path.join(PO, 'src', 'queue.mjs'));
const poIc = (f) => import(pathToFileURL(path.join(PO, 'src', f)).href);

const lead = (i, o = {}) => ({ id: `AU-n${7000 + i}`, osm: `node/${7000 + i}`, ulke: 'AU', sektor: 'konaklama', name: 'Ornek Motor Inn', email: `info@ornekmotor${i}.com.au`, durum: 'aday', website: `https://ornekmotor${i}.com.au/`, city: 'Ornekkent', ...o });
const hazir = (i, o = {}) => ({ id: `AU-n${7000 + i}`, slug: `ornek-motor-inn-au${7000 + i}`, durum: 'hazir', page: `r/ornek-motor-inn-au${7000 + i}-a1b2c3d4e5`, sektor: 'konaklama', ad: 'Ornek Motor Inn', fiyatVar: false, onizleme: '/tmp/x.jpg', parti: 'p1', ...o });
const kur = (leads, son) => satirlarKur({ son, leadsById: new Map(leads.map((l) => [l.id, l])), po: { sent: '', queue: '', suppress: '', replied: '' }, simdi: new Date('2026-11-12T08:00:00Z') });

test('adAdaylari: sitenin basligi, og:title, logo alt metni, OSM adi (bos olanlar atlanir)', () => {
  assert.deepEqual(adAdaylari({ adAdaylari: { baslik: 'T', ogTitle: 'O', logoAlt: 'L' } }, { name: 'OSM' }), ['T', 'O', 'L', 'OSM']);
  assert.deepEqual(adAdaylari({}, { name: 'OSM' }), ['OSM']);
  assert.deepEqual(adAdaylari({ adAdaylari: { logoAlt: 'L' } }, {}), ['L']);
});

test('adAdaylariOku: cikarici kaydindan yalniz dolu alanlar; bos kayit undefined', () => {
  assert.deepEqual(adAdaylariOku({ slogan: { title: ' Home | Ornek  Motor Inn ', ogTitle: '', desc: 'x' }, logoAlt: 'Ornek Motor Inn logo' }), { baslik: 'Home | Ornek Motor Inn', logoAlt: 'Ornek Motor Inn logo' });
  assert.equal(adAdaylariOku({ slogan: { title: '', ogTitle: null } }), undefined);
  assert.equal(adAdaylariOku(null), undefined);
});

test('adBitisikDuzelt: bosluksuz site adi, ayni harfli bosluklu OSM adi ile degisir; baska durumlarda ayni kalir', () => {
  const nm = { n: 'ornekmotorinn', via: 'json-ld' };
  assert.deepEqual(adBitisikDuzelt(nm, 'Ornek Motor Inn'), { n: 'Ornek Motor Inn', full: 'ornekmotorinn', via: 'json-ld (bitisik ad: lead listesi adi)' });
  assert.equal(adBitisikDuzelt(nm, 'Baska Ad Burada'), nm, 'harfler farkli: dokunulmaz');
  assert.equal(adBitisikDuzelt(nm, 'OrnekMotorInn'), nm, 'OSM adi da bosluksuz: dokunulmaz');
  assert.deepEqual(adBitisikDuzelt({ n: 'Ornek Motor Inn', via: 'x' }, 'Ornek Motor Inn'), { n: 'Ornek Motor Inn', via: 'x' }, 'site adi zaten bosluklu: dokunulmaz');
  assert.equal(adBitisikDuzelt(null, 'Ornek Motor Inn'), null);
});

test('kuyruk: bitisik site adi OSM adiyla onarilir, mailde ve satirda temiz ad; "Home | X" basligi ve logo alt metni de kullanilir', () => {
  const r = kur(
    [lead(1), lead(2, { name: 'Ornek Pansiyon Iki' }), lead(3, { name: 'Ornek Pansiyon Uc' })],
    [hazir(1, { ad: 'ornekmotorinn' }), hazir(2, { ad: 'Home', adAdaylari: { baslik: 'Home | Ornek Pansiyon Iki - Ornekkent' } }), hazir(3, { ad: '-', adAdaylari: { logoAlt: 'Ornek Pansiyon Uc logo' } })],
  );
  assert.deepEqual(r.atla, {});
  assert.deepEqual(r.satirlar.map((s) => s.name), ['Ornek Motor Inn', 'Ornek Pansiyon Iki', 'Ornek Pansiyon Uc']);
  for (const s of r.satirlar) {
    assert.ok(s.subject.includes(s.name) && s.body.includes(s.name)); assert.doesNotMatch(s.subject + s.body, /ornekmotorinn|Home|\s-\s|\|/);
    assert.equal(s.campaign, KAMPANYA); assert.match(s.body, /\nDoruk\nPeak Apps Studio\ninfo@peakappsstudio\.com$/);
    assert.deepEqual(mailDenetle({ konu: s.subject, govde: s.body, ad: s.name, sayfa: s._page }), []);
  }
});

test('kuyruk: ad emin olunamayacak kadar bozuksa satir atlanir ("ad-belirsiz"), satir yazilmaz', () => {
  const r = kur([lead(1, { name: '' }), lead(2, { name: 'Home' }), lead(3)], [hazir(1, { ad: 'ornekmotorinn' }), hazir(2, { ad: 'ornekmotorinn' }), hazir(3, { ad: 'Home' })]);
  assert.equal(r.satirlar.length, 1, 'yalniz OSM adi temiz olan (3) gecer');
  assert.deepEqual(r.atla, { 'ad-belirsiz': 2 });
  assert.equal(r.satirlar[0].name, 'Ornek Motor Inn');
});

test('satirGecerliMi: checkBody kampanya adiyla cagrilir (websites-demo maili Doruk imzali)', () => {
  // peak-outreach checkBody'nin sozlesmesi: kampanya verilmezse "Doruk" yasak, websites-demo'da imza + tam iki kez Doruk serbest
  const checkBody = (t, c = '') => (c === 'websites-demo' && t.endsWith('Doruk\nPeak Apps Studio\ninfo@peakappsstudio.com') ? { text: t } : { error: 'personal-name' });
  const validate = () => null;
  const r = kur([lead(1)], [hazir(1)]); const row = r.satirlar[0];
  assert.equal(satirGecerliMi(row, { validate, checkBody, config: {} }), null);
  assert.equal(satirGecerliMi(row, { validate: () => 'bad-region', checkBody, config: {} }), 'gecersiz:bad-region');
  assert.equal(satirGecerliMi({ ...row, campaign: 'websites' }, { validate, checkBody, config: {} }), 'gecersiz:personal-name');
  assert.equal(satirGecerliMi(row, { validate: null, checkBody: null, config: {} }), null, 'denetim yoksa (peak-outreach klonu yok) satir kendi denetimine kalir');
});

test('peak-outreach kendi denetimi: 3 ornek satir (konaklama AU, konaklama IE, guzellik) lintDemoText, validateRow ve checkBody ile 0 sorun', { skip: poVar ? false : 'PEAK_OUTREACH_KOKU yok' }, async () => {
  const L = await poIc('lint-websites-demo.mjs'); const Q = await poIc('queue.mjs');
  const config = JSON.parse(fs.readFileSync(path.join(PO, 'config.json'), 'utf8'));
  const dis = (o) => L.lintDemoText({ id: o.id, lang: 'en', subject: o.subject, body: o.body, rendered: true, name: o.name, pageUrl: o.pageUrl });
  const leads = [lead(1), lead(2, { ulke: 'IE', id: 'IE-n7002', osm: 'node/7002', name: 'Ornek Pansiyon Iki', email: 'a@y.ie' }), lead(3, { ulke: 'IE', sektor: 'guzellik', id: 'IE-n7003', osm: 'node/7003', name: 'Ornek Kuafor', email: 'a@z.ie' })];
  const son = [hazir(1, { ad: 'ornekmotorinn' }), hazir(2, { id: 'IE-n7002', sektor: 'konaklama', ad: 'Ornek Pansiyon Iki, Ornekkoy, Ornekil', fiyatVar: true }), hazir(3, { id: 'IE-n7003', sektor: 'guzellik', ad: 'ORNEK KUAFOR' })];
  const r = satirlarKur({ son, leadsById: new Map(leads.map((l) => [l.id, l])), po: { sent: '', queue: '', suppress: '', replied: '' }, simdi: new Date('2026-11-12T08:00:00Z'), dis });
  assert.deepEqual(r.atla, {}); assert.equal(r.satirlar.length, 3);
  assert.deepEqual(r.satirlar.map((s) => s.name), ['Ornek Motor Inn', 'Ornek Pansiyon Iki', 'Ornek Kuafor']);
  for (const s of r.satirlar) assert.equal(satirGecerliMi(s, { validate: Q.validateRow, checkBody: Q.checkBody, config }), null, s.id);
  // peak-outreach'in kendi lint'i satirlari ayrica kabul ediyor
  for (const s of r.satirlar) assert.deepEqual(dis({ id: s.id, subject: s.subject, body: s.body, name: s.name, pageUrl: s._page }), []);
});
