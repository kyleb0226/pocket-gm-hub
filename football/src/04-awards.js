
/* ----------------------------- season value ----------------------------- */
function seasonValue(p){
  const s = p.st, g = GROUP(p.pos);
  if (g === "OL") return (s.gs || 0) >= 6 ? (p.ovr - 50) * 3 + (s.pk || 0) * .6 - (s.sal || 0) * 2.5 : 0;
  if (p.pos === "K") return (s.fgm || 0) * 3 - ((s.fga || 0) - (s.fgm || 0)) * 2.5 + (s.xpm || 0) * .3 + ((s.fgl || 0) > 50 ? 5 : 0);
  if (p.pos === "P") return (s.pu || 0) >= 20 ? (s.puy / s.pu - 36) * 12 + p.ovr * .2 : 0;
  return lineValue(s);
}
const seasonLine = p => lineText(p.st) || ((p.st.gs || 0) + " starts" + (p.st.pk ? ", " + p.st.pk + " pancakes" : ""));
const posMult = pos => pos === "QB" ? 1.2 : pos === "RB" ? .98 : pos === "WR" || pos === "TE" ? 1.05 : isDef(pos) ? 1.45 : 0;
function heisScore(G, p){ const t = T(G, p.tid); if (!t) return 0; return seasonValue(p) * posMult(p.pos) * (.72 + .4 * winPct(t)) * (t.rank ? 1.06 : 1) * (p.hype === G.year ? 1.05 : 1); }
const ref = (G, p, line) => ({ pid: p.id, n: pname(p), tid: p.tid, pos: p.pos, cls: p.cls != null ? CLS[p.cls] : undefined, line: line || seasonLine(p) });
const colPlayers = G => { const o = []; for (const id in G.players) { const p = G.players[id]; if (p.tid != null && p.tid >= 100) o.push(p); } return o; };
const proPlayers = G => { const o = []; for (const id in G.players) { const p = G.players[id]; if (p.tid != null && p.tid < 100) o.push(p); } return o; };

function heismanWatch(G){
  const top = colPlayers(G).map(p => [p.id, heisScore(G, p)]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  G.hw = top.map(([id, s]) => [id, round(s)]); G.hwHist.push(G.hw.slice(0, 8).map(x => [x[0], x[1]]));
}
function weeklyHonors(G, w){
  const rows = (G._wk || []).map(([id, v, txt]) => ({ p: G.players[id], v, txt })).filter(x => x.p).sort((a, b) => b.v - a.v);
  const off = rows.find(x => isOff(x.p.pos)), def = rows.find(x => isDef(x.p.pos)), out = { w, conf: {} };
  const give = (x, label) => { x.p.aw.push([G.year, label, w]); return ref(G, x.p, x.txt); };
  if (off) out.off = give(off, "National Offensive Player of the Week"); if (def) out.def = give(def, "National Defensive Player of the Week");
  CONF_ORDER.forEach(cid => { if (cid === "IND") return; const x = rows.find(x => T(G, x.p.tid).conf === cid); if (x) out.conf[cid] = give(x, G.confs[cid].name + " Player of the Week"); });
  G.potw = out;
}

const SLOTS = {QB:1,RB:2,WR:3,TE:1,OT:2,OG:2,C:1,DE:2,DT:2,LB:3,CB:2,S:2,K:1,P:1};
// Best-at-each-position teams from a pool of players. Returns [first, second] arrays of players.
function allTeams(G, pool, depth = 2){
  const teams = Array.from({ length: depth }, () => []);
  POS.forEach(pos => {
    const c = pool.filter(p => p.pos === pos && ((p.st.gs || 0) >= 6 || seasonValue(p) > 60)).map(p => [p, seasonValue(p) * (.85 + .2 * winPct(T(G, p.tid))) + p.ovr * .5]).sort((a, b) => b[1] - a[1]);
    for (let d = 0; d < depth; d++) c.slice(d * SLOTS[pos], (d + 1) * SLOTS[pos]).forEach(x => teams[d].push(x[0]));
  });
  return teams;
}
const bestOf = (pool, f) => { let b = null, bv = -1e9; for (const p of pool) { const v = f(p); if (v > bv) { bv = v; b = p; } } return bv > 0 ? b : null; };
function coachScore(t, pro){ const exp = pro ? .5 : (t.prestige - 45) / 52 * .62 + .2; return (winPct(t) - exp) * 10 + winPct(t) * 4 + (t.rank && t.rank <= 10 ? 1 : 0); }

// A panel of voters each ranks three names (5-3-1 points), drawn in proportion to how strong the
// season was. `win` keeps an already-announced winner on top (used when back-filling old saves).
function ballot(G, cands, n, win){
  const c = cands.filter(x => x[0] && x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x.slice());
  if (win != null && G.players[win]) { const i = c.findIndex(x => x[0].id === win), top = c.length ? c[0][1] : 1; if (i > 0) { const w = c.splice(i, 1)[0]; w[1] = top * 1.05; c.unshift(w); } else if (i < 0) { c.unshift([G.players[win], top * 1.05]); if (c.length > 8) c.length = 8; } }
  if (!c.length) return [];
  const v = c.map(([p]) => ({ p, pts: 0, first: 0, second: 0, third: 0 }));
  for (let b = 0; b < n; b++) { const pool = c.map(([p, s], i) => [i, Math.pow(s / c[0][1], 9)]); [[5, "first"], [3, "second"], [1, "third"]].forEach(([pts, k]) => { if (!pool.some(x => x[1] > 0)) return; const i = wpick(pool); pool.find(x => x[0] === i)[1] = 0; v[i].pts += pts; v[i][k]++; }); }
  v.sort((a, b) => b.pts - a.pts);
  if (win != null && v[0].p.id !== win) { const i = v.findIndex(x => x.p.id === win); if (i > 0) { const a = v[0].p; v[0].p = v[i].p; v[i].p = a; } }
  return v.filter(x => x.pts > 0);
}
function voteAward(G, A, name, cands, n, win){
  const v = ballot(G, cands, n, win); if (!v.length) return null;
  (A.votes || (A.votes = {}))[name] = v.slice(0, 6).map(x => Object.assign(ref(G, x.p), { pts: x.pts, first: x.first, second: x.second, third: x.third }));
  v.slice(0, 5).forEach((x, i) => (x.p.av || (x.p.av = [])).push([G.year, name, i + 1, x.pts]));
  return v[0].p;
}
// The awards that are decided by a vote: [name, candidate pool, score, note].
function colVoted(G, all){
  const tf = p => .72 + .4 * winPct(T(G, p.tid));
  return [["Maxwell Award", all, p => seasonValue(p) * (posMult(p.pos) || 0) * (.9 + .1 * tf(p)), "Player of the year"],
    ["Chuck Bednarik Award", all.filter(p => isDef(p.pos)), p => seasonValue(p) * tf(p), "Defensive player of the year"],
    ["Shaun Alexander Freshman of the Year", all.filter(p => p.cls === 0), p => seasonValue(p) * (posMult(p.pos) || .9), "Top freshman"]];
}
function proVoted(G, all){
  const tf = p => .7 + .45 * winPct(T(G, p.tid)), off = all.filter(p => isOff(p.pos) && GROUP(p.pos) !== "OL"), def = all.filter(p => isDef(p.pos));
  return [["Most Valuable Player", off, p => seasonValue(p) * (p.pos === "QB" ? 1.2 : 1) * tf(p), "League MVP"],
    ["Offensive Player of the Year", off, p => seasonValue(p) * (p.pos === "QB" ? .92 : 1.1), ""],
    ["Defensive Player of the Year", def, p => seasonValue(p) * (.85 + .2 * tf(p)), ""],
    ["Offensive Rookie of the Year", off.filter(p => p.exp === 0), p => seasonValue(p) * (p.pos === "QB" ? 1.1 : 1), ""],
    ["Defensive Rookie of the Year", def.filter(p => p.exp === 0), p => seasonValue(p), ""]];
}
function allRookie(G, A, all){ const [ar] = allTeams(G, all.filter(p => p.exp === 0), 1); ar.forEach(p => p.aw.push([G.year, "All-Rookie Team"])); A.rook = ar.map(p => ref(G, p)); }
// Saves made before award voting existed: add the ballots for this season's awards without changing who won.
function backfillVotes(G){
  const P = G.awards && G.awards.pro, C = G.awards && G.awards.col;
  if (P && !P.votes) { const all = proPlayers(G).filter(p => (p.st.g || 0) >= 6); P.votes = {}; proVoted(G, all).forEach(([name, pool, f]) => { const w = P.list.find(x => x.a === name); if (w) voteAward(G, P, name, pool.map(p => [p, f(p)]), 50, w.pid); }); if (!P.rook) allRookie(G, P, all); }
  if (C && !C.votes) { const all = colPlayers(G).filter(p => (p.st.g || 0) >= 5); C.votes = {}; colVoted(G, all).forEach(([name, pool, f]) => { const w = C.nat.find(x => x.a === name); if (w) voteAward(G, C, name, pool.map(p => [p, f(p)]), 100, w.pid); }); }
}

function collegeAwards(G){
  const all = colPlayers(G).filter(p => (p.st.g || 0) >= 5), A = G.awards.col = { nat: [], conf: {} };
  const tf = p => .72 + .4 * winPct(T(G, p.tid));
  const give = (name, p, note) => { if (!p) return; p.aw.push([G.year, name]); A.nat.push(Object.assign({ a: name, note }, ref(G, p))); return p; };
  // Heisman: 900 ballots, three names each, drawn in proportion to how strong the season was.
  const fin = all.map(p => [p, heisScore(G, p)]).sort((a, b) => b[1] - a[1]).slice(0, 10), votes = fin.map(([p]) => ({ p, pts: 0, first: 0, second: 0, third: 0 }));
  for (let b = 0; b < 900; b++) { const pool = fin.map(([p, s], i) => [i, Math.pow(s / fin[0][1], 7)]); [3, 2, 1].forEach(pts => { const i = wpick(pool); pool.find(x => x[0] === i)[1] = 0; votes[i].pts += pts; votes[i][pts === 3 ? "first" : pts === 2 ? "second" : "third"]++; }); }
  votes.sort((a, b) => b.pts - a.pts);
  const hw = votes[0].p, ht = T(G, hw.tid); hw.aw.push([G.year, "Heisman Trophy"]); ht.heismans++;
  votes.forEach((v, i) => { (v.p.hv || (v.p.hv = [])).push([G.year, i + 1, v.pts]); if (i > 0 && i < 4) v.p.aw.push([G.year, "Heisman Trophy finalist (" + ord(i + 1) + ")"]); });
  A.heis = votes.map(v => Object.assign(ref(G, v.p), { pts: v.pts, first: v.first, second: v.second, third: v.third }));
  news(G, `${hw.pos} ${pname(hw)} of ${ht.name} wins the Heisman Trophy with ${votes[0].first} first-place votes.`, "award", ht.id);
  const off = all.filter(p => isOff(p.pos) && GROUP(p.pos) !== "OL"), def = all.filter(p => isDef(p.pos)), at = (...ps) => all.filter(p => ps.includes(p.pos));
  const CV = colVoted(G, all), vote = i => give(CV[i][0], voteAward(G, A, CV[i][0], CV[i][1].map(p => [p, CV[i][2](p)]), 100), CV[i][3]);
  vote(0);
  give("Walter Camp Award", bestOf(all, p => seasonValue(p) * posMult(p.pos) * tf(p) * tf(p)), "Player of the year");
  give("Davey O'Brien Award", bestOf(at("QB"), p => seasonValue(p) * tf(p)), "Best quarterback");
  give("Johnny Unitas Golden Arm", bestOf(at("QB").filter(p => p.cls === 3), p => seasonValue(p) * tf(p)), "Top senior quarterback");
  give("Doak Walker Award", bestOf(at("RB"), p => seasonValue(p)), "Best running back");
  give("Biletnikoff Award", bestOf(at("WR", "TE", "RB"), p => (p.st.rcy || 0) * .1 + (p.st.rec || 0) * .5 + (p.st.rctd || 0) * 6), "Best receiver");
  give("John Mackey Award", bestOf(at("TE"), p => seasonValue(p) + p.ovr * .4), "Best tight end");
  give("Paul Hornung Award", bestOf(off, p => Math.min(p.st.ry || 0, p.st.rcy || 0) * .5 + ((p.st.rtd || 0) && (p.st.rctd || 0) ? 40 : 0) + ((p.st.ry || 0) + (p.st.rcy || 0)) * .03), "Most versatile player");
  give("Outland Trophy", bestOf(at("OT", "OG", "C", "DT"), p => seasonValue(p) * (p.pos === "DT" ? 1 : 1.25) * tf(p)), "Best interior lineman");
  give("Rimington Trophy", bestOf(at("C"), p => seasonValue(p) * tf(p)), "Best center");
  vote(1);
  give("Bronko Nagurski Trophy", bestOf(def, p => seasonValue(p) * (.9 + .1 * tf(p)) + p.ovr * .3), "Best defensive player");
  give("Lombardi Award", bestOf(at("OT", "OG", "C", "DE", "DT", "LB"), p => seasonValue(p) * (GROUP(p.pos) === "OL" ? 1.3 : 1) * tf(p) + p.chr * .2), "Best lineman or linebacker");
  give("Ted Hendricks Award", bestOf(at("DE"), p => seasonValue(p)), "Best defensive end");
  give("Butkus Award", bestOf(at("LB"), p => seasonValue(p)), "Best linebacker");
  give("Jim Thorpe Award", bestOf(at("CB", "S"), p => seasonValue(p) + p.ovr * .4), "Best defensive back");
  give("Lott IMPACT Trophy", bestOf(def.filter(p => p.chr >= 65), p => seasonValue(p) + p.chr), "Defensive impact and character");
  give("Lou Groza Award", bestOf(at("K"), p => seasonValue(p)), "Best kicker");
  give("Ray Guy Award", bestOf(at("P"), p => seasonValue(p)), "Best punter");
  vote(2);
  give("Newcomer of the Year", bestOf(all.filter(p => p.xfer === G.year), p => seasonValue(p) * (posMult(p.pos) || .9)), "Top transfer");
  give("Burlsworth Trophy", bestOf(all.filter(p => p.walkOn), p => seasonValue(p) * (posMult(p.pos) || .9) + p.ovr), "Best player who began as a walk-on");
  give("Comeback Player of the Year", bestOf(all.filter(p => p.bigInj === G.year - 1), p => seasonValue(p)), "Back from a season-ending injury");
  give("William V. Campbell Trophy", bestOf(all.filter(p => p.gpa >= 3.5 && p.cls >= 2 && (p.st.gs || 0) >= 8), p => p.gpa * 60 + seasonValue(p) * .25), "The academic Heisman");
  give("Wuerffel Trophy", bestOf(all.filter(p => (p.st.gs || 0) >= 6), p => p.chr * 2 + seasonValue(p) * .08), "Community service");
  const line = G.col.map(t => [t, avgOf(depthChart(G, t.id).OT.slice(0, 2).concat(depthChart(G, t.id).OG.slice(0, 2), depthChart(G, t.id).C.slice(0, 1)), p => p.ovr) + winPct(t) * 6]).sort((a, b) => b[1] - a[1])[0][0];
  A.joeMoore = line.id; rosterOf(G, line.id).filter(p => GROUP(p.pos) === "OL" && (p.st.gs || 0) >= 6).forEach(p => p.aw.push([G.year, "Joe Moore Award (best O-line unit)"]));
  const coy = G.col.slice().sort((a, b) => coachScore(b) - coachScore(a))[0]; A.coy = { name: coy.coach.name, tid: coy.id, rec: coy.w + "-" + coy.l }; coy.coach.aw.push([G.year, "National Coach of the Year"]);
  if (isUser(G, coy.id)) { G.coach.aw.push([G.year, "National Coach of the Year"]); gainLP(G, 10, "National Coach of the Year"); }
  // All-America and freshman All-America teams.
  const [a1, a2] = allTeams(G, all), unan = new Set();
  a1.forEach(p => { const others = all.filter(x => x.pos === p.pos && x !== p), nextBest = Math.max(0, ...others.map(seasonValue)); const u = seasonValue(p) > nextBest * 1.25 && isOff(p.pos) !== isDef(p.pos); if (u) unan.add(p.id); p.aw.push([G.year, (u ? "Unanimous" : "Consensus") + " All-American"]); T(G, p.tid).allAm++; });
  a2.forEach(p => p.aw.push([G.year, "Second-team All-American"]));
  const [fa] = allTeams(G, all.filter(p => p.cls === 0), 1); fa.forEach(p => p.aw.push([G.year, "Freshman All-American"]));
  A.aa1 = a1.map(p => ref(G, p)); A.aa2 = a2.map(p => ref(G, p)); A.faa = fa.map(p => ref(G, p)); A.unan = [...unan];
  // Conference honours.
  CONF_ORDER.forEach(cid => {
    if (cid === "IND") return; const cn = G.confs[cid].name, pool = all.filter(p => T(G, p.tid).conf === cid), C = A.conf[cid] = {};
    const g2 = (key, name, p) => { if (!p) return; p.aw.push([G.year, cn + " " + name]); C[key] = ref(G, p); };
    g2("opoy", "Offensive Player of the Year", bestOf(pool.filter(p => isOff(p.pos) && GROUP(p.pos) !== "OL"), p => seasonValue(p) * tf(p)));
    g2("dpoy", "Defensive Player of the Year", bestOf(pool.filter(p => isDef(p.pos)), p => seasonValue(p) * tf(p)));
    g2("foy", "Freshman of the Year", bestOf(pool.filter(p => p.cls === 0), p => seasonValue(p) * (posMult(p.pos) || .9)));
    g2("noy", "Newcomer of the Year", bestOf(pool.filter(p => p.xfer === G.year), p => seasonValue(p) * (posMult(p.pos) || .9)));
    g2("olm", "Offensive Lineman of the Year", bestOf(pool.filter(p => GROUP(p.pos) === "OL"), p => seasonValue(p) * tf(p)));
    g2("st", "Special Teams Player of the Year", bestOf(pool.filter(p => GROUP(p.pos) === "KP"), p => seasonValue(p) + 1));
    const ct = G.col.filter(t => t.conf === cid).sort((a, b) => coachScore(b) - coachScore(a))[0]; C.coy = { name: ct.coach.name, tid: ct.id, rec: ct.w + "-" + ct.l }; ct.coach.aw.push([G.year, cn + " Coach of the Year"]);
    if (isUser(G, ct.id)) { G.coach.aw.push([G.year, cn + " Coach of the Year"]); gainLP(G, 5, cn + " Coach of the Year"); }
    const [c1, c2] = allTeams(G, pool); c1.forEach(p => p.aw.push([G.year, "First-team All-" + cn])); c2.forEach(p => p.aw.push([G.year, "Second-team All-" + cn]));
    C.a1 = c1.map(p => ref(G, p)); C.a2 = c2.map(p => ref(G, p));
  });
  const h = seasonHist(G); h.heis = A.heis.slice(0, 5); h.colAwards = A.nat; h.aa1 = A.aa1; h.coyCol = A.coy;
  h.confAwards = {}; Object.keys(A.conf).forEach(cid => (h.confAwards[cid] = { opoy: A.conf[cid].opoy, dpoy: A.conf[cid].dpoy, coy: A.conf[cid].coy }));
}

function proAwards(G){
  const all = proPlayers(G).filter(p => (p.st.g || 0) >= 6), A = G.awards.pro = { list: [] }, tf = p => .7 + .45 * winPct(T(G, p.tid));
  const give = (name, p, note) => { if (!p) return; p.aw.push([G.year, name]); A.list.push(Object.assign({ a: name, note }, ref(G, p))); };
  const off = all.filter(p => isOff(p.pos) && GROUP(p.pos) !== "OL"), def = all.filter(p => isDef(p.pos));
  proVoted(G, all).forEach(([name, pool, f, note]) => { const w = voteAward(G, A, name, pool.map(p => [p, f(p)]), 50); give(name, w, note); if (w && isUser(G, w.tid)) { news(G, `Your ${w.pos} ${pname(w)} is the ${name}.`, "award", w.tid); gainLP(G, /Valuable/.test(name) ? 6 : 3, name); } });
  allRookie(G, A, all);
  give("Comeback Player of the Year", bestOf(all.filter(p => p.bigInj === G.year - 1), p => seasonValue(p) * (posMult(p.pos) || .8)), "");
  give("Man of the Year", bestOf(all.filter(p => (p.st.gs || 0) >= 10), p => p.chr * 2 + seasonValue(p) * .05), "Community service");
  const coy = G.pro.slice().sort((a, b) => coachScore(b, 1) + (b.hist.length ? (winPct(b) - b.hist[b.hist.length - 1].w / 17) * 8 : 0) - coachScore(a, 1) - (a.hist.length ? (winPct(a) - a.hist[a.hist.length - 1].w / 17) * 8 : 0))[0];
  A.coy = { name: coy.coach.name, tid: coy.id, rec: coy.w + "-" + coy.l }; coy.coach.aw.push([G.year, "Coach of the Year"]);
  if (isUser(G, coy.id)) { G.coach.aw.push([G.year, "Executive of the Year"]); gainLP(G, 10, "Executive of the Year"); }
  const [a1, a2] = allTeams(G, all); a1.forEach(p => p.aw.push([G.year, "First-team All-Pro"])); a2.forEach(p => p.aw.push([G.year, "Second-team All-Pro"]));
  A.ap1 = a1.map(p => ref(G, p)); A.ap2 = a2.map(p => ref(G, p));
  A.pb = {}; PRO_CONFS.forEach(c => { const t = allTeams(G, all.filter(p => T(G, p.tid).conf === c), 2).flat(); t.forEach(p => p.aw.push([G.year, "Pro Bowl"])); A.pb[c] = t.map(p => ref(G, p)); });
  const h = seasonHist(G); h.proAwards = A.list; h.ap1 = A.ap1; h.coyPro = A.coy;
  const mvp = A.list[0]; if (mvp) news(G, `${mvp.pos} ${mvp.n} of the ${T(G, mvp.tid).nick} is the league MVP.`, "award", mvp.tid);
}

/* ----------------------------- record books ----------------------------- */
const REC_KEYS = [["py","Passing yards"],["ptd","Passing TD"],["ry","Rushing yards"],["rtd","Rushing TD"],["rec","Receptions"],["rcy","Receiving yards"],["rctd","Receiving TD"],["tk","Tackles"],["sck","Sacks"],["int","Interceptions"],["fgm","Field goals"]];
function careerTotals(p, lvl){ const o = {}; p.hist.forEach(r => { if (r.lvl !== lvl) return; STAT_KEYS.concat(["g", "gs"]).forEach(k => { if (r[k]) o[k] = (o[k] || 0) + r[k]; }); }); return o; }
// Close the books on a season: stamp league leaders, push the history row, update records.
function archiveStats(G){
  [["C", colPlayers(G), G.records.col, G.records.colCareer], ["P", proPlayers(G), G.records.pro, G.records.proCareer]].forEach(([lvl, pool, seasonRec, careerRec]) => {
    const lead = {}; REC_KEYS.forEach(([k]) => { let b = null; pool.forEach(p => { if ((p.st[k] || 0) > (b ? b.st[k] : 0)) b = p; }); if (b) (lead[b.id] || (lead[b.id] = [])).push(k); });
    pool.forEach(p => {
      if (!(p.st.g > 0)) { if (lvl === "C" && p.cls != null) p.hist.push(histRow(G, p, T(G, p.tid), lvl, { g: 0 }, { cls: CLS[p.cls], dnp: 1 })); return; }
      const t = T(G, p.tid), st = Object.assign({}, p.st), extra = lvl === "C" ? { cls: CLS[p.cls] } : {}; if (lead[p.id]) extra.ld = lead[p.id]; if (p.inj || p.bigInj === G.year) extra.inj = 1;
      p.hist.push(histRow(G, p, t, lvl, st, extra));
      const car = careerTotals(p, lvl);
      REC_KEYS.forEach(([k]) => {
        if ((st[k] || 0) > ((seasonRec[k] || {}).v || 0)) seasonRec[k] = { v: st[k], pid: p.id, n: pname(p), t: t.abbr, y: G.year };
        if ((car[k] || 0) > ((careerRec[k] || {}).v || 0)) careerRec[k] = { v: car[k], pid: p.id, n: pname(p), t: t.abbr, y: G.year };
      });
    });
  });
}
