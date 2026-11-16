
/* ----------------------------- Legacy Points ----------------------------- */
// The reward for everything optional. Nothing here is required to win; it all pays out.
function gainLP(G, n, why){ G.lp = (G.lp || 0) + n; G.lpLog = G.lpLog || []; G.lpLog.unshift([G.year, G.week, n, why]); if (G.lpLog.length > 40) G.lpLog.length = 40; }
function seasonLP(G){
  const t = userTeam(G), row = t.hist[t.hist.length - 1] || {};
  if (G.mode === "college") { if (row.cc) gainLP(G, 6, "a conference title"); if (/^Won .*Bowl/.test(row.post || "")) gainLP(G, 3, "a bowl win"); if (G.cfp && G.cfp.seeds.includes(t.id)) gainLP(G, 5, "making the playoff"); if (row.post === "National Champions") gainLP(G, 25, "the national championship"); }
  else { if (row.post) gainLP(G, 4, "making the playoffs"); if (row.post === "Won Pocket Bowl") gainLP(G, 25, "winning the Pocket Bowl"); }
  G.riv.forEach(r => { if ((r.a === t.id || r.b === t.id) && r.last[0] && r.last[0][0] === G.year && r.holder === t.id) gainLP(G, 2, "winning the " + r.name); });
}
const SHOP = [
  { id: "clinic", cost: 6, name: "Position coach clinic", desc: "A random position group on your team gains +1 across the board.", fx: G => { const g = pick(["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB"]), ps = rosterOf(G, G.uid).filter(p => GROUP(p.pos) === g); ps.forEach(p => tweakRatings(p, 1)); G._ovr = null; return `The ${g} room put in the work: ${ps.length} players improved.`; } },
  { id: "sci", cost: 4, name: "Sports science staff", desc: "Every injured player on your team returns two weeks sooner.", fx: G => { const ps = rosterOf(G, G.uid).filter(p => p.inj); ps.forEach(p => { p.inj -= 2; if (p.inj <= 0) delete p.inj; }); return ps.length ? `${ps.length} injured player${ps.length > 1 ? "s" : ""} moved up their return.` : "Nobody was hurt — the staff ran recovery sessions anyway."; } },
  { id: "dinner", cost: 3, name: "Team dinner", desc: "Morale boost before a big one.", fx: G => { const t = userTeam(G); t.morale = clamp((t.morale || 0) + 1.5, -3, 3); return "The locker room is buzzing."; } },
  { id: "gp", cost: 12, name: "Analytics department", desc: "A permanent game-plan edge every week (up to 3 levels).", can: G => (G.perks.gp || 0) < 3, fx: G => { G.perks.gp = (G.perks.gp || 0) + 1; return `Analytics level ${G.perks.gp}. Your fourth-down chart just got smarter.`; } },
  { id: "dev", cost: 10, name: "Player development wing", desc: "Your players improve a little faster every offseason (up to 3 levels).", can: G => (G.perks.dev || 0) < 3, fx: G => { G.perks.dev = (G.perks.dev || 0) + 1; return `Development level ${G.perks.dev}.`; } },
  { id: "pitch", mode: "college", cost: 3, name: "Recruiting trip", desc: "+4 recruiting pitches for the next Signing Day.", fx: G => { if (G.phase === "off") G.pitchLeft += 4; else G.bonusPitch = (G.bonusPitch || 0) + 4; return "Four more pitches in your pocket."; } },
  { id: "fac", mode: "college", cost: 15, name: "Facilities upgrade", desc: "+1.5 program prestige. Recruits notice.", fx: G => { const t = userTeam(G); t.prestige = clamp(t.prestige + 1.5, 30, 99); return `${t.name}'s prestige rises to ${round(t.prestige)}.`; } },
  { id: "scout", mode: "pro", cost: 3, name: "Scouting trip", desc: "Fully scout the 12 best unscouted draft prospects.", fx: G => { const ps = colPlayers(G).concat((G.draft && G.draft.pool || []).map(id => G.players[id])).filter(p => p && !G.scouted[p.id] && (p.cls >= 2 || p.dcl)).sort((a, b) => draftValue(b) - draftValue(a)).slice(0, 12); ps.forEach(p => (G.scouted[p.id] = 1)); return `Full reports filed on ${ps.length} prospects.`; } },
];
function buy(G, id){ const it = SHOP.find(x => x.id === id); if (!it || G.lp < it.cost || (it.can && !it.can(G))) return null; G.lp -= it.cost; return it.fx(G); }
// What a pro front office sees of a prospect it hasn't scouted: a fuzzy read.
function seen(G, p){
  // A college coach hasn't really seen a recruit until he visits him.
  const fog = G.mode === "pro" ? p.exp == null && p.tid !== G.uid : !!p.recruit;
  if (!fog || G.scouted[p.id]) return { ovr: p.ovr, pot: p.pot, exact: true };
  const h = (p.id * 2654435761) >>> 0, a = (h % 9) - 4, b = ((h >> 8) % 15) - 7;
  return { ovr: clamp(p.ovr + a, 30, 99), pot: clamp(Math.max(p.ovr + a, p.pot + b), 30, 99), exact: false };
}

/* ----------------------------- pick'em & predictions ----------------------------- */
function makeSlate(G){
  const w = G.week, col = G.cs.filter(g => g.w === w && !g.done && g.a >= 0), pro = G.ps.filter(g => g.w === w && !g.done);
  const heat = g => { const h = T(G, g.h), a = T(G, g.a); return (h.rank ? 30 - h.rank : 0) + (a.rank ? 30 - a.rank : 0) + (g.riv != null ? 14 : 0) + (g.post ? 40 : 0) - Math.abs(h.pw - a.pw) * .5; };
  const games = (w >= 15 ? col : col.sort((x, y) => heat(y) - heat(x)).slice(0, 5)).concat(pro.sort((x, y) => (winPct(T(G, y.h)) + winPct(T(G, y.a))) - (winPct(T(G, x.h)) + winPct(T(G, x.a)))).slice(0, w > PRO_WEEKS ? 8 : 3));
  G.slate = { w, games: games.map(g => ({ gid: g.id, pick: null })) };
}
function resolvePicks(G, w){
  const s = G.slate; if (!s || s.w !== w) return; let right = 0, made = 0;
  s.games.forEach(x => { if (x.pick == null) return; const g = gameById(G, x.gid); if (!g || !g.done) return; made++; x.ok = winnerOf(g) === x.pick; if (x.ok) { right++; G.pickRec.w++; G.pickRec.streak++; G.pickRec.best = Math.max(G.pickRec.best, G.pickRec.streak); } else { G.pickRec.l++; G.pickRec.streak = 0; } });
  if (!made) return;
  let lp = made >= 3 && right >= made * .75 ? 2 : right > made / 2 ? 1 : 0; if (made === s.games.length && right === made && made >= 3) lp += 2;
  if (lp) gainLP(G, lp, `${right}/${made} in the Week ${w} pick'em${right === made && made === s.games.length ? " (perfect slate!)" : ""}`);
  s.result = { right, made, lp }; G.lastSlate = s;
}
const seedBowlPickem = () => {};
function seedSeasonEvents(G){
  G.pending = [];
  // Preseason Heisman candidates to choose from.
  G.heisCands = colPlayers(G).filter(p => ["QB", "RB", "WR"].includes(p.pos)).map(p => [p.id, p.ovr * (p.pos === "QB" ? 1.04 : 1) + T(G, p.tid).prestige * .25]).sort((a, b) => b[1] - a[1]).slice(0, 14).map(x => x[0]);
  makeSlate(G);
}
function resolveSeasonPreds(G){
  const pr = G.preds, out = [];
  if (pr.champ != null) { if (pr.champ === G.cfp.champ) { gainLP(G, 15, "calling the national champion in August"); out.push("National champion ✓"); } else if (G.cfp.seeds.includes(pr.champ)) { gainLP(G, 3, "your title pick made the playoff"); out.push("Title pick made the playoff"); } }
  if (pr.heis != null && G.awards.col) { const i = G.awards.col.heis.findIndex(v => v.pid === pr.heis); if (i === 0) { gainLP(G, 10, "calling the Heisman winner in August"); out.push("Heisman ✓"); } else if (i > 0 && i < 5) { gainLP(G, 3, "your Heisman pick finished top five"); out.push("Heisman pick top five"); } }
  Object.keys(pr.conf || {}).forEach(cid => { if (G.confs[cid].champ === pr.conf[cid]) { gainLP(G, 2, "calling the " + G.confs[cid].name + " champion"); out.push(G.confs[cid].name + " ✓"); } });
  pr.result = out;
}

/* ----------------------------- stories ----------------------------- */
// Optional storylines. Each is offered once, sits in the inbox for a couple of weeks, and
// quietly goes away if ignored. Choices write a line onto the player's page and can chain
// into a follow-up weeks later (follow()).
const uRos = G => rosterOf(G, G.uid);
const uDepth = G => depthChart(G, G.uid);
const P_ = (G, c) => G.players[c.pid], Q_ = (G, c) => G.players[c.pid2];
function story(G, p, txt){ if (!p) return; (p.story || (p.story = [])).push([G.year, G.phase === "reg" ? G.week : 0, txt]); if (p.story.length > 12) p.story.shift(); }
function follow(G, key, ctx, weeks){ G.pending.push({ key, ctx, w: G.week + weeks }); }
const moraleUp = (G, d) => { const t = userTeam(G); t.morale = clamp((t.morale || 0) + d, -3, 3); };
const bump = (G, p, d) => { tweakRatings(p, d); G._ovr = null; };
const starOf = G => uRos(G).slice().sort((a, b) => b.ovr - a.ovr)[0];
const someStarter = (G, f) => { const d = uDepth(G), c = POS.flatMap(pos => d[pos].slice(0, STARTERS[pos])).filter(p => !p.inj && (!f || f(p))); return c.length ? pick(c) : null; };
const someBackup = (G, f) => { const d = uDepth(G), c = POS.flatMap(pos => d[pos].slice(STARTERS[pos])).filter(p => !p.inj && (!f || f(p))); return c.length ? pick(c) : null; };
const nextOpp = G => { const g = userGame(G, G.week); if (!g) return null; return g.a < 0 ? null : T(G, g.h === G.uid ? g.a : g.h); };
const col = G => G.mode === "college", school = G => userTeam(G).name, sq = G => col(G) ? school(G) : "the " + userTeam(G).nick;

const EV = {
  /* ---------- player stories, both modes ---------- */
  battle: { when: G => { const d = uDepth(G).QB; return d[1] && d[0].ovr - d[1].ovr <= 3 && G.week <= 6 ? { pid: d[0].id, pid2: d[1].id } : null; },
    title: () => "Quarterback battle", body: (G, c) => `${pname(Q_(G, c))} has been lights-out on the scout team, and the locker room is split. ${pname(P_(G, c))} has the job — for now. How do you handle the room?`,
    opts: [{ l: "Back the starter publicly", d: "Starter gains confidence", fx: (G, c) => { bump(G, P_(G, c), 1); story(G, P_(G, c), "Named the unquestioned starter after a camp battle."); story(G, Q_(G, c), "Lost a tight quarterback competition."); return `${pname(P_(G, c))} plays freer knowing the job is his (+1).`; } },
      { l: "Open competition this week", d: "Either could win it — and get better for it", fx: (G, c) => { const a = P_(G, c), b = Q_(G, c), w = chance(.5) ? a : b; bump(G, w, 2); story(G, w, "Won an open quarterback competition in practice."); follow(G, "battle2", { pid: w.id, pid2: (w === a ? b : a).id }, 3); return `${pname(w)} takes every first-team rep and grabs the job (+2).`; } },
      { l: "Give the backup a series each game", d: "Both stay sharp · +1 Legacy Point", fx: (G, c) => { bump(G, Q_(G, c), 1); gainLP(G, 1, "managing the QB room"); story(G, Q_(G, c), "Earned a package of snaps as the change-of-pace quarterback."); return `${pname(Q_(G, c))} gets a package of plays and improves (+1).`; } }] },
  battle2: { chain: true, title: () => "The other quarterback", body: (G, c) => `${pname(Q_(G, c))}, who lost the job, asks to meet. He wants to know where he stands.`,
    opts: [{ l: "Be honest: he's the backup", d: "He respects it · +2 Legacy Points", fx: (G, c) => { gainLP(G, 2, "an honest conversation"); story(G, Q_(G, c), "Stayed after an honest sit-down about his role."); return "He nods, shakes your hand, and stays ready."; } },
      { l: "Promise him a real shot next year", d: "He works harder — and remembers", fx: (G, c) => { const p = Q_(G, c); p.pot = clamp(p.pot + 2, p.ovr, 99); if (col(G)) p.stay = 1; story(G, p, "Was promised a real shot at the starting job next season."); return `${pname(p)} throws himself into the weight room (+2 potential).`; } }] },
  comeback: { when: G => { const p = uRos(G).find(p => p.bigInj === G.year - 1 && !p.inj); return p ? { pid: p.id } : null; },
    title: () => "The long road back", body: (G, c) => `A year ago ${pname(P_(G, c))} was carted off. He's cleared, but the trainers want his snaps limited. He says he's never felt better.`,
    opts: [{ l: "Trust him — full workload", d: "Big upside, some risk", fx: (G, c) => { const p = P_(G, c); if (chance(.75)) { bump(G, p, 2); story(G, p, "Returned from a season-ending injury at full speed."); return `${pname(p)} looks like himself again — better, even (+2).`; } p.inj = 3; story(G, p, "Tweaked the old injury pushing his comeback."); return `He tweaks it in practice and will miss 3 weeks.`; } },
      { l: "Ease him back", d: "Safe · +2 Legacy Points", fx: (G, c) => { gainLP(G, 2, "patience with a comeback"); bump(G, P_(G, c), 1); story(G, P_(G, c), "Worked back slowly from a season-ending injury."); return "A careful ramp-up. He's grateful by midseason (+1)."; } }] },
  mentor: { when: G => { const d = uDepth(G), pos = pick(POS.slice(0, 12)), v = d[pos].find(p => (col(G) ? p.cls === 3 : p.age >= 30)), y = d[pos].find(p => (col(G) ? p.cls === 0 : p.exp === 0) && p !== v); return v && y ? { pid: v.id, pid2: y.id } : null; },
    title: () => "Mentor and understudy", body: (G, c) => `${pname(P_(G, c))} has taken ${col(G) ? "freshman" : "rookie"} ${pname(Q_(G, c))} under his wing — extra film, extra reps after practice. He asks if they can room together on the road.`,
    opts: [{ l: "Make it official", d: "The kid develops faster", fx: (G, c) => { const y = Q_(G, c); bump(G, y, 1); y.pot = clamp(y.pot + 2, y.ovr, 99); story(G, y, `Mentored by ${pname(P_(G, c))}.`); story(G, P_(G, c), `Took ${pname(y)} under his wing.`); P_(G, c).chr = clamp(P_(G, c).chr + 8, 0, 99); return `${pname(y)} soaks it up (+1, +2 potential).`; } },
      { l: "Keep the veteran focused on himself", d: "Veteran sharpens up", fx: (G, c) => { bump(G, P_(G, c), 1); return `${pname(P_(G, c))} locks in (+1).`; } }] },
  hometown: { when: G => { const g = userGame(G, G.week); if (!g || g.a < 0) return null; const opp = T(G, g.h === G.uid ? g.a : g.h), st = opp.state || ""; const p = someStarter(G, p => st && p.home.slice(-2) === st); return p && g.h !== G.uid ? { pid: p.id, tid: opp.id } : null; },
    title: () => "Homecoming", body: (G, c) => `${pname(P_(G, c))} grew up in ${P_(G, c).home}, and this week's trip to ${tname(T(G, c.tid))} is a homecoming. He needs 40 tickets and has been quiet all week.`,
    opts: [{ l: "Name him a game captain", d: "He plays inspired", fx: (G, c) => { const p = P_(G, c); bump(G, p, 1); moraleUp(G, .6); story(G, p, `Was a game captain in his homecoming at ${T(G, c.tid).abbr}.`); return `${pname(p)} walks out for the coin toss in front of his whole family (+1).`; } },
      { l: "Tell him to treat it like any other game", d: "Steady · +1 Legacy Point", fx: (G, c) => { gainLP(G, 1, "keeping a player level"); return "He nods. Business trip."; } }] },
  slump: { when: G => { const p = someStarter(G, p => ["QB", "RB", "WR", "K"].includes(p.pos)); return p && G.week >= 4 && (userTeam(G).streak || 0) < 0 ? { pid: p.id } : null; },
    title: () => "In his own head", body: (G, c) => `${pname(P_(G, c))} hasn't looked right since the last loss. Position coaches say he's pressing.`,
    opts: [{ l: "Sit down with him one-on-one", d: "Usually works", fx: (G, c) => { const p = P_(G, c); if (chance(.7)) { bump(G, p, 1); story(G, p, "Snapped out of a midseason slump after a talk with the head man."); return `Twenty minutes in your office, and he's a different player Saturday (+1).`; } return "He says the right things. Time will tell."; } },
      { l: "Bench him for a series to send a message", d: "Risky", fx: (G, c) => { const p = P_(G, c); if (chance(.45)) { bump(G, p, 2); story(G, p, "Responded to a benching with the best stretch of his career."); return "It lights a fire. He's furious — and brilliant (+2)."; } bump(G, p, -1); moraleUp(G, -.5); story(G, p, "Was benched during a slump."); return "It backfires. He sulks, and the room notices (−1)."; } },
      { l: "Bring in a sports psychologist", d: "Costs nothing · +1 Legacy Point", fx: (G, c) => { gainLP(G, 1, "investing in a player"); P_(G, c).pot = clamp(P_(G, c).pot + 1, P_(G, c).ovr, 99); return "Slow, steady progress."; } }] },
  record: { when: G => { const p = uRos(G).map(p => [p, lineValue(p.st)]).sort((a, b) => b[1] - a[1])[0]; return G.week >= 8 && p && p[1] > 130 ? { pid: p[0].id } : null; },
    title: () => "Chasing history", body: (G, c) => `${pname(P_(G, c))} is on a historic pace, and the national media wants access — a cover shoot, a sit-down, a mic'd-up practice.`,
    opts: [{ l: "Open the doors", d: "Awards buzz, some distraction", fx: (G, c) => { const p = P_(G, c); p.hype = G.year; moraleUp(G, -.3); gainLP(G, 2, "national exposure"); story(G, p, "Became a national story during a record-chasing season."); return `${pname(p)} is on every screen in America. Voters notice.`; } },
      { l: "Protect him — no extra media", d: "Team stays locked in", fx: (G, c) => { moraleUp(G, .7); story(G, P_(G, c), "Turned down the spotlight to keep the focus on the team."); return "The team appreciates the focus."; } }] },
  fanletter: { when: G => { const p = someStarter(G, p => p.chr >= 55); return p ? { pid: p.id } : null; },
    title: () => "A letter from a young fan", body: (G, c) => `A nine-year-old in the children's hospital wrote to ${pname(P_(G, c))}. He wants to go visit on the off day — it would mean skipping treatment and film.`,
    opts: [{ l: "Let him go, and send the whole position group", d: "+2 Legacy Points, character grows", fx: (G, c) => { const p = P_(G, c); p.chr = clamp(p.chr + 12, 0, 99); gainLP(G, 2, "a hospital visit"); moraleUp(G, .5); story(G, p, "Spent an off day visiting a young fan in the hospital."); return "The photo goes everywhere. More importantly, the kid got his visit."; } },
      { l: "Have him record a video instead", d: "Small gesture", fx: (G, c) => { P_(G, c).chr = clamp(P_(G, c).chr + 4, 0, 99); return "A nice video. Back to work."; } }] },
  captain: { when: G => G.week <= 3 ? { pid: starOf(G).id, pid2: (uRos(G).slice().sort((a, b) => b.chr - a.chr)[0]).id } : null,
    title: () => "Naming captains", body: (G, c) => `The team votes Friday, but your word carries weight. ${pname(P_(G, c))} is the best player. ${pname(Q_(G, c))} is the one everyone listens to.`,
    opts: [{ l: "Push for the star", d: "He steps up", fx: (G, c) => { bump(G, P_(G, c), 1); P_(G, c).aw.push([G.year, "Team captain"]); story(G, P_(G, c), "Named a team captain."); return `${pname(P_(G, c))} wears the C (+1).`; } },
      { l: "Push for the leader", d: "Morale boost", fx: (G, c) => { moraleUp(G, 1); Q_(G, c).aw.push([G.year, "Team captain"]); story(G, Q_(G, c), "Named a team captain."); return "The right voice in the huddle. Morale up."; } },
      { l: "Stay out of it", d: "+1 Legacy Point", fx: (G, c) => { gainLP(G, 1, "trusting the locker room"); return "The players sort it out themselves."; } }] },
  practice: { when: G => G.week >= 3 ? {} : null, title: () => "Short week", body: G => `Bodies are sore and ${nextOpp(G) ? tname(nextOpp(G)) : "the next opponent"} is coming. Your coordinators disagree on the plan.`,
    opts: [{ l: "Full pads", d: "Sharper team, injury risk", fx: G => { moraleUp(G, 1); if (chance(.2)) { const p = someStarter(G); if (p) { p.inj = 2; return `A physical week — too physical. ${pname(p)} is out 2 weeks.`; } } return "A crisp, physical week. The team is ready."; } },
      { l: "Walk-throughs and recovery", d: "Injured players heal a week sooner", fx: G => { uRos(G).forEach(p => { if (p.inj) { if (--p.inj <= 0) delete p.inj; } }); return "Fresh legs for the weekend."; } },
      { l: "Extra film", d: "+1 Legacy Point", fx: G => { gainLP(G, 1, "film study"); return "The staff finds a tendency. Might matter."; } }] },
  legend: { when: G => (userTeam(G).titles > 0 || userTeam(G).hist.length > 1) ? { g: pick(["QB", "RB", "WR", "OL", "DL", "LB", "DB"]) } : {g: pick(["QB", "RB", "WR", "OL", "DL", "LB", "DB"])},
    title: () => "A legend drops by", body: (G, c) => `An all-time great from ${sq(G)}'s past is in town and offers to spend a day with the ${c.g} group.`,
    opts: [{ l: "Clear the schedule", d: "Young players in that group improve", fx: (G, c) => { const ps = uRos(G).filter(p => GROUP(p.pos) === c.g && p.age <= (col(G) ? 20 : 25)); ps.forEach(p => bump(G, p, 1)); return `${ps.length} young ${c.g}s hang on every word (+1 each).`; } },
      { l: "Have him address the whole team", d: "Morale boost", fx: G => { moraleUp(G, 1); return "You could hear a pin drop."; } }] },
  /* ---------- college only ---------- */
  walkon: { mode: "college", when: G => G.week <= 5 ? {} : null, title: () => "Open tryouts", body: G => `The student paper is pushing for open walk-on tryouts at ${school(G)}. It costs a practice.`,
    opts: [{ l: "Hold the tryout", d: "Might find someone", fx: G => { const gem = chance(.3), pos = pick(["RB", "WR", "LB", "CB", "S", "K"]), t = userTeam(G), p = addP(G, makePlayer(G, pos, gauss(colTarget(t, 0) - (gem ? 2 : 9), 3), 19, gem ? { pot: rint(80, 93) } : undefined)); p.cls = 0; p.stars = 1; p.walkOn = 1; p.enr = G.year; moveP(G, p, t.id); p.tx.push([G.year, `Walked on at ${t.name} after an open tryout`]); story(G, p, "Made the team out of an open campus tryout."); if (gem) follow(G, "walkon2", { pid: p.id }, 4); return `${pname(p)}, a ${pos} from ${p.home}, makes the roster.${gem ? " The strength coach can't stop talking about him." : ""}`; } },
      { l: "No time for that", d: "Nothing happens", fx: () => "Practice goes on as scheduled." }] },
  walkon2: { chain: true, title: () => "The walk-on", body: (G, c) => `${pname(P_(G, c))} — the tryout kid — is winning reps against scholarship players. The team wants to know if he's getting a scholarship.`,
    opts: [{ l: "Surprise him with it in front of the team", d: "Huge morale boost · +3 Legacy Points", fx: (G, c) => { const p = P_(G, c); moraleUp(G, 1.5); bump(G, p, 2); gainLP(G, 3, "a walk-on's scholarship"); p.stay = 1; story(G, p, "Was awarded a scholarship in front of the whole team."); return "The video of the team mobbing him will be shown on every broadcast this fall (+2)."; } },
      { l: "Make him earn it through the season", d: "He keeps grinding", fx: (G, c) => { P_(G, c).pot = clamp(P_(G, c).pot + 2, P_(G, c).ovr, 99); story(G, P_(G, c), "Told to keep earning it."); return "He doesn't blink (+2 potential)."; } }] },
  staygo: { mode: "college", when: G => { const p = uRos(G).filter(p => p.cls === 2 && draftValue(p) >= 76 && !p.stay).sort((a, b) => b.ovr - a.ovr)[0]; return p && G.week >= 10 ? { pid: p.id } : null; },
    title: () => "Stay or go", body: (G, c) => `${pname(P_(G, c))} is a junior with a pro grade. His family is asking you what he should do after the season.`,
    opts: [{ l: "Sell him on one more year", d: "He might stay", fx: (G, c) => { const p = P_(G, c); if (chance(.55)) { p.stay = 1; story(G, p, `Chose to return to ${school(G)} for his senior season.`); return `"Unfinished business." ${pname(p)} is coming back.`; } story(G, p, "Listened to the pitch to stay, but chose the draft."); return "He hears you out, but the money is too good."; } },
      { l: "Tell him the truth about his draft grade", d: "+3 Legacy Points — recruits' families remember", fx: (G, c) => { gainLP(G, 3, "honest draft advice"); G.bonusPitch = (G.bonusPitch || 0) + 2; story(G, P_(G, c), "Got honest draft advice from his head coach."); return "Word gets around that you put players first (+2 recruiting pitches)."; } }] },
  nil: { mode: "college", when: G => { const p = starOf(G); return p && p.cls < 3 && !p.stay ? { pid: p.id } : null; },
    title: () => "The collective calls", body: (G, c) => `A rival's collective is making noise about ${pname(P_(G, c))}. Your boosters can match it — if you ask.`,
    opts: [{ l: "Ask the boosters to step up", d: "He's locked in; you owe them one", fx: (G, c) => { const p = P_(G, c); p.stay = 1; follow(G, "booster", {}, 3); story(G, p, "Signed a major NIL deal to stay put."); return `${pname(p)} isn't going anywhere.`; } },
      { l: "Sell the program, not the paycheck", d: "+2 Legacy Points; he may still listen to offers", fx: (G, c) => { gainLP(G, 2, "culture over cash"); if (chance(.5)) P_(G, c).stay = 1; return "You make your pitch. He says he loves it here."; } }] },
  booster: { chain: true, title: () => "The favor comes due", body: G => `The booster who funded that NIL deal has thoughts about your play-calling. Many thoughts. He'd like to share them weekly.`,
    opts: [{ l: "Take the meetings", d: "Prestige up, morale down", fx: G => { const t = userTeam(G); t.prestige = clamp(t.prestige + .8, 30, 99); moraleUp(G, -.8); return "The checks keep coming. So do the texts."; } },
      { l: "Politely draw the line", d: "+2 Legacy Points", fx: G => { gainLP(G, 2, "drawing the line"); return "He's annoyed. Your staff is relieved."; } }] },
  academic: { mode: "college", when: G => { const p = someStarter(G, p => p.gpa < 2.5); return p && G.week >= 5 ? { pid: p.id } : null; },
    title: () => "Midterm trouble", body: (G, c) => `${pname(P_(G, c))} (${P_(G, c).gpa.toFixed(2)} GPA) failed a midterm and is on the edge of eligibility.`,
    opts: [{ l: "Sit him a game and get him a tutor", d: "+3 Legacy Points; he misses a week", fx: (G, c) => { const p = P_(G, c); p.inj = 1; p.gpa = Math.min(4, p.gpa + .4); gainLP(G, 3, "academics first"); story(G, p, "Sat out a game to get his grades right."); return "He sits, studies, and passes the retake."; } },
      { l: "Night tutoring, no missed time", d: "70% it works", fx: (G, c) => { const p = P_(G, c); if (chance(.7)) { p.gpa = Math.min(4, p.gpa + .25); return "He scrapes by."; } p.inj = 3; story(G, p, "Was ruled academically ineligible for three games."); return "It isn't enough. He's ineligible for 3 games."; } }] },
  gameday: { mode: "college", when: G => { const g = userGame(G, G.week), t = userTeam(G); return g && g.h === G.uid && t.rank && g.a >= 0 && T(G, g.a).rank ? { tid: g.a } : null; },
    title: () => "The pregame show is coming", body: (G, c) => `Ranked vs. ranked, and the national pregame show is setting up on your quad for ${T(G, c.tid).name}.`,
    opts: [{ l: "Lean in — pep rally, guest picker, the works", d: "Prestige and morale up", fx: G => { const t = userTeam(G); t.prestige = clamp(t.prestige + .4, 30, 99); moraleUp(G, 1); G.bonusPitch = (G.bonusPitch || 0) + 1; return "The campus is electric. Recruits on visits can't believe it."; } },
      { l: "Keep the team away from the circus", d: "+1 Legacy Point", fx: G => { gainLP(G, 1, "blocking out the noise"); return "Just another Saturday."; } }] },
  unis: { mode: "college", when: G => G.week >= 2 && G.week <= 11 ? {} : null, title: () => "Uniform reveal", body: G => `The equipment staff has three options for the big home game.`,
    opts: [{ l: "Blackout alternates", d: "Recruits love it (+2 pitches)", fx: G => { G.bonusPitch = (G.bonusPitch || 0) + 2; return "The reveal video does numbers."; } },
      { l: "Throwbacks", d: "Morale and a little prestige", fx: G => { moraleUp(G, .6); userTeam(G).prestige = clamp(userTeam(G).prestige + .2, 30, 99); return "The old guard sends thank-you notes."; } },
      { l: "The classics, as always", d: "+1 Legacy Point", fx: G => { gainLP(G, 1, "tradition"); return "If it isn't broke."; } }] },
  rivaltalk: { mode: "college", when: G => { const g = userGame(G, G.week); return g && g.riv != null ? { riv: g.riv } : null; },
    title: (G, c) => G.riv.find(r => r.i === c.riv).name + " week", body: (G, c) => `The other sideline's coach told reporters your program "hasn't been relevant in this rivalry for years." The ${G.riv.find(r => r.i === c.riv).trophy} is on the line.`,
    opts: [{ l: "Fire back at the podium", d: "Big morale swing either way", fx: G => { if (chance(.6)) { moraleUp(G, 1.5); return "Your players loved it. They're ready to run through a wall."; } moraleUp(G, -.5); return "It reads as rattled. The team is tight."; } },
      { l: "Tape the quote to every locker", d: "Morale up", fx: G => { moraleUp(G, 1); return "No words needed."; } },
      { l: "Say nothing", d: "+1 Legacy Point", fx: G => { gainLP(G, 1, "staying above it"); return "You let the game do the talking."; } }] },
  portalrumor: { mode: "college", when: G => { const p = someBackup(G, p => p.ovr >= 68 && p.cls < 3 && !p.stay); return p && G.week >= 8 ? { pid: p.id } : null; },
    title: () => "Portal whispers", body: (G, c) => `${pname(P_(G, c))}, a talented backup, has been liking other schools' posts. His position coach thinks he's gone after the season.`,
    opts: [{ l: "Lay out his path to starting", d: "He stays", fx: (G, c) => { const p = P_(G, c); p.stay = 1; p.pot = clamp(p.pot + 1, p.ovr, 99); story(G, p, "Stayed out of the portal after seeing a path to the starting job."); return "He just needed to hear it."; } },
      { l: "Let him make his own call", d: "+1 Legacy Point", fx: G => { gainLP(G, 1, "respecting a player's choice"); return "Whatever he decides, the door stays open."; } }] },
  /* ---------- pro only ---------- */
  holdout: { mode: "pro", when: G => { const p = uRos(G).filter(p => p.c && p.c.yrs <= 1 && p.ovr >= 82).sort((a, b) => b.ovr - a.ovr)[0]; return p ? { pid: p.id } : null; },
    title: () => "Contract year", body: (G, c) => `${pname(P_(G, c))} is in the last year of his deal and his agent is going public. He wants an extension before he takes another snap.`,
    opts: [{ l: "Extend him now", d: "+3 years at a 12% raise", fx: (G, c) => { const p = P_(G, c); p.c = { amt: +(askOf(G, p) * 1.12).toFixed(2), yrs: 4 }; moraleUp(G, .8); story(G, p, "Signed a contract extension after a public standoff."); p.tx.push([G.year, `Signed an extension with the ${userTeam(G).nick}`]); return `Done: 4 years, ${money(p.c.amt)} per.`; } },
      { l: "Hold firm until the offseason", d: "He might sit", fx: (G, c) => { const p = P_(G, c); if (chance(.4)) { p.inj = 2; story(G, p, "Sat out two games in a contract dispute."); return "He 'tweaks a hamstring.' Two weeks."; } bump(G, p, 1); story(G, p, "Played through a contract dispute with a chip on his shoulder."); return "He plays angry. It's working (+1)."; } }] },
  rookiewall: { mode: "pro", when: G => { const p = someStarter(G, p => isRookie(G, p)); return p && G.week >= 9 ? { pid: p.id } : null; },
    title: () => "The rookie wall", body: (G, c) => `${pname(P_(G, c))} has never played this many games in a season. The tape shows tired legs.`,
    opts: [{ l: "Cut his practice reps", d: "He finishes strong", fx: (G, c) => { bump(G, P_(G, c), 1); story(G, P_(G, c), "Pushed through the rookie wall."); return "Fresh legs in December (+1)."; } },
      { l: "Pair him with a veteran for the stretch run", d: "+potential", fx: (G, c) => { P_(G, c).pot = clamp(P_(G, c).pot + 2, P_(G, c).ovr, 99); return "He learns how pros take care of their bodies (+2 potential)."; } }] },
  lastride: { mode: "pro", when: G => { const p = uRos(G).filter(p => p.age >= 33 && p.ovr >= 76)[0]; return p ? { pid: p.id } : null; },
    title: () => "One last ride", body: (G, c) => `${pname(P_(G, c))}, ${P_(G, c).age}, tells you privately this is his final season. He doesn't want a farewell tour — unless you think it would help the team.`,
    opts: [{ l: "Keep it between you", d: "He plays free", fx: (G, c) => { bump(G, P_(G, c), 1); story(G, P_(G, c), "Quietly decided this season would be his last."); return "Nothing left to save it for (+1)."; } },
      { l: "Let the team rally around him", d: "Morale up · +2 Legacy Points", fx: (G, c) => { moraleUp(G, 1.2); gainLP(G, 2, "a proper send-off"); story(G, P_(G, c), "Announced his farewell season, and the locker room rallied."); return `"Win it for ${P_(G, c).fn}" is on every whiteboard.`; } }] },
  fanfest: { mode: "pro", when: () => ({}), title: () => "Owner's request", body: G => `Ownership wants the whole roster at a season-ticket-holder event on the off day.`,
    opts: [{ l: "Everybody goes", d: "+2 Legacy Points, slight fatigue", fx: G => { gainLP(G, 2, "fan fest"); moraleUp(G, -.2); return "Autographs for four hours. The owner is thrilled."; } },
      { l: "Send the rookies", d: "+1 Legacy Point", fx: G => { gainLP(G, 1, "fan fest"); return "The veterans rest. The rookies sign."; } }] },
};
function spawnEvent(G, key, ctx){
  const d = EV[key]; if (!d) return;
  try { G.events.push({ id: ++G.gid, key, w: G.week + 2, y: G.year, ctx, title: d.title(G, ctx), body: d.body(G, ctx), opts: d.opts.map(o => ({ l: o.l, d: o.d })) }); G.usedEv.push(key); } catch (e) {}
}
function weeklyEvents(G){
  makeSlate(G);
  G.pending = (G.pending || []).filter(x => { if (x.w > G.week) return true; if (!x.ctx.pid || (G.players[x.ctx.pid] && G.players[x.ctx.pid].tid === G.uid)) spawnEvent(G, x.key, x.ctx); return false; });
  if (G.events.filter(e => !e.done).length >= 3 || G.week > 15 || !chance(.55)) return;
  const keys = shuffle(Object.keys(EV).filter(k => !EV[k].chain && !G.usedEv.includes(k) && (!EV[k].mode || EV[k].mode === G.mode)));
  for (const k of keys) { let c = null; try { c = EV[k].when(G); } catch (e) {} if (c) { spawnEvent(G, k, c); break; } }
}
function expireEvents(G, off){ G.events = G.events.filter(e => !off && (e.done ? e.w >= G.week - 2 : e.w >= G.week)); }
function chooseEvent(G, id, i){
  const ev = G.events.find(e => e.id === id); if (!ev || ev.done) return;
  if (ev.key === "job") {
    const jobs = ev.ctx.jobs;
    if (i < jobs.length) { const nt = takeJob(G, jobs[i]); ev.result = nt.pro ? `You're the new general manager of the ${nt.city} ${nt.nick}.` : `You're the new head coach at ${nt.name}.`; }
    else { gainLP(G, 4, "loyalty"); G.coach.sec = clamp((G.coach.sec || 60) + 8, 0, 100); ev.result = "You're staying. The administration announces a contract extension."; }
    delete G.coach.fired;
  } else if (ev.key === "realign") {
    const t = userTeam(G); if (i === 0) { moveConf(G, t, ev.ctx.to); t.prestige = clamp(t.prestige + 2, 0, 99); ev.result = `${t.name} joins the ${G.confs[ev.ctx.to].name} next season.`; } else ev.result = "You're staying where you are.";
  } else ev.result = EV[ev.key].opts[i].fx(G, ev.ctx);
  ev.done = true; ev.pick = i;
}
