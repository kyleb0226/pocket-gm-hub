/* ----------------------------- high school: stat lines, records, honours ----------------------------- */
// High school football is lopsided: a few kids dominate small-school opponents and put up absurd numbers,
// most are just fine, and a few care more about their history homework. Profiles are built from a
// per-player seed (never the game RNG), so looking at a page can't change a sim.
const HS_KEY = { QB: ["py", "passing yards", 4300], RB: ["ry", "rushing yards", 3300], WR: ["rcy", "receiving yards", 1900], TE: ["rcy", "receiving yards", 1900], DE: ["sck", "sacks", 28], DT: ["sck", "sacks", 28], LB: ["tk", "tackles", 240], CB: ["int", "interceptions", 12], S: ["int", "interceptions", 12], OT: ["pk", "pancakes", 150], OG: ["pk", "pancakes", 150], C: ["pk", "pancakes", 150], K: ["fgm", "field goals", 34], P: ["puy", "punting yards", 3700] };
const HS_USE = { QB: 1.15, RB: 2.1, WR: 2.0, TE: 1.9, DL: 2.6, LB: 1.5, DB: 1.6, OL: 1.7, K: 1, P: 1 };
const HS_CLASS = { "6A": .9, "5A": 1, "4A": 1.1, "3A": 1.2, "2A": 1.35, "1A": 1.5 };
const HS_NOSCALE = { g: 1, gs: 1, fgl: 1 };
const hsStateF = st => .86 + ((st.charCodeAt(0) * 7 + st.charCodeAt(1) * 3) % 29) / 100;
function hsProfile(G, p, claim){
  if (p.hsl) return p.hsl;
  const keep = _rng; _rng = mulberry32(((p.id * 2654435761) ^ (G.seed || 7)) >>> 0);
  try {
    const stars = p.stars || clamp(round((p.pot - 52) / 9.5), 1, 5), cls = pick(["6A", "5A", "5A", "4A", "4A", "3A", "3A", "2A", "1A"]), cm = HS_CLASS[cls];
    let D = [0, .42, .5, .62, .8, 1.02][stars] * Math.exp(gauss(0, .22)) * cm; if (p.pos === "K" || p.pos === "P") D = Math.min(D, .95);
    const g = rint(11, 15), base = fakeLine(p.pos, Math.max(45, p.ovr) + 6, g, true), M = HS_USE[GROUP(p.pos)] || 1.5;
    const sr = {}, tot = {}, yrs = D > 1.1 ? 3.1 : 2.4; for (const k in base) { sr[k] = HS_NOSCALE[k] ? base[k] : round(base[k] * M * D * gauss(1, .06)); tot[k] = HS_NOSCALE[k] ? (k === "fgl" ? base[k] : round(base[k] * yrs * 1.15)) : round(sr[k] * (1 + .78 + .55 + (D > 1.1 ? .3 : 0)) * gauss(1, .05)); }
    [sr, tot].forEach(o => { if (o.pa != null) o.pc = Math.min(o.pc, o.pa); if (o.fga != null) o.fgm = Math.min(o.fgm, o.fga); });
    const h = { cls, st: (p.home || "TX, TX").slice(-2), sr, tot, D: +D.toFixed(2), aw: [], rec: [], note: [] };
    if (cm >= 1.35 && D > 1.1) h.note.push("Eye-popping numbers, but against " + cls + " competition");
    if (p.gpa >= 3.6 && stars <= 2) h.note.push("More worried about his AP US History grade than his stat line");
    else if (p.gpa >= 3.85) h.note.push("Straight-A student");
    else if (p.gpa < 2.3) h.note.push("Academic eligibility questions");
    if (stars <= 2 && D < .8 && !h.note.length) h.note.push("Two-way starter on a run-heavy team; limited film");
    if (D >= 2.4) h.note.push("Stat sheet looks like a video game");
    p.hsl = h;
    const kk = HS_KEY[p.pos]; if (claim && kk) { G.hsRec = G.hsRec || {};
      [[h.st, hsStateF(h.st), "ST"], ["US", 1.3, "US"]].forEach(([key, f, sc]) => [["S", sr[kk[0]], kk[2] * f], ["C", tot[kk[0]], kk[2] * f * 2.5]].forEach(([per, v, b]) => { const id = key + "|" + kk[0] + "|" + per, r = G.hsRec[id]; if (v > (r ? r.v : round(b))) { G.hsRec[id] = { v, pid: p.id, n: pname(p), y: G.year + 1, st: h.st, lbl: kk[1], per, key, prev: r ? [r.n, r.v] : null }; h.rec.push({ sc, lbl: (per === "S" ? "Single-season " : "Career ") + kk[1], v, st: h.st }); } })); }
    return h;
  } finally { _rng = keep; }
}
// Mr. Football per state and national player of the year, from a recruiting class.
function hsHonors(G, ids){
  const ps = ids.map(id => G.players[id]).filter(p => p && p.hsl), sc = new Map(); ps.forEach(p => sc.set(p.id, (p.ovr + p.pot) / 2 + p.hsl.D * 4 + ((p.id * 7919) % 100) / 25));
  const by = {}; ps.forEach(p => (by[p.hsl.st] || (by[p.hsl.st] = [])).push(p));
  for (const st in by) { const top = by[st].sort((a, b) => sc.get(b.id) - sc.get(a.id)); if (top[0] && (top[0].stars || 3) >= 3) top[0].hsl.aw.push("Mr. Football · " + st); top.filter(p => (p.stars || 0) >= 4).slice(0, 3).forEach(p => p.hsl.aw.indexOf("All-State · " + st) < 0 && p.hsl.aw.push("All-State · " + st)); }
  const nat = ps.slice().sort((a, b) => sc.get(b.id) - sc.get(a.id)); nat.slice(0, 1).forEach(p => p.hsl.aw.unshift("National Player of the Year")); nat.slice(0, 40).forEach(p => p.hsl.aw.indexOf("National Player of the Year") < 0 && p.hsl.aw.push("High School All-American"));
}
