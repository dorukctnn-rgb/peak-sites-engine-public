// LEAD BULUCU (1/3): OpenStreetMap Overpass'tan ulke x sektor isletme listesi.  Ucretsiz, anahtar yok; Overpass kullanim kurallarina uyulur
// (tek sorgu akisi, sorgular arasi bekleme, acik user-agent).  Yalniz "website" etiketi olan isletmeler alinir: hedefimiz siteyi YENILEMEK.
//   node lead/osm.mjs --ulke GB --sektor konaklama [--alan "Cornwall"] [--max 400] [--cikti calisma/lead/GB-konaklama.jsonl]
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
export function sorgu(ulke, sektor, { alan } = {}) {
  const S = SEKTORLER[sektor]; if (!S) throw new Error(`bilinmeyen sektor: ${sektor}`);
  // alan: il/eyalet kodu (ISO3166-2, ornek TR-07 Antalya) ya da ad
  const area = alan && /^[A-Z]{2}-[0-9A-Z]{1,3}$/.test(alan)
    ? `area["ISO3166-2"="${alan}"]->.a;`
    : alan
      ? `area["ISO3166-1"="${ulke}"][admin_level=2]->.u;area["name"="${alan.replace(/"/g, '')}"](area.u)->.a;`
      : `area["ISO3166-1"="${ulke}"][admin_level=2]->.a;`;
  const parts = S.osm.map((f) => `nwr${f}["website"](area.a);`).join('');
  return `[out:json][timeout:180];${area}(${parts});out center tags;`;
}

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
    lat: el.lat ?? (el.center && el.center.lat) ?? null, lon: el.lon ?? (el.center && el.center.lon) ?? null,
    elendi: why || null,
    ...(sektor === 'restoran' ? { mutfak: temiz(t.cuisine), amenity: t.amenity || null } : {}),
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
  // TR: yemekhane, kantin, katering, okul/universite/hastane/havalimani; otel ve tatil koyu restoranlari (Doruk 9 Kas: otel yok)
  if (sektor === 'restoran' && /(?<!\p{L})(yemekhane|kantin|katering|okul|[üu]niversite|hastane|havaliman[ıi]|otel|hotel|resort|tatil k[öo]y[üu]|holiday village)(?!\p{L})/iu.test(`${name} ${t.operator || ''} ${website}`)) return 'restoran degil (otel, kantin, katering, okul, havalimani)';
  if (t.disused || t['disused:shop'] || t['disused:tourism'] || /^(yes|true)$/i.test(t.abandoned || '')) return 'kapali';
  return null;
}

export async function overpass(q, { tries = 4, log = () => {} } = {}) {
  for (let i = 0; i < tries; i++) {
    const url = URLS[i % URLS.length];
    try {
      const r = await fetch(url, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(240000) });
      if (r.ok) return await r.json();
      log(`overpass ${r.status} (${url}), bekleniyor`);
    } catch (e) { log(`overpass hata ${e.name} (${url})`); }
    await sleep(20000 * (i + 1));
  }
  throw new Error('overpass yanit vermedi');
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
