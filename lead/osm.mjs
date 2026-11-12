// LEAD BULUCU (1/3): OpenStreetMap Overpass'tan ulke x sektor isletme listesi.  Ucretsiz, anahtar yok; Overpass kullanim kurallarina uyulur
// (tek sorgu akisi, sorgular arasi bekleme, acik user-agent).  Yalniz "website" etiketi olan isletmeler alinir: hedefimiz siteyi YENILEMEK.
//   node lead/osm.mjs --ulke GB --sektor konaklama [--alan "Cornwall"] [--max 400] [--cikti calisma/lead/GB-konaklama.jsonl]
// Restoran ailesi (12 Kas 2026): amenity=restaurant|fast_food|bar|pub|cafe|ice_cream ve shop=bakery|pastry|confectionery (lead/sektorler.mjs SEKTORLER.restoran.osm).
// BUYUK OTEL YOK: tourism=hotel hic alinmaz; zincir (brand / brand:wikidata / bilinen zincir adi) ve oda sayisi 25'ten buyuk olanlar elenir.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEKTORLER, ULKELER, SEKTOR_ZINCIR, TR_ZINCIR, kapaliUlke } from './sektorler.mjs';

const UA = 'PeakAppsStudio-leads/1.0 (+https://peakappsstudio.com/web/; info@peakappsstudio.com)';
const URLS = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// zincir ve buyuk isletme adlari (konaklama); kucuk harf, kelime sinirli arama
export const ZINCIR = /\b(premier inn|travelodge|holiday inn|best western|ibis|mercure|novotel|hilton|marriott|sheraton|radisson|crowne plaza|hampton|doubletree|ramada|days inn|quality inn|comfort inn|choice hotels|accor|ihg|wyndham|motel 6|super 8|jucy|yha|hostelling|nomads|base backpackers|generator|meininger|airbnb|booking\.com|oyo|leonardo|jurys|maldron|clayton|dalata|village hotel|hotel du vin|malmaison|mantra|quest apartment|oaks hotel|adina|medina|meriton|swiss-?belhotel|scenic hotel|distinction hotel|heritage hotel|millennium|copthorne|kingsgate|pullman|sofitel|rydges|vibe hotel|crown|sky ?city|center ?parcs|parkdean|haven holidays|hoseasons|sykes|cottages\.com|vrbo|stayz|bookabach|holiday parks? (?:nz|new zealand)|top 10 holiday park|big4|discovery parks|nrma parks|reflections holiday parks)\b/i;

// sorgu metni: ulke alani (ISO), istege bagli alt alan (ad), sektorun etiket filtreleri; yalniz website etiketi olanlar
// kutu: [guney, bati, kuzey, dogu] (12 Kas 2026, parcali sorgu): ulke alaninin yalniz bu dikdortgendeki kismi; zaman: sunucu tarafi sure siniri (sn)
export function sorgu(ulke, sektor, { alan, kutu = null, zaman = 180 } = {}) {
  const S = SEKTORLER[sektor]; if (!S) throw new Error(`bilinmeyen sektor: ${sektor}`);
  // alan: il/eyalet kodu (ISO3166-2, ornek TR-07 Antalya) ya da ad
  const area = alan && /^[A-Z]{2}-[0-9A-Z]{1,3}$/.test(alan)
    ? `area["ISO3166-2"="${alan}"]->.a;`
    : alan
      ? `area["ISO3166-1"="${ulke}"][admin_level=2]->.u;area["name"="${alan.replace(/"/g, '')}"](area.u)->.a;`
      : `area["ISO3166-1"="${ulke}"][admin_level=2]->.a;`;
  const bb = kutu ? `(${kutu.map((x) => +Number(x).toFixed(4)).join(',')})` : '';
  const parts = S.osm.map((f) => `nwr${f}["website"](area.a)${bb};`).join('');
  return `[out:json][timeout:${Math.round(zaman)}];${area}(${parts});out center tags;`;
}

// HEDEFLI PIZZA + BURGER SORGUSU (12 Kas 2026, Doruk: "pizzacı ve hamburgercilere çok ağırlık ver"): amenity=restaurant|fast_food ve (cuisine~pizza|burger ya da adinda
// pizz/burger), website YA DA contact:website (ana sorgu yalniz website etiketini aliyordu).  Hafif sorgu; buyuk ulkede yine parcali (bulParcali hedef 'pizza-burger').
export function sorguPB(ulke, { kutu = null, zaman = 100 } = {}) {
  const area = `area["ISO3166-1"="${ulke}"][admin_level=2]->.a;`;
  const bb = kutu ? `(${kutu.map((x) => +Number(x).toFixed(4)).join(',')})` : '';
  const A = '["amenity"~"^(restaurant|fast_food)$"]';
  const parts = ['["cuisine"~"pizza|burger",i]', '["name"~"pizz|burger",i]'].flatMap((f) => ['["website"]', '["contact:website"]'].map((w) => `nwr${A}${f}${w}(area.a)${bb};`)).join('');
  return `[out:json][timeout:${Math.round(zaman)}];${area}(${parts});out center tags;`;
}
// hedefli sorgunun izgarasi: sorgu hafif, parca az (TR yine bolunur)
export const PB_IZGARA = { TR: [2, 2], AU: [2, 2], GB: [2, 1] };

const temiz = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const siteDuzelt = (u) => { let s = temiz(u).split(/[;\s]/)[0]; if (!s) return ''; if (!/^https?:\/\//i.test(s)) s = `http://${s}`; try { const x = new URL(s); return /^(www\.)?(facebook|instagram|booking|airbnb|tripadvisor|expedia|google|linktr\.ee|wix\.com$|yemeksepeti|getir|tgoyemek|trendyol|foursquare|zomato|wa\.me|api\.whatsapp)/i.test(x.host) ? '' : x.href; } catch { return ''; } };

// Overpass ogesi -> lead (e-posta etiketi varsa alinir; siteden bulunacak e-posta ayri adimdir)
export function leadOf(el, ulke, sektor) {
  const t = el.tags || {};
  const name = temiz(t.name || t['name:en']);
  const website = siteDuzelt(t.website || t['contact:website'] || t.url);
  if (!name || !website) return null;
  const why = elenme(t, name, website, sektor);
  return {
    id: `${ulke}-${el.type[0]}${el.id}`, osm: `${el.type}/${el.id}`, ulke, sektor, tur: SEKTORLER[sektor].tur(t), name, website,
    phone: temiz(t.phone || t['contact:phone']), email: temiz(t.email || t['contact:email']).toLowerCase(),
    city: temiz(t['addr:city'] || t['addr:town'] || t['addr:village'] || t['addr:suburb'] || t['addr:province']), ilce: temiz(t['addr:district'] || t['addr:suburb'] || '') || null, street: temiz([t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ')), postcode: temiz(t['addr:postcode']),
    rooms: Number(t.rooms || t.beds || 0) || null, stars: Number(t.stars || 0) || null,
    // 12 Kas 2026 (kapi verimi): sitede saat ya da adres yoksa OSM'nin kendi etiketleri gercek kaynaktir (uyarla/lib/osm-saat.mjs, osmAdresKur); kayitta kaynak yazilir
    ...osmEkAlanlari(t),
    lat: el.lat ?? (el.center && el.center.lat) ?? null, lon: el.lon ?? (el.center && el.center.lon) ?? null,
    elendi: why || null,
    ...(sektor === 'restoran' ? { mutfak: temiz(t.cuisine), amenity: t.amenity || null, dukkan: t.shop || null } : {}),
  };
}

export function elenme(t, name, website, sektor) {
  if (t.brand || t['brand:wikidata'] || t['operator:wikidata']) return 'zincir (brand etiketi)';
  if (ZINCIR.test(`${name} ${t.operator || ''} ${website}`) || SEKTOR_ZINCIR.test(`${name} ${t.operator || ''}`) || TR_ZINCIR.test(`${name} ${t.operator || ''}`)) return 'zincir ya da platform';
  if (sektor === 'konaklama') {
    if (t.tourism === 'hotel') return 'otel (buyuk otel yok)';
    const n = Number(t.rooms || 0); if (n > 25) return `oda sayisi ${n} (buyuk)`;
  }
  if (sektor === 'guzellik' && /\b(supplies|supplier|wholesale|distribut\w*|academy|school|training|education|college|courses?|tanning|sun ?bed|sun bar|clinic|medical|surgery|dermatolog\w*|aesthetic doctor)\b/i.test(`${name} ${website}`)) return 'salon degil (malzeme, okul, solaryum ya da klinik)';
  if (sektor === 'restoran' && /\b(catering|food truck|caravan|vending|canteen|hospital|university|college|school|airport)\b/i.test(`${name} ${t.operator || ''}`)) return 'restoran degil (kantin, katering, okul, havalimani)';
  // pastane, firin ve tatlici (12 Kas 2026): toptan satici, fabrika ve malzeme tedarikcisi pastane degildir
  if (sektor === 'restoran' && /\b(wholesale|wholesaler|suppliers?|supplies|distribut\w*|manufactur\w*|factory)\b/i.test(`${name} ${t.operator || ''}`)) return 'restoran degil (toptan, fabrika, malzeme tedarikcisi)';
  if (sektor === 'restoran' && /(?<!\p{L})(toptan|fabrika(?:s[ıi])?|imalat[çc][ıi]?)(?!\p{L})/iu.test(`${name} ${t.operator || ''}`)) return 'restoran degil (toptan, fabrika, malzeme tedarikcisi)';
  // TR: yemekhane, kantin, katering, okul/universite/hastane/havalimani; otel ve tatil koyu restoranlari (Doruk 9 Kas: otel yok)
  if (sektor === 'restoran' && /(?<!\p{L})(yemekhane|kantin|katering|okul|[üu]niversite|hastane|havaliman[ıi]|otel|hotel|resort|tatil k[öo]y[üu]|holiday village)(?!\p{L})/iu.test(`${name} ${t.operator || ''} ${website}`)) return 'restoran degil (otel, kantin, katering, okul, havalimani)';
  if (t.disused || t['disused:shop'] || t['disused:tourism'] || /^(yes|true)$/i.test(t.abandoned || '')) return 'kapali';
  return null;
}

// Overpass sunucusu sorgu suresini (ya da bellegi) asinca HTTP 200 ile BOS bir sonuc ve "remark: runtime error ..." doner (12 Kas: AU ve GB restoran listesi
// her turda "0 lead" diye gecti, dosya yazilmadi, ertesi tur ayni sorgu yine bosa gitti).  Bu yanit HATADIR: e.agir = true (sorgu bolunmeli, ayni sorgu tekrar denenmez).
export function overpassUyari(j) {
  const r = String((j && j.remark) || '');
  return /runtime error|timed out|out of memory|runtime limit|Dispatcher|too many/i.test(r) ? r.slice(0, 120) : null;
}
// Yanit vermeyen sorgu: son deneme ag zaman asimi ya da 504 (gecit zaman asimi) ise e.yavas = true; parcali sorgu bu parcayi da boler (12 Kas olcumu: TR'nin dortte biri bile
// 504 / 125 sn zaman asimi verdi).
export async function overpass(q, { tries = 4, log = () => {}, zamanMs = 240000, bekleMs = 20000, ilk = 0 } = {}) {
  let son = '';
  for (let i = 0; i < tries; i++) {
    const url = URLS[(ilk + i) % URLS.length];
    try {
      const r = await fetch(url, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(zamanMs) });
      if (r.ok) {
        const j = await r.json(); const u = overpassUyari(j);
        if (u) { const e = new Error(`overpass sorgusu agir: ${u}`); e.agir = true; throw e; }
        return j;
      }
      son = String(r.status); log(`overpass ${r.status} (${url}), bekleniyor`);
    } catch (e) { if (e.agir) throw e; son = e.name || 'hata'; log(`overpass hata ${e.name} (${url})`); }
    if (i < tries - 1) await sleep(bekleMs * (i + 1));
  }
  const e = new Error(`overpass yanit vermedi (${son})`); e.yavas = /^(504|TimeoutError|AbortError)$/.test(son); throw e;
}

// ---- 12 Kas 2026: OSM'nin saat ve adres etiketleri (kapi verimi) ----
// opening_hours: sitede saat yoksa gercek kaynak (uyarla/lib/osm-saat.mjs cozer; cozulemeyen bicim kullanilmaz).  addr:place / addr:full: sokak etiketi olmayan adresler.
export function osmEkAlanlari(t = {}) {
  return {
    saat: temiz(t.opening_hours) || null,
    saatTarih: temiz(t['check_date:opening_hours'] || t['opening_hours:check_date'] || t.check_date) || null,
    yer: temiz(t['addr:place']) || null, adresTam: temiz(t['addr:full']) || null,
  };
}

// Lead'in OSM adres etiketlerinden sayfa adresi.  Kabul: sokak (ya da addr:place / addr:full) + en az bir ust parca (ilce, sehir, posta kodu) VE
// (bir numara ya da koordinat).  Numarasiz sokak adresi yalniz koordinatla kabul edilir: harita baglantisi koordinattan kurulur, ziyaretci yine tam yere gider.
// -> { text, konum: { lat, lon } | null, kaynak } | null
export function osmAdresKur(l = {}) {
  const sayi = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const konum = Number.isFinite(sayi(l.lat)) && Number.isFinite(sayi(l.lon)) ? { lat: +sayi(l.lat).toFixed(6), lon: +sayi(l.lon).toFixed(6) } : null;
  const sokak = temiz(l.street) || temiz(l.yer);
  const ust = [l.ilce, l.city, l.postcode].map(temiz).filter(Boolean);
  const gorulen = new Set(); const parca = [];
  for (const x of [sokak, ...ust]) { if (!x) continue; const k = x.toLocaleLowerCase('tr'); if (gorulen.has(k)) continue; gorulen.add(k); parca.push(x); }
  let text = parca.join(', ');
  const tam = temiz(l.adresTam); const sehir = temiz(l.city);
  if (tam && tam.length >= 8 && (!sokak || tam.length > text.length)) text = !sehir || tam.toLocaleLowerCase('tr').includes(sehir.toLocaleLowerCase('tr')) ? tam : `${tam}, ${sehir}`;
  if (!(sokak || tam) || text.split(',').length < 2) return null;
  if (!/\d/.test(text) && !konum) return null;
  return { text, konum, kaynak: `osm (addr etiketleri${l.osm ? `, ${l.osm}` : ''}${konum ? ', koordinat' : ''})` };
}

// ---- PARCALI LISTE (12 Kas 2026): buyuk ulkeler tek sorguda Overpass'in sure sinirina takiliyordu (TR her turda 8 dk zaman asimi, AU ve GB bos yanit) ----
// Ulke kutusu izgaraya bolunur; her parca ulke alani + dikdortgenle sorulur ([timeout:100]).  Agir parca (sunucu zaman asimi) dorde bolunur (en kucuk ~0,25 derece).
// Ilerleme dosyasi (lead/<ULKE>-<sektor>.parca.json) turlar arasinda tasinir: bitmemis parcalar sonraki turda surer, eski liste o sirada kullanilmaya devam eder.
// Butun parcalar bitince liste bir kerede yazilir (alan adina gore tekil, bul() ile ayni kural).
export const KUTU = {
  TR: { kutu: [35.8, 25.6, 42.2, 44.9], izgara: [3, 4] },
  AU: { kutu: [-44.0, 112.0, -10.0, 154.0], izgara: [4, 4] },
  GB: { kutu: [49.8, -8.7, 60.9, 1.8], izgara: [4, 3] },
  IE: { kutu: [51.3, -10.7, 55.5, -5.9], izgara: [1, 2] },
  NZ: { kutu: [-47.4, 166.3, -34.3, 178.7], izgara: [2, 1] },
  SG: { kutu: [1.15, 103.6, 1.48, 104.1], izgara: [1, 1] },
};
export function izgara([s, w, n, e], [sat, sut]) {
  const out = []; const dy = (n - s) / sat; const dx = (e - w) / sut;
  for (let i = 0; i < sat; i++) for (let j = 0; j < sut; j++) out.push([s + i * dy, w + j * dx, s + (i + 1) * dy, w + (j + 1) * dx].map((x) => +x.toFixed(4)));
  return out;
}
export const bolunur = ([s, w, n, e]) => n - s > 0.5 || e - w > 0.5;
const PARCA_SURUM = 1;
const jsonOku = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
export function tekille(leadler) {
  const seen = new Set(); const out = [];
  for (const l of leadler) { let host = ''; try { host = new URL(l.website).host.replace(/^www\./, ''); } catch { continue; } if (seen.has(host)) continue; seen.add(host); out.push({ ...l, host }); }
  return out;
}
// -> { tamam: true, leads, parca } | { tamam: false, leads: null, parca: 'biten/toplam', hata? }
// hedef: null (butun restoran ailesi, sorgu()) | 'pizza-burger' (sorguPB, PB_IZGARA)
export async function bulParcali(ulke, sektor, { ilerleme = null, bitis = Infinity, log = () => {}, sorgula = overpass, bekleMs = 3000, parcaMs = 130000, simdi = () => Date.now(), hedef = null } = {}) {
  if (!ULKELER[ulke] || kapaliUlke(ulke)) throw new Error(`ulke hedefte degil: ${ulke}`);
  const pb = hedef === 'pizza-burger'; const kur = pb ? (u, _s, o) => sorguPB(u, o) : sorgu;
  const K0 = KUTU[ulke]; if (!K0 && !pb) return { tamam: true, leads: await bul(ulke, sektor, { log }), parca: '1/1' };
  const K = K0 ? { kutu: K0.kutu, izgara: pb ? PB_IZGARA[ulke] || [1, 1] : K0.izgara } : { kutu: [-90, -180, 90, 180], izgara: [1, 1] };
  let P = ilerleme ? jsonOku(ilerleme, null) : null;
  if (!P || P.surum !== PARCA_SURUM || !Array.isArray(P.bekleyen)) P = { surum: PARCA_SURUM, ulke, sektor, basla: new Date(simdi()).toISOString(), bekleyen: izgara(K.kutu, K.izgara), biten: 0, bolunen: 0, oge: {} };
  const kaydet = () => { if (ilerleme) { fs.mkdirSync(path.dirname(ilerleme), { recursive: true }); fs.writeFileSync(ilerleme, JSON.stringify(P)); } };
  // her deneme tek sunucu, en cok parcaMs (sure butcesi asilmaz); yanit vermeyen sunucuda siradaki sunucu denenir, 3 basarisiz denemede tur biter (parca sonraki turda)
  let hata = null; let sira = 0; let basarisiz = 0;
  while (P.bekleyen.length) {
    if (simdi() + parcaMs > bitis) break;
    const k = P.bekleyen[0];
    try {
      const j = await sorgula(kur(ulke, sektor, { kutu: k, zaman: 100 }), { tries: 1, zamanMs: parcaMs - 5000, ilk: sira++, log });
      for (const el of j.elements || []) { const l = leadOf(el, ulke, sektor); if (l) P.oge[l.id] = l; }
      P.bekleyen.shift(); P.biten++; basarisiz = 0;
    } catch (e) {
      if ((e.agir || e.yavas) && bolunur(k)) { P.bekleyen.shift(); P.bekleyen.unshift(...izgara(k, [2, 2])); P.bolunen++; log(`osm ${ulke}-${sektor}: parca bolundu (${e.agir ? 'agir' : 'yavas'}) ${k.join(',')}`); }
      else if (e.agir) { P.bekleyen.shift(); P.biten++; P.atlanan = [...(P.atlanan || []), k]; log(`osm ${ulke}-${sektor}: en kucuk parca da agir, atlandi ${k.join(',')}`); }
      else if (++basarisiz >= 3) { hata = String(e.message).slice(0, 80); kaydet(); break; }
    }
    kaydet();
    if (P.bekleyen.length && bekleMs) await sleep(bekleMs);
  }
  const toplam = P.biten + P.bekleyen.length;
  if (P.bekleyen.length) return { tamam: false, leads: null, parca: `${P.biten}/${toplam}`, ...(hata ? { hata } : {}) };
  const leads = tekille(Object.values(P.oge));
  if (ilerleme) fs.rmSync(ilerleme, { force: true });
  return { tamam: true, leads, parca: `${P.biten}/${toplam}` };
}

// ---- ID ILE EK SORGU (12 Kas 2026): eski listelerde (opening_hours alani yokken cekilmis) saat ve adres etiketleri lead kimligiyle tek sorguda alinir ----
export function ekSorgu(osmler) {
  const g = { node: [], way: [], relation: [] };
  for (const o of osmler) { const m = /^(node|way|relation)\/(\d+)$/.exec(String(o || '')); if (m) g[m[1]].push(m[2]); }
  const p = Object.entries(g).filter(([, v]) => v.length).map(([t, v]) => `${t}(id:${v.join(',')});`).join('');
  return p ? `[out:json][timeout:60];(${p});out tags center;` : null;
}
// leads: [{ osm: 'node/123' }] -> Map(osm -> { saat, saatTarih, yer, adresTam, street, city, ilce, postcode, lat, lon })
export async function osmEk(leads, { sorgula = overpass, log = () => {}, parti = 60, tries = 4, zamanMs = 45000 } = {}) {
  const osmler = [...new Set(leads.map((l) => l && l.osm).filter((o) => /^(node|way|relation)\/\d+$/.test(String(o || ''))))];
  const out = new Map();
  for (let i = 0; i < osmler.length; i += parti) {
    const q = ekSorgu(osmler.slice(i, i + parti)); if (!q) continue;
    const j = await sorgula(q, { tries, zamanMs, bekleMs: 3000, ilk: 1, log }); // id sorgusu hafiftir: saglikli sunucu birkac saniyede doner, yavas sunucu beklenmez
    for (const el of j.elements || []) {
      const t = el.tags || {};
      out.set(`${el.type}/${el.id}`, { ...osmEkAlanlari(t), street: temiz([t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ')), city: temiz(t['addr:city'] || t['addr:town'] || t['addr:village'] || t['addr:suburb'] || t['addr:province']), ilce: temiz(t['addr:district'] || t['addr:suburb'] || '') || null, postcode: temiz(t['addr:postcode']), lat: el.lat ?? (el.center && el.center.lat) ?? null, lon: el.lon ?? (el.center && el.center.lon) ?? null });
    }
  }
  return out;
}
// ek sorgu sonucunu lead'e isle: saat alanlari (lead'de yoksa), adres ve koordinat yalniz bos alanlara; ek kaydi yoksa 'yok' (tekrar sorulmaz)
export function osmEkUygula(l, e) {
  const bos = (v) => v === undefined || v === null || v === '';
  if (!e) return { ...l, osmEk: 'yok', saat: bos(l.saat) ? null : l.saat };
  const o = { ...l, osmEk: 'tamam' };
  for (const k of ['saat', 'saatTarih', 'yer', 'adresTam']) if (bos(o[k])) o[k] = e[k] ?? null;
  for (const k of ['street', 'city', 'ilce', 'postcode', 'lat', 'lon']) if (bos(o[k]) && !bos(e[k])) o[k] = e[k];
  return o;
}

export async function bul(ulke, sektor, { alan, max = Infinity, log = () => {} } = {}) {
  if (!ULKELER[ulke] || kapaliUlke(ulke)) throw new Error(`ulke hedefte degil: ${ulke}`);
  const j = await overpass(sorgu(ulke, sektor, { alan }), { log });
  const seen = new Set(); const out = [];
  for (const el of j.elements || []) {
    const l = leadOf(el, ulke, sektor); if (!l) continue;
    const host = new URL(l.website).host.replace(/^www\./, '');
    if (seen.has(host)) continue; seen.add(host);
    out.push({ ...l, host });
    if (out.length >= max) break;
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const ulke = arg('--ulke'); const sektor = arg('--sektor');
  const leads = await bul(ulke, sektor, { alan: arg('--alan'), max: Number(arg('--max', 0)) || Infinity, log: console.error });
  const f = arg('--cikti', `calisma/lead/${ulke}-${sektor}.jsonl`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, leads.map((x) => JSON.stringify(x)).join('\n') + '\n');
  console.log(`${ulke} ${sektor}: ${leads.length} lead (elenen ${leads.filter((x) => x.elendi).length}) -> ${f}`);
}
