// SEKTOR: KUCUK KONAKLAMA (pansiyon, B&B, apart, tatil evi, motel).  Buyuk otel yok (lead/osm.mjs eler).
// Restoran uretecinin ayni ilkeleri: isletmenin KENDI sitesinden; logo, font, renk, fotograf onun; uydurma yok.
//   cikar ek():   gercek rezervasyon motoru baglantisi (freetobook, eviivo, Little Hotelier ...), oda sayfalari -> oda adi + "from" fiyat + ozellik,
//                 olanaklar (yalniz kendi metninde gecenler, kanit cumlesiyle), giris/cikis saatleri
//   uret model(): sayfa icin odalar, olanaklar, ilk ekran bilgileri (giris/cikis, "from" fiyat, adres, telefon), ana eylem hedefi
//   kapi kural(): oda listesi YA DA gercek rezervasyon baglantisi yoksa "gozden gecir" (maile girmez)
import { decode, htmlToLines } from '../v2lib/scrape.mjs';

export const AD = 'konaklama';
export const SAAT_YOK = true; // pansiyonun "saatleri" yok; giris/cikis gosterilir

export const ETIKET = {
  en: {
    book: 'Check availability', bookShort: 'Book', menu: 'Rooms', seeMenu: 'See the rooms', fullMenu: 'See every room', gallery: 'Gallery', visit: 'Getting here',
    galleryH: ['A look', 'around'], bookH: ['Check', 'availability'], bookSub: 'Pick your dates and send a request. You hear back directly from the house, with no booking site in between.',
    people: 'Guests', day: 'Arrival', time: 'Nights', note: 'Note (optional)', notePh: 'Arrival time, a cot, a dog, dietary needs...', send: 'Send request', tel: 'Phone', email: 'E-mail',
    replyLine: 'The house replies by e-mail or phone.', realLineGeneric: 'On the live site this request reaches the house by e-mail.', realLine: (x) => `On the live site this button opens ${x}, the booking page the house already uses.`,
    visitH: ['Getting', 'here'], guests: (n) => `${n} ${String(n) === '1' ? 'guest' : 'guests'}`, nights: (n) => `${n} ${n === 1 ? 'night' : 'nights'}`,
    checkIn: 'Check-in', checkOut: 'Check-out', from: 'Rooms from', perNight: 'a night', roomsH: ['The', 'rooms'], roomsSub: (n, fiyatli = true) => (fiyatli ? `Rooms and prices as listed on ${n}’s own site; the rate on your dates may differ.` : `Rooms as listed on ${n}’s own site; ask the house for the rate on your dates.`),
    amenH: ['What', 'is included'], amenSub: (n) => `Taken word for word from ${n}’s own pages.`, bookDirectH: ['Book', 'direct'], bookDirectSub: (x) => `Dates and rates come straight from ${x}, the booking page the house already uses.`, bookDirectBtn: 'See dates and rates',
    x: { signH: ['Around', 'the house'], signSub: (n) => `Photos and captions from ${n}’s own site.` },
    draft: (n) => `A website draft prepared for ${n}. Text, prices and photos come from the current site; nothing here is live.`, currentSite: 'Your current site', rooms: 'Rooms', sleeps: (n) => `Sleeps ${n}`, ensuite: 'En-suite', viewOf: (v) => `${v} view`,
  },
};

// ---- gercek rezervasyon motorlari (dogrudan rezervasyon).  Booking.com / Airbnb / Tripadvisor ANA EYLEM yapilmaz: amac komisyonsuz dogrudan rezervasyon ----
export const MOTOR = /(?:^|\.)(freetobook\.com|eviivo\.com|beds24\.com|littlehotelier\.com|mews\.com|mews\.li|cloudbeds\.com|thebookingbutton\.com(?:\.au)?|siteminder\.com|direct-book\.com|bookingsync\.com|lodgify\.com|supercontrol\.co\.uk|smoobu\.com|hostaway\.com|guesty\.com|newbook\.cloud|rmscloud\.com|resonline\.com\.au|staah\.net|roomraccoon\.com|frontdeskanywhere\.net|webrezpro\.com|thinkreservations\.com|book-directonline\.com|bookeddirect\.com|checkfront\.com|anytimebooking\.eu|bookalet\.co\.uk|hostfully\.com|ownerrez\.com|uplisting\.io|bookingcenter\.com|innstyle\.co\.uk|sabeeapp\.com|availabilityonline\.com|bookingautomation\.com|bookassist\.org|ipms247\.com|nightsbridge\.com|freetobook\.co\.uk|bookingbuttonpro\.com|reservations\.rezexchange\.com|clock-software\.com|hotelrunner\.com|bookonlinenow\.net|elinapms\.com|rezdy\.com|resova\.com|bookingmood\.com|hotel-spider\.com|ehotelier|seekom\.com|bookit\.co\.nz|eviivo\.co\.uk)$/i;
const OTA = /(?:^|\.)(booking\.com|airbnb\.[a-z.]+|expedia\.[a-z.]+|tripadvisor\.[a-z.]+|vrbo\.com|hotels\.com|agoda\.com|stayz\.com\.au|bookabach\.co\.nz|holidaylettings\.co\.uk|sykescottages\.co\.uk|cottages\.com)$/i;
const BOOK_TEXT = /\b(book (?:now|online|direct|your stay|a room)|check availability|make a (?:booking|reservation)|reserve (?:now|a room)|availability (?:&|and) (?:rates|booking))\b/i;

const clean = (s, max = 200) => decode(String(s ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

// sayfadaki iframe/script kaynaklarinda motor (baglanti yoksa bile sitede gomulu rezervasyon var demektir)
export function gomuluMotor(html) {
  for (const m of String(html).matchAll(/<(?:iframe|script)\b[^>]*\bsrc=["']([^"']+)["']/gi)) { const h = hostOf(m[1].startsWith('//') ? `https:${m[1]}` : m[1]); if (h && MOTOR.test(h)) return h; }
  return null;
}

// -> { url, text, external, motor } | null.  Sira: motor baglantisi > kendi sitesinde "Book now" sayfasi (gomulu motoru varsa ya da yoksa)
export function rezervasyonMotoru(links, base, html = '') {
  let own = null;
  for (const l of links || []) {
    let u; try { u = new URL(l.href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const h = u.host.replace(/^www\./, '').toLowerCase();
    if (MOTOR.test(h)) return { url: u.href, text: clean(l.text, 40), external: true, motor: h };
    if (OTA.test(h)) continue;
    if (!own && h === hostOf(base) && (BOOK_TEXT.test(l.text || '') || /\/(book(?:ing)?(?:-now|-online)?|reservations?|availability|check-availability)(?:\/|$|\?)/i.test(u.pathname))) own = { url: u.href, text: clean(l.text, 40), external: false, motor: null };
  }
  const g = gomuluMotor(html);
  if (own) return { ...own, motor: g };
  return g ? { url: base, text: '', external: false, motor: g, gomulu: true } : null;
}
export const otaVar = (links) => (links || []).some((l) => { const h = hostOf(l.href); return h && OTA.test(h); });

// ---- oda sayfalari ----
const ODA_YOL = /\/(rooms?|our-rooms|the-rooms|accommodation|accomodation|suites?|apartments?|cottages?|bedrooms?|lodges?|chalets?|cabins?|stay|rates|tariffs?|prices)(?:[/-]|$|\?|\.html?)/i;
const ODA_METIN = /^(?:our |the )?(rooms?|accommodation|suites|apartments|cottages|bedrooms|lodges|chalets|cabins|rates|tariffs?|prices|stay with us)$/i;
export function odaLinkleri(links, base) {
  const out = [];
  for (const l of links || []) {
    let u; try { u = new URL(l.href, base); } catch { continue; }
    if (u.host.replace(/^www\./, '') !== hostOf(base) || u.pathname === '/' || /\.(pdf|jpe?g|png)$/i.test(u.pathname)) continue;
    const t = clean(l.text, 40);
    if (ODA_YOL.test(u.pathname) || ODA_METIN.test(t)) { const k = u.origin + u.pathname.replace(/\/$/, ''); if (!out.some((x) => x.k === k)) out.push({ k, url: u.href, text: t }); }
  }
  // genel liste sayfasi once (rooms / accommodation), sonra tek oda sayfalari
  return out.sort((a, b) => (ODA_METIN.test(b.text) ? 1 : 0) - (ODA_METIN.test(a.text) ? 1 : 0)).slice(0, 3).map((x) => x.url);
}

const ODA_AD = /\b(room|suite|apartment|apt|cottage|studio|loft|lodge|chalet|cabin|double|twin|single|family|king|queen|deluxe|superior|standard|garden|annex|annexe|barn|bedroom|penthouse|villa|bungalow|unit|flat|hideaway|retreat|nest|attic|courtyard|stable|coach house|sea view|ocean view)\b/i;
const GENEL = /^(?:our |the |all )?(rooms?|accommodation|suites|apartments|cottages|book(?:ing)?(?: now| online)?|contact(?: us)?|facilities|amenities|location|reviews?|faq|about(?: us)?|gallery|welcome|breakfast|availability|rates|prices|tariff|terms|policies|home|menu|explore|things to do|getting here|find us|gift vouchers?|special offers?|offers|news|blog)$/i;
// oda olmayan basliklar: aciklama/olanak/oran basliklari, yeme-icme ve ortak alanlar, cumle parcalari
const ODA_DEGIL = /^(?:description|details?|overview|summary|info(?:rmation)?|description and details)$|\b(?:facilities|amenities|rates|prices|tariffs?|reviews?|testimonials|directions|policies|conditions)\s*$|^(?:your|our|the|all)\b.*\b(?:facilities|amenities)\b|\b(?:dining|breakfast|living|sitting|conference|meeting|function|games?|tea|bar|lounge|restaurant|reception|waiting|utility|drying)\s*(?:room|area|hall)s?\b|\.\.?\s*$|^(?:each|every|all|both)\s/i;
const FIYAT = /(from\s*)?((?:AU|NZ|A|NZ)?[£€$]\s?\d{2,4}(?:[.,]\d{2})?)(?:\s*(?:-|–|to)\s*[£€$]?\s?\d{2,4})?\s*(?:(?:per|a|\/|pp)\s*(night|room|person|week|nt)|pppn|pn\b)?/i;

export function odaOzellik(txt) {
  const t = String(txt || ''); const o = [];
  const sl = /\bsleeps\s*(?:up to\s*)?(\d{1,2})\b/i.exec(t) || /\b(?:max(?:imum)?\.?\s*(?:occupancy|guests)?:?\s*)(\d{1,2})\b/i.exec(t) || /\b(\d{1,2})\s*(?:guests|people|persons|adults)\b/i.exec(t);
  if (sl && Number(sl[1]) >= 1 && Number(sl[1]) <= 16) o.push({ k: 'sleeps', v: Number(sl[1]) });
  const bed = /\b(super[- ]?king|king|queen|double|twin|single)(?:[- ]size)?\s*beds?\b/i.exec(t); if (bed) o.push({ k: 'bed', v: `${bed[1].replace(/[- ]/, ' ')} bed`.replace(/^./, (c) => c.toUpperCase()) });
  if (/\ben-?suite\b/i.test(t)) o.push({ k: 'ensuite' });
  const vw = /\b(sea|lake|garden|mountain|river|harbour|harbor|ocean|beach|countryside|castle|valley|bay|loch|park)\s+views?\b/i.exec(t); if (vw) o.push({ k: 'view', v: vw[1].replace(/^./, (c) => c.toUpperCase()) });
  return o;
}

// -> [{ n, p, per, d, oz }] (en cok 8).  Basliklar ve ardindaki blok; JSON-LD HotelRoom / Accommodation de okunur
export function odalarBul(html, ld = []) {
  const out = []; const seen = new Set();
  const add = (n, block, p0) => {
    let name = clean(n, 160).replace(/\s*[-–|:]\s*$/, '');
    // "The Heaney Room - Small Double - 12 SQM - From €120": baslik ayrintiyi da tasiyor; ad ilk parca, kalani blok olur (fiyat ve ozellik oradan okunur)
    if (name.length > 48 || /[£€$]\s?\d/.test(name)) {
      const parts = name.split(/\s+[-–—|]\s+/);
      if (parts.length > 1 && parts[0].length >= 3 && parts[0].length <= 48) { block = `${parts.slice(1).join('. ')}. ${block || ''}`; name = parts[0]; }
    }
    if (name.length < 3 || name.length > 48 || GENEL.test(name) || ODA_DEGIL.test(name) || seen.has(name.toLowerCase())) return;
    const txt = clean(block, 1400);
    if (!ODA_AD.test(name) && !/\b(sleeps|en-?suite|double bed|twin beds|king bed|queen bed|bathroom|shower)\b/i.test(txt)) return;
    const fm = p0 ? null : FIYAT.exec(txt);
    const p = p0 || (fm ? fm[2].replace(/\s+/g, '') : '');
    const per = fm && fm[3] ? fm[3].toLowerCase().replace(/^nt$/, 'night') : (fm && /pppn/i.test(fm[0]) ? 'person' : '');
    const sent = (txt.match(/[^.!?]+[.!?]/g) || []).map((s) => s.trim()).find((s) => s.split(/\s+/).length >= 6 && s.length <= 150 && !/\b(book|call|click|contact|email|enquire)\b/i.test(s) && !/[£€$]\s?\d/.test(s));
    seen.add(name.toLowerCase());
    out.push({ n: name, p, per, d: sent || '', oz: odaOzellik(txt) });
  };
  for (const o of ld) for (const x of [].concat(o || [])) {
    const ty = [].concat(x['@type'] || []).join(' ');
    if (/HotelRoom|Suite|Accommodation|Apartment|Room|House|SingleFamilyResidence/i.test(ty) && x.name) { const off = [].concat(x.offers || [])[0]; const pr = off && off.price ? `${off.priceCurrency === 'GBP' ? '£' : off.priceCurrency === 'EUR' ? '€' : '$'}${off.price}` : ''; add(x.name, `${x.description || ''} ${x.occupancy && x.occupancy.maxValue ? `sleeps ${x.occupancy.maxValue}` : ''}`, pr); }
  }
  const h = String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ');
  for (const m of h.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[1-4]\b|<footer\b|$)/gi)) { if (out.length >= 8) break; add(m[2], m[3]); }
  return out.slice(0, 8);
}

// ---- olanaklar: yalniz isletmenin kendi metninde gecenler; her biri kanit ifadesiyle ----
export const OLANAK = [
  ['wifi', 'Free Wi-Fi', /\bfree\s+wi-?fi\b|\bwi-?fi\s+(?:is\s+)?(?:free|complimentary|included)\b/i],
  ['parking', 'Free parking', /\bfree\s+(?:on-?site\s+|private\s+|off-?street\s+)?(?:car\s+)?parking\b/i],
  ['parking2', 'Parking on site', /\b(?:private|on-?site|off-?street)\s+(?:car\s+)?parking\b/i],
  ['breakfast', 'Breakfast included', /\bbreakfast\s+(?:is\s+)?included\b|\b(?:rate|price)s?\s+include\s+breakfast\b/i],
  ['fullbreakfast', 'Cooked breakfast', /\bfull\s+(?:irish|english|scottish|welsh|cooked)\s+breakfast\b|\bcooked\s+breakfast\b/i],
  ['ensuite', 'En-suite rooms', /\ben-?suite\s+(?:rooms|bathrooms?|shower)|\ball\s+(?:rooms|bedrooms)\s+(?:are\s+)?en-?suite\b/i],
  ['kitchen', 'Self-catering kitchen', /\bself[- ]catering\b|\bfully[- ]equipped\s+kitchen\b|\bkitchenette\b/i],
  ['pets', 'Dogs welcome', /\b(?:dogs?|pets?)\s+(?:are\s+)?welcome\b|\b(?:dog|pet)[- ]friendly\b/i],
  ['ev', 'EV charging', /\bev\s+charg(?:ing|er)\b|\belectric\s+(?:car|vehicle)\s+charg/i],
  ['hottub', 'Hot tub', /\bhot\s*tub\b/i],
  ['pool', 'Swimming pool', /\b(?:heated\s+|outdoor\s+|indoor\s+)?swimming\s+pool\b/i],
  ['garden', 'Garden', /\b(?:large\s+|private\s+|landscaped\s+|walled\s+)?gardens?\s+(?:for\s+guests|to\s+enjoy|area)\b|\bguests?\s+(?:can|may)\s+(?:use|enjoy)\s+the\s+garden\b/i],
  ['family', 'Family rooms', /\bfamily\s+(?:rooms?|suites?)\b/i],
  ['accessible', 'Ground-floor room', /\bground[- ]floor\s+(?:room|bedroom|suite)\b|\bwheelchair\s+accessible\b/i],
  ['bbq', 'Barbecue', /\b(?:bbq|barbecue)\s+(?:area|facilities)\b/i],
  ['laundry', 'Laundry', /\blaundry\s+(?:facilities|room)\b|\bwashing\s+machine\b/i],
  ['aircon', 'Air conditioning', /\bair[- ]?con(?:ditioning|ditioned)?\b/i],
  ['bikes', 'Bike storage', /\b(?:secure\s+)?(?:bike|bicycle|cycle)\s+storage\b/i],
];
export function olanaklar(text) {
  const t = String(text || ''); const out = [];
  for (const [k, label, re] of OLANAK) {
    if (k === 'parking2' && out.some((x) => x.k === 'parking')) continue;
    if (k === 'fullbreakfast' && out.some((x) => x.k === 'breakfast')) continue;
    const m = re.exec(t); if (m) out.push({ k, label, kanit: clean(m[0], 60) });
  }
  return out.slice(0, 8);
}

// giris / cikis saatleri ("Check-in from 3pm", "check out by 10:30am")
const SAAT = '(\\d{1,2}(?:[:.]\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)|\\d{1,2}[:.]\\d{2}|noon|midday)';
export function girisCikis(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  const a = new RegExp(`check[- ]?in\\s*(?:is\\s*|time\\s*(?:is\\s*)?)?(?:from|after|:|-|between)?\\s*${SAAT}`, 'i').exec(t);
  const b = new RegExp(`check[- ]?out\\s*(?:is\\s*|time\\s*(?:is\\s*)?)?(?:by|before|until|:|-|at)?\\s*${SAAT}`, 'i').exec(t);
  const f = (x) => (x ? x.replace(/\s+/g, '').replace(/\.(?=\d)/, ':').replace(/a\.m\./i, 'am').replace(/p\.m\./i, 'pm').toLowerCase().replace(/^(noon|midday)$/, '12pm') : null);
  return { in: f(a && a[1]), out: f(b && b[1]) };
}

// ---- cikarici eki: cikar.mjs ana isinden sonra cagrilir ----
export async function ek({ R, home, base, sayfaAl, jsonLd }) {
  R.sektor = AD;
  const metin = [home.lines.join('\n')];
  const linkler = [...home.links];
  let odalar = odalarBul(home.html, jsonLd(home.html)); const odaSayfalari = [];
  for (const u of odaLinkleri(home.links, base)) {
    if (odalar.length >= 6) break;
    const pg = await sayfaAl(u); if (!pg) continue;
    odaSayfalari.push(pg.finalUrl || u);
    metin.push((pg.lines || htmlToLines(pg.html)).join('\n'));
    if (pg.links) linkler.push(...pg.links); else for (const m of pg.html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) linkler.push({ href: m[1], text: clean(m[2], 60) });
    const yeni = odalarBul(pg.html, jsonLd(pg.html));
    for (const o of yeni) if (!odalar.some((x) => x.n.toLowerCase() === o.n.toLowerCase())) odalar.push(o);
  }
  const hepsi = metin.join('\n');
  const motor = rezervasyonMotoru(linkler, base, home.html);
  R.konaklama = { odalar: odalar.slice(0, 8), odaSayfasi: odaSayfalari[0] || null, olanak: olanaklar(hepsi), giris: girisCikis(hepsi), motor, ota: otaVar(linkler) };
  // restoranin masa rezervasyonu dedektoru bu sektorde kullanilmaz: ana eylem motora (varsa) gider
  R.reservation = motor && motor.external ? { url: motor.url, text: motor.text, external: true } : motor ? { url: motor.url, text: motor.text, external: false } : null;
  R.hours = null; // pansiyonun "saatleri" yok; giris/cikis ayri gosterilir
  return R;
}

// ---- uretici modeli ----
const fiyatSayi = (p) => { const m = /(\d{2,4})(?:[.,](\d{2}))?/.exec(String(p || '')); return m ? Number(m[1]) + (m[2] ? Number(m[2]) / 100 : 0) : null; };
// onbellekteki (eski surumle cikarilmis) oda listesinden oda olmayan basliklari ayikla
export const temizOdalar = (K) => ((K && K.odalar) || []).filter((o) => o && o.n && !GENEL.test(o.n) && !ODA_DEGIL.test(o.n));
export function model(R, { lang = 'en', region }) {
  const K = R.konaklama || {}; const E = ETIKET.en;
  const para = { GB: '£', IE: '€', AU: '$', NZ: '$', SG: 'S$' }[region] || '';
  const fix = (p) => (p ? (/[£€$]/.test(p) ? p.replace(/^(?:AU|NZ|A)/, '') : `${para}${p}`) : '');
  const odalar = temizOdalar(K).map((o) => ({ ...o, p: fix(o.p), oz: (o.oz || []).map((z) => (z.k === 'sleeps' ? E.sleeps(z.v) : z.k === 'ensuite' ? E.ensuite : z.k === 'view' ? E.viewOf(z.v) : z.v)).slice(0, 3) }));
  const gece = odalar.filter((o) => o.p && (o.per === 'night' || o.per === 'room' || !o.per)).map((o) => fiyatSayi(o.p)).filter((x) => x && x >= 20 && x <= 2000);
  const enAz = gece.length >= 1 ? Math.min(...gece) : null;
  const fromP = enAz ? `${para || (odalar.find((o) => o.p) || { p: '' }).p.replace(/[\d.,\s]/g, '')}${Number.isInteger(enAz) ? enAz : enAz.toFixed(2)}` : null;
  const motor = K.motor || null;
  return {
    odalar, olanak: (K.olanak || []).map((x) => x.label), giris: K.giris || {}, fromP,
    bookUrl: motor && (motor.external || !motor.gomulu) ? motor.url : null, bookHost: motor && motor.external ? motor.motor : null,
    odaSayfasi: K.odaSayfasi || null, ota: !!K.ota,
  };
}

// ---- kalite kapisi kurali (restoranin "menu yok" kurali yerine) ----
export function kapiKural(R) {
  const K = R.konaklama || {}; const why = []; const warn = [];
  const n = temizOdalar(K).length;
  if (n < 2 && !(K.motor && K.motor.url) && !K.odaSayfasi) why.push('oda bilgisi ve rezervasyon bağlantısı yok');
  else if (n < 2) warn.push('oda listesi çıkarılamadı (yalnız rezervasyon/oda bağlantısı var)');
  if (!K.motor) warn.push('doğrudan rezervasyon motoru bulunamadı (demo istek formu gösterilir)');
  return { why, warn };
}
