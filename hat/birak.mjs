// HAT 5. ADIM: BEKLETILEN SATIRLARI ISINMA TAKVIMIYLE SERBEST BIRAK + OTOMATIK DURDUR (peak-outreach, kampanya websites-demo).
//   node hat/birak.mjs --po <peak-outreach klonu> [--depo <veri deposu>] [--yaz] [--simdi ISO] [--canli-kontrol]
// KURALLAR
//  - Bir sektorun satirlari ancak koordinator o sektorun 5 sayfasini gozle onaylayinca (depo/durum/onay.json: { "<sektor>": { "onaylandi": true, "kim": "...", "zaman": "..." } }) acilir.
//  - Isinma: gunluk toplam (websites-demo'nun TUM satirlari, restoran dahil) 20 -> 40 -> 65; bir ust basamaga yalniz onceki gonderim gunlerinin sekme orani %3'un altindaysa cikilir.
//    65 = hesap butcesinin websites 'abroad' grubu (config.json campaign_caps.websites.groups.abroad.daily_cap); fazlasini gondermeyi motor zaten reddeder.
//  - OTOMATIK DURDURMA: son 3 gonderim gununde (en az 15 deneme) sekme orani > %3, ya da son 7 gunde bir sikayet (suppress.txt: complaint / marked as spam / spam report) varsa
//    hattin acik ama gonderilmemis butun satirlari yeniden bekletilir (WH-); durum/DURDU.json yazilir; kendiliginden DEVAM ETMEZ (koordinator DURDU.json'u siler ve onay.json'a "devam": true yazar).
//  - Gonderilmis ya da gonderimi suren (pending) satirlara, susturulanlara ve cevap verenlere dokunulmaz; sayfa canli degilse (200 + noindex) o satir acilmaz.
// Hicbir yerde e-posta adresi ekrana basilmaz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const KAMPANYA = 'websites-demo';
export const KOTA = [20, 40, 65];
export const ESIK = 0.03; export const MIN_DENEME = 15;
const COMPLAINT = /complain|marked (?:it |us |as )*spam|spam report|abuse report|reported (?:it |us |as )*spam/i;
const DENEME = new Set(['sent', 'uncertain', 'rejected']);
const gunKodu = (d) => (typeof d === 'string' ? d : d.toISOString()).slice(0, 10);
const jsonl = (t) => String(t || '').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// sent.jsonl + suppress.txt -> { gunler: [{ gun, deneme, sekme }], sikayet7 }  (kampanya: websites-demo, tum satirlar)
export function istatistik({ sentRows, suppressText = '', simdi = new Date() }) {
  const son = new Map(); // id -> son durum satiri (pending sonra sent/rejected)
  for (const r of sentRows) if (r.campaign === KAMPANYA && (DENEME.has(r.status) || r.status === 'pending')) { const o = son.get(r.id); if (!o || DENEME.has(r.status) || !DENEME.has(o.status)) son.set(r.id, r); }
  const gunler = new Map(); const idGun = new Map();
  for (const r of son.values()) {
    if (!DENEME.has(r.status)) continue;
    const g = gunKodu(r.ts); const e = gunler.get(g) || { gun: g, deneme: 0, sekme: 0 };
    e.deneme++; if (r.status === 'rejected') e.sekme++; gunler.set(g, e); idGun.set(r.id, g);
  }
  let sikayet7 = 0; const sayilan = new Set(); const yediGunOnce = simdi.getTime() - 7 * 864e5;
  for (const satir of String(suppressText).split('\n')) {
    const t = satir.trim(); if (!t.startsWith('#')) continue;
    const m = /^#\s*(\d{4}-\d{2}-\d{2})\b/.exec(t); const ids = t.match(/\b(?:WD|WH)-[A-Za-z0-9-]+\b/g) || [];
    if (COMPLAINT.test(t) && m && new Date(m[1]).getTime() >= yediGunOnce && (ids.length || !/\b[A-Z]{1,3}-[A-Z0-9-]+\b/.test(t))) sikayet7++;
    if (/late bounce/i.test(t) && ids.length) for (const id of ids) { const g = idGun.get(id); if (g && !sayilan.has(id)) { sayilan.add(id); gunler.get(g).sekme++; } }
  }
  return { gunler: [...gunler.values()].sort((a, b) => a.gun.localeCompare(b.gun)), sikayet7 };
}

// -> { durak: '' | neden, hedef, kademe, gonderimGunu }
export function karar({ istat, simdi = new Date() }) {
  const bugun = gunKodu(simdi);
  const gecmis = istat.gunler.filter((g) => g.gun < bugun && g.deneme >= 10); // gonderim gunu sayilmak icin >= 10 deneme
  const son3 = gecmis.slice(-3); const d = son3.reduce((s, g) => s + g.deneme, 0); const b = son3.reduce((s, g) => s + g.sekme, 0);
  let durak = '';
  if (istat.sikayet7 > 0) durak = `son 7 gunde ${istat.sikayet7} sikayet`;
  else if (d >= MIN_DENEME && b / d > ESIK) durak = `sekme orani %${(100 * b / d).toFixed(1)} (${b}/${d}, son ${son3.length} gonderim gunu) > %${ESIK * 100}`;
  let kademe = 0; for (let i = gecmis.length - 1; i >= 0 && gecmis[i].sekme / gecmis[i].deneme < ESIK; i--) kademe++; // sondan geriye ust uste temiz gonderim gunleri
  kademe = Math.min(kademe, KOTA.length - 1);
  return { durak, hedef: KOTA[kademe], kademe, gonderimGunu: gecmis.length };
}

// bugun (UTC) zaten giden/gidecek: bugunun denemeleri + acik (bekletilmeyen) gonderilmemis websites-demo satirlari
export function bugunKullanilan({ sentRows, queueRows, simdi }) {
  const bugun = gunKodu(simdi); const gonderilen = new Set(sentRows.filter((r) => DENEME.has(r.status) || r.status === 'pending').map((r) => r.id));
  const ids = new Set(sentRows.filter((r) => r.campaign === KAMPANYA && gunKodu(r.ts) === bugun && (DENEME.has(r.status) || r.status === 'pending')).map((r) => r.id));
  const acik = queueRows.filter((r) => r.campaign === KAMPANYA && !r._held && !gonderilen.has(r.id)).length;
  return ids.size + acik;
}

export function yenidenBeklet(queueText, neden, simdi, sentRows) {
  const gonderilen = new Set(sentRows.filter((r) => DENEME.has(r.status) || r.status === 'pending').map((r) => r.id));
  let n = 0;
  const lines = queueText.split('\n').map((line) => {
    if (!line.trim()) return line;
    let row; try { row = JSON.parse(line); } catch { return line; }
    if (row.campaign !== KAMPANYA || !String(row.id).startsWith('WH-') || row._held || gonderilen.has(row.id)) return line;
    n++; return JSON.stringify({ ...row, _held: `hat: otomatik durdu: ${neden}`, _durdu: simdi.toISOString() });
  });
  return { text: lines.join('\n'), n };
}

// bekletilen WH- satirlarini serbest birakmak icin sec: onayli sektor, bekletilmis, sirayla
export function adaylariSec({ queueRows, onay }) {
  return queueRows.filter((r) => r.campaign === KAMPANYA && String(r.id).startsWith('WH-') && r._held && r._hat && onay[r._hat.sektor] && onay[r._hat.sektor].onaylandi).map((r) => r.id);
}

export async function birakCalis({ po, depo = null, yaz = false, simdi = new Date(), canliKontrol = false, log = console.log }) {
  const rd = (f) => (fs.existsSync(path.join(po, f)) ? fs.readFileSync(path.join(po, f), 'utf8') : '');
  const sentRows = jsonl(rd('data/sent.jsonl')); const queueText = rd('data/queue.jsonl'); const queueRows = jsonl(queueText);
  const onay = depo && fs.existsSync(path.join(depo, 'durum', 'onay.json')) ? JSON.parse(fs.readFileSync(path.join(depo, 'durum', 'onay.json'), 'utf8')) : {};
  const durduF = depo ? path.join(depo, 'durum', 'DURDU.json') : null;
  const istat = istatistik({ sentRows, suppressText: rd('suppress.txt'), simdi });
  const k = karar({ istat, simdi });
  const rapor = { zaman: simdi.toISOString(), hedef: k.hedef, kademe: k.kademe, gonderimGunu: k.gonderimGunu, son7sikayet: istat.sikayet7, durak: '', birakilan: 0, bekleyen: 0, atlanan: {}, yenidenBekletilen: 0 };
  const yazDosya = (f, t) => { if (yaz) fs.writeFileSync(path.join(po, f), t); };
  let neden = k.durak;
  if (!neden && durduF && fs.existsSync(durduF)) neden = `DURDU.json var (${JSON.parse(fs.readFileSync(durduF, 'utf8')).neden || 'elle'}); koordinator silene kadar acilmaz`;
  if (neden) {
    rapor.durak = neden; const r = yenidenBeklet(queueText, neden, simdi, sentRows); rapor.yenidenBekletilen = r.n;
    if (r.n) yazDosya('data/queue.jsonl', r.text);
    if (durduF && k.durak && yaz) { fs.mkdirSync(path.dirname(durduF), { recursive: true }); fs.writeFileSync(durduF, JSON.stringify({ zaman: simdi.toISOString(), neden: k.durak, istatistik: istat.gunler.slice(-5) }, null, 1)); }
    log(`DURAK: ${neden}; yeniden bekletilen ${r.n}`);
  } else {
    const kullanilan = bugunKullanilan({ sentRows, queueRows, simdi }); const kalan = Math.max(0, k.hedef - kullanilan);
    const adaylar = adaylariSec({ queueRows, onay }); rapor.bekleyen = adaylar.length;
    if (kalan > 0 && adaylar.length) {
      const Rel = await import(pathToFileURL(path.join(po, 'src', 'release-websites-demo.mjs')).href);
      const config = JSON.parse(rd('config.json') || '{"regions":{}}');
      const { chosen, skipped } = await Rel.chooseRelease({ queueText, sentRows, suppressText: rd('suppress.txt'), repliedText: rd('data/replied.txt'), config, first: kalan, ids: adaylar, readFile: (p) => fs.readFileSync(path.join(po, p)), fetchPage: canliKontrol ? Rel.livePage : null });
      rapor.atlanan = skipped; rapor.birakilan = chosen.length;
      if (chosen.length) yazDosya('data/queue.jsonl', Rel.applyRelease(queueText, chosen, simdi.toISOString()));
    }
    log(`hedef ${k.hedef}/gun (kademe ${k.kademe + 1}), bugun kullanilan ${kullanilan}, bekleyen onayli ${adaylar.length}, birakilan ${rapor.birakilan}${Object.keys(rapor.atlanan).length ? ` atlanan ${JSON.stringify(rapor.atlanan)}` : ''}`);
  }
  if (depo) { fs.mkdirSync(path.join(depo, 'durum'), { recursive: true }); fs.writeFileSync(path.join(depo, 'durum', 'birak.json'), JSON.stringify({ ...rapor, gunler: istat.gunler.slice(-7) }, null, 1)); }
  return rapor;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  if (!arg('--po')) { console.error('kullanim: node hat/birak.mjs --po <peak-outreach klonu> [--depo <dir>] [--yaz] [--canli-kontrol]'); process.exit(2); }
  const r = await birakCalis({ po: path.resolve(arg('--po')), depo: arg('--depo') ? path.resolve(arg('--depo')) : null, yaz: process.argv.includes('--yaz'), simdi: arg('--simdi') ? new Date(arg('--simdi')) : new Date(), canliKontrol: process.argv.includes('--canli-kontrol') });
  process.exit(r.durak ? 20 : 0); // 20 = durduruldu (is akisi bunu rapor eder)
}
