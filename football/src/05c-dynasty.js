
/* =========================================================================
   Game day (weather, crowd, game plan, key calls) and the long game
   (staff, NIL, job security, redshirts, facilities, realignment, deadline
   offers, all-star game, what-if replays, greatest teams)
   ========================================================================= */

/* ----------------------------- game day ----------------------------- */
const hk = (id, k) => { const x = Math.sin((id + 1) * 12.9898 + (hashSeed(k) % 9973) * 78.233) * 43758.5453; return x - Math.floor(x); };   // 0..1, stable per id + key
const COLD = ["MI", "WI", "MN", "NY", "OH", "PA", "IL", "IN", "IA", "NE", "CO", "UT", "WY", "ID", "MT", "MA", "CT", "NJ", "WV", "KS", "MO", "SD", "ND", "WA", "OR"];
const WX_NAME = { rain: ["🌧️", "Rain", "Wet ball: more fumbles, fewer completions"], wind: ["💨", "High wind", "Long kicks and deep throws suffer"], snow: ["❄️", "Snow", "Run-first weather: passing and kicking are harder"] };
// Deterministic per game, so the forecast on the matchup card is what the game is played in.
function weatherFor(G, g){
  if (g.wx !== undefined && g.done) return g.wx || "";
  const H = T(G, g.h); if (!H) return "";
  const r = hk(g.id * 31 + G.year, "wx"), dome = H.pro && hk(H.id, "dome") < .3; if (dome) return "";
  const cold = H.pro ? hk(H.id, "cold") < .45 : COLD.includes(H.state), late = g.w >= (H.pro ? 11 : 10);
  if (cold && late && r < .2) return "snow"; if (r < .13 + (cold ? 0 : .02)) return "rain"; if (r > .9) return "wind"; return "";
}
const crowdOf = (G, H) => H.fcs ? 0 : clamp(H.pro ? .55 + hk(H.id, "crowd") * .45 : (H.prestige - 40) / 55, .1, 1) + (isUser(G, H.id) ? ((G.fac || {}).stad || 0) * .08 : 0);
const OC_SCHEMES = { "Air Raid": .8, "Pro Style": .1, "Spread Option": -.25, "Ground & Pound": -.8 }, DC_SCHEMES = { "Blitz-Heavy": .8, "4-3 Base": 0, "Cover 2 Shell": -.7 };
const defaultPlan = G => ({ pass: G.staff && G.staff.oc ? OC_SCHEMES[G.staff.oc.scheme] || 0 : 0, tempo: 0, blitz: G.staff && G.staff.dc ? DC_SCHEMES[G.staff.dc.scheme] || 0 : 0, fourth: 0 });
function planOf(G, t){
  if (!t || t.fcs) return {};
  if (isUser(G, t.id)) return Object.assign(defaultPlan(G), G.plan || {});
  const h = k => (hk(hashSeed(t.coach ? t.coach.name : t.id) % 99991, k) - .5) * 1.2; return { pass: h("p"), tempo: h("t") * .6, blitz: h("b"), fourth: h("f") * .5 };
}
function gameOpts(G, g, extra){ const [H, A] = gameTeams(G, g); return Object.assign({ neutral: g.neutral, wx: weatherFor(G, g), crowd: crowdOf(G, H), plan: [planOf(G, H), planOf(G, A)] }, extra || {}); }
// Where each side has the edge, for the matchup card.
function matchupEdges(G, g){
  const [H, A] = gameTeams(G, g), me = isUser(G, H.id) ? H : A, opp = me === H ? A : H, a = lineup(G, me, 0), b = lineup(G, opp, 0);
  return [["Your pass game vs their pass defense", a.passOff - b.passDef], ["Your run game vs their run defense", a.runOff - b.runDef], ["Their pass game vs your pass defense", a.passDef - b.passOff], ["Their run game vs your run defense", a.runDef - b.runOff]].map(([l, v]) => ({ l, v: round(v) }));
}
// Play the user's game now, stopping whenever a fourth-down or two-point call is theirs to make.
// The same seed is replayed with one more answer each time, so earlier plays never change.
function coachGame(G, g, calls){
  const [H, A] = gameTeams(G, g), keep = _rng; if (!g._seed) g._seed = (Math.random() * 2147483647) | 0;
  _rng = mulberry32(g._seed);
  try { const r = simGame(G, H, A, gameOpts(G, g, { pbp: true, user: isUser(G, g.h) ? 0 : 1, calls: (calls || []).slice(), ask: true })); _rng = keep; return { r }; }
  catch (e) { _rng = keep; if (e && e._need) return { need: e._need }; throw e; }
}
function finishCoached(G, g, r){ const keep = G._wk; G._wk = []; playGame(G, g, r); G._wkPre = G._wk; G._wk = keep; delete g._seed; }

/* ----------------------------- coaching staff ----------------------------- */
const STAFF_ROLES = G => [["oc", "Offensive coordinator"], ["dc", "Defensive coordinator"], G.mode === "pro" ? ["sc", "Scouting director"] : ["rc", "Recruiting coordinator"]];
function makeStaff(G, role, q){ return { name: pick(FIRST) + " " + pick(LAST), age: rint(31, 62), ovr: clamp(round(gauss(q, 7)), 45, 96), scheme: role === "oc" ? pick(Object.keys(OC_SCHEMES)) : role === "dc" ? pick(Object.keys(DC_SCHEMES)) : "", since: G.year }; }
function staffQuality(G){ const t = userTeam(G); return t.pro ? 68 + ((t.hist[t.hist.length - 1] || { w: 8 }).w - 8) * .8 : 48 + t.prestige * .3; }
function ensureStaff(G){
  G.staff = G.staff || {}; const q = staffQuality(G);
  STAFF_ROLES(G).forEach(([k]) => { if (!G.staff[k]) G.staff[k] = makeStaff(G, k, q); });
  ["rc", "sc"].forEach(k => { if (!STAFF_ROLES(G).some(r => r[0] === k)) delete G.staff[k]; });
  if (!G.staffPool) staffMarket(G);
}
function staffMarket(G){ const q = staffQuality(G) + 3; G.staffPool = {}; STAFF_ROLES(G).forEach(([k]) => (G.staffPool[k] = Array.from({ length: 4 }, () => makeStaff(G, k, q)).sort((a, b) => b.ovr - a.ovr))); G.staffHired = {}; }
function hireStaff(G, role, i){ const c = G.staffPool[role][i]; if (!c || G.staffHired[role]) return false; const old = G.staff[role]; G.staff[role] = c; c.since = G.year + (G.phase === "off" ? 1 : 0); G.staffPool[role].splice(i, 1); G.staffHired[role] = 1; news(G, `${userTeam(G).pro ? "The " + userTeam(G).nick : userTeam(G).name} hire${userTeam(G).pro ? "" : "s"} ${c.name} as ${STAFF_ROLES(G).find(r => r[0] === role)[1].toLowerCase()}${old ? ", replacing " + old.name : ""}.`, "coach", G.uid); return true; }
const staffBonus = (G, k) => G.staff && G.staff[k] ? Math.max(0, round((G.staff[k].ovr - 62) / 7)) : 0;
// Offseason: coordinators age and grow, and the good ones on winning teams get head jobs.
function staffOffseason(G){
  ensureStaff(G); const t = userTeam(G), wp = winPct(t);
  STAFF_ROLES(G).forEach(([k, label]) => { const c = G.staff[k]; c.age++; c.ovr = clamp(c.ovr + (c.age < 50 ? rint(0, 2) : rint(-1, 1)), 45, 97);
    if (k !== "rc" && k !== "sc" && c.ovr >= 80 && wp >= .68 && chance(.4)) { const open = (G.openJobs || []).map(id => T(G, id)).filter(x => x && !isUser(G, x.id)), to = open.length ? pick(open) : null;
      if (to) { to.coach = { name: c.name, age: c.age, ovr: clamp(c.ovr - 6, 50, 92), w: 0, l: 0, ch: 0, aw: [], since: G.year + 1 }; news(G, `Your ${label.toLowerCase()} ${c.name} is the new head coach at ${to.name}. You'll need a replacement.`, "coach", G.uid); }
      else news(G, `Your ${label.toLowerCase()} ${c.name} leaves for a head coaching job. You'll need a replacement.`, "coach", G.uid);
      G.staff[k] = makeStaff(G, k, staffQuality(G) - 6); G.staff[k].interim = 1; }
    else if (c.age >= 68 && chance(.5)) { news(G, `${label} ${c.name} retires.`, "coach", G.uid); G.staff[k] = makeStaff(G, k, staffQuality(G) - 6); G.staff[k].interim = 1; } });
  staffMarket(G);
}

/* ----------------------------- NIL (college) ----------------------------- */
function nilReset(G){ const t = userTeam(G); if (t.pro) { G.nil = null; return; } const b = round(700 + t.prestige * 42 + ((t.hist[t.hist.length - 1] || { w: 6 }).w) * 70 + ((G.fac || {}).recruit || 0) * 250); G.nil = { budget: b, left: b, deals: {} }; }
const nilPull = (p, amt) => amt ? 5 * Math.log2(1 + amt / 100) / (1 + Math.max(0, (p.stars || 3) - 3) * .25) : 0;
function nilOffer(G, p, amt){ const n = G.nil; if (!n || n.left < amt) return false; n.left -= amt; n.deals[p.id] = (n.deals[p.id] || 0) + amt; return true; }
const retainCost = p => round((Math.max(0, p.ovr - 60) * 28 + 120) / 10) * 10;
function retainPlayer(G, p){ const c = retainCost(p), n = G.nil; if (!n || n.left < c || !p.portal) return false; n.left -= c; delete p.portal; p.stay = 1; G.portal = (G.portal || []).filter(id => id !== p.id); p.tx.push([G.year, `Pulled his name from the portal to stay at ${T(G, p.tid).name}`]); news(G, `${p.pos} ${pname(p)} withdraws from the portal and stays.`, "portal", p.tid); return true; }

/* ----------------------------- job security, offers, firing ----------------------------- */
function coachRep(G){ const c = G.coach, g = c.w + c.l; return (g ? c.w / g : .5) * 60 + Math.min(20, c.hist.length * 1.5) + c.hist.filter(r => /National Champions|Won Pocket Bowl/.test(r.note || "")).length * 8 + c.hist.filter(r => r.cc).length * 2; }
function takeJob(G, tid){
  const old = userTeam(G), nt = T(G, tid); old.coach = makeCoach(G, old.pro ? 68 : 34 + old.prestige * .5); old.coach.since = G.year + 1;
  G.uid = nt.id; G.mode = nt.pro ? "pro" : "college"; nt.coach = { name: G.coach.name, age: 45, ovr: 70, w: 0, l: 0, ch: 0, aw: [], since: G.year + 1 };
  G.pitches = {}; G.dc = {}; G.plan = null; G.staff = null; G.staffPool = null; G.offers = []; G.coach.sec = 62; G.coach.at = G.year + 1; delete G.coach.fired; ensureStaff(G); nilReset(G); G._ros = null;
  news(G, `${G.coach.name} leaves ${old.pro ? "the " + old.nick : old.name} to take over ${nt.pro ? "the " + nt.city + " " + nt.nick : "at " + nt.name}.`, "coach", nt.id);
  return nt;
}
// End of season: the seat warms or cools against what the job expects, then the phone rings (or the AD does).
function jobReview(G){
  const t = userTeam(G), c = G.coach, row = t.hist[t.hist.length - 1] || {}, wp = (row.w + row.l) ? row.w / (row.w + row.l) : .5, exp = t.pro ? .5 : (t.prestige - 45) / 52 * .62 + .2;
  const title = /National Champions|Won Pocket Bowl/.test(row.post || ""), bonus = title ? 25 : t.pro ? (row.post ? 8 : 0) : (row.cc ? 8 : 0) + (/Won/.test(row.post || "") ? 3 : 0);
  c.sec = clamp(round((c.sec == null ? 62 : c.sec) + (wp - exp) * (t.pro ? 75 : 95) + bonus), 0, 100); c.at = c.at || G.year;
  const years = G.year - c.at + 1, rep = coachRep(G), nm = x => x.pro ? "the " + x.city + " " + x.nick : x.name;
  G.events = G.events.filter(e => e.key !== "job");
  if (c.sec <= 8 && years >= 3) {
    const pool = t.pro ? G.pro.filter(x => x.id !== t.id).sort((a, b) => winPct(a) - winPct(b)).slice(0, 2).concat(G.col.filter(x => x.prestige >= 55 && x.prestige <= 72).sort(() => _rng() - .5).slice(0, 2))
      : G.col.filter(x => x.id !== t.id && x.prestige < t.prestige - 6 && x.prestige > t.prestige - 30).sort(() => _rng() - .5).slice(0, 3);
    if (pool.length) { c.fired = pool.map(x => x.id); news(G, `${t.pro ? "The " + t.nick : t.name} ${t.pro ? "fire" : "fires"} ${c.name} after a ${row.w}-${row.l} season.`, "coach", t.id);
      G.events.push({ id: ++G.gid, key: "job", w: 99, title: "You've been let go", body: `${t.pro ? "Ownership" : "The administration"} has decided to make a change after ${years} seasons. These jobs are open to you — pick one before the offseason moves on, or you'll land at the first.`, ctx: { jobs: c.fired, fired: 1 }, opts: pool.map(j => ({ l: "Take over " + nm(j), d: j.pro ? `Pro · ${j.w}-${j.l} last season` : `${G.confs[j.conf].name} · prestige ${round(j.prestige)}` })) }); }
    return;
  }
  const score = coachScore(t, t.pro), jobs = [];
  if (!t.pro) (G.openJobs || []).map(id => T(G, id)).filter(x => x.prestige > t.prestige + 3 && x.prestige < t.prestige + 12 + score * 5).sort((a, b) => b.prestige - a.prestige).slice(0, 2).forEach(x => jobs.push(x));
  if (rep >= (t.pro ? 62 : 58) && (score >= 1.5 || t.pro && wp >= .65)) ((G.openPro || []).length ? G.openPro : G.pro.slice().sort((a, b) => winPct(a) - winPct(b)).slice(0, 2).map(x => x.id)).map(id => T(G, id)).filter(x => x && x.id !== t.id).slice(0, t.pro ? 2 : 1).forEach(x => jobs.push(x));
  if (!jobs.length || (!t.pro && score < 1.5 && !jobs.some(j => j.pro))) return;
  G.events.push({ id: ++G.gid, key: "job", w: 99, title: "Job offers", body: `Your ${row.w}-${row.l} season got noticed. ${jobs.map(nm).join(", ")} ${jobs.length > 1 ? "have" : "has"} called. Taking a job moves you there for good — your record and trophies come with you${jobs.some(j => j.pro !== t.pro) ? ", and a move between college and the pros changes the whole job" : ""}.`, ctx: { jobs: jobs.map(j => j.id) }, opts: [...jobs.map(j => ({ l: "Take over " + nm(j), d: j.pro ? "Pro general manager · " + j.w + "-" + j.l + " last season" : `${G.confs[j.conf].name} · prestige ${round(j.prestige)}` })), { l: "Stay " + (t.pro ? "with the " + t.nick : "at " + t.name), d: "Loyalty: +4 Legacy Points and a safer seat" }] });
}
const seatLabel = s => s >= 80 ? ["Untouchable", "#4ade80"] : s >= 60 ? ["Secure", "#a3e635"] : s >= 40 ? ["Steady", "#fbbf24"] : s >= 20 ? ["Warm seat", "#fb923c"] : ["Hot seat", "#f87171"];

/* ----------------------------- redshirts + medical ----------------------------- */
const canRedshirt = (G, p) => p.cls != null && !p.rsd && p.tid === G.uid && G.phase === "reg" && (p.st.g || 0) <= 4 && G.week <= 10;
function toggleRedshirt(G, p){ if (p.rs === G.year) { delete p.rs; } else if (canRedshirt(G, p)) p.rs = G.year; G._ros = null; }
const INJ_PARTS = ["hamstring", "ankle", "knee", "shoulder", "concussion", "groin", "foot", "wrist", "back", "calf"];
const injPart = (G, p) => (p.inj >= 10 ? ["torn ACL", "broken leg", "torn Achilles", "shoulder surgery"] : INJ_PARTS)[Math.floor(hk(p.id + G.year * 7 + (p.inj >= 10 ? 1 : 0), "inj") * (p.inj >= 10 ? 4 : INJ_PARTS.length))];

/* ----------------------------- facilities ----------------------------- */
const FAC = G => [["train", "Training complex", "Young players develop faster"], ["med", "Medical centre", "Injuries heal 10% quicker per level"], ["stad", "Stadium", "A bigger home-field edge and louder crowd"], G.mode === "pro" ? ["recruit", "Scouting department", "+3 prospect interviews per level"] : ["recruit", "Recruiting centre", "Recruits lean your way; bigger NIL pot"]];
const FAC_COST = [3, 5, 8, 12, 16];
function buyFac(G, k){ G.fac = G.fac || {}; const lv = G.fac[k] || 0; if (lv >= 5 || (G.lp || 0) < FAC_COST[lv]) return false; G.lp -= FAC_COST[lv]; G.fac[k] = lv + 1; news(G, `Construction finishes on a level-${lv + 1} ${FAC(G).find(f => f[0] === k)[1].toLowerCase()}.`, "off", G.uid); return true; }

/* ----------------------------- conference realignment ----------------------------- */
function confStrength(G, cid){ return avgOf(G.col.filter(t => t.conf === cid), t => t.prestige, 0); }
function moveConf(G, t, to){ const from = t.conf; t.conf = to; (G.realign = G.realign || []).unshift({ y: G.year + 1, tid: t.id, from, to }); news(G, `REALIGNMENT: ${t.name} will leave the ${G.confs[from].name} for the ${G.confs[to].name} next season.`, "off", t.id); }
function realignment(G){
  if (G.hist.length < 2 || !chance(.14)) return;
  const confs = CONF_ORDER.filter(c => c !== "IND").map(c => [c, confStrength(G, c), G.col.filter(t => t.conf === c).length]).sort((a, b) => b[1] - a[1]);
  const to = confs.slice(0, 4).filter(c => c[2] < 18).sort((a, b) => a[2] - b[2])[0]; if (!to) return;
  const cand = G.col.filter(t => t.conf !== to[0] && confStrength(G, t.conf) < to[1] - 7 && t.prestige >= to[1] - 12 && G.col.filter(x => x.conf === t.conf).length > 8).sort((a, b) => b.prestige - a.prestige).slice(0, 3);
  const t = cand.length ? pick(cand) : null; if (!t) return;
  if (isUser(G, t.id)) G.events.push({ id: ++G.gid, key: "realign", w: 99, title: "A bigger conference calls", body: `The ${G.confs[to[0]].full} has invited ${t.name} to join next season. Tougher schedule, bigger stage — and a prestige bump for making the jump.`, ctx: { to: to[0] }, opts: [{ l: "Accept the invitation", d: "Move to the " + G.confs[to[0]].name }, { l: "Stay put", d: "Keep your rivals and your conference" }] });
  else moveConf(G, t, to[0]);
}

/* ----------------------------- trade deadline: offers come to you ----------------------------- */
function deadlineOffers(G){
  if (G.mode !== "pro" || !tradeOpen(G)) { G.offers = []; return; }
  G.offers = (G.offers || []).filter(o => o.w >= G.week && G.players[o.pid] && G.players[o.pid].tid === G.uid);
  const mine = rosterOf(G, G.uid).filter(p => p.c && p.pos !== "K" && p.pos !== "P" && playerVal(p) >= 4), near = TRADE_DEADLINE - G.week;
  shuffle(G.pro.filter(t => t.id !== G.uid && winPct(t) >= .45)).slice(0, near <= 1 ? 4 : 2).forEach(t => {
    const d = depthChart(G, t.id), want = mine.filter(p => (d[p.pos][STARTERS[p.pos] - 1] || { ovr: 0 }).ovr < p.ovr - 2 && capRoom(G, t.id) >= p.c.amt && !G.offers.some(o => o.pid === p.id && o.tid === t.id)).sort((a, b) => playerVal(b) - playerVal(a)).slice(0, 4), p = want.length ? pick(want) : null;
    if (!p || G.offers.length >= 5) return;
    const target = playerVal(p) * (.82 + _rng() * .32), picks = teamPicks(G, t.id).sort((a, b) => b.v - a.v), get = []; let v = 0;
    for (const a of picks) { if (get.length < 3 && v + a.v <= target) { get.push({ rd: a.rd, orig: a.orig, label: a.label, v: a.v }); v += a.v; } }
    if (!get.length || v < playerVal(p) * .6) return;
    G.offers.push({ id: ++G.gid, tid: t.id, pid: p.id, get, v: +v.toFixed(1), w: Math.min(TRADE_DEADLINE, G.week + 2) });
    news(G, `TRADE CALL: the ${t.nick} offer ${get.map(a => a.label.replace(/ \(via.*/, "")).join(" + ")} for ${p.pos} ${pname(p)}.`, "fa", t.id);
  });
  if (chance(.6)) { const star = pick(proPlayers(G).filter(p => p.ovr >= 86 && p.age >= 28 && !isUser(G, p.tid) && winPct(T(G, p.tid)) < .4).slice(0, 12)); if (star) news(G, `RUMOUR: the ${T(G, star.tid).nick} are listening on ${star.pos} ${pname(star)} as the deadline nears.`, "fa", star.tid); }
}
function acceptOffer(G, id){
  const o = (G.offers || []).find(x => x.id === id), p = o && G.players[o.pid]; if (!o || !p || p.tid !== G.uid) return false;
  const have = teamPicks(G, o.tid), get = o.get.map(a => have.find(b => b.rd === a.rd && b.orig === a.orig)).filter(Boolean); if (get.length !== o.get.length) { G.offers = G.offers.filter(x => x.id !== id); return false; }
  doTrade(G, G.uid, o.tid, [{ p }], get); G.offers = G.offers.filter(x => x.id !== id && x.pid !== o.pid); return true;
}

/* ----------------------------- all-star game ----------------------------- */
function allStarGame(G){
  const A = G.awards.pro; if (!A || !A.pb || A.asg) return;
  const str = c => avgOf(A.pb[c] || [], r => (G.players[r.pid] || { ovr: 80 }).ovr, 80), [c1, c2] = PRO_CONFS, d = (str(c1) - str(c2)) * .8;
  let s1 = Math.max(3, round(gauss(27 + d, 8))), s2 = Math.max(3, round(gauss(27 - d, 8))); if (s1 === s2) s1 += 3;
  const win = s1 > s2 ? c1 : c2, pool = (A.pb[win] || []).map(r => G.players[r.pid]).filter(p => p && ["QB", "RB", "WR", "TE", "DE", "LB", "CB"].includes(p.pos)), mvp = pool.length ? wpick(pool.map(p => [p, Math.pow(p.ovr / 80, 6) * (isOff(p.pos) ? 2 : 1)])) : null;
  const line = !mvp ? "" : mvp.pos === "QB" ? `${rint(11, 19)}/${rint(20, 26)}, ${rint(160, 290)} yds, ${rint(2, 4)} TD` : mvp.pos === "RB" ? `${rint(8, 14)} car, ${rint(70, 140)} yds, ${rint(1, 2)} TD` : isOff(mvp.pos) ? `${rint(5, 9)} rec, ${rint(90, 170)} yds, ${rint(1, 3)} TD` : `${rint(4, 8)} tkl, ${rint(1, 3)} sck, ${rint(0, 1)} INT`;
  A.asg = { sc: [s1, s2], confs: [c1, c2], mvp: mvp ? Object.assign(ref(G, mvp), { line }) : null };
  if (mvp) { mvp.aw.push([G.year, "All-Star Game MVP"]); news(G, `The ${win} wins the all-star game ${Math.max(s1, s2)}–${Math.min(s1, s2)}. ${mvp.pos} ${pname(mvp)} is the MVP.`, "pro", mvp.tid); }
}

/* ----------------------------- combine board ----------------------------- */
function combineBoard(G){
  const ps = prospects(G).slice(0, 220).map(p => ({ p, c: combine(p) }));
  const top = (k, asc, f) => ps.filter(x => !f || f(x.p)).slice().sort((a, b) => asc ? a.c[k] - b.c[k] : b.c[k] - a.c[k]).slice(0, 8);
  return { forty: top("forty", true, p => !["OT", "OG", "C", "DT", "K", "P"].includes(p.pos)), bench: top("bench", false), vert: top("vert", false), cone: top("cone", true, p => p.pos !== "K" && p.pos !== "P"), bigFast: top("forty", true, p => ["OT", "OG", "C", "DT", "DE"].includes(p.pos)) };
}

/* ----------------------------- what if? ----------------------------- */
// Replay the user's finished games many times with today's rosters. Changes nothing.
function whatIf(G, n){
  const games = [...G.cs, ...G.ps].filter(g => g.done && !g.post && (g.h === G.uid || g.a === G.uid)).sort((a, b) => a.w - b.w); if (!games.length) return null;
  const wins = new Array(n).fill(0), rows = games.map(g => { const [H, A] = gameTeams(G, g), home = g.h === G.uid; let w = 0, pf = 0, pa = 0;
    for (let k = 0; k < n; k++) { const r = simGame(G, H, A, { neutral: g.neutral, noInj: true, wx: g.wx || "", crowd: crowdOf(G, H), plan: [planOf(G, H), planOf(G, A)] }), me = r.sc[home ? 0 : 1], them = r.sc[home ? 1 : 0]; if (me > them) { w++; wins[k]++; } pf += me; pa += them; }
    return { gid: g.id, w: g.w, opp: home ? A : H, home, won: (home ? g.hs : g.as) > (home ? g.as : g.hs), us: home ? g.hs : g.as, them: home ? g.as : g.hs, p: w / n, pf: pf / n, pa: pa / n }; });
  const dist = new Array(games.length + 1).fill(0); wins.forEach(w => dist[w]++);
  const actual = rows.filter(r => r.won).length, exp = sum(rows, r => r.p);
  return { n, rows, dist, actual, exp, better: wins.filter(w => w > actual).length / n, worse: wins.filter(w => w < actual).length / n, perfect: dist[games.length] / n };
}

/* ----------------------------- greatest teams ----------------------------- */
function greatestTeams(G, pro, n){
  const rows = []; (pro ? G.pro : G.col).forEach(t => t.hist.forEach(h => { const g = Math.max(1, h.w + h.l), champ = /National Champions|Won Pocket Bowl/.test(h.post || ""), ru = /runner-up|Lost Pocket Bowl/.test(h.post || "");
    rows.push({ t, h, champ, s: h.w / g * 50 + ((h.pf || 0) - (h.pa || 0)) / g * 1.1 + (champ ? 22 : ru ? 8 : 0) + (h.cc ? 4 : 0) + (h.rk ? (26 - h.rk) * .5 : 0) + (!pro ? (t.prestige - 60) * .05 : 0) }); }));
  return rows.sort((a, b) => b.s - a.s).slice(0, n || 25);
}
