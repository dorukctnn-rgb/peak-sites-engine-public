// HAT 5. ADIM: KUYRUK SATIRLARI (peak-outreach, kampanya websites-demo).  Her satir BEKLETILIR (_held): hicbir satir bu adimda gonderime acilmaz.
// Serbest birakma hat/birak.mjs'in isidir (sektor onayi + isinma takvimi + otomatik durdurma).
//   node hat/kuyruk.mjs --son calisma/son/liste.json --leads <dir: *.tarandi.jsonl> --po <peak-outreach klonu> [--yaz]
// Kontroller: yalniz hedef ulkeler (lead/sektorler.mjs ULKELER: GB IE AU NZ SG, kapali TR; YASAK/BEKLE listesi hic); GB'de sirket kaniti; GB/IE'de serbest posta yok; susturma (suppress.txt), cevap verenler (data/replied.txt),
// daha once yazilan adres, alan adi ya da AYNI ISLETME (sent.jsonl, kuyruk; hat/isletme.mjs: site, telefon, OSM nesnesi, ad + sehir; ortak e-posta saglayicilarinda adres farkli olsa da), bu partide tekrar; mail metni kendi lint'imiz + peak-outreach'in KENDI lint'i (lintDemoText) + validateRow.
// E-posta adresleri yalniz dosyaya yazilir; ekrana yalniz satir kimligi ve sayilar basilir.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ULKELER, kapaliUlke } from '../lead/sektorler.mjs';
import { SERBEST, alanKoku } from '../lead/eposta.mjs';
import { isletmeIndeksi, indeksOlustur, leadKimligi, bizAlani, SEBEP as ISLETME_SEBEP } from './isletme.mjs';
import { mailYaz, mailDenetle, mailAdi } from '../mail/sablon.mjs';

export const KAMPANYA = 'websites-demo';
export const BEKLET_ILK = 'hat: sektörün ilk 5 sayfası koordinatör kontrolü bekliyor';
export const BEKLET = 'hat: ısınma takvimiyle hat/birak.mjs serbest bırakır';
export const SAYFA_TABAN = 'https://peakappsstudio.com/web/demo/';
export const satirId = (lead) => `WH-${lead.ulke}-${String(lead.osm || lead.id).replace(/^(\w)\w*\//, '$1').replace(/[^A-Za-z0-9]/g, '')}`;

// ad adaylari, ilk adin ardindan: sitenin basligi ve og:title'i, secilen logonun alt metni (hat/uygula.mjs adAdaylariOku yazar), OSM adi
export const adAdaylari = (x, l) => { const a = x.adAdaylari || {}; return [a.baslik, a.ogTitle, a.logoAlt, l && l.name].filter(Boolean); };

// peak-outreach'in kuyruk denetimi: validateRow + checkBody.  checkBody KAMPANYAYLA cagrilir: websites-demo maili Doruk'un birinci tekil sesinde (iki kez "Doruk" + imza) yazilir ve
// yalniz kampanya adi verilince kabul edilir; kampanyasiz cagri "personal-name" der ve hicbir satir yazilamazdi (12 Kas 2026)
export function satirGecerliMi(row, { validate, checkBody, config }) {
  const bad = validate ? validate({ ...row, _held: undefined }, config) : null;
  const b = checkBody ? checkBody(row.body, row.campaign) : {};
  return bad || b.error ? `gecersiz:${bad || b.error}` : null;
}

// ulkenin kuyruk anahtari varsa (TR: TR_KUYRUK) satir yalniz anahtar 'acik' ve onay.json'da ulke kodu onayliyken yazilir
export function trKuyrukAcik(ulke, onaylanan = new Set(), env = process.env) {
  const U = ULKELER[ulke]; if (!U || !U.kuyrukAnahtari) return true;
  return env[U.kuyrukAnahtari] === 'acik' && onaylanan.has(ulke);
}

const jsonl = (t) => String(t || '').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const dom = (a) => alanKoku(String(a).split('@')[1] || '');

// daha once yazilan / susturulan adresler, alan adlari ve isletmeler (peak-outreach'in kendi kurali: eski 'websites' kampanyasinin BEKLEYEN satirlari sayilmaz)
// neden(adres, lead): lead verilirse AYNI ISLETME de denetlenir ('isletme-daha-once'): ortak e-posta saglayicisinda (gmail vb.) alan adi isletmeyi anlatmaz, adres farkli olsa da
// ayni isletme (site, telefon, OSM nesnesi ya da ad + sehir) bir kez yazildiysa ikinci kez gecemez.  isletme(lead): eslesen kayit ya da null (kimlik ve durum, adres degil).
export function yazilanlar({ sent, queue, suppress, replied }) {
  const adr = new Set(); const alan = new Set();
  const al = (a) => { const e = String(a || '').trim().toLowerCase(); if (!e.includes('@')) return; adr.add(e); if (!SERBEST.test(e)) alan.add(dom(e)); };
  for (const r of sent) if (['sent', 'uncertain', 'pending', 'rejected'].includes(r.status)) al(r.to);
  for (const r of queue) if (!r._held || r.campaign === KAMPANYA) al(r.to);
  const sup = String(suppress || '').split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#'));
  const rep = String(replied || '').split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#'));
  const bloke = (e, list) => list.some((s) => (s.startsWith('@') ? e.endsWith(s) || e.split('@')[1].endsWith(s.slice(1)) : s === e));
  const isl = isletmeIndeksi({ sent, queue });
  return {
    neden(e, lead = null) {
      e = e.toLowerCase();
      if (bloke(e, sup)) return 'suppressed';
      if (bloke(e, rep)) return 'replied';
      if (adr.has(e)) return 'adres-daha-once';
      if (!SERBEST.test(e) && alan.has(dom(e))) return 'alan-daha-once';
      if (lead && isl.bul(leadKimligi(lead))) return ISLETME_SEBEP;
      return null;
    },
    isletme(lead) { return lead ? isl.bul(leadKimligi(lead)) : null; },
  };
}

export function satirlarKur({ son, leadsById, po, simdi = new Date(), onaylanan = new Set(), dis = null }) {
  const sent = jsonl(po.sent); const queue = jsonl(po.queue); const ids = new Set(queue.map((r) => r.id));
  const Y = yazilanlar({ sent, queue, suppress: po.suppress, replied: po.replied });
  const satirlar = []; const kopyalar = []; const atla = {}; const sk = (w) => { atla[w] = (atla[w] || 0) + 1; };
  const parti = { adr: new Set(), alan: new Set(), isl: indeksOlustur() }; const sayac = {};
  for (const x of son.filter((s) => s.durum === 'hazir')) {
    // restoran ailesi (v5/kategori): mail satiri YOK.  son goz onayi sart ve koordinator RESTORAN_KUYRUK=acik demeden hic satir yazilmaz (Doruk 11 Kas: mail kapali).
    if ((x.sektor || '') === 'restoran' && (x.sonGoz !== true || process.env.RESTORAN_KUYRUK !== 'acik')) { atla.restoran = (atla.restoran || 0) + 1; continue; }
    const l = leadsById.get(x.id || x.leadId) || [...leadsById.values()].find((v) => v.slug === x.slug);
    if (!l) { sk('lead-yok'); continue; }
    if (!ULKELER[l.ulke] || kapaliUlke(l.ulke)) { sk(`ulke:${l.ulke}`); continue; }
    // Turkiye (11 Kas 2026): VARSAYILAN KAPALI.  Satir yalniz TR_KUYRUK=acik VE koordinator durum/onay.json'da "TR" onayini verdiyse yazilir
    // (ilk TR sayfalari gozle onaylanmadan hicbir TR satiri kuyruga girmez).  TR maili Turkce sablondan (mail/restoran-tr.mjs) kurulur.
    if (!trKuyrukAcik(l.ulke, onaylanan)) { sk(`${l.ulke}-kapali`); continue; }
    if (!l.email) { sk('eposta-yok'); continue; }
    if (l.durum !== 'aday') { sk(`lead-durum:${l.durum}`); continue; }
    const e = l.email.toLowerCase();
    if (ULKELER[l.ulke].serbestPostaYok && SERBEST.test(e)) { sk(`serbest-posta:${l.ulke}`); continue; }
    if (ULKELER[l.ulke].sirketSart && !l.sirket) { sk('gb-sirket-kaniti-yok'); continue; }
    const id = satirId(l); if (ids.has(id)) { sk('kuyrukta-var'); continue; }
    const n = Y.neden(e, l); if (n) { sk(n); continue; }
    const kim = leadKimligi(l);
    if (parti.adr.has(e) || (!SERBEST.test(e) && parti.alan.has(dom(e))) || parti.isl.bul(kim)) { sk('partide-tekrar'); continue; }
    const sayfa = `${SAYFA_TABAN}${x.page.replace(/\/?$/, '/')}`;
    // isletme adi (12 Kas 2026): sitenin gorunur adi, sitenin basligi, logo alt metni, OSM adi sirasiyla; bitisik/kucuk harfli ("alexandermotorinn"), "Home | X" gibi bozuk adlar duzgun
    // adayla onarilir, emin olunamiyorsa satir atlanir ('ad-belirsiz'; mail/sablon.mjs mailAdi)
    const ad = mailAdi(x.ad || l.name, adAdaylari(x, l));
    if (!ad) { sk('ad-belirsiz'); continue; }
    // restoran ailesinin yurt disi mail sablonu motorda yok (v5 sesi peak-outreach'te): sablon yoksa satir atlanir, teslim adimi DUSMEZ (RESTORAN_KUYRUK=acik iken eskiden hata verirdi)
    let m; try { m = mailYaz({ sektor: x.sektor || l.sektor, ad, sayfa, fiyatVar: !!x.fiyatVar }); } catch { sk(`mail-sablon-yok:${x.sektor || l.sektor}`); continue; }
    const sorun = mailDenetle({ ...m, ad, sayfa });
    if (dis) sorun.push(...dis({ id, subject: m.konu, body: m.govde, name: ad, pageUrl: sayfa }));
    if (sorun.length) { sk(`mail:${sorun[0].slice(0, 50)}`); continue; }
    const sek = x.sektor || l.sektor; sayac[sek] = (sayac[sek] || 0) + 1;
    const ab = sayac[sek] <= 20 ? (sayac[sek] % 2 ? 'A' : 'B') : 'A';
    const row = { id, to: e, name: ad, campaign: KAMPANYA, region: l.ulke, lang: 'en', segment: `demo-${sek}`, subject: m.konu, body: m.govde, notBefore: new Date(simdi.getTime() + 864e5).toISOString().slice(0, 10) + 'T00:00:00Z' };
    if (ab === 'A') { const rel = `attachments/websites-demo/${id}.jpg`; row.preview = { path: rel, href: sayfa, alt: 'Preview of your new homepage' }; kopyalar.push({ from: x.onizleme, to: rel }); }
    Object.assign(row, { _held: onaylanan.has(sek) ? BEKLET : BEKLET_ILK, _ab: ab, _slug: x.slug, _page: sayfa, _hat: { sektor: sek, parti: x.parti, eklendi: simdi.toISOString() } });
    const biz = bizAlani(kim, l.city); if (biz) row._biz = biz; // hangi isletme: site, telefon, OSM nesnesi, sehir (sonraki kontroller ve peak-outreach okur)
    parti.adr.add(e); if (!SERBEST.test(e)) parti.alan.add(dom(e)); parti.isl.ekle(kim, { id, kampanya: KAMPANYA, durum: 'parti' });
    ids.add(id); satirlar.push(row);
  }
  return { satirlar, kopyalar, atla };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const poDir = path.resolve(arg('--po')); const rd = (f) => (fs.existsSync(path.join(poDir, f)) ? fs.readFileSync(path.join(poDir, f), 'utf8') : '');
  const son = JSON.parse(fs.readFileSync(arg('--son'), 'utf8'));
  const ld = path.resolve(arg('--leads'));
  const leadsById = new Map(); for (const f of fs.readdirSync(ld).filter((x) => x.endsWith('.tarandi.jsonl'))) for (const l of jsonl(fs.readFileSync(path.join(ld, f), 'utf8'))) leadsById.set(l.id, l);
  const { uretimLead } = await import('./uretim.mjs'); for (const l of leadsById.values()) l.slug = uretimLead(l).slug;
  let onay = {}; try { onay = JSON.parse(fs.readFileSync(path.resolve(arg('--onay', 'calisma/veri-depo/durum/onay.json')), 'utf8')); } catch { /* yok */ }
  // peak-outreach'in KENDI denetimi (kampanya kodu mainde ise)
  let dis = null; let validate = null; let checkBody = null;
  try { const L = await import(pathToFileURL(path.join(poDir, 'src', 'lint-websites-demo.mjs')).href); dis = (o) => L.lintDemoText({ id: o.id, lang: 'en', subject: o.subject, body: o.body, rendered: true, name: o.name, pageUrl: o.pageUrl }); } catch { console.log('UYARI: peak-outreach lint-websites-demo.mjs yok (websites-demo kodu mainde degil): satir YAZILMAZ'); if (process.argv.includes('--yaz')) process.exit(3); }
  try { const Q = await import(pathToFileURL(path.join(poDir, 'src', 'queue.mjs')).href); validate = Q.validateRow; checkBody = Q.checkBody; if (!Q.PREVIEW) throw new Error('PREVIEW yok'); } catch (e) { console.log(`UYARI: peak-outreach queue.mjs onizleme desteklemiyor (${e.message}): satir YAZILMAZ`); if (process.argv.includes('--yaz')) process.exit(3); }
  const config = JSON.parse(rd('config.json') || '{"regions":{}}');
  const r = satirlarKur({ son, leadsById, po: { sent: rd('data/sent.jsonl'), queue: rd('data/queue.jsonl'), suppress: rd('suppress.txt'), replied: rd('data/replied.txt') }, onaylanan: new Set(Object.keys(onay).filter((k) => onay[k] && onay[k].onaylandi)), dis });
  const gecer = r.satirlar.filter((row) => { const neden = satirGecerliMi(row, { validate, checkBody, config }); if (neden) { r.atla[neden] = (r.atla[neden] || 0) + 1; return false; } return true; });
  console.log(`kuyruk: ${gecer.length} bekletilen satir hazir (${[...new Set(gecer.map((x) => x.segment))].join(', ') || '-'}); atlanan ${JSON.stringify(r.atla)}`);
  if (process.argv.includes('--yaz') && gecer.length) {
    const ok = new Set(gecer.map((x) => x.id));
    for (const c of r.kopyalar) if (ok.has(path.basename(c.to, '.jpg'))) { const dst = path.join(poDir, c.to); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(c.from, dst); }
    const q = rd('data/queue.jsonl'); fs.writeFileSync(path.join(poDir, 'data', 'queue.jsonl'), `${q && !q.endsWith('\n') ? q + '\n' : q}${gecer.map((x) => JSON.stringify(x)).join('\n')}\n`);
    fs.writeFileSync(path.resolve(arg('--yazilan', 'calisma/son/kuyruk.json')), JSON.stringify(gecer.map((x) => ({ id: x.id, slug: x._slug, sektor: x._hat.sektor, region: x.region, page: x._page, ab: x._ab })), null, 1));
    console.log(`yazildi: ${gecer.length} satir data/queue.jsonl sonuna, ${r.kopyalar.filter((c) => ok.has(path.basename(c.to, '.jpg'))).length} onizleme`);
  }
}
