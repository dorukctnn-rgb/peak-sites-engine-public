// MARKA SADAKATI: palet isletmenin kendi renklerinden cikar (renk.mjs); burada
//   1) logonun ikinci rengi kucuk vurgu olarak eklenir (accent2),
//   2) dugme yazisi mumkunse sitenin kendi rengiyle kalir (gerekirse dugme tonu EN COK %10 koyulur/acilir), olmuyorsa markanin kendi koyu/acik yuzey rengi kullanilir,
//   3) "onlarinki -> bizimki" notlari yazilir (Doruk kurali: logo rengi capadir; zayif palet iyilestirilir, iyi palet aynen kalir),
//   4) sadakat denetimi: mod, zemin ve vurgu sitenin kendi degerlerinden uzaklasmis mi.
import { hexToRgb, lum, sat } from '../v2lib/scrape.mjs';
import { contrast, ensureContrast, rgbToHsl } from '../v2lib/theme.mjs';
import { kontrastKontrol } from './renk.mjs';
const TARAYICI_LINK = new Set(['#0000ee', '#0000ff', '#551a8b', '#ee0000']);

const hex6 = (h) => { if (!h) return null; let x = String(h).trim().toLowerCase(); if (!x.startsWith('#')) return null; x = x.slice(1); if (x.length === 3) x = x.split('').map((c) => c + c).join(''); return /^[0-9a-f]{6}$/.test(x) ? `#${x}` : null; };
const hsl = (h) => rgbToHsl(hexToRgb(h));
const Lum = (h) => lum(hexToRgb(h));
const Sat = (h) => sat(hexToRgb(h));
export const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

export function markaPaleti(R, pal) {
  const t = pal.t; const C = (R.colours && R.colours.computed) || {}; const used = (R.colours && R.colours.used) || {};
  const notlar = [];
  // ---- logonun ikinci rengi ----
  const ah = hsl(t.accent)[0];
  const lp = ((R.logo && R.logo.palette) || []).map((p) => ({ ...p, hex: hex6(p.hex) })).filter((p) => p.hex && p.share >= 0.05 && Sat(p.hex) >= 0.5 && Lum(p.hex) > 0.04 && Lum(p.hex) < 0.8);
  const a2 = lp.find((p) => hueDist(hsl(p.hex)[0], ah) >= 14) || null;
  t.accent2 = a2 ? a2.hex : t.accent;
  t.accent2Text = contrast(t.accent2, t.bg) >= 3 ? t.accent2 : ensureContrast(t.accent2, t.bg, 3);
  pal.source.accent2 = a2 ? { hex: a2.hex, via: 'logo' } : null;
  // ---- dugme yazisi ----
  // tarayicinin varsayilan baglanti renkleri (#0000ee, #551a8b) isletmenin marka rengi degildir (11 Kas TR denemesi: turkuaz dugmede mavi yazi seciliyordu)
  const siteBtn = hex6(C.btn && C.btn.ownBg); const siteInk = hex6(C.btn && C.btn.color);
  const fromBtn = siteBtn && pal.source.accent && pal.source.accent.hex === siteBtn;
  if (fromBtn && siteInk) {
    const theirs = contrast(siteInk, siteBtn);
    if (theirs >= 4.5) { t.accent = siteBtn; t.accentInk = siteInk; } else {
      const adj = ensureContrast(siteBtn, siteInk, 4.5);
      if (Math.abs(hsl(adj)[2] - hsl(siteBtn)[2]) <= 0.1 && contrast(adj, siteInk) >= 4.5) {
        t.accent = adj; t.accentInk = siteInk;
        notlar.push({ ne: 'düğme tonu', onlarinki: `${siteBtn} üzerinde ${siteInk} (kontrast ${theirs.toFixed(1)})`, bizimki: `${adj} üzerinde ${siteInk} (${contrast(adj, siteInk).toFixed(1)})`, neden: 'düğme yazısı zor okunuyordu; marka tonu en çok %10 koyulaştırıldı, yazı rengi aynı kaldı' });
      } else {
        const marka = [hex6(C.body && C.body.ownBg), hex6(C.header && C.header.bg), hex6(C.footer && C.footer.bg), ...(used.bg || []).map((x) => hex6(x.hex)), ...(used.text || []).map((x) => hex6(x.hex))].filter(Boolean).filter((c) => !TARAYICI_LINK.has(c.toLowerCase()));
        const ink = marka.find((c) => contrast(c, siteBtn) >= 4.5 && Sat(c) > 0.08) || marka.find((c) => contrast(c, siteBtn) >= 4.5) || t.accentInk;
        t.accent = siteBtn; if (contrast(ink, siteBtn) >= 4.5) t.accentInk = ink;
        notlar.push({ ne: 'düğme yazısı', onlarinki: `${siteBtn} üzerinde ${siteInk} (kontrast ${theirs.toFixed(1)})`, bizimki: `${siteBtn} üzerinde ${t.accentInk} (${contrast(t.accentInk, siteBtn).toFixed(1)})`, neden: 'düğme rengi aynen kaldı; okunmayan yazı rengi markanın kendi koyu tonuyla değişti' });
      }
    }
    t.accentHi = t.accent;
  }
  // ---- govde metni ve zemin ----
  const body = (used.text || []).map((x) => hex6(x.hex)).filter(Boolean);
  const siteBg = pal.source.baseBg;
  const main = body.find((c) => contrast(c, siteBg) >= 3) || body[0];
  if (main && main !== t.ink && contrast(main, siteBg) < 7) notlar.push({ ne: 'gövde metni', onlarinki: `${main} (zeminle kontrast ${contrast(main, siteBg).toFixed(1)})`, bizimki: `${t.ink} (${contrast(t.ink, t.bg).toFixed(1)})`, neden: 'uzun metin rahat okunsun diye kontrast artırıldı' });
  if (siteBg && siteBg !== t.bg) notlar.push({ ne: 'zemin', onlarinki: siteBg, bizimki: t.bg, neden: 'sitenin kendi zemini hafifçe düzeltildi' });
  pal.checks = kontrastKontrol(t);
  pal.marka = { durum: notlar.length ? 'iyileştirildi' : 'korundu', notlar };
  return pal;
}

// sadakat denetimi (kapi + test): palet isletmenin kendi renklerinden uzaklasmamali
export function paletSadakati(R, pal) {
  const C = (R.colours && R.colours.computed) || {}; const t = pal.t; const sorun = [];
  const bodyOwn = hex6(C.body && C.body.ownBg);
  if (bodyOwn) {
    const siteDark = Lum(bodyOwn) < 0.1;
    if (siteDark && pal.mode !== 'dark') sorun.push(`site koyu zeminli (${bodyOwn}) ama sayfa açık`);
    if (siteDark && Sat(bodyOwn) >= 0.12) {
      const h0 = hsl(bodyOwn)[0];
      for (const [k, c] of [['zemin', t.bg], ['koyu panel', t.deep], ['hero gölgesi', t.shade]]) {
        if (Sat(c) >= 0.12 && hueDist(h0, hsl(c)[0]) > 28) sorun.push(`${k} tonu kaydı (${bodyOwn} → ${c})`);
      }
    }
  }
  const btn = hex6(C.btn && C.btn.ownBg);
  if (btn && pal.source.accent && pal.source.accent.hex === btn) {
    const a = hsl(btn); const b = hsl(t.accent);
    if (hueDist(a[0], b[0]) > 12 || Math.abs(a[2] - b[2]) > 0.12) sorun.push(`düğme rengi kaydı (${btn} → ${t.accent})`);
  }
  return { ok: !sorun.length, sorun };
}
