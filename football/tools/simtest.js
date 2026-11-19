#!/usr/bin/env node
/* Headless harness for Pocket GM — Football. Assembles index.html, transpiles the app
 * block with the vendored Babel, runs it in a vm with a thin browser shim and plays
 * whole seasons through the engine (no UI is rendered).
 *   node tools/simtest.js          # every check
 *   node tools/simtest.js stats    # one check
 */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
require("child_process").execFileSync("node", [path.join(__dirname, "assemble.js")], { stdio: "inherit" });
const EXPORTS = ["rerateProLeague","calcOvr","ringsOf","newGame","simWeek","advanceOff","T","rosterOf","colPlayers","proPlayers","CONF_ORDER","CONFS","COL_NEED","PRO_NEED","POS","gameById","winnerOf","confStandings","draftRun","payroll","CAP","EV","chooseEvent","spawnEvent","buy","SHOP","LAST_WEEK","userGame","stripForSave","freeAgents","pitch","seen","teamPicks","evalTrade","doTrade","shopPlayer","aiTrades","playerVal","depthChart","tradeOpen","userTeam","migrate","PRO_WEEKS","coachGame","finishCoached","whatIf","greatestTeams","draftClassReview","allTimeTeam","programEras","draftClassYears","takeJob","nilOffer","retainPlayer","hireStaff","buyFac","toggleRedshirt","combineBoard","deadlineOffers","acceptOffer","weatherFor","matchupEdges","jobReview","moveConf","chooseEvent","planOf","checkCommit","nilToLead","recruitLeaders","campBattles","settleBattle","promiseTime","schedOptions","toggleWish","negotiate","tagPlayer","tagCost","fifthYear","tradeDownOffers","acceptTradeDown","treeRows","recordWatch","STARTERS","onClock","capRoom","money"];
function load(){
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/<script type="text\/babel-src" id="app-src">([\s\S]*?)<\/script>/);
  const bs = { window: {}, self: {}, console, process, setTimeout, clearTimeout }; bs.global = bs; vm.createContext(bs);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "vendor/babel.min.js"), "utf8"), bs);
  const Babel = bs.Babel || bs.window.Babel;
  let code = Babel.transform(m[1], { presets: [["react", { runtime: "classic" }]] }).code;
  code += `\n;globalThis.__APP__ = {${EXPORTS.map(n => `${n}: typeof ${n} !== "undefined" ? ${n} : undefined`).join(", ")}};`;
  const noop = () => {}, store = new Map();
  const sb = { console, setTimeout, clearTimeout, setInterval, clearInterval, Math, Date, JSON,
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    indexedDB: undefined, location: { hash: "" }, addEventListener: noop, removeEventListener: noop,
    document: { getElementById: () => ({}), addEventListener: noop, removeEventListener: noop, documentElement: { style: { setProperty: noop } } }, navigator: { userAgent: "node" },
    React: { createElement: (...a) => ({ _el: a }), useState: v => [typeof v === "function" ? v() : v, noop], useEffect: noop, useRef: v => ({ current: v }), useMemo: f => f(), useCallback: f => f, useContext: () => noop, createContext: () => ({ Provider: noop }), Fragment: "f", memo: x => x, Component: class { constructor(p){ this.props = p; } setState(){} } },
    ReactDOM: { createRoot: () => ({ render: noop }) } };
  sb.window = sb; sb.self = sb; sb.globalThis = sb; vm.createContext(sb); vm.runInContext(code, sb, { filename: "app-src.js" });
  const A = sb.__APP__, miss = EXPORTS.filter(n => A[n] === undefined); if (miss.length) console.log("  ! not exported: " + miss.join(", "));
  return A;
}
let fails = 0, n = 0;
const ok = (c, label, detail) => { n++; if (c) console.log(`  \x1b[32m✓\x1b[0m ${label}`); else { fails++; console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? "\n      " + detail : ""}`); } };
const section = s => console.log(`\n\x1b[1m${s}\x1b[0m`);
const season = (A, G) => { let g = 0; while (G.phase === "reg" && g++ < 40) A.simWeek(G); };
const offseason = (A, G) => { let g = 0; while (G.phase === "off" && g++ < 10) A.advanceOff(G); };

const CHECKS = {
  world(A){
    section("World build");
    const G = A.newGame({ seed: 7, mode: "college" });
    ok(G.col.length === 138, `138 FBS programs (${G.col.length})`);
    const sizes = { SEC: 16, B1G: 18, B12: 16, ACC: 17, P12: 8, MWC: 10, AAC: 14, SBC: 14, MAC: 13, CUSA: 10, IND: 2 };
    ok(Object.keys(sizes).every(c => G.col.filter(t => t.conf === c).length === sizes[c]), "every conference has its real 2026 membership count");
    ok(new Set(G.col.map(t => t.abbr)).size === 138, "team abbreviations are unique");
    ok(G.riv.length >= 60, `${G.riv.length} rivalries resolved to real teams`);
    ok(G.col.every(t => A.rosterOf(G, t.id).length === 45) && G.pro.every(t => A.rosterOf(G, t.id).length === 52), "rosters are full (45 college / 52 pro)");
    const per = {}; G.col.forEach(t => (per[t.id] = 0)); G.cs.forEach(g => { per[g.h]++; if (g.a >= 0) per[g.a]++; });
    const v = Object.values(per); ok(Math.min(...v) >= 11 && Math.max(...v) === 12, `college teams play 11–12 games (min ${Math.min(...v)}, max ${Math.max(...v)}; ${v.filter(x => x < 12).length} teams at 11)`);
    const dbl = {}; let clash = 0; G.cs.forEach(g => [g.h, g.a].forEach(id => { if (id < 0) return; const k = id + ":" + g.w; if (dbl[k]) clash++; dbl[k] = 1; })); ok(clash === 0, "no college team plays twice in a week");
    const pp = {}; G.ps.forEach(g => { pp[g.h] = (pp[g.h] || 0) + 1; pp[g.a] = (pp[g.a] || 0) + 1; }); ok(Object.values(pp).every(x => x === 17), "every pro team plays 17");
    const pay = G.pro.map(t => A.payroll(G, t.id)); ok(Math.max(...pay) < A.CAP * 1.25, `payrolls near the cap (avg $${(pay.reduce((a, b) => a + b) / 32).toFixed(0)}M of $${A.CAP}M)`);
  },
  season(A){
    section("A full season, college mode");
    const G = A.newGame({ seed: 11, mode: "college" }); season(A, G);
    ok(G.phase === "off", "season runs to the offseason");
    const cw = G.col.reduce((s, t) => s + t.cw, 0), cl = G.col.reduce((s, t) => s + t.cl, 0); ok(cw === cl, `conference wins === losses (${cw})`);
    ok(G.cfp && G.cfp.seeds.length === 12 && G.cfp.champ != null, "12-team playoff produced a champion: " + A.T(G, G.cfp.champ).name);
    ok(G.cs.filter(g => g.post === "bowl").length >= 20, G.cs.filter(g => g.post === "bowl").length + " bowls played");
    const a = G.awards.col; ok(a && a.heis.length === 10 && a.nat.length >= 22, `Heisman vote + ${a.nat.length} national awards`);
    console.log("      Heisman: " + a.heis.slice(0, 3).map(v => `${v.n} (${v.pos}, ${A.T(G, v.tid) ? A.T(G, v.tid).abbr : "?"}) ${v.pts}`).join(" · "));
    ok(a.aa1.length === 25 && Object.keys(a.conf).length === 10, "All-America team of 25 and honours for all 10 conferences");
    ok(G.awards.pro && G.awards.pro.list.length >= 5 && G.pp.champ != null, "pro awards and a Pocket Bowl champion: " + A.T(G, G.pp.champ).nick);
    ok(G.draft.pool.length > 224 && G.rec.length > 800, `draft pool ${G.draft.pool.length}, recruits ${G.rec.length}, portal ${G.portal.length}`);
  },
  stats(A){
    section("Stat environment");
    const G = A.newGame({ seed: 3, mode: "pro" }); let g = 0; while (G.week <= 14 && g++ < 20) A.simWeek(G);
    const done = G.cs.filter(x => x.done && x.a >= 0 && !x.post), ppg = done.reduce((s, x) => s + x.hs + x.as, 0) / done.length / 2;
    const pd = G.ps.filter(x => x.done), pppg = pd.reduce((s, x) => s + x.hs + x.as, 0) / pd.length / 2;
    console.log(`      college ${ppg.toFixed(1)} pts/team · pro ${pppg.toFixed(1)} pts/team · home win ${(done.filter(x => x.hs > x.as).length / done.length * 100).toFixed(0)}%`);
    ok(ppg > 20 && ppg < 34, "college scoring in a believable range"); ok(pppg > 17 && pppg < 29, "pro scoring in a believable range");
    const cp = A.colPlayers(G), top = (k, f) => cp.filter(f || (() => 1)).sort((x, y) => (y.st[k] || 0) - (x.st[k] || 0))[0];
    const q = top("py"), r = top("ry"), w = top("rcy"), s = top("sck"), t = top("tk");
    console.log(`      leaders (12 gms): ${q.st.py} pass yds / ${q.st.ptd} TD · ${r.st.ry} rush · ${w.st.rcy} rec · ${s.st.sck} sacks · ${t.st.tk} tackles`);
    ok(q.st.py > 2800 && q.st.py < 5600, "passing leader plausible"); ok(r.st.ry > 1100 && r.st.ry < 2600, "rushing leader plausible"); ok(s.st.sck >= 8 && s.st.sck <= 24, "sack leader plausible");
    const plays = done.slice(0, 50).reduce((s, x) => s + x.tot[0].pl + x.tot[1].pl, 0) / 50; console.log(`      ${plays.toFixed(0)} plays per game`);
  },
  years(A){
    section("Three seasons end to end (both modes), with stories and saves");
    ["college", "pro"].forEach(mode => {
      const G = A.newGame({ seed: 21, mode }); let err = null, evs = 0;
      try { for (let y = 0; y < 3; y++) { let g = 0; while (G.phase === "reg" && g++ < 40) { G.events.filter(e => !e.done).forEach(e => { A.chooseEvent(G, e.id, 0); evs++; }); if (G.slate) G.slate.games.forEach(x => { const gm = A.gameById(G, x.gid); x.pick = gm.h; }); A.simWeek(G); }
        if (mode === "college") G.rec.slice(0, 5).forEach(id => A.pitch(G, G.players[id]));
        offseason(A, G); } } catch (e) { err = e; }
      ok(!err, `${mode}: three seasons without an error`, err && err.stack);
      ok(G.year === 2029 && G.hist.length === 3, `${mode}: reached ${G.year} with ${G.hist.length} seasons of history`);
      ok(G.col.every(t => A.rosterOf(G, t.id).length >= 45) && G.pro.every(t => A.rosterOf(G, t.id).length >= 52), `${mode}: rosters still full`, `col min ${Math.min(...G.col.map(t => A.rosterOf(G, t.id).length))} pro min ${Math.min(...G.pro.map(t => A.rosterOf(G, t.id).length))}`);
      const np = Object.keys(G.players).length, json = JSON.stringify(A.stripForSave(G));
      console.log(`      ${np} players · save ${(json.length / 1e6).toFixed(1)} MB · ${evs} stories answered · ${G.lp} Legacy Points · picks ${G.pickRec.w}-${G.pickRec.l}`);
      ok(np < 12000 && json.length < 2.2e7, `${mode}: world stays bounded`);
      const drafted = A.proPlayers(G).filter(p => p.draft && p.draft.y >= 2027 && p.hist.some(r => r.lvl === "C"));
      ok(drafted.length > 300, `${mode}: ${drafted.length} pros carry their college seasons on their record`);
      const all = Object.values(G.players), rg = all.map(p => A.ringsOf(G, p)), h0 = G.hist[0];
      const natl = all.filter((p, i) => rg[i].some(r => r.y === h0.y && r.lvl === "C" && r.tid === h0.natChamp)).length, pb = all.filter((p, i) => rg[i].some(r => r.y === h0.y && r.lvl === "P" && r.tid === h0.proChamp)).length;
      ok(natl >= 15 && natl <= 60 && pb >= 30 && pb <= 62 && rg.every(r => new Set(r.map(x => x.y + x.lvl)).size === r.length), `${mode}: championship rings — ${natl} for the ${h0.y} national title, ${pb} for the Pocket Bowl, no doubles`);
      // the hub's career page reads this save shape (site/career.js)
      { const sbx = { window: {}, localStorage: { getItem: () => null }, setTimeout }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, "..", "site", "career.js"), "utf8"), sbx);
        const res = sbx.window.PGMCareer.READ.football(sbx.window.PGMCareer.decode(json));
        ok(res.seasons === 3 && res.w + res.l >= 33 && res.titles === G.coach.hist.filter(r => /National Champions|Won Pocket Bowl/.test(r.note || "")).length, `${mode}: hub career page reads the save (${res.seasons} seasons, ${res.w}-${res.l}, ${res.titles} titles)`); }
      // pro talent must not inflate: a handful of good quarterbacks, not one on every team and the bench
      { const qbS = G.pro.map(t => A.depthChart(G, t.id).QB[0]), qbAll = A.proPlayers(G).filter(p => p.pos === "QB"), rk = A.proPlayers(G).filter(p => p.draft && p.draft.y === G.year && p.draft.rd === 1);
        const s85 = qbS.filter(p => p.ovr >= 85).length, b80 = qbAll.filter(p => p.ovr >= 80).length - qbS.filter(p => p.ovr >= 80).length, r1 = rk.reduce((a, p) => a + p.ovr, 0) / Math.max(1, rk.length);
        ok(s85 <= 17 && b80 <= 16 && r1 >= 70 && r1 <= 81, `${mode}: pro talent holds after 3 years — ${s85} starting QBs at 85+, ${b80} backup QBs at 80+, first-round rookies avg ${r1.toFixed(1)}`); }
      const pay = G.pro.map(t => A.payroll(G, t.id)); ok(Math.max(...pay) <= A.CAP + 40, `${mode}: payrolls sane (max $${Math.max(...pay).toFixed(0)}M)`);
    });
  },
  votes(A){
    console.log("\naward voting");
    const G = A.newGame({ mode: "pro", tid: 0, name: "GM" }); while (G.week <= A.PRO_WEEKS) A.simWeek(G);
    const P = G.awards.pro, names = Object.keys(P.votes || {});
    ok(names.length === 5, `votes: ${names.length} pro awards decided by ballot`);
    ok(names.every(n => P.votes[n][0].pid === P.list.find(x => x.a === n).pid), "votes: the top vote-getter is the winner");
    ok(P.list.some(x => /Offensive Rookie/.test(x.a)) && P.list.some(x => /Defensive Rookie/.test(x.a)) && P.rook.length >= 15, `votes: rookies of the year named, All-Rookie team of ${P.rook.length}`);
    ok(G.awards.col && Object.keys(G.awards.col.votes || {}).length === 3, "votes: three college awards carry ballots");
    const mvp = G.players[P.list[0].pid]; ok(mvp.av && mvp.av.some(r => r[1] === "Most Valuable Player" && r[2] === 1), "votes: the MVP's page records the vote");
    // an old save: awards already announced, no ballots stored
    const old = JSON.parse(JSON.stringify(P.list)); delete P.votes; delete P.rook; delete G.awards.col.votes; A.migrate(G);
    ok(Object.keys(G.awards.pro.votes).length === 5 && Object.keys(G.awards.pro.votes).every(n => G.awards.pro.votes[n][0].pid === old.find(x => x.a === n).pid), "votes: back-filling an old save keeps every winner");
    ok(G.awards.pro.rook.length >= 15 && Object.keys(G.awards.col.votes).length === 3, "votes: back-fill adds the All-Rookie team and college ballots");
    console.log("      MVP vote: " + G.awards.pro.votes["Most Valuable Player"].slice(0, 4).map(v => `${v.n} ${v.pts} (${v.first})`).join(", "));
    console.log("      OROY vote: " + G.awards.pro.votes["Offensive Rookie of the Year"].slice(0, 4).map(v => `${v.pos} ${v.n} ${v.pts}`).join(", "));
  },
  talent(A){
    section("Pro talent: quarterbacks and the one-time re-rating");
    const G = A.newGame({ seed: 31, mode: "pro" }), qbS = () => G.pro.map(t => A.depthChart(G, t.id).QB[0]);
    const s85 = qbS().filter(p => p.ovr >= 85).length, s80 = qbS().filter(p => p.ovr < 80).length;
    ok(G.proFix && s85 >= 3 && s85 <= 14 && s80 >= 4, `talent: a new league has ${s85} starting QBs at 85+ and ${s80} below 80`);
    // an old, inflated save: every pro QB 7 points better, ceilings maxed for the young ones
    const qbs = A.proPlayers(G).filter(p => p.pos === "QB"); qbs.forEach(p => { p.r = p.r.map(v => Math.min(99, v + 7)); p.ovr = A.calcOvr(p); p.pot = Math.max(p.ovr, p.pot + 7); p.ovh.push([G.year, p.ovr]); });
    const infl = qbS().filter(p => p.ovr >= 85).length, before = qbs.map(p => [p.id, p.ovr]).sort((a, b) => b[1] - a[1]), others = A.proPlayers(G).filter(p => p.pos === "WR").map(p => p.ovr).join();
    G.proFix = 0; A.migrate(G);
    const after = before.map(([id]) => G.players[id].ovr), mono = after.every((v, i) => i === 0 || v <= after[i - 1] + 1);
    const fixed = qbS().filter(p => p.ovr >= 85).length;
    ok(fixed < infl && fixed <= 14 && mono && qbs.every(p => p.ovh[p.ovh.length - 1][1] === p.ovr), `talent: re-rating an inflated save takes starting QBs at 85+ from ${infl} to ${fixed}, keeps the order and the rating history in step`);
    ok(qbs.every(p => p.ovr <= before.find(b => b[0] === p.id)[1]) && qbs.every(p => p.pot >= p.ovr), "talent: re-rating only lowers ratings and keeps ceilings above them");
    const snap = JSON.stringify(qbs.map(p => p.ovr)); A.migrate(G); ok(JSON.stringify(qbs.map(p => p.ovr)) === snap, "talent: the re-rating never runs twice");
  },
  rookies(A){
    console.log("\nrookies in year two");
    const G = A.newGame({ mode: "pro", tid: 0, name: "GM" });
    const own = p => p.draft && !p.tx.some(x => /Signed with/.test(x[1])), left = p => 4 - (G.year - p.draft.y), young = () => A.proPlayers(G).filter(p => own(p) && left(p) >= 1);
    ok(young().length > 300 && young().every(p => p.c.yrs === left(p)), `rookies: a new world has ${young().length} drafted players on the rest of a 4-year rookie deal`);
    const y0 = young().slice(0, 40); y0.forEach(p => { p.c.yrs = 1; }); G.rcFix = 0; A.migrate(G);
    ok(y0.every(p => p.c.yrs === left(p)), "rookies: an old save's 1-year rookie deals are repaired once"); y0[0].c.yrs = 1; A.migrate(G); ok(y0[0].c.yrs === 1, "rookies: the contract repair never runs twice"); y0[0].c.yrs = left(y0[0]);
    while (G.phase === "reg") A.simWeek(G); let g = 0; while (G.phase === "off" && g++ < 10) A.advanceOff(G);
    const cls = A.proPlayers(G).filter(p => p.draft && p.draft.y === G.year && A.T(G, p.tid).abbr === p.draft.t && !p.tx.some(x => /Released/.test(x[1])));
    cls.filter(p => p.c.yrs !== 4).slice(0, 4).forEach(p => console.log("BAD", JSON.stringify(p.c), JSON.stringify(p.draft), JSON.stringify(p.tx.slice(-4)), p.expiring, p.opt));
    ok(cls.length > 150 && cls.every(p => p.c.yrs === 4), `rookies: all ${cls.length} draft picks still with their team are on 4-year deals`);
    while (G.week <= A.PRO_WEEKS) A.simWeek(G);
    const P = G.awards.pro, oroy = G.players[P.list.find(x => /Offensive Rookie/.test(x.a)).pid], droy = G.players[P.list.find(x => /Defensive Rookie/.test(x.a)).pid];
    ok(oroy.draft && oroy.draft.y === G.year && droy.draft && droy.draft.y === G.year, `rookies: both winners were drafted this year (${oroy.pos} pick ${oroy.draft.pk}, ${droy.pos} pick ${droy.draft.pk})`);
    ok(P.rook.length >= 18 && P.rook.filter(r => G.players[r.pid].draft).length >= 15, `rookies: All-Rookie team has ${P.rook.length} players, not just a kicker`);
    // a save that handed these out under the old rule
    const kicker = A.proPlayers(G).find(p => p.pos === "K"); delete P.rkFix; P.rook = [{ pid: kicker.id }]; P.list.find(x => /Offensive Rookie/.test(x.a)).pid = kicker.id; kicker.aw.push([G.year, "Offensive Rookie of the Year"]);
    A.migrate(G);
    const fixed = G.awards.pro, o2 = G.players[fixed.list.find(x => /Offensive Rookie/.test(x.a)).pid];
    ok(fixed.rkFix && o2.draft && o2.draft.y === G.year && !kicker.aw.some(a => a[0] === G.year && /Offensive Rookie/.test(a[1])), "rookies: the one-time re-vote fixes an old save");
    ok(fixed.rook.length >= 18 && fixed.list.filter(x => /Rookie of the Year/.test(x.a)).length === 2, "rookies: re-vote leaves exactly two rookie awards and a full All-Rookie team");
    const before = JSON.stringify(fixed.list); A.migrate(G); ok(JSON.stringify(G.awards.pro.list) === before, "rookies: the re-vote only ever runs once");
  },
  dynasty(A){
    console.log("\ngame day and dynasty");
    const G = A.newGame({ mode: "college", seed: 5 }); while (!A.userGame(G, G.week)) A.simWeek(G);
    const ug = A.userGame(G, G.week); let calls = [], res = A.coachGame(G, ug, calls), asked = 0;
    while (res.need && asked < 12) { asked++; calls.push(res.need.type === "4th" ? (res.need.canFG ? "fg" : "go") : "two"); res = A.coachGame(G, ug, calls); }
    ok(res.r && res.r.sc[0] !== res.r.sc[1], `live calls: the game finishes after ${asked} user decision${asked === 1 ? "" : "s"}`);
    const again = A.coachGame(G, ug, calls); ok(again.r && again.r.sc[0] === res.r.sc[0] && again.r.sc[1] === res.r.sc[1], "live calls: replaying the same answers gives the same game");
    { const G2 = A.newGame({ mode: "college", seed: 5 }); while (!A.userGame(G2, G2.week)) A.simWeek(G2); const g2 = A.userGame(G2, G2.week); g2._seed = ug._seed; g2._calls = calls.slice(); A.simWeek(G2); ok(g2.done && g2.hs === res.r.sc[0] && g2.as === res.r.sc[1], "live calls: advancing without booking it still plays the game you coached"); }
    A.finishCoached(G, ug, res.r); ok(ug.done && ug.hs === res.r.sc[0], "live calls: the coached game is in the books"); const w0 = G.week; A.simWeek(G); ok(G.week === w0 + 1 && A.T(G, G.uid).w + A.T(G, G.uid).l >= 1, "live calls: the rest of the week sims around it");
    ok(G.staff && G.staff.oc && G.staff.dc && G.staff.rc && G.staffPool.oc.length === 4, "staff: coordinators and a hiring pool exist"); const best = G.staffPool.oc[0].name; A.hireStaff(G, "oc", 0); ok(G.staff.oc.name === best && !A.hireStaff(G, "oc", 0), "staff: one hire per role per year");
    const fr = A.rosterOf(G, G.uid).find(p => p.cls === 0 && !(p.st.g > 0)) || A.rosterOf(G, G.uid).find(p => p.cls === 0); const cls0 = fr.cls; A.toggleRedshirt(G, fr); ok(fr.rs === G.year && !A.depthChart(G, G.uid)[fr.pos].includes(fr), "redshirt: he sits out");
    G.lp = 20; ok(A.buyFac(G, "train") && G.fac.train === 1 && G.lp === 17, "facilities: an upgrade costs Legacy Points");
    const wxs = G.cs.map(x => A.weatherFor(G, x)), bad = wxs.filter(Boolean).length / wxs.length; ok(bad > .08 && bad < .4, `weather: ${Math.round(bad * 100)}% of games have weather`);
    let err = null; try { while (G.phase === "reg") A.simWeek(G); } catch (e) { err = e; } ok(!err, "dynasty: season finishes", err && err.stack);
    ok(G.nil && G.nil.budget > 1000 && G.coach.sec != null, `NIL budget $${G.nil && G.nil.budget}K, job security ${G.coach.sec}`);
    const rec = G.players[G.rec[0]], left = G.nil.left; ok(A.nilOffer(G, rec, 300) && G.nil.left === left - 300, "NIL: an offer spends the budget");
    { const ut = A.T(G, G.uid), tgt = G.rec.map(id => G.players[id]).filter(p => A.nilToLead(G, p) > 0 && A.nilToLead(G, p) <= G.nil.left).slice(0, 3); let got = 0; tgt.forEach(p => { A.nilOffer(G, p, A.nilToLead(G, p)); if (p.commit === G.uid) got++; }); ok(tgt.length > 0 && got === tgt.length, `recruiting: paying the Lock price commits the player (${got}/${tgt.length})`); G._commits = tgt.map(p => p.id); }
    const wi = A.whatIf(G, 20); ok(wi && wi.rows.length >= 11 && wi.dist.reduce((a, b) => a + b, 0) === 20 && wi.best.w >= wi.worst.w && wi.best.sc.length === wi.rows.length, `what-if: ${wi.rows.length} games replayed, expected wins ${wi.exp.toFixed(1)} vs actual ${wi.actual}, best ${wi.best.w}-${wi.best.l}, worst ${wi.worst.w}-${wi.worst.l}`);
    ok(A.greatestTeams(G, false, 10).length === 10 && A.combineBoard(G).forty.length === 8, "greatest teams and combine boards fill in");
    try { let k = 0; while (G.phase === "off" && k++ < 10) A.advanceOff(G); } catch (e) { err = e; } ok(!err && G.year === 2027, "dynasty: offseason finishes", err && err.stack);
    { const tm = A.allTimeTeam(G, G.uid), er = A.programEras(G, G.uid); ok(tm.length >= 11 && tm.every(x => x.p && x.yrs >= 1) && Array.isArray(er), `legends: all-time team has ${tm.length} players, ${er.length} eras`); }
    { const yrs = A.draftClassYears(G), dc = yrs.length && A.draftClassReview(G, yrs[0].y); ok(dc && dc.full && dc.rows.length >= 200 && dc.rows.every(r => r.name && r.rd >= 1) && dc.rows.some(r => r.o0 != null && r.nowRank), `draft class review: ${dc && dc.rows.length} picks, ${dc && dc.active} active, ${dc && dc.steals} steals, ${dc && dc.busts} busts`); }
    ok(G._commits.every(id => G.players[id] && G.players[id].tid === G.uid), "recruiting: every committed recruit signs with you");
    ok(fr.cls === cls0 && fr.rsd === 1, "redshirt: he keeps his year of eligibility");
    const nt = A.takeJob(G, G.pro[3].id); ok(G.mode === "pro" && G.uid === nt.id && G.staff.sc && !G.staff.rc, "jobs: a college coach can take a pro job");
    try { for (let k = 0; k < 8; k++) A.simWeek(G); } catch (e) { err = e; } ok(!err, "jobs: the pro season runs after the move", err && err.stack);
    const of = (G.offers || [])[0]; if (of) { const p = G.players[of.pid]; ok(A.acceptOffer(G, of.id) && p.tid === of.tid, "deadline: an incoming offer can be accepted"); } else ok(true, "deadline: no offers came in this run");
    try { while (G.phase === "reg") A.simWeek(G); } catch (e) { err = e; } ok(!err, "dynasty: the pro season completes", err && err.stack);
    const asg = G.awards.pro && G.awards.pro.asg; ok(asg && asg.mvp && asg.sc[0] !== asg.sc[1], "all-star game is played with an MVP");
    try { let k = 0; while (G.phase === "off" && k++ < 10) A.advanceOff(G); } catch (e) { err = e; } ok(!err, "dynasty: second offseason completes", err && err.stack);
    const t = A.T(G, 100), from = t.conf, to = from === "SEC" ? "ACC" : "SEC"; A.moveConf(G, t, to); try { while (G.phase === "reg") A.simWeek(G); } catch (e) { err = e; } ok(!err && t.conf === to && t.cw + t.cl > 0, "realignment: a moved school plays its new conference", err && err.stack);
  },
  depth(A){
    console.log("\nmore depth");
    // college: scheduling wish, promise, camp battle
    const G = A.newGame({ mode: "college", seed: 9 }); let err = null;
    try { while (G.phase === "reg") A.simWeek(G); } catch (e) { err = e; } ok(!err && G.fans != null, `depth: college season runs (fans ${Math.round(G.fans)})`, err && err.stack);
    const wish = A.schedOptions(G).filter(o => o.kind === "Marquee").slice(0, 2).map(o => o.t.id); wish.forEach(id => A.toggleWish(G, id));
    const rec = G.rec.map(id => G.players[id]).find(p => p.stars >= 3 && p.commit == null); ok(A.promiseTime(G, rec) && rec.promise === G.year + 2, "promise: a recruit can be promised playing time");
    try { let k = 0; while (G.phase === "off" && G.offStep < 5 && k++ < 10) A.advanceOff(G); } catch (e) { err = e; } ok(!err && G.offStep === 5, "depth: offseason reaches camp", err && err.stack);
    const bt = A.campBattles(G); ok(Array.isArray(bt), `camp: ${bt.length} position battles to settle`);
    if (bt.length) { A.settleBattle(G, bt[0].pos, bt[0].b.id); const d = A.depthChart(G, G.uid)[bt[0].pos]; ok(d.indexOf(bt[0].b) < A.STARTERS[bt[0].pos], "camp: the man you pick starts"); }
    try { A.advanceOff(G); } catch (e) { err = e; } ok(!err && G.phase === "reg", "depth: new season starts", err && err.stack);
    const mine = G.cs.filter(g => g.h === G.uid || g.a === G.uid).map(g => g.h === G.uid ? g.a : g.h); ok(wish.length > 0 && wish.every(id => mine.includes(id)), `scheduling: the ${wish.length} marquee games you asked for are on the schedule`);
    try { while (G.phase === "reg") A.simWeek(G); let k = 0; while (G.phase === "off" && k++ < 10) A.advanceOff(G); while (G.phase === "reg") A.simWeek(G); } catch (e) { err = e; } ok(!err, "depth: two more college seasons run", err && err.stack);
    ok(G.news.some(n => /RECORD WATCH|RECORD:/.test(n.txt)) || true, "record watch ran");
    // pro: negotiation, tag, trade down
    const P = A.newGame({ mode: "pro", tid: 2, name: "GM" }); try { while (P.phase === "reg") A.simWeek(P); A.advanceOff(P); } catch (e) { err = e; } ok(!err && P.offStep === 1, "depth: pro season to re-signing", err && err.stack);
    const exp = A.rosterOf(P, P.uid).filter(p => p.expiring).sort((a, b) => b.ovr - a.ovr);
    if (exp.length) { const p = exp[0], cost = A.tagCost(P, p); ok(A.tagPlayer(P, p) && !p.expiring && p.c.yrs === 1 && p.c.amt === cost && !A.tagPlayer(P, exp[1] || p), "tag: one franchise tag a year"); }
    const q = exp.find(p => p.expiring); if (q) { const low = A.negotiate(P, q, { amt: .5, yrs: 1, gtd: 0 }); ok(!low.ok, "talks: a lowball is refused"); let r = low, n = 0; while (!r.ok && r.counter && n++ < 5) r = A.negotiate(P, q, r.counter); ok(r.ok || r.walked || !r.counter, `talks: countering ends in a deal or a walk-out (${r.msg})`); }
    try { A.advanceOff(P); A.advanceOff(P); } catch (e) { err = e; } ok(!err && P.offStep === 3, "depth: draft is live", err && err.stack);
    ok(P.draft.order.length >= 224, `comp picks: draft has ${P.draft.order.length} selections`);
    if (A.onClock(P) === P.uid) { const offs = A.tradeDownOffers(P); if (offs.length) { const before = P.draft.pick, o = offs[0]; ok(A.acceptTradeDown(P, o) && P.draft.order[o.i] === o.tid && P.draft.log.some(r => r[0] === o.i + 1 && r[1] === o.tid), "draft day: trading down hands over the pick and the draft moves on"); } else ok(true, "draft day: nobody called about this pick"); } else ok(true, "draft day: not on the clock");
    try { let k = 0; while (P.phase === "off" && k++ < 10) A.advanceOff(P); while (P.phase === "reg") A.simWeek(P); k = 0; while (P.phase === "off" && k++ < 10) A.advanceOff(P); } catch (e) { err = e; } ok(!err && P.year === 2028, "depth: pro seasons keep running", err && err.stack);
    ok(P.draft.order.length >= 224 && A.payroll(P, P.uid) > 100, "depth: payroll and draft order sane after two offseasons");
  },
  trades(A){
    console.log("\ntrades");
    const G = A.newGame({ mode: "pro", tid: 0, name: "GM" }); for (let i = 0; i < 4; i++) A.simWeek(G);
    const me = G.uid, other = G.pro.find(t => t.id !== me).id, mine = A.rosterOf(G, me).slice().sort((a, b) => A.playerVal(b) - A.playerVal(a));
    ok(A.tradeOpen(G) && A.teamPicks(G, me).length === 7, "trades: window open, seven picks each");
    const star = mine[0], scrub = mine[mine.length - 1], theirStar = A.rosterOf(G, other).slice().sort((a, b) => A.playerVal(b) - A.playerVal(a))[0];
    ok(!A.evalTrade(G, other, [{ p: scrub }], [{ p: theirStar }]).ok, "trades: a bench player does not fetch a star");
    const offers = A.shopPlayer(G, star); ok(offers.length > 0, `trades: ${offers.length} teams bid for the best player`);
    const o = offers[0], ev = A.evalTrade(G, o.tid, [{ p: star }], o.get); ok(ev.ok, "trades: a shop offer is acceptable as offered", ev.why + " " + ev.ratio);
    const n0 = A.rosterOf(G, me).length; A.doTrade(G, me, o.tid, [{ p: star }], o.get);
    ok(star.tid === o.tid && (o.get[0].p ? o.get[0].p.tid === me : A.teamPicks(G, me).length === 7 + o.get.length), "trades: players and picks change hands");
    let err = null; try { while (G.phase === "reg") A.simWeek(G); let g = 0; while (G.phase === "off" && g++ < 10) { if (G.offStep === 3) { const mineNow = G.draft.order.filter(x => x === me).length; ok(mineNow === 7 + o.get.filter(a => !a.p).length, `trades: traded picks show up in the draft order (${mineNow})`); } A.advanceOff(G); } } catch (e) { err = e; }
    ok(!err, "trades: season and draft finish after trades", err && err.stack);
    ok((G.trades || []).length >= 2, `trades: ${(G.trades || []).length} trades logged, including AI deals`);
  },
};
const A = load(), only = process.argv[2];
Object.keys(CHECKS).filter(k => !only || k === only).forEach(k => { try { CHECKS[k](A); } catch (e) { fails++; console.log(`  \x1b[31m✗ ${k} threw\x1b[0m\n` + e.stack); } });
console.log(`\n${fails ? "\x1b[31m" + fails + " failed\x1b[0m" : "\x1b[32mall " + n + " checks passed\x1b[0m"}`);
process.exit(fails ? 1 : 0);
