
/* ----------------------------- scouting, interviews, interest ----------------------------- */
// Stable 0..1 number per player and purpose, so a player's make-up never changes and needs no save data.
const hsh = (id, k) => ((((id + 1) * 2654435761 + k * 40503) >>> 0) % 1000) / 1000;
const TRAITS = [["we", "Work ethic"], ["ld", "Leadership"], ["iq", "Football IQ"], ["cl", "Composure"]];
const trait = (p, k) => 1 + Math.floor(hsh(p.id, TRAITS.findIndex(x => x[0] === k) + 1) * 5);
const redFlag = p => hsh(p.id, 9) < .06;
// What a recruit cares about most. It tilts where he signs, and you learn it on a visit.
const PRIOS = { home: "Staying close to home", prestige: "Playing for a big-time program", win: "Winning right away", coach: "Trusting the head coach" };
const prioOf = p => ["home", "prestige", "win", "coach"][Math.floor(hsh(p.id, 7) * 4)];
function prioBonus(p, t){
  const k = prioOf(p), h = t.hist[t.hist.length - 1];
  return k === "home" ? homeBonus(p, t) * .7 : k === "prestige" ? (t.prestige - 70) * .15 : k === "win" ? ((h ? h.w / Math.max(1, h.w + h.l) : .5) - .5) * 14 : (t.coach.ovr - 60) * .2;
}
// 0–100: how your school stacks up against the best offer he has.
function recruitInterest(G, p){
  const ut = userTeam(G), mine = schoolPull(G, p, ut, false), lead = recruitLeaders(G, p), top = lead.length ? lead[0][1] : mine;
  return clamp(round(60 + (mine - top) * 2.2), 3, 99);
}
// One sit-down: full ratings, his make-up, what he wants. Limited per year.
function interview(G, p){ if (G.scouted[p.id]) return true; if ((G.ivLeft || 0) <= 0) return false; G.ivLeft--; G.scouted[p.id] = 1; if (typeof checkCommit === "function") checkCommit(G, p); return true; }
function combine(p){
  const g = GROUP(p.pos), q = p.ovr - 70, n = k => hsh(p.id, k) - .5;
  const f0 = { QB: 4.82, RB: 4.52, WR: 4.48, TE: 4.72, OT: 5.2, OG: 5.26, C: 5.22, DE: 4.8, DT: 5.06, LB: 4.66, CB: 4.46, S: 4.53, K: 4.95, P: 4.95 }[p.pos];
  const b0 = { QB: 15, RB: 20, WR: 14, TE: 21, OL: 26, DL: 27, LB: 23, DB: 15, KP: 9 }[g] || 15;
  return { forty: (f0 - q * .0065 + n(12) * .16).toFixed(2), bench: Math.max(4, round(b0 + q * .22 + n(13) * 9)), vert: (32 + q * .16 + n(14) * 7 - (g === "OL" || g === "DL" ? 5 : 0)).toFixed(1), cone: (7.05 + (g === "OL" || g === "DL" ? .55 : 0) - q * .006 + n(15) * .3).toFixed(2) };
}
// Free agents: how much a player wants to sign with a team, and what it costs that team.
function faInterest(G, p, tid){
  const t = T(G, tid), h = t.hist[t.hist.length - 1], st = depthChart(G, tid)[p.pos][STARTERS[p.pos] - 1];
  return clamp(round(50 + ((h ? h.w / Math.max(1, h.w + h.l) : winPct(t)) - .5) * 45 + (!st || st.ovr < p.ovr ? 14 : -10) + (p.age >= 30 && h && /Bowl|Conf/.test(h.post || "") ? 8 : 0) + (hsh(p.id, 11) - .5) * 30), 5, 99);
}
const askFor = (G, p, tid) => +(askOf(G, p) * (1 + Math.max(0, 50 - faInterest(G, p, tid)) / 100 * .8)).toFixed(2);

/* --- mock drafts --- */
function draftOrderNow(G){
  if (G.draft && !G.draft.done) return G.draft.order.slice(G.draft.pick);
  const o = G.pro.slice().sort((a, b) => winPct(a) - winPct(b) || (a.pf - a.pa) - (b.pf - b.pa)).map(t => t.id);
  return applyPickOwn(G, o, true);
}
function prospects(G){
  if (G.draft && !G.draft.done) return G.draft.pool.map(id => G.players[id]).filter(Boolean);
  return colPlayers(G).filter(p => p.cls === 3 || (p.cls === 2 && draftValue(p) >= 77)).sort((a, b) => draftValue(b) - draftValue(a)).slice(0, 420);
}
// Project the next n picks from team needs and the consensus board. Changes nothing.
function mockDraft(G, n){
  const base = G.draft && !G.draft.done ? G.draft.pick : 0, order = draftOrderNow(G).slice(0, n || 32), pool = prospects(G).slice(0, order.length + 70), taken = new Set(), got = {}, salt = 20 + (G.week || 0) + (G.offStep || 0);
  return order.map((tid, i) => {
    const dc = depthChart(G, tid), rd = Math.ceil((base + i + 1) / 32); let best = null, bs = -1e9, bn = false;
    for (const p of pool) { if (taken.has(p.id)) continue; const have = dc[p.pos], st = have[STARTERS[p.pos] - 1], need = have.length < PRO_NEED[p.pos] || !st || st.ovr < proProj(p.ovr) + 3;
      const v = draftValue(p) + (need ? 2.5 : 0) - (p.pos === "QB" && have[0] && have[0].ovr >= 82 && have[0].age < 31 ? 7 : 0) - ((p.pos === "K" || p.pos === "P") && rd < 5 ? 20 : 0) - (got[tid + p.pos] ? 6 : 0) + (hsh(p.id, salt) - .5) * 2.6;
      if (v > bs) { bs = v; best = p; bn = need; } }
    if (!best) return null; taken.add(best.id); got[tid + best.pos] = 1;
    return { pk: base + i + 1, tid, p: best, need: bn };
  }).filter(Boolean);
}
// Where a pro team is thin: starter quality at each position against the league.
function teamNeeds(G, tid){
  const d = depthChart(G, tid), lg = {}; POS.forEach(pos => (lg[pos] = avgOf(G.pro, t => avgOf(depthChart(G, t.id)[pos].slice(0, STARTERS[pos]), p => p.ovr))));
  return POS.filter(p => p !== "K" && p !== "P").map(pos => { const st = d[pos].slice(0, STARTERS[pos]), v = avgOf(st, p => p.ovr); return { pos, v: round(v), lg: round(lg[pos]), gap: round(v - lg[pos]), age: round(avgOf(st, p => p.age)), n: d[pos].length }; }).sort((a, b) => a.gap - b.gap);
}
