// Ucretsiz (acik lisansli) font katalogu: fontsource API'sinden lisans, agirlik, alt kume bilgisi + elle verilen sinif ve karakter.
// node uyarla/data/katalog-kur.mjs  -> data/font-katalog.json (bir kez; sonuc kalir, yeniden istek gerekmez)
// sinif: serif-old (garalde) | serif-trans | serif-didone | serif-soft | slab | geo | hum | neo | round | cond | wide | script | mono | caps
// w: ortalama harf genisligi (em), h1 boyunu tahmin etmek icin; xh: x-yuksekligi l/m/h; rol: d = baslik, t = metin
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROWS = [
  ['playfair-display', 'serif-didone', 'zarif', 0.54, 'm', 'dt'], ['playfair', 'serif-didone', 'zarif', 0.54, 'm', 'dt'], ['bodoni-moda', 'serif-didone', 'zarif', 0.55, 'm', 'd'], ['noto-serif-display', 'serif-didone', 'zarif', 0.5, 'm', 'd'],
  ['dm-serif-display', 'serif-didone', 'guclu', 0.5, 'm', 'd'], ['abril-fatface', 'serif-didone', 'guclu', 0.55, 'm', 'd'], ['gloock', 'serif-didone', 'guclu', 0.52, 'm', 'd'],
  ['cormorant-garamond', 'serif-old', 'zarif', 0.42, 'l', 'd'], ['cormorant', 'serif-old', 'zarif', 0.42, 'l', 'd'], ['eb-garamond', 'serif-old', 'klasik', 0.46, 'l', 'dt'], ['libre-caslon-text', 'serif-old', 'klasik', 0.5, 'm', 'dt'],
  ['crimson-pro', 'serif-old', 'klasik', 0.44, 'm', 'dt'], ['spectral', 'serif-trans', 'sade', 0.48, 'm', 'dt'], ['libre-baskerville', 'serif-trans', 'klasik', 0.56, 'h', 'dt'], ['lora', 'serif-trans', 'sicak', 0.5, 'm', 'dt'],
  ['tinos', 'serif-trans', 'klasik', 0.46, 'm', 'dt'], ['gelasio', 'serif-trans', 'klasik', 0.52, 'h', 'dt'], ['merriweather', 'serif-trans', 'saglam', 0.58, 'h', 'dt'],
  ['fraunces', 'serif-soft', 'sicak', 0.52, 'm', 'dt'], ['young-serif', 'serif-soft', 'guclu', 0.54, 'm', 'd'], ['instrument-serif', 'serif-didone', 'zarif', 0.4, 'm', 'd'],
  ['cinzel', 'caps', 'zarif', 0.68, 'm', 'd'], ['marcellus', 'caps', 'zarif', 0.56, 'm', 'd'],
  ['arvo', 'slab', 'saglam', 0.56, 'h', 'dt'], ['zilla-slab', 'slab', 'sicak', 0.5, 'm', 'dt'], ['roboto-slab', 'slab', 'saglam', 0.52, 'h', 'dt'], ['bitter', 'slab', 'sicak', 0.52, 'h', 'dt'], ['rokkitt', 'slab', 'saglam', 0.42, 'm', 'd'],
  ['jost', 'geo', 'modern', 0.5, 'm', 'dt'], ['montserrat', 'geo', 'modern', 0.6, 'h', 'dt'], ['poppins', 'geo', 'dost', 0.58, 'h', 'dt'], ['outfit', 'geo', 'modern', 0.5, 'm', 'dt'], ['urbanist', 'geo', 'modern', 0.5, 'm', 'dt'],
  ['lexend', 'geo', 'dost', 0.58, 'h', 'dt'], ['figtree', 'geo', 'dost', 0.52, 'h', 'dt'], ['plus-jakarta-sans', 'geo', 'modern', 0.54, 'h', 'dt'], ['dm-sans', 'geo', 'sade', 0.52, 'h', 'dt'], ['red-hat-display', 'geo', 'modern', 0.54, 'h', 'dt'],
  ['league-spartan', 'geo', 'guclu', 0.54, 'h', 'd'], ['josefin-sans', 'geo', 'zarif', 0.46, 'l', 'dt'], ['questrial', 'geo', 'sade', 0.54, 'h', 'dt'], ['sora', 'wide', 'modern', 0.62, 'h', 'dt'], ['raleway', 'geo', 'zarif', 0.54, 'm', 'dt'], ['manrope', 'geo', 'sade', 0.54, 'h', 'dt'],
  ['nunito-sans', 'hum', 'dost', 0.52, 'h', 'dt'], ['lato', 'hum', 'sade', 0.5, 'm', 'dt'], ['open-sans', 'hum', 'sade', 0.54, 'h', 'dt'], ['source-sans-3', 'hum', 'sade', 0.48, 'm', 'dt'], ['cabin', 'hum', 'sicak', 0.5, 'm', 'dt'], ['mulish', 'hum', 'sade', 0.52, 'h', 'dt'], ['karla', 'hum', 'sade', 0.5, 'm', 'dt'],
  ['inter', 'neo', 'sade', 0.54, 'h', 'dt'], ['arimo', 'neo', 'sade', 0.54, 'h', 'dt'], ['albert-sans', 'neo', 'sade', 0.52, 'h', 'dt'], ['public-sans', 'neo', 'sade', 0.54, 'h', 'dt'], ['ibm-plex-sans', 'neo', 'sade', 0.54, 'h', 'dt'], ['work-sans', 'neo', 'sade', 0.56, 'h', 'dt'], ['archivo', 'neo', 'saglam', 0.54, 'h', 'dt'],
  ['onest', 'neo', 'sade', 0.52, 'h', 'dt'], ['space-grotesk', 'neo', 'teknik', 0.56, 'h', 'dt'], ['bricolage-grotesque', 'neo', 'guclu', 0.54, 'h', 'dt'], ['overpass', 'neo', 'sade', 0.52, 'h', 'dt'], ['rubik', 'round', 'dost', 0.54, 'h', 'dt'], ['syne', 'wide', 'guclu', 0.6, 'm', 'd'],
  ['nunito', 'round', 'dost', 0.52, 'h', 'dt'], ['quicksand', 'round', 'dost', 0.54, 'h', 'dt'],
  ['barlow', 'neo', 'saglam', 0.48, 'h', 'dt'], ['barlow-condensed', 'cond', 'saglam', 0.36, 'h', 'd'], ['oswald', 'cond', 'saglam', 0.4, 'h', 'd'], ['bebas-neue', 'cond', 'guclu', 0.36, 'h', 'd'], ['anton', 'cond', 'guclu', 0.38, 'h', 'd'],
  ['league-gothic', 'cond', 'saglam', 0.32, 'h', 'd'], ['antonio', 'cond', 'saglam', 0.38, 'h', 'd'], ['archivo-narrow', 'cond', 'sade', 0.42, 'h', 'dt'], ['big-shoulders-display', 'cond', 'saglam', 0.38, 'h', 'd'],
  ['pacifico', 'script', 'dost', 0.5, 'h', 'd'], ['dancing-script', 'script', 'dost', 0.42, 'm', 'd'], ['satisfy', 'script', 'sicak', 0.42, 'm', 'd'], ['great-vibes', 'script', 'zarif', 0.36, 'l', 'd'], ['kaushan-script', 'script', 'dost', 0.44, 'm', 'd'],
  ['yellowtail', 'script', 'klasik', 0.4, 'm', 'd'], ['lobster', 'script', 'dost', 0.48, 'm', 'd'], ['sacramento', 'script', 'zarif', 0.3, 'l', 'd'], ['caveat', 'script', 'dost', 0.36, 'm', 'd'],
  ['dm-mono', 'mono', 'teknik', 0.6, 'm', 'dt'], ['space-mono', 'mono', 'teknik', 0.6, 'm', 'dt'], ['ibm-plex-mono', 'mono', 'teknik', 0.6, 'm', 'dt'], ['jetbrains-mono', 'mono', 'teknik', 0.6, 'm', 'dt'],
];
const OK_LIC = /^(OFL|Apache|Ubuntu|MIT)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FILE = path.join(HERE, 'font-katalog.json');
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
for (const [id, cls, mood, w, xh, role] of ROWS) {
  if (out[id]) continue;
  let j = null;
  for (let t = 0; t < 4 && !j; t++) { try { const r = await fetch(`https://api.fontsource.org/v1/fonts/${id}`, { signal: AbortSignal.timeout(15000) }); if (r.ok) j = await r.json(); else { console.log(id, r.status); await sleep(1500 * (t + 1)); } } catch { await sleep(1500); } }
  await sleep(500);
  if (!j) { console.log('YOK', id); continue; }
  const tr = j.subsets.includes('latin-ext');
  if (!OK_LIC.test(j.license || '')) { console.log('LISANS', id, j.license); continue; }
  out[id] = { family: j.family, cls, mood, w, xh, role, category: j.category, license: j.license, weights: j.weights, styles: j.styles, subsets: j.subsets.filter((s) => /^latin(-ext)?$/.test(s)), turkce: tr, variable: !!j.variable };
  if (!tr) console.log('latin-ext yok', id);
}
fs.writeFileSync(path.join(HERE, 'font-katalog.json'), JSON.stringify(out, null, 1));
console.log('kaydedildi', Object.keys(out).length, 'font');
