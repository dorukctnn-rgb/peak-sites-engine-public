// Polite fetcher for the v2 mockups: one request at a time, a pause between requests, robots.txt respected, a clear user agent, hard size and time limits.
// Nothing is retried against a block (403, 429, robots): a site that says no is skipped, never worked around.
const UA = 'PeakAppsStudioDraftBot/1.0 (+https://peakappsstudio.com/web/; info@peakappsstudio.com)';
const TOKEN = 'peakappsstudiodraftbot';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- robots.txt (RFC 9309 subset: groups, Allow/Disallow, longest match, * and $) ----
export function parseRobots(text) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (k === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
    } else if ((k === 'allow' || k === 'disallow') && cur) {
      cur.rules.push({ allow: k === 'allow', path: v });
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  return groups;
}
const toRe = (p) => {
  const anchored = p.endsWith('$');
  const body = (anchored ? p.slice(0, -1) : p).split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
};
export function robotsAllows(groups, pathAndQuery) {
  const own = groups.filter((g) => g.agents.some((a) => a !== '*' && TOKEN.startsWith(a)));
  const use = own.length ? own : groups.filter((g) => g.agents.includes('*'));
  let best = null;
  for (const g of use) {
    for (const r of g.rules) {
      if (r.path === '') continue; // "Disallow:" with nothing = allow all
      let hit = false;
      try { hit = toRe(r.path).test(pathAndQuery); } catch { hit = false; }
      if (!hit) continue;
      const len = r.path.length;
      if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
    }
  }
  return best ? best.allow : true;
}

export class Polite {
  constructor({ gapMs = 900, hostGapMs = 1600, timeoutMs = 15000, log = () => {} } = {}) {
    this.gapMs = gapMs; this.hostGapMs = hostGapMs; this.timeoutMs = timeoutMs; this.log = log;
    this.lastAny = 0; this.lastHost = new Map(); this.robots = new Map(); this.count = 0;
  }
  async wait(host) {
    const now = Date.now();
    const need = Math.max(this.lastAny + this.gapMs - now, (this.lastHost.get(host) || 0) + this.hostGapMs - now, 0);
    if (need) await sleep(need);
    this.lastAny = Date.now(); this.lastHost.set(host, this.lastAny);
  }
  async raw(url, { maxBytes = 2_000_000, accept = '*/*', binary = false } = {}) {
    const u = new URL(url);
    await this.wait(u.host);
    this.count++;
    const ctl = AbortSignal.timeout(this.timeoutMs);
    let res;
    try { res = await fetch(url, { redirect: 'follow', signal: ctl, headers: { 'user-agent': UA, accept, 'accept-language': 'en,tr;q=0.8' } }); } catch (e) { return { ok: false, status: 0, error: String(e && e.cause && e.cause.code || e.name || e.message).slice(0, 60) }; }
    const finalUrl = res.url || url;
    const type = String(res.headers.get('content-type') || '').toLowerCase();
    const len = Number(res.headers.get('content-length') || 0);
    if (!res.ok) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return { ok: false, status: res.status, finalUrl, type }; }
    if (len && len > maxBytes) { try { res.body.cancel(); } catch { /* ignore */ } return { ok: false, status: res.status, finalUrl, type, error: 'too-big' }; }
    const chunks = []; let got = 0;
    try {
      let big = false;
      for await (const c of res.body) { got += c.length; if (got > maxBytes) { big = true; break; } chunks.push(c); } // leaving the loop cancels the stream
      if (big) return { ok: false, status: res.status, finalUrl, type, error: 'too-big' };
    } catch (e) { return { ok: false, status: res.status, finalUrl, type, error: 'read-' + String(e.name || e.message).slice(0, 30) }; }
    const buf = Buffer.concat(chunks);
    return { ok: true, status: res.status, finalUrl, type, buf, text: binary ? undefined : buf.toString('utf8') };
  }
  async robotsFor(origin) {
    if (this.robots.has(origin)) return this.robots.get(origin);
    const r = await this.raw(`${origin}/robots.txt`, { maxBytes: 300_000, accept: 'text/plain' });
    let entry;
    if (r.ok && /text|plain|octet/.test(r.type || 'text')) entry = { groups: parseRobots(r.text), state: 'ok' };
    else if (r.status === 404 || r.status === 410 || r.status === 401 || r.status === 403) entry = { groups: [], state: `none-${r.status}` };
    else entry = { groups: null, state: `unreachable-${r.status || r.error}` }; // 5xx or network error: do not guess, skip the site
    this.robots.set(origin, entry);
    return entry;
  }
  async allowed(url) {
    const u = new URL(url);
    const rb = await this.robotsFor(u.origin);
    if (!rb.groups) return { ok: false, why: `robots:${rb.state}` };
    return robotsAllows(rb.groups, u.pathname + u.search) ? { ok: true } : { ok: false, why: 'robots:disallow' };
  }
  // Baglanti canlilik denemesi: HEAD (400/403/405/501 ise tek GET; govde okunmadan iptal).  robots.txt ve aralik aynen uygulanir; bir engel asilmaz.
  // -> { ok, status, finalUrl, type, server, cf, yontem } | { ok:false, robots:true, why } | { ok:false, hata }
  async head(url) {
    let a; try { a = await this.allowed(url); } catch { return { ok: false, hata: 'bad-url' }; }
    if (!a.ok) {
      // robots.txt'e ULASILAMADI (DNS yok, baglanti reddi, sertifika, zaman asimi): ag hatasidir, robots yasagi degil
      const m = /^robots:unreachable-(.+)$/.exec(a.why || ''); if (m) return { ok: false, hata: m[1] };
      return { ok: false, robots: true, why: a.why };
    }
    const u = new URL(url);
    const dene = async (method) => {
      await this.wait(u.host); this.count++;
      const res = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(this.timeoutMs), headers: { 'user-agent': UA, accept: '*/*', 'accept-language': 'en,tr;q=0.8' } });
      try { res.body && res.body.cancel(); } catch { /* ignore */ }
      const h = (n) => String(res.headers.get(n) || '');
      return { ok: res.ok, status: res.status, finalUrl: res.url || url, type: h('content-type').toLowerCase(), server: h('server').toLowerCase(), cf: /cloudflare/i.test(h('server')) || !!h('cf-ray') || h('cf-mitigated') !== '', yontem: method };
    };
    try {
      let r = await dene('HEAD');
      if ([400, 403, 405, 501].includes(r.status)) { const g = await dene('GET'); r = { ...g, yontem: `HEAD ${r.status} -> GET` }; }
      return r;
    } catch (e) { return { ok: false, hata: String(e && e.cause && e.cause.code || e.name || e.message).slice(0, 60) }; }
  }
  // GET with robots check. -> { ok, ... } or { ok:false, why }
  async get(url, opts = {}) {
    let a;
    try { a = await this.allowed(url); } catch { return { ok: false, why: 'bad-url' }; }
    if (!a.ok) return a;
    const r = await this.raw(url, opts);
    if (r.ok && r.finalUrl && new URL(r.finalUrl).host !== new URL(url).host) {
      const b = await this.allowed(r.finalUrl);
      if (!b.ok) return b;
    }
    if (!r.ok) return { ...r, why: `http:${r.status || r.error}` };
    return r;
  }
}
