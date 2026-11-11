// SABLON SECICI (11 Kas 2026, v5 tasima): isletmenin turune gore sayfa sablonu.  Doruk'un onayladigi kalite citasi (memory/website-demo-quality-bar):
//   restoran ve bar         -> v5 (uc referans dilinden biri: mekan / sicak / sahil; uyarla/lib/dil-v5.mjs secer)
//   burger                  -> burger  (referans cravburgers.shop)
//   burrito, taco, Meksika  -> burrito (referans burritomadre.rs)
//   pizza                   -> pizza   (referans sebastiano.polyarix.space)
//   konaklama, guzellik ve diger sektor profilleri -> 'eski' (uyarla/uret.mjs + sektor/<ad>.mjs; DEGISMEZ)
// Kanit sirasi: OSM cuisine etiketi > isletmenin adi > sitenin kendi metni (en cok gecen tur sozcugu).  Model yok.
import { SEKTOR } from './sektor/index.mjs';

export const KATEGORILER = ['burger', 'burrito', 'pizza'];
export const SABLONLAR = ['v5', ...KATEGORILER];

const CUISINE = [
  ['burger', /^(burger|burgers|hamburger|smash_burger)$/],
  ['burrito', /^(mexican|tex-mex|tex_mex|burrito|burritos|taco|tacos|taqueria|latin_american_mexican)$/],
  ['pizza', /^(pizza|pizzeria|italian_pizza|neapolitan_pizza|pizza_by_the_slice)$/],
];
const AD = [
  ['burger', /\bburgers?\b|\bsmash(?:ed)?\b.*\bburg/i],
  ['burrito', /\b(burritos?|tacos?|taqueria|tacoria|cantina|mexican|mexicana|tex-?mex|el\s+\w+\s+loco)\b/i],
  ['pizza', /\b(pizza|pizzas|pizzeria|pizzaria|pizzeta)\b/i],
];
const METIN = { burger: /\bburgers?\b/gi, burrito: /\b(burritos?|tacos?|quesadillas?|nachos)\b/gi, pizza: /\b(pizzas?|pizzeria|margherita|wood[- ]fired)\b/gi };

// cuisine: OSM "cuisine" etiketi ("burger;american"); ad: isletme adi; metin: sitenin kendi metni (istege bagli)
export function kategoriOf({ cuisine = '', ad = '', metin = '' } = {}) {
  const toks = String(cuisine || '').toLowerCase().split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  for (const t of toks) for (const [k, re] of CUISINE) if (re.test(t)) return { kategori: k, neden: `OSM cuisine=${t}` };
  for (const [k, re] of AD) { const m = re.exec(String(ad || '')); if (m) return { kategori: k, neden: `adinda "${m[0]}"` }; }
  if (metin) {
    const say = Object.fromEntries(Object.entries(METIN).map(([k, re]) => [k, (String(metin).match(re) || []).length]));
    const [k, n] = Object.entries(say).sort((a, b) => b[1] - a[1])[0];
    const ikinci = Object.values(say).sort((a, b) => b - a)[1] || 0;
    // metinden karar yalniz acik ustunlukle: en az 6 kez ve ikincinin iki katindan fazla (bir pizzacinin menusundeki tek burger onu burgerci yapmaz)
    if (n >= 6 && n > ikinci * 2) return { kategori: k, neden: `sitenin metninde ${n} kez (${Object.entries(say).map(([a, b]) => `${a} ${b}`).join(', ')})` };
  }
  return { kategori: null, neden: 'kategori ipucu yok' };
}

// lead: lead/tara ciktisi ya da cikarici lead'i; R: cikarici.json (varsa, metin ipucu icin)
export function sablonSec(lead = {}, R = null) {
  const sektor = lead.sektor || 'restoran';
  if (sektor !== 'restoran' && SEKTOR[sektor]) return { sablon: 'eski', neden: `sektor profili: ${sektor} (eski yol, degismez)` };
  if (sektor !== 'restoran') return { sablon: 'eski', neden: `restoran disi sektor: ${sektor}` };
  const metin = R ? [R.tagline, R.name && R.name.n, ...(((R.ek && R.ek.paragraflar) || []).slice(0, 6)), ...((R.menu && R.menu.items) || []).map((x) => `${x.n} ${x.cat || ''}`)].filter(Boolean).join(' \n ') : '';
  const k = kategoriOf({ cuisine: lead.mutfak || lead.cuisine || '', ad: lead.name || (R && R.name && R.name.n) || '', metin });
  if (k.kategori) return { sablon: k.kategori, neden: k.neden };
  return { sablon: 'v5', neden: `restoran/bar (${k.neden}); dil-v5 referans dilini secer` };
}
