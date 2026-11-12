// hat/kuyruk-tr.mjs: Turkiye satirinin kurulusu (kampanya websites-demo-tr, hep bekletilir) ve canli kanit toplama baglantisi.  Mail metni, eksik cumleleri ve kanit toplayici ozel katmandadir;
// burada yerine SAHTE bir "tr" nesnesi verilir (kendi kendine yeten test).  Butun adlar, siteler ve adresler uydurmadir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { trSatirKur, trEksikTopla, KAMPANYA_TR, BEKLET_TR, SALT_DENEME, trAnahtar, EPOSTA_UYGUNSUZ_TR } from '../kuyruk-tr.mjs';
import { satirlarKur } from '../kuyruk.mjs';

const SIMDI = new Date('2026-11-12T10:00:00Z');
const SAYFA = 'https://example.org/web/demo/r/ornek-lokanta-tr0001-ab12cd/';
const EKSIKLER = [
  { cumle: 'Telefon numaranız sayfada yazıyor ama dokununca aramıyor.', kanit: 'ana sayfa kaynağı (12 Kas 2026): numara düz metin, tel: bağlantısı 0 adet' },
  { cumle: 'Çalışma saatleriniz yalnızca sayfanın en altında duruyor.', kanit: 'ana sayfa kaynağı (12 Kas 2026): saat yalnız alt bilgi bölümünde, üst bölümlerde 0 satır' },
];
const lead = (o = {}) => ({ id: 'TR-n1', osm: 'node/1', ulke: 'TR', sektor: 'restoran', name: 'Örnek Lokanta', website: 'https://ornek-lokanta.example/', finalUrl: 'https://ornek-lokanta.example/', email: 'info@ornek.test', durum: 'aday', slug: 'ornek-lokanta-tr0001', tarandi: '2026-11-11T21:00:00Z', ...o });
const sonOge = (l, o = {}) => ({ durum: 'hazir', sektor: 'restoran', sonGoz: true, slug: l.slug, leadId: l.id, ad: l.name, page: `r/${l.slug}-ab12cd`, onizleme: '/tmp/onizleme.jpg', sablon: 'v5', parti: 'p1', ...o });
// sahte tr: eksikler[] ile bir mail govdesi kurar; denetim ve benzersizlik cagrilari sayilir
const sahteTr = (o = {}) => {
  const cagri = { mail: 0, denetle: 0, benzersiz: 0 };
  const tr = {
    eksik: new Map(), bekleyen: [], parti: [],
    mail: ({ ad, sayfa, eksikler, salt }) => { cagri.mail++; return { konu: `${ad}: yeni ana sayfa`, govde: `Merhaba,\n\n${eksikler.map((e) => e.cumle).join(' ')}\n\n${sayfa}\n\nSaygılarımla,\nDoruk`, fayda: `fayda ${salt}` }; },
    soyle: (ek, salt) => ek.eksikler.map((e) => ({ ...e, cumle: `${e.cumle.replace(/\.$/, '')} (${salt}).` })),
    denetle: () => { cagri.denetle++; return []; },
    benzersiz: () => { cagri.benzersiz++; return []; },
    onizleme: () => null, gonderen: () => true,
    ...o,
  };
  return { tr, cagri };
};
const ekle = (tr, l, ek = { eksikler: EKSIKLER, tur: ['telefon-tel-yok', 'saat-altta'], elenme: null }) => tr.eksik.set(l.id, ek);
const kurTek = (l, tr, ek = {}) => trSatirKur({ x: sonOge(l, ek), l, id: 'WH-TR-n1', ad: l.name, sayfa: SAYFA, e: l.email, simdi: SIMDI, tr, kaynak: 'https://ornek-lokanta.example/ (is e-postasi)' });

test('trSatirKur: eksikler toplanmamissa isletme bekleyene girer, satir yok', () => {
  const { tr } = sahteTr(); const l = lead();
  const r = kurTek(l, tr);
  assert.equal(r.atla, 'tr-eksik-bekliyor'); assert.equal(tr.bekleyen.length, 1); assert.equal(trAnahtar(tr.bekleyen[0].x, l), 'TR-n1');
});

test('trSatirKur: kamu kurumu ve sahte ornek e-posta adresi satir olmaz, eksik toplamaya (ag) girmez; isletmenin kendi adresi gecer', () => {
  const { tr } = sahteTr(); const l = lead();
  for (const e of ['bilgi@ornek.gov.tr', 'sube@ornek.k12.tr', 'iletisim@ornek.bel.tr', 'info@exmple.com', 'info@yourdomain.com']) {
    assert.match(e, EPOSTA_UYGUNSUZ_TR, e);
    const r = trSatirKur({ x: sonOge(l), l, id: 'WH-TR-n1', ad: l.name, sayfa: SAYFA, e, simdi: SIMDI, tr, kaynak: 'x' });
    assert.equal(r.atla, 'eposta-uygunsuz'); assert.equal(tr.bekleyen.length, 0, 'bekleyene de girmez');
  }
  for (const e of ['info@ornek.test', 'rezervasyon@ornek-lokanta.com.tr', 'merhaba@ornek-dernek.org.tr', 'ornek@gmail.com']) assert.doesNotMatch(e, EPOSTA_UYGUNSUZ_TR, e);
});

test('trSatirKur: 2 kanitli eksik yoksa, onizleme yoksa ya da onizleme gecmiyorsa satir yok', () => {
  const l = lead(); let { tr } = sahteTr();
  ekle(tr, l, { eksikler: [], tur: ['menu-foto'], elenme: 'eksik-az:1' });
  assert.equal(kurTek(l, tr).atla, 'eksikler:eksik-az:1');
  ekle(tr, l); assert.equal(kurTek(l, tr, { onizleme: undefined }).atla, 'no-preview');
  tr.onizleme = () => '45KB (60-120)'; assert.equal(kurTek(l, tr).atla, 'preview:45KB (60-120)');
  tr = sahteTr({ gonderen: () => false }).tr; ekle(tr, l); assert.equal(kurTek(l, tr).atla, 'sender-name');
});

test('trSatirKur: satir kampanya websites-demo-tr, TR, tr, bekletilir; kanit satirda, mailde yok; onizleme kopyasi hedef yolda', () => {
  const { tr, cagri } = sahteTr(); const l = lead(); ekle(tr, l);
  const r = kurTek(l, tr);
  assert.ok(r.row, JSON.stringify(r));
  const row = r.row;
  assert.equal(row.campaign, KAMPANYA_TR); assert.equal(KAMPANYA_TR, 'websites-demo-tr'); assert.equal(row.region, 'TR'); assert.equal(row.lang, 'tr'); assert.equal(row.segment, 'demo');
  assert.equal(row._held, BEKLET_TR); assert.equal(row.to, 'info@ornek.test'); assert.equal(row.id, 'WH-TR-n1');
  assert.equal(row.preview.path, 'attachments/websites-demo-tr/WH-TR-n1.jpg'); assert.equal(row.preview.href, SAYFA);
  assert.equal(row._eksikler.length, 2); assert.match(row._evidence, /ana sayfa kaynağı \(12 Kas 2026\)/); assert.ok(!row.body.includes('kaynağı (12 Kas'));
  assert.equal(row.notBefore, '2026-11-13T00:00:00Z');
  assert.deepEqual(r.kopya, { from: '/tmp/onizleme.jpg', to: 'attachments/websites-demo-tr/WH-TR-n1.jpg' });
  assert.deepEqual(tr.parti.length, 1); assert.deepEqual(cagri, { mail: 1, denetle: 1, benzersiz: 1 });
});

test('trSatirKur: denetim ya da benzersizlik tutmazsa ayni eksikler baska soyleyisle yeniden denenir; hepsi basarisizsa satir yok', () => {
  const l = lead(); let { tr, cagri } = sahteTr();
  let n = 0; tr.denetle = ({ eksikler }) => { n++; return n < 3 ? ['kalip: x'] : []; }; ekle(tr, l);
  const r = kurTek(l, tr); assert.ok(r.row); assert.equal(n, 3); assert.match(r.row.body, /\(2\)/, 'ucuncu denemede ucuncu soyleyis');
  ({ tr, cagri } = sahteTr({ denetle: () => ['vaat: x'] })); ekle(tr, l);
  assert.equal(kurTek(l, tr).atla, 'lint:vaat: x'); assert.equal(cagri.mail, SALT_DENEME); assert.equal(tr.parti.length, 0);
  ({ tr } = sahteTr({ benzersiz: () => ['ayni konu: A / B'] })); ekle(tr, l);
  assert.equal(kurTek(l, tr).atla, 'ayni-metin:ayni konu: A / B');
  let m = 0; ({ tr } = sahteTr({ mail: (g) => { m++; return { konu: 'k', govde: 'g', fayda: 'f' }; }, denetle: () => ['x'] })); ekle(tr, l); kurTek(l, tr);
  assert.equal(m, SALT_DENEME);
});

test('trEksikTopla: bekleyenleri canli okur ve eksikleri esler; okuma hatasi isletmeyi eler, eksik uydurmaz; zaten bilinen atlanir', async () => {
  const { tr } = sahteTr(); const a = lead(); const b = lead({ id: 'TR-n2', slug: 'baska-tr0002' }); const c = lead({ id: 'TR-n3', slug: 'ucuncu-tr0003' });
  tr.bekleyen.push({ x: sonOge(a), l: a }, { x: sonOge(b), l: b }, { x: sonOge(c), l: c }); ekle(tr, c);
  const E = {
    eksiklerTopla: async ({ lead: l }) => { if (l.id === 'TR-n2') throw new Error('ag koptu'); return { lead: l }; },
    eksiklerUret: ({ lead: l }) => ({ eksikler: EKSIKLER, tur: ['telefon-tel-yok', 'saat-altta'], elenme: null, secilen: [], l }),
  };
  const gunluk = []; const n = await trEksikTopla({ tr, E, getir: null, osmGetir: null, simdi: SIMDI, log: (s) => gunluk.push(s) });
  assert.equal(n, 3); assert.equal(tr.bekleyen.length, 0);
  assert.equal(tr.eksik.get('TR-n1').eksikler.length, 2); assert.equal(tr.eksik.get('TR-n2').eksikler.length, 0); assert.match(tr.eksik.get('TR-n2').elenme, /^okunamadi:/);
  assert.equal(tr.eksik.get('TR-n3').secilen, undefined, 'onceden bilinen eksik ezilmez'); assert.equal(gunluk.length, 2);
});

// ---- hat/kuyruk.mjs TR dali (ozel katman gerekir: mailAdi vb. ozel-getir ile gelir) ----
const kur = (son, leads, tr, { env = { RESTORAN_KUYRUK: 'acik', TR_KUYRUK: 'acik' }, onay = new Set(['TR']), po = {} } = {}) => {
  const eski = { R: process.env.RESTORAN_KUYRUK, T: process.env.TR_KUYRUK };
  for (const k of ['RESTORAN_KUYRUK', 'TR_KUYRUK']) delete process.env[k];
  Object.assign(process.env, env);
  try { return satirlarKur({ son, leadsById: new Map(leads.map((l) => [l.id, l])), po: { sent: '', queue: '', suppress: '', replied: '', ...po }, simdi: SIMDI, onaylanan: onay, tr }); }
  finally { for (const [k, v] of [['RESTORAN_KUYRUK', eski.R], ['TR_KUYRUK', eski.T]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
};

test('satirlarKur TR: eksikler yokken bekleyene girer, ikinci turda TR satiri kurulur; bekletilir, kampanya websites-demo-tr', () => {
  const l = lead(); const { tr } = sahteTr();
  const r1 = kur([sonOge(l)], [l], tr);
  assert.equal(r1.satirlar.length, 0); assert.equal(r1.atla['tr-eksik-bekliyor'], 1); assert.equal(tr.bekleyen.length, 1);
  tr.bekleyen.length = 0; ekle(tr, l);
  const r = kur([sonOge(l)], [l], tr);
  assert.equal(r.satirlar.length, 1, JSON.stringify(r.atla));
  assert.equal(r.satirlar[0].campaign, KAMPANYA_TR); assert.equal(r.satirlar[0]._held, BEKLET_TR); assert.equal(r.kopyalar.length, 1);
});

test('satirlarKur TR: tr nesnesi yoksa ya da hatali ise satir yazilmaz; kapilar (TR_KUYRUK, onay, RESTORAN_KUYRUK) degismedi', () => {
  const l = lead(); const { tr } = sahteTr(); ekle(tr, l);
  assert.equal(kur([sonOge(l)], [l], null).atla['tr-modulleri-yok'], 1);
  assert.equal(kur([sonOge(l)], [l], { hata: 'yok' }).atla['tr-modulleri-yok'], 1);
  assert.equal(kur([sonOge(l)], [l], tr, { env: { RESTORAN_KUYRUK: 'acik' } }).atla['TR-kapali'], 1, 'TR_KUYRUK acik degil');
  assert.equal(kur([sonOge(l)], [l], tr, { onay: new Set() }).atla['TR-kapali'], 1, 'onay.json TR yok');
  assert.equal(kur([sonOge(l)], [l], tr, { env: { TR_KUYRUK: 'acik' } }).atla.restoran, 1, 'RESTORAN_KUYRUK acik degil');
  assert.equal(kur([sonOge(l, { sonGoz: false })], [l], tr).atla.restoran, 1, 'son goz onayi yok');
});

test('satirlarKur TR: partide ayni adres bir kez; kuyrukta bekleyen TR satirinin adresi yazilmis sayilir', () => {
  const a = lead(); const b = lead({ id: 'TR-n2', osm: 'node/2', slug: 'baska-tr0002', name: 'Başka Lokanta', website: 'https://baska.example/', finalUrl: 'https://baska.example/', email: 'info@x.test' });
  const { tr } = sahteTr(); ekle(tr, a); ekle(tr, b);
  const r = kur([sonOge(a), sonOge(b, { page: 'r/baska-tr0002-ab12cd', slug: 'baska-tr0002' })], [a, b], tr);
  assert.equal(r.satirlar.length, 2, JSON.stringify(r.atla));
  const ayni = lead({ id: 'TR-n3', osm: 'node/3', slug: 'ucuncu-tr0003', name: 'Üçüncü Lokanta', website: 'https://ucuncu.example/', finalUrl: 'https://ucuncu.example/', email: a.email });
  ekle(tr, ayni);
  const r2 = kur([sonOge(a), sonOge(ayni, { page: 'r/ucuncu-tr0003-ab12cd', slug: 'ucuncu-tr0003' })], [a, ayni], tr);
  assert.equal(r2.satirlar.length, 1); assert.equal(r2.atla['partide-tekrar'], 1);
  const bekleyen = JSON.stringify({ id: 'WD-TR-009', to: a.email, campaign: KAMPANYA_TR, _held: BEKLET_TR, name: a.name, region: 'TR' });
  const r3 = kur([sonOge(a)], [a], tr, { po: { queue: bekleyen } });
  assert.equal(r3.satirlar.length, 0); assert.ok(Object.keys(r3.atla).some((k) => /daha-once/.test(k)), JSON.stringify(r3.atla));
});
