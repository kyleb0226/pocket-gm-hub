
/* ----------------------------- schedules ----------------------------- */
const FCS_NAMES = "Montana,Montana State,South Dakota State,Villanova,Furman,Wofford,Idaho,Eastern Washington,Weber State,Illinois State,Northern Iowa,Richmond,William & Mary,Holy Cross,Chattanooga,Mercer,Samford,Southern Illinois,Youngstown State,Tarleton State,Abilene Christian,Central Arkansas,Nicholls,McNeese,Grambling State,Jackson State,Florida A&M,Alabama State,Tennessee State,Elon,Maine,New Hampshire,Rhode Island,Stony Brook,Towson,Idaho State,Portland State,Northern Arizona,UC Davis,Cal Poly".split(",");
const confOf = (G, tid) => T(G, tid).conf;

function buildColSchedule(G){
  const key = (a, b) => a < b ? a + "-" + b : b + "-" + a;
  const has = new Set(), edges = [], games = {}; G.col.forEach(t => (games[t.id] = 0));
  const addE = (a, b, conf, riv) => { if (has.has(key(a, b))) return false; has.add(key(a, b)); edges.push({ a, b, conf, riv }); games[a]++; if (b >= 0) games[b]++; return true; };
  const rivOf = (a, b) => { const r = G.riv.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a)); return r ? r.i : undefined; };
  // 1) conference slates: rivalries first, then random pairs until everyone has k games.
  CONF_ORDER.forEach(cid => {
    const mem = G.col.filter(t => t.conf === cid).map(t => t.id), k = Math.min(G.confs[cid].games, mem.length - 1); if (k <= 0) return;
    let best = null;
    for (let tryN = 0; tryN < 80; tryN++) {
      const need = {}, loc = [], lh = new Set(); mem.forEach(id => (need[id] = k));
      const put = (a, b) => { loc.push([a, b]); lh.add(key(a, b)); need[a]--; need[b]--; };
      G.riv.forEach(r => { if (mem.includes(r.a) && mem.includes(r.b) && need[r.a] > 0 && need[r.b] > 0 && !lh.has(key(r.a, r.b))) put(r.a, r.b); });
      for (;;) {
        const open = shuffle(mem.filter(id => need[id] > 0)).sort((x, y) => need[y] - need[x]); if (open.length < 2) break;
        const a = open[0], c = open.slice(1).filter(b => !lh.has(key(a, b))); if (!c.length) break;
        put(a, wpick(c.map(b => [b, need[b] * need[b]])));
      }
      const left = sum(mem, id => need[id]); if (!best || left < best.left) best = { left, loc }; if (left <= (mem.length * k) % 2) break;
    }
    best.loc.forEach(([a, b]) => addE(a, b, true, rivOf(a, b)));
  });
  // 2) non-conference rivalries, 3) random non-conference, 4) an FCS date for anyone still short.
  const cap = id => games[id] < 12;
  G.riv.forEach(r => { if (confOf(G, r.a) !== confOf(G, r.b) || confOf(G, r.a) === "IND") { if (cap(r.a) && cap(r.b)) addE(r.a, r.b, false, r.i); } else if (!has.has(key(r.a, r.b)) && cap(r.a) && cap(r.b) && games[r.a] < 11 && games[r.b] < 11) addE(r.a, r.b, false, r.i); });
  for (let guard = 0; guard < 4000; guard++) {
    const open = shuffle(G.col.filter(t => cap(t.id))).sort((x, y) => games[x.id] - games[y.id]); if (!open.length) break;
    const a = open[0], c = open.slice(1).filter(b => (b.conf !== a.conf || a.conf === "IND") && !has.has(key(a.id, b.id)));
    if (c.length) { const b = pick(c.slice(0, 30)); addE(a.id, b.id, false, rivOf(a.id, b.id)); } else { edges.push({ a: a.id, b: -1, conf: false, fcs: pick(FCS_NAMES) }); games[a.id]++; }
  }
  // Weeks: finale rivalries land in week 14, then fill each week with a greedy matching.
  const busy = {}; G.col.forEach(t => (busy[t.id] = new Set()));
  const rem = {}; G.col.forEach(t => (rem[t.id] = games[t.id]));
  const place = (e, w) => { e.w = w; busy[e.a].add(w); rem[e.a]--; if (e.b >= 0) { busy[e.b].add(w); rem[e.b]--; } };
  const seenFinale = new Set();
  G.riv.forEach(r => { if (seenFinale.has(r.a) || seenFinale.has(r.b)) return; const e = edges.find(e => e.riv === r.i && !e.w); if (e) { place(e, COL_WEEKS); seenFinale.add(r.a); seenFinale.add(r.b); } });
  for (let w = 1; w <= COL_WEEKS; w++) {
    const left = id => { let n = 0; for (let x = w; x <= COL_WEEKS; x++) if (!busy[id].has(x)) n++; return n; };
    const cand = edges.filter(e => !e.w && !busy[e.a].has(w) && (e.b < 0 || !busy[e.b].has(w))).map(e => {
      const urgent = rem[e.a] >= left(e.a) || (e.b >= 0 && rem[e.b] >= left(e.b));
      return [e, (urgent ? 100 : 0) + rem[e.a] + (e.b >= 0 ? rem[e.b] : rem[e.a]) + (!e.conf && w <= 4 ? 7 : 0) + (e.conf && w > 4 ? 2 : 0) + (e.b < 0 && w <= 3 ? 4 : 0) + _rng() * 3];
    }).sort((x, y) => y[1] - x[1]);
    cand.forEach(([e]) => { if (!busy[e.a].has(w) && (e.b < 0 || !busy[e.b].has(w))) place(e, w); });
  }
  const homeN = {}; G.col.forEach(t => (homeN[t.id] = 0));
  G.cs = edges.filter(e => e.w).map(e => {
    let h = e.a, a = e.b;
    if (a >= 0) { const flip = e.riv != null ? (G.year + e.riv) % 2 === 0 : homeN[e.a] > homeN[e.b] || (homeN[e.a] === homeN[e.b] && chance(.5)); if (flip) { h = e.b; a = e.a; } }
    homeN[h]++;
    const g = { id: ++G.gid, w: e.w, h, a }; if (e.conf) g.conf = 1; if (e.riv != null) g.riv = e.riv; if (e.fcs) g.fcs = e.fcs; return g;
  }).sort((x, y) => x.w - y.w);
}
function buildProSchedule(G){
  const rounds = [], met = new Set(), key = (a, b) => a < b ? a + "-" + b : b + "-" + a;
  const divs = {}; G.pro.forEach(t => (divs[t.conf + t.div] || (divs[t.conf + t.div] = [])).push(t.id));
  [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]].forEach(rr => [0, 1].forEach(flip => {
    rounds.push(Object.values(divs).flatMap(d => rr.map(([x, y]) => flip ? { h: d[y], a: d[x], div: 1 } : { h: d[x], a: d[y], div: 1 })));
  }));
  const sameDiv = (a, b) => { const x = G.pro[a], y = G.pro[b]; return x.conf === y.conf && x.div === y.div; };
  while (rounds.length < PRO_WEEKS) {
    let m = null;
    for (let tryN = 0; tryN < 400 && !m; tryN++) {
      const free = shuffle(G.pro.map(t => t.id)), out = []; let ok = true;
      while (free.length) { const a = free.pop(), c = free.filter(b => !sameDiv(a, b) && !met.has(key(a, b))); if (!c.length) { ok = false; break; } const b = pick(c); free.splice(free.indexOf(b), 1); out.push(chance(.5) ? { h: a, a: b } : { h: b, a }); }
      if (ok) m = out;
    }
    if (!m) break; m.forEach(g => met.add(key(g.h, g.a))); rounds.push(m);
  }
  G.ps = shuffle(rounds).flatMap((r, i) => r.map(g => Object.assign({ id: ++G.gid, w: i + 1 }, g)));
}

/* ----------------------------- season start ----------------------------- */
function startSeason(G){
  G.gid = G.gid || 0; G.ivLeft = 12; G.week = 1; G.phase = "reg"; G.offStep = 0;
  [...G.col, ...G.pro].forEach(t => { Object.assign(t, { w: 0, l: 0, cw: 0, cl: 0, dw: 0, dl: 0, pf: 0, pa: 0, res: [], streak: 0, rank: 0, rkHist: [], morale: 0 }); });
  for (const id in G.players) { const p = G.players[id]; p.st = {}; delete p.gl; if (p.inj) delete p.inj; }
  Object.values(G.confs).forEach(c => delete c.champ);
  buildColSchedule(G); buildProSchedule(G);
  G.cfp = null; G.bowls = []; G.pp = null; G.awards = {}; G.hw = []; G.hwHist = []; G.picks = {}; G.preds = {}; G.events = []; G.usedEv = []; G.potw = []; G._pbp = {};
  G.pollHist = [];
  rankCollege(G, true);
  G.preTop = G.col.slice().sort((a, b) => a.rkAll - b.rkAll).slice(0, 25).map(t => t.id);
  news(G, `The ${G.year} season is here. ${T(G, G.preTop[0]).name} opens at No. 1 in the preseason poll.`, "poll");
  seedSeasonEvents(G);
}

/* ----------------------------- rankings ----------------------------- */
const winPct = t => (t.w + t.l) ? t.w / (t.w + t.l) : 0;
function rankCollege(G, pre){
  const prev = {}; G.col.forEach(t => (prev[t.id] = t.rank));
  G.col.forEach(t => {
    const prior = 35 + (t.prestige - 45) * .7 + (teamOvrCached(G, t) - 62) * 1.1, gp = t.w + t.l;
    if (!gp) { t.pw = prior; return; }
    let sos = 0, qw = 0, bad = 0, mar = 0;
    t.res.forEach(([oid, pf, pa]) => { const o = oid < 0 ? null : T(G, oid); sos += o ? (winPct(o) * .6 + (o.prestige - 45) / 52 * .4) : .12; mar += clamp(pf - pa, -24, 24);
      if (pf > pa && o && prev[oid] > 0) qw += prev[oid] <= 10 ? 1.6 : 1; if (pf < pa && (!o || (o.w / Math.max(1, o.w + o.l)) < .4)) bad++; });
    const perf = ((t.w + .5) / (gp + 1)) * 55 + (sos / gp) * 34 + (mar / gp) * .55 + qw * 2.4 - bad * 2.5 + (t.postBonus || 0);
    t.pw = (prior * 2.5 + perf * gp) / (2.5 + gp);
  });
  const order = G.col.slice().sort((a, b) => b.pw - a.pw);
  order.forEach((t, i) => { t.rkAll = i + 1; t.rank = i < 25 ? i + 1 : 0; if (!pre) t.rkHist.push(t.rank); });
  if (!pre) G.pollHist.push(order.slice(0, 25).map(t => t.id));
}
function teamOvrCached(G, t){ if (!G._ovr) G._ovr = {}; const k = t.id + ":" + G.year + ":" + (G.phase === "reg" ? Math.floor(G.week / 4) : G.phase); return G._ovr[k] || (G._ovr[k] = teamOvr(G, t)); }
function confStandings(G, cid){
  return G.col.filter(t => t.conf === cid).sort((a, b) => ((b.cw + b.cl ? b.cw / (b.cw + b.cl) : 0) - (a.cw + a.cl ? a.cw / (a.cw + a.cl) : 0)) || (b.cw - a.cw) || (winPct(b) - winPct(a)) || (b.pw - a.pw));
}
const proSort = (a, b) => (winPct(b) - winPct(a)) || (b.dw - a.dw) || ((b.pf - b.pa) - (a.pf - a.pa));
function proStandings(G, conf, div){ return G.pro.filter(t => t.conf === conf && (!div || t.div === div)).sort(proSort); }

/* ----------------------------- playing games ----------------------------- */
function gameTeams(G, g){
  const H = T(G, g.h), A = g.a < 0 ? { fcs: true, id: -1, name: g.fcs, abbr: "FCS", rating: 40 + (g.id % 15), c1: "#64748b", c2: "#e2e8f0" } : T(G, g.a);
  return [H, A];
}
function playGame(G, g){
  const [H, A] = gameTeams(G, g), user = isUser(G, g.h) || isUser(G, g.a);
  const big = !H.pro && A.rank > 0 && H.rank > 0;
  const r = simGame(G, H, A, { neutral: g.neutral, pbp: user });
  applyGame(G, g, r, { post: !!g.post, keepBox: user || big || !!g.post });
  if (g.riv != null) {
    const rv = G.riv.find(x => x.i === g.riv), win = g.hs > g.as ? g.h : g.a;
    if (rv) { win === rv.a ? rv.aw++ : rv.bw++; rv.holder = win; rv.last.unshift([G.year, g.h, g.hs, g.a, g.as]); if (rv.last.length > 12) rv.last.length = 12;
      if (user) news(G, `${T(G, win).name} wins the ${rv.name} and takes home the ${rv.trophy}.`, "riv", win); }
  }
  if (!H.pro && !A.fcs) { const fav = H.rkAll < A.rkAll ? H : A, dog = fav === H ? A : H, dogWon = (dog === H) === (g.hs > g.as);
    if (dogWon && fav.rank && fav.rank <= 10 && (!dog.rank || dog.rank > fav.rank + 12)) news(G, `UPSET: ${dog.rank ? "#" + dog.rank + " " : ""}${dog.name} stuns #${fav.rank} ${fav.name}, ${Math.max(g.hs, g.as)}–${Math.min(g.hs, g.as)}.`, "upset", dog.id); }
  if (H.pro === undefined && A.fcs && g.as > g.hs) news(G, `SHOCKER: FCS ${A.name} walks into ${H.name} and wins ${g.as}–${g.hs}.`, "upset", H.id);
  return g;
}
const winnerOf = g => g.hs > g.as ? g.h : g.a, loserOf = g => g.hs > g.as ? g.a : g.h;
const gameById = (G, id) => G.cs.find(g => g.id === id) || G.ps.find(g => g.id === id);
const userGame = (G, w) => [...G.cs, ...G.ps].find(g => g.w === w && (g.h === G.uid || g.a === G.uid));

/* ----------------------------- advancing the calendar ----------------------------- */
function simWeek(G){
  if (G.phase !== "reg") return;
  const w = G.week; G._wk = [];
  expireEvents(G);
  G.cs.filter(g => g.w === w && !g.done).forEach(g => playGame(G, g));
  G.ps.filter(g => g.w === w && !g.done).forEach(g => playGame(G, g));
  for (const id in G.players) { const p = G.players[id]; if (p.inj) { p.st.gm = (p.st.gm || 0) + 1; if (--p.inj <= 0) delete p.inj; } }
  resolvePicks(G, w);
  if (w === TRADE_DEADLINE) { aiTrades(G, 4); news(G, "The pro trade deadline has passed. Rosters are set until the offseason.", "pro"); }
  // College side of the calendar.
  if (w <= COL_WEEKS) { rankCollege(G); weeklyHonors(G, w); heismanWatch(G); }
  if (w === COL_WEEKS) setupConfTitles(G);
  if (w === COL_WEEKS + 1) { crownConfChamps(G); rankCollege(G); heismanWatch(G); collegeAwards(G); setupPostseason(G); }
  if (w === 16) cfpAdvance(G, "r1"); if (w === 17) cfpAdvance(G, "qf"); if (w === 18) cfpAdvance(G, "sf");
  if (w >= 16 && w <= 19) settleBowls(G, w);
  if (w === 19) finishCollegeSeason(G);
  // Pro side.
  if (w === PRO_WEEKS) { proAwards(G); setupProPlayoffs(G); }
  if (w > PRO_WEEKS && w < LAST_WEEK) proAdvance(G, w);
  if (w === LAST_WEEK) { finishProSeason(G); G.phase = "off"; G.offStep = 0; beginOffseason(G); return; }
  G.week++;
  weeklyEvents(G);
}

/* ----------------------------- college postseason ----------------------------- */
function setupConfTitles(G){
  CONF_ORDER.forEach(cid => { if (cid === "IND") return; const s = confStandings(G, cid); if (s.length < 2) return;
    G.cs.push({ id: ++G.gid, w: COL_WEEKS + 1, h: s[0].id, a: s[1].id, neutral: 1, post: "ccg", tag: G.confs[cid].name + " Championship", cid }); });
  news(G, "Championship Saturday is set: " + G.cs.filter(g => g.post === "ccg").slice(0, 4).map(g => `${T(G, g.h).abbr}–${T(G, g.a).abbr} (${G.confs[g.cid].name})`).join(", ") + " and more.", "post");
}
function crownConfChamps(G){
  G.cs.filter(g => g.post === "ccg").forEach(g => { const c = G.confs[g.cid], t = T(G, winnerOf(g)); c.champ = t.id; t.confTitles++; t.postBonus = (t.postBonus || 0) + 3;
    if (isUser(G, t.id) || P4.includes(g.cid)) news(G, `${t.name} wins the ${c.name} championship, ${Math.max(g.hs, g.as)}–${Math.min(g.hs, g.as)} over ${T(G, loserOf(g)).name}.`, "champ", t.id); });
}
function setupPostseason(G){
  const order = G.col.slice().sort((a, b) => a.rkAll - b.rkAll);
  const champs = Object.values(G.confs).filter(c => c.champ != null).map(c => T(G, c.champ)).sort((a, b) => a.rkAll - b.rkAll).slice(0, 5);
  let field = order.slice(0, 12);
  champs.forEach(c => { if (field.includes(c)) return; for (let i = field.length - 1; i >= 0; i--) if (!champs.includes(field[i])) { field.splice(i, 1); break; } field.push(c); });
  field.sort((a, b) => a.rkAll - b.rkAll);
  const seeds = field.map(t => t.id), mk = (hi, lo, w, neutral, tag) => { const g = { id: ++G.gid, w, h: hi, a: lo, post: "cfp", tag }; if (neutral) g.neutral = 1; G.cs.push(g); return g.id; };
  G.cfp = { seeds, auto: champs.map(c => c.id), r1: [[4, 11], [5, 10], [6, 9], [7, 8]].map(([a, b]) => mk(seeds[a], seeds[b], 16, 0, "CFP First Round")), qf: [], sf: [], final: null, champ: null, firstOut: order.filter(t => !field.includes(t)).slice(0, 4).map(t => t.id) };
  news(G, `The 12-team playoff is set. Top seeds: ${seeds.slice(0, 4).map((id, i) => `(${i + 1}) ${T(G, id).name}`).join(", ")}. First team out: ${T(G, G.cfp.firstOut[0]).name}.`, "post");
  // Bowls for everyone else with six wins.
  const elig = order.filter(t => t.w >= 6 && !field.includes(t)), n = Math.min(BOWLS.length, Math.floor(elig.length / 2));
  G.bowls = [];
  for (let i = 0; i < n; i++) {
    const a = elig.shift(); let j = elig.findIndex(b => b.conf !== a.conf); if (j < 0) j = 0; const b = elig.splice(Math.min(j, 3) === j ? j : 0, 1)[0];
    const g = { id: ++G.gid, w: i < n / 2 ? 17 : 16, h: a.id, a: b.id, neutral: 1, post: "bowl", tag: BOWLS[i] }; G.cs.push(g); G.bowls.push(g.id);
  }
  seedBowlPickem(G);
}
function cfpAdvance(G, round){
  const c = G.cfp, W = id => winnerOf(gameById(G, id)), mk = (a, b, w, tag) => { const sa = c.seeds.indexOf(a), sb = c.seeds.indexOf(b), g = { id: ++G.gid, w, h: sa < sb ? a : b, a: sa < sb ? b : a, neutral: 1, post: "cfp", tag }; G.cs.push(g); return g.id; };
  if (round === "r1") c.qf = [0, 1, 2, 3].map(i => mk(c.seeds[3 - i], W(c.r1[i]), 17, CFP_QF[i] + " · CFP Quarterfinal"));   // 4v(5/12) … 1v(8/9)
  if (round === "qf") c.sf = [mk(W(c.qf[3]), W(c.qf[0]), 18, CFP_SF[0] + " · CFP Semifinal"), mk(W(c.qf[2]), W(c.qf[1]), 18, CFP_SF[1] + " · CFP Semifinal")];
  if (round === "sf") { c.final = mk(W(c.sf[0]), W(c.sf[1]), 19, "CFP National Championship"); news(G, `The national title game is set: ${T(G, W(c.sf[0])).name} vs. ${T(G, W(c.sf[1])).name}.`, "post"); }
}
function settleBowls(G, w){
  G.cs.filter(g => g.w === w && g.post && g.post !== "ccg" && g.done).forEach(g => {
    const win = T(G, winnerOf(g)), lose = T(G, loserOf(g));
    if (g.post === "bowl") { win.bowlW++; lose.bowlL++; win.postBonus = (win.postBonus || 0) + 1.5; win._post = "Won " + g.tag; lose._post = "Lost " + g.tag; }
    else { win.postBonus = (win.postBonus || 0) + 4; lose._post = "Lost " + g.tag.replace(/.*· /, ""); win._post = "Won " + g.tag.replace(/.*· /, ""); }
    if (g.potg && G.players[g.potg]) G.players[g.potg].aw.push([G.year, g.tag.replace(/ · .*/, "") + " MVP"]);
    if (isUser(G, win.id) || isUser(G, lose.id)) news(G, `${g.tag}: ${win.name} ${Math.max(g.hs, g.as)}, ${lose.name} ${Math.min(g.hs, g.as)}.`, "post", win.id);
  });
}
function finishCollegeSeason(G){
  const fg = gameById(G, G.cfp.final), champ = T(G, winnerOf(fg)), ru = T(G, loserOf(fg));
  G.cfp.champ = champ.id; champ.titles++; champ._post = "National Champions"; ru._post = "National runner-up";
  if (champ.coach) champ.coach.ch++;
  rankCollege(G);
  // The champion is No. 1 and the runner-up No. 2, whatever the formula says.
  const order = G.col.slice().sort((a, b) => a.rkAll - b.rkAll).filter(t => t !== champ && t !== ru); order.unshift(champ, ru);
  order.forEach((t, i) => { t.rkAll = i + 1; t.rank = i < 25 ? i + 1 : 0; });
  news(G, `${champ.name} are the ${G.year} national champions, beating ${ru.name} ${Math.max(fg.hs, fg.as)}–${Math.min(fg.hs, fg.as)}.`, "champ", champ.id);
  G.col.forEach(t => {
    t.hist.push({ y: G.year, w: t.w, l: t.l, cw: t.cw, cl: t.cl, rk: t.rank, post: t._post || (t.w >= 6 ? "" : ""), cc: G.confs[t.conf].champ === t.id ? 1 : 0, coach: t.coach.name, pf: t.pf, pa: t.pa, pr: round(t.prestige) });
    // Prestige drifts toward how the program is actually doing.
    const exp = (t.prestige - 45) / 52 * .66 + .19, d = (winPct(t) - exp) * 6 + (t.rank && t.rank <= 10 ? .5 : 0) + (t === champ ? 2 : 0) + (G.confs[t.conf].champ === t.id ? .7 : 0) - Math.max(0, t.prestige - 90) * .12;
    t.prestige = clamp(round((t.prestige + clamp(d, -3, 4)) * 10) / 10, 30, 99);
    delete t._post; delete t.postBonus;
  });
  Object.values(G.confs).forEach(c => { if (c.champ != null) c.champs.unshift([G.year, c.champ]); });
  resolveSeasonPreds(G);
  const h = seasonHist(G); h.natChamp = champ.id; h.natRU = ru.id; h.natScore = [Math.max(fg.hs, fg.as), Math.min(fg.hs, fg.as)]; h.top25 = order.slice(0, 25).map(t => [t.id, t.w, t.l]);
  h.confChamps = {}; Object.values(G.confs).forEach(c => { if (c.champ != null) h.confChamps[c.id] = c.champ; });
  h.cfp = { seeds: G.cfp.seeds.slice() }; h.bowls = G.cs.filter(g => g.post === "bowl").map(g => [g.tag, g.h, g.hs, g.a, g.as]);
  if (G.mode === "college") { const t = userTeam(G); G.coach.hist.push({ y: G.year, tid: t.id, w: t.w, l: t.l, rk: t.rank, note: t.hist[t.hist.length - 1].post, cc: t.hist[t.hist.length - 1].cc, pr: round(t.prestige) }); G.coach.w += t.w; G.coach.l += t.l; }
}
function seasonHist(G){ let h = G.hist.find(x => x.y === G.year); if (!h) { h = { y: G.year }; G.hist.push(h); } return h; }

/* ----------------------------- pro postseason ----------------------------- */
function setupProPlayoffs(G){
  const seeds = {};
  PRO_CONFS.forEach(conf => {
    const winners = PRO_DIVS.map(d => proStandings(G, conf, d)[0]).sort(proSort), rest = proStandings(G, conf).filter(t => !winners.includes(t)).slice(0, 3);
    seeds[conf] = [...winners, ...rest].map(t => t.id);
  });
  const mk = (h, a, w, tag, neutral) => { const g = { id: ++G.gid, w, h, a, post: "pro", tag }; if (neutral) g.neutral = 1; G.ps.push(g); return g.id; };
  G.pp = { seeds, rounds: [PRO_CONFS.flatMap(c => [[1, 6], [2, 5], [3, 4]].map(([a, b]) => mk(seeds[c][a], seeds[c][b], 18, c + " Wild Card")))], champ: null, mk: 0 };
  news(G, `The pro playoff field is set. Top seeds: ${PRO_CONFS.map(c => tname(T(G, seeds[c][0]))).join(" and ")}.`, "pro");
}
function proAdvance(G, w){
  const pp = G.pp, last = pp.rounds[pp.rounds.length - 1].map(id => gameById(G, id)), mk = (h, a, wk, tag, neutral) => { const g = { id: ++G.gid, w: wk, h, a, post: "pro", tag }; if (neutral) g.neutral = 1; G.ps.push(g); return g.id; };
  const seedOf = (c, id) => pp.seeds[c].indexOf(id);
  if (w === 18) pp.rounds.push(PRO_CONFS.flatMap(c => { const al = last.filter(g => T(G, g.h).conf === c).map(winnerOf).sort((a, b) => seedOf(c, a) - seedOf(c, b)); return [mk(pp.seeds[c][0], al[2], 19, c + " Divisional"), mk(al[0], al[1], 19, c + " Divisional")]; }));
  if (w === 19) pp.rounds.push(PRO_CONFS.map(c => { const al = last.filter(g => T(G, g.h).conf === c).map(winnerOf).sort((a, b) => seedOf(c, a) - seedOf(c, b)); return mk(al[0], al[1], 20, c + " Championship"); }));
  if (w === 20) { const [a, b] = last.map(winnerOf); pp.rounds.push([mk(a, b, 21, "Pocket Bowl " + ROMAN(G.year - 1965), 1)]); news(G, `Pocket Bowl ${ROMAN(G.year - 1965)}: ${tname(T(G, a))} vs. ${tname(T(G, b))}.`, "pro"); }
}
function finishProSeason(G){
  const fg = gameById(G, G.pp.rounds[3][0]), champ = T(G, winnerOf(fg)), ru = T(G, loserOf(fg));
  G.pp.champ = champ.id; champ.titles++; if (champ.coach) champ.coach.ch++;
  const mvp = G.players[fg.potg]; if (mvp) { mvp.aw.push([G.year, "Pocket Bowl MVP"]); }
  news(G, `${tname(champ)} win Pocket Bowl ${ROMAN(G.year - 1965)}, ${Math.max(fg.hs, fg.as)}–${Math.min(fg.hs, fg.as)} over the ${ru.nick}.${mvp ? " MVP: " + pname(mvp) + "." : ""}`, "champ", champ.id);
  const depth = {}; G.pp.rounds.forEach((r, i) => r.forEach(id => { const g = gameById(G, id); depth[loserOf(g)] = ["Lost Wild Card", "Lost Divisional", "Lost Conf. Championship", "Lost Pocket Bowl"][i]; }));
  G.pro.forEach(t => t.hist.push({ y: G.year, w: t.w, l: t.l, post: t === champ ? "Won Pocket Bowl" : depth[t.id] || "", coach: t.coach.name, pf: t.pf, pa: t.pa }));
  const h = seasonHist(G); h.proChamp = champ.id; h.proRU = ru.id; h.proScore = [Math.max(fg.hs, fg.as), Math.min(fg.hs, fg.as)]; h.pbMvp = mvp ? [mvp.id, pname(mvp), mvp.pos] : null;
  if (G.mode === "pro") { const t = userTeam(G), row = t.hist[t.hist.length - 1]; G.coach.hist.push({ y: G.year, tid: t.id, w: t.w, l: t.l, note: row.post }); G.coach.w += t.w; G.coach.l += t.l; }
}
