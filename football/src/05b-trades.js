
/* =========================================================================
   Trades (pro league): player and pick values, the AI's yes/no, deadline deals
   ========================================================================= */
const TRADE_DEADLINE = 9;   // last pro week a trade can be made
// Next draft's picks that have changed hands: "round-originalTeam" -> owner.
function applyPickOwn(G, order, keep){
  const own = G.pickOwn || {}, out = [];
  for (let r = 1; r <= 7; r++) order.forEach(o => out.push(own[r + "-" + o] != null ? own[r + "-" + o] : o));
  if (!keep) G.pickOwn = {};
  return out;
}
const tradeOpen = G => G.phase === "off" ? G.offStep <= 3 && !(G.draft && G.draft.done) : G.week <= TRADE_DEADLINE;
const pickVal = pk => 62 * Math.pow(.972, pk - 1) + 1.2;
function playerVal(p){
  if (!p || p.pos === "K" || p.pos === "P") return p ? Math.max(.3, (p.ovr - 70) * .12) : 0;
  const a = p.age, age = a <= 25 ? 1.1 : a <= 28 ? 1 : a === 29 ? .85 : a === 30 ? .68 : a === 31 ? .52 : a === 32 ? .38 : .22;
  const base = Math.pow(Math.max(0, p.ovr - 64) / 26, 2.2) * 80, up = a <= 25 ? Math.max(0, p.pot - p.ovr) * .9 : 0;
  return +((base * age + up) * (p.pos === "QB" ? 1.5 : p.pos === "RB" ? (a >= 28 ? .7 : .9) : 1)).toFixed(1);
}
// Every pick a team holds in the next draft: live slots once the board is set, otherwise projected.
function teamPicks(G, tid){
  const d = G.draft;
  if (d && !d.done) { const o = []; for (let i = d.pick; i < d.order.length; i++) if (d.order[i] === tid) o.push({ k: "s", i, rd: Math.ceil((i + 1) / 32), pk: i + 1, v: +pickVal(i + 1).toFixed(1), label: `Rd ${Math.ceil((i + 1) / 32)} · No. ${i + 1}` }); return o; }
  if (G.phase === "off") return [];
  const base = G.pro.slice().sort((a, b) => winPct(a) - winPct(b) || (a.pf - a.pa) - (b.pf - b.pa)).map(t => t.id), own = G.pickOwn || {}, o = [];
  for (let r = 1; r <= 7; r++) base.forEach((orig, j) => { const holder = own[r + "-" + orig] != null ? own[r + "-" + orig] : orig; if (holder === tid) { const pk = (r - 1) * 32 + j + 1; o.push({ k: "f", rd: r, orig, pk, v: +(pickVal(pk) * .92).toFixed(1), label: `${G.year + 1} Rd ${r}` + (orig !== tid ? ` (via ${T(G, orig).abbr})` : "") }); } });
  return o;
}
const assetVal = a => a.p ? playerVal(a.p) : a.v;
// What a player is worth to one particular team: more if he'd start, less if he'd sit.
function fitVal(G, p, tid){
  const d = depthChart(G, tid)[p.pos], st = d[STARTERS[p.pos] - 1], v = playerVal(p);
  return v * (!st || st.ovr < p.ovr - 1 ? 1.15 : d[0] && d[0].ovr > p.ovr + 4 ? .8 : 1);
}
// give / get are from the user's side: arrays of {p} or pick assets. Returns the other team's view.
function evalTrade(G, tid, give, get){
  const ut = userTeam(G), inV = sum(give, a => a.p ? fitVal(G, a.p, tid) : a.v), outV = sum(get, a => a.p ? playerVal(a.p) * 1.06 : a.v * 1.05);
  const sal = xs => sum(xs.filter(a => a.p), a => a.p.c ? a.p.c.amt : 0), nP = xs => xs.filter(a => a.p).length;
  const theirCap = capRoom(G, tid) - sal(give) + sal(get), myCap = capRoom(G, ut.id) - sal(get) + sal(give);
  const theirN = rosterOf(G, tid).length + nP(give) - nP(get), myN = rosterOf(G, ut.id).length + nP(get) - nP(give);
  let why = "";
  if (!give.length && !get.length) why = "Put something on the table.";
  else if (!tradeOpen(G)) why = "The trade window is closed.";
  else if (theirCap < 0 && sal(give) > sal(get)) why = `The ${T(G, tid).nick} can't fit that under the cap.`;
  else if (myCap < 0 && sal(get) > sal(give)) why = "You can't fit that under your cap.";
  else if (theirN > 60 || myN > 60) why = "That leaves a roster over 60 players.";
  else if (theirN < 44 || myN < 44) why = "That leaves a roster too thin.";
  const ratio = outV > 0 ? inV / outV : inV > 0 ? 9 : 0;
  return { inV: +inV.toFixed(1), outV: +outV.toFixed(1), ratio, ok: !why && ratio >= 1, why };
}
function movePick(G, a, to){
  if (a.k === "s") G.draft.order[a.i] = to; else { G.pickOwn = G.pickOwn || {}; G.pickOwn[a.rd + "-" + a.orig] = to; }
}
function doTrade(G, tidA, tidB, fromA, fromB, quiet){
  const A = T(G, tidA), B = T(G, tidB), txt = xs => xs.map(a => a.p ? `${a.p.pos} ${pname(a.p)}` : a.label.replace(/ \(via.*/, "") + " pick").join(", ") || "nothing";
  const send = (xs, from, to) => xs.forEach(a => { if (a.p) { moveP(G, a.p, to.id); a.p.tx.push([G.year, `Traded to the ${to.city} ${to.nick} by the ${from.nick}`]); if (G.dc) POS.forEach(k => { if (G.dc[k]) G.dc[k] = G.dc[k].filter(id => id !== a.p.id); }); } else movePick(G, a, to.id); });
  send(fromA, A, B); send(fromB, B, A); G._ros = null;
  const big = [...fromA, ...fromB].some(a => a.p && a.p.ovr >= 82) || isUser(G, tidA) || isUser(G, tidB);
  if (big && !quiet) news(G, `TRADE: the ${A.nick} send ${txt(fromA)} to the ${B.nick} for ${txt(fromB)}.`, "fa", isUser(G, tidB) ? tidB : tidA);
  (G.trades = G.trades || []).unshift({ y: G.year, w: G.phase === "off" ? 0 : G.week, a: tidA, b: tidB, ga: txt(fromA), gb: txt(fromB) }); if (G.trades.length > 60) G.trades.length = 60;
}
// Shop one of your players: the best package each interested team would give.
function shopPlayer(G, p){
  const out = [];
  G.pro.forEach(t => { if (t.id === G.uid) return; const want = fitVal(G, p, t.id) / 1.08; if (want < 1.5) return;
    if (capRoom(G, t.id) < (p.c ? p.c.amt : 0)) { const d = depthChart(G, t.id), give = rosterOf(G, t.id).filter(x => x.c && x.c.amt >= (p.c ? p.c.amt : 0) - capRoom(G, t.id) && playerVal(x) <= want && d[x.pos].indexOf(x) >= STARTERS[x.pos] - 1).sort((a, b) => playerVal(b) - playerVal(a))[0]; if (give) out.push({ tid: t.id, get: [{ p: give }], v: playerVal(give) }); return; }
    const picks = teamPicks(G, t.id).filter(a => a.v <= want).sort((a, b) => b.v - a.v), get = []; let v = 0;
    for (const a of picks) { if (get.length < 2 && v + a.v <= want) { get.push(a); v += a.v; } }
    if (get.length) out.push({ tid: t.id, get, v }); });
  return out.sort((a, b) => b.v - a.v).slice(0, 5);
}
// The rest of the league deals too: contenders buy veterans from teams going nowhere.
function aiTrades(G, n){
  const season = G.phase === "reg", teams = G.pro.filter(t => t.id !== G.uid), good = t => season ? winPct(t) >= .6 : (t.hist[t.hist.length - 1] || {}).w >= 10, bad = t => season ? winPct(t) <= .36 : (t.hist[t.hist.length - 1] || { w: 9 }).w <= 6;
  const sellers = shuffle(teams.filter(bad)), buyers = teams.filter(good); let made = 0;
  for (const s of sellers) { if (made >= n) break;
    const vets = rosterOf(G, s.id).filter(p => p.age >= 27 && p.ovr >= 79 && p.c && p.pos !== "K" && p.pos !== "P").sort((a, b) => b.ovr - a.ovr).slice(0, 4);
    for (const p of shuffle(vets)) { const v = playerVal(p);
      const b = shuffle(buyers.slice()).find(t => capRoom(G, t.id) >= p.c.amt && rosterOf(G, t.id).length < 58 && (depthChart(G, t.id)[p.pos][STARTERS[p.pos] - 1] || { ovr: 0 }).ovr < p.ovr - 2 && teamPicks(G, t.id).some(a => a.v <= v * 1.1 && a.v >= v * .55));
      if (!b) continue; const pk = teamPicks(G, b.id).filter(a => a.v <= v * 1.1 && a.v >= v * .55).sort((x, y) => y.v - x.v)[0];
      doTrade(G, s.id, b.id, [{ p }], [pk]); made++; break; } }
  return made;
}
