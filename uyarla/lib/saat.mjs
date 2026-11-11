// Calisma saatleri: sayfa metninden (EN/TR) ve schema.org'dan haftalik tabloya. Emin olunamayan hicbir sey tabloya girmez.
// parseSaatler(lines, ld) -> { week:[7 x (null | [acilis, kapanis] dakika, kapanis 1440'i asabilir)], rows:[{d:[gun indeksleri], t:'17:00–22:00'|'Kapali'}], source } | null
// gun indeksi: 0 Pazar ... 6 Cumartesi
const fold = (s) => String(s).toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[.’']/g, '');
const DAYS = { mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sun: 0, sunday: 0,
  pzt: 1, pazartesi: 1, sali: 2, sal: 2, carsamba: 3, car: 3, persembe: 4, per: 4, cuma: 5, cum: 5, cumartesi: 6, cmt: 6, pazar: 0, paz: 0 };
const GROUPS = { daily: [0, 1, 2, 3, 4, 5, 6], everyday: [0, 1, 2, 3, 4, 5, 6], 'every day': [0, 1, 2, 3, 4, 5, 6], '7 days': [0, 1, 2, 3, 4, 5, 6], '7 days a week': [0, 1, 2, 3, 4, 5, 6], 'her gun': [0, 1, 2, 3, 4, 5, 6], 'haftanin her gunu': [0, 1, 2, 3, 4, 5, 6], 'hergun': [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5], weekday: [1, 2, 3, 4, 5], 'hafta ici': [1, 2, 3, 4, 5], haftaici: [1, 2, 3, 4, 5], weekends: [6, 0], weekend: [6, 0], 'hafta sonu': [6, 0], haftasonu: [6, 0] };
// kapali gun: Turkce "kapalı" ı ile biter ve \b orada calismaz (11 Kas TR denemesi: "Pazar kapalı" bilinmeyen gun sayiliyordu), harf bakisi + u bayragi
const CLOSED = /(?<!\p{L})(closed|kapali|kapalı|tatil|off)(?!\p{L})/iu;
const GROUP_RE = new RegExp(`(${Object.keys(GROUPS).sort((a, b) => b.length - a.length).map((k) => k.replace(/ /g, '\\s+')).join('|')})`, 'i');
const DAY_RE = /\b(monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun|pazartesi|pzt|sal[ıi]|sal|[çc]ar[şs]amba|[çc]ar|per[şs]embe|per|cumartesi|cmt|cuma|cum|pazar|paz)\b\.?/gi;
const T = '(?:2[0-4]|[01]?\\d)(?:[:.][0-5]\\d)?\\s?(?:am|pm|a\\.m\\.|p\\.m\\.)?';
const RANGE_RE = new RegExp(`(${T})\\s?(?:-|–|—|to|until|till|ile|/|~)\\s?(${T}|late|close|midnight|gece)`, 'gi');

function toMin(tok) {
  const m = /^(\d{1,2})(?:[:.](\d{2}))?\s?(am|pm|a\.m\.|p\.m\.)?$/i.exec(tok.trim());
  if (!m) return null;
  let h = Number(m[1]); const mi = Number(m[2] || 0); const ap = (m[3] || '').toLowerCase().replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}
function parseRange(a, b) {
  const sa = /(am|pm|a\.m\.|p\.m\.)$/i.exec(a.trim()); const sb = /(am|pm|a\.m\.|p\.m\.)$/i.exec(b.trim());
  let A = a.trim(); const B = b.trim();
  if (/^(late|close|midnight|gece)$/i.test(B)) return null;
  if (!sa && sb) { // "5-10pm", "11-3pm": acilis kapanistan once olsun
    const same = toMin(`${A}${sb[1]}`); const cl = toMin(B);
    const am = toMin(`${A}am`);
    if (same !== null && cl !== null && same < cl) A = `${A}${sb[1]}`;
    else if (am !== null) A = `${A}am`;
  }
  const o = toMin(A); let c = toMin(B);
  if (o === null || c === null) return null;
  if (c === 0 && o > 0) c = 1440;
  if (c <= o) c += 1440;
  if (c - o < 60 || c - o > 1440 + 360) return null;
  return [o, c];
}
const hhmm = (m) => { m %= 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

function expandDays(spec) {
  const s = fold(spec);
  const g = GROUP_RE.exec(s);
  if (g) return GROUPS[g[1].replace(/\s+/g, ' ').toLowerCase()] || null;
  const found = []; let m; DAY_RE.lastIndex = 0;
  const raw = spec;
  while ((m = DAY_RE.exec(raw))) found.push({ d: DAYS[fold(m[1])], i: m.index, end: m.index + m[0].length });
  if (!found.length) return null;
  const out = new Set();
  for (let i = 0; i < found.length; i++) {
    const f = found[i]; out.add(f.d);
    const next = found[i + 1];
    if (next && /^\s*(?:-|–|—|to|ile|through|thru|\/)\s*$/i.test(raw.slice(f.end, next.i))) {
      let d = f.d; let guard = 0;
      while (d !== next.d && guard++ < 7) { d = (d + 1) % 7; out.add(d); }
      i++; out.add(next.d);
    }
  }
  return [...out];
}

// bir satir parcasi: gunler + saat araliklari ya da kapali
function segment(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  const ranges = []; let m; RANGE_RE.lastIndex = 0;
  let firstRangeAt = -1;
  while ((m = RANGE_RE.exec(t))) { const r = parseRange(m[1], m[2]); if (firstRangeAt < 0) firstRangeAt = m.index; if (r) ranges.push(r); else if (/^(late|close|midnight|gece)$/i.test(m[2])) ranges.push('late'); }
  const closed = CLOSED.test(t) && !ranges.length;
  const dayPart = firstRangeAt >= 0 ? t.slice(0, firstRangeAt) : t.replace(CLOSED, '');
  const days = expandDays(dayPart);
  return { days, ranges, closed, hasTime: ranges.length > 0 };
}

// "Mon-Fri 7am-4pm Sat-Sun 8am-3pm": saat araligindan hemen sonra yeni bir gun/grup basliyorsa orada bol
const NEXT_DAY = /^[\s,&/-]*(?=(?:monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat|sunday|sun|pazartesi|pzt|cumartesi|cmt|cuma|pazar|daily|weekdays?|weekends?|hafta\s?(?:ici|sonu)|her\s?g[uü]n)\b)/i;
function presplit(line) {
  const out = []; let start = 0; let m; RANGE_RE.lastIndex = 0;
  while ((m = RANGE_RE.exec(line))) {
    const end = m.index + m[0].length; const n = NEXT_DAY.exec(line.slice(end));
    if (n && n[0].length <= 4) { const cut = end + n[0].length; out.push(line.slice(start, end)); start = cut; }
  }
  out.push(line.slice(start));
  return out;
}

export function parseSaatler(lines = [], ld = []) {
  const week = [null, null, null, null, null, null, null];
  const seen = new Set();
  const rows = []; let conflict = false; const val = new Map();
  const set =(days, ranges, closed, source) => {
    const before = new Set(seen);
    for (const d of days) {
      if (seen.has(d)) continue;
      seen.add(d);
      if (closed) { week[d] = null; continue; }
      const good = ranges.filter((r) => Array.isArray(r));
      if (!good.length || ranges.includes('late')) continue; // "late" gibi belirsiz kapanis: tabloya girmez
      week[d] = [good[0][0], good[good.length - 1][1]];
    }
    const good = ranges.filter((r) => Array.isArray(r));
    const sig = closed ? 'closed' : good.map((r) => `${r[0]}-${r[1]}`).join(',') + (ranges.includes('late') ? 'L' : '');
    for (const d of days) { if (before.has(d) && val.get(d) !== sig) { const env = week[d]; const inside = !closed && env && good.length && good[0][0] >= env[0] && good[good.length - 1][1] <= env[1]; if (!inside) conflict = true; } if (!before.has(d)) val.set(d, sig); } // ayni gun baska yerde FARKLI yazilmis (ilk araligin icindeki menu bolumu saati degil)
    const fresh = days.filter((d) => !before.has(d));
    if (!fresh.length) return;
    if (closed) rows.push({ d: fresh, t: null });
    else if (good.length && !ranges.includes('late')) rows.push({ d: fresh, t: good.map((r) => `${hhmm(r[0])}–${hhmm(r[1])}`).join(', ') });
  };
  // 1) schema.org
  for (const o of ld) {
    const ohs = o && o.openingHoursSpecification;
    for (const x of Array.isArray(ohs) ? ohs : ohs ? [ohs] : []) {
      if (!x || !x.opens || !x.closes) continue;
      const days = (Array.isArray(x.dayOfWeek) ? x.dayOfWeek : [x.dayOfWeek]).filter(Boolean).map((d) => DAYS[fold(String(d).replace(/^.*\//, '')).slice(0, 3)]).filter((d) => d !== undefined);
      const r = parseRange(String(x.opens).slice(0, 5), String(x.closes).slice(0, 5));
      if (days.length && r) set(days, [r], false, 'json-ld');
    }
    const oh = o && o.openingHours;
    for (const s of Array.isArray(oh) ? oh : oh ? [oh] : []) if (typeof s === 'string') { const sg = segment(s); if (sg.days && sg.hasTime) set(sg.days, sg.ranges, false, 'json-ld'); }
  }
  if (seen.size >= 3) return finish(week, rows, 'json-ld', conflict);
  // 2) sayfa metni: tek satir ("Mon-Fri 5pm-10pm") ya da iki satir (gun / saat)
  const L = lines.flatMap((l) => l.split(/\s*[|•·;]\s*/)).flatMap(presplit).map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && l.length <= 120);
  let pending = null;
  for (let i = 0; i < L.length; i++) {
    const line = L[i];
    if (/(\d{1,2}[./]\d{1,2}[./]\d{2,4})|@|https?:/i.test(line)) { pending = null; continue; }
    // satirda birden fazla gun adi + saat varsa ("Mon 5-10pm Tue 5-10pm") gun adlarindan bol
    const dayHits = [...line.matchAll(DAY_RE)];
    const parts = [];
    if (dayHits.length >= 2 && dayHits.length <= 7 && !/(-|–|—)\s*$/.test(line)) {
      const idx = dayHits.map((h) => h.index);
      // aralik ("Mon - Fri") varsa bolme
      const hasRangeJoin = dayHits.some((h, k) => k && /^\s*(?:-|–|—|to|ile)\s*$/i.test(line.slice(dayHits[k - 1].index + dayHits[k - 1][0].length, h.index)));
      if (!hasRangeJoin && (line.match(RANGE_RE) || []).length >= 2) { idx.forEach((s, k) => parts.push(line.slice(s, idx[k + 1] ?? line.length))); }
    }
    if (!parts.length) parts.push(line);
    for (const part of parts) {
      const sg = segment(part);
      if (sg.days && (sg.hasTime || sg.closed)) { set(sg.days, sg.ranges, sg.closed, 'page'); pending = null; }
      else if (sg.days && !sg.hasTime && !sg.closed && part.length <= 40) pending = sg.days;
      else if (!sg.days && (sg.hasTime || sg.closed) && pending) { set(pending, sg.ranges, sg.closed, 'page'); pending = null; }
      else if (!sg.days && !sg.hasTime && !sg.closed) pending = pending && part.length <= 20 ? pending : null;
    }
  }
  return finish(week, rows, 'page', conflict);
}

function finish(week, rows, source, conflict = false) {
  // 00:00-00:00 (ya da 00:00-24:00) bazi gunlerde yazilip digerlerinde yazilmiyorsa o gun kapalidir (siteler kapali gunu boyle yazar)
  const full = week.map((w) => !!w && w[0] === 0 && w[1] === 1440);
  if (full.some(Boolean) && week.some((w, i) => w && !full[i])) {
    for (let d = 0; d < 7; d++) if (full[d]) week[d] = null;
    for (const r of rows) if (r.t === '00:00–00:00' || r.t === '00:00–24:00') r.t = null;
  }
  // ust uste binen araliklar ("07:00–16:00, 08:00–15:00") bir gunde iki ayri kaynagin karismis halidir
  for (const r of rows) if (r.t) { const rs = r.t.split(', ').map((x) => x.split('–').map((y) => Number(y.slice(0, 2)) * 60 + Number(y.slice(3)))); for (let a = 1; a < rs.length; a++) if (rs[a][0] < rs[a - 1][1] && rs[a][0] !== undefined) conflict = true; }
  const known = week.filter(Boolean).length;
  if (known < 1) return null;
  // ayni saat metnine sahip bitisik gunleri tek satira topla (Pzt-Cum 17:00-22:00)
  const byDay = Array(7).fill(null);
  for (const r of rows) for (const d of r.d) if (byDay[d] === null) byDay[d] = r.t === null ? 'closed' : r.t;
  return { week, rows: rows.length ? rows : [], byDay, known, source, conflict, tableOk: !conflict && byDay.filter(Boolean).length >= 3 };
}

export const gunAdi = {
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

// Kayitli (cikarici.json) saatleri sayfaya girmeden once denetler: sayfada yanlis saat gostermektense tabloyu gizler.
// -> { hours: (temizlenmis ya da null), issue: null | 'cakisma' | 'ust-uste' }
const mins = (t) => t.split(', ').map((x) => { const [o, c] = x.split('–').map((y) => Number(y.slice(0, 2)) * 60 + Number(y.slice(3))); return [o, c <= o ? c + 1440 : c]; });
export function saatDenetle(h) {
  if (!h || !h.tableOk && !h.conflict) return { hours: null, issue: null };
  const hours = JSON.parse(JSON.stringify(h));
  const week = hours.week; const full = week.map((w) => !!w && w[0] === 0 && w[1] === 1440);
  if (full.some(Boolean) && week.some((w, i) => w && !full[i])) {
    for (let d = 0; d < 7; d++) if (full[d]) { week[d] = null; if (hours.byDay) hours.byDay[d] = 'closed'; }
    for (const r of hours.rows || []) if (r.t === '00:00–00:00' || r.t === '00:00–24:00') r.t = null;
    hours.known = week.filter(Boolean).length;
  }
  let issue = h.conflict ? 'cakisma' : null;
  const first = new Map(); // gun -> ilk satirin zarfi
  for (const r of hours.rows || []) {
    const rs = r.t ? mins(r.t) : null;
    if (rs) for (let a = 1; a < rs.length; a++) if (rs[a][0] < rs[a - 1][1]) issue = issue || 'ust-uste';
    const env = rs ? [rs[0][0], rs[rs.length - 1][1]] : null;
    for (const d of r.d) {
      if (!first.has(d)) { first.set(d, env); continue; }
      const f0 = first.get(d);
      const inside = env && f0 && env[0] >= f0[0] && env[1] <= f0[1];
      if (!inside) issue = issue || 'cakisma';
    }
  }
  if (issue) return { hours: null, issue };
  return { hours: hours.tableOk ? hours : null, issue: null };
}
