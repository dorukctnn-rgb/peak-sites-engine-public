// Eski etiket uyumu.  Inceleme etiketleri ve bazi alan adlari notr adlara tasindi (inceleyen: "icerik-turu" | "son-goz"; alanlar sonGoz, icerikTuru ...).
// Eski karar ve veri dosyalari eski adlari tasiyabilir: okunurken esleme tablosuyla yeni adlara cevrilir.
// Tablo ozel sozlukte durur (hat/ozel-sozluk.json, alan "eskiEtiket": { inceleyen: {eski: yeni}, anahtar: {eski: yeni}, dosya: {eski: yeni}, dal: [[eskiOnek, yeniOnek]] }).
// Tablo yoksa ya da bossa veri degismeden doner (yeni veri zaten yeni adlari tasir).
import { sozlukVarsa } from '../uyarla/lib/sozluk.mjs';

export const eskiTablo = () => { const s = sozlukVarsa(); return (s && s.eskiEtiket) || {}; };

// nesneyi derin gezer: anahtar adlari ve 'inceleyen' degerleri cevrilir; diger degerler aynen kalir
export function eskiEtiketCoz(x, tablo = eskiTablo()) {
  const A = tablo.anahtar || {}; const D = tablo.inceleyen || {};
  if (!Object.keys(A).length && !Object.keys(D).length) return x;
  const gez = (v) => {
    if (Array.isArray(v)) return v.map(gez);
    if (!v || typeof v !== 'object') return v;
    const o = {};
    for (const [k, w] of Object.entries(v)) {
      const yk = Object.prototype.hasOwnProperty.call(A, k) ? A[k] : k;
      o[yk] = yk === 'inceleyen' && typeof w === 'string' && Object.prototype.hasOwnProperty.call(D, w) ? D[w] : gez(w);
    }
    return o;
  };
  return gez(x);
}

// eski dal adi onekleri -> yeni onek (dal adi zaten yeniyse aynen)
export function eskiDalCoz(dal, tablo = eskiTablo()) {
  for (const [a, b] of tablo.dal || []) if (typeof a === 'string' && a && String(dal).startsWith(a)) return b + String(dal).slice(a.length);
  return dal;
}

// eski dosya adi -> yeni dosya adi
export const eskiDosyaCoz = (ad, tablo = eskiTablo()) => (tablo.dosya && tablo.dosya[ad]) || ad;
