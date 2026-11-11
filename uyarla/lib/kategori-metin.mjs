// Kategori sablonlarinin (burger, burrito, pizza) arayuz metinleri.  EN: onayli demolardaki metnin AYNISI (cikti degismez).  TR (11 Kas 2026): tam Turkce
// karakterlerle; eylem adlari isletmenin GERCEK baglantisina gore (siparis platformu, WhatsApp hatti, rezervasyon, telefon).  Saat 24 saatlik, gunler Turkce.
export const KM = {
  en: {
    lang: 'en', order: 'Order online', orderCollect: 'Order for collection', orderShort: 'Order', call: 'Call', callN: (t) => `Call ${t}`, seeMenu: 'See the menu', menu: 'Menu',
    backTop: (ad) => `${ad}, back to top`, sections: 'Sections', pizzas: 'Pizzas', burritos: 'Burritos', howWe: 'How we make it', findUs: 'Find us', ourStory: 'Our story', visit: 'Visit',
    today: 'Today', open7: 'Open 7 days', hoursBelow: 'Hours below', orderThis: 'Order this one', prevPizza: 'Previous pizza', nextPizza: 'Next pizza', vegetarian: 'vegetarian', whiteBase: 'white base',
    oven: 'Oven', bake: 'Bake', sec: 'sec', steps: 'Steps', takeaway: 'Takeaway', theMenu: 'The menu', menuSections: 'Menu sections', wholeMenu: 'See the whole menu',
    openingHours: 'Opening hours', address: 'Address', phone: 'Phone', email: 'Email', directions: 'Get directions', currentSite: 'Current site', quick: 'Quick actions', map: 'Map',
    skip: 'Skip to content', hungry: 'Hungry?', draftBy: 'Draft by Peak Apps Studio', more: 'More', orderAhead: 'Order ahead', callAhead: 'Call ahead and collect.', collectAt: (s) => `Collect your order at ${s}.`,
    tacosCatering: 'Tacos and catering', foodAt: (ad) => `Food at ${ad}`, giftText: 'Gift cards are sold online.', giftLink: 'Buy a gift card',
    draft: (ad, site) => `A website draft prepared for ${ad}. Text, prices and photos come from ${site}; this page is not live.`,
    draftOrder: (ad, site) => `A website draft prepared for ${ad}. Text, prices and photos come from ${site} and its own ordering page; this page is not live.`,
    title: (ad, sehir) => `${ad}, ${sehir}: website draft`, desc: (ad) => `A website draft prepared for ${ad} (not live).`,
    closed: 'Closed', closedToday: 'Closed today', to: ' to ', from: (p) => `from ${p}`,
    durum: { open: 'Open now, until {t}', shut: 'Closed, opens {w}', today: 'today at {t}', tomorrow: 'tomorrow at {t}', dayAt: '{d} at {t}' },
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  tr: {
    lang: 'tr', order: 'Sipariş ver', orderCollect: 'Sipariş ver', orderShort: 'Sipariş', call: 'Ara', callN: (t) => `Arayın: ${t}`, seeMenu: 'Menüye bakın', menu: 'Menü',
    backTop: (ad) => `${ad}, başa dön`, sections: 'Bölümler', pizzas: 'Pizzalar', burritos: 'Dürümler', howWe: 'Nasıl yapıyoruz', findUs: 'Bizi bulun', ourStory: 'Hikâyemiz', visit: 'Ziyaret',
    today: 'Bugün', open7: 'Haftanın her günü açık', hoursBelow: 'Saatler aşağıda', orderThis: 'Bunu sipariş et', prevPizza: 'Önceki pizza', nextPizza: 'Sonraki pizza', vegetarian: 'vejetaryen', whiteBase: 'beyaz taban',
    oven: 'Fırın', bake: 'Pişme', sec: 'sn', steps: 'Adımlar', takeaway: 'Paket servis', theMenu: 'Menü', menuSections: 'Menü bölümleri', wholeMenu: 'Bütün menüye bakın',
    openingHours: 'Çalışma saatleri', address: 'Adres', phone: 'Telefon', email: 'E-posta', directions: 'Yol tarifi alın', currentSite: 'Mevcut siteniz', quick: 'Hızlı işlemler', map: 'Harita',
    skip: 'İçeriğe geç', hungry: 'Acıktınız mı?', draftBy: 'Taslak: Peak Apps Studio', more: 'Devamı', orderAhead: 'Önceden sipariş', callAhead: 'Arayın, gelip alın.', collectAt: (s) => `Siparişinizi ${s} adresinden alabilirsiniz.`,
    tacosCatering: 'Öne çıkanlar', foodAt: (ad) => `${ad} mutfağından`, giftText: 'Hediye kartı internetten satılıyor.', giftLink: 'Hediye kartı alın',
    draft: (ad, site) => `${ad} için hazırlanmış web sitesi taslağı. Metinler, fiyatlar ve fotoğraflar ${site} adresinden alınmıştır; bu sayfa yayında değildir.`,
    draftOrder: (ad, site) => `${ad} için hazırlanmış web sitesi taslağı. Metinler, fiyatlar ve fotoğraflar ${site} adresinden ve işletmenin sipariş sayfasından alınmıştır; bu sayfa yayında değildir.`,
    title: (ad, sehir) => `${ad}${sehir ? `, ${sehir}` : ''}: web sitesi taslağı`, desc: (ad) => `${ad} için hazırlanmış web sitesi taslağı (yayında değil).`,
    closed: 'Kapalı', closedToday: 'Bugün kapalı', to: '–', from: (p) => `${p} başlayan fiyatlarla`,
    durum: { open: 'Şimdi açık · kapanış {t}', shut: 'Şu an kapalı · açılış {w}', today: 'bugün {t}', tomorrow: 'yarın {t}', dayAt: '{d} {t}' },
    days: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  },
};
export const kmOf = (lang) => KM[lang === 'tr' ? 'tr' : 'en'];

// ana eylem: isletmenin gercek baglantisina gore etiket (TR: Yemeksepeti/Getir/Trendyol -> "Sipariş ver", WhatsApp -> hattin kendi soyledigi is, rezervasyon -> "Masa ayırtın")
export function eylemEtiket(sip, t, E = {}) {
  if (!sip) return null;
  if (t.lang === 'tr') {
    if (/whatsapp/i.test(sip.platform || '') || /wa\.me|whatsapp\.com/i.test(sip.url || '')) return /sipari/i.test(sip.text || '') || sip.siparis ? { text: E.eylem || 'WhatsApp\'tan sipariş ver', kisa: E.eylemKisa || 'Sipariş' } : { text: E.eylem || 'WhatsApp\'tan yazın', kisa: E.eylemKisa || 'WhatsApp' };
    if (sip.tur === 'rezervasyon') return { text: E.eylem || 'Masa ayırtın', kisa: E.eylemKisa || 'Rezervasyon' };
    return { text: E.eylem || 'Sipariş ver', kisa: E.eylemKisa || 'Sipariş' };
  }
  return null;
}

// fiyat metninden sayi: "$12.50", "450 TL", "₺1.250,00", "120,50 ₺"
export function fiyatSayiTr(p) {
  const s = String(p || '');
  if (/₺|TL|TRY/i.test(s)) { const m = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/.exec(s); return m ? +(m[1].replace(/\./g, '') + (m[2] ? `.${m[2]}` : '')) : 0; }
  return +s.replace(/[^\d.]/g, '') || 0;
}
export const fiyatYaz = (n, lang) => (lang === 'tr' ? `₺${Number.isInteger(n) ? n.toLocaleString('tr-TR') : n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${n.toFixed(2)}`);
