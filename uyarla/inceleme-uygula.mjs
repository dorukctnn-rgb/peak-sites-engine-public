// INCELEME UYGULA (10 Kas): model turunun yazdigi <veri>/<slug>/inceleme/karar.json dosyalarini uretime baglar.  Model yok, ag yok (--uret tarayici acar).
//   node uyarla/inceleme-uygula.mjs            -> data/elle/toplu-inceleme.json yazilir (slogan, haric, hero, rez, saat), degisen slug'lar listelenir
//   node uyarla/inceleme-uygula.mjs --uret     -> degisen isletmelerde uret + kapi (--force) yeniden kosar (tek tarayici; toplu.mjs calismiyorken)
//   node uyarla/inceleme-uygula.mjs --liste    -> liste-son.json + LISTE-SON.md + onizleme JPEG'leri (yalniz kapi hazir VE inceleme hazir olanlar)
// Kural: bir isletme maile ancak kapi.status === 'hazir' VE karar.karar === 'hazir' ise girer.  Karari olmayan isletme "inceleme bekliyor"dur ve girmez.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sharp } from './lib/gorsel.mjs';
import { sloganDogrula } from './lib/slogan.mjs';
import { VERI, DEMO, pageDir, titleCase } from './uret.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ELLE_DOSYA = path.join(HERE, 'data', 'elle', 'toplu-inceleme.json');
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const ID2 = /^\d{2}$/;

// karar.json -> { ok, why, elle } (elle = uret.mjs'in ELLE kaydi)
export function kararToElle(k, { name, photoIds }) {
  const bad = (why) => ({ ok: false, why });
  if (!k || typeof k !== 'object') return bad('karar.json bozuk');
  if (!['hazir', 'gozden-gecir', 'elendi'].includes(k.karar)) return bad(`karar gecersiz: ${k.karar}`);
  const elle = {};
  const ids = (a) => (Array.isArray(a) ? a.map(String) : []);
  if (k.karar === 'hazir') {
    const s = k.slogan || {};
    if (s.mod === 'degistir') {
      if (!Array.isArray(s.aday) || s.aday.length < 1 || s.aday.some((a) => !a || typeof a.text !== 'string')) return bad('slogan.aday gecersiz');
      const sec = Number.isInteger(s.sec) ? s.sec : 0;
      if (!s.aday[sec]) return bad('slogan.sec adayi yok');
      const red = sloganDogrula(s.aday[sec].text, name); if (red) return bad(`secilen slogan reddedildi: ${red}`);
      elle.sec = sec; elle.aday = s.aday.map((a) => ({ text: a.text, kaynak: a.kaynak || 'inceleme turu' })); elle.neden = s.neden || k.neden || '';
    } else if (s.mod !== 'koru') return bad('slogan.mod koru ya da degistir olmali');
    const h = ids(k.haric); const hero = ids(k.hero);
    for (const i of [...h, ...hero, ...(k.rez ? [String(k.rez)] : [])]) if (!ID2.test(i) || (photoIds && !photoIds.includes(i))) return bad(`fotograf kimligi gecersiz: ${i}`);
    if (h.length) elle.haric = h;
    if (hero.length >= 2) elle.hero = hero.filter((i) => !h.includes(i));
    if (k.rez && !h.includes(String(k.rez))) elle.rez = String(k.rez);
    if (k.saat && Array.isArray(k.saat.satirlar) && k.saat.satirlar.length) elle.saat = { satirlar: k.saat.satirlar.map(String), not: k.saat.not || '', sonRez: k.saat.sonRez || undefined, kaynak: k.saat.kaynak || 'inceleme turu' };
    if (photoIds && photoIds.length - h.length < 3) return bad('haric sonrasi 3 fotografdan az kalir');
  }
  return { ok: true, elle: Object.keys(elle).length ? elle : null };
}

export function karariTopla(veri = VERI) {
  const out = [];
  for (const s of fs.readdirSync(veri)) {
    const kf = path.join(veri, s, 'inceleme', 'karar.json'); const cf = path.join(veri, s, 'cikarici.json');
    if (!fs.existsSync(kf) || !fs.existsSync(cf)) continue;
    let k; try { k = J(kf); } catch { out.push({ slug: s, karar: null, hata: 'karar.json okunamadi' }); continue; }
    const R = J(cf); const name = R.name && R.name.n;
    const r = kararToElle(k, { name, photoIds: (R.photos || []).map((p) => p.id) });
    out.push({ slug: s, karar: r.ok ? k.karar : null, hata: r.ok ? null : r.why, neden: k.neden || '', elle: r.ok ? r.elle : null, k });
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const all = karariTopla();
  const elle = {}; for (const x of all) if (x.elle) elle[x.slug] = x.elle;
  const eskiMetin = fs.existsSync(ELLE_DOSYA) ? fs.readFileSync(ELLE_DOSYA, 'utf8') : '{}';
  const eski = JSON.parse(eskiMetin);
  const yeni = { _not: 'inceleme-uygula.mjs tarafindan karar.json dosyalarindan uretilir; elle duzenleme: karar.json\'u degistirip yeniden calistir.', ...elle };
  const degisen = Object.keys(elle).filter((s) => JSON.stringify(eski[s]) !== JSON.stringify(elle[s]));
  fs.mkdirSync(path.dirname(ELLE_DOSYA), { recursive: true });
  fs.writeFileSync(ELLE_DOSYA, JSON.stringify(yeni, null, 1));
  const hatali = all.filter((x) => x.hata);
  console.log(`karar ${all.length} (hazir ${all.filter((x) => x.karar === 'hazir').length}, gozden ${all.filter((x) => x.karar === 'gozden-gecir').length}, elendi ${all.filter((x) => x.karar === 'elendi').length}); elle kaydi ${Object.keys(elle).length}, degisen ${degisen.length}; HATALI ${hatali.length}`);
  for (const h of hatali) console.log(`  HATALI ${h.slug}: ${h.hata}`);

  if (process.argv.includes('--uret')) {
    const { openBrowser } = await import('./lib/ziyaret.mjs'); const { sunucu } = await import('./lib/sunucu.mjs');
    const { uret } = await import('./uret.mjs'); const { kapi } = await import('./kapi.mjs');
    const hash = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 12);
    const uygulandi = (s) => { try { return J(path.join(VERI, s, 'inceleme', 'uygulandi.json')).elle; } catch { return null; } };
    const uniq = Object.keys(elle).filter((s) => process.argv.includes('--hepsi') || uygulandi(s) !== hash(elle[s]));
    const srv = await sunucu(DEMO); const browser = uniq.length ? await openBrowser() : null;
    try {
      for (const s of uniq) {
        try {
          await uret(s, { out: DEMO, log: () => {} });
          fs.rmSync(path.join(VERI, s, 'kapi.json'), { force: true });
          const k = await kapi(s, { browser, base: srv.url, out: DEMO, log: () => {} });
          const kf = path.join(VERI, s, 'kapi.json'); const kj = J(kf); kj.gen = 4; kj.inceleme = true; fs.writeFileSync(kf, JSON.stringify(kj, null, 1));
          for (const f of fs.readdirSync(path.join(VERI, s))) if (/-tam\.jpg$|sonra-1920\.jpg$/.test(f)) fs.rmSync(path.join(VERI, s, f), { force: true });
          fs.writeFileSync(path.join(VERI, s, 'inceleme', 'uygulandi.json'), JSON.stringify({ at: new Date().toISOString(), kapi: k.status, elle: hash(elle[s]) }));
          console.log(`${s.padEnd(34)} kapi ${k.status}${k.reasons.length ? ' <- ' + k.reasons.slice(0, 2).join(' ; ').slice(0, 140) : ''}`);
        } catch (e) { console.log(`${s}: HATA ${String(e.message).slice(0, 140)}`); }
      }
    } finally { if (browser) await browser.close(); await srv.close(); }
  }

  if (process.argv.includes('--liste')) {
    const rows = []; const non = [];
    for (const x of all) {
      const d = path.join(VERI, x.slug); const K = J(path.join(d, 'kapi.json')); const R = J(path.join(d, 'cikarici.json')); const U = fs.existsSync(path.join(d, 'uret.json')) ? J(path.join(d, 'uret.json')) : null;
      const bolge = R.lead.region;
      if (K.status === 'hazir' && x.karar === 'hazir' && U) {
        const src = path.join(d, 'sonra-1440.jpg'); const dst = path.join(d, 'onizleme.jpg');
        await sharp(src).resize({ width: 720 }).jpeg({ quality: 80, mozjpeg: true }).toFile(dst);
        rows.push({ id: R.lead.id, slug: x.slug, name: titleCase(R.name.n, R.lead.lang), lang: R.lead.lang, region: bolge, site: R.lead.site, page: `${pageDir(x.slug)}/`, preview: dst, slogan: U.slogan && U.slogan.text });
      } else non.push({ slug: x.slug, ad: R.name && R.name.n, bolge, kapi: K.status, karar: x.karar, neden: x.hata || x.neden || (K.reasons || []).join('; ') });
    }
    fs.writeFileSync(path.join(VERI, 'liste-son.json'), JSON.stringify(rows, null, 1));
    const md = [`# Son liste (inceleme sonrasi)`, '', `Hazir: ${rows.length} · hazir olmayan (inceleme sonucu): ${non.length}`, '', '## Hazir', ...rows.map((r) => `- ${r.name} (${r.region}) ${r.page} — "${r.slogan}"`), '', '## Hazir degil', ...non.map((r) => `- ${r.ad || r.slug} (${r.bolge}): kapi ${r.kapi}, karar ${r.karar}: ${r.neden}`), ''];
    fs.writeFileSync(path.join(VERI, 'LISTE-SON.md'), md.join('\n'));
    console.log(`liste-son.json: ${rows.length} hazir; hazir olmayan ${non.length}`);
  }
}
