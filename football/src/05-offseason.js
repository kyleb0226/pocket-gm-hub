
/* ----------------------------- offseason ----------------------------- */
// Steps the Advance button walks through once the title games are played.
const OFF_STEPS = ["Season review", "Re-signing", "Free agency", "The Draft", "Portal & Signing Day", "Training camp"];
const draftValue = p => p.ovr * .68 + p.pot * .32 + ({ QB: 2.5, K: -13, P: -14, C: -2, OG: -1.5, S: -1, RB: -1 }[p.pos] || 0);
const awardScore = (p, pro) => sum(p.aw, ([, a]) => pro
  ? (a === "Most Valuable Player" ? 25 : /Player of the Year/.test(a) ? 12 : a === "First-team All-Pro" ? 8 : a === "Second-team All-Pro" ? 4 : a === "Pro Bowl" ? 2.5 : a === "Pocket Bowl MVP" ? 6 : 0)
  : (a === "Heisman Trophy" ? 30 : /All-American$/.test(a) && !/Second|Freshman/.test(a) ? 12 : a === "Second-team All-American" ? 5 : /Award|Trophy$|Golden Arm/.test(a) && !/finalist|Joe Moore/.test(a) ? 10 : /^First-team All-/.test(a) ? 2 : 0));
const notable = p => p.hof || p.chof || awardScore(p, false) >= 10 || awardScore(p, true) >= 4 || (p.exp || 0) >= 7;
function retire(G, p, why){
  p.ret = G.year; p.tid = null; delete p.fa; delete p.c; G._ros = null;
  if (p.exp != null && awardScore(p, true) + (careerTotals(p, "P").g || 0) / 16 >= 45 && !p.hof) { p.hof = G.year; G.hof.push(p.id); news(G, `${pname(p)} (${p.pos}) retires and is headed for the Pro Hall of Fame.`, "hof"); }
  if (!notable(p)) dropP(G, p);
}
function leaveCollege(G, p){
  if (awardScore(p, false) >= 34 && !p.chof) { p.chof = G.year; G.colHof.push(p.id); }
  p.col = p.tid; delete p.portal; delete p.stay;
}
const payroll = (G, tid) => sum(rosterOf(G, tid), p => p.c ? p.c.amt : 0);
const capRoom = (G, tid) => CAP - payroll(G, tid);
const askOf = (G, p) => +Math.max(.9, salaryFor(p) * (G.capK || 1)).toFixed(2);
function toFA(G, p){ p.fa = 1; p.tid = null; delete p.c; G._ros = null; }

function beginOffseason(G){
  archiveStats(G); seasonLP(G);
  if (G.preds.proChamp != null) { if (G.preds.proChamp === G.pp.champ) gainLP(G, 10, "called the pro champion in the preseason"); }
  // --- coaching carousel ---
  const fired = [];
  G.col.forEach(t => { if (isUser(G, t.id)) return; const h = t.hist.slice(-3), c = t.coach; c.age++;
    const exp = (t.prestige - 45) / 52 * .62 + .2, got = avgOf(h, r => r.w / Math.max(1, r.w + r.l), .5);
    if ((G.year - c.since >= 2 && got < exp - .2 && chance(.6)) || c.age > 72) fired.push(t); });
  fired.sort((a, b) => b.prestige - a.prestige).forEach(t => {
    const old = t.coach, risers = G.col.filter(x => x.prestige < t.prestige - 8 && !fired.includes(x) && !isUser(G, x.id) && coachScore(x) > 2.5).sort((a, b) => coachScore(b) - coachScore(a));
    if (risers.length && chance(.65)) { const from = risers[0]; t.coach = from.coach; t.coach.since = G.year + 1; from.coach = makeCoach(G, 30 + from.prestige * .5); from.coach.since = G.year + 1; fired.push(from);
      news(G, `${t.name} hires ${t.coach.name} away from ${from.name} after parting ways with ${old.name}.`, "coach", t.id); }
    else { t.coach = makeCoach(G, 34 + t.prestige * .5); t.coach.since = G.year + 1; if (t.prestige >= 70) news(G, `${t.name} fires ${old.name} and hires ${t.coach.name}.`, "coach", t.id); }
  });
  G.openJobs = fired.filter(t => !isUser(G, t.id)).map(t => t.id);
  G.openPro = [];
  G.pro.forEach(t => { if (isUser(G, t.id)) return; const h = t.hist.slice(-2); t.coach.age++; if (h.length === 2 && h.every(r => r.w <= 5) && G.year - t.coach.since >= 1) { const old = t.coach; G.openPro.push(t.id); t.coach = makeCoach(G, 68); t.coach.since = G.year + 1; news(G, `The ${t.nick} fire ${old.name}; ${t.coach.name} takes over.`, "coach", t.id); } });
  jobReview(G); staffOffseason(G); realignment(G);
  // --- pro: retirements and expiring deals ---
  proPlayers(G).concat(Object.values(G.players).filter(p => p.fa)).forEach(p => {
    const old = p.age >= 38 || (p.age >= 35 && chance(.5)) || (p.age >= 31 && p.ovr < 72 && chance(.45)) || (p.fa && (p.age >= 29 || p.ovr < 64));
    if (old) { if (isUser(G, p.tid) || p.ovr >= 86 || awardScore(p, true) >= 20) news(G, `${pname(p)} (${p.pos}, ${p.age}) announces his retirement.`, "ret", p.tid); return retire(G, p); }
    if (p.c && --p.c.yrs <= 0) p.expiring = 1;
  });
  // --- college: seniors and early entrants leave ---
  const pool = [];
  colPlayers(G).forEach(p => {
    const t = T(G, p.tid), dv = draftValue(p), early = p.cls === 2 && !p.stay && (dv >= 79 || (dv >= 75 && chance(.5)));
    if ((p.cls === 3 && p.rs !== G.year) || early) { p.dcl = G.year; p.tx.push([G.year, early ? `Declared early for the draft (${t.name})` : `Finished his eligibility at ${t.name}`]); leaveCollege(G, p); p.tid = null; pool.push(p);
      if (early && (isUser(G, t.id) || dv >= 84)) news(G, `${t.name} ${p.pos} ${pname(p)} declares for the draft.`, "draft", t.id); }
  });
  G._ros = null;
  pool.sort((a, b) => draftValue(b) - draftValue(a));
  pool.slice(420).forEach(p => { p.ret = G.year; if (!notable(p)) dropP(G, p); });
  const order = G.pro.slice().sort((a, b) => { const d = t => { const r = (t.hist[t.hist.length - 1] || {}).post || ""; return r === "Won Pocket Bowl" ? 5 : r === "Lost Pocket Bowl" ? 4 : /Conf/.test(r) ? 3 : /Div/.test(r) ? 2 : /Wild/.test(r) ? 1 : 0; }; return d(a) - d(b) || winPct(a) - winPct(b); }).map(t => t.id);
  G.draft = { pool: pool.slice(0, 420).map(p => p.id), order: applyPickOwn(G, order), pick: 0, log: [], done: false, rank: {} };
  G.draft.pool.forEach((id, i) => (G.draft.rank[id] = i + 1)); G.ivLeft = 30;
  // --- transfer portal entries ---
  G.portal = [];
  G.col.forEach(t => { const d = depthChart(G, t.id); POS.forEach(pos => d[pos].forEach((p, i) => {
    if (p.stay || p.cls == null || p.cls >= 3) return;
    const buried = i >= STARTERS[pos] && p.ovr >= 66 && p.cls >= 1, big = i < STARTERS[pos] && p.ovr >= 76 && t.prestige < 66;
    if ((buried && chance(.3)) || (big && chance(.35)) || chance(.012)) { p.portal = 1; G.portal.push(p.id); } }));
  });
  genRecruits(G);
  G.pitchLeft = 15 + (G.bonusPitch || 0) + staffBonus(G, "rc"); G.bonusPitch = 0; G.pitches = {}; nilReset(G);
  if (G.mode === "pro") G.ivLeft += staffBonus(G, "sc") * 2 + ((G.fac || {}).recruit || 0) * 3;
  news(G, `The ${G.year} season is in the books. ${G.draft.pool.length} prospects are in the draft pool, ${G.portal.length} players have entered the transfer portal, and ${G.rec.length} recruits are waiting on Signing Day.`, "off");
}

function jobOffers(G){
  const t = userTeam(G), score = coachScore(t);
  const jobs = (G.openJobs || []).map(id => T(G, id)).filter(x => x.prestige > t.prestige + 3 && x.prestige < t.prestige + 12 + score * 5).sort((a, b) => b.prestige - a.prestige).slice(0, 3);
  if (!jobs.length || score < 1.5) return;
  G.events.push({ id: ++G.gid, key: "job", w: 99, title: "Job offers", body: `Your ${t.w}-${t.l} season at ${t.name} got noticed. ${jobs.map(j => j.name).join(", ")} ${jobs.length > 1 ? "have" : "has"} called. Taking a job moves you to that program for good — your record and trophies come with you.`, ctx: { jobs: jobs.map(j => j.id) }, opts: [...jobs.map(j => ({ l: "Take the " + j.name + " job", d: `${G.confs[j.conf].name} · prestige ${round(j.prestige)}` })), { l: "Stay at " + t.name, d: "Loyalty: +4 Legacy Points and a morale boost" }] });
}

/* --- pro roster moves --- */
function resign(G, p, yrs){ p.c = { amt: askOf(G, p), yrs: yrs || 3 }; delete p.expiring; p.tx.push([G.year, `Re-signed with the ${T(G, p.tid).nick} (${yrs || 3} yr, ${money(p.c.amt)})`]); }
function releaseP(G, p){ p.tx.push([G.year, `Released by the ${T(G, p.tid).nick}`]); toFA(G, p); }
function signFA(G, p, tid, yrs, amt){ const t = T(G, tid); p.c = { amt: amt || askOf(G, p), yrs: yrs || 2 }; delete p.fa; delete p.expiring; moveP(G, p, tid); if (p.exp == null) p.exp = 0; p.tx.push([G.year, `Signed with the ${t.nick} (${p.c.yrs} yr, ${money(p.c.amt)})`]); }
const freeAgents = G => Object.values(G.players).filter(p => p.fa).sort((a, b) => b.ovr - a.ovr);
function aiResign(G){
  proPlayers(G).filter(p => p.expiring).forEach(p => {
    if (isUser(G, p.tid)) return releaseExp(G, p);
    const d = depthChart(G, p.tid)[p.pos], i = d.indexOf(p), keep = (i < STARTERS[p.pos] && p.age < 33) || (i < STARTERS[p.pos] * 2 && p.age < 29 && chance(.6));
    if (keep && chance(.82)) { p.c = { amt: askOf(G, p), yrs: rint(1, 4) }; delete p.expiring; } else releaseExp(G, p);
  });
}
function releaseExp(G, p){ const t = T(G, p.tid); delete p.expiring; p.tx.push([G.year, `Contract with the ${t.nick} expired`]); if (p.ovr >= 84) news(G, `${p.pos} ${pname(p)} (${p.ovr}) hits free agency after ${t.city} lets his deal expire.`, "fa", t.id); toFA(G, p); }
function aiFreeAgency(G){
  for (let pass = 0; pass < 3; pass++) shuffle(G.pro).forEach(t => {
    if (isUser(G, t.id)) return; const d = depthChart(G, t.id), fa = freeAgents(G);
    const needs = POS.filter(pos => d[pos].length < PRO_NEED[pos] || (d[pos][STARTERS[pos] - 1] || { ovr: 0 }).ovr < 72);
    for (const pos of shuffle(needs)) { const p = fa.find(x => x.pos === pos && askOf(G, x) <= capRoom(G, t.id) - 4); if (p && (d[pos].length < PRO_NEED[pos] || p.ovr > (d[pos][STARTERS[pos] - 1] || { ovr: 0 }).ovr)) { signFA(G, p, t.id, rint(1, 3)); if (p.ovr >= 84) news(G, `The ${t.nick} sign ${p.pos} ${pname(p)} (${p.ovr}).`, "fa", t.id); break; } }
  });
}
// Make every pro roster legal: fill empty spots from the street, trim the surplus.
function fillProRosters(G, includeUser){
  G.pro.forEach(t => {
    if (isUser(G, t.id) && !includeUser) return; const user = isUser(G, t.id);
    // Over the cap? Shed the worst value until it fits, then fill the holes below with minimum deals.
    if (!user) { let guard = 0; while (capRoom(G, t.id) < 0 && guard++ < 25) { const d = depthChart(G, t.id), c = rosterOf(G, t.id).filter(p => d[p.pos].indexOf(p) >= STARTERS[p.pos]).sort((a, b) => b.c.amt - a.c.amt)[0]; if (!c) break; releaseP(G, c); } }
    POS.forEach(pos => {
      let have = rosterOf(G, t.id).filter(p => p.pos === pos);
      while (have.length < PRO_NEED[pos]) { let p = freeAgents(G).find(x => x.pos === pos); if (!p) { p = addP(G, makePlayer(G, pos, gauss(63, 3), rint(22, 25))); p.exp = 0; p.fa = 1; }
        p.c = { amt: Math.min(askOf(G, p), Math.max(.9, capRoom(G, t.id) / 4)), yrs: 1 }; delete p.fa; moveP(G, p, t.id); if (p.exp == null) p.exp = 0; p.tx.push([G.year, `Signed with the ${t.nick}`]); have.push(p);
        if (user) news(G, `Roster filled: ${pos} ${pname(p)} (${p.ovr}) signs a one-year deal.`, "fa", t.id); }
      if (!user) have.sort((a, b) => b.ovr + (b.draft && b.draft.y === G.year ? 6 : 0) - a.ovr - (a.draft && a.draft.y === G.year ? 6 : 0)).slice(PRO_NEED[pos] + 1).forEach(p => releaseP(G, p));
    });
  });
  const fa = freeAgents(G); fa.slice(260).forEach(p => retire(G, p));
}

/* --- the draft --- */
// College ratings are measured against college players. The day a player turns pro he is
// re-rated on the pro scale, so a 95 in college is a promising rookie, not an instant All-Pro.
const proProj = v => round(48 + (v - 48) * .76);
function toProScale(p){
  if (p.proScaled) return; const pot0 = p.pot, d = p.ovr - proProj(p.ovr);
  p.colPeak = p.ovr; p.r = p.r.map(v => clamp(v - d, 25, 99)); p.ovr = calcOvr(p); p.pot = clamp(Math.max(p.ovr, round(52 + (pot0 - 52) * .84)), p.ovr, 99); p.proScaled = 1;
}
function draftAssign(G, p){
  const d = G.draft, pk = d.pick + 1, t = T(G, d.order[d.pick]), ct = T(G, p.col);
  p.draft = { y: G.year + 1, rd: Math.ceil(pk / 32), pk, t: t.abbr }; p.c = { amt: +Math.max(.9, 9.5 * Math.pow(.982, pk)).toFixed(2), yrs: 4 }; p.exp = 0; delete p.cls; delete p.dcl; delete p.recruit; toProScale(p);
  moveP(G, p, t.id); p.tx.push([G.year + 1, `Drafted by the ${t.city} ${t.nick} — round ${p.draft.rd}, pick ${pk}`]);
  if (ct) ct.picks++; d.pool.splice(d.pool.indexOf(p.id), 1); d.log.push([pk, t.id, p.id, pname(p), p.pos, ct ? ct.id : null, d.rank ? d.rank[p.id] || 0 : 0]); d.pick++;
  if (pk === 1) news(G, `With the first pick, the ${t.nick} select ${ct ? ct.name : ""} ${p.pos} ${pname(p)}.`, "draft", t.id);
  if (ct && isUser(G, ct.id)) { news(G, `Your ${p.pos} ${pname(p)} goes in round ${p.draft.rd} (No. ${pk}) to the ${t.nick}.`, "draft", ct.id); gainLP(G, p.draft.rd === 1 ? 3 : 1, "a player drafted"); }
  if (d.pick >= d.order.length) finishDraft(G);
}
function draftAI(G){
  const d = G.draft, t = T(G, d.order[d.pick]), dc = depthChart(G, t.id), rd = Math.ceil((d.pick + 1) / 32);
  const best = d.pool.slice(0, 40).map(id => G.players[id]).map(p => { const have = dc[p.pos], st = have[STARTERS[p.pos] - 1];
    return [p, draftValue(p) + (have.length < PRO_NEED[p.pos] ? 2.5 : 0) + (st && st.ovr < proProj(p.ovr) + 3 ? 1.5 : 0) - (p.pos === "QB" && have[0] && have[0].ovr >= 82 && have[0].age < 31 ? 7 : 0) - ((p.pos === "K" || p.pos === "P") && rd < 5 ? 20 : 0) + gauss(0, 1.6)]; }).sort((a, b) => b[1] - a[1])[0][0];
  draftAssign(G, best);
}
const onClock = G => G.draft && !G.draft.done ? G.draft.order[G.draft.pick] : null;
function draftRun(G, toEnd){ let n = 0; while (!G.draft.done && (toEnd || G.mode !== "pro" || onClock(G) !== G.uid) && n++ < 400) draftAI(G); }
function finishDraft(G){
  const d = G.draft; d.done = true;
  d.pool.map(id => G.players[id]).forEach((p, i) => { if (i < 110) { toProScale(p); p.fa = 1; p.exp = 0; delete p.cls; delete p.dcl; p.tx.push([G.year + 1, "Went undrafted"]); } else { p.ret = G.year; if (!notable(p)) dropP(G, p); else p.tx.push([G.year + 1, "Went undrafted"]); } });
  d.pool = []; G._ros = null;
  // Grade every class: how much better (or worse) than the consensus board each pick was.
  const by = {}; d.log.forEach(r => { const rk = d.rank[r[2]] || 420, v = clamp((r[0] - rk) / Math.sqrt(r[0] + 8), -6, 6); (by[r[1]] || (by[r[1]] = { s: 0, n: 0, best: null, bv: -99 })); const o = by[r[1]]; o.s += v * (r[0] <= 64 ? 1.5 : 1); o.n++; if (v > o.bv) { o.bv = v; o.best = [r[2], r[3], r[4], r[0], rk]; } });
  const sc = Object.keys(by).map(tid => [+tid, by[tid].s / Math.max(1, by[tid].n), by[tid].best]).sort((a, b) => b[1] - a[1]);
  d.grades = sc.map(([tid, s, best], i) => ({ tid, g: ["A+", "A", "A", "A-", "A-", "B+", "B+", "B+", "B", "B", "B", "B", "B-", "B-", "B-", "B-", "C+", "C+", "C+", "C+", "C", "C", "C", "C", "C-", "C-", "C-", "D+", "D+", "D", "D", "F"][Math.min(31, i)], best }));
  delete d.rank;
  const h = seasonHist(G); h.draft = d.log.slice(0, 32);
}

/* --- recruiting --- */
function genRecruits(G){
  const need = {}; POS.forEach(pos => (need[pos] = 0));
  G.col.forEach(t => { const r = rosterOf(G, t.id).filter(p => !p.portal); POS.forEach(pos => (need[pos] += Math.max(0, COL_NEED[pos] - r.filter(p => p.pos === pos).length))); });
  G.rec = [];
  POS.forEach(pos => { for (let i = 0; i < round(need[pos] * .97); i++) {
    const x = _rng(), stars = x < .025 ? 5 : x < .24 ? 4 : x < .74 ? 3 : 2;
    const p = makePlayer(G, pos, gauss([0, 0, 50, 57, 64, 70.5][stars], 3.2), 18, { pot: clamp(round(gauss([0, 0, 68, 76, 84, 91][stars], 5)), 50, 99) });
    p.stars = stars; p.recruit = 1; p.cls = 0; addP(G, p); G.rec.push(p.id);
  } });
  G.rec.sort((a, b) => draftValue(G.players[b]) + G.players[b].stars * 3 - draftValue(G.players[a]) - G.players[a].stars * 3);
  G.rec.forEach((id, i) => (G.players[id].rk = i + 1));
}
const homeBonus = (p, t) => { const st = p.home.slice(-2); return st === t.state ? 9 : REGION[st] && REGION[st] === REGION[t.state] ? 4 : 0; };
function schoolPull(G, p, t, noise){ return t.prestige + homeBonus(p, t) + (noise ? gauss(0, 9) : 0) + (isUser(G, t.id) ? (G.pitches[p.id] || 0) * (G.scouted[p.id] ? 11 : 9) + (G.perks.rec || 0) * 2 + nilPull(p, G.nil && G.nil.deals[p.id]) + ((G.fac || {}).recruit || 0) : 0) + prioBonus(p, t) + (t.coach.ovr - 60) * .08; }
// The three schools most likely to land a recruit, as things stand (no luck applied).
function recruitLeaders(G, p){
  const open = G.col.filter(t => t.id !== p.tid && rosterOf(G, t.id).filter(x => x.pos === p.pos && !x.portal).length + (G._signed && G._signed[t.id + p.pos] || 0) < COL_NEED[p.pos] + (p.portal ? 1 : 0));
  return open.map(t => [t, schoolPull(G, p, t, false)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
}
function signingDay(G){
  const cnt = {}; G.col.forEach(t => POS.forEach(pos => (cnt[t.id + pos] = rosterOf(G, t.id).filter(p => p.pos === pos && !p.portal).length)));
  const cls = {}, land = (p, t) => { cnt[t.id + p.pos]++; (cls[t.id] || (cls[t.id] = [])).push(p); };
  // Transfers first: they go where they'd start.
  const best = {}; G.col.forEach(t => { const d = depthChart(G, t.id); POS.forEach(pos => (best[t.id + pos] = (d[pos].filter(p => !p.portal)[STARTERS[pos] - 1] || { ovr: 0 }).ovr)); });
  G.portal.map(id => G.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr).forEach(p => {
    const from = T(G, p.tid), c = G.col.filter(t => t.id !== p.tid && cnt[t.id + p.pos] < COL_NEED[p.pos] + 1 && best[t.id + p.pos] < p.ovr + 1).map(t => [t, schoolPull(G, p, t, true) * .8 + (t.prestige > from.prestige ? 4 : 0)]).sort((a, b) => b[1] - a[1])[0];
    delete p.portal; if (!c) return; const t = c[0];
    p.tx.push([G.year + 1, `Transferred from ${from.name} to ${t.name}`]); p.xfer = G.year + 1; moveP(G, p, t.id); cnt[t.id + p.pos]++; best[t.id + p.pos] = Math.max(best[t.id + p.pos], p.ovr); (cls[t.id] || (cls[t.id] = [])).push(p);
    if (p.ovr >= 80 || isUser(G, t.id) || isUser(G, from.id)) news(G, `PORTAL: ${p.pos} ${pname(p)} (${p.ovr}) transfers from ${from.name} to ${t.name}.`, "portal", t.id);
  });
  G.rec.map(id => G.players[id]).forEach(p => {
    const c = G.col.filter(t => cnt[t.id + p.pos] < COL_NEED[p.pos]).map(t => [t, schoolPull(G, p, t, true)]).sort((a, b) => b[1] - a[1])[0];
    if (!c) return dropP(G, p); const t = c[0];
    delete p.recruit; p.enr = G.year + 1; moveP(G, p, t.id); land(p, t); p.tx.push([G.year + 1, `Signed with ${t.name} as a ${p.stars}-star recruit (No. ${p.rk} nationally)`]);
    if (p.rk <= 5 || (isUser(G, t.id) && p.stars >= 4)) news(G, `SIGNING DAY: ${p.stars}★ ${p.pos} ${pname(p)} (No. ${p.rk}) signs with ${t.name}.`, "rec", t.id);
  });
  // Walk-ons fill whatever is still empty.
  G.col.forEach(t => POS.forEach(pos => { for (let n = cnt[t.id + pos]; n < COL_NEED[pos]; n++) { const gem = chance(.06), p = addP(G, makePlayer(G, pos, gauss(colTarget(t, 0) - 9, 3.5), 18, gem ? { pot: rint(78, 92) } : undefined)); p.cls = 0; p.stars = 1; p.walkOn = 1; p.enr = G.year + 1; p.tid = t.id; p.tx.push([G.year + 1, `Walked on at ${t.name}`]); } }));
  G._ros = null;
  const ranks = G.col.map(t => { const c = (cls[t.id] || []).filter(p => !p.xfer || p.xfer !== G.year + 1).sort((a, b) => b.stars - a.stars || a.rk - b.rk); return { tid: t.id, n: c.length, pts: round(sum(c.slice(0, 20), p => [0, 1, 6, 16, 34, 60][p.stars] + Math.max(0, 300 - (p.rk || 999)) * .05)), five: c.filter(p => p.stars === 5).length, four: c.filter(p => p.stars === 4).length, avg: c.length ? +(sum(c, p => p.stars) / c.length).toFixed(2) : 0 }; }).sort((a, b) => b.pts - a.pts);
  G.classRank = ranks; G.rec = []; G.portal = [];
  news(G, `Signing Day: ${T(G, ranks[0].tid).name} lands the No. 1 class (${ranks[0].five} five-stars), followed by ${T(G, ranks[1].tid).name} and ${T(G, ranks[2].tid).name}.`, "rec");
  if (G.mode === "college") { const i = ranks.findIndex(r => r.tid === G.uid); if (i < 10) gainLP(G, 5, "a top-10 recruiting class"); else if (i < 25) gainLP(G, 2, "a top-25 recruiting class"); news(G, `Your class ranks No. ${i + 1} nationally.`, "rec", G.uid); }
  seasonHist(G).classTop = ranks.slice(0, 10).map(r => [r.tid, r.pts, r.five]);
}
function pitch(G, p){ if (G.pitchLeft <= 0 || (G.pitches[p.id] || 0) >= 3) return false; G.pitches[p.id] = (G.pitches[p.id] || 0) + 1; G.pitchLeft--; return true; }

/* --- development --- */
function progression(G){
  for (const id in G.players) {
    const p = G.players[id]; if (p.ret) continue; if (p.tid == null && !p.fa) continue;
    p.age++; let d;
    if (p.tid != null && p.tid >= 100) { const t = T(G, p.tid); d = gauss((p.pot - p.ovr) * .3 + .9 + (t.coach.ovr - 60) * .015 + (isUser(G, t.id) ? (G.perks.dev || 0) * .3 + ((G.fac || {}).train || 0) * .22 : 0), 2); d = clamp(d, -1, 9); if (p.rs === G.year) p.rsd = 1; p.cls = Math.min(3, (p.cls || 0) + (p.enr === G.year + 1 || p.rs === G.year ? 0 : 1)); }
    else { p.exp = (p.exp || 0) + 1; d = p.age <= 25 ? gauss((p.pot - p.ovr) * .3 + .4 + (isUser(G, p.tid) ? ((G.fac || {}).train || 0) * .18 : 0), 1.8) : p.age <= 29 ? gauss(0, 1.2) : p.age <= 32 ? gauss(-1.2, 1.5) : gauss(-2.6, 1.6); }
    tweakRatings(p, round(d + (p.age <= 26 ? (trait(p, "we") - 3) * .3 : 0))); p.ovh.push([G.year + 1, p.ovr]); if (p.ovh.length > 22) p.ovh.shift();
  }
}

function advanceOff(G){
  const s = G.offStep; if (G.coach.fired) { const ev = G.events.find(e => e.key === "job" && !e.done); if (ev) chooseEvent(G, ev.id, 0); delete G.coach.fired; }
  expireEvents(G, true);
  if (s === 0) { if (G.mode !== "pro") aiResign(G); }
  else if (s === 1) { aiResign(G); if (G.mode !== "pro") aiFreeAgency(G); }
  else if (s === 2) { aiFreeAgency(G); aiTrades(G, 3); draftRun(G, false); }
  else if (s === 3) { if (!G.draft.done) draftRun(G, true); }
  else if (s === 4) { signingDay(G); }
  else if (s === 5) {
    progression(G); fillProRosters(G, true);
    Object.values(G.players).forEach(p => { if (p.ret && !notable(p)) delete G.players[p.id]; if (p.tx.length > 14) p.tx.splice(0, p.tx.length - 14); });
    G._ros = null; G._ovr = null; G.year++; startSeason(G); return;
  }
  G.offStep++;
  if (G.offStep === 3 && G.mode !== "pro") { /* the user watches the draft; picks happen on Advance */ }
}
