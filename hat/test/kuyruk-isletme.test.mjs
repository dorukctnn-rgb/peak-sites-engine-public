// hat/kuyruk.mjs: ayni isletmeye, baska adresle de olsa (ortak e-posta saglayicisi dahil) ikinci kez satir yazilmaz.  Mail sablonu ozel katmandan gelir (hat/ozel-getir.mjs):
// bu test ozel varlik ister (tam paketle kosar).  Butun adlar, siteler, telefonlar ve adresler uydurmadir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { yazilanlar, satirlarKur } from '../kuyruk.mjs';

const jl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n');
const GIDEN = { ts: '2026-11-05T10:00:00Z', id: 'WS-AU-901', to: 'ilk.adres@gmail.com', campaign: 'websites', region: 'AU', status: 'sent' };
const ESKI = { id: 'WS-AU-901', to: 'ilk.adres@gmail.com', name: 'Ornek Otel', campaign: 'websites', region: 'AU', subject: 's', body: 'b', evidence: { site: 'https://www.ornekotel.test/', phone: '+61 2 5550 0100' } };
const lead = (i, o = {}) => ({ id: `AU-n${5000 + i}`, osm: `node/${5000 + i}`, ulke: 'AU', sektor: 'konaklama', name: `Ornek Pansiyon ${['Bir', 'Iki', 'Uc', 'Dort', 'Bes'][i - 1]}`, website: `http://pansiyon${i}.test/`, finalUrl: `http://pansiyon${i}.test/`, phone: '', city: 'Sydney', email: `kimse${i}@gmail.com`, durum: 'aday', puan: 5, ...o });

test('yazilanlar: baska adresle ayni isletme (site, telefon, OSM, ad + sehir) "isletme-daha-once"; adres ve alan adi nedenleri kendi adlarinda kalir; lead verilmezse eski kontroller', () => {
  const Y = yazilanlar({ sent: [GIDEN], queue: [ESKI], suppress: '', replied: '' });
  const baska = { name: 'Baska Ad', ulke: 'AU', city: 'Melbourne' };
  assert.equal(Y.neden('ikinci.adres@gmail.com', { ...baska, website: 'https://ornekotel.test/menu' }), 'isletme-daha-once', 'ayni site');
  assert.equal(Y.neden('ikinci.adres@gmail.com', { ...baska, phone: '(02) 5550 0100' }), 'isletme-daha-once', 'ayni telefon');
  assert.equal(Y.neden('ikinci.adres@gmail.com', { name: 'ORNEK OTEL', ulke: 'AU', city: 'Sydney' }), 'isletme-daha-once', 'ayni ad ayni sehir');
  assert.equal(Y.neden('ilk.adres@gmail.com', { ...baska, website: 'https://ornekotel.test/' }), 'adres-daha-once', 'ayni adres kendi nedenini korur');
  assert.equal(Y.neden('ikinci.adres@gmail.com'), null, 'lead verilmezse yalniz eski kontroller');
  assert.equal(Y.neden('ikinci.adres@gmail.com', { ...baska, website: 'https://tamamen-baska.test/', phone: '+61 3 5550 0999' }), null);
  assert.equal(Y.neden('ikinci.adres@gmail.com', { name: 'Ornek Otel', ulke: 'NZ', city: 'Sydney' }), null, 'baska bolge');
  const b = Y.isletme({ ...baska, website: 'https://ornekotel.test/' });
  assert.deepEqual(b, { neden: 'site', id: 'WS-AU-901', kampanya: 'websites', durum: 'giden' });
  assert.doesNotMatch(JSON.stringify(b), /@/, 'sonuc kimlik ve durum, adres degil');
  assert.equal(Y.isletme(null), null);
});

test('yazilanlar: kuyrukta bekleyen ya da serbest satir engeller, eski websites bekleyen satiri engellemez, bekleyen websites-demo satiri engeller', () => {
  const q = [
    { ...ESKI, id: 'WS-AU-902', name: 'Serbest Yer', evidence: { site: 'https://serbest.test/' } },
    { ...ESKI, id: 'WS-AU-903', name: 'Eski Bekleyen', _held: 'eski', evidence: { site: 'https://eskibekleyen.test/' } },
    { ...ESKI, id: 'WH-AU-n7007', campaign: 'websites-demo', name: 'Hat Bekleyen', _held: 'hat', _biz: { site: 'hatbekleyen.test' } },
  ];
  const Y = yazilanlar({ sent: [], queue: q, suppress: '', replied: '' });
  const n = (site) => Y.neden('yeni.adres@gmail.com', { name: 'Hic Baska', ulke: 'AU', website: site });
  assert.equal(n('https://serbest.test/'), 'isletme-daha-once');
  assert.equal(n('https://eskibekleyen.test/'), null);
  assert.equal(n('https://hatbekleyen.test/'), 'isletme-daha-once');
});

test('satirlarKur: yazilmis isletmenin ikinci adresi atlanir, ayni partide ayni isletme bir satir verir, yeni satir _biz tasir, adres ciktida yok', () => {
  const leads = [
    lead(1, { name: 'Ornek Otel', website: 'http://www.ornekotel.test/', finalUrl: 'http://www.ornekotel.test/', city: 'Sydney', email: 'ikinci.adres@gmail.com' }), // 5 Kas'ta baska adresle yazilmis
    lead(2, { phone: '+61 7 5550 0222', email: 'kimse2@gmail.com' }),
    lead(3, { website: 'http://pansiyon3.test/', finalUrl: 'http://www.pansiyon2-yeni.test/', phone: '07 5550 0222', email: 'kimse3@gmail.com' }), // 2 ile ayni telefon
    lead(4, { email: 'kimse4@gmail.com' }),
  ];
  const leadsById = new Map(leads.map((l) => [l.id, l]));
  const son = leads.map((l) => ({ durum: 'hazir', id: l.id, slug: `s-${l.id.toLowerCase()}`, page: `r/s-${l.id.toLowerCase()}-abc123/`, onizleme: `/p/${l.id}.jpg`, sektor: 'konaklama', parti: 'p1' }));
  const r = satirlarKur({ son, leadsById, po: { sent: jl([GIDEN]), queue: jl([ESKI]), suppress: '', replied: '' }, simdi: new Date('2026-11-12T08:00:00Z') });
  assert.deepEqual(r.satirlar.map((s) => s.id), ['WH-AU-n5002', 'WH-AU-n5004']);
  assert.equal(r.atla['isletme-daha-once'], 1);
  assert.equal(r.atla['partide-tekrar'], 1);
  assert.deepEqual(r.satirlar[0]._biz, { site: 'pansiyon2.test', phone: '755500222', osm: 'node/5002', city: 'Sydney' });
  assert.ok(r.satirlar.every((s) => s._held && s.campaign === 'websites-demo'));
  assert.doesNotMatch(JSON.stringify(r.atla), /@/);
});

test('adaylar: uretimden ONCE elenir; yazilmis isletmenin baska adresli lead\'i uretilmez, digerleri uretilir', async () => {
  const { adaylar } = await import('../dongu.mjs');
  const { uretimLead } = await import('../uretim.mjs');
  const { gecici } = await import('./gecici.mjs');
  const fs = await import('node:fs'); const path = await import('node:path');
  const depo = gecici('isl-aday-'); fs.mkdirSync(path.join(depo, 'lead'));
  const ls = [lead(1, { name: 'Ornek Otel', website: 'http://ornekotel.test/', finalUrl: 'http://ornekotel.test/', email: 'ikinci.adres@gmail.com' }), lead(2, { email: 'kimse2@gmail.com' }), lead(4, { email: 'kimse4@gmail.com', puan: 9 })];
  fs.writeFileSync(path.join(depo, 'lead', 'AU-konaklama.tarandi.jsonl'), ls.map((x) => JSON.stringify(x)).join('\n'));
  const yazilan = yazilanlar({ sent: [GIDEN], queue: [ESKI], suppress: '', replied: '' });
  const l = adaylar({ depo, plan: { sira: [['AU', 'konaklama']] }, veri: path.join(depo, 'veri'), yazilan, uretimLead });
  assert.deepEqual(l.map((x) => x.id).sort(), ['AU-n5002', 'AU-n5004']);
});
