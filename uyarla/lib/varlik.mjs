// HTML varliklarini cozer (menu metni, yemek adi karsilastirmasi): v2lib/scrape.mjs decode() yalniz noktalama ve para varliklarini bilir; sitenin kendi metni ("G&uuml;neyin",
// "K&ouml;fte") Latin-1 ve Turkce harf varliklariyla da gelir.  Eksik varlik oldugu gibi kalir.  Ag yok.
import { decode } from '../v2lib/scrape.mjs';
const BUYUK = 'Agrave:À Aacute:Á Acirc:Â Atilde:Ã Auml:Ä Aring:Å AElig:Æ Ccedil:Ç Egrave:È Eacute:É Ecirc:Ê Euml:Ë Igrave:Ì Iacute:Í Icirc:Î Iuml:Ï Ntilde:Ñ Ograve:Ò Oacute:Ó Ocirc:Ô Otilde:Õ Ouml:Ö Oslash:Ø Ugrave:Ù Uacute:Ú Ucirc:Û Uuml:Ü Yacute:Ý Gbreve:Ğ Scedil:Ş Idot:İ Scaron:Š Zcaron:Ž OElig:Œ';
const KUCUK = 'agrave:à aacute:á acirc:â atilde:ã auml:ä aring:å aelig:æ ccedil:ç egrave:è eacute:é ecirc:ê euml:ë igrave:ì iacute:í icirc:î iuml:ï ntilde:ñ ograve:ò oacute:ó ocirc:ô otilde:õ ouml:ö oslash:ø ugrave:ù uacute:ú ucirc:û uuml:ü yacute:ý yuml:ÿ szlig:ß gbreve:ğ scedil:ş imath:ı scaron:š zcaron:ž oelig:œ';
const TABLO = new Map([...BUYUK.split(' '), ...KUCUK.split(' ')].map((x) => x.split(':')));
export function varlikCoz(s) {
  return decode(String(s ?? '')).replace(/&([A-Za-z]+);/g, (m, e) => TABLO.get(e) ?? m);
}
