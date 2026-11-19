#!/usr/bin/env node
/* Long-sim audit: plays N seasons and prints things a human should eyeball.  node tools/audit.js [years] [mode] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "simtest.js"), "utf8");
// Reuse simtest's loader without running its checks.
const loaderSrc = src.slice(src.indexOf("const ROOT"), src.indexOf("let fails")).replace(/const EXPORTS = \[/, 'const EXPORTS = ["depthChart","STARTERS","freeAgents","seen","draftValue",');
const load = new Function("require", "__dirname", "fs", "path", "vm", loaderSrc + "; return load();");
const A = load(require, __dirname, fs, path, vm);
const years = +process.argv[2] || 8, mode = process.argv[3] || "college";
const G = A.newGame({ seed: 5, mode });
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, f1 = v => v.toFixed(1);
const flags = [];
for (let y = 0; y < years; y++) {
  let g = 0; while (G.phase === "reg" && g++ < 40) A.simWeek(G);
  const yr = G.year, cp = A.colPlayers(G), pp = A.proPlayers(G);
  // two QBs with a starter's workload on one team
  let twoQB = 0, qbTeams = 0; [...G.col, ...G.pro].forEach(t => { const q = A.rosterOf(G, t.id).filter(p => p.pos === "QB" && (p.st.pa || 0) > 0).sort((a, b) => b.st.pa - a.st.pa); qbTeams++; if (q[1] && q[1].st.pa > q[0].st.pa * .35 && !q[0].st.gm && !q[0].inj) twoQB++; });
  const gsBad = [...cp, ...pp].filter(p => (p.st.gs || 0) > (p.st.g || 0)).length;
  const starters = t => { const d = A.depthChart(G, t.id); return Object.keys(d).flatMap(k => d[k].slice(0, A.STARTERS[k])); };
  const cs = G.cs.filter(x => x.done && x.a >= 0), ps = G.ps.filter(x => x.done);
  const top = (pool, k) => pool.slice().sort((a, b) => (b.st[k] || 0) - (a.st[k] || 0))[0];
  const h = G.hist.find(x => x.y === yr) || {};
  console.log(`\n=== ${yr} ===  natl champ ${A.T(G, h.natChamp).name} | Heisman ${h.heis[0].n} ${h.heis[0].pos} ${A.T(G, h.heis[0].tid).abbr} | Pocket Bowl ${A.T(G, h.proChamp).nick}`);
  console.log(`  pts/team col ${f1(avg(cs.map(x => x.hs + x.as)) / 2)} pro ${f1(avg(ps.map(x => x.hs + x.as)) / 2)} | starter ovr col ${f1(avg(G.col.flatMap(starters).map(p => p.ovr)))} pro ${f1(avg(G.pro.flatMap(starters).map(p => p.ovr)))} | players ${Object.keys(G.players).length}`);
  const L = (pool, k) => { const p = top(pool, k); return p ? `${p.st[k]}` : "-"; };
  console.log(`  col leaders py ${L(cp, "py")} ry ${L(cp, "ry")} rcy ${L(cp, "rcy")} sck ${L(cp, "sck")} int ${L(cp, "int")} | pro py ${L(pp, "py")} ry ${L(pp, "ry")} rcy ${L(pp, "rcy")} sck ${L(pp, "sck")} int ${L(pp, "int")}`);
  console.log(`  teams with two heavy-use QBs (no injury): ${twoQB}/${qbTeams} | gs>g rows: ${gsBad}`);
  const best = G.col.slice().sort((a, b) => b.w - a.w)[0], worstP = G.pro.slice().sort((a, b) => a.w - b.w)[0], bestP = G.pro.slice().sort((a, b) => b.w - a.w)[0];
  console.log(`  best col ${best.name} ${best.w}-${best.l} | pro best ${bestP.nick} ${bestP.w}-${bestP.l} worst ${worstP.nick} ${worstP.w}-${worstP.l} | unbeaten col ${G.col.filter(t => t.l === 0).length}`);
  if (twoQB > qbTeams * .08) flags.push(`${yr}: ${twoQB} teams split QB work without an injury`);
  if (gsBad) flags.push(`${yr}: ${gsBad} players with more starts than games`);
  g = 0; while (G.phase === "off" && g++ < 10) { if (G.offStep === 3) console.log(`  draft top5: ${G.draft.log.slice(0, 5).map(r => `${r[3]} ${r[4]} (${G.players[r[2]].ovr}/${G.players[r[2]].pot})`).join(", ")} | FA pool ${A.freeAgents(G).length}`); A.advanceOff(G); }
  const sizes = G.col.map(t => A.rosterOf(G, t.id).length), psz = G.pro.map(t => A.rosterOf(G, t.id).length);
  console.log(`  rosters col ${Math.min(...sizes)}-${Math.max(...sizes)} pro ${Math.min(...psz)}-${Math.max(...psz)} | payroll ${f1(Math.min(...G.pro.map(t => A.payroll(G, t.id))))}-${f1(Math.max(...G.pro.map(t => A.payroll(G, t.id))))} | class #1 ${A.T(G, G.classRank[0].tid).name}`);
  if (Math.max(...sizes) > 60 || Math.max(...psz) > 60) flags.push(`${yr}: oversized roster`);
}
// prestige drift: programs should stay within reach of where they started
const drift = G.col.filter(t => t.pr0 != null && Math.abs(t.prestige - t.pr0) >= 12).sort((a, b) => Math.abs(b.prestige - b.pr0) - Math.abs(a.prestige - a.pr0));
console.log(`\nprestige drift >= 12 after ${years} years (${drift.length} programs): ${drift.slice(0, 14).map(t => `${t.abbr} ${t.pr0}>${Math.round(t.prestige)}`).join(", ")}`);
if (drift.some(t => Math.abs(t.prestige - t.pr0) > 22)) flags.push(`prestige ran away: ${drift.filter(t => Math.abs(t.prestige - t.pr0) > 22).map(t => t.abbr).join(", ")}`);
// career paths
const all = Object.values(G.players); let aba = 0, abaNew = 0, colAba = 0, multiYearDup = 0, gaps = 0;
all.forEach(p => { const P = p.hist.filter(r => r.lvl === "P"), C = p.hist.filter(r => r.lvl === "C");
  for (let i = 2; i < P.length; i++) if (P[i].t === P[i - 2].t && P[i].t !== P[i - 1].t) { aba++; if (P[i - 1].y >= 2026) abaNew++; }
  for (let i = 2; i < C.length; i++) if (C[i].t === C[i - 2].t && C[i].t !== C[i - 1].t) colAba++;
  const ys = p.hist.map(r => r.y + r.lvl); if (new Set(ys).size !== ys.length) multiYearDup++;
  if (C.length > 5) gaps++; });
console.log(`\n=== careers (${all.length} players) ===`);
console.log(`  pro A→B→A one-year hops: ${aba} (of which in simulated years: ${abaNew}) | college A→B→A: ${colAba} | duplicate season rows: ${multiYearDup} | >5 college seasons: ${gaps}`);
const champs = {}; G.hist.forEach(h => { const n = A.T(G, h.natChamp).name; champs[n] = (champs[n] || 0) + 1; }); console.log("  national titles: " + JSON.stringify(champs));
const pc = {}; G.hist.forEach(h => { const n = A.T(G, h.proChamp).nick; pc[n] = (pc[n] || 0) + 1; }); console.log("  Pocket Bowls: " + JSON.stringify(pc));
console.log("  Heisman positions: " + G.hist.map(h => h.heis[0].pos).join(" "));
console.log("  ages pro: " + [22, 26, 30, 34, 38].map(a => a + "+:" + A.proPlayers(G).filter(p => p.age >= a && p.age < a + 4).length).join(" ") + " | HOF " + G.hof.length + " colHOF " + G.colHof.length);
console.log("  records col season: " + Object.entries(G.records.col).map(([k, r]) => k + " " + r.v).join(", "));
console.log("  records pro season: " + Object.entries(G.records.pro).map(([k, r]) => k + " " + r.v).join(", "));
console.log("  prestige top 6: " + G.col.slice().sort((a, b) => b.prestige - a.prestige).slice(0, 6).map(t => t.abbr + " " + Math.round(t.prestige)).join(", "));
if (aba) flags.push(`${aba} pro careers with a one-year A→B→A hop`); if (multiYearDup) flags.push(`${multiYearDup} players with duplicate season rows`); if (colAba) flags.push(`${colAba} college A→B→A hops`);
console.log("\n" + (flags.length ? "FLAGS:\n  " + flags.join("\n  ") : "No flags."));
