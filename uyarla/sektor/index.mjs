// Sektor profilleri: restoran/bar/kafe varsayilandir (profil yok).  Yeni sektor = bu listeye bir modul.
// Her modul: AD, ETIKET (sayfa metinleri), ek() (cikarici eki), model() (uretici modeli), kapiKural() (kalite kapisi).
import * as konaklama from './konaklama.mjs';
import * as guzellik from './guzellik.mjs';
export const SEKTOR = { konaklama, guzellik };
export const profil = (lead) => (lead && SEKTOR[lead.sektor]) || null;
