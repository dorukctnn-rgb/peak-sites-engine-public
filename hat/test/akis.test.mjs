// Hat akisi testleri: dongu (sahte araclarla), butce, isinma takvimi, otomatik durdurma.  Ag yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dongu, planOku, adaylar } from '../dongu.mjs';
import { butceHesapla, dakika } from '../butce.mjs';
import { istatistik, karar, bugunKullanilan, yenidenBeklet, adaylariSec, birakCalis, KOTA } from '../birak.mjs';
import { taraHepsi } from '../../lead/tara.mjs';
import { uretimLead } from '../uretim.mjs';
import { profil } from '../../uyarla/sektor/index.mjs';
import { SEKTORLER } from '../../lead/sektorler.mjs';
import { SABLON } from '../../mail/sablon.mjs';

import { gecici } from './gecici.mjs';
const tmp = () => gecici('akis-test-');
const PLAN = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'plan.json');

test('plan: yalniz aktif sektorler ve hedef ulkeler', () => {
  const p = planOku(PLAN);
  assert.ok(p.sira.length >= 4); for (const [u, s] of p.sira) { assert.ok(['AU', 'NZ', 'IE', 'GB', 'SG', 'TR'].includes(u)); assert.ok(['konaklama', 'guzellik', 'restoran'].includes(s)); }
  // TR (11 Kas deneme turu) yalniz restoran ailesiyle
  assert.ok(p.sira.some(([u, s]) => u === 'TR' && s === 'restoran')); assert.ok(!p.sira.some(([u, s]) => u === 'TR' && s !== 'restoran'));
  // aktif her sektorun parcalari: lead tanimi; konaklama ve guzellik icin sayfa profili + mail sablonu.  Restoran ailesi kendi uretecinden (uyarla/uret.mjs, v5/kategori)
  // sayfa yapar; motorda mail sablonu yok, satir yalniz RESTORAN_KUYRUK=acik + son goz onayiyla yazilir (hat/kuyruk.mjs).
  for (const s of new Set(p.sira.map(([, x]) => x))) {
    assert.ok(SEKTORLER[s], `lead tanimi: ${s}`);
    if (s === 'restoran') { assert.ok(fs.existsSync(path.join(path.dirname(PLAN), '..', 'uyarla', 'uret.mjs')), 'restoran ureteci'); continue; }
    assert.ok(profil({ sektor: s }), `profil: ${s}`); assert.ok(SABLON[s], `mail sablonu: ${s}`);
  }
  const d = tmp(); const f = path.join(d, 'p.json');
  fs.writeFileSync(f, JSON.stringify({ sektorler: { a: { aktif: true }, b: { aktif: false } }, sira: [['TR', 'a'], ['US', 'a'], ['IE', 'a'], ['IE', 'b']] }));
  assert.deepEqual(planOku(f).sira, [['IE', 'a']]);
});

// ---- dongu: sahte OSM, tarama, uretim, kutu ----
const lead = (i, ek = {}) => ({ id: `IE-n${1000 + i}`, osm: `node/${1000 + i}`, ulke: 'IE', sektor: 'konaklama', name: `House ${i}`, website: `http://h${i}.ie/`, tur: 'guest house', email: '', ...ek });
function ortam() {
  const depo = tmp(); const veri = path.join(depo, 'veri'); const kutu = tmp(); const log = [];
  const planDosya = path.join(depo, 'plan.json');
  fs.writeFileSync(planDosya, JSON.stringify({ sektorler: { konaklama: { aktif: true } }, sira: [['IE', 'konaklama']], limitler: { osmSorguHerTur: 1, havuzHedef: 3, uretimHerTur: 2, tarayiciEs: 2 } }));
  const araclar = {
    bul: async () => [lead(1), lead(2), lead(3), lead(4)],
    tarananlar: (f) => new Set(fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id) : []),
    Polite: class { }, openBrowser: async () => ({ close: async () => {} }),
    taraHepsi: async ({ leads, cikti, onceki }) => { const say = {}; for (const l of leads) { if (onceki.has(l.id)) continue; const r = { ...l, durum: 'aday', puan: 5 + Number(l.id.slice(-1)), email: `x@h${l.id.slice(-1)}.ie`, finalUrl: l.website }; fs.appendFileSync(cikti, `${JSON.stringify(r)}\n`); say.aday = (say.aday || 0) + 1; } return { sayac: say, kalan: false }; },
    uretimLead,
    uretimCalis: async ({ leads }) => { const sonuc = []; for (const l of leads) { assert.equal(l.email, undefined, 'uretim e-posta gormez'); const slug = uretimLead(l).slug; fs.mkdirSync(path.join(veri, slug, 'inceleme'), { recursive: true }); fs.writeFileSync(path.join(veri, slug, 'kapi.json'), '{"status":"hazir"}'); fs.writeFileSync(path.join(veri, slug, 'inceleme', 'sheet.jpg'), 'x'); fs.writeFileSync(path.join(veri, slug, 'inceleme', 'bilgi.json'), '{}'); sonuc.push({ id: l.id, slug, status: 'hazir' }); } return { sonuc, kalan: false }; },
    hazirlar: (v) => fs.readdirSync(v).filter((s) => fs.existsSync(path.join(v, s, 'kapi.json'))),
    kutuEkle: ({ kutu: k, slugs, parti }) => { fs.writeFileSync(path.join(k, 'B.json'), JSON.stringify([...(fs.existsSync(path.join(k, 'B.json')) ? JSON.parse(fs.readFileSync(path.join(k, 'B.json'), 'utf8')) : []), ...slugs.map((slug) => ({ slug, parti }))])); return slugs.length; },
    kutuOku: (k) => (fs.existsSync(path.join(k, 'B.json')) ? JSON.parse(fs.readFileSync(path.join(k, 'B.json'), 'utf8')) : []),
    yazilanlar: () => ({ neden: (e) => (e === 'x@h4.ie' ? 'suppressed' : null) }),
  };
  return { depo, veri, kutu, planDosya, araclar, log };
}

test('dongu: lead topla, tara, uret, kutuya koy; ikinci tur ayni isi tekrarlamaz; susturulan uretilmez', async () => {
  const o = ortam(); const run = () => dongu({ depo: o.depo, kutu: o.kutu, po: o.depo, sureDk: 30, parti: 'p1', planDosya: o.planDosya, veri: o.veri, araclar: o.araclar, log: () => {} });
  const r1 = await run();
  assert.deepEqual(r1.osm, ['IE-konaklama: 4']);
  assert.equal(r1.uretim.hazir, 2); assert.equal(r1.kutuya, 2);
  assert.equal(r1.adaySayisi, 3, 'h4 susturulmus: adaylara girmez');
  const r2 = await run();
  assert.deepEqual(r2.osm, [], 'lead listesi taze: yeniden sorgulanmaz');
  assert.equal(r2.uretim.hazir, 1); assert.equal(r2.kutuya, 1);
  const r3 = await run(); assert.equal(r3.uretim.hazir, undefined); assert.equal(r3.kutuya, 0);
  assert.equal(o.araclar.kutuOku(o.kutu).length, 3);
  const d = JSON.parse(fs.readFileSync(path.join(o.depo, 'durum', 'dongu.json'), 'utf8')); assert.equal(d.turlar, 3);
  assert.ok(!JSON.stringify(d).includes('@'), 'durum dosyasinda e-posta yok');
  // en kotu site once uretilir
  assert.ok(fs.existsSync(path.join(o.veri, uretimLead(lead(3)).slug, 'kapi.json')));
});

test('adaylar: durumu aday olmayanlar ve e-postasiz olanlar uretilmez', () => {
  const depo = tmp(); fs.mkdirSync(path.join(depo, 'lead'));
  fs.writeFileSync(path.join(depo, 'lead', 'IE-konaklama.tarandi.jsonl'), [lead(1, { durum: 'aday', email: 'a@b.ie', puan: 5 }), lead(2, { durum: 'engel' }), lead(3, { durum: 'aday', email: null }), lead(4, { durum: 'aday', email: 'c@d.ie', puan: 9 })].map((x) => JSON.stringify(x)).join('\n'));
  const l = adaylar({ depo, plan: { sira: [['IE', 'konaklama']] }, veri: path.join(depo, 'veri'), uretimLead });
  assert.deepEqual(l.map((x) => x.id), ['IE-n1001', 'IE-n1004'], 'puan 5 (malzemesi olma ihtimali yuksek) puan 9 olandan once');
});

test('taraHepsi: havuz, devam, sure siniri', async () => {
  const d = tmp(); const cikti = path.join(d, 'c.jsonl'); const leads = Array.from({ length: 7 }, (_, i) => lead(i));
  let ayni = 0; let en = 0;
  const tara = async (l) => { ayni++; en = Math.max(en, ayni); await new Promise((r) => setTimeout(r, 15)); ayni--; return { ...l, durum: 'iyi-site' }; };
  const r = await taraHepsi({ leads, cikti, es: 3, tara });
  assert.equal(r.sayac['iyi-site'], 7); assert.ok(en <= 3 && en >= 2);
  const r2 = await taraHepsi({ leads, cikti, es: 3, tara, onceki: new Set(leads.slice(0, 5).map((l) => l.id)) }); assert.equal(r2.sayac['iyi-site'], 2);
  const r3 = await taraHepsi({ leads, cikti: path.join(d, 'd.jsonl'), es: 1, tara, sureDk: -1 }); assert.equal(r3.kalan, true);
  const hata = await taraHepsi({ leads: [lead(1)], cikti: path.join(d, 'e.jsonl'), es: 1, tara: async () => { throw new Error('patladi'); } }); assert.equal(hata.sayac.erisilemedi, 1);
});

test('butce: aylik ve gunluk sinir, kosu suresi yukari yuvarlanir, okunamazsa durur', () => {
  const simdi = new Date('2026-11-10T12:00:00Z');
  const run = (baslangic, dk) => ({ status: 'completed', run_started_at: baslangic, updated_at: new Date(Date.parse(baslangic) + dk * 60000 - 1000).toISOString() });
  assert.equal(dakika(run('2026-11-10T01:00:00Z', 25)), 25);
  const a = butceHesapla({ runs: [run('2026-11-03T01:00:00Z', 30), run('2026-11-10T01:00:00Z', 20)], simdi, aylik: 600, gunluk: 50, tur: 40 });
  assert.equal(a.ayKullanilan, 50); assert.equal(a.gunKullanilan, 20); assert.equal(a.sure, 30); assert.equal(a.calis, true);
  assert.equal(butceHesapla({ runs: [run('2026-11-10T01:00:00Z', 48)], simdi }).calis, false);
  assert.equal(butceHesapla({ runs: [run('2026-11-02T01:00:00Z', 595)], simdi }).calis, false);
  assert.equal(butceHesapla({ runs: [run('2026-10-30T01:00:00Z', 900)], simdi }).calis, true, 'gecen ay sayilmaz');
  assert.equal(butceHesapla({ runs: [{ status: 'in_progress', run_started_at: '2026-11-10T11:00:00Z', updated_at: '2026-11-10T11:30:00Z' }], simdi }).ayKullanilan, 0);
  assert.equal(butceHesapla({ runs: [], simdi, sinirsiz: true }).calis, true);
});

// ---- birak: isinma takvimi + otomatik durdurma ----
const gonder = (id, gun, status = 'sent', saat = '10:00:00') => ({ ts: `${gun}T${saat}.000Z`, id, to: 'x@y.ie', campaign: 'websites-demo', region: 'IE', status });
const gunleri = (gun, n, sekme = 0, onek = 'WD') => Array.from({ length: n }, (_, i) => gonder(`${onek}-${gun}-${i}`, gun, i < sekme ? 'rejected' : 'sent'));
const SIMDI = new Date('2026-11-14T22:00:00Z');

test('isinma: ilk gun 20, bir temiz gunden sonra 40, iki temiz gunden sonra 65; temiz olmayan gun basa doner', () => {
  assert.deepEqual(KOTA, [20, 40, 65]);
  const K = (sent, suppress = '') => karar({ istat: istatistik({ sentRows: sent, suppressText: suppress, simdi: SIMDI }), simdi: SIMDI });
  assert.equal(K([]).hedef, 20);
  assert.equal(K(gunleri('2026-11-12', 20)).hedef, 40);
  assert.equal(K([...gunleri('2026-11-11', 20), ...gunleri('2026-11-12', 40)]).hedef, 65);
  assert.equal(K([...gunleri('2026-11-11', 20), ...gunleri('2026-11-12', 40), ...gunleri('2026-11-13', 65)]).hedef, 65);
  assert.equal(K(gunleri('2026-11-13', 5)).hedef, 20, '10 denemeden az gun gonderim gunu sayilmaz');
  const kotu = K([...gunleri('2026-11-12', 40), ...gunleri('2026-11-13', 40, 4)]); // 4/80 = %5 sekme
  assert.equal(kotu.hedef, 20); assert.match(kotu.durak, /sekme orani/);
  assert.equal(K([...gunleri('2026-11-12', 40), ...gunleri('2026-11-13', 40, 1)]).durak, '', '1/80 temiz');
  assert.equal(K(gunleri('2026-11-13', 10, 1)).durak, '', 'orneklem 15 altinda: durdurma yok');
});

test('otomatik durdurma: sekme > %3, gec sekme, sikayet', () => {
  const K = (sent, suppress = '') => karar({ istat: istatistik({ sentRows: sent, suppressText: suppress, simdi: SIMDI }), simdi: SIMDI });
  const temiz = gunleri('2026-11-13', 40);
  assert.equal(K(temiz).durak, '');
  const gec = '# 2026-11-14 late bounce 2026-11-13 (550 mailbox gone) WD-2026-11-13-1\n# 2026-11-14 late bounce 2026-11-13 (550 mailbox gone) WD-2026-11-13-2\n';
  assert.match(K(temiz, gec).durak, /sekme orani/, 'iki gec sekme: 2/40 = %5');
  assert.match(K(temiz, '# 2026-11-12 complaint: marked as spam WH-IE-n1\n').durak, /sikayet/);
  assert.equal(K(temiz, '# 2026-10-01 complaint: marked as spam WH-IE-n1\n').durak, '', '7 gunden eski sikayet');
  assert.equal(K(temiz, '# 2026-11-12 complaint: marked as spam BG-013\n').durak, '', 'baska kampanyanin sikayeti');
  assert.match(K(temiz, '# 2026-11-13 reported us as spam\n').durak, /sikayet/, 'kimligi olmayan sikayet sayilir (guvenli taraf)');
});

const SATIR = (id, ek = {}) => JSON.stringify({ id, to: `${id.toLowerCase()}@x.ie`, name: 'X', campaign: 'websites-demo', region: 'IE', lang: 'en', segment: 'demo-konaklama', subject: 's', body: 'b', notBefore: '2026-11-11T00:00:00Z', _held: 'hat: sektörün ilk 5 sayfası koordinatör kontrolü bekliyor', _hat: { sektor: 'konaklama' }, ...ek });

test('yeniden beklet: yalniz WH- olan, acik ve gonderilmemis satirlar', () => {
  const q = [SATIR('WH-IE-n1', { _held: undefined }), SATIR('WH-IE-n2', { _held: undefined }), SATIR('WD-IE-n3', { _held: undefined }), SATIR('WH-IE-n4')].join('\n') + '\n';
  const r = yenidenBeklet(q, 'deneme', SIMDI, [{ id: 'WH-IE-n2', status: 'sent' }]);
  assert.equal(r.n, 1);
  const rows = r.text.split('\n').filter(Boolean).map(JSON.parse);
  assert.match(rows[0]._held, /otomatik durdu/); assert.equal(rows[1]._held, undefined); assert.equal(rows[2]._held, undefined);
  assert.equal(r.text.endsWith('\n'), true);
});

test('birakCalis: onaysiz sektor acilmaz; onayli sektor kotaya kadar acilir; durakta geri beklet', async () => {
  const po = tmp(); const depo = tmp(); fs.mkdirSync(path.join(po, 'data')); fs.mkdirSync(path.join(po, 'src')); fs.mkdirSync(path.join(po, 'attachments'));
  const rows = Array.from({ length: 30 }, (_, i) => SATIR(`WH-IE-n${100 + i}`));
  fs.writeFileSync(path.join(po, 'data', 'queue.jsonl'), `${rows.join('\n')}\n`); fs.writeFileSync(path.join(po, 'data', 'sent.jsonl'), ''); fs.writeFileSync(path.join(po, 'suppress.txt'), ''); fs.writeFileSync(path.join(po, 'config.json'), '{"regions":{}}');
  // peak-outreach'in kendi release modulunun sade taklidi
  fs.writeFileSync(path.join(po, 'src', 'release-websites-demo.mjs'), `
    export async function chooseRelease({ queueText, first, ids }) { const out = []; queueText.split('\\n').forEach((l, i) => { if (!l.trim()) return; const row = JSON.parse(l); if (row._held && ids.includes(row.id) && out.length < first) out.push({ row, line: i + 1 }); }); return { chosen: out, skipped: {} }; }
    export function applyRelease(t, chosen, now) { const lines = t.split('\\n'); for (const { row, line } of chosen) { const n = { ...row }; delete n._held; n.notBefore = now; n._released = now; lines[line - 1] = JSON.stringify(n); } return lines.join('\\n'); }
    export const livePage = null;`);
  const q = () => fs.readFileSync(path.join(po, 'data', 'queue.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  let r = await birakCalis({ po, depo, yaz: true, simdi: SIMDI, log: () => {} });
  assert.equal(r.birakilan, 0, 'onay yok'); assert.equal(q().filter((x) => !x._held).length, 0);
  fs.mkdirSync(path.join(depo, 'durum'), { recursive: true }); fs.writeFileSync(path.join(depo, 'durum', 'onay.json'), JSON.stringify({ konaklama: { onaylandi: true, kim: 'test' } }));
  r = await birakCalis({ po, depo, yaz: true, simdi: SIMDI, log: () => {} });
  assert.equal(r.hedef, 20); assert.equal(r.birakilan, 20); assert.equal(q().filter((x) => !x._held).length, 20);
  r = await birakCalis({ po, depo, yaz: true, simdi: SIMDI, log: () => {} });
  assert.equal(r.birakilan, 0, 'ayni gun ikinci kez kota asilmaz (20 acik gonderilmemis satir var)');
  // temiz iki gun + yarin: 65'e cikar ama 10 satir kaldi
  fs.writeFileSync(path.join(po, 'data', 'sent.jsonl'), [...gunleri('2026-11-12', 20), ...gunleri('2026-11-13', 40)].map((x) => JSON.stringify(x)).join('\n') + '\n');
  r = await birakCalis({ po, depo, yaz: true, simdi: SIMDI, log: () => {} });
  assert.equal(r.hedef, 65); assert.equal(r.birakilan, 10);
  assert.equal(q().filter((x) => x._held).length, 0);
  // sikayet: acik satirlar geri bekletilir, DURDU.json yazilir, sonraki tur acmaz
  fs.writeFileSync(path.join(po, 'suppress.txt'), '# 2026-11-14 complaint marked as spam WH-IE-n100\n');
  r = await birakCalis({ po, depo, yaz: true, simdi: SIMDI, log: () => {} });
  assert.match(r.durak, /sikayet/); assert.equal(r.yenidenBekletilen, 30); assert.ok(fs.existsSync(path.join(depo, 'durum', 'DURDU.json')));
  fs.writeFileSync(path.join(po, 'suppress.txt'), '');
  r = await birakCalis({ po, depo, yaz: true, simdi: SIMDI, log: () => {} });
  assert.match(r.durak, /DURDU\.json var/, 'kendiliginden devam etmez'); assert.equal(r.birakilan, 0);
});

test('bugunKullanilan ve adaylariSec', () => {
  const sent = [gonder('WD-1', '2026-11-14'), gonder('WD-2', '2026-11-13')];
  const qr = [JSON.parse(SATIR('WH-IE-n1', { _held: undefined })), JSON.parse(SATIR('WH-IE-n2')), JSON.parse(SATIR('WH-IE-n3', { _hat: { sektor: 'guzellik' } }))];
  assert.equal(bugunKullanilan({ sentRows: sent, queueRows: qr, simdi: SIMDI }), 2);
  assert.deepEqual(adaylariSec({ queueRows: qr, onay: { konaklama: { onaylandi: true } } }), ['WH-IE-n2']);
  assert.deepEqual(adaylariSec({ queueRows: qr, onay: { konaklama: { onaylandi: false } } }), []);
});

test('sektor kaniti: dosya ciftlerinden oranlar', async () => {
  const { kanit, tablo } = await import('../sektor-kanit.mjs');
  const d = tmp(); const w = (f, rows) => fs.writeFileSync(path.join(d, f), rows.map((x) => JSON.stringify(x)).join('\n'));
  w('IE-konaklama.jsonl', [lead(1), lead(2), lead(3, { elendi: 'zincir' }), lead(4)]);
  w('IE-konaklama.tarandi.jsonl', [{ id: 'a', durum: 'aday', bulgular: [{ k: 'https-yok' }] }, { id: 'b', durum: 'engel', bulgular: [{ k: 'https-yok' }, { k: 'fiyat-yok' }] }, { id: 'c', durum: 'iyi-site', bulgular: [] }, { id: 'd', durum: 'erisilemedi' }]);
  const r = kanit(d); assert.equal(r.length, 1);
  assert.deepEqual({ lead: r[0].lead, elenen: r[0].elenen, taranan: r[0].taranan, aday: r[0].aday, adayOrani: r[0].adayOrani, kotuOrani: r[0].kotuOrani }, { lead: 3, elenen: 1, taranan: 4, aday: 1, adayOrani: 25, kotuOrani: 66.7 });
  assert.match(tablo(r), /IE-konaklama \| 3 \| 4 \| 1 \| 1 \| 1 \| 1 \| 25 \| 66\.7 \| https-yok 2, fiyat-yok 1/);
});
