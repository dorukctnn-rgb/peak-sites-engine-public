#!/usr/bin/env node
// Flags machine-written tells and off-brand typography in web copy.
//   node lint-copy.mjs <file|dir|url> [...] [--json] [--layout]
// Scans visible text in .html/.ejs/.md/.txt and string/JSX text in .tsx/.jsx/.ts/.js; for URLs it fetches the page.
// Reports: banned characters (em dash, arrows, check marks, emoji, sparkles...), cliché phrases, banned font families.
// --layout also checks the page width (Doruk, 5 Nov 2026: every page uses the whole screen on a desktop): in .css files and
// <style> blocks, the last width and max-width given to a main container (.wrap, .container, .page, .shell, .content,
// .layout, main) outside a narrow-screen @media block must not cap it under 1400 px ("narrow main container").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ifadeler } from './lib/sozluk.mjs';

const CHARS = [
  { re: /—/g, name: 'em dash —', hint: 'use a full stop, comma, colon or parentheses' },
  { re: /(?<=\D)–(?=\D)|\s–\s/g, name: 'en dash used as a dash', hint: 'rewrite the sentence (numeric ranges like 3–5 are fine)' },
  { re: /[a-z,)] - [a-zA-Z(]/g, name: 'spaced hyphen used as a dash', hint: 'rewrite with a full stop, comma or colon' },
  { re: /[→←↗↘⟶➜➔»]/g, name: 'arrow glyph', hint: 'use words ("Open the tool") or an SVG icon with aria-hidden' },
  { re: /[✓✔✅☑✗✘❌]/g, name: 'check/cross glyph', hint: 'use real list styling or an SVG icon' },
  { re: /[✨⭐🌟🚀🔥💡🎉👉👇✅📈💰🧠⚡️🎯🏆]/gu, name: 'emoji', hint: 'no emoji on web pages (push texts only)' },
  // ©, ®, ™ and rating stars are ordinary typography, not emoji.
  { re: /(?![©®™★☆])\p{Extended_Pictographic}/gu, name: 'pictograph/emoji', hint: 'no emoji on web pages' },
  { re: / · .* · /g, name: 'chain of middle-dot separators', hint: 'one separator per line at most; prefer a real list' },
];
const PHRASES = [
  'unlock', 'unleash', 'seamless', 'seamlessly', 'supercharge', 'elevate your', 'revolutioniz', 'game-changer', 'game changer',
  'next level', 'effortless', 'in today\'s', 'whether you\'re', 'look no further', 'dive into', 'delve', 'harness the',
  'leverage', 'empower', 'streamline', 'cutting-edge', 'state-of-the-art', 'robust solution', 'navigate the', 'tailored to',
  'boost your', 'say goodbye to', 'take your', 'it\'s not just', 'imagine a world', 'ready to transform', 'transform your',
  'all-in-one', 'one-stop', 'world-class', 'best-in-class', 'trusted by thousands', 'join thousands', 'loved by',
  'powerful yet simple', 'with ease', 'at your fingertips', 'magic', 'peace of mind', 'hassle-free', 'stunning',
];
// Turkce "yapay yazilmis" kaliplari (TR mail ve sayfa metni): kucuk harfle, Turkce yazimla
const PHRASES_TR = [
  'umarım iyisinizdir', 'umarız iyisinizdir', 'dijital dönüşüm', 'çözüm ortağı', 'dijital dünyada', 'dijital çağ', 'bir adım öne', 'fark yaratın', 'fark yaratan',
  'hayalinizdeki', 'kaçırmayın', 'özel teklif', 'sınırlı süre', 'markanızı bir üst', 'bir üst seviyeye', 'dijital varlığ', 'online varlığ', 'değerli işletme',
  'saygıdeğer', 'hizmetinizdeyiz', 'göz alıcı', 'büyüleyici', 'muhteşem', 'eşsiz deneyim', 'benzersiz deneyim', 'kusursuz', 'zahmetsiz', 'sorunsuz deneyim',
  'yenilikçi çözüm', 'profesyonel çözüm', 'sektörün lideri', 'en iyi fiyat', 'müşterilerinizi artır', 'satışlarınızı artır', 'ziyaretçi sayınızı', 'garantili',
  'sizi bir adım', 'güçlü bir dijital', 'hemen şimdi', 'bugün harekete geç',
];
// Banned families: the one shared list is store-studio's data/fonts/banned.json (Stüdyo plan K17); this list stays as
// the fallback when that file is missing or unreadable. Both are merged, so nothing the old list caught is lost.
const OWN_FONTS = ['Inter', 'Poppins', 'Manrope', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Nunito', 'Raleway', 'Space Grotesk'];
const BANNED_JSON = process.env.STUDYO_BANNED_JSON || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'store-studio', 'data', 'fonts', 'banned.json');
function bannedFonts() {
  try {
    const list = JSON.parse(fs.readFileSync(BANNED_JSON, 'utf8')).aileler.map((x) => x.ad).filter((x) => typeof x === 'string' && x.trim());
    return [...new Set([...OWN_FONTS, ...list])];
  } catch {
    return OWN_FONTS;
  }
}
const FONTS = bannedFonts();
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TEXT_EXT = new Set(['.html', '.htm', '.ejs', '.md', '.txt']);
const CODE_EXT = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs', '.json']);
const CSS_EXT = new Set(['.css', '.scss']);
const SKIP_DIR = /(^|[\\/])(node_modules|\.git|\.next|dist|build|out|vendor|\.vercel|coverage)([\\/]|$)/;

const args = process.argv.slice(2);
const json = args.includes('--json');
const layout = args.includes('--layout');
const targets = args.filter(a => !a.startsWith('--'));
const findings = [];

function decodeEntities(t) {
  return t.replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&rarr;/g, '→').replace(/&larr;/g, '←').replace(/&check;/g, '✓')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, m => /application\/ld\+json/.test(m) ? '' : '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<%[\s\S]*?%>/g, ' ')
    .replace(/<(meta)[^>]*content="([^"]*)"[^>]*>/gi, ' $2 ')
    .replace(/<[^>]+(alt|title|aria-label|placeholder)="([^"]*)"[^>]*>/gi, ' $2 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&rarr;/g, '→').replace(/&larr;/g, '←').replace(/&check;/g, '✓').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;|&rsquo;/g, "'")
    // numeric entities (&#127829; or &#x1F355;) hide emoji from a plain text scan
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}
function codeText(src) {
  // string literals and JSX text, skipping import lines and comments
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const parts = [];
  for (const m of noComments.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) if (/\s/.test(m[2]) && /[a-z]/i.test(m[2])) parts.push(m[2]);
  for (const m of noComments.matchAll(/>([^<>{}\n]{3,})</g)) parts.push(m[1]);
  return decodeEntities(parts.join('\n'));
}
function scan(label, text, kind) {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (kind !== 'css') {
      // In code, " - " is usually arithmetic inside template strings, so that rule only runs on prose.
      for (const c of CHARS) if (!(kind === 'code' && c.name.startsWith('spaced hyphen'))) for (const m of line.matchAll(c.re)) findings.push({ where: `${label}:${i + 1}`, type: c.name, hint: c.hint, sample: line.trim().slice(Math.max(0, m.index - 40), m.index + 40) });
      const low = line.toLowerCase();
      for (const p of PHRASES) {
        const idx = low.indexOf(p);
        if (idx > -1 && (p !== 'magic' || /\bmagic(al)?\b/.test(low))) findings.push({ where: `${label}:${i + 1}`, type: `cliché "${p}"`, hint: 'say what it does, for whom, and what to do next', sample: line.trim().slice(Math.max(0, idx - 40), idx + 50) });
      }
      // Turkce kaliplar (11 Kas 2026, TR pazari): Turkce kucuk harf (I -> ı, İ -> i) ayri satirda, Ingilizce kurallar bozulmasin
      const lowTr = line.toLocaleLowerCase('tr');
      for (const p of [...PHRASES_TR, ...ifadeler('lintCopyTr')]) {
        const idx = lowTr.indexOf(p);
        if (idx > -1) findings.push({ where: `${label}:${i + 1}`, type: `klişe "${p}"`, hint: 'ne yaptığını, kimin için olduğunu ve sıradaki adımı düz söyleyin', sample: line.trim().slice(Math.max(0, idx - 40), idx + 50) });
      }
    }
    if (kind === 'css' || /font-family|fontFamily|fonts\.googleapis/.test(line)) {
      for (const f of FONTS) if (new RegExp(`(["'\\s,:=]|family=)${reEsc(f).replace(/ /g, '[ +]')}(["'\\s,;:&]|$)`).test(line) && !/fallback|system-ui.*${f}/.test(line)) findings.push({ where: `${label}:${i + 1}`, type: `generic font "${f}"`, hint: 'use the product\'s own display/body pairing (see SKILL.md)', sample: line.trim().slice(0, 100) });
    }
  });
}
// --layout: a main container capped under 1400 px on a desktop. The last rule wins (a tool's own CSS after a shared file),
// width and max-width are followed apart, and a value given as var(--x) is read from the --x set in the same CSS.
const MAIN_BOX = /(?:^|[\s>+~(,])(\.wrap|\.container|\.page|\.shell|\.content|\.layout|main)(?![\w-])/;
const MIN_FULL = 1400;
function layoutScan(label, css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const vars = {};
  for (const m of src.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) vars[m[1]] = m[2].trim();
  const px = (v, depth = 0) => {
    v = String(v).trim().replace(/\s*!important$/, '');
    const vm = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
    if (vm) return depth > 4 ? null : vars[vm[1]] ? px(vars[vm[1]], depth + 1) : vm[2] ? px(vm[2], depth + 1) : null;
    const m = v.match(/^(\d+(?:\.\d+)?)(px|rem|em|ch)$/);
    return m ? Number(m[1]) * { px: 1, rem: 16, em: 16, ch: 8.5 }[m[2]] : null;
  };
  // the smallest fixed length among the top-level arguments of min(...), or the value itself
  const cap = (v) => {
    const mm = String(v).trim().match(/^min\(([\s\S]*)\)$/);
    if (!mm) return px(v);
    const parts = []; let depth = 0, cur = '';
    for (const ch of mm[1]) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { parts.push(cur); cur = ''; } else cur += ch; }
    parts.push(cur);
    const fixed = parts.map(p => px(p)).filter(n => n != null);
    return fixed.length ? Math.min(...fixed) : null;
  };
  const last = {}; // `${box} ${prop}` -> { value, line }
  const ctx = []; let start = 0;
  const lineAt = (k) => src.slice(0, k).split('\n').length;
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (c === '{') { ctx.push(src.slice(start, k).trim()); start = k + 1; }
    else if (c === '}') {
      const head = ctx.pop() || '';
      if (!head.startsWith('@') && !ctx.some(h => /^@media\b/.test(h) && /max-width/.test(h) && !/min-width/.test(h) || /^@media\s+print/.test(h))) {
        const box = (head.match(MAIN_BOX) || [])[1];
        if (box) for (const d of src.slice(start, k).split(';')) {
          const dm = d.match(/^\s*(max-width|width)\s*:\s*([\s\S]+?)\s*$/);
          if (dm) last[`${box} ${dm[1]}`] = { value: dm[2], line: lineAt(start), sel: head.replace(/\s+/g, ' ').slice(0, 80) };
        }
      }
      start = k + 1;
    }
  }
  for (const [key, { value, line, sel }] of Object.entries(last)) {
    const n = cap(value);
    if (n != null && n < MIN_FULL) findings.push({ where: `${label}:${line}`, type: 'narrow main container', hint: `the page must use the whole screen on a desktop: width min(100% - 2 * var(--gutter), 2240px), no max-width under ${MIN_FULL}px (premium-web-style 5b)`, sample: `${sel} { ${key.split(' ')[1]}: ${value} } = ${Math.round(n)}px` });
  }
}
function walk(p) {
  if (SKIP_DIR.test(p)) return;
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const n of fs.readdirSync(p)) walk(path.join(p, n)); return; }
  const ext = path.extname(p).toLowerCase();
  if (st.size > 1.5e6) return;
  const src = fs.readFileSync(p, 'utf8');
  if (TEXT_EXT.has(ext)) {
    scan(p, ext === '.md' || ext === '.txt' ? src : visibleText(src), 'text');
    if (layout && ext !== '.md' && ext !== '.txt') { const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n'); if (styles) layoutScan(p + ' [style]', styles); }
  }
  else if (CODE_EXT.has(ext) && !/\.min\./.test(p) && !/package(-lock)?\.json$/.test(p)) scan(p, codeText(src), 'code');
  else if (CSS_EXT.has(ext)) { scan(p, src, 'css'); if (layout) layoutScan(p, src); }
}

for (const t of targets) {
  if (/^https?:\/\//.test(t)) {
    const html = await (await fetch(t)).text();
    scan(t, visibleText(html), 'text');
    for (const m of html.matchAll(/font-family:[^;"}]+|fonts\.googleapis\.com\/css2?\?[^"']+/g)) scan(t + ' [css]', m[0], 'css');
    if (layout) { const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n'); if (styles) layoutScan(t + ' [style]', styles); }
  } else walk(t);
}

if (json) console.log(JSON.stringify(findings, null, 1));
else {
  const byType = {};
  findings.forEach(f => { byType[f.type] = (byType[f.type] || 0) + 1; });
  findings.slice(0, 200).forEach(f => console.log(`${f.where}  [${f.type}]  …${f.sample}…`));
  console.log(`\n${findings.length} findings` + (findings.length ? ': ' + Object.entries(byType).map(([k, v]) => `${k} ×${v}`).join(', ') : ': clean'));
}
process.exitCode = findings.length ? 1 : 0;
