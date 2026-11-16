
/* =========================================================================
   UI — the bigger visualizations: career arc, poll and Heisman races, bracket
   tree, program timeline, recruiting map, draft night, cap charts, trades
   ========================================================================= */
const MAJOR_AW = /Heisman Trophy$|Most Valuable|All-American|All-Pro|Pocket Bowl MVP|of the Year|Award$|Trophy$/;
const TOP_AW = /Heisman Trophy$|Most Valuable|Pocket Bowl MVP/;

/* ----------------------------- player: career arc + radar vs. his position ----------------------------- */
function CareerArc({ p, color }){
  const G = useUI().G, endY = p.ret || G.year, raw = p.ovh.slice(); if (!p.ret && (!raw.length || raw[raw.length - 1][0] < G.year)) raw.push([G.year, p.ovr]);
  if (raw.length < 2) return <div className="text-xs text-slate-500 py-3">His arc fills in after a season.</div>;
  const lvl = {}; p.hist.forEach(r => (lvl[r.y] = r.lvl)); const aw = {}; p.aw.forEach(a => { if (MAJOR_AW.test(a[1]) && !/Player of the Week|finalist/.test(a[1])) (aw[a[0]] || (aw[a[0]] = [])).push(a[1]); });
  const w = 320, h = 132, n = raw.length, X = i => 16 + i * (w - 32) / (n - 1), lo = Math.max(30, Math.min(...raw.map(r => r[1])) - 8), hi = Math.min(99, Math.max(p.pot || 0, ...raw.map(r => r[1])) + 6), Y = v => 16 + (1 - (v - lo) / Math.max(1, hi - lo)) * (h - 44);
  const peak = raw.reduce((m, r, i) => r[1] > raw[m][1] ? i : m, 0), step = n > 12 ? 2 : 1, d = raw.map((r, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(r[1]).toFixed(1)).join(" ");
  const pro = i => lvl[raw[i][0]] === "P" || (p.draft && raw[i][0] > p.draft.y - 1 && lvl[raw[i][0]] !== "C"), firstPro = raw.findIndex((_, i) => pro(i));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 240 }}>
      {firstPro > 0 && <g><rect x={X(firstPro) - (X(1) - X(0)) / 2} y="6" width={w - X(firstPro) + (X(1) - X(0)) / 2 - 4} height={h - 30} fill="#94a3b8" opacity=".06" rx="4" /><text x={X(firstPro) - (X(1) - X(0)) / 2 + 4} y="14" fontSize="7" fill="#64748b">PRO</text><text x="8" y="14" fontSize="7" fill="#8b7fd1">COLLEGE</text></g>}
      {!p.ret && p.pot > p.ovr && <g><line x1="12" x2={w - 12} y1={Y(p.pot)} y2={Y(p.pot)} stroke="#a78bfa" strokeDasharray="3 4" opacity=".7" /><text x={w - 12} y={Y(p.pot) - 3} fontSize="7" fill="#a78bfa" textAnchor="end">ceiling {p.pot}</text></g>}
      <path d={d + ` L${X(n - 1)} ${h - 26} L${X(0)} ${h - 26}Z`} fill={color} opacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" className="draw" />
      {raw.map((r, i) => { const a = aw[r[0]], top = a && a.some(x => TOP_AW.test(x)); return (
        <g key={i}>
          <circle cx={X(i)} cy={Y(r[1])} r={i === peak ? 4 : 2.6} fill={i === peak ? color : "#0f1626"} stroke={color} strokeWidth="1.8" />
          {(i === peak || i === n - 1 || i === 0) && <text x={X(i)} y={Y(r[1]) - 7} textAnchor="middle" fontSize="8" fontWeight="700" fill="#e2e8f0">{r[1]}</text>}
          {a && <text x={X(i)} y={Y(r[1]) - (i === peak || i === n - 1 || i === 0 ? 16 : 7)} textAnchor="middle" fontSize={top ? 11 : 8} fill={top ? "#facc15" : "#fbbf24"}><title>{r[0] + ": " + a.join(", ")}</title>★</text>}
          {i % step === 0 && <text x={X(i)} y={h - 14} textAnchor="middle" fontSize="7.5" fill="#94a3b8">{p.age - (endY - r[0])}</text>}
          {i % step === 0 && <text x={X(i)} y={h - 5} textAnchor="middle" fontSize="6.5" fill="#475569">'{String(r[0]).slice(2)}</text>}
        </g>); })}
    </svg>
  );
}
function RadarVs({ p, color }){
  const G = useUI().G, grp = GROUP(p.pos), pro = p.exp != null;
  const avg = useMemo(() => { const s = p.r.map(() => 0); let n = 0; for (const id in G.players) { const q = G.players[id]; if (q.pos !== p.pos || q.tid == null || q.ret || (q.exp != null) !== pro || !q.r || q.r.length !== p.r.length) continue; q.r.forEach((v, i) => (s[i] += v)); n++; } return n ? s.map(v => round(v / n)) : null; }, [p.id, G.year]);
  return <div className="text-center"><Radar vals={p.r} cmp={avg} labels={RLAB[grp]} color={color} /><div className="text-[10px] text-slate-500 -mt-1"><span style={{ color }}>■</span> him <span className="ml-2 text-slate-400">┄</span> average {pro ? "pro" : "college"} {p.pos}</div></div>;
}

/* ----------------------------- college: poll bump chart ----------------------------- */
function PollRace(){
  const ui = useUI(), G = ui.G, hist = G.pollHist, [n, setN] = useState(10), [hl, setHl] = useState(G.mode === "college" ? G.uid : null);
  if (!hist || hist.length < 2) return <div className="text-xs text-slate-500 py-3">The race takes shape after a couple of weeks.</div>;
  const last = hist[hist.length - 1], ids = last.slice(0, n).slice(); if (hl != null && !ids.includes(hl) && hist.some(wk => wk.indexOf(hl) >= 0 && wk.indexOf(hl) < n)) ids.push(hl);
  const w = 340, row = n === 10 ? 15 : 10.5, h = 16 + (n + 1) * row + 12, X = i => 22 + i * (w - 62) / (hist.length - 1), Y = r => 14 + r * row;
  const line = id => hist.map(wk => { const i = wk.indexOf(id); return i < 0 || i >= n ? n : i; });
  return (<div>
    <div className="flex items-center gap-1 mb-1">{[[10, "Top 10"], [25, "Top 25"]].map(([k, l]) => <button key={k} onClick={() => setN(k)} className={cx("px-2 py-0.5 rounded text-[11px] font-semibold", n === k ? "bg-acc text-slate-950" : "text-slate-400")}>{l}</button>)}<span className="text-[10px] text-slate-500 ml-auto">tap a team to trace it</span></div>
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[1, 5, 10, 15, 20, 25].filter(r => r <= n).map(r => <g key={r}><line x1="20" x2={w - 40} y1={Y(r - 1)} y2={Y(r - 1)} stroke="#1c2742" strokeDasharray="2 5" /><text x="3" y={Y(r - 1) + 3} fontSize="7" fill="#64748b">#{r}</text></g>)}
      <text x="3" y={Y(n) + 3} fontSize="6.5" fill="#475569">out</text>
      {hist.map((_, i) => (i % 2 === 0 || hist.length < 9) && <text key={i} x={X(i)} y={h - 2} fontSize="6.5" fill="#475569" textAnchor="middle">W{i + 1}</text>)}
      {ids.slice().sort((a, b) => (a === hl) - (b === hl)).map(id => { const t = T(G, id), pts = line(id), on = id === hl, fin = pts[pts.length - 1]; return (
        <g key={id} onClick={() => setHl(on ? null : id)} style={{ cursor: "pointer" }} opacity={hl == null || on ? 1 : .28}>
          <path d={pts.map((r, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(r).toFixed(1)).join(" ")} fill="none" stroke={brightOf(t)} strokeWidth={on ? 3.4 : fin < 3 ? 2.2 : 1.4} strokeLinejoin="round" strokeLinecap="round" className="draw" />
          {on && pts.map((r, i) => r < n && <circle key={i} cx={X(i)} cy={Y(r)} r="2.6" fill="#0b111e" stroke={brightOf(t)} strokeWidth="1.6" />)}
          <text x={X(hist.length - 1) + 5} y={Y(fin) + 3} fontSize={on ? 9 : 7.5} fontWeight="700" fill={brightOf(t)}>{t.abbr}</text>
        </g>); })}
    </svg>
  </div>);
}

/* ----------------------------- college: Heisman bar race ----------------------------- */
function HeismanRace(){
  const G = useUI().G, hist = (G.hwHist || []).map(wk => wk.map(e => Array.isArray(e) ? e : [e, null])), [wk, setWk] = useState(Math.max(0, hist.length - 1)), [play, setPlay] = useState(false);
  useEffect(() => { if (!play) return; if (wk >= hist.length - 1) { setPlay(false); return; } const t = setTimeout(() => setWk(wk + 1), 850); return () => clearTimeout(t); }, [play, wk, hist.length]);
  if (hist.length < 2) return <Empty>Check back in a couple of weeks.</Empty>;
  const cur = Math.min(wk, hist.length - 1), frame = hist[cur].slice(0, 6), all = [...new Set(hist.flatMap(f => f.slice(0, 6).map(e => e[0])))], max = Math.max(1, ...hist.flatMap(f => f.map(e => e[1] || 0))), rowH = 30;
  return (<div>
    <div className="flex items-center gap-2 mb-2"><button onClick={() => { if (cur >= hist.length - 1) setWk(0); setPlay(!play); }} className="w-8 h-8 rounded-full bg-acc text-slate-950 font-black text-sm shrink-0">{play ? "❚❚" : "▶"}</button>
      <input type="range" min="0" max={hist.length - 1} value={cur} onChange={e => { setPlay(false); setWk(+e.target.value); }} className="flex-1" /><div className="disp text-lg w-16 text-right">Wk {cur + 1}</div></div>
    <div className="relative" style={{ height: rowH * 6 }}>{all.map(id => { const p = G.players[id]; if (!p) return null; const i = frame.findIndex(e => e[0] === id), on = i >= 0, t = T(G, p.tid) || (p.col != null ? T(G, p.col) : null) || { c1: "#334155", c2: "#fff", abbr: "" }, s = on ? frame[i][1] : 0, wd = on ? (s != null ? clamp(s / max * 100, 8, 100) : 100 - i * 13) : 0; return (
      <div key={id} className="absolute left-0 right-0 flex items-center gap-2" style={{ top: (on ? i : 6) * rowH, height: rowH - 4, opacity: on ? 1 : 0, transition: "top .7s cubic-bezier(.2,.7,.2,1), opacity .5s", pointerEvents: on ? "auto" : "none" }}>
        <div className={cx("disp w-5 text-right", i === 0 ? "text-amber-300" : "text-slate-500")}>{i + 1}</div>
        <div className="flex-1 relative h-full rounded-md overflow-hidden bg-slate-800/60"><div className="absolute inset-y-0 left-0 rounded-md" style={{ width: wd + "%", background: `linear-gradient(90deg, ${t.c1}, ${brightOf(t)})`, transition: "width .7s cubic-bezier(.2,.7,.2,1)" }} />
          <div className="absolute inset-0 flex items-center gap-1.5 px-2 text-xs font-semibold" style={{ textShadow: "0 1px 2px rgba(0,0,0,.8)" }}><Badge t={t} size={15} /><PLink p={p} className="truncate" /><span className="text-[10px] font-normal text-slate-200/80">{p.pos}</span>{s != null && <span className="ml-auto tnum">{s}</span>}</div></div>
      </div>); })}</div>
    <div className="text-[11px] text-slate-500 mt-1">Press play to watch the race week by week. The number is each candidate's Heisman score that week.</div>
  </div>);
}

/* ----------------------------- bracket tree with winners' paths ----------------------------- */
function BracketTree({ rounds, seedOf, champ, champLabel }){
  const ui = useUI(), G = ui.G, W = 164, GAP = 30, CH = 50, ROW = 62;
  const cols = rounds.map(([title, ids]) => ({ title, games: (ids || []).map(id => gameById(G, id)).filter(Boolean) }));
  const H = Math.max(2, ...cols.map(c => c.games.length)) * ROW, pos = {};   // game id -> [col, y]
  // Lay columns out right to left so each winner's line runs straight into his next game.
  for (let ci = cols.length - 1; ci >= 0; ci--) { const c = cols[ci], nx = cols[ci + 1];
    if (nx && nx.games.length) { const key = c.games.map((g, i) => { const wid = g.done ? (g.hs > g.as ? g.h : g.a) : null, to = wid != null ? nx.games.find(q => q.h === wid || q.a === wid) : null; return [g, to ? pos[to.id][1] + (to.h === wid ? -1 : 1) : 1e6 + i, i]; }); c.games = key.sort((x, y) => x[1] - y[1] || x[2] - y[2]).map(k => k[0]); }
    c.games.forEach((g, i) => (pos[g.id] = [ci, H * (i + .5) / c.games.length])); }
  const X = ci => ci * (W + GAP), links = [];
  cols.forEach((c, ci) => { const nx = cols[ci + 1]; if (!nx) return; c.games.forEach(g => { if (!g.done) return; const wid = g.hs > g.as ? g.h : g.a, to = nx.games.find(q => q.h === wid || q.a === wid); if (!to) return; const y1 = pos[g.id][1] + (wid === g.h ? -11 : 11), y2 = pos[to.id][1] + (to.h === wid ? -11 : 11), x1 = X(ci) + W, x2 = X(ci + 1); links.push([`M${x1} ${y1} C${x1 + GAP * .6} ${y1}, ${x2 - GAP * .6} ${y2}, ${x2} ${y2}`, brightOf(T(G, wid)), g.id]); }); });
  const ct = champ != null ? T(G, champ) : null, total = cols.length * (W + GAP) + 150;
  return (
    <div className="overflow-x-auto pb-2"><div className="relative" style={{ width: total, height: H + 22 }}>
      {cols.map((c, ci) => <div key={ci} className="absolute text-[10px] uppercase tracking-widest text-slate-500 text-center" style={{ left: X(ci), width: W, top: 0 }}>{c.title}</div>)}
      <svg className="absolute left-0" style={{ top: 22 }} width={total} height={H}>{links.map(([d, col, id], i) => <path key={id} d={d} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" className="draw" style={{ animationDelay: 200 + i * 90 + "ms" }} />)}</svg>
      {cols.map((c, ci) => c.games.length ? c.games.map(g => { const Hm = T(G, g.h), A = T(G, g.a); return (
        <div key={g.id} onClick={() => g.done && ui.openGame(g.id)} className={cx("absolute card px-2 text-xs flex flex-col justify-center gap-0.5 pop", g.done ? "cursor-pointer hover:brightness-125" : "")} style={{ left: X(ci), width: W, top: 22 + pos[g.id][1] - CH / 2, height: CH, animationDelay: ci * 120 + "ms" }}>
          {[[Hm, g.hs, g.hs > g.as], [A, g.as, g.as > g.hs]].map(([t, s, won], i) => <div key={i} className={cx("flex items-center gap-1.5", g.done && !won ? "opacity-40" : "")}><span className="w-4 text-[9px] text-slate-500 tnum">{seedOf ? seedOf(t.id) || "" : ""}</span><Badge t={t} size={14} /><span className={cx("flex-1 truncate", won ? "font-bold" : "font-medium")}>{t.pro ? t.nick : t.name}</span><span className="tnum font-bold">{g.done ? s : ""}</span></div>)}
        </div>); }) : <div key={ci} className="absolute card border-dashed text-[11px] text-slate-500 flex items-center justify-center" style={{ left: X(ci), width: W, top: 22 + H / 2 - CH / 2, height: CH }}>To be decided</div>)}
      <div className="absolute flex flex-col items-center justify-center text-center" style={{ left: X(cols.length), width: 140, top: 22, height: H }}>
        {ct ? <div className="pop" style={{ animationDelay: "700ms" }}><div className="text-3xl">🏆</div><div className="my-1 flex justify-center"><Helmet t={ct} size={64} /></div><div className="disp text-lg leading-tight" style={{ color: brightOf(ct) }}>{ct.pro ? ct.nick : ct.name}</div><div className="text-[9px] uppercase tracking-widest text-amber-300/90 mt-0.5">{champLabel || "Champions"}</div></div>
          : <div className="text-slate-600"><div className="text-3xl opacity-40">🏆</div><div className="text-[10px] uppercase tracking-widest mt-1">Awaiting a champion</div></div>}
      </div>
    </div></div>
  );
}

/* ----------------------------- program / career timeline ----------------------------- */
function Timeline({ rows, pro, colorOf, max }){
  const G = useUI().G; if (!rows || !rows.length) return null;
  const BW = 30, BH = 96, top = max || (pro ? 17 : 15), hasPr = rows.some(r => r.pr), Yp = v => 22 + (1 - clamp((v - 40) / 59, 0, 1)) * BH;
  const icon = r => /National Champions|Won Pocket Bowl/.test(r.post || "") ? "🏆" : r.cc ? "🥇" : /^Won .*Bowl/.test(r.post || "") ? "🏟️" : /runner-up|Lost Pocket Bowl/.test(r.post || "") ? "🥈" : pro && r.post ? "✚" : "";
  return (<div>
    <div className="overflow-x-auto"><div className="relative" style={{ width: Math.max(rows.length * BW + 8, 120), height: BH + 62 }}>
      {rows.map((r, i) => { const c = colorOf ? colorOf(r) : "var(--acc)", champ = /National Champions|Won Pocket Bowl/.test(r.post || ""), bh = Math.max(3, r.w / top * BH); return (
        <div key={i} className="absolute text-center" style={{ left: 4 + i * BW, width: BW - 4, top: 0, height: BH + 62 }} title={`${r.y}: ${r.w}–${r.l}${r.post ? " · " + r.post : ""}${r.cc ? " · conference champions" : ""}`}>
          <div className="absolute left-0 right-0 text-[11px] leading-none" style={{ top: 22 + BH - bh - 16 }}>{icon(r)}</div>
          <div className="absolute left-0 right-0 rounded-t growY" style={{ top: 22 + BH - bh, height: bh, background: champ ? "linear-gradient(#fde047,#ca8a04)" : c, opacity: champ ? 1 : .85, animationDelay: i * 25 + "ms" }}>{r.rk ? <div className="text-[7.5px] font-black pt-0.5" style={{ color: champ ? "#111" : "#fff", textShadow: champ ? "none" : "0 1px 1px rgba(0,0,0,.7)" }}>#{r.rk}</div> : null}</div>
          <div className="absolute left-0 right-0 text-[8.5px] tnum text-slate-300" style={{ top: 22 + BH + 3 }}>{r.w}–{r.l}</div>
          <div className="absolute left-0 right-0 text-[8px] text-slate-500" style={{ top: 22 + BH + 15 }}>'{String(r.y).slice(2)}</div>
        </div>); })}
      {hasPr && <svg className="absolute left-0 top-0 pointer-events-none" width={rows.length * BW + 8} height={BH + 30}><path d={rows.map((r, i) => r.pr ? [4 + i * BW + (BW - 4) / 2, Yp(r.pr)] : null).filter(Boolean).map((q, i) => (i ? "L" : "M") + q[0] + " " + q[1].toFixed(1)).join(" ")} fill="none" stroke="#e879f9" strokeWidth="1.8" strokeDasharray="1 0" className="draw" />{rows.map((r, i) => r.pr ? <circle key={i} cx={4 + i * BW + (BW - 4) / 2} cy={Yp(r.pr)} r="2" fill="#e879f9" /> : null)}</svg>}
    </div></div>
    <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-x-3"><span>Bar = wins</span><span>🏆 title</span>{!pro && <span>🥇 conference title</span>}{!pro && <span>🏟️ bowl win</span>}{pro && <span>✚ playoffs</span>}{hasPr && <span><span style={{ color: "#e879f9" }}>━</span> prestige</span>}</div>
  </div>);
}

/* ----------------------------- recruiting map ----------------------------- */
const TILE_MAP = { AK: [0, 0], ME: [11, 0], VT: [9, 1], NH: [10, 1], WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3], CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5], OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6], HI: [0, 7], TX: [3, 7], FL: [8, 7] };
const stOf = p => (p.home || "").split(", ").pop();
function RecruitMap({ recs, sel, onSel }){
  const ui = useUI(), G = ui.G, ut = userTeam(G);
  const by = useMemo(() => { const m = {}; recs.forEach(p => { const s = stOf(p); (m[s] || (m[s] = [])).push(p); }); return m; }, [recs.length, G.year]);
  const pipe = useMemo(() => { const c = {}; rosterOf(G, ut.id).forEach(p => { const s = stOf(p); c[s] = (c[s] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, 4); }, [G.year, G.offStep]);
  const intr = useMemo(() => { const m = {}; Object.keys(by).forEach(s => by[s].slice(0, 3).forEach(p => (m[p.id] = recruitInterest(G, p)))); return m; }, [recs.length, G.pitchLeft, G.ivLeft]);
  const max = Math.max(1, ...Object.values(by).map(a => a.length)), C = 100 / 12;
  return (<div>
    <div className="relative mx-auto" style={{ maxWidth: 640, paddingBottom: "min(66.6%, 426px)" }}>{Object.keys(TILE_MAP).map(s => { const [x, y] = TILE_MAP[s], list = by[s] || [], n = list.length, on = sel === s, home = ut.state === s, pl = pipe.includes(s); return (
      <div key={s} onClick={() => n && onSel(on ? null : s)} className={cx("absolute rounded-md flex flex-col items-center justify-center transition-transform", n ? "cursor-pointer hover:scale-110 hover:z-10" : "opacity-40")} style={{ left: x * C + "%", top: y * 12.5 + "%", width: C - .6 + "%", height: "11.6%", background: n ? `color-mix(in srgb, var(--acc) ${round(12 + n / max * 62)}%, #111a2e)` : "#111a2e", outline: on ? "2px solid #fff" : home ? "2px solid #fbbf24" : pl ? "1px dashed #fbbf24aa" : "1px solid #1f2a44", outlineOffset: -1 }} title={`${s}: ${n} on the board${home ? " · your home state" : pl ? " · one of your pipelines" : ""}`}>
        <div className="text-[9px] sm:text-[10px] font-bold leading-none" style={{ textShadow: "0 1px 2px rgba(0,0,0,.9)" }}>{s}</div>
        {n > 0 && <div className="flex gap-px mt-0.5">{list.slice(0, 3).map(p => { const v = intr[p.id] || 0; return <span key={p.id} className="rounded-full" style={{ width: 3 + (p.stars || 2), height: 3 + (p.stars || 2), background: v >= 66 ? "#4ade80" : v >= 40 ? "#fbbf24" : "#f87171", boxShadow: G.pitches[p.id] ? "0 0 0 1.5px #fff" : "none" }} />; })}</div>}
        {n > 0 && <div className="text-[7.5px] text-white/80 tnum leading-none mt-0.5" style={{ textShadow: "0 1px 2px rgba(0,0,0,.9)" }}>{n}</div>}
      </div>); })}</div>
    <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-x-3 justify-center"><span>Brighter = more prospects</span><span>Dots: each state's top three, bigger = more stars</span><span><span className="text-emerald-400">●</span> likes you <span className="text-amber-400">●</span> in the mix <span className="text-rose-400">●</span> long shot</span><span><span className="text-amber-300">▢</span> home state · dashed = your pipelines</span><span>Tap a state to filter the board</span></div>
  </div>);
}

/* ----------------------------- depth chart on the field, tap to swap ----------------------------- */
const FIELD_SPOTS = [["WR", 0, 8, 62], ["OT", 0, 30, 60], ["OG", 0, 40, 60], ["C", 0, 50, 60], ["OG", 1, 60, 60], ["OT", 1, 70, 60], ["TE", 0, 80, 62], ["WR", 1, 92, 62], ["WR", 2, 20, 68], ["QB", 0, 50, 72], ["RB", 0, 50, 86], ["K", 0, 90, 90], ["P", 0, 10, 90],
  ["DE", 0, 28, 46], ["DT", 0, 43, 46], ["DT", 1, 57, 46], ["DE", 1, 72, 46], ["LB", 0, 30, 34], ["LB", 1, 50, 32], ["LB", 2, 70, 34], ["CB", 0, 8, 38], ["CB", 1, 92, 38], ["S", 0, 36, 16], ["S", 1, 64, 16]];
function FieldDepth({ tid }){
  const ui = useUI(), G = ui.G, d = depthChart(G, tid), t = T(G, tid), edit = tid === G.uid, [sel, setSel] = useState(null);
  const cur = sel ? d[sel[0]] : [], put = j => { const [pos, i] = sel; if (j === i) return; ui.act(G => { const ids = depthChart(G, tid)[pos].map(p => p.id); [ids[i], ids[j]] = [ids[j], ids[i]]; (G.dc = G.dc || {})[pos] = ids; }); };
  return (<div>
    <div className="relative rounded-xl overflow-hidden" style={{ background: "linear-gradient(#0d3b1f,#14532d)", paddingBottom: "92%" }}>
      {[10, 30, 50, 70, 90].map(y => <div key={y} className="absolute left-0 right-0 border-t border-white/15" style={{ top: y + "%" }} />)}
      <div className="absolute left-0 right-0 border-t-2 border-amber-300/70" style={{ top: "53%" }} />
      <div className="absolute left-2 text-[9px] uppercase tracking-widest text-white/50" style={{ top: "3%" }}>Defense</div><div className="absolute left-2 text-[9px] uppercase tracking-widest text-white/50" style={{ top: "94%" }}>Offense</div>
      {FIELD_SPOTS.map(([pos, i, x, y], k) => { const p = d[pos][i], on = sel && sel[0] === pos && sel[1] === i, same = sel && sel[0] === pos; return (
        <div key={k} onClick={() => p && (edit ? setSel(on ? null : [pos, i]) : ui.openPlayer(p.id))} className="absolute -translate-x-1/2 -translate-y-1/2 text-center cursor-pointer pop" style={{ left: x + "%", top: y + "%", animationDelay: k * 18 + "ms", opacity: sel && !same ? .45 : 1, transition: "opacity .2s" }}>
          <div className={cx("mx-auto w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[11px] font-black border-2", on && "pulse")} style={{ background: t.c1, color: inkOn(t.c1), borderColor: on ? "#fff" : p && p.inj ? "#f87171" : t.c2, transform: on ? "scale(1.2)" : "none", transition: "transform .2s" }}>{p ? p.ovr : "—"}</div>
          <div className="text-[8px] sm:text-[9px] leading-tight mt-0.5 text-white drop-shadow font-semibold whitespace-nowrap">{pos} {p ? p.ln : ""}</div>
        </div>); })}
    </div>
    {edit && <div className="card p-3 mt-2">{sel ? <div className="page-in" key={sel.join()}>
      <div className="flex items-center justify-between mb-2"><div className="text-xs text-slate-300">Who starts at <b className="text-white">{sel[0]}{STARTERS[sel[0]] > 1 ? " " + (sel[1] + 1) : ""}</b>? Tap a player to put him there.</div><span className="flex gap-2 text-[11px]">{G.dc && G.dc[sel[0]] && <span className="link text-amber-300" onClick={() => ui.act(G => { delete G.dc[sel[0]]; })}>Auto</span>}<span className="link text-slate-400" onClick={() => setSel(null)}>Done</span></span></div>
      <div className="flex flex-wrap gap-1.5">{cur.map((p, j) => <div key={p.id} onClick={() => !p.inj && put(j)} className={cx("px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 border", j === sel[1] ? "border-white bg-white/10" : j < STARTERS[sel[0]] ? "border-[color:var(--acc)]/50 bg-white/5 cursor-pointer" : "border-[#26324f] cursor-pointer hover:bg-white/5", p.inj && "opacity-50 cursor-not-allowed")}>
        <Ovr v={p.ovr} /><span className="font-semibold">{p.ln}</span><span className="text-[10px] text-slate-500">{t.pro ? "age " + p.age : CLS[p.cls]}{p.inj ? " · INJ" : ""}{j < STARTERS[sel[0]] ? " · starts" : ""}</span><span className="text-slate-500 hover:text-white" onClick={e => { e.stopPropagation(); ui.openPlayer(p.id); }}>ⓘ</span></div>)}</div>
    </div> : <div className="text-[11px] text-slate-400">Tap anyone on the field to change who starts there. {G.dc && Object.keys(G.dc).length ? <span className="link text-amber-300" onClick={() => ui.act(G => { G.dc = {}; })}>Reset everything to best available</span> : "By default the best healthy player starts."}</div>}</div>}
  </div>);
}

/* ----------------------------- draft night ----------------------------- */
function DraftNight(){
  const ui = useUI(), G = ui.G, d = G.draft, log = d.log, [i, setI] = useState(Math.max(0, log.length - 1)), [play, setPlay] = useState(false), prev = useRef(log.length);
  useEffect(() => { if (log.length > prev.current) { setI(Math.min(prev.current, log.length - 1)); setPlay(true); } prev.current = log.length; }, [log.length]);
  useEffect(() => { if (!play) return; if (i >= log.length - 1) { setPlay(false); return; } const t = setTimeout(() => setI(i + 1), log[i][0] <= 32 ? 1900 : 750); return () => clearTimeout(t); }, [play, i, log.length]);
  if (!log.length) return null;
  const k = Math.min(i, log.length - 1), r = log[k], t = T(G, r[1]), ct = r[5] != null ? T(G, r[5]) : null, p = G.players[r[2]], rank = r[6] || 0, v = rank ? clamp((r[0] - rank) / Math.sqrt(r[0] + 8), -6, 6) : null;
  const verdict = v == null ? "" : v >= 2 ? "Steal" : v >= .7 ? "Good value" : v <= -2 ? "Reach" : v <= -.7 ? "A little early" : "Right on the board", vc = v == null ? "#94a3b8" : v >= .7 ? "#4ade80" : v <= -.7 ? "#f87171" : "#fbbf24";
  const later = log.slice(k + 1).filter(x => x[6]).sort((a, b) => a[6] - b[6]).slice(0, 6).map(x => [x[6], x[4], x[3]]), pool = !d.done && d.rank ? d.pool.slice(0, 6 - later.length).map(id => G.players[id]).filter(Boolean).map(q => [d.rank[q.id], q.pos, pname(q)]) : [], best = [...later, ...pool].sort((a, b) => a[0] - b[0]).slice(0, 6);
  const mine = t.id === G.uid, myGuy = ct && ct.id === G.uid;
  return (
    <div className="card overflow-hidden mb-3" style={{ borderColor: mine || myGuy ? "#fbbf24" : undefined }}>
      <div key={r[0]} className="relative p-4 overflow-hidden" style={{ background: `linear-gradient(110deg, ${t.c1} 0%, ${t.c1}aa 38%, #0b111e 78%)` }}>
        <div className="absolute -right-2 -top-6 disp select-none opacity-[.14]" style={{ fontSize: 150, color: t.c2 }}>{r[0]}</div>
        <div className="relative flex items-center gap-4">
          <div className="pop"><Helmet t={t} size={72} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[.3em] fade-in" style={{ color: "#ffffffcc" }}>Round {Math.ceil(r[0] / 32)} · Pick {r[0]} · {t.city} {t.nick}{mine ? " · your pick" : myGuy ? " · your player" : ""}</div>
            <div className="text-[11px] tracking-[.35em] uppercase text-amber-300 font-bold mt-1 rise">The pick is in</div>
            <div className="disp text-3xl sm:text-4xl truncate rise" style={{ animationDelay: "350ms" }}><PLink pid={r[2]} name={r[3]} /></div>
            <div className="flex items-center gap-2 text-xs text-slate-200 mt-1 rise" style={{ animationDelay: "550ms" }}><span className="px-1.5 py-0.5 rounded bg-black/40 font-bold">{r[4]}</span>{ct && <span className="inline-flex items-center gap-1"><Badge t={ct} size={14} />{ct.name}</span>}{p && <span className="text-slate-300">· rookie rating <b className="text-white">{p.ovr}</b>, ceiling <b className="text-white">{p.pot}</b></span>}</div>
          </div>
        </div>
        {v != null && <div className="relative mt-3 rise" style={{ animationDelay: "750ms" }}>
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-300/80"><span>Reach</span><span className="font-bold" style={{ color: vc }}>{verdict} · board No. {rank}</span><span>Steal</span></div>
          <div className="relative h-2 rounded-full mt-1" style={{ background: "linear-gradient(90deg,#f87171,#fbbf24 50%,#4ade80)" }}><div className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-900" style={{ left: `calc(${50 + v / 6 * 50}% - 7px)`, transform: "translateY(-50%)", transition: "left .6s cubic-bezier(.2,.7,.2,1)" }} /></div>
        </div>}
      </div>
      <div className="px-3 py-2 flex items-center gap-2 border-t border-[#1f2a44]">
        <div className="flex gap-1 shrink-0">{[["⏮", () => { setPlay(false); setI(0); }], ["◀", () => { setPlay(false); setI(Math.max(0, k - 1)); }], [play ? "❚❚" : "▶", () => { if (k >= log.length - 1) setI(0); setPlay(!play); }], ["▶|", () => { setPlay(false); setI(Math.min(log.length - 1, k + 1)); }], ["⏭", () => { setPlay(false); setI(log.length - 1); }]].map(([l, f], j) => <button key={j} onClick={f} className={cx("w-8 h-7 rounded-md text-xs font-bold", j === 2 ? "bg-acc text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10")}>{l}</button>)}</div>
        <div className="text-[10px] text-slate-500 tnum shrink-0">{k + 1}/{log.length}</div>
        {best.length > 0 && <div className="flex-1 min-w-0 overflow-hidden"><div className="flex gap-3 text-[11px] whitespace-nowrap overflow-x-auto"><span className="text-amber-300 font-bold uppercase tracking-widest text-[9px] self-center">Best available</span>{best.map(b => <span key={b[0]} className="text-slate-300"><span className="text-slate-500 tnum">{b[0]}.</span> <b>{b[1]}</b> {b[2]}</span>)}</div></div>}
      </div>
    </div>
  );
}

/* ----------------------------- pro: cap and roster-age charts ----------------------------- */
const GRP_COL = { QB: "#f87171", RB: "#fb923c", WR: "#facc15", TE: "#a3e635", OL: "#34d399", DL: "#22d3ee", LB: "#60a5fa", DB: "#a78bfa", KP: "#94a3b8" };
function CapCharts({ tid }){
  const G = useUI().G, ros = rosterOf(G, tid).filter(p => p.c), grp = {}; ros.forEach(p => { const g = GROUP(p.pos); (grp[g] || (grp[g] = { $: 0, n: 0 })); grp[g].$ += p.c.amt; grp[g].n++; });
  const pay = sum(ros, p => p.c.amt), keys = Object.keys(GRP_COL).filter(g => grp[g]), scale = Math.max(CAP, pay);
  const yrs = [0, 1, 2, 3, 4].map(k => ({ y: G.year + k, $: sum(ros.filter(p => p.c.yrs > k), p => p.c.amt), out: ros.filter(p => p.c.yrs === k + 1) })), ymax = Math.max(CAP, ...yrs.map(x => x.$));
  const ages = {}; ros.forEach(p => { const a = clamp(p.age, 21, 35); (ages[a] || (ages[a] = [])).push(p); }); const amax = Math.max(1, ...Object.values(ages).map(a => a.length)), avgAge = ros.length ? (sum(ros, p => p.age) / ros.length).toFixed(1) : "—";
  return (<div className="grid md:grid-cols-2 gap-3">
    <Card title="Where the cap goes" right={money(pay) + " of " + money(CAP)} className="md:col-span-2">
      <div className="flex h-7 rounded-lg overflow-hidden bg-slate-800">{keys.map(g => <div key={g} className="grow h-full flex items-center justify-center text-[9px] font-black text-slate-950" style={{ width: grp[g].$ / scale * 100 + "%", background: GRP_COL[g] }} title={`${g}: ${money(grp[g].$)}`}>{grp[g].$ / scale > .06 ? g : ""}</div>)}</div>
      <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 mt-2">{keys.map(g => <div key={g} className="text-center"><div className="text-[10px] font-bold" style={{ color: GRP_COL[g] }}>{g}</div><div className="text-xs font-bold tnum">{money(grp[g].$)}</div><div className="text-[9px] text-slate-500">{grp[g].n} players · {round(grp[g].$ / Math.max(1, pay) * 100)}%</div></div>)}</div>
    </Card>
    <Card title="Money already committed" right="by season">
      <div className="flex items-end gap-2 h-32 relative"><div className="absolute left-0 right-0 border-t border-dashed border-rose-400/60 text-[8px] text-rose-300" style={{ bottom: CAP / ymax * 84 + "%" }}>cap</div>
        {yrs.map((x, i) => <div key={x.y} className="flex-1 h-full flex flex-col justify-end items-center"><div className="text-[9px] tnum text-slate-300 mb-0.5">{money(x.$)}</div><div className="w-full rounded-t growY" style={{ height: Math.max(1, x.$ / ymax * 84) + "%", background: i === 0 ? "var(--acc)" : "color-mix(in srgb, var(--acc) " + (70 - i * 13) + "%, #1c2742)", animationDelay: i * 60 + "ms" }} /></div>)}</div>
      <div className="flex gap-2 mt-1">{yrs.map(x => <div key={x.y} className="flex-1 text-center"><div className="text-[10px] text-slate-400">'{String(x.y).slice(2)}</div><div className="text-[9px] text-slate-500" title={x.out.map(p => p.pos + " " + pname(p)).join(", ")}>{x.out.length} expire</div></div>)}</div>
      {yrs[0].out.length > 0 && <div className="text-[11px] text-slate-400 mt-2">Up after this season: {yrs[0].out.sort((a, b) => b.ovr - a.ovr).slice(0, 6).map((p, i) => <span key={p.id}>{i ? ", " : ""}<PLink p={p} /> <span className="text-slate-500">{p.pos} {p.ovr}</span></span>)}{yrs[0].out.length > 6 ? "…" : ""}</div>}
    </Card>
    <Card title="Roster by age" right={"average " + avgAge}>
      <div className="flex items-end gap-1 h-32">{Array.from({ length: 15 }, (_, i) => 21 + i).map((a, i) => { const l = ages[a] || [], av = l.length ? sum(l, p => p.ovr) / l.length : 0; return <div key={a} className="flex-1 h-full flex flex-col justify-end items-center" title={l.map(p => `${p.pos} ${pname(p)} ${p.ovr}`).join("\n")}><div className="text-[8px] text-slate-400">{l.length || ""}</div><div className="w-full rounded-t growY" style={{ height: l.length / amax * 86 + "%", background: l.length ? ovrColor(av) : "transparent", animationDelay: i * 30 + "ms" }} /></div>; })}</div>
      <div className="flex gap-1 mt-1">{Array.from({ length: 15 }, (_, i) => 21 + i).map(a => <div key={a} className="flex-1 text-center text-[8px] text-slate-500">{a === 21 ? "≤21" : a === 35 ? "35+" : a}</div>)}</div>
      <div className="text-[10px] text-slate-500 mt-1">Bar colour is the average rating at that age — gold and green are your best players.</div>
    </Card>
  </div>);
}

/* ----------------------------- pro: trades ----------------------------- */
const akey = a => a.p ? "p" + a.p.id : a.k === "s" ? "s" + a.i : "f" + a.rd + "-" + a.orig;
function TradeSide({ title, t, assets, picked, toggle, onShop }){
  const players = assets.filter(a => a.p), picks = assets.filter(a => !a.p), [f, setF] = useState("All");
  return (<Card title={title} right={<span className="inline-flex items-center gap-1.5"><Badge t={t} size={14} />{money(capRoom(useUI().G, t.id))} room</span>} pad={false}>
    <div className="px-3"><PosFilter value={f} onChange={setF} /></div>
    <div style={{ maxHeight: 330 }} className="overflow-y-auto"><table className="st tnum"><tbody>
      {players.filter(a => f === "All" || a.p.pos === f).map(a => { const p = a.p, on = picked.has(akey(a)); return <tr key={p.id} onClick={() => toggle(a)} className={cx("cursor-pointer", on ? "bg-amber-400/15" : "hover:bg-white/5")}><td className="l w-5">{on ? "☑" : "☐"}</td><td className="l font-bold text-slate-400 w-7">{p.pos}</td><td className="l"><PLink p={p} /></td><td className="text-slate-400">{p.age}</td><td><Ovr v={p.ovr} /></td><td className="text-slate-400">{p.c ? money(p.c.amt) : ""}</td><td className="w-16"><HBar v={playerVal(p)} max={80} color="#fbbf24" h={5} /></td>{onShop && <td><span className="link text-[10px] text-sky-300" onClick={e => { e.stopPropagation(); onShop(p); }}>Shop</span></td>}</tr>; })}
    </tbody></table></div>
    {picks.length > 0 && <div className="p-3 border-t border-[#1f2a44]"><div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Draft picks</div><div className="flex flex-wrap gap-1.5">{picks.map(a => { const on = picked.has(akey(a)); return <button key={akey(a)} onClick={() => toggle(a)} className={cx("px-2 py-1 rounded-md text-[11px] font-semibold border", on ? "bg-amber-400 text-slate-950 border-transparent" : "border-[#26324f] text-slate-300 hover:border-slate-400")}>{a.label}</button>; })}</div></div>}
  </Card>);
}
function TradePanel(){
  const ui = useUI(), G = ui.G, ut = userTeam(G), others = G.pro.filter(t => t.id !== ut.id), [tid, setTid] = useState(others[0].id), [give, setGive] = useState([]), [get, setGet] = useState([]), [shop, setShop] = useState(null), open = tradeOpen(G);
  const assetsOf = id => [...rosterOf(G, id).filter(p => p.c).sort((a, b) => playerVal(b) - playerVal(a)).map(p => ({ p })), ...teamPicks(G, id)];
  const mine = useMemo(() => assetsOf(ut.id), [G.week, G.offStep, (G.trades || []).length, G.draft && G.draft.pick]), theirs = useMemo(() => assetsOf(tid), [tid, G.week, G.offStep, (G.trades || []).length, G.draft && G.draft.pick]);
  const live = (xs, pool) => xs.filter(a => pool.some(b => akey(b) === akey(a))), gv = live(give, mine), gt = live(get, theirs), ev = evalTrade(G, tid, gv, gt), t = T(G, tid);
  const tog = (xs, set) => a => set(xs.some(b => akey(b) === akey(a)) ? xs.filter(b => akey(b) !== akey(a)) : [...xs, a]);
  const mood = !gv.length && !gt.length ? ["Build an offer", "#64748b"] : ev.why ? [ev.why, "#f87171"] : ev.ratio >= 1.5 ? ["They'd say yes instantly — you're overpaying", "#38bdf8"] : ev.ratio >= 1 ? ["They'd do this deal", "#4ade80"] : ev.ratio >= .88 ? ["Close — they want a little more", "#fbbf24"] : ev.ratio >= .6 ? ["They want a lot more", "#fb923c"] : ["Not close", "#f87171"];
  const offers = useMemo(() => shop ? shopPlayer(G, shop) : [], [shop && shop.id, (G.trades || []).length]);
  const names = xs => xs.map(a => a.p ? `${a.p.pos} ${pname(a.p)} (${a.p.ovr}, age ${a.p.age})` : a.label).join(", ") || "—";
  return (<div className="space-y-3">
    {!open && <div className="card p-3 text-sm text-amber-200 bg-amber-400/5">{G.phase === "reg" ? `The trade deadline (week ${TRADE_DEADLINE}) has passed. Trading reopens in the offseason.` : "Trading reopens when the new season starts."}</div>}
    {open && <div className="card p-3">
      <div className="flex items-center gap-3 flex-wrap"><div className="text-sm">Trade with</div><Sel value={tid} onChange={v => { setTid(v == null ? others[0].id : v); setGet([]); }}>{others.map(x => <option key={x.id} value={x.id}>{tname(x)} ({x.w}–{x.l})</option>)}</Sel><div className="text-[11px] text-slate-400 ml-auto">{G.phase === "reg" ? `Deadline: week ${TRADE_DEADLINE}` : "Open until the draft ends"}</div></div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3 text-xs"><div><div className="text-[10px] uppercase tracking-widest text-slate-500">You send</div><div className="text-slate-200 mt-0.5">{names(gv)}</div></div><div><div className="text-[10px] uppercase tracking-widest text-slate-500">You get</div><div className="text-slate-200 mt-0.5">{names(gt)}</div></div></div>
      <div className="mt-3"><div className="flex justify-between text-[11px] mb-1"><span className="font-bold" style={{ color: mood[1] }}>{mood[0]}</span><span className="text-slate-500 tnum">their view: getting {ev.inV} · giving {ev.outV}</span></div>
        <div className="relative h-2.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: clamp(ev.ratio * 50, 0, 100) + "%", background: mood[1], transition: "width .4s, background .4s" }} /><div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/70" /></div></div>
      <div className="mt-3 flex gap-2"><Btn kind="pri" disabled={!ev.ok} onClick={() => { ui.act(G => doTrade(G, ut.id, tid, gv, gt)); ui.toast(`Trade done with the ${t.nick}.`); setGive([]); setGet([]); }}>Make the trade</Btn><Btn onClick={() => { setGive([]); setGet([]); }}>Clear</Btn></div>
    </div>}
    {open && shop && <Card title={`Shopping ${shop.pos} ${pname(shop)}`} right={<span className="link" onClick={() => setShop(null)}>close</span>}>{offers.length ? offers.map(o => { const ot = T(G, o.tid), e = evalTrade(G, o.tid, [{ p: shop }], o.get); return <div key={o.tid} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0 text-sm"><Badge t={ot} size={18} /><div className="flex-1 min-w-0"><div className="font-semibold truncate">{tname(ot)}</div><div className="text-[11px] text-slate-400 truncate">offer {names(o.get)}</div></div><Btn small kind="pri" disabled={!e.ok} onClick={() => { ui.act(G => doTrade(G, ut.id, o.tid, [{ p: shop }], o.get)); ui.toast(`${pname(shop)} traded to the ${ot.nick}.`); setShop(null); }}>Accept</Btn></div>; }) : <Empty>Nobody is offering anything for him right now.</Empty>}</Card>}
    {open && <div className="grid lg:grid-cols-2 gap-3"><TradeSide title={"Your " + ut.nick} t={ut} assets={mine} picked={new Set(gv.map(akey))} toggle={tog(give, setGive)} onShop={p => setShop(p)} /><TradeSide title={tname(t)} t={t} assets={theirs} picked={new Set(gt.map(akey))} toggle={tog(get, setGet)} /></div>}
    <Card title="Around the league" right="recent trades">{(G.trades || []).length ? G.trades.slice(0, 12).map((x, i) => { const a = T(G, x.a), b = T(G, x.b); return <div key={i} className="flex gap-2 py-1.5 border-b border-white/5 last:border-0 text-xs"><span className="text-slate-500 w-16 shrink-0 tnum">{x.y}{x.w ? " · wk " + x.w : " · off"}</span><div className="flex-1"><span className="inline-flex items-center gap-1 font-semibold"><Badge t={b} size={13} />{b.nick}</span> get {x.ga} <span className="text-slate-500">·</span> <span className="inline-flex items-center gap-1 font-semibold"><Badge t={a} size={13} />{a.nick}</span> get {x.gb}</div></div>; }) : <Empty>No trades yet. Things heat up at the deadline and before the draft.</Empty>}</Card>
    <div className="text-[11px] text-slate-500">The gold bar next to each player is his trade value. Teams pay more for a player who would start for them, and less for age. Tap “Shop” on one of your players to see what the league would give you.</div>
  </div>);
}
