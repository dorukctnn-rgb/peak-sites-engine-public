// lead/kent.mjs ve METRO_EK (ek kentler) testleri: Overpass cagrisi sahte; saat dilimi, plan degismezligi, kutu bolme, tekillestirme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METRO, METRO_EK, METRO_PLAN, metroOf, metroTz } from '../osm.mjs';
import { kentBul, kentler } from '../kent.mjs';

const el = (id, name, site, lat, lon, extra = {}) => ({ type: 'node', id, lat, lon, tags: { amenity: 'cafe', name, website: site, ...extra } });

test('METRO_EK: eski plan ve kentler degismez; ek kentler saat dilimini verir (AU) ve kutulari gecerli', () => {
  assert.equal(METRO_PLAN, 'metro-1'); assert.equal(METRO.AU.length, 3); assert.equal(METRO.GB.length, 13);
  assert.equal(metroTz({ ulke: 'AU', lat: -31.95, lon: 115.86 }), 'Australia/Perth');
  assert.equal(metroTz({ ulke: 'AU', lat: -34.92, lon: 138.6 }), 'Australia/Adelaide');
  assert.equal(metroTz({ ulke: 'AU', lat: -42.88, lon: 147.33 }), 'Australia/Hobart');
  assert.equal(metroTz({ ulke: 'AU', lat: -33.87, lon: 151.2 }), 'Australia/Sydney'); // eski kent hala eski kayitta
  assert.equal(metroOf('GB', 52.2, 0.12).ad, 'Cambridge'); assert.equal(metroOf('GB', 51.5, -0.12).ad, 'London');
  for (const L of Object.values(METRO_EK)) for (const k of L) { const [s, w, n, e] = k.kutu; assert.ok(s < n && w < e && n - s <= 0.25 && e - w <= 0.25, k.ad); }
  for (const k of METRO_EK.AU) assert.match(k.tz, /^Australia\//);
});
test('kentBul: kutu sorgusu ulke alani olmadan kurulur, ayni site tekillesir, kent adi satira yazilir', async () => {
  const sorgular = [];
  const sorgula = async (q) => { sorgular.push(q); return { elements: [el(1, 'Alfa Cafe', 'https://www.alfa.test/', 52.2, 0.1), el(2, 'Alfa Cafe 2', 'https://alfa.test/menu', 52.2, 0.11), el(3, 'Beta Bakery', 'https://beta.test', 52.21, 0.12, { amenity: undefined, shop: 'bakery' })] }; };
  const r = await kentBul('GB', kentler('GB', 'ek').slice(0, 2), { sorgula, bekleMs: 0 });
  assert.equal(sorgular.length, 2); assert.ok(sorgular.every((q) => !/area\[/.test(q) && /\(5\d\.\d+,/.test(q)), sorgular[0]);
  assert.equal(r.leads.length, 2); assert.equal(r.leads[0].kent, 'Cambridge'); assert.equal(r.leads.filter((l) => l.host === 'alfa.test').length, 1);
});
test('kentBul: agir kutu dorde bolunur, hala basarisizsa kent hata listesine girer', async () => {
  let n = 0;
  const sorgula = async () => { n++; const e = new Error('agir'); e.agir = true; throw e; };
  const r = await kentBul('AU', [METRO_EK.AU[0]], { sorgula, bekleMs: 0 });
  assert.equal(n, 5); assert.deepEqual(r.hatalar, ['Perth']); assert.equal(r.leads.length, 0);
});
test('kentler(): plan ek / metro / hepsi', () => {
  assert.equal(kentler('GB', 'ek').length, METRO_EK.GB.length); assert.equal(kentler('GB', 'metro').length, 13); assert.equal(kentler('GB', 'hepsi').length, 13 + METRO_EK.GB.length); assert.equal(kentler('IE', 'ek').length, 0);
});

test('kentBul: ilk denenecek ayna ve zaman siniri sorguya iletilir, her kent bitince kentBitti cagrilir', async () => {
  const secenekler = []; const biten = [];
  const sorgula = async (q, o) => { secenekler.push(o); return { elements: [el(1, 'Alfa Cafe', `https://a${secenekler.length}.test/`, 52.2, 0.1)] }; };
  const r = await kentBul('GB', kentler('GB', 'ek').slice(0, 2), { sorgula, bekleMs: 0, kentBitti: (k, ls) => biten.push([k, ls.length]) });
  assert.ok(secenekler.every((o) => o.ilk === 1 && o.zamanMs === 90000 && o.tries === 3), JSON.stringify(secenekler[0]));
  assert.deepEqual(biten, [['Cambridge', 1], ['Oxford', 1]]); assert.equal(r.leads.length, 2);
  await kentBul('GB', kentler('GB', 'ek').slice(0, 1), { sorgula, bekleMs: 0, ilk: 0 }); assert.equal(secenekler.at(-1).ilk, 0);
});

test('hafif sorgu: yalniz kafe / fast_food / dondurma / firin-pastane etiketleri (restoran, bar, pub yok); onceBol kenti bastan dorde boler', async () => {
  const { sorguHafif } = await import('../kent.mjs');
  const q = sorguHafif([52.17, 0.07, 52.24, 0.2]);
  assert.match(q, /\["amenity"~"\^\(fast_food\|cafe\|ice_cream\)\$"\]\["website"\]\(52\.17,0\.07,52\.24,0\.2\)/); assert.match(q, /\["shop"~"\^\(bakery\|pastry\|confectionery\)\$"\]/); assert.doesNotMatch(q, /restaurant|\bpub\b|bar\b/); assert.match(q, /\[timeout:60\]/);
  const sorgular = []; const sorgula = async (s) => { sorgular.push(s); return { elements: [] }; };
  await kentBul('GB', kentler('GB', 'ek').slice(0, 1), { sorgula, bekleMs: 0, hafif: true, onceBol: true });
  assert.equal(sorgular.length, 4); assert.ok(sorgular.every((s) => /fast_food\|cafe\|ice_cream/.test(s)));
});
test('kentBul: 502 / 503 yaniti da kutuyu bolmeyi tetikler', async () => {
  let n = 0; const sorgula = async () => { n++; throw new Error('overpass yanit vermedi (502)'); };
  const r = await kentBul('AU', [METRO_EK.AU[0]], { sorgula, bekleMs: 0, hafif: true });
  assert.equal(n, 5); assert.deepEqual(r.hatalar, ['Perth']);
});
