// Sektor ve ulke tanimlari.  Tek kaynak: lead bulucu, puanlayici, uretici profili ve mail sablonu buradan okur.
// HEDEF (Doruk 10 Kas 2026): yurt disi; ABD ve Kanada yok (posta adresi kurali, memory/outreach-postal-line).
// 11 Kas 2026 Doruk: "restoran maillerine basla ... Antalya, Turkiye, Istanbul, butun Turkiye'ye de yaz!" -> TR hedefte (yalniz restoran ailesi).
//   TR: isletmenin sitesinde yayimlanmis is e-postasi; 6563 s. Kanun md. 6: tacir ve esnafa onaysiz ticari ileti gonderilebilir, ret hakki her mailde;
//   Doruk 30 Eki "IYS kaydi yok, sen gonder".  Serbest posta (gmail, hotmail) TR'de kucuk isletmelerin olagan is adresidir, alinir.
//   TR satirlari VARSAYILAN KAPALI: hat/kuyruk.mjs TR_KUYRUK=acik ve durum/onay.json "TR" onayi olmadan hic satir yazmaz.
// Hukuk (peak-durum/outreach/bodyarcade-creators/legal.md): AU, NZ, IE kosulsuz (kimlik + opt-out + susturma); GB YALNIZ sirket (Ltd/LLP/plc kaniti sitede);
// Almanya, Avusturya, Ispanya ve taranmamis ulkeler hic alinmaz.
export const ULKELER = {
  GB: { ad: 'Birleşik Krallık', dil: 'en', para: '£', sirketSart: true, serbestPostaYok: true },
  IE: { ad: 'İrlanda', dil: 'en', para: '€', sirketSart: false, serbestPostaYok: true },
  AU: { ad: 'Avustralya', dil: 'en', para: '$', sirketSart: false, serbestPostaYok: false },
  NZ: { ad: 'Yeni Zelanda', dil: 'en', para: '$', sirketSart: false, serbestPostaYok: false },
  TR: { ad: 'Türkiye', dil: 'tr', para: '₺', sirketSart: false, serbestPostaYok: false, yalnizSektor: ['restoran'], kuyrukAnahtari: 'TR_KUYRUK' },
};
// TR il kodlari (OSM ISO3166-2): yerel deneme ve bolge sirasi icin.  Antalya ve Istanbul once (Doruk 11 Kas).
export const TR_ILLER = { 'TR-07': 'Antalya', 'TR-34': 'İstanbul', 'TR-35': 'İzmir', 'TR-48': 'Muğla', 'TR-06': 'Ankara', 'TR-26': 'Eskişehir', 'TR-16': 'Bursa', 'TR-01': 'Adana', 'TR-33': 'Mersin', 'TR-27': 'Gaziantep', 'TR-42': 'Konya', 'TR-09': 'Aydın', 'TR-61': 'Trabzon', 'TR-17': 'Çanakkale', 'TR-41': 'Kocaeli' };
export const YASAK_ULKE = new Set(['US', 'CA', 'DE', 'AT', 'ES', 'IT', 'GR', 'MT', 'BE', 'CZ', 'CH', 'LT']);

const v = (t, k) => String(t[k] || '').toLowerCase();

// osm: Overpass etiket filtreleri (website ayrica eklenir).  tur: OSM etiketlerinden kisa tur adi (sayfada ust etiket ve mail icin).
// rezervasyon: bu sektorde gercek rezervasyon/randevu motorlarinin alan adlari (sitede bulunursa sayfanin ana dugmesi ONA gider).
export const SEKTORLER = {
  konaklama: {
    ad: 'küçük konaklama (pansiyon, B&B, apart, tatil evi, motel)',
    osm: ['["tourism"~"^(guest_house|apartment|chalet|motel)$"]'],
    tur: (t) => ({ guest_house: /b&b|bed and breakfast|bnb/i.test(t.name || '') || v(t, 'guest_house') === 'bed_and_breakfast' ? 'bed and breakfast' : 'guest house', apartment: 'holiday apartments', chalet: 'holiday cottage', motel: 'motel' })[t.tourism] || 'guest house',
    rezervasyon: /\b(freetobook\.com|eviivo\.com|beds24\.com|littlehotelier\.com|app\.mews\.com|cloudbeds\.com|thebookingbutton\.com|siteminder\.com|direct-book\.com|bookingsync\.com|lodgify\.com|supercontrol\.co\.uk|smoobu\.com|hostaway\.com|guesty\.com|newbook\.cloud|rmscloud\.com|resonline\.com\.au|staah\.net|roomraccoon\.com|frontdeskanywhere\.net|webrezpro\.com|thinkreservations\.com|book-directonline\.com|bookeddirect\.com|nightsbridge\.com|checkfront\.com|anytimebooking\.eu|bookalet\.co\.uk|hostfully\.com|ownerrez\.com|uplisting\.io|bookingcenter\.com|innstyle\.co\.uk|elinapms\.com|sabeeapp\.com|availabilityonline\.com|bookingautomation\.com|bookings\.ekko|tripadvisor\.com\/Hotel_Review|booking\.com\/hotel)\b/i,
    anahtar: { fiyat: /(per night|a night|\/night|pppn|per person per night|from\s*[£€$]\s?\d+|[£€$]\s?\d+\s*(?:pn|per))/i, oda: /\b(rooms?|suites?|apartments?|cottages?|studio|double|twin|king|queen|en-?suite|sleeps \d)\b/i },
  },
  guzellik: {
    ad: 'kuaför, güzellik salonu, berber',
    osm: ['["shop"~"^(hairdresser|beauty)$"]'],
    tur: (t) => (t.shop === 'beauty' ? 'beauty salon' : /barber/i.test(`${t.name || ''} ${t.hairdresser || ''}`) || v(t, 'hairdresser') === 'barber' ? 'barber' : 'hair salon'),
    rezervasyon: /\b(fresha\.com|treatwell\.(?:co\.uk|ie|com)|timely\.(?:com\.au|co\.nz|app)|gettimely\.com|phorest\.com|vagaro\.com|booksy\.com|squareup\.com\/appointments|square\.site|simplybook\.(?:me|it)|setmore\.com|kitomba\.com|shortcuts\.(?:com\.au|net)|salonized\.com|zenoti\.com|boulevard\.io|mindbodyonline\.com|schedulista\.com|acuityscheduling\.com|calendly\.com|bookwhen\.com|salonbookingsystem|styleseat\.com|glossgenius\.com|clinicsoftware\.com|pabau\.com|salonist|nuvola|meevo\.com|rosysalonsoftware\.com|sumup\.com\/booking|youcanbook\.me)\b/i,
    anahtar: { fiyat: /([£€$]\s?\d+(?:\.\d\d)?|from\s*[£€$])/i, hizmet: /\b(cut|colour|color|balayage|highlights|blow ?dry|fade|beard|shave|nails?|manicure|pedicure|facial|wax(?:ing)?|lash(?:es)?|brows?|massage|tint)\b/i },
  },
  dis: {
    ad: 'özel diş kliniği',
    osm: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
    tur: () => 'dental practice',
    rezervasyon: /\b(hotdoc\.com\.au|healthengine\.com\.au|dentally\.co|portal\.dentally|softwareofexcellence|exact-online|book\.dentr|dentr\.co\.uk|pearldentalsoftware|nexhealth\.com|zocdoc\.com|centaur|d4w|practiceworks|appointuit|bookdirect|dentalbooking|dentistry\.co\.uk|clinic\.to|cliniko\.com|nookal\.com|zandahealth\.com|healthkit|ezi\.health)\b/i,
    anahtar: { fiyat: /([£€$]\s?\d+|fees?|price list)/i, hizmet: /\b(check-?up|hygien|implant|whitening|invisalign|crown|veneer|root canal|extraction|filling|orthodont)\b/i },
    saglik: true,
  },
  spor: {
    ad: 'bağımsız spor salonu ve stüdyo',
    osm: ['["leisure"="fitness_centre"]', '["sport"~"^(fitness|yoga|pilates|crossfit)$"]["leisure"~"^(sports_centre|fitness_centre)$"]'],
    tur: (t) => (/yoga/i.test(`${t.name} ${t.sport}`) ? 'yoga studio' : /pilates/i.test(`${t.name} ${t.sport}`) ? 'pilates studio' : /crossfit/i.test(`${t.name} ${t.sport}`) ? 'CrossFit box' : 'gym'),
    rezervasyon: /\b(mindbodyonline\.com|glofox\.com|teamup\.com|gymmaster\.com|clubright\.co\.uk|legitfit\.com|wodify\.com|pushpress\.com|bsport\.io|momence\.com|zenplanner\.com|clubworx\.com|perfectgym\.com|gladstonego|ashbournemanagement|virtuagym\.com|bookwhen\.com|fitogram|eversports)\b/i,
    anahtar: { fiyat: /([£€$]\s?\d+\s*(?:\/|per|a)\s*(?:month|week|class)|membership)/i, hizmet: /\b(class(?:es)?|timetable|personal training|membership|trial|yoga|pilates|hiit|spin|strength)\b/i },
  },
  // 11 Kas 2026 (v5 tasima): restoran ve bar -> v5 sablonu; burger, burrito/taco/Meksika, pizza -> kategori sablonlari (uyarla/sablon-sec.mjs)
  restoran: {
    ad: 'bağımsız restoran ve bar; burgerci, burrito/taco, pizzacı (v5 ve kategori şablonları)',
    osm: ['["amenity"~"^(restaurant|fast_food|bar|pub)$"]'],
    tur: (t) => { const b = `${t.cuisine || ''} ${t.name || ''}`; return /burger/i.test(b) ? 'burger joint' : /pizza/i.test(b) ? 'pizzeria' : /mexican|burrito|taco|tex-mex/i.test(b) ? 'burrito and taco bar' : t.amenity === 'bar' || t.amenity === 'pub' ? 'bar' : 'restaurant'; },
    // rezervasyon ve siparis motorlari: sitede bulunursa sayfanin TEK ana eylemi ona gider
    rezervasyon: /\b(opentable\.(?:com|co\.uk|ie|com\.au)|resy\.com|sevenrooms\.com|quandoo\.|resdiary\.com|bookatable|nowbookit\.com|obee\.com\.au|tablein\.com|dimmi\.com\.au|thefork\.|exploretock\.com|eveve\.com|tablecheck\.com|designmynight\.com|collinsbookings\.com|deliveroo\.|ubereats\.com|just-?eat\.|menulog\.|doordash\.com|flipdish|orderyoyo\.|delivereasy\.|mryum|meandu\.app|bopple\.|hungryhungry\.|square\.site|slerp\.com|storekit\.|foodhub\.|gloriafood|toasttab\.com|chownow\.com|mobi2go\.com|orders\.wowapps\.com|yemeksepeti\.com|getir\.com|tgoyemek\.com|trendyol\.com\/yemek|trendyolyemek|migros\.com\.tr\/yemek|wa\.me|api\.whatsapp\.com\/send|whatsapp\.com\/send)\b/i,
    anahtar: { fiyat: /([£€$₺]\s?\d+(?:[.,]\d\d)?|\b\d{2,5}(?:[.,]\d{2})?\s?(?:₺|TL|TRY)(?!\p{L}))/u, menu: /\b(?:menus?|menü)(?!\p{L})/iu },
  },
};

// Zincir / franchise adlari (restoran, guzellik, dis, spor): bunlarin sitesi merkezden yonetilir, sube karar vermez
export const SEKTOR_ZINCIR = /\b(mcdonald'?s|burger king|hungry jack'?s|kfc|subway|domino'?s|pizza hut|papa john'?s|five guys|gbk|gourmet burger kitchen|byron|honest burgers|nando'?s|grill'?d|zambrero|guzman y gomez|mad mex|taco bell|chipotle|boojum|pizza express|pizzaexpress|franco manca|wagamama|wetherspoon|harvester|toby carvery|beefeater|supermac'?s|apache pizza|four star pizza|eddie rocket'?s|burgerfuel|hell pizza|wendy'?s|carl'?s jr|starbucks|costa coffee|pret a manger|greggs|itsu|zizzi|ask italian|prezzo|bella italia|miller & carter|slim chickens|wingstop|popeyes|fireaway|toni ?& ?guy|rush hair|supercuts|regis|headmasters|just cuts|hairhouse|lasercutz|rodney wayne|bupa dental|mydentist|my dentist|portman|dental care alliance|smile ?direct|pacific smiles|maven dental|national dental care|lumino|anytime fitness|pure ?gym|the gym group|snap fitness|jetts|f45|orangetheory|planet fitness|nuffield|david lloyd|virgin active|fitness first|goodlife|les mills|plus fitness|jims? fitness|curves|bannatyne|everlast|energie)\b/i;

// Turkiye zincirleri (11 Kas 2026, TR pazari): sozcuk siniri Turkce harflerle (\b Turkce harfte calismaz, u bayragi + harf bakisi)
export const TR_ZINCIR = /(?<!\p{L})(simit saray[ıi]|kahve d[üu]nyas[ıi]|mado|hd iskender|k[öo]fteci yusuf|big ?chefs|midpoint|k[öo][şs]eba[şs][ıi]|nusr-?et|g[üu]nayd[ıi]n|tavuk d[üu]nyas[ıi]|komagene|bayd[öo]ner|little caesars|sbarro|usta d[öo]nerci|d[üu]r[üu]mle|pidem|maydonoz d[öo]ner|[çc]i[ğg]k[öo]ftem|kahve diyar[ıi]|gloria jean'?s|caribou|espressolab|arby'?s|[öo]zs[üu]t|saray muhallebicisi|haf[ıi]z mustafa|faruk g[üu]ll[üu]o[ğg]lu|happy moon'?s|cookshop|kitchenette|ramiz k[öo]fte|k[öo]fteci ramiz|tavuk[çc]u [şs]ahin|kebap[çc][ıi] halil|pide ?by ?pide|bereket d[öo]ner|kasap d[öo]ner|pizza locale|sushico|shake shack|tchibo|coffy|caf[eé] crown|pasaport pizza|terra pizza|pizza ?max|burger ?lab|dominos|mc ?donald'?s|burger king|kfc|subway|domino'?s|pizza hut|papa john'?s|popeyes|starbucks|wendy'?s|carl'?s jr|sushico|wok to walk|wagamama|nando'?s|five guys|taco bell)(?!\p{L})/iu;
