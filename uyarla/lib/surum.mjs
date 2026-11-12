// KAPI SURUMU: uretici ya da kapi iyilestirilince (KAPI_SURUM artar), daha once "gozden-gecir" cikmis ve nedeni TEKNIK olan isletmeler
// (kontrast, tasma, baslik, bozuk gorsel ...) bir kez yeniden uretilir.  Veri sorunlari (fotograf yok/az, logo yok, menu ya da oda yok, site acilmadi) ve
// "elendi" ya da "hazir" olanlar yeniden uretilmez: yeni surum onlari degistiremez.  Biten isi yeniden kosmama kuralinin guvenli istisnasi.
import fs from 'node:fs';

export const KAPI_SURUM = 3; // 3: capture=1 WebGL'siz (bulutta siyah kahraman), bos kahraman kapisi, kapali isletme elemesi, telefon dizisi elemesi; 2: ust etiket (eyebrow) rengi yedegi, telefonda uzun dugme etiketi, adres gibi ad korumasi, guzellik profili
const VERI_SORUNU = /fotoğraf sayısı|kullanilabilir fotograf|logo yok|adres ve telefon yok|oda bilgisi|hizmet listesi|menü yok|marka rengi|site okunamadı|site bos|islem hatasi|işlem hatası|zaman asimi/i;

export function tekrarGerek(k) {
  return !!k && k.status === 'gozden-gecir' && (k.surum || 1) < KAPI_SURUM && (k.reasons || []).some((r) => !VERI_SORUNU.test(String(r)));
}

// RESTORAN ON KAPI SURUMU (12 Kas 2026, kapi verimi; uyarla/restoran-hazirla.mjs ON_KAPI_SURUM): saat artik OSM opening_hours'tan, adres OSM addr + koordinattan
// tamamlanir ve yalniz telefon butun ulkelerde eylemdir.  Daha eski surumde YALNIZ bu nedenlerle elenmis restoran bir kez yeniden hazirliktan gecer; cikarici verisi
// saklandigi icin siteye yeniden gidilmez (hat/uretim.mjs).  Baska bir neden de varsa (zincir, fotograf, logo, menu, telefon yok) karar nihaidir.
export const RESTORAN_ON_KAPI_SURUM = 2;
const YENI_KURAL = /^(çalışma saati yok \(sitenin hiçbir sayfasında\)|adres yok|gerçek sipariş ya da rezervasyon bağlantısı yok \(yalnız telefon\))$/;
export function yenidenHazirlik(k) {
  return !!k && k.status === 'elendi' && k.sektor === 'restoran' && (k.onKapiSurum || 1) < RESTORAN_ON_KAPI_SURUM && Array.isArray(k.reasons) && k.reasons.length > 0 && k.reasons.every((r) => YENI_KURAL.test(String(r).trim()));
}

// bu isletmenin kapi sonucu NIHAI mi (yeniden uretime girmez)?  kapi.json yoksa false
export function kapiBitti(file) {
  let k = null; try { k = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return false; }
  return !tekrarGerek(k) && !yenidenHazirlik(k);
}
