// MAKSIMUM HAT (12 Kas 2026) testleri: HAT_TUR_ADAY, ulke donusu ve dengeli secim, butce (herkese acik depoda gunluk ust sinir), matris parcalari (parca, topla), is akisi dosyalari.  Ag yok, tarayici yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dongu, adayDengele, siraDondur, turAdayOku, ulkeFiltre, TUR_ADAY_VARSAYILAN } from '../dongu.mjs';
import { butceHesapla, gunlukVarsayilan, GUNLUK_SINIRSIZ, GUNLUK_OZEL, agirlikli, UYGULA_CARPAN } from '../butce.mjs';
import { kararListesi, parcaSayisi, parcaSec, parcaCoz, PARALEL_USTSINIR } from '../parca.mjs';
import { paketle, birlestir } from '../topla.mjs';
import { uygula } from '../uygula.mjs';
import { uretimLead } from '../uretim.mjs';
import { gecici } from './gecici.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(HERE, '..', '..');
const tmp = (p = 'maks-') => gecici(p);
const yaz = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof s === 'string' ? s : JSON.stringify(s)); };

// ---- HAT_TUR_ADAY ----
test('HAT_TUR_ADAY: varsayilan 20, degisken artirir ve azaltir, gecersiz deger yok sayilir, ust sinir 200, plan yedek', () => {
  assert.equal(TUR_ADAY_VARSAYILAN, 20);
  assert.equal(turAdayOku({}), 20);
  assert.equal(turAdayOku({ HAT_TUR_ADAY: '' }), 20);
  assert.equal(turAdayOku({ HAT_TUR_ADAY: '45' }), 45);
  assert.equal(turAdayOku({ HAT_TUR_ADAY: '5' }), 5);
  assert.equal(turAdayOku({ HAT_TUR_ADAY: '0' }), 20); assert.equal(turAdayOku({ HAT_TUR_ADAY: 'abc' }), 20); assert.equal(turAdayOku({ HAT_TUR_ADAY: '-3' }), 20);
  assert.equal(turAdayOku({ HAT_TUR_ADAY: '9999' }), 200);
  assert.equal(turAdayOku({}, { uretimHerTur: 7 }), 7, 'degisken yoksa plan.json limitler.uretimHerTur');
  assert.equal(turAdayOku({ HAT_TUR_ADAY: '30' }, { uretimHerTur: 7 }), 30, 'degisken plani gecer');
  const plan = JSON.parse(fs.readFileSync(path.join(KOK, 'hat', 'plan.json'), 'utf8')); assert.equal(plan.limitler.uretimHerTur, 20, 'plan.json varsayilani 20');
});

test('HAT_ULKELER: yalniz kisar (virgul ve bosluk ayirici, kucuk harf serbest), bos hepsi', () => {
  const sira = [['IE', 'konaklama'], ['GB', 'konaklama'], ['TR', 'restoran'], ['AU', 'guzellik']];
  assert.deepEqual(ulkeFiltre(sira, ''), sira); assert.deepEqual(ulkeFiltre(sira, undefined), sira);
  assert.deepEqual(ulkeFiltre(sira, 'ie, tr'), [['IE', 'konaklama'], ['TR', 'restoran']]);
  assert.deepEqual(ulkeFiltre(sira, 'NZ'), [], 'listede olmayan ulke eklenmez');
});

// ---- ulke donusu ----
test('siraDondur: sektor-major, ulkeler doner; baslangic ulkesi her tur kayar; hicbir cift kaybolmaz (yurt disi ve TR birlikte)', () => {
  const ulkeler = ['IE', 'GB', 'AU', 'NZ', 'TR']; const sira = [];
  for (const s of ['konaklama', 'guzellik', 'restoran']) for (const u of ulkeler) if (!(u === 'TR' && s !== 'restoran')) sira.push([u, s]);
  const sirali = [...sira].sort(); // ham sira (ulke-major): IE, GB, AU, NZ, TR gruplari
  const ham = []; for (const u of ulkeler) for (const s of ['konaklama', 'guzellik', 'restoran']) if (sira.some(([x, y]) => x === u && y === s)) ham.push([u, s]);
  const t0 = siraDondur(ham, 0);
  assert.equal(t0.length, ham.length); assert.deepEqual([...t0].sort(), sirali);
  assert.deepEqual(t0.slice(0, 5).map(([u]) => u), ['IE', 'GB', 'AU', 'NZ', 'TR'], 'ilk dilim: her ulkenin ilk sektoru');
  assert.deepEqual(t0.slice(0, 4).map(([, s]) => s), ['konaklama', 'konaklama', 'konaklama', 'konaklama']);
  const ilkler = []; for (let t = 0; t < 5; t++) ilkler.push(siraDondur(ham, t)[0][0]);
  assert.deepEqual(ilkler, ['IE', 'GB', 'AU', 'NZ', 'TR'], '5 turda her ulke bir kez en basta');
  assert.equal(siraDondur(ham, 5)[0][0], 'IE', 'tur sayaci doner');
  assert.deepEqual(siraDondur([['IE', 'a'], ['IE', 'b']], 3), [['IE', 'a'], ['IE', 'b']], 'tek ulke degismez');
  assert.deepEqual(siraDondur([], 2), []);
  // TR'nin yalniz restorani var: restoran diliminde TR de yer alir
  assert.ok(t0.some(([u, s]) => u === 'TR' && s === 'restoran'));
});

test('adayDengele: ulkeler sirayla birer aday verir, ayni turda tek ulkeye yigilmaz; biten ulkeyi digerleri tamamlar; restoran siniri; ofset baslangici kaydirir', () => {
  const L = (u, i, sektor = 'konaklama') => ({ id: `${u}-${i}`, ulke: u, sektor });
  const liste = [];
  for (let i = 0; i < 30; i++) liste.push(L('IE', i)); // IE bol
  for (let i = 0; i < 4; i++) liste.push(L('GB', i)); for (let i = 0; i < 6; i++) liste.push(L('AU', i)); for (let i = 0; i < 6; i++) liste.push(L('NZ', i)); for (let i = 0; i < 6; i++) liste.push(L('TR', i, 'restoran'));
  const say = (l) => l.reduce((m, x) => { m[x.ulke] = (m[x.ulke] || 0) + 1; return m; }, {});
  // 20 aday: dengeli dagilim (5 ulke -> 4'er), IE'ye yigilma yok
  const s = adayDengele(liste, { adet: 20, restoranSiniri: 6, ofset: 0 });
  assert.equal(s.length, 20); assert.deepEqual(say(s), { AU: 4, GB: 4, IE: 4, NZ: 4, TR: 4 });
  // her ulkede puan sirasi korunur (liste sirasi)
  assert.deepEqual(s.filter((x) => x.ulke === 'IE').map((x) => x.id), ['IE-0', 'IE-1', 'IE-2', 'IE-3']);
  // 30 aday: GB 4'te biter, kalan ulkeler tamamlar
  const s30 = adayDengele(liste, { adet: 30, restoranSiniri: 99 }); assert.equal(s30.length, 30); assert.equal(say(s30).GB, 4); assert.ok(say(s30).IE <= 8, JSON.stringify(say(s30)));
  // restoran siniri: TR yalniz restoran; sinir 2 -> TR en cok 2, kalan 18'i diger ulkeler doldurur
  const sr = adayDengele(liste, { adet: 20, restoranSiniri: 2 }); assert.equal(sr.length, 20); assert.equal(say(sr).TR, 2);
  // sinirsiz az aday: elde olan kadar
  assert.equal(adayDengele([L('IE', 1)], { adet: 20 }).length, 1); assert.deepEqual(adayDengele([], { adet: 20 }), []);
  // ofset: 1 aday verilirse sirali ulkelerin basi kayar (AU, GB, IE, NZ, TR)
  const ilk = (o) => adayDengele(liste, { adet: 1, ofset: o })[0].ulke;
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(ilk), ['AU', 'GB', 'IE', 'NZ', 'TR', 'AU']);
  // adet bir ulkenin tum adayindan buyuk olsa bile kimse iki kez secilmez
  assert.equal(new Set(s30.map((x) => x.id)).size, 30);
});

// ---- dongu: dort ulke, HAT_TUR_ADAY, donus ----
function ortam4(adetUlkeBasina = 8, { sektor = 'konaklama' } = {}) {
  const depo = tmp(); const veri = path.join(depo, 'veri'); const kutu = tmp(); const uretilen = [];
  const planDosya = path.join(depo, 'plan.json');
  yaz(planDosya, { sektorler: { [sektor]: { aktif: true } }, sira: ['IE', 'GB', 'AU', 'NZ'].map((u) => [u, sektor]), limitler: { osmSorguHerTur: 4, havuzHedef: 40, uretimHerTur: 20, tarayiciEs: 2, restoranHerTur: 6 } });
  const araclar = {
    bul: async (ulke) => Array.from({ length: adetUlkeBasina }, (_, i) => ({ id: `${ulke}-n${1000 + i}`, osm: `node/${1000 + i}`, ulke, sektor, name: `${ulke} House ${i}`, website: `http://h${i}.${ulke.toLowerCase()}/`, tur: 'guest house' })),
    tarananlar: (f) => new Set(fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id) : []),
    Polite: class { }, openBrowser: async () => ({ close: async () => {} }),
    taraHepsi: async ({ leads, cikti, onceki }) => { const say = {}; for (const l of leads) { if (onceki.has(l.id)) continue; const r = { ...l, durum: 'aday', puan: 5 + (Number(l.id.slice(-1)) % 4), email: `x${l.id}@h.example`, finalUrl: l.website }; fs.appendFileSync(cikti, `${JSON.stringify(r)}\n`); say.aday = (say.aday || 0) + 1; } return { sayac: say, kalan: false }; },
    uretimLead,
    uretimCalis: async ({ leads }) => { const sonuc = []; for (const l of leads) { uretilen.push(l.ulke); const slug = uretimLead(l).slug; yaz(path.join(veri, slug, 'kapi.json'), { status: 'hazir' }); yaz(path.join(veri, slug, 'inceleme', 'sheet.jpg'), 'x'); yaz(path.join(veri, slug, 'inceleme', 'bilgi.json'), {}); sonuc.push({ id: l.id, slug, status: 'hazir' }); } return { sonuc, kalan: false }; },
    hazirlar: (v) => (fs.existsSync(v) ? fs.readdirSync(v).filter((s) => fs.existsSync(path.join(v, s, 'kapi.json'))) : []),
    kutuEkle: ({ slugs }) => slugs.length, kutuOku: () => [], yazilanlar: () => ({ neden: () => null }),
  };
  return { depo, veri, kutu, planDosya, araclar, uretilen };
}
const say = (l) => l.reduce((m, x) => { m[x] = (m[x] || 0) + 1; return m; }, {});

test('dongu: HAT_TUR_ADAY adet aday, dort ulkeye esit dagilir; sonraki tur baska ulkeyle baslar; durum dosyasinda dagilim var', async () => {
  const o = ortam4();
  const run = (env) => dongu({ depo: o.depo, kutu: o.kutu, po: o.depo, sureDk: 30, parti: 'p', planDosya: o.planDosya, veri: o.veri, araclar: o.araclar, log: () => {}, env });
  const r1 = await run({ HAT_TUR_ADAY: '12' });
  assert.equal(r1.turAday, 12); assert.equal(o.uretilen.length, 12); assert.deepEqual(say(o.uretilen), { AU: 3, GB: 3, IE: 3, NZ: 3 }, 'ayni tur ayni ulkeye yigilmaz');
  assert.deepEqual(r1.ulkeler, { AU: 3, GB: 3, IE: 3, NZ: 3 });
  // lead listeleri: osmSorguHerTur 4 -> dort ulkeden de cekildi
  assert.equal(r1.osm.length, 4);
  const d = JSON.parse(fs.readFileSync(path.join(o.depo, 'durum', 'dongu.json'), 'utf8')); assert.equal(d.turlar, 1); assert.deepEqual(d.sonSonuc.ulkeler, { AU: 3, GB: 3, IE: 3, NZ: 3 }); assert.equal(d.sonSonuc.turAday, 12);
  // 2. tur, varsayilan 20: kalan 20 adaydan 5'er
  o.uretilen.length = 0; const r2 = await run({});
  assert.equal(r2.turAday, 20); assert.equal(o.uretilen.length, 20); assert.deepEqual(say(o.uretilen), { AU: 5, GB: 5, IE: 5, NZ: 5 });
  assert.ok(!JSON.stringify(d).includes('@'), 'durum dosyasinda e-posta yok');
});

test('dongu: HAT_ULKELER yalniz kisar; tek ulkeyle tum adaylar o ulkeden; ulkesi biten turda digerleri tamamlar', async () => {
  const o = ortam4(8);
  const run = (env) => dongu({ depo: o.depo, kutu: o.kutu, po: o.depo, sureDk: 30, parti: 'p', planDosya: o.planDosya, veri: o.veri, araclar: o.araclar, log: () => {}, env });
  await run({ HAT_TUR_ADAY: '6', HAT_ULKELER: 'GB,NZ' }); assert.deepEqual(say(o.uretilen), { GB: 3, NZ: 3 });
  o.uretilen.length = 0; await run({ HAT_TUR_ADAY: '20', HAT_ULKELER: 'GB' }); assert.deepEqual(say(o.uretilen), { GB: 5 }, 'GB tek ulke: kalan 5 aday');
  // GB tukendi; sinirsiz ulke listesiyle kalanlar dengeli
  o.uretilen.length = 0; await run({ HAT_TUR_ADAY: '20' }); const k = say(o.uretilen); assert.equal(o.uretilen.length, 20); assert.ok(!k.GB, 'GB tukendi'); assert.equal(k.NZ, 5, 'NZ kalan 5 adayin hepsi'); assert.equal(k.AU + k.IE, 15); assert.ok(k.AU <= 8 && k.IE <= 8 && Math.abs(k.AU - k.IE) <= 1, JSON.stringify(k));
});

test('dongu: tarama havuzu ulke basina hedeflenir (bir ulkenin havuzu dolunca siradaki ulkeye gecilir)', async () => {
  const o = ortam4(8);
  const taranan = []; const eski = o.araclar.taraHepsi;
  o.araclar.taraHepsi = async (a) => { taranan.push(path.basename(a.cikti)); return eski(a); };
  const plan = JSON.parse(fs.readFileSync(o.planDosya, 'utf8')); plan.limitler.havuzHedef = 8; plan.limitler.uretimHerTur = 4; yaz(o.planDosya, plan);
  await dongu({ depo: o.depo, kutu: o.kutu, po: o.depo, sureDk: 30, parti: 'p', planDosya: o.planDosya, veri: o.veri, araclar: o.araclar, log: () => {}, env: {} });
  // ulke basina hedef 2 aday: her ulkeden en az bir liste taranir (ilk ulkede durmaz)
  assert.ok(new Set(taranan).size >= 4, `taranan listeler: ${taranan.join(',')}`);
  assert.equal(o.uretilen.length, 4, 'uretim turAday kadar (degisken yok: plan uretimHerTur 4)'); assert.deepEqual(say(o.uretilen), { AU: 1, GB: 1, IE: 1, NZ: 1 });
});

// ---- butce ----
test('butce: herkese acik depoda aylik sinir kalkar ama gunluk ust sinir (600) kalir; degisken ust siniri belirler; uygula koşusu paralel carpanla sayilir', () => {
  const simdi = new Date('2026-11-12T12:00:00Z');
  const run = (baslangic, dk, ek = {}) => ({ status: 'completed', run_started_at: baslangic, updated_at: new Date(Date.parse(baslangic) + dk * 60000 - 1000).toISOString(), ...ek });
  assert.equal(gunlukVarsayilan(true), GUNLUK_SINIRSIZ); assert.equal(gunlukVarsayilan(false), GUNLUK_OZEL); assert.equal(GUNLUK_SINIRSIZ, 600);
  // aylik 600'u cok asmis, ama sinirsiz: calisir
  const a = butceHesapla({ runs: [run('2026-11-03T01:00:00Z', 900), run('2026-11-12T01:00:00Z', 30)], simdi, sinirsiz: true, gunluk: 600, tur: 40 });
  assert.equal(a.calis, true); assert.equal(a.sure, 40); assert.equal(a.gunKullanilan, 30);
  // bugun 590 dk: kalan 10 -> kisa tur; 595 dk: durur (8 dk altinda)
  assert.equal(butceHesapla({ runs: [run('2026-11-12T01:00:00Z', 590)], simdi, sinirsiz: true, gunluk: 600 }).sure, 10);
  const dur = butceHesapla({ runs: [run('2026-11-12T01:00:00Z', 595)], simdi, sinirsiz: true, gunluk: 600 }); assert.equal(dur.calis, false); assert.match(dur.neden, /gunluk butce doldu \(595\/600 dk\)/);
  // ust sinir degisken: 300
  assert.equal(butceHesapla({ runs: [run('2026-11-12T01:00:00Z', 295)], simdi, sinirsiz: true, gunluk: 300 }).calis, false);
  assert.equal(butceHesapla({ runs: [run('2026-11-11T01:00:00Z', 595)], simdi, sinirsiz: true, gunluk: 300 }).calis, true, 'dunku kullanim bugunu etkilemez');
  // ozel depo: aylik sinir eskisi gibi
  assert.equal(butceHesapla({ runs: [run('2026-11-02T01:00:00Z', 595)], simdi }).calis, false);
  // uygula koşusu: matris paralel -> dakika x carpan
  assert.equal(agirlikli(run('2026-11-12T01:00:00Z', 10, { name: 'uygula' })), 10 * UYGULA_CARPAN); assert.equal(agirlikli(run('2026-11-12T01:00:00Z', 10, { name: 'hat' })), 10);
  assert.equal(butceHesapla({ runs: [run('2026-11-12T01:00:00Z', 20, { name: 'uygula' })], simdi, sinirsiz: true, gunluk: 600 }).gunKullanilan, 20 * UYGULA_CARPAN);
});

// ---- matris parcalari ----
test('parca: en cok 4 parca, karar sayisindan fazla degil; kararli ve dengeli bolme; bozuk json da sayilir; CLI ciktisi', () => {
  assert.equal(PARALEL_USTSINIR, 4);
  assert.equal(parcaSayisi(0), 0); assert.equal(parcaSayisi(1), 1); assert.equal(parcaSayisi(3), 3); assert.equal(parcaSayisi(20), 4); assert.equal(parcaSayisi(20, 2), 2); assert.equal(parcaSayisi(20, 99), 4); assert.equal(parcaSayisi(20, 'x'), 4); assert.equal(parcaSayisi(20, 0), 4);
  assert.deepEqual(parcaCoz('1/4'), { i: 1, n: 4 }); assert.equal(parcaCoz('4/4'), null); assert.equal(parcaCoz('a/b'), null); assert.equal(parcaCoz(''), null);
  const d = tmp(); for (const p of ['c-2', 'c-1']) for (const s of ['z', 'a', 'm']) yaz(path.join(d, 'karar', p, `${s}.json`), s === 'm' ? '{bozuk' : { karar: 'hazir' });
  yaz(path.join(d, 'karar', 'not.txt'), 'x');
  const L = kararListesi(d); assert.equal(L.length, 6); assert.deepEqual(L.map((x) => `${x.parti}/${x.slug}`), ['c-1/a', 'c-1/m', 'c-1/z', 'c-2/a', 'c-2/m', 'c-2/z']);
  const parcalar = [0, 1, 2, 3].map((i) => parcaSec(L, i, 4)); assert.deepEqual(parcalar.map((p) => p.length), [2, 2, 1, 1]);
  assert.equal(new Set(parcalar.flat().map((x) => `${x.parti}/${x.slug}`)).size, 6, 'her karar tam bir parcada');
  assert.deepEqual(parcaSec([...L].reverse(), 1, 4).map((x) => x.slug), parcaSec(L, 1, 4).map((x) => x.slug), 'giris sirasi sonucu degistirmez');
  // CLI
  const out = spawnSync(process.execPath, [path.join(KOK, 'hat', 'parca.mjs'), 'plan', '--karar', d, '--paralel', '3'], { encoding: 'utf8' }).stdout;
  assert.match(out, /^adet=6$/m); assert.match(out, /^n=3$/m); assert.match(out, /^parca=\[0,1,2\]$/m);
  const bos = spawnSync(process.execPath, [path.join(KOK, 'hat', 'parca.mjs'), 'plan', '--karar', tmp()], { encoding: 'utf8' }).stdout;
  assert.match(bos, /^adet=0$/m); assert.match(bos, /^parca=\[0\]$/m, 'karar yokken matris yine gecerli bir dizi ister');
  const sl = spawnSync(process.execPath, [path.join(KOK, 'hat', 'parca.mjs'), 'slugs', '--karar', d, '--parca', '2/4'], { encoding: 'utf8' }).stdout.trim(); assert.equal(sl, 'z');
});

test('uygula --parca: yalniz o parcanin kararlari uygulanir (veri yokken veri-yok satiri), gecersiz parca hata verir', async () => {
  const d = tmp(); const veri = tmp(); const oniz = tmp();
  for (const s of ['a', 'b', 'c', 'd', 'e']) yaz(path.join(d, 'karar', 'p1', `${s}.json`), { karar: 'hazir', neden: 'x' });
  const sonuc = {}; const delta = {};
  for (let i = 0; i < 2; i++) sonuc[i] = (await uygula({ kararDir: d, veri, onizDir: oniz, parca: `${i}/2`, elleDelta: delta, log: () => {} })).map((x) => x.slug);
  assert.deepEqual(sonuc[0], ['a', 'c', 'e']); assert.deepEqual(sonuc[1], ['b', 'd']);
  assert.equal((await uygula({ kararDir: d, veri, onizDir: oniz, log: () => {} })).length, 5, 'parcasiz hepsi (eski davranis)');
  await assert.rejects(() => uygula({ kararDir: d, veri, onizDir: oniz, parca: '9/2' }), /parca i\/n/);
});

test('topla: parca ciktilari paketlenir ve tek agacta birlesir; elle kaydi uygulanir ve silinir; kararli ve son-bakis listeleri; eksik parca uyarisi', () => {
  const kok = tmp(); const veri = path.join(kok, 'veri'); const demo = path.join(kok, 'demo'); const oniz = path.join(kok, 'oniz'); const karar = path.join(kok, 'dal');
  for (const s of ['a', 'b', 'c']) yaz(path.join(karar, 'karar', 'p1', `${s}.json`), { karar: 'hazir' });
  for (const s of ['a', 'b', 'c']) { yaz(path.join(veri, s, 'kapi.json'), { status: 'x', slug: s }); yaz(path.join(veri, s, 'img', 'f.jpg'), s); }
  yaz(path.join(demo, 'r', 'a-1', 'index.html'), '<html>a</html>'); yaz(path.join(demo, 'r', 'a-1', 'img', 'i.webp'), 'a'); yaz(path.join(demo, '_hat1', 'x.css'), 'css'); yaz(path.join(demo, 'r', 'c-3', 'index.html'), '<html>c</html>');
  yaz(path.join(oniz, 'a.jpg'), 'jpeg-a');
  // parca 0 = a, c ; parca 1 = b   (parcaSec sirasi: a, b, c -> 0: a,c ; 1: b)
  const son0 = [{ slug: 'a', durum: 'hazir', page: 'r/a-1', onizleme: path.join(oniz, 'a.jpg') }, { slug: 'c', durum: 'son-bakis', page: 'r/c-3/index.html' }];
  const son1 = [{ slug: 'b', durum: 'gozden-gecir', neden: 'x' }];
  const p0 = paketle({ son: son0, kararSlugs: ['a', 'c'], veri, demo, onizDir: oniz, elleDelta: { a: { kayit: 1 }, z: null }, hedef: path.join(kok, 'cikti', 'parca-0') });
  const p1 = paketle({ son: son1, kararSlugs: ['b'], veri, demo, onizDir: oniz, elleDelta: {}, hedef: path.join(kok, 'cikti', 'parca-1') });
  assert.deepEqual(p0, { veri: 2, sayfa: 2, onizleme: 1 }); assert.deepEqual(p1, { veri: 1, sayfa: 0, onizleme: 0 });
  assert.ok(fs.existsSync(path.join(kok, 'cikti', 'parca-0', 'demo', 'r', 'c-3', 'index.html')), 'index.html yoluyla verilen sayfa klasoru de paketlenir');
  assert.ok(fs.existsSync(path.join(kok, 'cikti', 'parca-0', 'demo', '_hat1', 'x.css')), 'ortak klasor');
  // yeni agac: bos veri/demo/oniz; elle kaydi onceki
  const v2 = path.join(kok, 'v2'); const d2 = path.join(kok, 'd2'); const o2 = path.join(kok, 'o2'); const elle = path.join(kok, 'durum', 'elle-hat.json'); const sonF = path.join(kok, 'son', 'liste.json');
  yaz(elle, { _not: 'eski', z: { eski: true }, y: { dokunma: true } });
  const r = birlestir({ girdi: path.join(kok, 'cikti'), veri: v2, demo: d2, onizDir: o2, elleDosya: elle, sonDosya: sonF, beklenen: 3 });
  assert.deepEqual({ parcalar: r.parcalar, satir: r.satir, eksik: r.eksik }, { parcalar: 2, satir: 3, eksik: 1 });
  for (const s of ['a', 'b', 'c']) assert.ok(fs.existsSync(path.join(v2, s, 'img', 'f.jpg')), `veri ${s}`);
  assert.ok(fs.existsSync(path.join(d2, 'r', 'a-1', 'img', 'i.webp'))); assert.ok(fs.existsSync(path.join(d2, '_hat1', 'x.css')));
  const son = JSON.parse(fs.readFileSync(sonF, 'utf8')); assert.deepEqual(son.map((x) => x.slug), ['a', 'c', 'b']);
  assert.equal(son[0].onizleme, path.join(o2, 'a.jpg'), 'onizleme yolu birlesik klasore gosterir'); assert.equal(fs.readFileSync(path.join(o2, 'a.jpg'), 'utf8'), 'jpeg-a');
  const e = JSON.parse(fs.readFileSync(elle, 'utf8')); assert.deepEqual(Object.keys(e).sort(), ['_not', 'a', 'y']); assert.deepEqual(e.a, { kayit: 1 }); assert.deepEqual(e.y, { dokunma: true }); assert.ok(!('z' in e), 'null = kayit silinir');
  assert.equal(fs.readFileSync(path.join(kok, 'son', 'kararli.txt'), 'utf8'), 'a,c,b'); assert.equal(fs.readFileSync(path.join(kok, 'son', 'son-bakis.txt'), 'utf8'), 'c');
  // hic parca yok: bos ama hata yok
  const bos = birlestir({ girdi: path.join(kok, 'yok'), veri: v2, demo: d2, onizDir: o2, elleDosya: elle, sonDosya: path.join(kok, 'son2', 'liste.json'), beklenen: 2 }); assert.deepEqual({ p: bos.parcalar, e: bos.eksik }, { p: 0, e: 2 });
});

// ---- is akisi dosyalari (YAML ayristirici yok: metin denetimi) ----
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');
test('hat.yml: saatlik zamanlama (:00 disinda), HAT_TUR_ADAY ve HAT_ULKELER dongu adimina gecer, testler tuzsuz, ozet dagilimi yazar', () => {
  const y = oku('.github/workflows/hat.yml');
  const cron = [...y.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(cron, ['17 * * * *'], 'tek saatlik tetik, her saatin 17. dakikasi');
  assert.ok(!/cron:\s*'0 /.test(y) && !/cron:\s*'00 /.test(y), ':00 tetigi yok');
  assert.match(y, /HAT_TUR_ADAY: \$\{\{ vars\.HAT_TUR_ADAY \}\}/); assert.match(y, /HAT_ULKELER: \$\{\{ vars\.HAT_ULKELER \}\}/);
  assert.match(y, /HAT_DAKIKA_GUNLUK: \$\{\{ vars\.HAT_DAKIKA_GUNLUK \}\}/); assert.match(y, /HAT_DAKIKA_SINIRSIZ: \$\{\{ vars\.HAT_DAKIKA_SINIRSIZ \}\}/);
  assert.match(y, /group: peak-veri\n\s+cancel-in-progress: false/, 'turlar ust uste binmez');
  assert.match(y, /vars\.HAT_AKTIF == 'true'/, 'degisken kapaliyken hat calismaz');
  // testler tuzsuz kosar: tuz is duzeyinde yok, yalniz dongu adiminda (tuzlu kosunca v5 sayfa kodu testi duser)
  assert.match(y, /- name: testler[^\n]*\n\s+if:[^\n]*\n\s+run: bash hat\/sessiz\.sh testler npm test\n/, 'testler sessiz sarmalayiciyla ve tuzsuz kosar');
  const tuz = [...y.matchAll(/SAYFA_TUZU: \$\{\{ secrets\.SAYFA_TUZU \}\}/g)];
  assert.equal(tuz.length, 1, 'tuz tek adimda'); assert.ok(tuz[0].index > y.indexOf('- name: dongu'), 'tuz yalniz dongu adiminda');
  assert.match(y, /turAday:s\.turAday,ulkeler:s\.ulkeler/);
});

test('uygula.yml: plan -> uret (matris, en cok 4 ayni anda) -> topla; parcalar sifreli artifact ile birlesir; butce plan isinde; yalniz veri deposunun karar dallari', () => {
  const y = oku('.github/workflows/uygula.yml');
  assert.match(y, /^jobs:\n {2}plan:/m); assert.match(y, /^ {2}uret:/m); assert.match(y, /^ {2}topla:/m);
  assert.match(y, /needs: plan\n/); assert.match(y, /needs: \[plan, uret\]/);
  assert.match(y, /strategy:\n\s+fail-fast: false\n\s+max-parallel: 4\n\s+matrix:\n\s+parca: \$\{\{ fromJSON\(needs\.plan\.outputs\.parca \|\| '\[0\]'\) \}\}/);
  // action'lar SHA ile sabitli (herkese acik depoda zorunlu)
  assert.match(y, /actions\/upload-artifact@[0-9a-f]{40} # v4/); assert.match(y, /actions\/download-artifact@[0-9a-f]{40} # v4/); assert.match(y, /pattern: parca-\*/);
  for (const m of y.matchAll(/uses: ([^\s]+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, `SHA sabitli degil: ${m[1]}`);
  // herkese acik depoda artifact'lar herkese acik: isletme verisi YALNIZ sifreli yuklenir
  assert.equal((y.match(/openssl enc -aes-256-cbc -pbkdf2/g) || []).length, 1); assert.equal((y.match(/openssl enc -d -aes-256-cbc -pbkdf2/g) || []).length, 1);
  const yuk = /actions\/upload-artifact@[0-9a-f]{40}[^\n]*\n\s+with:\n([\s\S]*?)\n\n/.exec(y)[1]; assert.match(yuk, /path: calisma\/sifreli\/parca-\$\{\{ matrix\.parca \}\}\.tgz\.enc/); assert.ok(!/calisma\/cikti/.test(yuk), 'sifresiz klasor yuklenmez');
  assert.match(y, /\[ -n "\$PAKET_PAROLA" \] \|\| \{ echo "SAYFA_TUZU sirri yok[^\n]*exit 1; \}/, 'parola yoksa is durur (sifresiz yukleme yok)');
  // testler plan isinde, tuzsuz (plan isinde tuz hic yok)
  assert.match(y, /- name: testler[^\n]*\n\s+if:[^\n]*\n\s+run: bash hat\/sessiz\.sh testler npm test\n/, 'testler sessiz sarmalayiciyla kosar');
  const planBolum = y.slice(y.indexOf('\n  plan:'), y.indexOf('\n  uret:')); assert.ok(!/SAYFA_TUZU/.test(planBolum), 'plan isinde tuz yok');
  assert.match(y, /node hat\/parca\.mjs plan --karar calisma\/karar-dal/); assert.match(y, /node hat\/uygula\.mjs --karar calisma\/karar-dal --parca "\$P"/); assert.match(y, /node hat\/topla\.mjs paketle/); assert.match(y, /node hat\/topla\.mjs birlestir/);
  // butce yalniz plan isinde; matris ve topla onun ciktisina bakar
  assert.equal((y.match(/node hat\/butce\.mjs/g) || []).length, 1); assert.match(y, /needs\.plan\.outputs\.calis == 'true'/);
  for (const v of ['HAT_DAKIKA_GUNLUK', 'HAT_DAKIKA_AYLIK', 'HAT_DAKIKA_SINIRSIZ', 'HAT_PARALEL']) assert.match(y, new RegExp(`vars\\.${v}`), v);
  // needs.plan.outputs.X referanslari plan isinin outputs bolumunde tanimli
  const tanim = new Set([...y.slice(y.indexOf('outputs:'), y.indexOf('steps:')).matchAll(/^\s{6}(\w+): \$\{\{/gm)].map((m) => m[1]));
  for (const m of y.matchAll(/needs\.plan\.outputs\.(\w+)/g)) assert.ok(tanim.has(m[1]), `plan cikti tanimi yok: ${m[1]}`);
  // yalniz elle/tetikle baslar; dal adi ozel veri deposundaki karar dallari bicimindedir
  assert.match(y, /^on:\n {2}workflow_dispatch:/m); assert.ok(!/^\s+(push|pull_request|pull_request_target):/m.test(y), 'push ya da PR tetigi yok');
  assert.ok(y.includes('^karar/(icerik|songoz)-[0-9]{12}$'), 'dal adi dogrulamasi');
  assert.match(y, /node hat\/kutu\.mjs ekle[^\n]*--tur son-bakis/, 'son-bakis paketi son goz kutusuna girer');
  assert.ok(!/matrix\.parca[^\n]*HAT_PAT/.test(y), 'matris isleri HAT_PAT sirrini kullanmaz (teslim yalniz topla isinde)');
  // teslim/kuyruk yalniz topla isinde (parcalarda yok)
  const uretBolum = y.slice(y.indexOf('\n  uret:'), y.indexOf('\n  topla:')); assert.ok(!/hat\/teslim\.mjs|hat\/kuyruk\.mjs|yayin-paketi/.test(uretBolum), 'yayin ve kuyruk adimlari matris parcalarinda calismaz');
});

test('is akisi YAML: tirnaksiz adim adlarinda ": " yok (YAML hatasi; PyYAML ile yakalandi), sekme yok, her adim uses ya da run tasir', () => {
  for (const f of ['hat.yml', 'uygula.yml', 'birak.yml']) {
    const y = oku(`.github/workflows/${f}`);
    assert.ok(!/\t/.test(y), `${f}: sekme`);
    for (const m of y.matchAll(/^\s+- name: ([^"'\n].*)$/gm)) assert.ok(!/: /.test(m[1]) && !/ #/.test(m[1]), `${f}: tirnaksiz ad icinde ': ' ya da ' #': ${m[1]}`);
    const adimlar = y.split(/^\s{6}- /m).slice(1); for (const a of adimlar) assert.ok(/^(uses:|name:|id:|if:)/.test(a), `${f}: adim bicimi: ${a.slice(0, 40)}`);
  }
});

test('plan.json: uretimHerTur 20; her ulke-sektor ciftinin sektoru tanimli', () => {
  const p = JSON.parse(oku('hat/plan.json'));
  assert.equal(p.limitler.uretimHerTur, 20);
  for (const [, s] of p.sira) assert.ok(p.sektorler[s], `sektor tanimi: ${s}`);
});
