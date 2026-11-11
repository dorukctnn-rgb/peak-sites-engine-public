// Sayfa metinleri (TR/EN), saat/telefon/fiyat bicimleri, saat dilimi. Kural tabanli; model yok. Turkce karakterler tam.
export const DAYS = { tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
const SHORT = { tr: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Pzt ... Paz

export const T = {
  tr: {
    skip: 'İçeriğe geç', book: 'Masa ayırtın', bookShort: 'Masa ayırt', menu: 'Menü', gallery: 'Galeri', visit: 'Ziyaret', seeMenu: 'Menüye bakın', fullMenu: 'Tam menüyü görün', directions: 'Yol tarifi alın', directionsShort: 'Yol tarifi', call: 'Ara', callUs: 'Ya da arayın',
    now: 'Şimdi', hours: 'Saatler', address: 'Adres', phone: 'Telefon', closed: 'Kapalı', unknown: '—',
    galleryH: ['İçeriden', 'bir bakış'], menuH: 'Menü', menuSub: (n) => `Yemekler ve fiyatlar ${n} sitesindeki gibi.`, menuLegend: (n) => `Kalemler ve fiyatlar ${n} sitesinden alınmıştır; güncel fiyat ve alerjen bilgisi için servis ekibine sorun.`,
    menuLinkOnly: 'Menüyü restoranın kendi sayfasında görebilirsiniz.', bookH: ['Masa', 'ayırtın'], bookSub: 'Bir saat seçin ve isteğinizi gönderin.', people: 'Kişi', day: 'Gün', time: 'Saat', name: 'Adınız', tel: 'Telefon', note: 'Not (isteğe bağlı)', notePh: 'Doğum günü, alerji, pencere kenarı...', send: 'İsteği gönder',
    demoNote: 'Demo: istek hiçbir yere gitmez.', thanks: (n) => `Teşekkürler${n ? ', ' + n : ''}.`, replyLine: 'Size telefonla dönülür.', realLine: (x) => `Gerçek sitede bu istek ${x} ile bağlanır.`, realLineGeneric: 'Gerçek sitede bu istek restoranın telefonuna ve e-postasına düşer.',
    visitH: ['Bizi', 'bulun'], today: 'Bugün', tomorrow: 'Yarın', tonight: 'Bu akşam', guests: (n) => `${n} kişi`, rating: 'Google puanı', reviews: 'Google yorumu', daysOpen: 'gün açık', openDays: (n) => (n === 7 ? 'Her gün' : `${n} gün`),
    open: (c) => `Şimdi açık · kapanış ${c}`, shut: (w) => `Şu an kapalı · açılış ${w}`, whenTomorrow: (t) => `yarın ${t}`, whenToday: (t) => `bugün ${t}`, whenDay: (d, t) => `${d} ${t}`,
    draft: (n) => `${n} için hazırlanmış web sitesi taslağı. Metinler, fiyatlar ve fotoğraflar işletmenin mevcut sitesinden alınmıştır; yayında değildir.`, draftBy: 'Peak Apps Studio', currentSite: 'Mevcut siteniz', follow: 'Takip edin', map: 'Konum', openMaps: 'Haritada aç', hoursCap: 'Çalışma saatleri', bookExt: 'Mevcut rezervasyon sayfanız',
    nav: 'Bölümler', quick: 'Hızlı işlemler', lang: 'tr', locale: 'tr-TR', numLocale: 'tr-TR', other: 'Diğer',
  },
  en: {
    skip: 'Skip to content', book: 'Book a table', bookShort: 'Book', menu: 'Menu', gallery: 'Gallery', visit: 'Visit', seeMenu: 'See the menu', fullMenu: 'See the full menu', directions: 'Get directions', directionsShort: 'Directions', call: 'Call', callUs: 'Or call us',
    now: 'Now', hours: 'Hours', address: 'Address', phone: 'Phone', closed: 'Closed', unknown: '—',
    galleryH: ['A look', 'inside'], menuH: 'Menu', menuSub: (n) => `Dishes and prices as listed on ${n}’s own site.`, menuLegend: (n) => `Items and prices are taken from ${n}’s current site; ask the team for today’s prices and allergen information.`,
    menuLinkOnly: 'The menu lives on the venue’s own page.', bookH: ['Book', 'a table'], bookSub: 'Pick a time and send your request.', people: 'Guests', day: 'Day', time: 'Time', name: 'Your name', tel: 'Phone', note: 'Note (optional)', notePh: 'Birthday, allergy, window seat...', send: 'Send request',
    demoNote: 'Demo: the request goes nowhere.', thanks: (n) => `Thank you${n ? ', ' + n : ''}.`, replyLine: 'We will call you back.', realLine: (x) => `On the live site this request connects to ${x}.`, realLineGeneric: 'On the live site this request reaches the venue by phone and e-mail.',
    visitH: ['Find', 'us'], today: 'Today', tomorrow: 'Tomorrow', tonight: 'Tonight', guests: (n) => `${n} ${n === 1 ? 'guest' : 'guests'}`, rating: 'Google rating', reviews: 'Google reviews', daysOpen: 'days open', openDays: (n) => (n === 7 ? 'Every day' : `${n} days`),
    open: (c) => `Open now · closes ${c}`, shut: (w) => `Closed · opens ${w}`, whenTomorrow: (t) => `tomorrow ${t}`, whenToday: (t) => `today ${t}`, whenDay: (d, t) => `${d} ${t}`,
    draft: (n) => `A website draft prepared for ${n}. Text, prices and photos come from the venue’s current site; nothing here is live.`, draftBy: 'Peak Apps Studio', currentSite: 'Your current site', follow: 'Follow', map: 'Location', openMaps: 'Open in Maps', hoursCap: 'Opening hours', bookExt: 'Your current booking page',
    nav: 'Sections', quick: 'Quick actions', lang: 'en', locale: 'en-GB', numLocale: 'en-US', other: 'Other',
  },
};

const hhmm = (m) => { m %= 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const fmtRange = (a) => `${hhmm(a[0])}–${hhmm(a[1])}`;

// haftalik tablo satirlari: Pzt..Paz, her gun { d, label, t }.  t: '17:00–22:00' | 'Kapalı' | null (bilinmiyor)
export function saatTablo(hours, lang) {
  const L = T[lang];
  if (!hours) return null;
  return ORDER.map((d) => {
    const w = hours.week[d]; const b = hours.byDay && hours.byDay[d];
    let t = null;
    if (w) t = (hours.byDay && b && b !== 'closed' ? b : fmtRange(w));
    else if (b === 'closed') t = L.closed;
    return { d, label: DAYS[lang][d], short: SHORT[lang][d], t };
  });
}
// ardisik ayni saatler tek satir: "Salı–Perşembe 17:00–00:00"
export function saatOzet(tablo, lang) {
  if (!tablo) return [];
  const rows = []; let cur = null;
  for (const r of tablo) {
    const t = r.t;
    if (t === null) { cur = null; continue; }
    if (cur && cur.t === t) { cur.to = r; } else { cur = { t, from: r, to: r }; rows.push(cur); }
  }
  return rows.map((x) => ({ days: x.from === x.to ? x.from.label : `${x.from.short}–${x.to.short}`, daysLong: x.from === x.to ? x.from.label : `${x.from.label}–${x.to.label}`, t: x.t }));
}

const CUR = { AU: '$', NZ: '$', CA: '$', US: '$', SG: '$', IE: '€', GB: '£', TR: '₺' };
export function fmtPrice(p, region) {
  const s = String(p || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (/[$£€₺]|TL|TRY/i.test(s)) return s.replace(/^((?:US|AU|NZ|CA|C|A)\s?)?([$£€₺])\s+/, '$2').replace(/\s*(TL|TRY)\b/i, ' ₺');
  if (!/^\d/.test(s)) return s;
  const c = CUR[region] || '';
  return region === 'TR' ? `${s} ₺` : `${c}${s}`;
}

const CC = { AU: '61', NZ: '64', IE: '353', GB: '44', TR: '90', US: '1', CA: '1', SG: '65' };
export function telHref(phone, region) {
  let d = String(phone || '').trim(); if (!d) return null;
  const plus = d.startsWith('+') || d.startsWith('00');
  d = d.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (plus) return `+${d}`;
  const cc = CC[region] || '';
  if (!cc) return d.length >= 7 ? d : null;
  if (cc === '1') return d.length === 11 && d.startsWith('1') ? `+${d}` : `+1${d}`;
  if (cc === '65') return d.length === 10 && d.startsWith('65') ? `+${d}` : `+65${d}`; // Singapur: 8 hane, alan kodu ve bastaki 0 yok
  return `+${cc}${d.replace(/^0+/, '')}`;
}
export function telText(phone) { return String(phone || '').replace(/\s+/g, ' ').trim(); }

export const mapsUrl = (address, name, city) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address || name, address ? '' : city].filter(Boolean).join(' '))}`;

// saat dilimi: sehir, sonra bolge
const TZ_CITY = { 'new york': 'America/New_York', miami: 'America/New_York', 'los angeles': 'America/Los_Angeles', chicago: 'America/Chicago', austin: 'America/Chicago', vancouver: 'America/Vancouver', calgary: 'America/Edmonton', toronto: 'America/Toronto', melbourne: 'Australia/Melbourne', sydney: 'Australia/Sydney', brisbane: 'Australia/Brisbane', dublin: 'Europe/Dublin', galway: 'Europe/Dublin', cork: 'Europe/Dublin', auckland: 'Pacific/Auckland', christchurch: 'Pacific/Auckland', wellington: 'Pacific/Auckland', singapore: 'Asia/Singapore', londra: 'Europe/London', london: 'Europe/London', manchester: 'Europe/London' };
const TZ_REGION = { TR: 'Europe/Istanbul', IE: 'Europe/Dublin', GB: 'Europe/London', NZ: 'Pacific/Auckland', SG: 'Asia/Singapore' };
export const tzOf = (city, region) => TZ_CITY[String(city || '').toLowerCase()] || TZ_REGION[region] || null;
const EN_CITY = { londra: 'London', 'i̇stanbul': 'Istanbul', 'İstanbul': 'Istanbul', 'muğla': 'Muğla' };
export const cityLabel = (city, lang) => (lang === 'en' ? EN_CITY[city] || EN_CITY[String(city || '').toLowerCase()] || city : city);

export const KIND = { tr: { restaurant: 'Restoran', bar: 'Bar', cafe: 'Kafe' }, en: { restaurant: 'Restaurant', bar: 'Bar', cafe: 'Café' } };

// ---- 10 Kas (ajan 3): inceleme turunun sik bulduğu üç kusur, kural tabanlı düzeltme ----
const STREET_EN = /\b\d{1,5}[A-Za-z]?(?:[-/]\d{1,4})?\s+(?:[A-Z][A-Za-z'’.]+\s+){0,3}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Place|Pl|Terrace|Tce|Highway|Hwy|Crescent|Cres|Court|Ct|Parade|Pde|Square|Sq|Quay|Esplanade|Mall|Row|Plaza|Circuit|Close)\b/;
// adres satırı: tarihçe/tanıtım cümlesine gömülü adres cümleden çıkarılır, sondaki "Phone: 021 ..." ve nokta atılır
export function adresTemizle(raw) {
  let t = String(raw || '').replace(/\s+/g, ' ').trim();
  if (/\byour (street )?address\b|\b(insert|enter|add|type) (your )?(street )?address\b|lorem ipsum|\b(street|address) (line|here|name)\b/i.test(t)) return ''; // sitenin yer tutucusu ("YOUR STREET ADDRESS, ...") adres degildir
  const m = STREET_EN.exec(t);
  if (m && m.index > 0) { const pre = t.slice(0, m.index); if (pre.length >= 15 && /\b(at|in|is|are|saw|located|find|visit|welcome|since|was|opened|open|come|join)\b/i.test(pre)) t = t.slice(m.index); }
  t = t.replace(/[,;\s]*\b(?:phone|telephone|tel|ph|mobile|mob|fax|e-?mail)\b\s*[:.]?\s*[\d\s+().-]*$/i, '');
  t = t.replace(/,?\s*\(?\+?\d[\d\s().-]{7,}\d\)?\s*$/, '');
  return t.replace(/[,;.\s]+$/, '').trim();
}
// menü kalemi gerçek bir yemek/içecek adı mı? Tek sözcüklük çeşit etiketleri ("Veg", "Large"), kategori başlıkları ("Salads"), "See Specials Board", adres parçaları elenir
const VARYANT = /^(veg|veggie|vegetarian|vegan|chicken|goat|lamb|beef|pork|fish|prawns?|seafood|tofu|small|medium|large|regular|half|full|single|double|mini|standard|hot|cold|iced|sm|md|lg)$/i;
const KATEGORI = /^(starters?|mains?|salads?|pastas?|desserts?|sides?|sharing|specials?|kids|sweets|snacks|entr[eé]es?|appetizers?|breakfast|brunch|lunch|dinner|drinks|beverages)(\s*(&|and|\+)\s*\p{L}+)?$/iu;
export function menuKalemOk(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (!n) return false;
  if (VARYANT.test(n) || KATEGORI.test(n)) return false;
  if (/^(see|please|ask|enquire|inquire|call|choose|select|pick|add)\b/i.test(n)) return false;
  if (/\b\d{2,}\b/.test(n) && /\b(street|st|road|rd|avenue|ave|mall|lane|drive|place|square|quay|way|court)\b/i.test(n)) return false;
  if (/[+&(,]$/.test(n)) return false;
  return true;
}
// fotoğraf alt yazısı gerçek bir altyazı mı? Dosya adı gibi ("... kontentco feb 2024 68", "... stock") görünenler sayfada gösterilmez
export function altOk(alt) {
  const a = String(alt || '').replace(/\s+/g, ' ').trim();
  if (a.length < 5 || a.length > 110) return false;
  if (/\.(jpe?g|png|webp|gif)|^img|screenshot|banner|slide|hero|logo|image \d|dsc|^\d/i.test(a) || /^[\w-]+$/.test(a)) return false;
  if (/\b(19|20)\d{2}\b/.test(a) || /\b(stock|kontentco|copy|final|edited|untitled|thumbnail|thumb|min)\b/i.test(a)) return false;
  if ((a.match(/\b\d+\b/g) || []).length >= 2) return false;
  if (/\s\d{1,4}$/.test(a) && a === a.toLowerCase()) return false;
  return true;
}
