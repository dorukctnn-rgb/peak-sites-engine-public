// node uyarla/slogan-kontrol.mjs "<slogan, *vurgu* ile>" "<isletme adi>"   -> "TAMAM" ya da reddedilme nedeni (cikis kodu 0/1)
// Inceleme turunun yazdigi slogan, sayfa uretilirken zaten sloganDogrula'dan gecer; burada onceden denenir.
import { sloganDogrula } from './lib/slogan.mjs';
const [text, name] = process.argv.slice(2);
const red = sloganDogrula(text, name || '');
console.log(red ? `RED: ${red}` : 'TAMAM');
process.exit(red ? 1 : 0);
