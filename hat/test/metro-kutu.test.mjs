// METRO KUTULARI (15 Kas 2026): AU ve GB listesi yalniz kent dikdortgenlerinden, ulke alani olmadan; eski ulke izgarasi ilerlemesi atilir (yalniz bu iki ulke);
// AU metro lead'i saat dilimini koordinattan alir (v5 ve kategori "simdi acik").  Ag yok (Overpass sahte).  Isletme adlari uydurmadir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sorgu, sorguPB, bulParcali, metroOf, metroTz, METRO, METRO_PLAN } from '../../lead/osm.mjs';
import { uretimLead } from '../uretim.mjs';
import { gecici } from './gecici.mjs';

const el = (id, lat, lon, ek = {}) => ({ type: 'node', id, lat, lon, tags: { name: `Deneme ${id}`, website: `https://d${id}.example/`, amenity: 'restaurant', ...ek } });

test('alansiz sorgu: ulke alani yok, yalniz dikdortgen; alansiz verilmezse eski bicim', () => {
  const k = [-34.12, 150.75, -33.6, 151.35];
  const q = sorgu('AU', 'restoran', { kutu: k, zaman: 100, alansiz: true });
  assert.doesNotMatch(q, /area\[/); assert.match(q, /\["website"\]\(-34\.12,150\.75,-33\.6,151\.35\);/); assert.match(q, /\[timeout:100\]/);
  assert.match(sorgu('AU', 'restoran', { kutu: k }), /area\["ISO3166-1"="AU"\]/, 'eski bicim degismedi');
  const p = sorguPB('GB', { kutu: [51.3, -0.5, 51.69, 0.28], alansiz: true });
  assert.doesNotMatch(p, /area/); assert.match(p, /\["cuisine"~"pizza\|burger",i\]\["website"\]\(51\.3,-0\.5,51\.69,0\.28\);/);
  assert.match(sorguPB('TR', { kutu: [36, 30, 37, 31] }), /\(area\.a\)\(36,30,37,31\)/, 'TR hedefli sorgu eski bicimde');
});

test('AU parcali liste: yalniz uc kent kutusu, eski okyanus izgarasi ilerlemesi atilir, liste biter', async () => {
  const d = gecici('metro-au-'); const ilerleme = path.join(d, 'AU-restoran.parca.json');
  fs.writeFileSync(ilerleme, JSON.stringify({ surum: 1, ulke: 'AU', sektor: 'restoran', bekleyen: [[-42.4, 123.8, -42.1, 124.1]], biten: 39, bolunen: 20, oge: {} }));
  const sorgular = [];
  const sorgula = async (q) => { sorgular.push(q); const m = /\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\);/.exec(q); const s = +m[1]; const w = +m[2]; return { elements: [el(Math.round(Math.abs(s * 100)), s + 0.1, w + 0.1)] }; };
  const r = await bulParcali('AU', 'restoran', { ilerleme, sorgula, bekleMs: 0 });
  assert.equal(r.tamam, true); assert.equal(r.parca, '3/3'); assert.equal(sorgular.length, 3);
  assert.ok(sorgular.every((q) => !/area/.test(q)), 'ulke alani sorulmaz');
  assert.equal(r.leads.length, 3); assert.equal(fs.existsSync(ilerleme), false, 'biten ilerleme silinir');
  assert.deepEqual(r.leads.map((l) => metroTz(l)).sort(), ['Australia/Brisbane', 'Australia/Melbourne', 'Australia/Sydney']);
});

test('GB metro: yavas kent kutusu bolunur (0,08 dereceye kadar), plan kaydi tutulur; TR ilerlemesi plansiz da korunur', async () => {
  const d = gecici('metro-gb-'); const ilerleme = path.join(d, 'GB-restoran.parca.json'); let n = 0; let saat = 0;
  const sorgula = async () => { n++; saat += 130000; if (n <= 2) { const e = new Error('overpass yanit vermedi (504)'); e.yavas = true; throw e; } return { elements: [] }; };
  const r = await bulParcali('GB', 'restoran', { ilerleme, sorgula, bekleMs: 0, simdi: () => saat, bitis: 130000 * 3 + 1000 });
  assert.equal(r.tamam, false, 'sure butcesi: uc parca'); const P = JSON.parse(fs.readFileSync(ilerleme, 'utf8'));
  assert.equal(P.plan, METRO_PLAN); assert.equal(P.bolunen, 1, 'London dorde bolundu'); assert.equal(P.biten + P.bekleyen.length, METRO.GB.length - 1 + 4);
  const t = path.join(d, 'TR-restoran.parca.json'); fs.writeFileSync(t, JSON.stringify({ surum: 1, ulke: 'TR', sektor: 'restoran', bekleyen: [[36, 30, 37, 31]], biten: 30, bolunen: 0, oge: {} }));
  const r2 = await bulParcali('TR', 'restoran', { ilerleme: t, sorgula: async () => ({ elements: [] }), bekleMs: 0 });
  assert.equal(r2.parca, '31/31', 'TR eski ilerlemeden surer (metro plani yok)');
});

test('metroTz: AU kent kutusu saat dilimi, kutu disi ve GB null; uretimLead tz tasir', () => {
  assert.equal(metroTz({ ulke: 'AU', lat: -33.87, lon: 151.21 }), 'Australia/Sydney');
  assert.equal(metroTz({ ulke: 'AU', lat: -37.81, lon: 144.96 }), 'Australia/Melbourne');
  assert.equal(metroTz({ ulke: 'AU', lat: -27.47, lon: 153.03 }), 'Australia/Brisbane');
  assert.equal(metroTz({ ulke: 'AU', lat: -31.95, lon: 115.86 }), null, 'Perth kutu disi');
  assert.equal(metroTz({ ulke: 'GB', lat: 51.5, lon: -0.12 }), null, 'GB saat dilimi bolgeden');
  assert.equal(metroOf('GB', 51.5, -0.12).ad, 'London');
  assert.equal(metroTz({ ulke: 'AU', lat: null, lon: null }), null);
  const u = uretimLead({ id: 'AU-n1', osm: 'node/1', ulke: 'AU', sektor: 'restoran', name: 'Deneme Burger', website: 'https://d1.example/', lat: -37.8, lon: 144.97 });
  assert.equal(u.tz, 'Australia/Melbourne');
  assert.equal(uretimLead({ id: 'NZ-n2', osm: 'node/2', ulke: 'NZ', sektor: 'restoran', name: 'Deneme', website: 'https://d2.example/', lat: -36.8, lon: 174.7 }).tz, null);
});

test('sunucu secimi: yavas sunucu parcayi bolmez, parca baska sunucuda denenir; calisan sunucu korunur (15 Kas)', async () => {
  const ilkler = [];
  const sorgula = async (q, { ilk }) => { ilkler.push(ilk); if (ilk % 4 === 0) { const e = new Error('overpass yanit vermedi (TimeoutError)'); e.yavas = true; throw e; } return { elements: [] }; };
  const r = await bulParcali('AU', 'restoran', { ilerleme: null, sorgula, bekleMs: 0 });
  assert.equal(r.tamam, true); assert.equal(r.parca, '3/3', 'hic bolunmedi');
  assert.deepEqual(ilkler, [0, 1, 1, 1], 'ilk sunucu yavas: ikinci sunucu; sonra hep calisan sunucu');
});
