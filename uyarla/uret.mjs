// 3. ADIM: URETICI.  node uyarla/uret.mjs <slug,...|hepsi> [--out <web/demo klasoru>]
// Bir isletmenin cikarici.json'undan (kendi fotograflari, logosu, renkleri, fontu, menusu, saati) "sahne" duzeninde bir sayfa uretir.
// Dil modeli yok, kota yok: sablon + kural.  Ilke: isletmenin KENDI konsepti, belirgin bicimde daha iyi.
//   - LOGO: orijinal dosya bayt bayt aynen (renk, filtre, kirpma, germe yok); baslik zemini logoya uyar, logo zemine degil.
//   - BASLIK: slogan (isletme adini asla tekrar etmez).  Sira: elle secilmis (data/slogan-elle.json) > kendi slogani > gercek veriden sablon.
//   - PALET: kendi hesaplanmis renkleri; logonun rengi capa; zayif cift iyilestirilir ve not dusulur (lib/marka.mjs).
//   - HAREKET: kendi fotograflarindan WebGL derinlik/paralaks kahraman, shader gecisleri, kaydirmaya bagli sahne, 3D egilen kartlar, acilis.
//     Hepsi istege bagli katman: WebGL yoksa / hareket azaltilmissa / zayif cihazda sayfa ayni icerikle duragan calisir.
// Cikti: <out>/r/<slug>-<kod>/{index.html, theme.css, img/}  +  ortak <out>/_uyarla/{site.css, page.js, sahne.js, fonts/, CREDITS.txt}.  Sayfalar noindex'tir.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sharp, lin } from './lib/gorsel.mjs';
import { fontEslestir, fontDosyalari, fontFaceCss, dosyaAdi, FALLBACK } from './lib/font.mjs';
import { renkPaleti, kontrastKontrol, paletteOk, contrast } from './lib/renk.mjs';
import { markaPaleti, paletSadakati } from './lib/marka.mjs';
import { saatDenetle, parseSaatler } from './lib/saat.mjs';
import { T, KIND, saatTablo, saatOzet, fmtPrice, telHref, telText, mapsUrl, tzOf, cityLabel } from './lib/metin.mjs';
import { themeCss, sayfaHtml } from './lib/sayfa.mjs';
import { sloganSec, sloganDogrula, sloganParcalari, sloganlaOrtusur, gerceklikler, iddiaVar, ascii, adresParcala } from './lib/slogan.mjs';
import { logoPiksel, gorunurOran, logoBoyut, dusukCozunurluk, lumHex } from './lib/logo.mjs';
import { derinlik } from './lib/derinlik.mjs';
import { profil } from './sektor/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export { VERI } from './lib/yol.mjs';
import { VERI } from './lib/yol.mjs';
export { DEMO } from './lib/yol.mjs';
import { DEMO, ORTAK } from './lib/yol.mjs';
import { yasakVar } from './lib/sozluk.mjs';
// sayfa kodu: depo herkese acik olabilir, bu yuzden bulutta gizli bir tuzla (SAYFA_TUZU, GitHub Secret) hesaplanir; adres isletme adindan tahmin edilemez.
// Tuz yoksa (yerel deneme) restoran turunun eski kurali.  Tuz DEGISMEMELI: degisirse eski maillerdeki sayfa adresleri tutmaz.
const TUZ = process.env.SAYFA_TUZU || 'peak-uyarla';
export const kod = (slug) => crypto.createHash('sha1').update(`${TUZ}:${slug}`).digest('hex').slice(0, TUZ === 'peak-uyarla' ? 6 : 10);
export const pageDir = (slug) => `r/${slug}-${kod(slug)}`;
export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// elle kayitlar: data/slogan-elle.json (3 ornek) + data/elle/*.json (toplu inceleme turu; her grup ayri dosya, ayni slug'da sonraki dosya kazanir)
function elleYukle() {
  let o = {}; try { o = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'slogan-elle.json'), 'utf8')); } catch { /* yok */ }
  const d = path.join(HERE, 'data', 'elle');
  try { for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort()) { try { Object.assign(o, JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))); } catch { /* bozuk dosya yoksayilir */ } } } catch { /* klasor yok */ }
  return o;
}

const TF12 = new Set(['AU', 'NZ', 'US', 'CA', 'SG']);
// 12 saatlik yazim: 9 am, 7:30 pm; kapanis gece yarisiysa "midnight"
const to12 = (txt) => txt.replace(/(\d{1,2}):(\d{2})/g, (m, h, mi) => { let H = Number(h) % 24; const ap = H >= 12 ? 'pm' : 'am'; H = H % 12 || 12; return mi === '00' ? `${H} ${ap}` : `${H}:${mi} ${ap}`; }).replace(/([–-]\s?)12 am/g, '$1midnight').replace(/\b12 pm\b/g, 'noon').replace(/(\d|m|n)–(\d|midnight|noon)/g, '$1 – $2');
const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hh = (m) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function titleCase(s, lang) {
  const loc = lang === 'tr' ? 'tr' : 'en';
  let w = clean(s);
  if (lang !== 'tr') w = w.replace(/ı/g, 'i').replace(/İ/g, 'I'); // Ingilizce metinde Turkce noktasiz i olmaz (eski cikarma hatasi)
  if (w.length < 3 || w !== w.toLocaleUpperCase(loc) || !/\p{L}{3}/u.test(w)) return w;
  return w.toLocaleLowerCase(loc).replace(/(^|[\s&/(+-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase(loc));
}
const TR_CAT = { restaurant: 'Restoran', bar: 'Bar', cafe: 'Kafe', café: 'Kafe', 'coffee shop': 'Kafe', bakery: 'Fırın', 'pizza restaurant': 'Pizza restoranı', 'turkish restaurant': 'Türk restoranı', 'kebab shop': 'Kebapçı', 'fast food restaurant': 'Fast food restoranı', 'cocktail bar': 'Kokteyl bar', 'breakfast restaurant': 'Kahvaltı restoranı', 'seafood restaurant': 'Deniz ürünleri restoranı', 'steak house': 'Et restoranı', 'hamburger restaurant': 'Burger restoranı', 'meat dish restaurant': 'Et restoranı', 'dessert shop': 'Tatlıcı' };
// ust etiket: ne + nerede (semt, sehir).  Ad burada da yazilmaz.
function eyebrowOf(R, lang, f) {
  const lead = R.lead; const kind = lead.kind || 'restaurant'; let cat = clean(lead.category);
  if (lang === 'tr') {
    if (f.dish && f.dish2) cat = `${f.dish.tr} ve ${f.dish2.tr}`;
    else cat = TR_CAT[cat.toLowerCase()] || (/[A-Za-z]/.test(cat) && /^[\x20-\x7e]+$/.test(cat) ? '' : cat);
  } else if (f.kindPhrase && f.kindPhrase.length <= 26) cat = f.kindPhrase;
  if (!cat || cat.length > 34) cat = KIND[lang][kind] || KIND[lang].restaurant;
  cat = cat.charAt(0).toLocaleUpperCase(lang === 'tr' ? 'tr' : 'en') + cat.slice(1);
  const city = cityLabel(lead.city, lang);
  const area = f.area && ascii(f.area) !== ascii(city || '') && f.area.length <= 18 && !/\d/.test(f.area) ? f.area : null;
  return [cat, [area, city].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
}
const JUNK = /\b(hidden article|just another|wordpress|lorem ipsum|coming soon|under construction|sample page|page not found|untitled|default (tagline|description)|your (site|website) (tagline|description)|powered by|all rights reserved|copyright|cookie)\b/i;
const CTA = /\b(view our|visit our|click|learn more|read more|check out|see our|call us|book (now|online)|contact us|sign up|subscribe|follow us|order now|more info|bekleriz|davetlisiniz)\b/i;
function sentences(t) { return (clean(t).match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || []).map((x) => x.trim()).filter(Boolean); }
export function ledeOf(tag) {
  const S = sentences(tag).filter((s) => !CTA.test(s) && !JUNK.test(s) && s.length >= 25 && s.trim().split(/\s+/).length >= 4 && !/https?:|www\.|@/.test(s));
  if (!S.length) return { lede: '', about: '' };
  let lede = S[0];
  if (lede.length > 170) lede = lede.slice(0, 167).replace(/[\s,;:]+\S*$/, '') + '…';
  const about = S[1] && S[1].length <= 200 ? S[1] : '';
  return { lede, about };
}
// isletmenin KENDI paragraflarindan tam cumleler (alinti, saat/adres, iddia, cagri cumleleri elenir)
export function kendiCumleleri(R) {
  const out = [];
  for (const p of (R.ek && R.ek.paragraflar) || []) {
    if (/^["“”'‘]/.test(p) || /\d{1,2}\s?(am|pm)\b|\d{1,2}[:.]\d{2}/i.test(p)) continue;
    const S = sentences(p).filter((s) => /[.!?…]$/.test(s));
    const good = S.map((s) => ({ s, ok: !CTA.test(s) && !JUNK.test(s) && !iddiaVar(s) && !/[$€£₺]\s?\d|!$/.test(s) && s.split(/\s+/).length >= 7 && s.length <= 240 }));
    out.push(good);
  }
  return out;
}
// hikaye metni: ayni paragraftan art arda 1-2 iyi cumle, toplam 12-42 soz
export function hikayeSec(R, { lede = '' } = {}) {
  for (const para of kendiCumleleri(R)) {
    for (let i = 0; i < para.length; i++) {
      if (!para[i].ok || para[i].s === lede) continue;
      let txt = para[i].s; let n = txt.split(/\s+/).length;
      if (para[i + 1] && para[i + 1].ok && n + para[i + 1].s.split(/\s+/).length <= 42) { txt += ` ${para[i + 1].s}`; n = txt.split(/\s+/).length; }
      if (n >= 12 && n <= 42) return txt;
    }
  }
  return '';
}

async function toFile(buf, file, w, q) {
  const o = await sharp(buf, { limitInputPixels: 80e6, animated: false }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(file, o.data);
  return { w: o.info.width, h: o.info.height, kb: Math.round(o.data.length / 1024), buf: o.data };
}
// foto altinda yazi okunurlugu icin: alt yarinin p90 parlakligi (dogrusal)
async function p90Alt(buf) {
  const o = await sharp(buf).resize({ width: 96 }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = o.info.width; const h = o.info.height; const vals = [];
  for (let y = Math.floor(h * 0.45); y < h; y++) for (let x = 0; x < w; x++) vals.push(lin(o.data[y * w + x]));
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length * 0.9)] || 0;
}
// ayni karenin farkli kirpimi mi: genislige gore sabit orta bandin 16x8 fark ozeti
async function bantOzeti(buf) {
  const m = await sharp(buf).metadata(); const bw = Math.round(m.width * 0.6); const bh = Math.min(m.height, Math.round(bw / 2.4));
  const o = await sharp(buf).extract({ left: Math.round((m.width - bw) / 2), top: Math.round((m.height - bh) / 2), width: bw, height: bh }).greyscale().resize(17, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = ''; for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) bits += o[y * 17 + x] > o[y * 17 + x + 1] ? '1' : '0';
  return bits;
}
// kaba renk ozeti (4x4x4 histogram): ayni sahnenin farkli yakinliktaki kareleri birbirine benzer cikar
async function renkOzeti(buf) {
  const o = await sharp(buf).resize(48, 48, { fit: 'fill' }).removeAlpha().raw().toBuffer(); const h = new Float32Array(64);
  for (let i = 0; i < o.length; i += 3) h[(o[i] >> 6) * 16 + (o[i + 1] >> 6) * 4 + (o[i + 2] >> 6)]++;
  const n = o.length / 3; return h.map((v) => v / n);
}
const benzer = (a, b) => { let t = 0; for (let i = 0; i < 64; i++) t += Math.min(a[i], b[i]); return t; };
const ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
const normUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/[?#].*$/, '').toLowerCase();
const mixHex = (a, b, t) => { const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)); const B = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)); return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`; };
const hex6 = (h) => (/^#[0-9a-f]{6}$/i.test(String(h || '')) ? String(h).toLowerCase() : null);

// ---- LOGO: orijinal dosya aynen; hangi surum, hangi zemin, hangi boyut ----
export async function logoKur(R, dir, imgDir, t, { shade } = {}) {
  const L = R.logo; if (!L || !L.orig || !L.orig.file) return null;
  const alt = L.altAdaylar || [];
  const shownOf = (url) => alt.filter((a) => normUrl(a.url) === normUrl(url) && a.rw > 0);
  const stop = new Set(['logo', 'black', 'white', 'high', 'resolution', 'dark', 'light', 'images', 'image', 'copy', 'final']);
  const toks = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !stop.has(w));
  const own = new Set([...toks(path.basename(normUrl(L.orig.url)).replace(/\.[a-z0-9]+$/, '')), ...toks(R.slug || ''), ...toks((R.name && R.name.n) || '')]);
  const cands = [{ ...L.orig, rol: 'orig' }];
  for (const v of L.varyantlar || []) { if (v.sha256 === L.orig.sha256) continue; if (!toks(path.basename(normUrl(v.url))).some((w) => own.has(w) || [...own].some((o) => w.includes(o) || o.includes(w)))) continue; cands.push({ ...v, rol: 'varyant' }); }
  for (const c of cands) { const s = shownOf(c.url); c.rw = s.length ? Math.max(...s.map((a) => a.rw)) : 0; c.hdr = s.some((a) => a.inHeader); c.puan = c.hdr ? 3 : c.rw > 0 ? 2 : c.rol === 'orig' ? 1 : 0; }
  const head = cands.slice().sort((a, b) => b.puan - a.puan || (a.rol === 'orig' ? -1 : 1))[0];
  const big = cands.filter((c) => c !== head && !c.hdr && c.rw >= 180).sort((a, b) => b.rw - a.rw)[0] || null;
  const put = async (c, name) => {
    const src = fs.readFileSync(path.join(dir, c.file)); const ext = c.file.split('.').pop();
    const out = `${name}.${ext}`; fs.writeFileSync(path.join(imgDir, out), src); // bayt bayt ayni
    const px = await logoPiksel(src, c.mime);
    return { file: out, w: c.w, h: c.h, svg: !!c.svg, sha256: sha256(src), kaynak: c.url, ratio: +(c.w / c.h).toFixed(3), px };
  };
  const h = await put(head, 'logo');
  const C = (R.colours && R.colours.computed) || {};
  // zemin: logo hangi yuzeyde okunuyorsa o.  Once sitenin kendi baslik zemini.
  let headBg; let plate = false;
  if (!h.px.alpha && h.px.corner) { headBg = h.px.corner; plate = true; } else {
    const list = [hex6(C.header && C.header.bg), hex6(C.header && C.header.ownBg), hex6(C.body && C.body.ownBg), t.bg, t.deep, '#ffffff', '#15120f'].filter(Boolean);
    headBg = list.find((s) => gorunurOran(h.px.lums, s) >= 0.94) || list.map((s) => ({ s, v: gorunurOran(h.px.lums, s) })).sort((a, b) => b.v - a.v)[0].s;
  }
  const navSite = hex6(C.nav && C.nav.color);
  const headInk = navSite && contrast(navSite, headBg) >= 4.5 ? navSite : [t.ink, t.onDeep, '#ffffff', '#111111'].find((c) => contrast(c, headBg) >= 7) || (lumHex(headBg) > 0.4 ? '#111111' : '#ffffff');
  const kare = h.ratio < 1.6;
  const b = logoBoyut({ svg: h.svg, w: h.w, h: h.h });
  const boyut = kare ? { d: h.svg ? 60 : Math.max(48, Math.min(64, Math.round(h.h / 2))), m: h.svg ? 46 : Math.max(40, Math.min(48, Math.round(h.h / 2))) } : { d: b.d, m: b.m };
  const out = { ...h, px: undefined, alpha: h.px.alpha, headBg, headInk, plate, kare, d: boyut.d, m: boyut.m, dusuk: dusukCozunurluk({ svg: h.svg, w: h.w, h: h.h }), vis: +gorunurOran(h.px.lums, headBg).toFixed(3), surum: head.rol, adaylar: cands.map((c) => ({ url: c.url, rol: c.rol, rw: c.rw, hdr: c.hdr })) };
  if (big) { const g = await put(big, 'logo-hero'); if (gorunurOran(g.px.lums, shade || '#14110f') >= 0.9) out.hero = { ...g, px: undefined, rw: big.rw }; else fs.rmSync(path.join(imgDir, g.file), { force: true }); }
  return out;
}

export async function uret(slug, { veri = VERI, out = DEMO, log = console.log } = {}) {
  const dir = path.join(veri, slug);
  const jf = path.join(dir, 'cikarici.json');
  if (!fs.existsSync(jf)) return { slug, status: 'elendi', reasons: ['cikarici.json yok (once cikar.mjs)'] };
  const R = JSON.parse(fs.readFileSync(jf, 'utf8'));
  const lead = R.lead; const lang = lead.lang === 'tr' ? 'tr' : 'en'; const L = T[lang]; const region = lead.region;
  const SM = profil(lead); const sm = SM ? SM.model(R, { lang, region }) : null; // sektor profili (konaklama ...): oda, olanak, giris/cikis, ana eylem hedefi
  if (!R.erisim || !R.erisim.ok) return { slug, status: 'elendi', reasons: [`site okunamadi (${(R.erisim && R.erisim.why) || 'erisim yok'})`] };
  let photos = (R.photos || []).slice();
  if (!photos.length) return { slug, status: 'elendi', reasons: [R.erisim.thin ? 'site bos ya da park sayfasi (fotograf yok)' : 'kullanilabilir fotograf yok'] };
  const warn = []; const notes = []; const elle = elleYukle()[slug] || null;
  const name = clean(R.name.n);

  // ---- ayni karenin ikinci kirpimi elenir (kucuk olan) ----
  const bufs = {}; const ozet = {}; const renk = {};
  for (const p of photos) { bufs[p.id] = fs.readFileSync(path.join(dir, p.file)); try { ozet[p.id] = await bantOzeti(bufs[p.id]); renk[p.id] = await renkOzeti(bufs[p.id]); } catch { ozet[p.id] = null; } }
  const drop = new Set();
  for (let i = 0; i < photos.length; i++) for (let j = i + 1; j < photos.length; j++) {
    const a = photos[i]; const b = photos[j]; if (drop.has(a.id) || drop.has(b.id) || !ozet[a.id] || !ozet[b.id]) continue;
    if (ham(ozet[a.id], ozet[b.id]) <= 14) { const d = a.w * a.h >= b.w * b.h ? b : a; drop.add(d.id); notes.push(`fotoğraf ${d.id}, ${d === a ? b.id : a.id} ile aynı kare (kırpım); biri kullanıldı`); }
  }
  photos = photos.filter((p) => !drop.has(p.id));
  // elle haric (data/slogan-elle.json -> haric): isletmenin zayif bir karesi (ambalaj, bulanik) hic kullanilmaz; en az 3 fotograf kalmali
  if (elle && Array.isArray(elle.haric) && elle.haric.length) {
    const ex = new Set(elle.haric.map(String)); const keep = photos.filter((p) => !ex.has(p.id));
    if (keep.length >= 3) { photos = keep; notes.push(`elle hariç tutulan fotoğraf: ${[...ex].join(', ')}`); } else notes.push('elle hariç listesi uygulanmadı (3 fotoğraftan az kalırdı)');
  }

  // ---- palet (marka sadakati) ----
  const pal = markaPaleti(R, renkPaleti(R, { photoPalette: (photos[0] && photos[0].palette) || [] }));
  if (pal.t.bg.toLowerCase() === '#000000') { pal.t.bg = '#0c0c0d'; pal.checks = kontrastKontrol(pal.t); }
  if (!paletteOk(pal.checks)) warn.push(`kontrast: ${pal.checks.filter((c) => !c.pass).map((c) => `${c.name} ${c.ratio}`).join(', ')}`);
  if (pal.fallback) warn.push('marka rengi bulunamadi');
  const sadakat = paletSadakati(R, pal);
  if (!sadakat.ok) warn.push(`palet sadakati: ${sadakat.sorun.join('; ')}`);
  const dark = pal.mode === 'dark';

  // ---- kahraman duzeni: koyu marka = tam ekran foto; acik marka = bolunmus (yazi kendi zemininde, foto yaninda) ----
  // sitesinin ilk ekraninda buyuk, ortalanmis ikinci bir logo varsa (basligin disinda) duzen ortalanir ve o logo korunur
  const f = gerceklikler(R, lang);
  const pageRel = pageDir(slug); const pdir = path.join(out, pageRel); const imgDir = path.join(pdir, 'img');
  fs.rmSync(imgDir, { recursive: true, force: true }); fs.mkdirSync(imgDir, { recursive: true });
  const logo = await logoKur({ ...R, slug }, dir, imgDir, pal.t, { shade: pal.t.shade });
  if (!logo) warn.push('logo yok ya da orijinal dosya indirilemedi');
  else if (logo.dusuk) notes.push(`logo düşük çözünürlüklü (${logo.w}x${logo.h}); orijinal dosya aynen, küçük boyutta gösterildi`);
  const variant = !dark ? 'bolme' : (logo && logo.hero ? 'orta' : 'tam');

  // ---- fotograflar ----
  const textish = (p) => p.meanS < 0.26 && p.lapVar > 1800;
  const byId = new Map(photos.map((p) => [p.id, p]));
  let heroSrc;
  const wantPortrait = variant === 'bolme';
  if (elle && Array.isArray(elle.hero) && elle.hero.filter((id) => byId.has(id)).length >= 2) heroSrc = elle.hero.filter((id) => byId.has(id)).map((id) => byId.get(id));
  else {
    const good = photos.filter((p) => !textish(p));
    const pool = (good.length >= 2 ? good : photos).slice().sort((a, b) => b.score - a.score);
    const pref = pool.filter((p) => (wantPortrait ? p.ratio <= 1.6 : p.ratio >= 1.2));
    heroSrc = pref.slice(0, 4); if (heroSrc.length < 3) heroSrc = heroSrc.concat(pool.filter((p) => !heroSrc.includes(p)).slice(0, 3 - heroSrc.length));
  }
  heroSrc = heroSrc.slice(0, 4);
  const heroIds = new Set(heroSrc.map((p) => p.id));
  const info = {}; const p90 = {};
  for (const p of photos) {
    const big = await toFile(bufs[p.id], path.join(imgDir, `p${p.id}-1600.webp`), 1600, 74);
    await toFile(bufs[p.id], path.join(imgDir, `p${p.id}-960.webp`), 960, 72);
    info[p.id] = { id: p.id, name: `p${p.id}`, w: big.w, h: big.h, focus: p.focus || { x: 0.5, y: 0.5 }, alt: '', kb: big.kb, textish: textish(p) };
    if (heroIds.has(p.id)) {
      p90[p.id] = await p90Alt(big.buf);
      try { fs.writeFileSync(path.join(imgDir, `p${p.id}-d.webp`), await derinlik(big.buf)); info[p.id].depth = `p${p.id}-d.webp`; } catch (e) { notes.push(`derinlik haritası üretilemedi (${p.id})`); }
    }
    const alt = clean(p.alt);
    if (alt && alt.length >= 5 && alt.length <= 110 && !/\.(jpe?g|png|webp)|^img|screenshot|banner|slide|hero|logo|image \d|dsc|^\d/i.test(alt) && !/^[\w-]+$/.test(alt)) info[p.id].alt = titleCase(alt, lang);
  }
  const mk = (p) => info[p.id];
  const hero = heroSrc.map(mk);
  const gallery = photos.filter((p) => !heroIds.has(p.id) && !textish(p)).sort((a, b) => b.score - a.score).concat(heroSrc.slice(1), photos.filter((p) => !heroIds.has(p.id) && textish(p)), heroSrc.slice(0, 1)).map(mk);

  // ---- font ----
  const fe = await fontEslestir(R, { slug, tr: lang === 'tr' });
  notes.push(...fe.notes);
  const files = await fontDosyalari(fe);
  const fontsDir = path.join(out, ORTAK, 'fonts'); fs.mkdirSync(fontsDir, { recursive: true });
  for (const x of files) { const dst = path.join(fontsDir, dosyaAdi(x.id, x.subset, x.weight, x.style)); if (!fs.existsSync(dst)) fs.copyFileSync(x.file, dst); }
  const wantLatin = (id, w, st) => files.find((x) => x.id === id && x.subset === 'latin' && x.weight === w && x.style === st);
  const fontPreload = [wantLatin(fe.display.id, fe.display.weight, fe.display.italic ? 'italic' : 'normal'), wantLatin(fe.text.id, fe.text.weight, 'normal')].filter(Boolean).map((x) => dosyaAdi(x.id, x.subset, x.weight, x.style));
  if (!files.length) warn.push('font dosyasi indirilemedi');

  // ---- BASLIK = SLOGAN (isletme adi degil) ----
  let slogan = null;
  if (elle && Array.isArray(elle.aday) && elle.aday[elle.sec || 0]) {
    const a = elle.aday[elle.sec || 0]; const red = sloganDogrula(a.text, name);
    if (!red) slogan = { ham: a.text, kaynak: `elle (${a.kaynak})`, aday: elle.aday.map((x) => x.text.replace(/\*/g, '')) };
    else notes.push(`elle slogan reddedildi (${red}); kural tabanlı seçildi`);
  }
  if (!slogan) {
    // sitenin kendi buyuk basligi da adaydir (hesaplanmis h1/h2 metni)
    const S = R.slogan || { cands: [] }; const comp = (R.colours && R.colours.computed) || {};
    const extra = ['h1', 'h2'].map((k) => comp[k] && comp[k].text ? { tag: k, t: comp[k].text, top: 400, fs: comp[k].size || 30, cls: '', inHeader: false } : null).filter(Boolean).filter((c) => !(S.cands || []).some((x) => ascii(x.t) === ascii(c.t)));
    const sec = sloganSec({ ...R, slogan: { ...S, cands: [...(S.cands || []), ...extra] } }, { lang, slug });
    const red = sloganDogrula(sec.text, name);
    slogan = { ham: red ? (SM ? `${f.kindPhrase ? f.kindPhrase.charAt(0).toUpperCase() + f.kindPhrase.slice(1) : 'Rooms'}${f.city ? ' in ' + f.city : ''}` : lang === 'tr' ? `${f.city ? f.city + '’da ' : ''}sofranız hazır` : `Your table${f.city ? ' in ' + f.city : ''}`) : sec.text, kaynak: red ? 'son-care' : sec.kaynak, aday: (sec.aday || []).map((x) => x.text) };
  }
  slogan.text = slogan.ham.replace(/\*/g, ''); slogan.parts = sloganParcalari(slogan.ham);
  if (ascii(slogan.text) === ascii(name)) warn.push('slogan isletme adiyla ayni');

  // ---- baslik olcusu (kural tabanli; kapi gercek olcumle dogrular) ----
  const caps = !!fe.display.upper;
  const lsPx = parseFloat(fe.display.ls) || 0; const h1px = (R.colours && R.colours.computed && R.colours.computed.h1 && R.colours.computed.h1.size) || 40;
  let ls = lsPx ? Math.max(-0.02, Math.min(0.14, lsPx / h1px)) : (caps ? 0.02 : fe.display.cls.startsWith('serif') ? -0.005 : -0.012);
  ls = +ls.toFixed(3);
  const wEff = (fe.display.w || 0.54) * (caps ? 1.16 : 1) * (1 + ls) * (fe.display.italic ? 0.97 : 1);
  const sl = slogan.text; const words = sl.split(/\s+/); const longest = Math.max(...words.map((x) => x.length));
  const lines = variant === 'orta' ? (sl.length <= 20 ? 1 : sl.length <= 46 ? 2 : 3) : sl.length <= 16 ? 1 : sl.length <= 36 ? 2 : 3;
  const cpl = Math.max(longest, Math.ceil(sl.length / lines) + 2);
  const avail = variant === 'bolme' ? 40 : variant === 'orta' ? 60 : 62;
  const serifish = fe.display.cls.startsWith('serif') || fe.display.cls === 'script';
  const lh0 = serifish ? 1.02 : caps ? 1.02 : 0.98;
  const vw = Math.min(9.5, avail / (cpl * wEff));
  const vhCap = (36 / (lines * lh0)).toFixed(1);
  const linesM = sl.length <= 14 ? 1 : sl.length <= 30 ? 2 : sl.length <= 48 ? 3 : 4;
  const cplM = Math.max(longest, Math.ceil(sl.length / linesM) + 1);
  const vwM = Math.max(6.6, Math.min(13.5, (variant === 'orta' ? 76 : 88) / (cplM * wEff)));
  const maxPx = variant === 'orta' ? Math.max(40, Math.floor(1010 / (cpl * wEff * 1.04))) : 138;
  const size = { h1: `clamp(34px, min(${vw.toFixed(2)}vw, ${vhCap}vh), ${maxPx}px)`, h1m: vwM, h1max: `${(cpl * wEff * 1.1).toFixed(1)}em`, lh: lh0, h2: `clamp(32px, ${caps ? 4.2 : 4.9}vw, ${caps ? 72 : 84}px)`, h3: `clamp(21px, ${caps ? 1.7 : 2.05}vw, ${caps ? 26 : 31}px)` };
  const btnRad = R.colours && R.colours.computed && R.colours.computed.btn ? R.colours.computed.btn.radius : null;
  const btnR = btnRad === null || btnRad === undefined || btnRad >= 18 ? '999px' : `${Math.min(10, Math.round(btnRad))}px`;
  const cardR = btnR === '999px' ? '14px' : `${Math.min(12, parseInt(btnR, 10) + 2)}px`;

  // ---- yazi okunurlugu: foto + golge (tam ekran duzenlerde) ----
  let shadeM = 0.72; let shadeA = 0.94; let heroContrast;
  if (variant === 'bolme') heroContrast = +contrast(pal.t.ink, pal.t.bg).toFixed(2);
  else {
    const shadeL = lumHex(pal.t.shade);
    const worst = Math.max(...heroSrc.map((p) => p90[p.id]));
    shadeM = +Math.max(0.6, Math.min(0.95, (worst - 0.152) / Math.max(0.05, worst - shadeL))).toFixed(3);
    shadeA = +Math.max(0.94, Math.min(0.99, shadeM + 0.04)).toFixed(3);
    const effL = worst * (1 - shadeM) + shadeL * shadeM;
    heroContrast = +(1.05 / (effL + 0.05)).toFixed(2);
    if (heroContrast < 4.5) warn.push(`hero yazi kontrasti dusuk (${heroContrast}): foto cok acik`);
  }

  // ---- saatler ----
  // elle saat (data/slogan-elle.json -> saat): cikarici sitenin iki ayri saat yazimini karistirdiginda, sitenin KENDI ilk ekranindaki satirlar aynen girilir
  let hoursIn = R.hours; let hoursNote = null; let sonRez = null;
  if (elle && elle.saat && Array.isArray(elle.saat.satirlar) && elle.saat.satirlar.length) {
    const p = parseSaatler(elle.saat.satirlar);
    if (p && p.tableOk) { hoursIn = p; hoursNote = clean(elle.saat.not || '') || null; sonRez = toMin(elle.saat.sonRez); notes.push(`saatler elle girildi (${elle.saat.kaynak || 'sitesinin ilk ekranı'})`); }
    else notes.push('elle saat satırları çözümlenemedi; çıkarıcının saati kullanıldı');
  }
  const sd = saatDenetle(hoursIn); const hrs = sd.hours; const hoursIssue = sd.issue; if (hoursIssue) notes.push(`saatler ${hoursIssue === 'cakisma' ? 'sitede birbiriyle çelişiyor' : 'üst üste biniyor'}: tablo ve "şimdi açık" gösterilmedi`);
  const tz = tzOf(lead.city, region);
  const h12 = TF12.has(region);
  let tablo = hrs ? saatTablo(hrs, lang) : null;
  let knownDays = 0; if (hrs) for (let d = 0; d < 7; d++) if (hrs.week[d] || (hrs.byDay && hrs.byDay[d] === 'closed')) knownDays++;
  const hoursOk = !!hrs && knownDays >= 5;
  const statusOk = !!hrs && knownDays === 7 && !!tz;
  if (tablo && h12) tablo = tablo.map((r) => ({ ...r, t: r.t && /\d/.test(r.t) ? to12(r.t) : r.t }));
  const ozetS = tablo ? saatOzet(tablo, lang) : [];
  const slots = {}; let firstSlots = [];
  if (hrs) for (let d = 0; d < 7; d++) {
    const w = hrs.week[d]; if (!w) continue;
    const [o, c] = w; const start = Math.ceil((o + 30) / 30) * 30; const end = Math.min(c - 60, sonRez !== null && sonRez > o ? sonRez : c - 60); // son masa: kapanistan 1 saat once (mutfak erken kapaniyorsa o)
    let list = [];
    if (end - start < 30) list = [start % 1440]; else { const step = Math.max(30, Math.round((end - start) / 5 / 30) * 30); for (let x = start; x <= end && list.length < 6; x += step) list.push(x % 1440); }
    slots[d] = list.map(hh).map((s) => (h12 ? to12(s) : s));
  }
  const firstDay = Object.keys(slots)[0];
  firstSlots = firstDay !== undefined ? slots[firstDay] : [];
  if (!firstSlots.length) firstSlots = lang === 'tr' ? ['18:00', '19:00', '20:00', '21:00'] : ['6:00 pm', '7:00 pm', '8:00 pm'];
  const useSlots = hoursOk && Object.keys(slots).length >= 3;

  // ---- menu ----
  const badCat = /\b(hours|opening|saatler|saatleri|location|contact|iletişim)\b/i;
  const items = ((R.menu && R.menu.items) || []).map((it) => ({ n: titleCase(it.n, lang), d: clean(it.d).slice(0, 150), p: fmtPrice(it.p, region), cat: titleCase(it.cat || '', lang).replace(/\s+menu$/i, '') }))
    .filter((it) => it.n && it.p && !badCat.test(it.cat) && !/\b(hours|opens?|closes?|kitchen|bar open|happy hour|am|pm|extras?)\b/i.test(it.n));
  const byCat = new Map();
  for (const it of items) { const k = it.cat || ''; if (!byCat.has(k)) byCat.set(k, []); byCat.get(k).push(it); }
  let groups = [...byCat.entries()].map(([nm, list], i) => ({ name: nm || (SM && SM.GRUP_ADI ? SM.GRUP_ADI : lang === 'tr' ? 'Yemekler' : 'Food'), items: list, i }));
  const leftover = groups.filter((g) => g.items.length < 3).flatMap((g) => g.items); groups = groups.filter((g) => g.items.length >= 3);
  if (groups.length > 6) groups = groups.slice().sort((a, b) => b.items.length - a.items.length || a.i - b.i).slice(0, 6).sort((a, b) => a.i - b.i);
  if (leftover.length >= 2 && groups.length < 6) groups.push({ name: L.other, items: leftover });
  groups = groups.map((g) => ({ name: g.name, items: g.items.slice(0, 12) }));
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  if (total < 4) groups = [];
  const imgExt = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;
  const mpage = R.menu && R.menu.pageUrl && !imgExt.test(R.menu.pageUrl) ? R.menu.pageUrl : null;
  const menuLink = mpage || (R.menu && R.menu.pdfs && R.menu.pdfs[0]) || null;

  // ---- one cikanlar: fotografinin alt yazisi menudeki bir kalemle eslesen yemekler (ad + fiyat kendi verisi) ----
  const all = items; const sign = [];
  for (const p of photos) {
    const a = info[p.id].alt; if (!a || textish(p)) continue; const k = ascii(a);
    const hit = all.find((it) => ascii(it.n) === k) || all.find((it) => k.length >= 8 && (ascii(it.n).includes(k) || k.includes(ascii(it.n))) && ascii(it.n).length >= 8);
    if (hit) sign.push({ pic: info[p.id], n: hit.n, p: hit.p, d: hit.d ? (hit.d.length > 96 ? `${hit.d.slice(0, 93).replace(/[\s,;:]+\S*$/, '')}…` : hit.d) : '' });
    else if (a.split(' ').length >= 2 && !/&|\bcafe\b|bakery|restaurant/i.test(a)) sign.push({ pic: info[p.id], n: a, p: '', d: '' });
  }
  sign.sort((a, b) => Number(!!b.p) - Number(!!a.p));
  const signature = sign.length >= 3 ? sign.slice(0, 6) : [];
  const signIds = new Set(signature.map((s) => s.pic.id));
  const menuPool = gallery.filter((p) => !p.textish);
  const menuVis = groups.length ? groups.map((g, i) => menuPool[i % Math.max(1, menuPool.length)]).filter(Boolean) : [];

  // ---- menu kartlari: one cikan yemek fotografi yoksa, kendi menu basliklarindan 3D egilen kagit kartlar (ad + fiyat kendi verisi) ----
  let menuCards = [];
  if (signature.length < 3 && groups.length >= 3) {
    const yan = /(kids|children|cocuk|extras?|sides?|other|diger|icecek|drinks?|beverages?|sauces?|soslar)/;
    const pick = groups.map((g, i) => ({ g, i, low: yan.test(ascii(g.name)) })).sort((a, b) => Number(a.low) - Number(b.low) || b.g.items.length - a.g.items.length || a.i - b.i).slice(0, 4).sort((a, b) => a.i - b.i);
    menuCards = pick.map(({ g, i }) => ({ tab: i, name: g.name, n: g.items.length, items: g.items.slice(0, 4).map((it) => ({ n: it.n, p: it.p })) }));
  }

  // ---- iletisim, metin ----
  let phone = R.phone ? telText(R.phone) : null;
  const tel = phone ? telHref(phone, region) : null;
  if (phone && region === 'AU') { const g = /^\(?0(\d)\)?\s?(\d{4})\s?(\d{4})$/.exec(phone.trim()); if (g) phone = `(0${g[1]}) ${g[2]} ${g[3]}`; }
  // TR numarasi okunur yazilir: +902421234567 -> 0242 123 45 67 (arama baglantisi degismez)
  if (phone && region === 'TR') { const g = /^\+?90\s?(\d{3})\s?(\d{3})\s?(\d{2})\s?(\d{2})$/.exec(phone.replace(/[()\-.]/g, '')); if (g) phone = `0${g[1]} ${g[2]} ${g[3]} ${g[4]}`; }
  const address = R.address ? clean(R.address.text).replace(/,?\s*\(?\+?\d[\d\s().-]{7,}\d\)?\s*$/, '').replace(/,\s*$/, '') : null;
  const maps = (address || name) ? mapsUrl(address, name, lead.city) : null;
  const resHost = R.reservation && R.reservation.external ? new URL(R.reservation.url).host.replace(/^www\./, '') : null;
  let { lede } = ledeOf(R.tagline);
  if (lede && sloganlaOrtusur(lede, slogan.text) && lede.split(/\s+/).length <= 9) lede = '';
  const own = kendiCumleleri(R).flat().filter((x) => x.ok).map((x) => x.s);
  if (!lede && own.length) lede = own.find((s) => s.length <= 170 && !sloganlaOrtusur(s, slogan.text)) || '';
  if (!lede && lead.rating && lead.reviews) lede = lang === 'tr' ? `Google'da ${new Intl.NumberFormat('tr').format(lead.reviews)} yoruma göre ${new Intl.NumberFormat('tr', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(lead.rating)} puan.` : `Rated ${lead.rating.toFixed(1)} on Google from ${new Intl.NumberFormat('en').format(lead.reviews)} reviews.`;
  const storyText = hikayeSec(R, { lede });
  // hikaye fotograflari: birbirine benzemeyen uc kare (ayni sahnenin iki cekimi yan yana gelmesin); one cikan kartlardaki kareler en sona
  const sCand = gallery.filter((p) => !p.textish && !signIds.has(p.id)).concat(gallery.filter((p) => !p.textish && signIds.has(p.id)));
  const storyPics = [];
  for (const p of sCand) { if (storyPics.length >= 3) break; if (storyPics.every((q) => !renk[p.id] || !renk[q.id] || benzer(renk[p.id], renk[q.id]) < 0.7)) storyPics.push(p); }
  for (const p of sCand) { if (storyPics.length >= 2) break; if (!storyPics.includes(p)) storyPics.push(p); }
  // galeri: one cikan kartlarda zaten gorunen kareler sona
  gallery.sort((a, b) => Number(signIds.has(a.id)) - Number(signIds.has(b.id)));
  const story = storyText && storyPics.length >= 2 ? { text: storyText, pics: storyPics } : null;
  const stats = [];
  const nf = new Intl.NumberFormat(L.numLocale);
  if (lead.rating) stats.push({ v: new Intl.NumberFormat(L.numLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(lead.rating), l: L.rating });
  if (lead.reviews) stats.push({ v: nf.format(lead.reviews), l: L.reviews });
  if (hoursOk) { const od = tablo.filter((r) => r.t && r.t !== L.closed).length; stats.push({ v: `${od}/7`, l: L.daysOpen }); }

  // ---- hareket dili: isletmenin kendi konseptinden ----
  const blob = ascii(`${name} ${R.tagline || ''} ${(R.address && R.address.text) || ''} ${(R.ek && R.ek.paragraflar || []).slice(0, 2).join(' ')}`);
  // sira: elle secim > su kiyisi (ad ya da kendi metni) > ates/firin yontemi (kendi metninde geciyorsa) > firca
  const WATER = /\b(river|riverside|riverbar|sea|seaside|beach|marina|harbou?r|waterfront|lake|bay|deniz|sahil|nehir|gol|kordon|iskele|liman)/;
  const FIRE = /(odun ates|tas firin|wood[- ]?fired|stone[- ]?baked|charcoal|chargrill|mangal|komur|tandir|smokehouse)/;
  const fx = elle && ['isi', 'su', 'firca'].includes(elle.fx) ? elle.fx : WATER.test(blob) ? 'su' : FIRE.test(blob) ? 'isi' : 'firca';

  const mapBg = pal.t.bg2;
  const model = {
    slug, lang, name, cityLabel: cityLabel(lead.city, lang), site: lead.site, palette: pal, font: fe, fontFaceCss: fontFaceCss(files, `../../${ORTAK}/fonts/`), fontPreload,
    variant, fx, dark, slogan, caps, ls, emStyle: !caps && fe.display.styles && fe.display.styles.includes('italic') && fe.display.cls !== 'cond' ? 'italic' : 'normal',
    size, btnR, cardR, shadeA, shadeM,
    kb: { step: 7, total: Math.max(3, hero.length) * 7, ov: 1.4 }, map: { bg: mapBg, road: mixHex(mapBg, pal.t.ink, 0.1), fine: mixHex(mapBg, pal.t.ink, 0.055) },
    fallback: { display: FALLBACK[fe.display.cls] || FALLBACK.geo, text: FALLBACK[fe.text.cls] || FALLBACK.neo },
    logo, hero, gallery: gallery.filter((p) => !p.textish || gallery.length < 4), menuVis, signature, story,
    // rezervasyon fotografi: elle secim (slogan-elle.json -> rez) > kahramanda olmayan dikey kare > galerinin ikincisi
    bookPic: (elle && elle.rez && info[String(elle.rez)]) || (() => { const portrait = gallery.slice(0, 6).find((p) => p.h / p.w >= 1.1 && !hero.includes(p)); return portrait || gallery[Math.min(1, gallery.length - 1)]; })(),
    eyebrow: eyebrowOf(R, lang, f), lede, stats, hoursOk, hoursTable: tablo, hoursSummary: ozetS, hoursNote, week: hrs ? hrs.week : null, tz, statusOk, slots: useSlots ? slots : null, firstSlots,
    address, phone, tel, mapsUrl: maps, social: R.social || {}, reservationHost: resHost,
    menu: { groups, link: menuLink }, menuCards, h12,
    sektor: SM ? SM.AD : null, etiket: SM ? SM.ETIKET : null, kon: sm,
  };

  // ---- yaz ----
  const css = themeCss(model) + `\n@media (max-width:899px){:root{--h1-size:clamp(30px,${size.h1m.toFixed(2)}vw,64px)}}\n`;
  fs.writeFileSync(path.join(pdir, 'theme.css'), css);
  const html = sayfaHtml(model);
  if (yasakVar('kisaltma', html.replace(/<script[\s\S]*?<\/script>/g, ''))) warn.push('sayfa metninde yasak kisaltma geciyor');
  fs.writeFileSync(path.join(pdir, 'index.html'), html);
  const shared = path.join(out, ORTAK); fs.mkdirSync(shared, { recursive: true });
  for (const x of ['site.css', 'page.js', 'sahne.js', 'CREDITS.txt']) fs.copyFileSync(path.join(HERE, 'sablon', x), path.join(shared, x));
  const lic = [...new Set([fe.display, fe.text].map((x) => `${x.family}: ${x.license} (fontsource / Google Fonts)`))];
  const licF = path.join(shared, 'fonts', 'LICENSES.txt');
  const have = fs.existsSync(licF) ? fs.readFileSync(licF, 'utf8').split('\n').filter(Boolean) : [];
  fs.writeFileSync(licF, [...new Set([...have, ...lic])].sort().join('\n') + '\n');

  const report = { slug, page: `${pageRel}/index.html`, lang, mode: pal.mode, variant, fx,
    slogan: { text: slogan.text, kaynak: slogan.kaynak, aday: slogan.aday, neden: elle && elle.neden },
    logo: logo ? { file: logo.file, sha256: logo.sha256, kaynak: logo.kaynak, surum: logo.surum, w: logo.w, h: logo.h, headBg: logo.headBg, headInk: logo.headInk, vis: logo.vis, d: logo.d, m: logo.m, dusuk: logo.dusuk, hero: logo.hero ? { file: logo.hero.file, sha256: logo.hero.sha256, kaynak: logo.hero.kaynak } : null } : null,
    fonts: { display: { id: fe.display.id, family: fe.display.family, via: fe.display.via, orig: fe.display.orig, weight: fe.display.weight, license: fe.display.license }, text: { id: fe.text.id, family: fe.text.family, via: fe.text.via, orig: fe.text.orig, license: fe.text.license } },
    palette: { accent: pal.t.accent, accentInk: pal.t.accentInk, accent2: pal.t.accent2, bg: pal.t.bg, bg2: pal.t.bg2, ink: pal.t.ink, deep: pal.t.deep, shade: pal.t.shade, accentVia: pal.source.accent && pal.source.accent.via, ok: paletteOk(pal.checks), checks: pal.checks, marka: pal.marka, sadakat },
    hero: hero.map((h) => h.name), heroContrast, shadeA, shadeM, photos: photos.length, signature: signature.length, story: !!story, menuItems: total, menuGroups: groups.map((g) => `${g.name} (${g.items.length})`), menuLink: !!menuLink, hoursOk, hoursIssue, hoursNote, hoursElle: hoursIn !== R.hours, statusOk, tz, notes, warn, size: size.h1,
    sektor: SM ? SM.AD : null, kon: sm ? { odalar: (sm.odalar || []).length, hizmetler: sm.hizmetler, fromP: sm.fromP, olanak: sm.olanak, giris: sm.giris, bookUrl: sm.bookUrl, bookHost: sm.bookHost, ota: sm.ota } : null };
  fs.writeFileSync(path.join(dir, 'uret.json'), JSON.stringify(report, null, 1));
  log(`uretildi: ${pageRel}  (${variant}/${fx}, slogan "${slogan.text}" [${slogan.kaynak.slice(0, 24)}], font ${fe.display.id}/${fe.text.id}, ${pal.mode}, hero ${hero.length}, foto ${photos.length}, menu ${total}, one cikan ${signature.length}${warn.length ? ', UYARI: ' + warn.join('; ') : ''})`);
  return { slug, status: 'uretildi', dir: pdir, rel: pageRel, report, model };
}

// ---- cli ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const which = process.argv[2];
  if (!which) { console.error('kullanim: node uyarla/uret.mjs <slug,slug|hepsi> [--out web/demo klasoru]'); process.exit(2); }
  const out = arg('--out', DEMO);
  const slugs = which === 'hepsi' ? fs.readdirSync(VERI).filter((s) => fs.existsSync(path.join(VERI, s, 'cikarici.json'))) : which.split(',');
  for (const s of slugs) { try { const r = await uret(s, { out }); if (r.status !== 'uretildi') console.log(`${s}: ${r.status} (${r.reasons.join('; ')})`); } catch (e) { console.log(`${s}: HATA ${e.stack.split('\n').slice(0, 4).join(' | ')}`); } }
}
