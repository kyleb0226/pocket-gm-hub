
/* =========================================================================
   More depth: camp battles, promises, scheduling wishes, contract talks,
   tags and options, draft-day trade-downs, comp picks, fans, record watch,
   coaching tree, ring of honour, eras
   ========================================================================= */

/* ----------------------------- camp battles ----------------------------- */
// Starting jobs where the next man up is within three points: yours to settle in camp.
function campBattles(G){
  const d = depthChart(G, G.uid), out = [];
  POS.forEach(pos => { const n = STARTERS[pos], a = d[pos][n - 1], b = d[pos][n]; if (a && b && !a.inj && !b.inj && Math.abs(a.ovr - b.ovr) <= 3) out.push({ pos, a, b }); });
  return out;
}
const campNote = p => { const we = trait(p, "we"), up = p.pot - p.ovr; return we >= 4 && up >= 6 ? "First in, last out — and still getting better" : we >= 4 ? "Has outworked everyone in camp" : up >= 8 ? "Raw, but the flashes are loud" : we <= 2 ? "Coasting on talent so far" : p.age >= 30 || p.cls === 3 ? "The steady veteran hand" : "Solid, unspectacular camp"; };
function settleBattle(G, pos, winId){
  const ids = depthChart(G, G.uid)[pos].map(p => p.id), n = STARTERS[pos], i = ids.indexOf(winId); if (i < 0) return;
  if (i >= n) [ids[n - 1], ids[i]] = [ids[i], ids[n - 1]];
  (G.dc = G.dc || {})[pos] = ids; (G.camp = G.camp || {})[pos] = winId;
}

/* ----------------------------- playing-time promises (college) ----------------------------- */
const openPromises = G => Object.values(G.players).filter(p => p.promise && (p.commit === G.uid || p.tid === G.uid || p.recruit || p.portal) && p.promiseBy === G.uid).length;
function promiseTime(G, p){
  if (p.promise || !(p.recruit || p.portal) || p.commit != null || openPromises(G) >= 3) return false;
  p.promise = G.year + (p.portal ? 1 : 2); p.promiseBy = G.uid; checkCommit(G, p); return true;
}
// End of season: a promised starter who didn't start wants out; a promise kept is remembered.
function promiseReview(G){
  if (G.mode !== "college") return;
  rosterOf(G, G.uid).forEach(p => { if (!p.promise || p.promiseBy !== G.uid || p.promise > G.year) return;
    if ((p.st.gs || 0) >= 6) { delete p.promise; gainLP(G, 1, "a promise kept"); news(G, `You kept your word: ${p.pos} ${pname(p)} started as promised.`, "rec", G.uid); }
    else { delete p.promise; delete p.stay; if (!p.portal && p.cls != null && p.cls < 3) { p.portal = 1; G.portal.push(p.id); } G.fans = clamp((G.fans || 55) - 3, 0, 100); G.coach.sec = clamp((G.coach.sec || 60) - 2, 0, 100);
      news(G, `BROKEN PROMISE: ${p.pos} ${pname(p)} was told he'd start, didn't, and is in the portal. Recruits notice.`, "portal", G.uid); G.brokenWord = G.year + 1; } });
}

/* ----------------------------- scheduling wishes (college) ----------------------------- */
function schedOptions(G){
  const t = userTeam(G); if (t.pro) return [];
  return G.col.filter(x => x.id !== t.id && (x.conf !== t.conf || t.conf === "IND")).map(x => ({ t: x, kind: x.prestige <= t.prestige - 14 ? "Cupcake" : x.prestige >= 84 && x.prestige >= t.prestige - 10 ? "Marquee" : x.prestige >= t.prestige - 5 ? "Even fight" : "Should win" })).sort((a, b) => b.t.prestige - a.t.prestige);
}
function toggleWish(G, tid){ G.ncWish = G.ncWish || []; const i = G.ncWish.indexOf(tid); if (i >= 0) G.ncWish.splice(i, 1); else if (G.ncWish.length < 3) G.ncWish.push(tid); }

/* ----------------------------- contract talks (pro) ----------------------------- */
const wantYears = p => p.age <= 28 ? 4 : p.age <= 30 ? 3 : p.age <= 32 ? 2 : 1;
const baseAsk = (G, p) => p.fa ? askFor(G, p, G.uid) : askOf(G, p);
// How the player's side scores an offer against what he's asking: 1.0 or better gets signed.
function offerScore(G, p, o){ return o.amt * (1 + (o.gtd - .3) * .35) * (1 - Math.abs(o.yrs - wantYears(p)) * .045) / baseAsk(G, p); }
function negotiate(G, p, o){
  G.nego = G.nego || {}; const s = G.nego[p.id] || (G.nego[p.id] = { tries: 0 });
  if (s.walked) return { ok: false, msg: "His agent isn't taking your calls any more this year." };
  const room = capRoom(G, G.uid) + (p.tid === G.uid && p.c ? p.c.amt : 0); if (o.amt > room) return { ok: false, msg: `That doesn't fit: you have ${money(Math.max(0, room))} of room.` };
  if (p.fa && rosterOf(G, G.uid).length >= 58) return { ok: false, msg: "Your roster is full." };
  const lc = s.counter, meets = lc && o.amt >= lc.amt - .005 && o.gtd >= lc.gtd - .005 && o.yrs === lc.yrs, r = meets ? 1 : offerScore(G, p, o);
  if (r >= 1 || (r >= .95 && chance(.5))) {
    if (p.fa) signFA(G, p, G.uid, o.yrs, +o.amt.toFixed(2)); else { p.c = { amt: +o.amt.toFixed(2), yrs: o.yrs }; delete p.expiring; p.tx.push([G.year, `Re-signed with the ${T(G, p.tid).nick} (${o.yrs} yr, ${money(o.amt)})`]); }
    p.c.gtd = +o.gtd.toFixed(2); delete G.nego[p.id];
    return { ok: true, msg: r >= 1.12 ? "His agent says yes before you finish the sentence." : "Deal. He signs." };
  }
  s.tries++;
  if (s.tries >= 4 || (r < .72 && chance(.6))) { s.walked = true; return { ok: false, walked: true, msg: r < .72 ? "Insulted, his agent hangs up. Talks are over for this year." : "Four rounds in, his side walks away from the table." }; }
  const wy = wantYears(p), ask = baseAsk(G, p), c = { yrs: wy, gtd: .4, amt: +(ask * (1 - .035 * s.tries) / (1 + (.4 - .3) * .35)).toFixed(2) };
  s.counter = c;
  return { ok: false, counter: c, msg: r >= .9 ? "Close. They come back with a number." : o.yrs !== wy && Math.abs(o.yrs - wy) >= 2 ? `He wants a ${wy}-year deal, not ${o.yrs}.` : o.gtd < .2 ? "Not enough guaranteed. They counter." : "Too light. They counter." };
}
/* ----------------------------- franchise tag + fifth-year option ----------------------------- */
function tagCost(G, p){ const top = proPlayers(G).filter(x => x.pos === p.pos && x.c).sort((a, b) => b.c.amt - a.c.amt).slice(0, 5); return +Math.max(askOf(G, p) * 1.15, avgOf(top, x => x.c.amt, 0)).toFixed(2); }
function tagPlayer(G, p){ if (G.tagUsed === G.year || !p.expiring || p.tid !== G.uid) return false; p.c = { amt: tagCost(G, p), yrs: 1, tag: 1, gtd: 1 }; delete p.expiring; G.tagUsed = G.year; p.tx.push([G.year, `Franchise-tagged by the ${T(G, p.tid).nick} (${money(p.c.amt)})`]); news(G, `The ${T(G, p.tid).nick} place the franchise tag on ${p.pos} ${pname(p)}.`, "fa", p.tid); return true; }
const canOption = p => !!(p.expiring && p.draft && p.draft.rd === 1 && !p.opt && (p.exp || 0) <= 4);
function fifthYear(G, p){ if (!canOption(p)) return false; p.c = { amt: +(askOf(G, p) * .9).toFixed(2), yrs: 1, gtd: 1 }; p.opt = 1; delete p.expiring; p.tx.push([G.year, `Fifth-year option picked up (${money(p.c.amt)})`]); return true; }

/* ----------------------------- draft day: offers to move down ----------------------------- */
function tradeDownOffers(G){
  const d = G.draft; if (!d || d.done || onClock(G) !== G.uid) return [];
  const i = d.pick, v0 = pickVal(i + 1), out = [], seen = new Set();
  for (let j = i + 2; j < Math.min(d.order.length, i + 34) && out.length < 3; j++) { const tid = d.order[j]; if (tid === G.uid || seen.has(tid)) continue; seen.add(tid);
    if (hk(tid * 131 + i, "td") > .55) continue;                                   // not everyone wants up
    const need = v0 * (1.02 + hk(tid + i, "tdp") * .2) - pickVal(j + 1); let k = -1, best = 1e9;
    for (let x = j + 1; x < d.order.length; x++) if (d.order[x] === tid) { const diff = Math.abs(pickVal(x + 1) - need); if (diff < best) { best = diff; k = x; } }
    if (k < 0 || pickVal(j + 1) + pickVal(k + 1) < v0 * .92) continue;
    out.push({ tid, i, j, k, v: +(pickVal(j + 1) + pickVal(k + 1)).toFixed(1), v0: +v0.toFixed(1) }); }
  return out;
}
function acceptTradeDown(G, o){
  const d = G.draft; if (!d || d.pick !== o.i || d.order[o.j] !== o.tid || d.order[o.k] !== o.tid) return false;
  d.order[o.i] = o.tid; d.order[o.j] = G.uid; d.order[o.k] = G.uid; const t = T(G, o.tid);
  (G.trades = G.trades || []).unshift({ y: G.year, w: 0, a: G.uid, b: o.tid, ga: `pick No. ${o.i + 1}`, gb: `picks No. ${o.j + 1} and No. ${o.k + 1}` });
  news(G, `DRAFT TRADE: the ${t.nick} move up to No. ${o.i + 1}, sending picks ${o.j + 1} and ${o.k + 1} to the ${userTeam(G).nick}.`, "draft", o.tid);
  draftRun(G, false); return true;
}
/* ----------------------------- compensatory picks ----------------------------- */
// Teams that lost more in free agency than they signed get extra picks after round seven.
function compPicks(G){
  const net = G.faNet || {}; G.faNet = {};
  return G.pro.map(t => [t.id, net[t.id] || 0]).filter(x => x[1] <= -10).sort((a, b) => a[1] - b[1]).slice(0, 8).map(x => x[0]);
}
const pickRound = i => i >= 224 ? "Comp" : "Rd " + Math.ceil((i + 1) / 32);

/* ----------------------------- fans and owner ----------------------------- */
function fanWeek(G, w){
  const g = [...G.cs, ...G.ps].find(x => x.w === w && x.done && (x.h === G.uid || x.a === G.uid)); if (!g) return;
  const home = g.h === G.uid, won = (home ? g.hs : g.as) > (home ? g.as : g.hs), opp = T(G, home ? g.a : g.h), big = g.riv != null || (opp && opp.rank && opp.rank <= 10) || !!g.post;
  G.fans = clamp((G.fans == null ? 55 : G.fans) + (won ? 2.2 : -2.6) * (big ? 1.8 : 1) + (50 - (G.fans == null ? 55 : G.fans)) * .02, 0, 100);
}
const fanLabel = f => f >= 80 ? ["Sold out every week", "#4ade80"] : f >= 62 ? ["Buzzing", "#a3e635"] : f >= 42 ? ["Showing up", "#fbbf24"] : f >= 25 ? ["Restless", "#fb923c"] : ["Empty seats", "#f87171"];
const revenueOf = G => round(60 + (G.fans == null ? 55 : G.fans) * 1.4 + ((G.fac || {}).stad || 0) * 14 + (userTeam(G).pro ? 180 : userTeam(G).prestige * .9));

/* ----------------------------- record watch ----------------------------- */
function recordWatch(G, w){
  if (w < 7) return; G.recWatch = G.recWatch || {};
  [["col", colPlayers(G), COL_WEEKS - 2, "college"], ["pro", proPlayers(G), PRO_WEEKS, "pro"]].forEach(([lvl, pool, N, label]) => {
    if (w > N + (lvl === "col" ? 2 : 0)) return;
    REC_KEYS.forEach(([k, name]) => { const r = G.records[lvl][k]; if (!r || !r.v) return; let top = null; for (const p of pool) if ((p.st[k] || 0) > (top ? top.st[k] : 0)) top = p; if (!top || (top.st.g || 0) < 6) return;
      const t = T(G, top.tid), key = lvl + k + top.id, v = top.st[k];
      if (v > r.v && !G.recWatch[key + "b"]) { G.recWatch[key + "b"] = 1; news(G, `RECORD: ${t ? t.abbr + " " : ""}${top.pos} ${pname(top)} now has ${v.toLocaleString()} ${name.toLowerCase()}, breaking ${r.n}'s ${label} single-season mark of ${r.v.toLocaleString()} (${r.y}).`, "award", top.tid); if (isUser(G, top.tid)) gainLP(G, 3, "a record broken"); }
      else if (v <= r.v && !G.recWatch[key] && v / top.st.g * N > r.v * 1.03) { G.recWatch[key] = 1; news(G, `RECORD WATCH: ${t ? t.abbr + " " : ""}${top.pos} ${pname(top)} is on pace for ${round(v / top.st.g * N).toLocaleString()} ${name.toLowerCase()}. The ${label} record is ${r.v.toLocaleString()} (${r.n}, ${r.y}).`, "award", top.tid); } }); });
}

/* ----------------------------- coaching tree ----------------------------- */
function treeRows(G){
  return (G.tree || []).map(x => { const t = T(G, x.tid), on = t && t.coach && t.coach.name === x.name; return Object.assign({}, x, { t: on ? t : null, w: on ? t.coach.w : null, l: on ? t.coach.l : null }); });
}

/* ----------------------------- ring of honour ----------------------------- */
function honour(G, t, p){ if (!t || !p) return; t.ring = t.ring || []; if (t.ring.some(r => r.pid === p.id)) return; t.ring.unshift({ pid: p.id, n: pname(p), num: p.num, pos: p.pos, y: G.year }); if (t.ring.length > 40) t.ring.length = 40; if (isUser(G, t.id) || p.hof) news(G, `${t.pro ? "The " + t.nick : t.name} ${t.pro ? "retire" : "retires"} No. ${p.num} for ${pname(p)}.`, "hof", t.id); }
function honourPro(G, p){ if (p.exp == null) return; const by = {}; p.hist.forEach(r => { if (r.lvl === "P") by[r.tid] = (by[r.tid] || 0) + 1; }); const best = Object.keys(by).sort((a, b) => by[b] - by[a])[0]; if (best != null && by[best] >= 5 && (p.hof || awardScore(p, true) >= 14)) honour(G, T(G, +best), p); }
function honourCol(G, p){ if (awardScore(p, false) >= 22) honour(G, T(G, p.tid), p); }

/* ----------------------------- eras ----------------------------- */
const ERAS = { "1": ["The passing boom", "New rules protect receivers and quarterbacks. Expect bigger passing numbers."], "0": ["A balanced game", "The rule book settles. Neither side of the ball has the edge."], "-1": ["Defense strikes back", "Officials let them play. Sacks and interceptions climb, passing dips."] };
function eraShift(G){
  const cur = G.era ? G.era.k : 0; if (G.year - (G.era ? G.era.y : G.year - 2) < 4 || !chance(.4)) return;
  const k = pick([-1, 0, 1].filter(x => x !== cur)); G.era = { k, y: G.year + 1 }; (G.eras = G.eras || []).unshift({ y: G.year + 1, k });
  news(G, `RULE CHANGE: ${ERAS[k][0]}. ${ERAS[k][1]}`, "off");
}
