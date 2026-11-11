// "Bu isletme kapandi" ibaresi: sitenin kendi sozu (kalici kapanis, faaliyeti birakma, salgin donemi kapanisi).
// Kapali isletmeye demo sayfasi ve mail gitmez.  Yalniz kalici kapanis kaliplari aranir: "Closed on Mondays", "kitchen closed" gibi gunluk cumleler SAYILMAZ.
const KALIPLAR = [
  [/\bpermanently\s+closed\b/i, 'kalici kapanis'],
  [/\bclosed\s+(?:down\s+)?(?:for\s+good|permanently)\b/i, 'kalici kapanis'],
  [/\bceased\s+(?:trading|operat\w+|business)\b/i, 'faaliyeti birakmis'],
  [/\bno\s+longer\s+(?:be\s+)?(?:operat\w+|trading|open\s+(?:for|to)|accepting\s+(?:guests|bookings|reservations|customers)|taking\s+(?:guests|bookings|reservations)|(?:providing|offering|running)\s+(?:as\s+)?(?:guest\s+)?(?:accommodation|rooms|a\s+(?:b&b|bed))|(?:in\s+)?business)\b/i, 'faaliyeti birakmis'],
  [/\b(?:we|business|hotel|b&b|guesthouse|guest house|restaurant|salon|shop|store|cafe|café)\s+(?:has|have|had)\s+(?:now\s+)?(?:closed\s+(?:down|its\s+doors)|ceased)\b/i, 'kapanmis'],
  [/\b(?:has|have)\s+(?:now\s+)?closed\s+(?:its|our)\s+doors\b/i, 'kapanmis'],
  [/\b(?:now|currently|unfortunately)\s+closed\s+(?:in\s+line\s+with|due\s+to|because\s+of|following)\s+(?:the\s+)?(?:government|covid|coronavirus|pandemic|lockdown)/i, 'salgin donemi kapanisi (site guncel degil)'],
  [/\bclosed\s+(?:in\s+line\s+with|due\s+to|because\s+of)\s+(?:the\s+)?(?:government\s+guidelines|covid|coronavirus|pandemic|lockdown)/i, 'salgin donemi kapanisi (site guncel degil)'],
];

export function kapaliMi(text) {
  const t = String(text || '').replace(/\s+/g, ' ');
  for (const [re, neden] of KALIPLAR) { const m = re.exec(t); if (m) return { neden, ornek: t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).trim() }; }
  return null;
}
