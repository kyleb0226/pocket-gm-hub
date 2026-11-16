
/* ----------------------------- world access ----------------------------- */
// Team ids: pro 0–31, college 100+. Players live in the G.players dict; rosters are a
// derived index (G._ros) rebuilt whenever a player changes team — always move players
// with moveP/addP/dropP so the index stays honest. Keys starting with "_" are not saved.
const isCol = tid => tid >= 100;
const T = (G, tid) => tid == null || tid < 0 ? null : (tid >= 100 ? G.col[tid - 100] : G.pro[tid]);
const tname = t => t ? (t.pro ? t.city + " " + t.nick : t.name) : "—";
const pname = p => p ? p.fn + " " + p.ln : "—";
function rosters(G){
  if (!G._ros) { const m = {}; for (const id in G.players) { const p = G.players[id]; if (p.tid != null) (m[p.tid] || (m[p.tid] = [])).push(p); } G._ros = m; }
  return G._ros;
}
const rosterOf = (G, tid) => rosters(G)[tid] || [];
function moveP(G, p, tid){ p.tid = tid; G._ros = null; }
function addP(G, p){ G.players[p.id] = p; G._ros = null; return p; }
function dropP(G, p){ delete G.players[p.id]; G._ros = null; }
const nextId = G => ++G.pid;
const userTeam = G => T(G, G.uid);
const isUser = (G, tid) => tid === G.uid;
function news(G, txt, tag, tid){ G.news.unshift({ y: G.year, w: G.week, txt, tag: tag || "", tid }); if (G.news.length > 220) G.news.length = 220; }

/* ----------------------------- players ----------------------------- */
function rollRatings(pos, target){
  const w = RW[GROUP(pos)]; let r = w.map(() => clamp(round(gauss(target, 6)), 25, 99));
  // Nudge the set so the weighted overall lands on the target.
  for (let k = 0; k < 4; k++) { const o = sum(w.map((x, i) => x * r[i]), x => x), d = round(target - o); if (!d) break; r = r.map(v => clamp(v + d, 25, 99)); }
  return r;
}
function makePlayer(G, pos, target, age, o = {}){
  const [h, wt] = SIZE[pos], town = wpick(TOWNS.map(t => [t, t[2]]));
  const p = {
    id: nextId(G), fn: pick(FIRST), ln: pick(LAST), pos, age, tid: null,
    r: rollRatings(pos, clamp(target, 30, 99)), ht: round(gauss(h, 1.4)), wt: round(gauss(wt, 9)),
    home: town[0] + ", " + town[1], hs: (chance(.5) ? town[0] + " " : pick(LAST) + " ") + pick(HS_SUFFIX),
    num: rint(1, 99), gpa: clamp(+(gauss(3.0, .45)).toFixed(2), 1.8, 4.0), chr: clamp(round(gauss(60, 18)), 5, 99),
    st: {}, hist: [], aw: [], tx: [], ovh: [],
  };
  p.ovr = calcOvr(p);
  p.pot = clamp(o.pot != null ? o.pot : p.ovr + rint(0, age <= 19 ? 24 : age <= 22 ? 14 : age <= 25 ? 6 : 1), p.ovr, 99);
  return p;
}
function tweakRatings(p, d){ p.r = p.r.map(v => clamp(v + d + (chance(.35) ? rint(-1, 1) : 0), 25, 99)); p.ovr = calcOvr(p); if (p.pot < p.ovr) p.pot = p.ovr; }

/* A plausible season line for a player we never simulated — gives league-start veterans
   and upperclassmen a past on their reference page. */
function fakeLine(pos, ovr, g, starter){
  const q = ovr - 60, n = v => Math.max(0, round(v * gauss(1, .12))), s = {};
  if (!starter) { s.g = rint(2, g); return s; }
  s.g = g; s.gs = g;
  if (pos === "QB") { s.pa = n(g * 31); s.pc = round(s.pa * clamp(.55 + q * .004, .45, .74)); s.py = round(s.pc * (10.6 + q * .07)); s.ptd = n(s.py / 135); s.pi = n(s.pa * .026); s.ra = n(g * 4); s.ry = n(s.ra * 3.4); s.rtd = n(g * .18); s.sk = n(g * 1.9); }
  else if (pos === "RB") { s.ra = n(g * 15.5); s.ry = round(s.ra * (3.7 + q * .035)); s.rtd = n(s.ry / 105); s.rec = n(g * 2.2); s.tg = s.rec + n(g * .8); s.rcy = n(s.rec * 7.6); s.rctd = n(g * .08); }
  else if (pos === "WR") { s.rec = n(g * (2.4 + q * .1)); s.tg = round(s.rec * 1.6); s.rcy = n(s.rec * 13.2); s.rctd = n(s.rcy / 145); }
  else if (pos === "TE") { s.rec = n(g * (1.6 + q * .07)); s.tg = round(s.rec * 1.5); s.rcy = n(s.rec * 11); s.rctd = n(s.rcy / 150); }
  else if (GROUP(pos) === "OL") { s.pk = n(g * (2 + q * .09)); s.sal = n(g * .22); }
  else if (GROUP(pos) === "DL") { s.tk = n(g * 2.8); s.sck = n(g * (.2 + q * .013)); s.tfl = n(s.sck + g * .35); s.ff = n(g * .07); }
  else if (pos === "LB") { s.tk = n(g * 6.2); s.sck = n(g * .16); s.tfl = n(g * .45); s.int = n(g * .06); s.pd = n(g * .25); s.ff = n(g * .06); }
  else if (GROUP(pos) === "DB") { s.tk = n(g * (pos === "S" ? 4.6 : 3.1)); s.int = n(g * (.1 + q * .004)); s.pd = n(g * .6); }
  else if (pos === "K") { s.fga = n(g * 1.7); s.fgm = Math.min(s.fga, round(s.fga * clamp(.7 + q * .006, .5, .95))); s.xpa = n(g * 3.2); s.xpm = round(s.xpa * .97); s.fgl = rint(44, 58); }
  else if (pos === "P") { s.pu = n(g * 4.2); s.puy = round(s.pu * (40 + q * .2)); }
  return s;
}
const histRow = (G, p, t, lvl, st, extra) => Object.assign({ y: G.year, lvl, t: t ? t.abbr : "—", tid: t ? t.id : null, age: p.age }, extra || {}, st);

/* ----------------------------- league build ----------------------------- */
function buildCollege(G){
  G.col = []; G.confs = {};
  CONF_ORDER.forEach(cid => {
    const c = CONFS[cid]; G.confs[cid] = { id: cid, name: c.name, full: c.full, games: c.games, champs: [] };
    c.teams.split(";").forEach(row => {
      const [name, nick, abbr, pr, c1, c2, st] = row.split("|"), id = 100 + G.col.length;
      G.col.push({ id, name, nick, abbr, conf: cid, prestige: +pr, c1, c2, state: st, w: 0, l: 0, cw: 0, cl: 0, pf: 0, pa: 0, res: [], rank: 0, rkAll: 0, rkHist: [], pw: 0, morale: 0,
        hist: [], titles: 0, confTitles: 0, bowlW: 0, bowlL: 0, heismans: 0, allAm: 0, picks: 0, allW: 0, allL: 0 });
    });
  });
  G.abbr = {}; G.col.forEach(t => (G.abbr[t.abbr] = t.id));
  G.riv = RIVALRIES.map(([name, a, b, trophy], i) => ({ i, name, a: G.abbr[a], b: G.abbr[b], trophy, aw: 0, bw: 0, holder: null, last: [] })).filter(r => r.a != null && r.b != null);
}
function colTarget(t, cls){ return 41 + t.prestige * .37 + cls * 3.4; }
function buildColRoster(G, t){
  POS.forEach(pos => { for (let i = 0; i < COL_NEED[pos]; i++) {
    const cls = rint(0, 3), p = makePlayer(G, pos, gauss(colTarget(t, cls) - i * .6, 4.5), 18 + cls + (chance(.25) ? 1 : 0));
    p.cls = cls; p.stars = clamp(round((p.pot - 52) / 9.5), 1, 5); p.tid = t.id; p.enr = G.year - cls;
    G.players[p.id] = p;
  } });
}
function buildPro(G){
  G.pro = [];
  PRO_DEFS.forEach((row, di) => row.split(";").forEach(s => {
    const [city, nick, abbr, c1, c2] = s.split("|");
    G.pro.push({ id: G.pro.length, pro: true, city, nick, abbr, name: city, conf: PRO_CONFS[di >> 2], div: PRO_DIVS[di % 4], c1, c2, w: 0, l: 0, dw: 0, dl: 0, cw: 0, cl: 0, pf: 0, pa: 0, res: [], morale: 0, hist: [], titles: 0, allW: 0, allL: 0 });
  }));
}
function salaryFor(p){
  const m = { QB: 2.5, RB: .75, WR: 1.25, TE: .8, OT: 1.15, OG: .85, C: .8, DE: 1.3, DT: 1.05, LB: .95, CB: 1.1, S: .85, K: .28, P: .22 }[p.pos];
  const base = Math.pow(Math.max(0, p.ovr - 62) / 10, 2.4) * m * 1.55, age = p.age >= 32 ? .7 : p.age >= 30 ? .88 : 1;
  return +Math.max(.9, base * age).toFixed(2);
}
function buildProRoster(G, t){
  const cols = G.col;
  POS.forEach(pos => { for (let i = 0; i < PRO_NEED[pos]; i++) {
    const depth = i / STARTERS[pos], target = gauss(depth < 1 ? 84 : depth < 2 ? 74 : 67, depth < 1 ? 5.5 : 4);
    const age = clamp(round(gauss(depth < 1 ? 27 : 25, 2.8)), 22, 36), p = makePlayer(G, pos, target, age);
    p.tid = t.id; p.exp = Math.max(0, age - 22 - rint(0, 1)); p.col = wpick(cols.map(c => [c.id, c.prestige * c.prestige]));
    p.c = { amt: salaryFor(p), yrs: rint(1, 4) }; p.stars = clamp(round((p.ovr - 56) / 8), 1, 5);
    // Back-fill a past: college seasons, then pro seasons.
    const ct = T(G, p.col), proY = p.exp, draftY = G.year - proY;
    for (let k = 3; k >= 0; k--) { if (k > 2 && chance(.3)) continue; const yr = draftY - 1 - k, o = p.ovr - proY * 1.2 - 8 - k * 4; p.hist.push(Object.assign({ y: yr, lvl: "C", t: ct.abbr, tid: ct.id, age: age - proY - 1 - k, cls: CLS[3 - k] }, fakeLine(pos, o, rint(11, 13), k < 2 || o > 66))); }
    // One believable path: most have only ever played here; some arrived from one earlier stop.
    // Only the men at the top of the depth chart get a starter's numbers (one QB per team, not two).
    const movedAt = proY >= 2 && chance(.35) ? rint(1, proY - 1) : 0, prevT = movedAt ? pick(G.pro.filter(x => x !== t)) : null, first = prevT || t;
    for (let k = proY; k >= 1; k--) { const o = p.ovr - k * (age - k < 27 ? 1.6 : -.4), ht = movedAt && k > movedAt ? prevT : t, st = ht === t ? i < STARTERS[pos] && (k <= 2 || o > 73) : o > 76 && chance(.5);
      p.hist.push(Object.assign({ y: G.year - k, lvl: "P", t: ht.abbr, tid: ht.id, age: age - k }, fakeLine(pos, o, rint(12, 17), st))); }
    if (prevT) p.tx.push([G.year - movedAt, `Signed with the ${t.nick}`]);
    if (chance(.8)) { const pk = clamp(round((92 - p.ovr) * 9 + gauss(0, 30)), 1, 224); p.draft = { y: draftY, rd: Math.ceil(pk / 32), pk, t: first.abbr }; }
    p.ovh.push([G.year - 1, p.ovr]);
    G.players[p.id] = p;
  } });
}
function makeCoach(G, q){ return { name: pick(FIRST) + " " + pick(LAST), age: rint(36, 66), ovr: clamp(round(gauss(q, 8)), 35, 97), w: 0, l: 0, ch: 0, aw: [], since: G.year }; }

function newGame(o = {}){
  const seed = o.seed != null && o.seed !== "" ? (isNaN(+o.seed) ? hashSeed(o.seed) : +o.seed) : null;
  if (seed != null) _rng = mulberry32(seed);
  const G = { v: 1, year: 2026, week: 0, phase: "pre", offStep: 0, mode: o.mode || "college", uid: null, pid: 0, players: {}, news: [], hist: [], lp: 5,
    coach: { name: o.name || "Coach", hist: [], aw: [], w: 0, l: 0 }, picks: {}, pickRec: { w: 0, l: 0, streak: 0, best: 0 }, preds: {}, events: [], usedEv: [], perks: {},
    scouted: {}, pitches: {}, records: { col: {}, pro: {}, colCareer: {}, proCareer: {} }, hof: [], colHof: [], legends: {}, seed };
  buildCollege(G); buildPro(G);
  G.col.forEach(t => { buildColRoster(G, t); t.coach = makeCoach(G, 30 + t.prestige * .5); });
  G.pro.forEach(t => { buildProRoster(G, t); t.coach = makeCoach(G, 68); });
  G._ros = null;
  // Scale salaries so the average payroll sits a little under the cap.
  const avgPay = avgOf(G.pro, t => sum(rosterOf(G, t.id), p => p.c.amt)), k = CAP * .86 / avgPay;
  G.pro.forEach(t => rosterOf(G, t.id).forEach(p => (p.c.amt = +Math.max(.9, p.c.amt * k).toFixed(2))));
  G.capK = k;
  // Back-fill college pasts for the upperclassmen.
  // Only players at the top of today's depth chart started last year (so a team has one QB with a starter's line, not two).
  G.col.forEach(t => { const d = depthChart(G, t.id); rosterOf(G, t.id).forEach(p => { const top = d[p.pos].indexOf(p) < STARTERS[p.pos];
    for (let k = p.cls; k >= 1; k--) { const ov = p.ovr - k * 4; p.hist.push(Object.assign({ y: G.year - k, lvl: "C", t: t.abbr, tid: t.id, age: p.age - k, cls: CLS[p.cls - k] }, fakeLine(p.pos, ov, rint(11, 13), top && (k === 1 || ov > colTarget(t, 1) + 1)))); } p.ovh.push([G.year - 1, p.ovr]); }); });
  if (o.team != null) G.uid = o.team; else G.uid = G.mode === "pro" ? 0 : G.abbr.ALA;
  G.mode = isCol(G.uid) ? "college" : "pro";
  if (G.mode === "college") { const c = userTeam(G).coach; c.name = G.coach.name; c.ovr = Math.max(c.ovr, 62); }
  startSeason(G);
  if (seed != null) _rng = Math.random;
  return G;
}

/* ----------------------------- lineups ----------------------------- */
// Everything the sim needs to know about one side, built fresh for each game.
function depthChart(G, tid){
  const d = {}; POS.forEach(k => (d[k] = []));
  rosterOf(G, tid).forEach(p => { if (p.rs !== G.year || G.phase === "off") d[p.pos].push(p); });
  POS.forEach(k => d[k].sort((a, b) => (a.inj ? 1 : 0) - (b.inj ? 1 : 0) || b.ovr - a.ovr));
  if (G.dc && tid === G.uid) POS.forEach(k => { const o = G.dc[k]; if (!o) return; const r = p => { const i = o.indexOf(p.id); return i < 0 ? 99 : i; }; d[k].sort((a, b) => (a.inj ? 1 : 0) - (b.inj ? 1 : 0) || r(a) - r(b) || b.ovr - a.ovr); });
  return d;
}
function lineup(G, t, edge){
  if (t.fcs) { const v = t.rating; return { t, fcs: true, passOff: v, runOff: v, passDef: v, runDef: v, rush: v, cover: v, pblk: v, all: [], ol: [], targets: [], backs: [], rushers: [], runTk: [], passTk: [], dbs: [] }; }
  const d = depthChart(G, t.id), ok = (pos, n) => d[pos].filter(p => !p.inj).slice(0, n);
  const ol = [...ok("OT", 2), ...ok("OG", 2), ...ok("C", 1)], dl = [...ok("DE", 2), ...ok("DT", 2)], lb = ok("LB", 3), cb = ok("CB", 3), s = ok("S", 2);
  const qb = ok("QB", 1)[0], rbs = ok("RB", 2), wrs = ok("WR", 4), te = ok("TE", 1)[0];
  const me = isUser(G, t.id), sf = me && G.staff ? G.staff : null, m0 = (t.morale || 0) * .5 + (t.coach ? (t.coach.ovr - 60) * .05 : 0) + (edge || 0) + (me ? (G.perks.gp || 0) * .5 + (edge ? ((G.fac || {}).stad || 0) * .2 : 0) : 0);
  const m = m0 + (sf && sf.oc ? (sf.oc.ovr - 70) * .05 : 0), md = m0 + (sf && sf.dc ? (sf.dc.ovr - 70) * .05 : 0);
  const recv = avgOf([...wrs.slice(0, 3), te].filter(Boolean), p => p.ovr), pblk = avgOf(ol, p => p.r[0]), rblk = avgOf(ol, p => p.r[1]);
  const rush = (avgOf(dl, p => p.r[0]) * 4 + avgOf(lb, p => p.r[2])) / 5, cover = (avgOf(cb, p => p.ovr) * 3 + avgOf(s, p => p.ovr) * 2 + avgOf(lb, p => p.r[1])) / 6;
  const w3 = p => Math.pow(p.ovr / 70, 2);
  const c = {
    t, qb, k: ok("K", 1)[0], p: ok("P", 1)[0], ol,
    passOff: .42 * (qb ? qb.ovr : 45) + .3 * recv + .28 * pblk + m, runOff: .5 * avgOf(rbs.slice(0, 1), p => p.ovr) + .5 * rblk + m,
    passDef: .62 * cover + .38 * rush + md, runDef: .55 * avgOf(dl, p => p.r[1]) + .45 * avgOf(lb, p => p.r[0]) + md, rush: rush + md, cover: cover + md, pblk: pblk + m,
    targets: [...wrs.map((p, i) => [p, [26, 21, 15, 5][i] * w3(p)]), ...(te ? [[te, 17 * w3(te)]] : []), ...rbs.map((p, i) => [p, [11, 5][i] * w3(p)])],
    backs: rbs.map((p, i) => [p, [60, 40][i] * w3(p)]),
    rushers: [...dl.map(p => [p, (p.pos === "DE" ? 3 : 1.6) * Math.pow(p.r[0] / 70, 4)]), ...lb.map(p => [p, Math.pow(p.r[2] / 70, 4)])],
    runTk: [...lb.map(p => [p, 5 * w3(p)]), ...dl.map(p => [p, 3 * w3(p)]), ...s.map(p => [p, 2.6 * w3(p)]), ...cb.map(p => [p, w3(p)])],
    passTk: [...cb.map(p => [p, 4 * w3(p)]), ...s.map(p => [p, 3.6 * w3(p)]), ...lb.map(p => [p, 3 * w3(p)])],
    dbs: [...cb.map(p => [p, 3 * Math.pow(p.r[2] / 70, 4)]), ...s.map(p => [p, 2.2 * Math.pow(p.r[2] / 70, 4)]), ...lb.map(p => [p, .6])],
  };
  c.all = [qb, c.k, c.p, ...rbs, ...wrs, te, ...ol, ...dl, ...lb, ...cb, ...s].filter(Boolean);
  c.starters = new Set([qb, c.k, c.p, rbs[0], ...wrs.slice(0, 3), te, ...ol, ...dl, ...lb, ...cb.slice(0, 2), ...s].filter(Boolean).map(p => p.id));
  return c;
}
const teamOvr = (G, t) => { const c = lineup(G, t, 0); return round((c.passOff + c.runOff + c.passDef + c.runDef) / 4); };

/* ----------------------------- game sim ----------------------------- */
// Play-by-play: every snap picks a run or pass, rolls it against the two units, and
// credits the players involved. Returns the result; applyGame() writes it to the world.
function simGame(G, H, A, o = {}){
  const cx = [lineup(G, H, o.neutral ? 0 : 1.6), lineup(G, A, 0)];
  const L = {}, add = (p, k, v = 1) => { if (!p) return; const l = L[p.id] || (L[p.id] = {}); l[k] = (l[k] || 0) + v; };
  const sc = [0, 0], q = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]], smry = [], flow = [[0, 0]], pbp = o.pbp ? [] : null;
  const tot = [{ pl: 0, yd: 0, py: 0, ry: 0, to: 0, fd: 0 }, { pl: 0, yd: 0, py: 0, ry: 0, to: 0, fd: 0 }];
  let clock = 0, ot = 0, asked = 0;
  const PL = o.plan || [{}, {}], wx = o.wx || "", WX = { rain: [.03, .03, 1.6, .03], wind: [.02, .08, 1, .04], snow: [.045, .05, 1.5, .06] }[wx] || [0, 0, 1, 0], crowd = o.neutral ? 0 : (o.crowd || 0), calls = o.calls || [];
  // A decision only the user can make: answer from the list, or stop the sim and ask.
  const ask = info => { if (calls.length) return calls.shift(); if (o.ask && asked < 6) { asked++; throw { _need: Object.assign(info, { sc: sc.slice(), clock, last: pbp ? pbp.slice(-4).map(x => x[3]) : [] }) }; } return null; };
  const nm = p => p ? p.fn[0] + ". " + p.ln : "Team";
  const score = (i, pts, txt) => { sc[i] += pts; q[i][Math.min(4, Math.floor(clock / 900))] += pts; smry.push([Math.min(5, Math.floor(clock / 900) + 1), i, txt, sc[0], sc[1]]); flow.push([Math.min(clock, 3600 + ot * 60), sc[0] - sc[1]]); };
  const log = (i, y, txt, kind) => { if (pbp) pbp.push([clock, i, clamp(round(y), 0, 100), txt, sc[0], sc[1], kind || ""]); };
  const two = (i, O, D) => { const good = chance(clamp(.47 + (O.passOff - D.passDef) * .004, .3, .62)); if (good) { sc[i] += 2; q[i][Math.min(4, Math.floor(clock / 900))] += 2; const s = smry[smry.length - 1]; s[2] += " (two-point try good)"; s[3] = sc[0]; s[4] = sc[1]; flow[flow.length - 1][1] = sc[0] - sc[1]; } else smry[smry.length - 1][2] += " (two-point try failed)"; log(i, 98, "Two-point try " + (good ? "is GOOD" : "fails"), good ? "td" : "to"); };
  const xp = (i, O) => { const d = sc[i] - sc[1 - i]; if (o.user === i && clock > 2400 && (d === -2 || d === -5 || d === -8 || d === 1 || d === -10) && ask({ type: "2pt", i }) === "two") return two(i, O, cx[1 - i]); if (o.user !== i && clock > 3000 && (d === -2 || d === -5)) return two(i, O, cx[1 - i]); add(O.k, "xpa"); if (chance(clamp(.95 + ((O.k ? O.k.r[1] : 60) - 70) * .002, .85, .995))) { add(O.k, "xpm"); sc[i]++; q[i][Math.min(4, Math.floor(clock / 900))]++; const s = smry[smry.length - 1]; s[3] = sc[0]; s[4] = sc[1]; flow[flow.length - 1][1] = sc[0] - sc[1]; } };

  function drive(i, start, limit){
    const O = cx[i], D = cx[1 - i], pl = PL[i] || {}, bl = (PL[1 - i] || {}).blitz || 0; let y = start, down = 1, togo = 10;
    const punt = () => { const P = O.p, dist = round(gauss(41 + ((P ? P.r[0] : 60) - 70) * .18 - (wx === "wind" ? 3 : 0), 5)); add(P, "pu"); add(P, "puy", Math.min(dist, 100 - y)); clock += 8; const land = y + dist; log(i, y, nm(P) + " punts " + Math.min(dist, 100 - y) + " yards", "punt"); return { end: "punt", next: land >= 100 ? 20 : clamp(100 - land + rint(0, 12), 1, 99) }; };
    for (;;) {
      const late = clock > 2700, diff = sc[i] - sc[1 - i], fgDist = 100 - y + 17;
      if (clock >= limit) { if (fgDist <= 50 && limit < 9e8) return tryFG(i, O, y, fgDist); return { end: "clock", y }; }
      if (down === 4) {
        const mustGo = late && diff < 0 && (clock > 3300 || diff < -8) && !(diff >= -3 && fgDist <= 52);
        const call = o.user === i && ((togo <= 5 && y >= 38) || (late && diff < 0 && diff >= -16)) ? ask({ type: "4th", i, y, togo, fgDist, canFG: fgDist <= 58 }) : null;
        if (call === "fg") return tryFG(i, O, y, fgDist);
        if (call === "punt") return punt();
        if (!mustGo && call !== "go") {
          if (fgDist <= 54 && !(togo <= 1 && y >= 97)) return tryFG(i, O, y, fgDist);
          if (!(togo <= 2 + (pl.fourth || 0) && y >= 50 - (pl.fourth || 0) * 8 && chance(.55 + (pl.fourth || 0) * .3))) return punt();
        }
      }
      if (crowd && i === 1 && chance(crowd * .012)) { const back = Math.min(5, y - 1); y -= back; togo += back; log(i, y, "False start — the crowd is deafening", ""); }
      let pPass = .56 + (togo > 7 && down > 1 ? .17 : 0) - (togo <= 2 ? .2 : 0) + (O.passOff - O.runOff) * .004 + (pl.pass || 0) * .09 - WX[3];
      if (late) pPass += diff > 0 ? -.2 : diff < 0 ? .15 : 0;
      tot[i].pl++;
      let gain = 0, to = false, td = false, inc = false, txt = ""; const qb = O.qb;
      if (chance(clamp(pPass, .15, .9))) {
        if (chance(clamp(.054 + (D.rush - O.pblk) * .0026 + bl * .014, .02, .17))) {
          gain = -rint(3, 10); const d = wpick(D.rushers); add(qb, "sk"); add(d, "sck"); add(d, "tk"); add(d, "tfl"); add(pick(O.ol), "sal");
          txt = nm(qb) + " sacked by " + nm(d) + " for " + gain; if (chance(.07 * WX[2])) { to = true; add(d, "ff"); add(qb, "fum"); txt += ", FUMBLE — defense recovers"; }
        } else if (qb && chance(clamp((qb.r[3] - 52) * .0025, 0, .11))) {
          gain = clamp(round(gauss(6.5, 5)), -2, 100 - y); add(qb, "ra"); add(qb, "ry", gain); tot[i].ry += gain; txt = nm(qb) + " scrambles for " + gain;
          if (y + gain >= 100) { td = true; add(qb, "rtd"); } else add(wpick(D.passTk), "tk");
        } else {
          const tgt = wpick(O.targets); add(qb, "pa"); add(tgt, "tg");
          if (chance(clamp(.025 + (D.cover - (qb ? qb.r[1] : 50)) * .0009 + bl * .003, .008, .06))) {
            to = true; const d = wpick(D.dbs); add(d, "int"); add(d, "pd"); add(qb, "pi"); txt = nm(qb) + " pass INTERCEPTED by " + nm(d);
            if (chance(.05)) { add(d, "dtd"); clock += 12; tot[i].to++; score(1 - i, 6, nm(d) + " interception return TD"); xp(1 - i, D); log(1 - i, 100, txt + " — returned for a TOUCHDOWN", "td"); return { end: "td" }; }
          } else if (chance(clamp(.635 + (O.passOff - D.passDef) * .0075 - WX[0] - bl * .02, .36, .82))) {
            let g = round(2 + -Math.log(1 - _rng()) * (9.9 + (O.passOff - D.passDef) * .07) * (1 + bl * .13)); if (tgt && tgt.pos === "RB") g = round(g * .65);
            gain = Math.min(g, 100 - y); add(qb, "pc"); add(qb, "py", gain); add(tgt, "rec"); add(tgt, "rcy", gain); tot[i].py += gain; txt = nm(qb) + " pass to " + nm(tgt) + " for " + gain;
            if (y + gain >= 100) { td = true; add(qb, "ptd"); add(tgt, "rctd"); } else add(wpick(D.passTk), "tk");
          } else { inc = true; txt = nm(qb) + " pass incomplete to " + nm(tgt); if (chance(.3)) add(wpick(D.dbs), "pd"); }
        }
      } else {
        const car = wpick(O.backs) || qb; let g = round(gauss(3.7 + (O.runOff - D.runDef) * .075, 4.2)); if (chance(.03)) g += rint(10, 50);
        gain = clamp(g, -5, 100 - y); add(car, "ra"); add(car, "ry", gain); tot[i].ry += gain; if (gain >= 5 && chance(.5)) add(pick(O.ol), "pk"); txt = nm(car) + " runs for " + gain;
        if (y + gain >= 100) { td = true; add(car, "rtd"); }
        else { const d = wpick(D.runTk); add(d, "tk"); if (gain < 0) add(d, "tfl"); if (chance(.011 * WX[2])) { to = true; add(car, "fum"); add(d, "ff"); txt += ", FUMBLE — defense recovers"; } }
      }
      clock += inc ? 7 : (late && diff > 0 ? 37 : late && diff < 0 ? 24 : 31 - round((pl.tempo || 0) * 5));
      y += gain; tot[i].yd += gain;
      if (td) { score(i, 6, txt.replace(/^(\S+ \S+) (pass to|runs for|scrambles for)/, "$1 $2").replace(" for " + gain, " " + gain + " yd") + " TD"); xp(i, O); log(i, 100, txt + " — TOUCHDOWN", "td"); return { end: "td" }; }
      if (to) { tot[i].to++; log(i, y, txt, "to"); return { end: "to", y: clamp(y, 1, 99) }; }
      if (y <= 0) { score(1 - i, 2, "Safety"); log(i, 1, txt + " — SAFETY", "to"); return { end: "safety" }; }
      log(i, y, down + (["st", "nd", "rd", "th"][down - 1]) + " & " + togo + ": " + txt, "");
      if (gain >= togo) { down = 1; togo = Math.min(10, 100 - y); tot[i].fd++; } else { down++; togo -= gain; if (down > 4) { log(i, y, "Turnover on downs", "to"); return { end: "downs", y: clamp(y, 1, 99) }; } }
    }
  }
  function tryFG(i, O, y, dist){
    const k = O.k; add(k, "fga"); clock += 5;
    if (chance(clamp(1.22 - dist * .0125 + ((k ? k.r[1] : 60) - 70) * .004 - WX[1] * (dist > 30 ? 1 : .4), .15, .99))) { add(k, "fgm"); if (k) { const l = L[k.id]; l.fgl = Math.max(l.fglMax || 0, dist); l.fglMax = l.fgl; } score(i, 3, nm(k) + " " + dist + " yd field goal"); log(i, y, nm(k) + " " + dist + "-yard field goal is GOOD", "fg"); return { end: "fg" }; }
    log(i, y, nm(k) + " " + dist + "-yard field goal is no good", "to"); return { end: "fgmiss", y: clamp(y, 1, 99) };
  }
  const next = r => r.end === "td" || r.end === "fg" ? 25 : r.end === "safety" ? 35 : r.end === "punt" ? r.next : r.end === "clock" ? 25 : 100 - r.y;
  const first = chance(.5) ? 0 : 1;
  [[first, 1800], [1 - first, 3600]].forEach(([poss, limit]) => { let yl = 25, i = poss; clock = limit - 1800; while (clock < limit) { yl = next(drive(i, yl, limit)); i = 1 - i; } clock = limit; });
  while (sc[0] === sc[1]) {            // overtime: a possession each from the 25
    ot++; clock = 3600 + ot;
    if (ot > 6) { score(chance(.5) ? 0 : 1, 3, "Overtime field goal"); break; }
    drive(first, 75, 9e9); clock = 3600 + ot; drive(1 - first, 75, 9e9);
  }
  // Injuries among the men who played.
  const hurt = []; if (!o.noInj) cx.forEach(c => c.all.forEach(p => { if (chance(.006)) hurt.push([p, chance(.12) ? rint(10, 20) : rint(1, 6)]); }));
  return { H, A, sc, q, smry, flow, tot, L, cx, ot, pbp, hurt };
}

// Rough single-game value of a stat line, for players of the game / week.
function lineValue(l){
  return (l.py || 0) * .04 + (l.ptd || 0) * 4 - (l.pi || 0) * 2 + (l.ry || 0) * .1 + (l.rtd || 0) * 6 + (l.rcy || 0) * .1 + (l.rec || 0) * .5 + (l.rctd || 0) * 6 - (l.fum || 0) * 2
    + (l.tk || 0) * 1 + (l.tfl || 0) * 1.5 + (l.sck || 0) * 4 + (l.int || 0) * 6 + (l.pd || 0) * 1.5 + (l.ff || 0) * 3 + (l.dtd || 0) * 6 + (l.fgm || 0) * 3 - ((l.fga || 0) - (l.fgm || 0)) * 2;
}
function lineText(l){
  const o = [];
  if (l.pa) o.push(`${l.pc || 0}/${l.pa} ${l.py || 0} yds${l.ptd ? " " + l.ptd + " TD" : ""}${l.pi ? " " + l.pi + " INT" : ""}`);
  if (l.ra && (l.ry >= 15 || l.rtd)) o.push(`${l.ra} car ${l.ry || 0} yds${l.rtd ? " " + l.rtd + " TD" : ""}`);
  if (l.rec) o.push(`${l.rec} rec ${l.rcy || 0} yds${l.rctd ? " " + l.rctd + " TD" : ""}`);
  if (l.tk && !l.pa && !l.rec) o.push(`${l.tk} tkl${l.sck ? " " + l.sck + " sck" : ""}${l.int ? " " + l.int + " INT" : ""}${l.ff ? " " + l.ff + " FF" : ""}`);
  if (l.fga) o.push(`${l.fgm || 0}/${l.fga} FG`);
  if (l.pu && !o.length) o.push(`${l.pu} punts ${(l.puy / l.pu).toFixed(1)} avg`);
  return o.join(", ");
}
const STAT_KEYS = ["pa","pc","py","ptd","pi","sk","ra","ry","rtd","fum","tg","rec","rcy","rctd","tk","tfl","sck","int","pd","ff","dtd","fga","fgm","xpa","xpm","pu","puy","pk","sal"];

// Write a finished game into the world: records, player stats, injuries, the stored box.
function applyGame(G, g, r, o = {}){
  const { H, A, sc, L, cx } = r, lvl = H.pro ? "P" : "C";
  g.hs = sc[0]; g.as = sc[1]; g.done = true; g.q = r.q.map(x => r.ot ? x : x.slice(0, 4)); g.ot = r.ot || undefined; g.smry = r.smry; g.tot = r.tot;
  const reg = !o.post, conf = g.conf;
  [[H, A, 0], [A, H, 1]].forEach(([t, opp, i]) => {
    if (t.fcs) return; const won = sc[i] > sc[1 - i];
    t.pf += sc[i]; t.pa += sc[1 - i]; t.res.push([opp.fcs ? -1 : opp.id, sc[i], sc[1 - i], g.w]);
    if (won) { t.w++; t.allW++; if (conf) t.cw++; if (g.div) t.dw++; } else { t.l++; t.allL++; if (conf) t.cl++; if (g.div) t.dl++; }
    t.streak = won ? Math.max(1, (t.streak || 0) + 1) : Math.min(-1, (t.streak || 0) - 1);
    t.morale = clamp((t.morale || 0) * .85 + (won ? .35 : -.35), -3, 3);
    if (t.coach) { won ? t.coach.w++ : t.coach.l++; }
  });
  const lines = [[], []];
  cx.forEach((c, i) => { if (c.fcs) return; c.all.forEach(p => { const s = p.st; s.g = (s.g || 0) + 1; if (c.starters.has(p.id)) s.gs = (s.gs || 0) + 1; }); });
  for (const id in L) {
    const p = G.players[id]; if (!p) continue; const l = L[id]; delete l.fglMax; const s = p.st;
    for (const k in l) { if (k === "fgl") s.fgl = Math.max(s.fgl || 0, l.fgl); else s[k] = (s[k] || 0) + l[k]; }
    const v = lineValue(l), side = p.tid === H.id ? 0 : 1; lines[side].push([+id, v, l]);
    if (v >= 7 || l.pa > 5) (p.gl || (p.gl = [])).push(Object.assign({ w: g.w, o: (side ? "@" : "v") + (side ? H : A).abbr, r: (sc[side] > sc[1 - side] ? "W " : "L ") + sc[side] + "-" + sc[1 - side] }, l));
  }
  lines.forEach(a => a.sort((x, y) => y[1] - x[1]));
  g.top = lines.map(a => a.slice(0, 3).map(x => [x[0], lineText(x[2])]));
  if (o.keepBox) g.box = lines.map(a => a.map(x => [x[0], x[2]]));
  const best = lines[0].concat(lines[1]).sort((x, y) => y[1] - x[1])[0]; if (best) g.potg = best[0];
  r.hurt.forEach(([p, wks]) => { if (p.inj) return; if (isUser(G, p.tid) && G.fac && G.fac.med) wks = Math.max(1, round(wks * (1 - .1 * G.fac.med))); p.inj = wks; p.st.gm = p.st.gm || 0; if (wks >= 10) p.bigInj = G.year; if (isUser(G, p.tid)) news(G, `${p.pos} ${pname(p)} is hurt and will miss ${wks >= 10 ? "the rest of the season" : wks + " week" + (wks > 1 ? "s" : "")}.`, "inj", p.tid); });
  if (r.pbp) (G._pbp || (G._pbp = {}))[g.id] = r.pbp;
  if (!H.pro && !o.post) lines.forEach((a, i) => a.slice(0, 2).forEach(x => (G._wk || (G._wk = [])).push([x[0], x[1], lineText(x[2])])));
  if (isUser(G, H.id) || isUser(G, A.id) || o.keepBox) g.flow = r.flow;
  return g;
}
