/* ----------------------------- all-star bowls: high school, college, pro ----------------------------- */
// High school: the All-American Bowl (top 100 recruits, East v West) and the Under Armour game (next 100).
// College: the Senior Bowl (top 100 draft prospects, North v South) and the East-West Shrine Bowl (next 100).
// Pro: the Pro Bowl (see allStarGame). Every game lands in G.asgs, newest first.
const ASG_BOWLS = [
  { key: "aab", lvl: "hs", title: "All-American Bowl", city: "San Antonio", from: 0, to: 100, sides: ["East", "West"], split: "region" },
  { key: "ua", lvl: "hs", title: "Under Armour All-America Game", city: "Orlando", from: 100, to: 200, sides: ["Team Black", "Team White"], split: "snake" },
  { key: "sb", lvl: "col", title: "Senior Bowl", city: "Mobile", from: 0, to: 100, sides: ["North", "South"], split: "snake" },
  { key: "shrine", lvl: "col", title: "East-West Shrine Bowl", city: "Las Vegas", from: 100, to: 200, sides: ["East", "West"], split: "region" },
];
const BOWL_WEST = { W: 1, SW: 1, MW: 1 };
function bowlGame(G, b, ps){
  if (ps.length < 24) return null;
  const sides = [[], []];
  if (b.split === "region") ps.forEach((p, i) => { const st = (p.home || "").slice(-2), w = BOWL_WEST[REGION[st]] ? 1 : 0; sides[sides[w].length > sides[1 - w].length + 6 ? 1 - w : w].push(p); });
  else ps.forEach((p, i) => sides[[0, 1, 1, 0][i % 4]].push(p));
  const q = p => (p.hsl ? p.ovr * .7 + p.pot * .3 : p.ovr), str = s => avgOf(s, q, 70), d = (str(sides[0]) - str(sides[1])) * .5;
  let s1 = Math.max(3, round(gauss(24 + d, 8))), s2 = Math.max(3, round(gauss(24 - d, 8))); if (s1 === s2) s1 += rint(1, 3);
  const w = s1 > s2 ? 0 : 1, pool = sides[w].filter(p => ["QB", "RB", "WR", "TE", "DE", "LB", "CB", "S"].includes(p.pos)),
    mvp = pool.length ? wpick(pool.map(p => [p, Math.pow(q(p) / 75, 6) * (isOff(p.pos) ? 2 : 1)])) : null;
  const line = !mvp ? "" : mvp.pos === "QB" ? `${rint(10, 18)}/${rint(17, 25)}, ${rint(140, 270)} yds, ${rint(2, 4)} TD` : mvp.pos === "RB" ? `${rint(8, 14)} car, ${rint(60, 130)} yds, ${rint(1, 2)} TD` : isOff(mvp.pos) ? `${rint(4, 8)} rec, ${rint(80, 160)} yds, ${rint(1, 2)} TD` : `${rint(3, 7)} tkl, ${rint(1, 3)} sck${chance(.35) ? ", 1 INT" : ""}`;
  const tag = b.title + " MVP", rec = G.rec ? G.rec.length : 0;
  ps.forEach(p => { const lbl = b.title; if (p.hsl) { p.hsl.aw.indexOf(lbl) < 0 && p.hsl.aw.push(lbl); } else p.aw.push([G.year, lbl]); });
  if (mvp) { if (mvp.hsl) mvp.hsl.aw.push(tag); else mvp.aw.push([G.year, tag]); }
  const g = { y: G.year + 1, key: b.key, lvl: b.lvl, title: b.title, city: b.city, sides: b.sides, sc: [s1, s2], n: ps.length, mvp: mvp ? { pid: mvp.id, n: pname(mvp), pos: mvp.pos, line, from: b.lvl === "hs" ? mvp.home : (T(G, mvp.col) || {}).name || "", side: b.sides[w] } : null,
    rosters: sides.map(s => s.slice(0, 40).map(p => ({ pid: p.id, n: pname(p), pos: p.pos, rk: p.rk || (G.draft && G.draft.rank ? G.draft.rank[p.id] : 0) }))) };
  (G.asgs = G.asgs || []).unshift(g);
  const mine = ps.some(p => (p.col === G.uid) || (p.commit === G.uid));
  news(G, `${b.title}: ${b.sides[w]} wins ${Math.max(s1, s2)}–${Math.min(s1, s2)}. ${mvp ? mvp.pos + " " + pname(mvp) + " is the MVP" : ""}${mine ? " — and your name was on the roster." : "."}`, "off");
  return g;
}
function allStarBowls(G){
  const rec = (G.rec || []).map(id => G.players[id]).filter(Boolean).sort((a, b) => (a.rk || 999) - (b.rk || 999)), pros = ((G.draft && G.draft.pool) || []).map(id => G.players[id]).filter(Boolean);
  ASG_BOWLS.forEach(b => { const src = b.lvl === "hs" ? rec : pros; bowlGame(G, b, src.slice(b.from, b.to)); });
}
