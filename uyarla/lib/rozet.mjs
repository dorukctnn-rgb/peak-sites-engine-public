// Odul, sertifika, puan rozeti, hediye karti gibi GRAFIKLER isletmenin fotografi degildir; alt metni ya da dosya adi soyler.  Ag yok.
const ROZET = /\b(awards?|accolades?|rosettes?|winners?|finalists?|certificates?|trophy|accredit\w*|trustpilot|tripadvisor|testimonials?|gift ?cards?|vouchers?|badges?|payment|5 ?\*|client experience|rated)\b|[-_+ ](award|badge|certificate|finalist|winner|trophy)[-_+ .\d]/i;

export function rozetMi(alt, url) {
  let ad = ''; try { ad = decodeURIComponent(String(url || '').split('?')[0].split('/').pop() || ''); } catch { ad = String(url || '').split('?')[0].split('/').pop() || ''; }
  return ROZET.test(`${alt || ''} ${ad} ${ad.replace(/[_.]+/g, ' ')}`);
}
