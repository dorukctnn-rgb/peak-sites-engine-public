// KAPI SURUMU: uretici ya da kapi iyilestirilince (KAPI_SURUM artar), daha once "gozden-gecir" cikmis ve nedeni TEKNIK olan isletmeler
// (kontrast, tasma, baslik, bozuk gorsel ...) bir kez yeniden uretilir.  Veri sorunlari (fotograf yok/az, logo yok, menu ya da oda yok, site acilmadi) ve
// "elendi" ya da "hazir" olanlar yeniden uretilmez: yeni surum onlari degistiremez.  Biten isi yeniden kosmama kuralinin guvenli istisnasi.
import fs from 'node:fs';

export const KAPI_SURUM = 3; // 3: capture=1 WebGL'siz (bulutta siyah kahraman), bos kahraman kapisi, kapali isletme elemesi, telefon dizisi elemesi; 2: ust etiket (eyebrow) rengi yedegi, telefonda uzun dugme etiketi, adres gibi ad korumasi, guzellik profili
const VERI_SORUNU = /fotoğraf sayısı|kullanilabilir fotograf|logo yok|adres ve telefon yok|oda bilgisi|hizmet listesi|menü yok|marka rengi|site okunamadı|site bos|islem hatasi|işlem hatası|zaman asimi/i;

export function tekrarGerek(k) {
  return !!k && k.status === 'gozden-gecir' && (k.surum || 1) < KAPI_SURUM && (k.reasons || []).some((r) => !VERI_SORUNU.test(String(r)));
}

// bu isletmenin kapi sonucu NIHAI mi (yeniden uretime girmez)?  kapi.json yoksa false
export function kapiBitti(file) {
  let k = null; try { k = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return false; }
  return !tekrarGerek(k);
}
