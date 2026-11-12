// Yeme-icme odagi (12 Kas 2026): konaklama ve guzellik durur, restoran ailesi (restoran, bar, pub, kafe, pastane, firin, tatlici ...) tek sektor olarak 6 ulkede calisir.
// plan.json kontrolleri, planOku sonucu, eski etiketli restoran listesinin yenilenmesi.  Ag yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dongu, planOku, adaylar, listeEtiketEski } from '../dongu.mjs';
import { uretimLead } from '../uretim.mjs';
import { ULKELER, SEKTORLER } from '../../lead/sektorler.mjs';
import { gecici } from './gecici.mjs';

const PLAN = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'plan.json');
const planHam = () => JSON.parse(fs.readFileSync(PLAN, 'utf8'));
const yaz = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); };

test('plan.json: konaklama ve guzellik kapali (tarihli gerekce), restoran ailesi acik', () => {
  const p = planHam();
  assert.equal(p.sektorler.restoran.aktif, true);
  for (const s of ['konaklama', 'guzellik']) {
    assert.equal(p.sektorler[s].aktif, false, `${s} durdu`);
    assert.match(p.sektorler[s].not, /^12 Kas 2026: DURDU/, `${s}: tarihli gerekce`);
    assert.ok(p.sektorler[s].ad, `${s}: tanim durur (yeniden acmak icin aktif=true yeter)`);
  }
  assert.match(p.sektorler.restoran.ad, /kafe/); assert.match(p.sektorler.restoran.ad, /pastane/); assert.match(p.sektorler.restoran.ad, /fırın|firin/);
  assert.match(p.sektorler.restoran.not, /pastry|bakery/);
  assert.match(p._not, /YEME-ICME ODAGI/);
});

test('plan.json sira: yeme-icme once (alti ulke), durdurulan sektorler sonda; planOku yalniz restoran dondurur', () => {
  const p = planHam();
  assert.deepEqual(p.sira.slice(0, 6), [['IE', 'restoran'], ['NZ', 'restoran'], ['AU', 'restoran'], ['GB', 'restoran'], ['SG', 'restoran'], ['TR', 'restoran']]);
  const ilkDuran = p.sira.findIndex(([, s]) => s !== 'restoran');
  assert.equal(ilkDuran, 6, 'restoran ciftleri en basta ve bitisik');
  assert.ok(p.sira.slice(ilkDuran).every(([, s]) => s === 'konaklama' || s === 'guzellik'));
  // her cift tanimli: ulke ULKELER'de, sektor SEKTORLER'de ve plan.sektorler'de
  for (const [u, s] of p.sira) { assert.ok(ULKELER[u], `ulke ${u}`); assert.ok(SEKTORLER[s], `sektor ${s}`); assert.ok(p.sektorler[s], `plan sektoru ${s}`); }
  const okunan = planOku(PLAN).sira;
  assert.deepEqual(okunan, [['IE', 'restoran'], ['NZ', 'restoran'], ['AU', 'restoran'], ['GB', 'restoran'], ['SG', 'restoran'], ['TR', 'restoran']]);
  assert.ok(!okunan.some(([, s]) => s !== 'restoran'), 'konaklama ve guzellik uretime girmez');
  // yurt disi (AU NZ IE GB SG) ve Turkiye birlikte
  assert.deepEqual([...new Set(okunan.map(([u]) => u))].sort(), ['AU', 'GB', 'IE', 'NZ', 'SG', 'TR']);
});

test('plan.json limitler: restoranHerTur son goz kotasiyla ayni (6); TR restoran ailesi; HK kapali', () => {
  const p = planHam();
  assert.equal(p.limitler.restoranHerTur, 6); assert.equal(p.limitler.uretimHerTur, 20); assert.equal(p.limitler.osmSorguHerTur, 1);
  assert.equal(p.ulkeler.TR.aktif, true); assert.deepEqual(p.ulkeler.TR.sektorler, ['restoran']); assert.match(p.ulkeler.TR.not, /pastane/);
  assert.equal(p.ulkeler.HK.aktif, false);
  assert.ok(!planOku(PLAN).sira.some(([u]) => u === 'HK'));
});

test('planOku: durdurulan sektor sirada olsa da uretime girmez; yeniden acmak icin aktif=true yeter', () => {
  const d = gecici('yio-plan-'); const f = path.join(d, 'plan.json');
  const temel = { sira: [['IE', 'restoran'], ['IE', 'konaklama'], ['IE', 'guzellik']] };
  yaz(f, { ...temel, sektorler: { restoran: { aktif: true }, konaklama: { aktif: false }, guzellik: { aktif: false } } });
  assert.deepEqual(planOku(f).sira, [['IE', 'restoran']]);
  yaz(f, { ...temel, sektorler: { restoran: { aktif: true }, konaklama: { aktif: true }, guzellik: { aktif: false } } });
  assert.deepEqual(planOku(f).sira, [['IE', 'restoran'], ['IE', 'konaklama']]);
});

test('adaylar: taranmis konaklama ve guzellik adaylari durdurulunca havuza girmez; restoran girer', () => {
  const depo = gecici('yio-aday-'); const veri = path.join(depo, 'veri');
  const satir = (id, ad, sektor) => JSON.stringify({ id, osm: `node/${id.slice(-4)}`, ulke: 'IE', sektor, name: ad, website: `http://${id}.example/`, durum: 'aday', puan: 6, email: `x@${id}.example`, finalUrl: `http://${id}.example/`, tur: 'x' });
  yaz(path.join(depo, 'lead', 'IE-restoran.tarandi.jsonl'), `${satir('IE-n1001', 'Wren Bakery', 'restoran')}\n`);
  yaz(path.join(depo, 'lead', 'IE-konaklama.tarandi.jsonl'), `${satir('IE-n2002', 'Rose Cottage', 'konaklama')}\n`);
  yaz(path.join(depo, 'lead', 'IE-guzellik.tarandi.jsonl'), `${satir('IE-n3003', 'Mary Cuts', 'guzellik')}\n`);
  const liste = adaylar({ depo, plan: planOku(PLAN), veri, uretimLead });
  assert.deepEqual(liste.map((l) => l.sektor), ['restoran']);
});

test('listeEtiketEski: dukkan alani olmayan restoran listesi eski etiketle cekilmistir; digerleri etkilenmez', () => {
  const d = gecici('yio-liste-');
  const eski = path.join(d, 'eski.jsonl'); yaz(eski, `${JSON.stringify({ id: 'a', sektor: 'restoran', mutfak: '', amenity: 'restaurant' })}\n`);
  const yeni = path.join(d, 'yeni.jsonl'); yaz(yeni, `${JSON.stringify({ id: 'a', sektor: 'restoran', mutfak: '', amenity: null, dukkan: 'bakery' })}\n${JSON.stringify({ id: 'b', dukkan: null })}\n`);
  const yeniNull = path.join(d, 'yeni-null.jsonl'); yaz(yeniNull, `${JSON.stringify({ id: 'a', sektor: 'restoran', amenity: 'cafe', dukkan: null })}\n`);
  const bos = path.join(d, 'bos.jsonl'); yaz(bos, '');
  const bozuk = path.join(d, 'bozuk.jsonl'); yaz(bozuk, 'bu json degil\n');
  assert.equal(listeEtiketEski(eski, 'restoran'), true);
  assert.equal(listeEtiketEski(yeni, 'restoran'), false);
  assert.equal(listeEtiketEski(yeniNull, 'restoran'), false);
  assert.equal(listeEtiketEski(bos, 'restoran'), false);
  assert.equal(listeEtiketEski(bozuk, 'restoran'), false);
  assert.equal(listeEtiketEski(path.join(d, 'yok.jsonl'), 'restoran'), false);
  assert.equal(listeEtiketEski(eski, 'konaklama'), false, 'yalniz restoran ailesi');
});

function ortam() {
  const depo = gecici('yio-dongu-'); const veri = path.join(depo, 'veri'); const cagrilar = [];
  const planDosya = path.join(depo, 'plan.json');
  yaz(planDosya, { sektorler: { restoran: { aktif: true }, konaklama: { aktif: false }, guzellik: { aktif: false } }, sira: [['IE', 'restoran'], ['IE', 'konaklama'], ['IE', 'guzellik']], limitler: { osmSorguHerTur: 3, havuzHedef: 4, uretimHerTur: 4, tarayiciEs: 1, restoranHerTur: 6, leadYenilemeGun: 120 } });
  const araclar = {
    // elenmis lead: taranacak adayi yok, tur yalniz lead listesinin yenilenip yenilenmedigini gosterir
    bul: async (ulke, sektor) => { cagrilar.push(`${ulke}-${sektor}`); return [{ id: `${ulke}-n9001`, osm: 'node/9001', ulke, sektor, name: 'Zincir Kafe', website: 'http://z.example/', tur: 'cafe', amenity: 'cafe', dukkan: null, elendi: 'zincir (brand etiketi)' }]; },
    tarananlar: () => new Set(), Polite: class { }, openBrowser: async () => ({ close: async () => {} }),
    taraHepsi: async () => ({ sayac: {} }), uretimLead, uretimCalis: async () => ({ sonuc: [] }),
    hazirlar: () => [], kutuEkle: () => 0, kutuOku: () => [], yazilanlar: () => ({ neden: () => null }),
  };
  const kos = () => dongu({ depo, kutu: null, sureDk: 30, parti: 'p', planDosya, veri, araclar, log: () => {}, env: {} });
  return { depo, cagrilar, kos };
}

test('dongu: yalniz restoran listesi cekilir; eski etiketli restoran listesi taze olsa da yenilenir, yeni etiketli taze liste yenilenmez', async () => {
  const o = ortam();
  // 1) liste yok: cekilir (konaklama ve guzellik cekilmez)
  await o.kos();
  assert.deepEqual(o.cagrilar, ['IE-restoran']);
  const liste = path.join(o.depo, 'lead', 'IE-restoran.jsonl');
  assert.ok(JSON.parse(fs.readFileSync(liste, 'utf8').split('\n')[0]).dukkan === null && 'dukkan' in JSON.parse(fs.readFileSync(liste, 'utf8').split('\n')[0]));
  // 2) yeni etiketli ve taze: yenilenmez
  o.cagrilar.length = 0; await o.kos(); assert.deepEqual(o.cagrilar, []);
  // 3) eski etiketli (dukkan yok) ama dosya yeni: yenilenir (restoran ailesi genisledi)
  fs.writeFileSync(liste, `${JSON.stringify({ id: 'IE-n1', osm: 'node/1', ulke: 'IE', sektor: 'restoran', name: 'Old Pub', website: 'http://o.example/', tur: 'bar', amenity: 'pub', elendi: null })}\n`);
  o.cagrilar.length = 0; await o.kos(); assert.deepEqual(o.cagrilar, ['IE-restoran']);
  assert.ok('dukkan' in JSON.parse(fs.readFileSync(liste, 'utf8').split('\n')[0]), 'liste yeni etiketlerle yazildi');
  // 4) yine yenilenmez
  o.cagrilar.length = 0; await o.kos(); assert.deepEqual(o.cagrilar, []);
});
