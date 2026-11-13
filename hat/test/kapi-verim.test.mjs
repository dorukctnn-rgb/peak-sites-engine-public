// KAPI VERIMI (12 Kas 2026): OSM saat ve adresi (gercek kaynak, kayitli), yalniz telefon butun ulkelerde eylem, on eleme, parcali Overpass, tur suresi korumasi.
// Ag yok (Overpass ve sayfa istekleri sahte).  Isletme adlari uydurmadir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { osmSaatCoz, osmSaatKaydi } from '../../uyarla/lib/osm-saat.mjs';
import { osmAdresKur, overpassUyari, bulParcali, izgara, KUTU, ekSorgu, osmEk, osmEkUygula, leadOf, sorgu, tekille } from '../../lead/osm.mjs';
import { hazirlikKapisi, ON_KAPI_SURUM } from '../../uyarla/restoran-hazirla.mjs';
import { yenidenHazirlik, kapiBitti, RESTORAN_ON_KAPI_SURUM } from '../../uyarla/lib/surum.mjs';
import { mapsUrl, yolTarifiUrl, telEylemEtiket } from '../../uyarla/lib/metin.mjs';
import { onSinyal, onPuan, onHazirla, kisaListe, leadKategori, ON_DOSYA } from '../on-eleme.mjs';
import { uretimLead, adaySiniriMs, ADAY_EN_AZ_DK } from '../uretim.mjs';
import { dongu, RESTORAN_HER_TUR } from '../dongu.mjs';
import { gecici } from './gecici.mjs';

const yaz = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); };
const KOK = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', '..');

test('osm opening_hours: OSM anlamiyla 7 gun (gecmeyen gun kapali), gece yarisini gecen saat, ek kural; emin olunamayan bicim null', () => {
  const g = (v) => { const h = osmSaatCoz(v); return h && h.byDay; };
  assert.deepEqual(g('Mo-Fr 11:30-14:30,17:00-22:00; Sa,Su 17:00-22:00'), ['17:00–22:00', '11:30–14:30, 17:00–22:00', '11:30–14:30, 17:00–22:00', '11:30–14:30, 17:00–22:00', '11:30–14:30, 17:00–22:00', '11:30–14:30, 17:00–22:00', '17:00–22:00']);
  assert.deepEqual(g('Tu-Fr 07:30-16:00; Sa 08:00-16:00; Su 08:30-16:00'), ['08:30–16:00', 'closed', '07:30–16:00', '07:30–16:00', '07:30–16:00', '07:30–16:00', '08:00–16:00'], 'pazartesi kuralda yok: kapali');
  assert.deepEqual(g('Mo-Fr 07:00-15:30; Sa, Su 08:00-15:30')[0], '08:00–15:30', '"Sa, Su" gun listesi');
  assert.deepEqual(g('Su 12:30-23:00, Mo-Th 11:00-23:30, Fr-Sa 11:00-00:30').slice(5), ['11:00–00:30', '11:00–00:30'], 'virgulle ek kural');
  assert.deepEqual(g('12:00-23:30'), Array(7).fill('12:00–23:30'), 'gunsuz kural her gun');
  assert.deepEqual(g('09:00 - 21:30'), Array(7).fill('09:00–21:30'));
  assert.deepEqual(g('Mo-Fr 12:00-15:00; PH off')[0], 'closed', 'resmi tatil kurali atlanir');
  const h = osmSaatCoz('Mo-Su 15:00-01:00'); assert.deepEqual(h.week[1], [900, 1500]); assert.equal(h.tableOk, true); assert.equal(h.source, 'osm');
  for (const v of ['24/7', 'Mo-Su 10:00-22:00; Jan 01 off', 'Tu-Su 17:00+', 'Mo-Fr 08:00-12:00 || "by appointment"', 'sunrise-sunset', 'Mo-Fr 10:00-22:00 open', 'Mo-Fr', 'Mo-Fr 10-22', '', null]) assert.equal(osmSaatCoz(v), null, String(v));
  const k = osmSaatKaydi({ osm: 'node/41', osmSaat: 'Mo-Su 11:00-22:00', osmSaatTarih: '2026-05-01' });
  assert.equal(k.via, 'osm opening_hours (node/41)'); assert.equal(k.ham, 'Mo-Su 11:00-22:00'); assert.equal(k.kontrol, '2026-05-01');
  assert.equal(osmSaatKaydi({ osmSaat: null }), null);
});

test('osm adresi: sokak + ust parca ve (numara ya da koordinat); harita koordinattan', () => {
  const a = osmAdresKur({ street: 'Liman Sokak', ilce: 'Merkez', city: 'Örnekkent', lat: 41.0123456, lon: 28.9876543, osm: 'node/7' });
  assert.equal(a.text, 'Liman Sokak, Merkez, Örnekkent'); assert.deepEqual(a.konum, { lat: 41.012346, lon: 28.987654 }); assert.match(a.kaynak, /osm \(addr etiketleri, node\/7, koordinat\)/);
  assert.equal(osmAdresKur({ street: 'Liman Sokak', city: 'Örnekkent' }), null, 'numarasiz ve koordinatsiz adres kabul edilmez');
  assert.equal(osmAdresKur({ street: '12 Quay Lane', city: 'Testford' }).text, '12 Quay Lane, Testford');
  assert.equal(osmAdresKur({ street: '', city: 'Örnekkent', lat: 1, lon: 2 }), null, 'yalniz sehir adres degil');
  assert.equal(osmAdresKur({ yer: 'Old Market Arch', city: 'Testford', lat: 53.1, lon: -9.1 }).text, 'Old Market Arch, Testford', 'addr:place');
  assert.equal(osmAdresKur({ street: '5 Mill Road', city: 'Testford', lat: null, lon: null }).konum, null);
  assert.equal(mapsUrl('12 Quay Lane', 'X', 'Testford', { lat: 53.27, lon: -9.05 }), 'https://www.google.com/maps/search/?api=1&query=53.270000,-9.050000');
  assert.match(mapsUrl('12 Quay Lane', 'X', 'Testford'), /query=12%20Quay%20Lane/);
  assert.equal(yolTarifiUrl({ lat: 53.27, lon: -9.05 }), 'https://www.google.com/maps/dir/?api=1&destination=53.270000,-9.050000');
  assert.equal(yolTarifiUrl(null), null);
});

test('telefon eylemi etiketi: TR "Hemen arayın"/"Rezervasyon için arayın" (kisa "Ara"), EN genel etiketsiz ("Call <numara>")/"Call to book"', () => {
  assert.deepEqual(telEylemEtiket('tr'), { etiket: 'Hemen arayın', kisa: 'Ara' });
  assert.deepEqual(telEylemEtiket('tr', { rezervasyon: true }), { etiket: 'Rezervasyon için arayın', kisa: 'Ara' });
  assert.deepEqual(telEylemEtiket('en'), { etiket: null, kisa: 'Call' });
  assert.deepEqual(telEylemEtiket('en', { rezervasyon: true }), { etiket: 'Call to book', kisa: 'Call' });
});

// hazirlik kapisi: sentetik isletme (uydurma)
const R0 = () => ({
  erisim: { ok: true }, lead: { sektor: 'restoran', name: 'Fable Kitchen', kind: 'restaurant', lang: 'en', region: 'NZ' }, name: { n: 'Fable Kitchen' },
  address: null, phone: '+64 9 555 0101', hours: null, logo: { orig: { file: 'img/logo-orijinal.png' } }, order: null, reservation: null,
  photos: [1, 2, 3, 4, 5].map((i) => ({ id: `0${i}`, w: 1600, h: 1000, meanS: 0.5, lapVar: 400 })),
});
test('hazirlik kapisi: sitede saat ve adres yoksa OSM (kayitli kaynakla); OSM de yoksa saat UYDURULMAZ, elenir; yalniz telefon eylemdir', () => {
  const dir = gecici('kv-hazirlik-');
  const lead = { slug: 'fable', name: 'Fable Kitchen', region: 'NZ', site: 'https://fable.example/', osm: 'node/77', osmSaat: 'Tu-Su 11:00-21:00', osmAdres: 'Harbour Lane, Testville', osmKonum: { lat: -41.3, lon: 174.8 }, osmAdresKaynak: 'osm (addr etiketleri, node/77, koordinat)' };
  const R = R0(); const k = hazirlikKapisi(R, lead, dir);
  assert.equal(k.elendi, null, JSON.stringify(k.elendi));
  assert.equal(k.osmSaat, true); assert.equal(R.hours.via, 'osm opening_hours (node/77)'); assert.equal(R.hours.byDay[1], 'closed'); assert.ok(k.eksik.some((x) => /saat OSM kaydından/.test(x)));
  assert.equal(k.osmAdres, true); assert.deepEqual(R.address.konum, { lat: -41.3, lon: 174.8 }); assert.match(R.address.via, /koordinat/);
  assert.equal(k.eylem.tur, 'telefon'); assert.equal(k.eylem.url, null); assert.equal(k.eylem.kisa, 'Call');
  // OSM saati yok, sitede saat yok: elenir (uydurma yok)
  const k2 = hazirlikKapisi(R0(), { ...lead, osmSaat: null }, dir);
  assert.ok(k2.elendi.some((x) => /çalışma saati yok \(sitenin hiçbir sayfasında, OSM kaydında da yok\)/.test(x)));
  // 24/7 OSM degeri kullanilmaz
  assert.ok(hazirlikKapisi(R0(), { ...lead, osmSaat: '24/7' }, dir).elendi.some((x) => /çalışma saati yok/.test(x)));
  // sitenin kendi saati varsa OSM'ye bakilmaz
  const R3 = R0(); R3.hours = { tableOk: true, week: [], byDay: [], source: 'page' }; hazirlikKapisi(R3, lead, dir); assert.equal(R3.hours.via, undefined);
  // sitenin metninde saat satiri varsa icerik turu oradan alir (OSM kullanilmaz)
  fs.writeFileSync(path.join(dir, '_home.txt'), 'Opening hours\nTuesday to Sunday 11am to 9pm');
  const R4 = R0(); const k4 = hazirlikKapisi(R4, lead, dir); assert.ok(k4.eksik.includes('saat (sitenin metninden tamamlanacak)')); assert.equal(R4.hours, null);
  fs.writeFileSync(path.join(dir, '_home.txt'), '');
  // telefon da yoksa elenir
  const R5 = R0(); R5.phone = null; assert.ok(hazirlikKapisi(R5, lead, dir).elendi.some((x) => /bağlantısı da telefon da yok/.test(x)));
  // adres: OSM'de yalniz numarasiz sokak var, koordinat yok -> adres yok
  const R6 = R0(); assert.ok(hazirlikKapisi(R6, { ...lead, osmKonum: null }, dir).elendi.includes('adres yok'));
  assert.equal(ON_KAPI_SURUM, RESTORAN_ON_KAPI_SURUM);
});

test('yeniden hazirlik: eski on kapida YALNIZ saat / adres / yalniz-telefon nedeniyle elenen restoran bir kez yeniden; baska neden varsa nihai', () => {
  const k = (reasons, ek = {}) => ({ status: 'elendi', sektor: 'restoran', reasons, ...ek });
  assert.equal(yenidenHazirlik(k(['çalışma saati yok (sitenin hiçbir sayfasında)'])), true);
  assert.equal(yenidenHazirlik(k(['adres yok', 'gerçek sipariş ya da rezervasyon bağlantısı yok (yalnız telefon)'])), true);
  assert.equal(yenidenHazirlik(k(['adres yok', 'logo yok (sitenin kendi logo dosyası bulunamadı)'])), false);
  assert.equal(yenidenHazirlik(k(['zincir ya da franchise (sitenin kendi metni: "Franchise")'])), false);
  assert.equal(yenidenHazirlik(k(['çalışma saati yok (sitenin hiçbir sayfasında)'], { onKapiSurum: 2 })), false, 'yeni surumle elenen nihai');
  assert.equal(yenidenHazirlik(k(['çalışma saati yok (sitenin hiçbir sayfasında)'], { sektor: 'konaklama' })), false);
  assert.equal(yenidenHazirlik({ status: 'hazir', sektor: 'restoran', reasons: [] }), false);
  const d = gecici('kv-surum-'); const f = path.join(d, 'kapi.json');
  yaz(f, k(['çalışma saati yok (sitenin hiçbir sayfasında)'])); assert.equal(kapiBitti(f), false);
  yaz(f, k(['kullanılabilir fotoğraf az (1; en az 4, 800 px+)'])); assert.equal(kapiBitti(f), true);
});

test('Overpass: "runtime error" yaniti hatadir; parcali liste turlar arasi surer, agir parca bolunur, bitince tekil liste', async () => {
  assert.match(overpassUyari({ remark: 'runtime error: Query timed out in "query" at line 1 after 181 seconds.' }), /timed out/);
  assert.equal(overpassUyari({ elements: [] }), null);
  assert.match(sorgu('TR', 'restoran', { kutu: [36, 30, 37, 31], zaman: 100 }), /\[timeout:100\].*\["website"\]\(area\.a\)\(36,30,37,31\);/);
  assert.match(sorgu('IE', 'restoran'), /\[timeout:180\]/, 'parcasiz sorgu eskisi gibi');
  assert.equal(izgara(KUTU.TR.kutu, KUTU.TR.izgara).length, 12);
  const d = gecici('kv-parca-'); const ilerleme = path.join(d, 'lead', 'TR-restoran.parca.json');
  let saat = 0; const simdi = () => saat; let ilkAgir = true; let id = 1;
  const sorgula = async (q) => {
    saat += 60000;
    if (ilkAgir) { ilkAgir = false; const e = new Error('overpass sorgusu agir: runtime error'); e.agir = true; throw e; }
    const el = (n, site) => ({ type: 'node', id: n, lat: 37, lon: 30, tags: { name: `Deneme Lokanta ${n}`, amenity: 'restaurant', website: site } });
    const n = id++; return { elements: [el(n, `https://lokanta${n}.example/`), el(1000 + n, 'https://ortak.example/')] };
  };
  // 1. tur: bitis 5 parcalik sure; ilk parca agir -> 4'e bolunur
  let r = await bulParcali('TR', 'restoran', { ilerleme, bitis: 5 * 60000 + 130000, sorgula, simdi, bekleMs: 0 });
  assert.equal(r.tamam, false); assert.ok(fs.existsSync(ilerleme));
  const P = JSON.parse(fs.readFileSync(ilerleme, 'utf8')); assert.equal(P.bolunen, 1); assert.equal(P.biten + P.bekleyen.length, 15, '12 parca, biri 4e bolundu');
  // sonraki turlar: kalan parcalar
  for (let i = 0; i < 5 && !r.tamam; i++) { saat = 0; r = await bulParcali('TR', 'restoran', { ilerleme, bitis: 10 * 60000, sorgula, simdi, bekleMs: 0 }); }
  assert.equal(r.tamam, true); assert.equal(fs.existsSync(ilerleme), false, 'ilerleme dosyasi silinir');
  assert.equal(r.leads.length, 16, '15 parcada birer lokanta + ortak alan adi bir kez (tekil)');
  assert.ok(r.leads.every((l) => 'saat' in l && 'dukkan' in l), 'yeni satirlarda saat ve dukkan alani');
  await assert.rejects(() => bulParcali('HK', 'restoran', { sorgula }), /ulke hedefte degil/);
  assert.equal(tekille([{ website: 'https://a.example/' }, { website: 'http://www.a.example/x' }]).length, 1);
});

test('OSM kimlikle ek sorgu: saat ve adres etiketleri eski lead\'e islenir; kayit yoksa "yok"', async () => {
  assert.equal(ekSorgu(['node/1', 'way/2', 'node/3', 'x']), '[out:json][timeout:60];(node(id:1,3);way(id:2););out tags center;');
  assert.equal(ekSorgu([]), null);
  const sorgula = async () => ({ elements: [{ type: 'node', id: 5, lat: 41.1, lon: 29.1, tags: { opening_hours: 'Mo-Su 10:00-22:00', 'addr:street': 'Deniz Sokak', 'addr:housenumber': '3', 'addr:city': 'Örnekkent' } }] });
  const m = await osmEk([{ osm: 'node/5' }, { osm: 'node/6' }], { sorgula });
  assert.equal(m.get('node/5').saat, 'Mo-Su 10:00-22:00'); assert.equal(m.has('node/6'), false);
  const l = osmEkUygula({ id: 'TR-n5', osm: 'node/5', street: '', city: 'Örnekkent', lat: null }, m.get('node/5'));
  assert.equal(l.saat, 'Mo-Su 10:00-22:00'); assert.equal(l.street, '3 Deniz Sokak'); assert.equal(l.lat, 41.1); assert.equal(l.osmEk, 'tamam');
  assert.deepEqual(osmEkUygula({ id: 'x' }, null), { id: 'x', osmEk: 'yok', saat: null });
  const yeni = leadOf({ type: 'node', id: 9, lat: 1, lon: 2, tags: { name: 'Deneme Kafe', amenity: 'cafe', website: 'https://kafe.example/', opening_hours: 'Mo-Fr 08:00-16:00', 'check_date:opening_hours': '2026-03-01' } }, 'NZ', 'restoran');
  assert.equal(yeni.saat, 'Mo-Fr 08:00-16:00'); assert.equal(yeni.saatTarih, '2026-03-01');
  const u = uretimLead({ ...yeni, street: '4 Pier Road', city: 'Testville' });
  assert.equal(u.osmSaat, 'Mo-Fr 08:00-16:00'); assert.equal(u.osmAdres, '4 Pier Road, Testville'); assert.deepEqual(u.osmKonum, { lat: 1, lon: 2 }); assert.equal(u.osm, 'node/9');
});

const sayfa = (ek = '') => `<!doctype html><html><head><title>Deneme</title></head><body><nav><a href="/menu">Menu</a><a href="/gallery">Gallery</a></nav>
<img src="/wp-content/uploads/2025/01/food-1.jpg"><img src="/wp-content/uploads/2025/01/food-2.jpg"><img src="/wp-content/uploads/2025/01/room-3.jpg">
<p>12 Harbour Street, Testville</p><a href="tel:+6495550101">Call</a><p>Opening hours: Tuesday to Sunday 11am to 9pm</p>${ek}</body></html>`;
test('on eleme sinyalleri: zincir ve menusuz aday atlanir; digerleri puanlanir', () => {
  const on = onSinyal({ html: sayfa(), finalUrl: 'https://deneme.example/', ulke: 'NZ' });
  assert.equal(on.zincir, null); assert.equal(on.menu, true); assert.equal(on.saat, true); assert.equal(on.tel, true); assert.equal(on.adres, true); assert.ok(on.foto >= 3); assert.equal(on.galeri, true);
  const p = onPuan(on, {}); assert.equal(p.atla, null); assert.ok(p.puan > 5);
  assert.match(onPuan(onSinyal({ html: sayfa('<footer><a href="/franchise">Franchise opportunities</a></footer>'), finalUrl: 'https://d.example/', ulke: 'NZ' })).atla, /zincir/);
  assert.match(onPuan(onSinyal({ html: sayfa('<p>Şubelerimiz: 12 şube</p>'), finalUrl: 'https://d.example/', ulke: 'TR' })).atla, /zincir/);
  const menusuz = onSinyal({ html: '<html><body><p>Welcome</p><img src="/images/a.jpg"></body></html>', finalUrl: 'https://d.example/', ulke: 'NZ' });
  assert.match(onPuan(menusuz).atla, /menü izi yok/);
  assert.equal(onPuan({ ...menusuz, fiyat: 6 }).atla, null, 'fiyatli satirlar menu izidir');
  assert.equal(onPuan({ ...menusuz, siparis: true }).atla, null, 'siparis sitesi menu izidir');
  // OSM saati olan aday saatsiz adaydan once
  const saatsiz = { ...on, saat: false };
  assert.ok(onPuan(saatsiz, { saat: 'Mo-Su 10:00-22:00' }).puan > onPuan(saatsiz, {}).puan);
  assert.equal(onPuan(null).puan, null);
});

test('on hazirlik: kisa liste ulkeler arasi dengeli; OSM ek ve ana sayfa sinyali onbellege yazilir; atlananlar cikar, puanlilar once', async () => {
  const depo = gecici('kv-on-');
  const l = (u, n, ek = {}) => ({ id: `${u}-n${n}`, osm: `node/${n}`, ulke: u, sektor: 'restoran', name: `Deneme ${n}`, website: `https://d${n}.example/`, ...ek });
  const liste = [l('NZ', 1), l('NZ', 2), l('NZ', 3), l('IE', 4), l('IE', 5), { id: 'IE-k', ulke: 'IE', sektor: 'konaklama' }];
  assert.deepEqual(kisaListe(liste.slice(0, 5), 4).map((x) => x.id), ['NZ-n1', 'IE-n4', 'NZ-n2', 'IE-n5']);
  const fiyatsizMenu = `<html><body><h1>Our menu</h1>${'<p>Slow cooked lamb with herbs and roasted vegetables from the garden, served with bread.</p>'.repeat(8)}</body></html>`;
  const fiyatliMenu = `<html><body><h1>Menu</h1>${['Margherita $18', 'Diavola $21', 'Funghi $20', 'Marinara $16', 'Calzone $22'].map((x) => `<p>${x}</p>`).join('')}</body></html>`;
  const html = { 'https://d1.example/': sayfa('<a href="/franchise">Franchise</a>'), 'https://d2.example/': '<html><body>hi</body></html>', 'https://d3.example/': sayfa(), 'https://d3.example/menu': fiyatliMenu, 'https://d4.example/': sayfa().replace('Opening hours: Tuesday to Sunday 11am to 9pm', ''), 'https://d5.example/': sayfa(), 'https://d5.example/menu': fiyatsizMenu };
  let get = 0; const polite = { get: async (u) => { get++; return html[u] ? { ok: true, text: html[u], finalUrl: u } : { ok: false, status: 404 }; } };
  let osmCagri = 0; const osmEk = async (ls) => { osmCagri++; return new Map(ls.filter((x) => x.osm === 'node/4').map((x) => [x.osm, { saat: 'Mo-Su 09:00-22:00' }])); };
  const r = await onHazirla({ liste, depo, adet: 10, polite, osmEk, bitis: Date.now() + 60000 });
  assert.deepEqual(r.liste.map((x) => x.id).slice(-1), ['IE-k'], 'diger sektorler aynen sonda');
  const restoran = r.liste.filter((x) => x.sektor === 'restoran').map((x) => x.id);
  assert.ok(!restoran.includes('NZ-n1') && !restoran.includes('NZ-n2') && !restoran.includes('IE-n5'), 'zincir, menusuz ve menu sayfasi fiyatsiz atlandi');
  assert.deepEqual(restoran, ['NZ-n3', 'IE-n4'], 'fiyatli menulu ve saatli aday once');
  assert.equal(r.sayac.zincir, 1); assert.equal(r.sayac.menuYok, 1); assert.equal(r.sayac.fiyatYok, 1); assert.equal(get, 5 + 3, '5 ana sayfa + 3 menu sayfasi'); assert.equal(osmCagri, 1);
  assert.equal(r.liste.find((x) => x.id === 'IE-n4').saat, 'Mo-Su 09:00-22:00', 'OSM saati lead\'e islendi');
  const ob = JSON.parse(fs.readFileSync(path.join(depo, 'lead', ON_DOSYA), 'utf8')); assert.ok(ob['NZ-n3'].on && ob['IE-n4'].osm && ob['NZ-n3'].menuSayfa.fiyat >= 4 && ob['IE-n4'].menuSayfa.hata);
  // ikinci tur: onbellekten (ag yok; okunamayan menu sayfasi da her tur yeniden istenmez)
  get = 0; osmCagri = 0; await onHazirla({ liste, depo, adet: 10, polite, osmEk, bitis: Date.now() + 60000 }); assert.equal(get, 0); assert.equal(osmCagri, 0);
  // taramada `on` yazilmis satir icin ana sayfa istenmez (yalniz menu sayfasi)
  const on = onSinyal({ html: sayfa(), finalUrl: 'https://d9.example/', ulke: 'NZ' }); assert.equal(on.menuUrl, 'https://d9.example/menu');
  get = 0; await onHazirla({ liste: [l('NZ', 9, { on, saat: null })], depo, adet: 5, polite, osmEk, bitis: Date.now() + 60000 }); assert.equal(get, 1);
});

test('kategori onceligi (12 Kas 2026, Doruk): kisa listede ve on eleme sirasinda once burger, sonra sokak lezzetleri (burrito, sokak) ve pizza, sonra digerleri; ad Turkce ekle de taninir', async () => {
  const l = (u, n, name, ek = {}) => ({ id: `${u}-n${n}`, osm: `node/${n}`, ulke: u, sektor: 'restoran', name, website: `https://p${n}.example/`, saat: null, ...ek });
  const liste = [l('NZ', 1, 'Harbour Cafe'), l('IE', 2, 'Quay Tacos'), l('TR', 3, 'Burgerci Deneme'), l('NZ', 4, 'Old Mill', { mutfak: 'pizza;italian' }), l('IE', 5, 'Corner Bistro'), l('TR', 6, 'Pizzacı Örnek')];
  assert.deepEqual(liste.map(leadKategori), [null, 'burrito', 'burger', 'pizza', null, 'pizza']);
  assert.deepEqual(kisaListe(liste, 6).map((x) => x.id), ['TR-n3', 'IE-n2', 'NZ-n4', 'TR-n6', 'NZ-n1', 'IE-n5']);
  // sokak lezzeti: burgerden sonra, pizza ve burrito ile ayni sirada; oturmali kebapci (amenity=restaurant, adinda sokak sozcugu yok) digerleriyle
  const s2 = [l('TR', 7, 'Liman Dönerci', { amenity: 'fast_food' }), l('IE', 8, 'Anatolia Grill', { amenity: 'restaurant', mutfak: 'kebab' }), l('NZ', 9, 'Burger Lane'), l('AU', 10, 'Corner Kebabs', { mutfak: 'kebab' })];
  assert.deepEqual(s2.map(leadKategori), ['sokak', null, 'burger', 'sokak']);
  assert.deepEqual(kisaListe(s2, 4).map((x) => x.id), ['NZ-n9', 'TR-n7', 'AU-n10', 'IE-n8']);
  assert.equal(leadKategori({ name: 'Plain Kitchen', on: { kategori: 'pizza' } }), 'pizza', 'menu metninden');
  // on eleme: puani dusuk pizzaci, puani yuksek kafeden once
  const depo = gecici('kv-pb-'); const zayif = onSinyal({ html: '<html><body><a href="/menu">Menu</a><p>Pizza $10 Pizza $12 Pizza $14 Pizza $16</p></body></html>', finalUrl: 'https://p6.example/', ulke: 'TR' });
  const guclu = onSinyal({ html: sayfa(), finalUrl: 'https://p1.example/', ulke: 'NZ' });
  const r = await onHazirla({ liste: [{ ...liste[0], on: guclu }, { ...liste[5], on: zayif }], depo, adet: 5, polite: null, osmEk: async () => new Map() });
  assert.deepEqual(r.liste.map((x) => x.id), ['TR-n6', 'NZ-n1']); assert.equal(r.sayac.pizzaBurger, 1);
});

test('tur suresi: yeni aday kalan sure az ise baslamaz; aday siniri kalan sureyi asmaz; restoran tur hakki 15', () => {
  assert.equal(adaySiniriMs(30), 6 * 60000); assert.equal(adaySiniriMs(2), 3.5 * 60000); assert.equal(adaySiniriMs(0), ADAY_EN_AZ_DK * 60000);
  assert.equal(RESTORAN_HER_TUR, 15);
  const p = JSON.parse(fs.readFileSync(path.join(KOK, 'hat', 'plan.json'), 'utf8')); assert.equal(p.limitler.restoranHerTur, 15);
});

test('dongu: parcali OSM (bitmeyen liste yazilmaz, ilerleme surer), hedefli pizza+burger sorgusu, pizza+burger once uretime gider', async () => {
  const depo = gecici('kv-dongu-'); const veri = path.join(depo, 'veri'); const planDosya = path.join(depo, 'plan.json');
  yaz(planDosya, { sektorler: { restoran: { aktif: true } }, sira: [['IE', 'restoran']], limitler: { osmSorguHerTur: 1, havuzHedef: 1, uretimHerTur: 10, tarayiciEs: 1, restoranHerTur: 2, leadYenilemeGun: 120 } });
  const tarandi = [1, 2, 3].map((n) => ({ id: `IE-n${n}`, osm: `node/${n}`, ulke: 'IE', sektor: 'restoran', name: n === 2 ? 'Pizzeria Deneme' : `Deneme ${n}`, website: `https://d${n}.example/`, durum: 'aday', email: `x${n}@d${n}.example`, puan: 6 }));
  yaz(path.join(depo, 'lead', 'IE-restoran.tarandi.jsonl'), tarandi.map((x) => JSON.stringify(x)).join('\n'));
  let parca = 0; const uretilen = []; const hedefli = [];
  const araclar = {
    bul: async () => { throw new Error('parcali yol kullanilmali'); },
    bulParcali: async (ulke, sektor, { ilerleme, hedef }) => { if (hedef) { hedefli.push(`${ulke}-${hedef}`); return { tamam: true, leads: [{ id: 'IE-n7', osm: 'node/7', ulke, sektor, name: 'Smash Burger Deneme', website: 'https://b7.example/', saat: null, dukkan: null }], parca: '1/1' }; } parca++; if (parca === 1) { yaz(ilerleme, { surum: 1 }); return { tamam: false, leads: null, parca: '3/12' }; } fs.rmSync(ilerleme, { force: true }); return { tamam: true, leads: [{ id: 'IE-n1', osm: 'node/1', ulke, sektor, name: 'Deneme 1', website: 'https://d1.example/', saat: null, dukkan: null }], parca: '12/12' }; },
    onHazirla: async ({ liste }) => ({ liste: [...liste].reverse(), sayac: { bakilan: liste.length } }),
    tarananlar: () => new Set(tarandi.map((x) => x.id)), Polite: class { }, openBrowser: async () => ({ close: async () => {} }), taraHepsi: async () => ({ sayac: {} }),
    uretimLead, uretimCalis: async ({ leads }) => { for (const x of leads) { assert.equal(x.email, undefined); uretilen.push(x.id); } return { sonuc: leads.map((x) => ({ id: x.id, status: 'elendi' })) }; },
    hazirlar: () => [], kutuEkle: () => 0, kutuOku: () => [], yazilanlar: () => ({ neden: () => null }),
  };
  const kos = () => dongu({ depo, kutu: null, sureDk: 30, parti: 'p', planDosya, veri, araclar, log: () => {}, env: {} });
  const r1 = await kos();
  assert.deepEqual(r1.osm, ['IE-restoran: parca 3/12', 'IE-pizza-burger: 1']); assert.equal(fs.existsSync(path.join(depo, 'lead', 'IE-restoran.jsonl')), false, 'bitmeyen liste yazilmaz');
  assert.deepEqual(hedefli, ['IE-pizza-burger'], 'restoran listesi yokken hedefli pizza+burger sorgusu');
  assert.equal(JSON.parse(fs.readFileSync(path.join(depo, 'lead', 'IE-restoran.pb.jsonl'), 'utf8').split(String.fromCharCode(10))[0]).hedefli, 'pizza-burger');
  assert.deepEqual(uretilen, ['IE-n2', 'IE-n3'], 'pizza once, sonra on eleme sirasi; restoran tur hakki 2'); assert.deepEqual(r1.onEleme, { bakilan: 3 });
  assert.equal(r1.havuz.pizza, 1); assert.equal(r1.havuz.restoran, 3); assert.equal(r1.secilenKategori.pizza, 1);
  const r2 = await kos(); assert.deepEqual(r2.osm, ['IE-restoran: 1']); assert.ok(fs.existsSync(path.join(depo, 'lead', 'IE-restoran.jsonl')));
  const r3 = await kos(); assert.deepEqual(r3.osm, [], 'taze liste yeniden cekilmez'); assert.equal(hedefli.length, 1, 'hedefli liste taze: yeniden sorulmaz');
});

test('tara: genel havuz dolu olsa da pizza+burger havuzu azsa yalniz pizza+burger satirlari taranir; hedefli liste de girdi, pizza+burger once', async () => {
  const depo = gecici('kv-tara-'); const veri = path.join(depo, 'veri'); const planDosya = path.join(depo, 'plan.json');
  yaz(planDosya, { sektorler: { restoran: { aktif: true } }, sira: [['NZ', 'restoran']], limitler: { osmSorguHerTur: 0, osmHedefliHerTur: 0, havuzHedef: 1, uretimHerTur: 1, tarayiciEs: 1, restoranHerTur: 1, leadYenilemeGun: 120, pizzaBurgerHavuz: 2 } });
  const satir = (n, name, ek = {}) => ({ id: `NZ-n${n}`, osm: `node/${n}`, ulke: 'NZ', sektor: 'restoran', name, website: `https://t${n}.example/`, saat: null, dukkan: null, ...ek });
  yaz(path.join(depo, 'lead', 'NZ-restoran.jsonl'), [satir(1, 'Harbour Cafe'), satir(2, 'Corner Bistro'), satir(3, 'Quay Pizza Co')].map((x) => JSON.stringify(x)).join(String.fromCharCode(10)));
  yaz(path.join(depo, 'lead', 'NZ-restoran.pb.jsonl'), [satir(4, 'Burgerhouse Deneme', { hedefli: 'pizza-burger' }), satir(3, 'Quay Pizza Co')].map((x) => JSON.stringify(x)).join(String.fromCharCode(10)));
  // havuz: bir genel aday (dolu), pizza+burger yok
  yaz(path.join(depo, 'lead', 'NZ-restoran.tarandi.jsonl'), JSON.stringify({ ...satir(9, 'Old Mill'), durum: 'aday', email: ['a', 't9.example'].join('@'), puan: 6 }));
  const taranan = [];
  const araclar = {
    bul: async () => [], tarananlar: (f) => new Set(fs.readFileSync(f, 'utf8').split(String.fromCharCode(10)).filter(Boolean).map((x) => JSON.parse(x).id)), Polite: class { }, openBrowser: async () => ({ close: async () => {} }),
    taraHepsi: async ({ leads }) => { taranan.push(...leads.map((x) => x.id)); return { sayac: { aday: 0 } }; },
    uretimLead, uretimCalis: async () => ({ sonuc: [] }), hazirlar: () => [], kutuEkle: () => 0, kutuOku: () => [], yazilanlar: () => ({ neden: () => null }),
  };
  const r = await dongu({ depo, kutu: null, sureDk: 30, parti: 'p', planDosya, veri, araclar, log: () => {}, env: {} });
  assert.deepEqual(taranan, ['NZ-n4', 'NZ-n3'], 'yalniz pizza+burger, tekil, ana liste + hedefli liste; burger en onde (12 Kas, Doruk)');
  assert.ok(r.tarandi['NZ-restoran-pb']);
});

test('Overpass parcasi: gecit zaman asimi (504 / ag zaman asimi) de parcayi boler; hedefli pizza+burger sorgusu website ve contact:website', async () => {
  const d = gecici('kv-yavas-'); const ilerleme = path.join(d, 'pb.json'); let n = 0; const sorgular = [];
  const sorgula = async (q) => { sorgular.push(q); n++; if (n === 1) { const e = new Error('overpass yanit vermedi (504)'); e.yavas = true; throw e; } return { elements: [] }; };
  const r = await bulParcali('TR', 'restoran', { ilerleme, hedef: 'pizza-burger', sorgula, bekleMs: 0 });
  assert.equal(r.tamam, true); assert.equal(n, 1 + 4 + 3, 'TR hedefli izgara 2x2; ilk parca 4e bolundu');
  assert.match(sorgular[0], /\["cuisine"~"pizza\|burger",i\]\["website"\]/); assert.match(sorgular[0], /\["name"~"pizz\|burger",i\]\["contact:website"\]/);
  assert.match(sorgular[0], /\["amenity"~"\^\(restaurant\|fast_food\)\$"\]/);
});
