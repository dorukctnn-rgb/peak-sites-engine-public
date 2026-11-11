// SEKTOR: GUZELLIK (kuafor, guzellik salonu, berber).  Zincir yok (lead/osm.mjs eler).
// Restoran uretecinin ayni ilkeleri: isletmenin KENDI sitesinden; logo, font, renk, fotograf onun; uydurma yok.
//   cikar ek():   gercek randevu motoru baglantisi (Fresha, Treatwell, Phorest, Timely, Square ...), "book" sayfasi
//                 hizmet ve fiyat listesi restoranin menu cikaricisiyla okunur (menuSozcuk: prices, services, treatments ...); saatler restoran gibi
//   uret model(): ana eylem hedefi (motor varsa ona), formda secilecek hizmet adlari (yalniz sitedeki kalemler)
//   kapi kural(): hizmet listesi (en az 4 fiyatli kalem) YA DA gercek randevu baglantisi yoksa "gozden gecir" (maile girmez)
import { decode } from '../v2lib/scrape.mjs';
import { SEKTORLER } from '../../lead/sektorler.mjs';

export const AD = 'guzellik';
export const SAAT_YOK = false; // saat tablosu ve "simdi acik" restoran gibi gosterilir
export const MENU_ARA = true; // hizmet / fiyat sayfasi restoran menu cikaricisiyla aranir
// fiyat listesi sayfasina giden baglanti ve sayfa kelimeleri (restoran menu kelimelerinin yerine)
export const MENU_SOZCUK = /(^|[^a-z])(prices?|price[- ]?list|pricing|tariffs?|services?|treatments?|salon[- ]menu|beauty[- ]menu|hair[- ]menu|barber[- ]menu|our[- ]services|menu)([^a-z]|$)/i;
export const GRUP_ADI = 'Services';

export const ETIKET = {
  en: {
    book: 'Book an appointment', bookShort: 'Book', menu: 'Services', seeMenu: 'See the services', fullMenu: 'See the full price list',
    menuH: 'Services and prices', menuSub: (n) => `Treatments and prices as listed on ${n}’s own site.`,
    menuLegend: (n) => `Services and prices are taken from ${n}’s current site; ask the team for today’s prices.`, menuLinkOnly: 'The price list lives on the business’s own page.',
    galleryH: ['A look', 'inside'],
    bookH: ['Book an', 'appointment'], bookSub: 'Pick a service and a time and send your request. You hear back directly from the team.',
    people: 'Service', day: 'Day', time: 'Time', notePh: 'Hair length, a patch test, who you saw last time...', send: 'Send request',
    replyLine: 'The team confirms by phone or e-mail.', realLine: (x) => `On the live site this button opens ${x}, the booking page the business already uses.`, realLineGeneric: 'On the live site this request reaches the team by phone and e-mail.',
    guests: (n) => n,
    bookDirectH: ['Book', 'direct'], bookDirectSub: (x) => `Times and prices come straight from ${x}, the booking page the business already uses.`, bookDirectBtn: 'See available times',
    draft: (n) => `A website draft prepared for ${n}. Text, prices and photos come from the current site; nothing here is live.`,
    x: { cardsH: ['Popular', 'services'], cardsSub: (n) => `Treatments and prices from ${n}’s own price list.`, all: (n) => `See all ${n}` },
  },
};

// ---- randevu motoru ----
// lead/sektorler.mjs'teki guzellik.rezervasyon deseni (tek kaynak) URL'nin host + yol kismina uygulanir
const MOTOR = SEKTORLER.guzellik.rezervasyon;
const clean = (s, max = 200) => decode(String(s ?? '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const BOOK_TEXT = /\b(book(?:ing)?(?: now| online| an? (?:appointment|treatment|slot)| your (?:appointment|visit))?|make an appointment|schedule|reserve|appointments?)\b/i;
const HEDIYE = /gift|voucher|e-?card|shop\.phorest|\/products(?:\/|$)/i; // hediye karti / urun satis sayfasi randevu degildir
const OTA = /(?:^|\.)(facebook\.com|instagram\.com|tripadvisor\.[a-z.]+|google\.[a-z.]+|goo\.gl|yell\.com|yelp\.[a-z.]+|linktr\.ee)$/i;

// sayfadaki iframe/script kaynaklarinda motor (gomulu randevu)
export function gomuluMotor(html) {
  for (const m of String(html).matchAll(/<(?:iframe|script)\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const u = m[1].startsWith('//') ? `https:${m[1]}` : m[1]; const h = hostOf(u);
    if (HEDIYE.test(u)) continue;
    if (h && MOTOR.test(`${h}${(() => { try { return new URL(u).pathname; } catch { return ''; } })()}`)) return h;
  }
  return null;
}

// -> { url, text, external, motor } | null.  Sira: motor baglantisi > kendi sitesinde "Book" sayfasi > gomulu motor
export function randevuMotoru(links, base, html = '') {
  let own = null;
  for (const l of links || []) {
    let u; try { u = new URL(l.href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const h = u.host.replace(/^www\./, '').toLowerCase();
    if (OTA.test(h) || HEDIYE.test(`${h}${u.pathname} ${l.text || ''}`)) continue;
    if (h !== hostOf(base) && MOTOR.test(`${h}${u.pathname}`)) return { url: u.href, text: clean(l.text, 40), external: true, motor: h };
    if (!own && h === hostOf(base) && (BOOK_TEXT.test(l.text || '') && /\/(book(?:ing)?(?:-now|-online|-appointment)?|appointments?|reservations?|schedule)(?:\/|$|\?)/i.test(u.pathname))) own = { url: u.href, text: clean(l.text, 40), external: false, motor: null };
  }
  const g = gomuluMotor(html);
  if (own) return { ...own, motor: g };
  return g ? { url: base, text: '', external: false, motor: g, gomulu: true } : null;
}

// ---- cikarici eki: cikar.mjs ana isinden sonra cagrilir ----
export async function ek({ R, home, base }) {
  R.sektor = AD;
  const motor = randevuMotoru(home.links, base, home.html);
  R.guzellik = { motor };
  // restoranin masa rezervasyonu dedektoru yerine randevu motoru: ana eylem ona gider
  R.reservation = motor && motor.external ? { url: motor.url, text: motor.text, external: true } : motor ? { url: motor.url, text: motor.text, external: false } : null;
  return R;
}

// ---- hizmet listesi suzgeci (cikar.mjs menu kalemlerini bununla suzer) ----
// Hizmet fiyati para birimi simgesiyle yazilir; simgesiz "Ad 4" satirlari (adres, telefon, saat parcalari) hizmet sayilmaz.
export function menuSuz(items) {
  return (items || []).filter((it) => /[£€$]/.test(String(it.p || '')) && /\p{L}{3}/u.test(String(it.n || '')) && !/\b(contact|address|phone|hours?|opening|call us|find us)\b/i.test(`${it.n} ${it.cat || ''}`));
}

// ---- uretici modeli ----
const kisaAd = (n) => String(n || '').replace(/\s+(from|starting at|starts at|only|just|each|per)$/i, '').replace(/\s+/g, ' ').trim();
export function model(R, { region } = {}) {
  void region;
  const K = R.guzellik || {}; const motor = K.motor || null;
  // formda secilecek hizmetler: sitedeki fiyatli kalemlerin adlari (kategori basina bir tane, en cok 6)
  const items = ((R.menu && R.menu.items) || []).filter((it) => it.n && it.p);
  const seen = new Set(); const hizmetler = [];
  for (const it of items) { const n = kisaAd(it.n); const k = n.toLowerCase(); if (!n || n.length > 34 || seen.has(k)) continue; seen.add(k); hizmetler.push(n); if (hizmetler.length >= 6) break; }
  return {
    odalar: [], olanak: [], giris: {}, fromP: null, hizmetler,
    bookUrl: motor && (motor.external || !motor.gomulu) ? motor.url : null, bookHost: motor && motor.external ? motor.motor : null, ota: false,
  };
}

// ---- kalite kapisi kurali (restoranin "menu yok" kurali yerine) ----
export function kapiKural(R, ur = {}) {
  const K = R.guzellik || {}; const why = []; const warn = [];
  const n = ur.menuItems || ((R.menu && R.menu.items) || []).filter((x) => x.p).length;
  const link = ur.menuLink || (R.menu && (R.menu.pageUrl || (R.menu.pdfs || [])[0]));
  if (n < 4 && !(K.motor && K.motor.url) && !link) why.push('hizmet listesi ve randevu bağlantısı yok');
  else if (n < 4) warn.push('hizmet ve fiyat listesi çıkarılamadı (yalnız fiyat listesi ya da randevu bağlantısı var)');
  if (!K.motor) warn.push('randevu motoru bulunamadı (demo istek formu gösterilir)');
  return { why, warn };
}
