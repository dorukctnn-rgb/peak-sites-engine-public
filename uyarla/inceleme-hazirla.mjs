// INCELEME HAZIRLA (10 Kas): kapidan "hazir" cikan isletmeler icin model turunun (20'lik gruplar) bakacagi dosyalar.  Tarayici acmaz, ag yok, model yok.
//   node uyarla/inceleme-hazirla.mjs [--region AU,IE,NZ,GB] [--grup 20]
// Her hazir isletme icin <veri>/<slug>/inceleme/{sheet.jpg, bilgi.json}:
//   sheet.jpg  = sayfanin 1440 ilk ekrani + telefon (390) ilk ekrani + sitedeki fotograf kareleri (kimlikleriyle; H = kahramanda kullanilan)
//   bilgi.json = ad, bolge, sitenin kendi sloganlari/paragraflari, sayfadaki slogan ve adaylari, saat (cikarici + sayfa), menu ozeti, kapinin uyarilari, uretici notlari
// Gruplar: <veri>/inceleme-gruplar/grup-NN.json = { slugs: [...] } (bir isletme bir kez bir gruba girer; sirasi sabit kalir).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sharp } from './lib/gorsel.mjs';
import { VERI } from './uret.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (txt, w = 60) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22"><rect width="${w}" height="22" rx="4" fill="#000" fill-opacity="0.78"/><text x="6" y="16" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#fff">${esc(txt)}</text></svg>`);

export function pageText(html) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').split('\n').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

export async function hazirla(slug, { veri = VERI, out } = {}) {
  const dir = path.join(veri, slug); const R = J(path.join(dir, 'cikarici.json')); const U = J(path.join(dir, 'uret.json')); const K = J(path.join(dir, 'kapi.json'));
  const idir = path.join(dir, 'inceleme'); fs.mkdirSync(idir, { recursive: true });
  const heroIds = new Set((U.hero || []).map((h) => String(h).replace(/^p/, '')));
  const W = 1360; const LW = 1000; const MW = 300;
  const first = await sharp(path.join(dir, 'sonra-1440.jpg')).resize({ width: LW }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const mob = await sharp(path.join(dir, 'sonra-390.jpg')).resize({ width: MW }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const comps = [{ input: first.data, left: 10, top: 10 }, { input: mob.data, left: LW + 30, top: 10 }];
  let y = first.info.height + 30; let x = 10; const TH = { w: 156, h: 104 };
  for (const p of R.photos || []) {
    const f = path.join(dir, p.file); if (!fs.existsSync(f)) continue;
    const t = await sharp(f).resize({ width: TH.w, height: TH.h, fit: 'cover' }).jpeg({ quality: 70 }).toBuffer();
    if (x + TH.w > LW + 10) { x = 10; y += TH.h + 12; }
    comps.push({ input: t, left: x, top: y }, { input: label(`${p.id}${heroIds.has(p.id) ? ' H' : ''}`, heroIds.has(p.id) ? 46 : 34), left: x + 4, top: y + 4 });
    x += TH.w + 8;
  }
  const H = Math.max(y + TH.h + 14, mob.info.height + 24);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#2a2a2a' } }).composite(comps).jpeg({ quality: 80 }).toFile(path.join(idir, 'sheet.jpg'));
  const pagePath = out && U.page ? path.join(out, U.page) : null;
  const text = pagePath && fs.existsSync(pagePath) ? pageText(fs.readFileSync(pagePath, 'utf8')).slice(0, 90) : [];
  const comp = (R.colours && R.colours.computed) || {};
  const bilgi = {
    slug, ad: R.name && R.name.n, sektor: R.lead.sektor || 'restoran', bolge: R.lead.region, dil: R.lead.lang, tur: R.lead.kind,
    odalar: R.konaklama ? R.konaklama.odalar.map((o) => ({ ad: o.n, fiyat: o.p, birim: o.per, aciklama: o.d })) : undefined, olanaklar: R.konaklama ? R.konaklama.olanak : undefined, giris_cikis: R.konaklama ? R.konaklama.giris : undefined, rezervasyon_motoru: R.konaklama && R.konaklama.motor ? R.konaklama.motor.motor || R.konaklama.motor.url : undefined, hizmetler: R.guzellik ? ((R.menu && R.menu.items) || []).slice(0, 24).map((i) => ({ ad: i.n, fiyat: i.p, grup: i.cat })) : undefined, randevu_motoru: R.guzellik && R.guzellik.motor ? R.guzellik.motor.motor || R.guzellik.motor.url : undefined, kategori: R.lead.category, site: R.lead.site, sayfa: U.page,
    sayfadaki_slogan: U.slogan, sitenin_kendisi: { og_title: R.slogan && R.slogan.ogTitle, title: R.slogan && R.slogan.title, aciklama: R.slogan && R.slogan.desc, h1: comp.h1 && comp.h1.text, h2: comp.h2 && comp.h2.text, slogan_adaylari: ((R.slogan && R.slogan.cands) || []).slice(0, 14).map((c) => c.t), paragraflar: ((R.ek && R.ek.paragraflar) || []).slice(0, 5) },
    saat: { cikarici: R.hours ? { known: R.hours.known, tableOk: R.hours.tableOk, week: R.hours.week, byDay: R.hours.byDay } : null, sayfada_gosterilen: { hoursOk: U.hoursOk, hoursIssue: U.hoursIssue, statusOk: U.statusOk, not: U.hoursNote } },
    menu: { kalem: U.menuItems, gruplar: U.menuGroups, baglanti: U.menuLink }, fotograflar: (R.photos || []).map((p) => ({ id: p.id, w: p.w, h: p.h, alt: p.alt, kahramanda: heroIds.has(p.id) })), kahraman: U.hero, telefon: !!R.phone, adres: R.address && R.address.text, rezervasyon_baglantisi: !!R.reservation,
    kapi_uyarilari: K.warnings, uretici_notlari: U.notes, logo: U.logo ? { dosya: U.logo.file, boyut: `${U.logo.w}x${U.logo.h}`, dusuk_cozunurluk: U.logo.dusuk } : null, sayfa_metni: text,
  };
  fs.writeFileSync(path.join(idir, 'bilgi.json'), JSON.stringify(bilgi, null, 1));
  return { slug, sheet: path.join(idir, 'sheet.jpg') };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
if (isMain) {
  const { DEMO } = await import('./uret.mjs');
  const regions = arg('--region', 'AU,IE,NZ,GB').split(',');
  const per = Number(arg('--grup', 20));
  const gdir = path.join(VERI, 'inceleme-gruplar'); fs.mkdirSync(gdir, { recursive: true });
  const taken = new Set(); const files = fs.readdirSync(gdir).filter((f) => /^grup-\d+\.json$/.test(f)).sort();
  for (const f of files) for (const s of J(path.join(gdir, f)).slugs) taken.add(s);
  const ready = fs.readdirSync(VERI).filter((s) => { const k = path.join(VERI, s, 'kapi.json'); if (!fs.existsSync(k)) return false; const K = J(k); return K.status === 'hazir' && K.gen >= 4 && regions.includes(K.region) && !taken.has(s); }).sort();
  const fresh = [];
  for (const s of ready) { try { await hazirla(s, { out: DEMO }); fresh.push(s); } catch (e) { console.log(`${s}: HATA ${e.message}`); } }
  // tamamlanmamis son grup varsa doldur, sonra yeni gruplar ac (yalniz tam 20'lik gruplar acilir; kalan, --son ile kapatilir)
  let n = files.length; const flush = process.argv.includes('--son');
  while (fresh.length >= per || (flush && fresh.length)) { n++; const g = fresh.splice(0, per); fs.writeFileSync(path.join(gdir, `grup-${String(n).padStart(2, '0')}.json`), JSON.stringify({ slugs: g }, null, 1)); console.log(`grup-${String(n).padStart(2, '0')}: ${g.length} isletme`); }
  console.log(`hazirlanan ${ready.length}, gruba girmeyen bekleyen ${fresh.length}`);
}
