// OSM opening_hours -> haftalik saat tablosu (12 Kas 2026, kapi verimi).  Sitenin hicbir sayfasinda saat yoksa isletmenin OpenStreetMap kaydindaki
// opening_hours etiketi GERCEK bir kaynaktir; kayitta kaynak yazilir ("osm opening_hours (node/123)").  Emin olunamayan hicbir bicim kullanilmaz:
// ay/hafta/tarih kurali, gun dogumu, "+" (acik uclu), "||" (yedek kural), yorum, "24/7" (restoran icin cogu zaman yanlis girilmis) -> null (saat yok sayilir, uydurulmaz).
// OSM anlami: kuralda hic gecmeyen gun KAPALIDIR; sonraki kural (";") ayni gunu ezer; virgulle eklenen kural (", ") ekler.  Resmi tatil (PH) ve okul tatili (SH) kurallari atlanir.
// Cikti parseSaatler (lib/saat.mjs) bicimindedir: { week[7], rows, byDay, known, source: 'osm', conflict: false, tableOk } (gun indeksi 0 Pazar ... 6 Cumartesi).
const GUN = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const hhmm = (m) => { m %= 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const SAAT = /^([01]?\d|2[0-4]):([0-5]\d)$/;
const dk = (t) => { const m = SAAT.exec(t); if (!m) return null; const v = Number(m[1]) * 60 + Number(m[2]); return v > 1440 ? null : v; };

// "Mo-Fr" "Sa,Su" "Mo-We,Fr" -> [gun]; bilinmeyen parca -> null
function gunler(spec) {
  const out = new Set();
  for (const p of spec.split(',').map((x) => x.trim()).filter(Boolean)) {
    const m = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(p);
    if (!m) return null;
    const a = GUN[m[1].toLowerCase()]; const b = m[2] ? GUN[m[2].toLowerCase()] : a;
    let d = a; out.add(d); let g = 0; while (d !== b && g++ < 7) { d = (d + 1) % 7; out.add(d); }
  }
  return out.size ? [...out] : null;
}
// "11:00-14:30,17:30-22:30" -> [[acilis, kapanis]] (kapanis gece yarisini gecebilir); kapanis acilistan once ya da esitse ertesi gun
function araliklar(spec) {
  const out = [];
  for (const p of spec.split(',').map((x) => x.trim()).filter(Boolean)) {
    const m = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(p);
    if (!m) return null;
    const o = dk(m[1]); let c = dk(m[2]);
    if (o === null || c === null || o >= 1440) return null;
    if (c <= o) c += 1440;
    if (c - o < 60 || c - o > 1440) return null;
    out.push([o, c]);
  }
  for (let i = 1; i < out.length; i++) if (out[i][0] < out[i - 1][1]) return null; // ust uste binen araliklar
  return out.length ? out : null;
}

// tek kural: "[gunler] (araliklar | off | closed)"; gun yoksa her gun.  PH/SH kurali -> 'atla'
function kural(r) {
  const s = r.trim(); if (!s) return 'atla';
  if (/^(PH|SH)\b/.test(s)) return 'atla';
  const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?\s*,\s*)*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?)?\s*(.*)$/.exec(s);
  const g = m[1] ? gunler(m[1]) : [0, 1, 2, 3, 4, 5, 6];
  if (!g) return null;
  const t = m[2].trim();
  if (/^(off|closed)$/i.test(t)) return { g, kapali: true };
  const a = araliklar(t); if (!a) return null;
  return { g, a };
}

// "Mo-Fr 09:00-22:00, Sa-Su 09:00-22:30": virgulden sonra gun adi geliyorsa yeni kural (ek kural ayirici); saat listesi icindeki virgul ("12:00-15:00,18:00-22:00") bolunmez
// "Sa, Su 08:00-15:30" gun listesidir (bolunen parcada saat yoksa sonrakine geri eklenir)
function kuralBol(s) {
  const ham = s.split(/,\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b)/); const out = []; let bekleyen = '';
  for (const p of ham) { const x = bekleyen ? `${bekleyen}, ${p}` : p; if (/\d|\b(off|closed)\b/i.test(x)) { out.push(x); bekleyen = ''; } else bekleyen = x; }
  if (bekleyen) out.push(bekleyen);
  return out;
}

export function osmSaatCoz(deger) {
  const v = String(deger || '').replace(/\s+/g, ' ').trim();
  if (!v || v.length > 255) return null;
  // desteklenmeyen OSM ozellikleri: tarih/ay/hafta, gun dogumu/batimi, acik uclu, yedek kural, yorum, 24/7, "open"/"unknown" sozcukleri
  if (/24\/7|\|\||"|\+|sunrise|sunset|dawn|dusk|\bweek\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|\b(19|20)\d\d\b|\[|\]|\bopen\b|\bunknown\b|\beaster\b/i.test(v)) return null;
  const week = [null, null, null, null, null, null, null]; const ara = [null, null, null, null, null, null, null];
  let gecerli = 0;
  for (const blok of v.split(';')) {
    const parcalar = kuralBol(blok); let ilkParca = true;
    for (const p of parcalar) {
      const k = kural(p);
      if (k === null) return null;
      if (k === 'atla') { ilkParca = false; continue; }
      gecerli++;
      for (const d of k.g) {
        if (k.kapali) { week[d] = null; ara[d] = 'kapali'; continue; }
        // ";" ile gelen kural ayni gunu ezer; "," ile eklenen kural ekler (yalniz ayni bloktaki onceki parca icin)
        if (!ilkParca && Array.isArray(ara[d])) ara[d] = [...ara[d], ...k.a].sort((x, y) => x[0] - y[0]); else ara[d] = k.a.slice();
      }
      ilkParca = false;
    }
  }
  if (!gecerli) return null;
  for (let d = 0; d < 7; d++) {
    if (ara[d] === null) ara[d] = 'kapali'; // OSM: kuralda gecmeyen gun kapali
    if (Array.isArray(ara[d])) { for (let i = 1; i < ara[d].length; i++) if (ara[d][i][0] < ara[d][i - 1][1]) return null; week[d] = [ara[d][0][0], ara[d][ara[d].length - 1][1]]; }
  }
  if (!week.some(Boolean)) return null;
  const byDay = ara.map((x) => (x === 'kapali' ? 'closed' : x.map((r) => `${hhmm(r[0])}–${hhmm(r[1])}`).join(', ')));
  // ayni metinli gunler tek satir (Pzt..Paz sirasiyla)
  const rows = []; const sira = [1, 2, 3, 4, 5, 6, 0];
  for (const d of sira) { const t = byDay[d] === 'closed' ? null : byDay[d]; const r = rows.find((x) => x.t === t); if (r) r.d.push(d); else rows.push({ d: [d], t }); }
  return { week, rows, byDay, known: week.filter(Boolean).length, source: 'osm', conflict: false, tableOk: true };
}

// lead (hat/uretim.mjs uretimLead) -> cikarici.json'a yazilacak saat kaydi ya da null
export function osmSaatKaydi(lead) {
  const h = osmSaatCoz(lead && lead.osmSaat);
  if (!h) return null;
  return { ...h, via: `osm opening_hours${lead.osm ? ` (${lead.osm})` : ''}`, ham: String(lead.osmSaat), ...(lead.osmSaatTarih ? { kontrol: lead.osmSaatTarih } : {}) };
}
