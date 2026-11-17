// HAVUZ TIKANMASI (15 Kas 2026): on elemede atlanan adaylar havuz hedefini doldurmaz; havuz yalniz atlananlardan olusuyorsa tarama baslar.
// 14 Kas 19:00 - 15 Kas: 52 adayin 52'si on elemede atlandi, havuz hedefin ustunde sayildi, 25 tur tarama ve uretim olmadan dondu.  Ag yok, adlar uydurmadir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { onAtla, onHazirla, onKontrolOku, ON_DOSYA, ON_SURUM } from '../on-eleme.mjs';
import { uretimLead } from '../uretim.mjs';
import { dongu } from '../dongu.mjs';
import { gecici } from './gecici.mjs';

const NL = String.fromCharCode(10);
const yaz = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); };
const satir = (n, name, ek = {}) => ({ id: `NZ-n${n}`, osm: `node/${n}`, ulke: 'NZ', sektor: 'restoran', name, website: `https://t${n}.example/`, saat: null, dukkan: null, ...ek });
const aday = (n, name) => ({ ...satir(n, name), durum: 'aday', email: ['a', `t${n}.example`].join('@'), puan: 6 });
const on = (ek = {}) => ({ v: ON_SURUM, zincir: null, foto: 4, galeri: false, logo: true, menu: true, menuUrl: null, menuPdf: false, fiyat: 6, siparis: false, saat: true, tel: true, adres: true, kategori: null, ...ek });
const simdi = new Date().toISOString();

function kur({ atlananlar = true } = {}) {
  const depo = gecici('havuz-tik-'); const veri = path.join(depo, 'veri'); const planDosya = path.join(depo, 'plan.json');
  yaz(planDosya, { sektorler: { restoran: { aktif: true } }, sira: [['NZ', 'restoran']], limitler: { osmSorguHerTur: 0, osmHedefliHerTur: 0, havuzHedef: 2, uretimHerTur: 1, tarayiciEs: 1, restoranHerTur: 1, leadYenilemeGun: 120, pizzaBurgerHavuz: 0 } });
  // taranmamis iki lead (tarama bunlari almali) + uc taranmis aday (havuz)
  yaz(path.join(depo, 'lead', 'NZ-restoran.jsonl'), [satir(1, 'Harbour Cafe'), satir(2, 'Corner Bistro'), satir(7, 'Old Mill'), satir(8, 'Quay Kitchen'), satir(9, 'Hill Diner')].map((x) => JSON.stringify(x)).join(NL));
  yaz(path.join(depo, 'lead', 'NZ-restoran.tarandi.jsonl'), [aday(7, 'Old Mill'), aday(8, 'Quay Kitchen'), aday(9, 'Hill Diner')].map((x) => JSON.stringify(x)).join(NL));
  if (atlananlar) {
    yaz(path.join(depo, 'lead', ON_DOSYA), {
      'NZ-n7': { on: on({ zincir: 'franchise' }), at: simdi },
      'NZ-n8': { on: on({ menu: false, fiyat: 0 }), at: simdi },
      'NZ-n9': { on: on({ zincir: 'branches' }), at: simdi },
    });
  }
  return { depo, veri, planDosya };
}

function araclar(taranan, uretilen) {
  return {
    bul: async () => [], tarananlar: (f) => new Set((fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '').split(NL).filter(Boolean).map((x) => JSON.parse(x).id)), Polite: class { }, openBrowser: async () => ({ close: async () => {} }),
    taraHepsi: async ({ leads }) => { taranan.push(...leads.map((x) => x.id)); return { sayac: { aday: 0, 'iyi-site': leads.length } }; },
    uretimLead, uretimCalis: async ({ leads }) => { uretilen.push(...leads.map((x) => x.id)); return { sonuc: leads.map((x) => ({ id: x.id, status: 'elendi' })) }; },
    hazirlar: () => [], kutuEkle: () => 0, kutuOku: () => [], yazilanlar: () => ({ neden: () => null }),
  };
}

test('onAtla: onbellekteki zincir ve menu izi yok adaylari atlar; bilinmeyen ve restoran disi aday atlanmaz', () => {
  const { depo } = kur(); const ob = onKontrolOku(depo);
  assert.match(onAtla(satir(7, 'Old Mill'), ob), /zincir/);
  assert.match(onAtla(satir(8, 'Quay Kitchen'), ob), /menü izi yok/);
  assert.match(onAtla(satir(9, 'Hill Diner'), ob), /zincir/);
  assert.equal(onAtla(satir(1, 'Harbour Cafe'), ob), null, 'onbellekte yok: atlanmaz');
  assert.equal(onAtla({ ...satir(7, 'Old Mill'), sektor: 'konaklama' }, ob), null, 'restoran disi sektor');
  assert.deepEqual(onKontrolOku(gecici('havuz-bos-')), {}, 'onbellek dosyasi yoksa bos');
});

test('havuz tikanmasi: havuzdaki adaylarin hepsi on elemede atlaniyorsa havuz bos sayilir ve tarama baslar (15 Kas)', async () => {
  const { depo, veri, planDosya } = kur(); const taranan = []; const uretilen = [];
  const r = await dongu({ depo, kutu: null, sureDk: 30, parti: 'p', planDosya, veri, araclar: araclar(taranan, uretilen), log: () => {}, env: {} });
  assert.deepEqual(taranan.sort(), ['NZ-n1', 'NZ-n2'], 'yalniz taranmamis lead taranir');
  assert.ok(r.tarandi['NZ-restoran'], 'tarama sonucu kayitli');
  assert.equal(r.havuzAtlanan, 3); assert.deepEqual(r.havuzKullanilir, {});
  assert.equal(r.adaySayisi, 3, 'aday sayisi (rapor) degismez: atlananlar listede kalir, on eleme turda yine eler');
});

test('havuz tikanmasi kontrolu: atlanmayan adaylar hedefi doldurursa tarama baslamaz (eski davranis korunur)', async () => {
  const { depo, veri, planDosya } = kur({ atlananlar: false }); const taranan = []; const uretilen = [];
  const r = await dongu({ depo, kutu: null, sureDk: 30, parti: 'p', planDosya, veri, araclar: araclar(taranan, uretilen), log: () => {}, env: {} });
  assert.deepEqual(taranan, [], 'havuz 3 >= ulke hedefi 2: tarama yok');
  assert.equal(r.havuzAtlanan, 0); assert.deepEqual(r.havuzKullanilir, { NZ: 3 });
  assert.equal(uretilen.length, 1, 'tur hakki 1');
});

test('on eleme kisa listesi onbellekte zaten atlanan adaylari almaz; yeni adaylara bakilir', async () => {
  const { depo } = kur(); const ob = onKontrolOku(depo);
  const liste = [satir(7, 'Old Mill'), satir(8, 'Quay Kitchen'), satir(9, 'Hill Diner'), satir(1, 'Harbour Cafe'), satir(2, 'Corner Bistro')].map((l) => ({ ...l, saat: 'Mo-Su 09:00-17:00' }));
  const istenen = [];
  const polite = { get: async (u) => { istenen.push(u); return { ok: true, text: '<a href="/menu">Menu</a><p>Fish 12.50</p>', finalUrl: u }; } };
  const r = await onHazirla({ liste, depo, adet: 2, polite, es: 1, osmEk: async () => new Map() });
  assert.equal(r.sayac.bakilan, 2, 'kisa liste: yalniz atlanmamis iki aday');
  assert.deepEqual(istenen.filter((u) => !/menu/.test(u)).sort(), ['https://t1.example/', 'https://t2.example/']);
  assert.equal(r.sayac.atla, 3, 'atlananlar yine listeden cikar'); assert.deepEqual(r.liste.map((l) => l.id).sort(), ['NZ-n1', 'NZ-n2']);
  assert.ok(ob['NZ-n7'], 'onbellek okunur');
});
