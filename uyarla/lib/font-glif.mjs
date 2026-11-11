// FONT GLIF DENETIMI (11 Kas 2026, TR pazari): bir WOFF2 dosyasinin cmap tablosunu okur ve Turkce harflerin (ğ Ğ ş Ş ı İ ç Ç ö Ö ü Ü) fontta
// GERCEKTEN bulunup bulunmadigini olcer.  Tarayicinin yedek fonta dusmesi kabul edilmez: glifi olmayan font TR sayfasinda kullanilmaz.
//   node uyarla/lib/font-glif.mjs [klasor] [--yaz uyarla/data/font-tr-glif.json]
// Bagimlilik yok: WOFF2 baslik + tablo dizini (W3C WOFF2 5.x) + Brotli (node:zlib) + cmap bicim 4 / 12.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const TURKCE = 'ğĞşŞıİçÇöÖüÜ';
const ETIKET = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function base128(b, o) { let v = 0; for (let i = 0; i < 5; i++) { const x = b[o.p++]; v = (v * 128) + (x & 0x7f); if (!(x & 0x80)) return v; } throw new Error('UIntBase128 bozuk'); }

// -> Map(kod noktasi -> glif no) (yalniz glif no > 0 olanlar)
export function woff2Cmap(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('WOFF2 degil');
  const n = buf.readUInt16BE(12); const o = { p: 48 }; const tablolar = [];
  for (let i = 0; i < n; i++) {
    const f = buf[o.p++]; let tag = ETIKET[f & 0x3f];
    if ((f & 0x3f) === 63) { tag = buf.toString('latin1', o.p, o.p + 4); o.p += 4; }
    const orig = base128(buf, o); const surum = (f >> 6) & 3;
    const donusmus = tag === 'glyf' || tag === 'loca' ? surum === 0 : surum !== 0;
    const uzun = donusmus ? base128(buf, o) : orig;
    tablolar.push({ tag, uzun });
  }
  const sikisik = buf.readUInt32BE(20);
  const veri = zlib.brotliDecompressSync(buf.subarray(o.p, o.p + sikisik));
  let off = 0; let cmap = null;
  for (const t of tablolar) { if (t.tag === 'cmap') { cmap = veri.subarray(off, off + t.uzun); break; } off += t.uzun; }
  if (!cmap) throw new Error('cmap yok');
  return cmapOku(cmap);
}

export function cmapOku(c) {
  const out = new Map(); const n = c.readUInt16BE(2); const kayit = [];
  for (let i = 0; i < n; i++) kayit.push({ pid: c.readUInt16BE(4 + i * 8), eid: c.readUInt16BE(6 + i * 8), off: c.readUInt32BE(8 + i * 8) });
  const sira = (k) => (k.pid === 3 && k.eid === 10 ? 0 : k.pid === 0 && k.eid >= 4 ? 1 : k.pid === 3 && k.eid === 1 ? 2 : k.pid === 0 ? 3 : 9);
  for (const k of kayit.sort((a, b) => sira(a) - sira(b))) {
    if (sira(k) === 9) continue;
    const f = c.readUInt16BE(k.off);
    if (f === 4) {
      const seg = c.readUInt16BE(k.off + 6) / 2; const son = k.off + 14; const bas = son + seg * 2 + 2; const delta = bas + seg * 2; const ro = delta + seg * 2;
      for (let s = 0; s < seg; s++) {
        const e = c.readUInt16BE(son + s * 2); const b = c.readUInt16BE(bas + s * 2); const d = c.readInt16BE(delta + s * 2); const r = c.readUInt16BE(ro + s * 2);
        for (let cp = b; cp <= e && cp !== 0xffff; cp++) {
          let g;
          if (!r) g = (cp + d) & 0xffff; else { const gi = ro + s * 2 + r + (cp - b) * 2; g = c.readUInt16BE(gi); if (g) g = (g + d) & 0xffff; }
          if (g && !out.has(cp)) out.set(cp, g);
        }
      }
    } else if (f === 12) {
      const ng = c.readUInt32BE(k.off + 12);
      for (let i = 0; i < ng; i++) { const p = k.off + 16 + i * 12; const s0 = c.readUInt32BE(p); const e0 = c.readUInt32BE(p + 4); const g0 = c.readUInt32BE(p + 8); for (let cp = s0; cp <= e0 && cp - s0 < 70000; cp++) if (g0 + cp - s0 && !out.has(cp)) out.set(cp, g0 + cp - s0); }
    }
  }
  return out;
}

// klasordeki <id>-latin-<w>.woff2 + <id>-latin-ext-<w>.woff2 ciftleri: her aile/agirlik icin eksik Turkce harfler (iki alt kumenin birlesimi)
export function klasorDenetle(dir, harfler = TURKCE) {
  const ciftler = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.woff2'))) {
    const m = /^(.+?)-(latin-ext|latin)-(\d{3}i?)\.woff2$/.exec(f); if (!m) continue;
    const k = `${m[1]}|${m[3]}`; const c = ciftler.get(k) || { aile: m[1], agirlik: m[3], dosya: {} }; c.dosya[m[2]] = f; ciftler.set(k, c);
  }
  const sonuc = [];
  for (const c of [...ciftler.values()].sort((a, b) => `${a.aile}${a.agirlik}`.localeCompare(`${b.aile}${b.agirlik}`))) {
    const var_ = new Set(); const altKume = {};
    for (const [sub, f] of Object.entries(c.dosya)) { const cm = woff2Cmap(fs.readFileSync(path.join(dir, f))); altKume[sub] = [...harfler].filter((h) => cm.has(h.codePointAt(0))).join(''); for (const h of altKume[sub]) var_.add(h); }
    sonuc.push({ aile: c.aile, agirlik: c.agirlik, eksik: [...harfler].filter((h) => !var_.has(h)).join(''), altKume });
  }
  return sonuc;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const dir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(HERE, '..', 'sablon-fontlar');
  const r = klasorDenetle(dir);
  for (const x of r) console.log(`${`${x.aile} ${x.agirlik}`.padEnd(34)} ${x.eksik ? `EKSIK: ${x.eksik}` : 'tam'}   (latin: ${x.altKume.latin || '-'} | latin-ext: ${x.altKume['latin-ext'] || '-'})`);
  const i = process.argv.indexOf('--yaz');
  if (i > 0) { fs.writeFileSync(process.argv[i + 1], JSON.stringify({ olculdu: new Date().toISOString().slice(0, 10), harfler: TURKCE, kaynak: 'uyarla/lib/font-glif.mjs (WOFF2 cmap)', sonuc: r }, null, 1) + '\n'); console.log(`yazildi: ${process.argv[i + 1]}`); }
  process.exitCode = r.some((x) => x.eksik) ? 1 : 0;
}
