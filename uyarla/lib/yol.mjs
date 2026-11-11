// Yollar: yerelde ve bulutta (GitHub Actions) ayni kod.  Ortam degiskeni yoksa depo icindeki calisma/ klasoru kullanilir.
//   UYARLA_VERI   = isletme basina ara veri (cikarici.json, img/, ekran goruntuleri)   varsayilan <depo>/calisma/veri
//   UYARLA_DEMO   = sayfalarin yazildigi web/demo klasoru                              varsayilan <depo>/calisma/demo
//   UYARLA_ORTAK  = sayfalarin ortak dosya klasoru (web/demo/<ORTAK>/)                 varsayilan _hat1
//   MOCKUP_CHROME = Chromium yolu (yoksa ms-playwright klasorundeki en yeni Chromium)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VERI = process.env.UYARLA_VERI || path.join(KOK, 'calisma', 'veri');
export const DEMO = process.env.UYARLA_DEMO || path.join(KOK, 'calisma', 'demo');
// Bulut hatti kendi surumlu ortak klasorunu kullanir (_hat1): restoran toplu turunun _uyarla klasoruyle cakismaz, eski maillerdeki sayfalar bozulmaz.
export const ORTAK = process.env.UYARLA_ORTAK || '_hat1';

// playwright-core Chromium indirmez: bulutta `npx playwright-core install chromium` kurar.  Burada ms-playwright klasorundeki en yeni surum aranir.
export function chromiumYolu() {
  const kokler = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'), path.join(os.homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  for (const k of kokler) {
    let dirs = [];
    try { dirs = fs.readdirSync(k).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])); } catch { continue; }
    for (const d of dirs) for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome']) { const p = path.join(k, d, rel); if (fs.existsSync(p)) return p; }
  }
  return undefined; // playwright-core kendi varsayilanini dener
}
// v5 restoran ve kategori (burger, burrito, pizza) sablonlarinin ortak klasorleri: canli el yapimi demolarin _uyarla ve _kategori klasorleriyle cakismaz
// (hat bu dosyalari degistirse bile 11 Kas'ta onaylanan alti demo bozulmaz).
export const ORTAK_V5 = process.env.UYARLA_ORTAK_V5 || '_hat1v5';
export const ORTAK_K = process.env.UYARLA_ORTAK_K || '_hat1k';
// sablon fontlari depoda (OFL, fontsource): bulutta ag gerekmez, sonuc her turda ayni
export const SABLON_FONT = path.join(KOK, 'uyarla', 'sablon-fontlar');
