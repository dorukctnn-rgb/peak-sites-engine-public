// PAKET ON SUZGECI: gercek paketlerden TEST ORNEGI uretir (hat/test/fixture/paket-suzgec/ornekler.json).  Ornek = suzgecin okudugu alanlarin temiz kopyasi:
// telefon / e-posta / adres / tam adresler yok (adreslerde yalniz alan adi), metin yalniz saat, zincir ve kapanis ile ilgili satirlar, menu en cok 25 satir.
//   node hat/paket-suzgec-ornek.mjs --veri <veri klasoru> --etiket <etiket.json> --cikti <ornekler.json>
// etiket.json: { "<slug>": { "etiket": "kabul" | "ret", "kaynak": "icerik-karari" | "on-bakis", "neden": "kisa" } }
import fs from 'node:fs';
import path from 'node:path';
import { pdfMetniOku } from './paket-suzgec.mjs';
import { fileURLToPath } from 'node:url';

const J = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const oku = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const gizle = (s) => String(s).replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '').replace(/@[\w.-]+/g, '').replace(/https?:\/\/\S+/g, '').replace(/\+?\d[\d\s().-]{7,}\d/g, '0000 0000').replace(/\s+/g, ' ').trim();
// PDF menunun ilk satirlari kapak metnidir; ornekte metnin %30'undan baslayan N satir tutulur (yemek bolumu)
const ortadanSatir = (satirlar, n) => satirlar.slice(satirlar.length > n * 2 ? Math.floor(satirlar.length * 0.3) : 0).slice(0, n).join('\n');
const host = (u) => { try { return new URL(u).host; } catch { return null; } };
const dosyaAdi = (u) => String(u || '').split('?')[0].split('/').pop();
const ILGILI = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\d\s?(am|pm)\b|\d{1,2}:\d{2}|closed|\blate\b|opening|hours|group|sister|branch|locations?|franchise|head office|part of|hospitality|collective|[şŞ]ube|permanently|ceased|our last day|pazartesi|cumartesi|her g[üu]n/i;

// ornek.bilgi (sikistirilmis) -> suzgecin okudugu bilgi.json bicimi
export function bilgiAc(b) {
  return {
    ...b,
    fotograflar: (b.fotograflar || []).map(([w, h, u, k], i) => ({ id: String(i + 1).padStart(2, '0'), w, h, uyum: u === 'u' ? 'uygun' : 'elendi', kaynak: k === 's' ? 'stok' : k === 'k' ? 'kendi' : undefined })),
    hero_adaylari: (b.hero_adaylari || []).map(([px, puan], i) => ({ id: String(i + 1).padStart(2, '0'), px, puan })),
  };
}

export function ornekYap(veri, slug, etiket) {
  const pk = path.join(veri, slug, 'paket'); const b = J(path.join(pk, 'bilgi.json'), {}); const c = J(path.join(veri, slug, 'cikarici.json'), null);
  const metin = oku(path.join(pk, 'metin.txt')).split('\n').map(gizle).filter((l) => l && ILGILI.test(l)).map((l) => l.slice(0, 170)).slice(0, 70).join('\n');
  const mk = path.join(pk, 'menu-kaynak'); const menu = {}; const pdf = {};
  let dosyalar = []; try { dosyalar = fs.readdirSync(mk); } catch { /* yok */ }
  for (const f of dosyalar) {
    if (/\.txt$/i.test(f)) menu[f] = oku(path.join(mk, f)).split('\n').map(gizle).filter(Boolean).map((l) => l.slice(0, 150)).slice(0, 22).join('\n');
    else if (/\.pdf$/i.test(f)) { const t = Object.keys(pdf).length < 2 ? pdfMetniOku(path.join(mk, f)) : null; pdf[f] = t ? ortadanSatir(t.split('\n').map(gizle).filter(Boolean).map((l) => l.slice(0, 120)), 80) : ''; }
    else menu[f] = null; // gorsel: yalniz varlik
  }
  const bilgi = {
    slug: b.slug, ad: b.ad, bolge: b.bolge, sablon: b.sablon, tur: b.tur, mutfak: b.mutfak,
    telefon: b.telefon ? '0000' : null, adres: b.adres ? 'var' : null,
    saat: b.saat ? { tableOk: b.saat.tableOk, week: b.saat.week, byDay: b.saat.byDay, kaynak: b.saat.kaynak } : null,
    eylem: b.eylem ? { tur: b.eylem.tur, url: b.eylem.url ? `https://${host(b.eylem.url)}/` : null } : null,
    rezervasyon: b.rezervasyon && b.rezervasyon.url ? { url: `https://${host(b.rezervasyon.url)}/` } : null,
    siparis: b.siparis && b.siparis.url ? { url: `https://${host(b.siparis.url)}/` } : null,
    logo: b.logo ? { dosya: b.logo.dosya, boyut: b.logo.boyut, kaynak: `https://x.test/${dosyaAdi(b.logo.kaynak)}` } : null,
    fotograflar: (b.fotograflar || []).map((f) => [f.w, f.h, String(f.uyum || '').startsWith('uygun') ? 'u' : 'e', f.kaynak === 'stok' ? 's' : f.kaynak === 'kendi' ? 'k' : '']),
    hero_adaylari: (b.hero_adaylari || []).map((a) => [a.px, a.puan]),
    menu_kaynaklari: (b.menu_kaynaklari || []).map((m) => ({ tur: m.tur, kalem: m.kalem, fiyatsiz: m.fiyatsiz, px: m.px, dosya: m.dosya, url: m.url ? `https://x.test/${dosyaAdi(m.url)}` : undefined })),
    eski_site_bulgulari: (b.eski_site_bulgulari || []).map((x) => ({ k: x.k, p: x.p })), gorsel_uyari: b.gorsel_uyari || null,
  };
  const cik = c ? { pages: new Array((c.pages || []).length).fill(null), slogan: { cands: ((c.slogan && c.slogan.cands) || []).slice(0, 6).map((x) => ({ cls: String(x.cls || '').slice(0, 80) })) }, fonts: { loaded: ((c.fonts && c.fonts.loaded) || []).slice(0, 6) }, erisim: { finalUrl: c.erisim && /^https:/i.test(String(c.erisim.finalUrl || '')) ? 'https://x.test/' : 'http://x.test/' } } : null;
  return { slug, ...etiket, bilgi, metin, menu, pdf, cikarici: cik };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const veri = arg('--veri'); const etiket = J(arg('--etiket'), {}); const cikti = arg('--cikti');
  if (!veri || !cikti) { console.error('kullanim: node hat/paket-suzgec-ornek.mjs --veri <veri> --etiket <etiket.json> --cikti <ornekler.json>'); process.exit(2); }
  const out = []; for (const slug of Object.keys(etiket)) if (fs.existsSync(path.join(veri, slug, 'paket', 'bilgi.json'))) out.push(ornekYap(veri, slug, etiket[slug]));
  fs.mkdirSync(path.dirname(cikti), { recursive: true }); fs.writeFileSync(cikti, JSON.stringify(out, null, 0)); console.log(`${out.length} ornek -> ${cikti} (${Math.round(fs.statSync(cikti).size / 1024)} KB)`);
}
