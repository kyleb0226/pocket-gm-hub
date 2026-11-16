
/* =========================================================================
   UI — game day (plan, weather, rivalry, key calls), staff and facilities,
   NIL, deadline offers, combine, all-star game, what-if, greatest teams,
   compare players, season card
   ========================================================================= */
function Seg({ label, value, opts, onChange, hint }){
  return <div><div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-500 mb-1"><span>{label}</span>{hint && <span className="normal-case tracking-normal text-slate-500">{hint}</span>}</div>
    <div className="flex rounded-lg overflow-hidden border border-[#26324f]">{opts.map(([v, l]) => <button key={l} onClick={() => onChange(v)} className={cx("flex-1 px-2 py-1.5 text-[11px] font-semibold", Math.abs(value - v) < .35 ? "bg-acc text-slate-950" : "text-slate-300 hover:bg-white/5")}>{l}</button>)}</div></div>;
}
function PlanControls(){
  const ui = useUI(), G = ui.G, p = Object.assign(defaultPlan(G), G.plan || {}), set = (k, v) => ui.act(G => { G.plan = Object.assign(defaultPlan(G), G.plan || {}, { [k]: v }); });
  return <div className="grid sm:grid-cols-2 gap-3">
    <Seg label="Offense" value={p.pass} onChange={v => set("pass", v)} opts={[[-.8, "Run heavy"], [0, "Balanced"], [.8, "Pass heavy"]]} />
    <Seg label="Tempo" value={p.tempo} onChange={v => set("tempo", v)} opts={[[-.8, "Bleed clock"], [0, "Normal"], [.8, "Hurry-up"]]} />
    <Seg label="Defense" value={p.blitz} onChange={v => set("blitz", v)} opts={[[-.8, "Sit back"], [0, "Base"], [.8, "Blitz"]]} hint="blitz: more sacks, more big plays allowed" />
    <Seg label="Fourth downs" value={p.fourth} onChange={v => set("fourth", v)} opts={[[-.8, "Kick it"], [0, "By the book"], [.8, "Go for it"]]} />
  </div>;
}

/* ----------------------------- live key calls ----------------------------- */
function LiveCalls({ g, onClose }){
  const ui = useUI(), G = ui.G, [calls, setCalls] = useState(g._calls || []), [fin, setFin] = useState(null), [H, A] = gameTeams(G, g), home = isUser(G, g.h), me = home ? H : A, opp = home ? A : H;
  const res = useMemo(() => fin ? { r: fin } : coachGame(G, g, calls), [calls.length, fin]), n = res.need, r = res.r, sc = n ? n.sc : r.sc, mine = sc[home ? 0 : 1], theirs = sc[home ? 1 : 0];
  const clk = c => { const q = Math.min(4, Math.floor(c / 900) + 1), left = c >= 3600 ? 0 : 900 - (c % 900); return (c >= 3600 ? "OT" : "Q" + q) + " " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0"); };
  const spot = y => y >= 50 ? `${opp.abbr} ${100 - y}` : `your ${y}`, answer = a => { const next = [...calls, a]; ui.act(G => { const gg = gameById(G, g.id) || g; gg._calls = next; }); setCalls(next); };
  useEffect(() => { if (res.r && !fin && !g.done) { const rr = res.r; setFin(rr); ui.act(G => finishCoached(G, gameById(G, g.id) || g, rr)); } }, [res.r]);
  return (
    <Modal onClose={onClose} accent={[me.c1, me.c2]}>
      <div className="p-5" style={{ background: `linear-gradient(120deg, ${me.c1}55, #0b111e 65%)` }}>
        <div className="text-[10px] uppercase tracking-[.3em] text-slate-300">{n ? "Your call, coach" : "Final"}{calls.length ? ` · ${calls.length} call${calls.length > 1 ? "s" : ""} made` : ""}</div>
        <div className="flex items-center justify-center gap-5 mt-3"><div className="text-center"><Helmet t={me} size={54} /><div className="text-xs mt-1">{me.abbr}</div></div><div className="disp text-5xl tnum">{mine}<span className="text-slate-500 mx-2">–</span>{theirs}</div><div className="text-center"><Helmet t={opp} size={54} flip /><div className="text-xs mt-1">{opp.abbr}</div></div></div>
      </div>
      {n ? <div className="p-5 space-y-3" key={calls.length}>
        <div className="card p-3 rise"><div className="text-[10px] uppercase tracking-widest text-amber-300">{clk(n.clock)} · {mine > theirs ? "you lead by " + (mine - theirs) : mine < theirs ? "you trail by " + (theirs - mine) : "tied"}</div>
          <div className="disp text-2xl mt-1">{n.type === "4th" ? `4th & ${n.togo} at ${spot(n.y)}` : "Touchdown! Kick it or go for two?"}</div>
          {n.type === "4th" && <div className="text-xs text-slate-400 mt-1">{n.canFG ? `A field goal would be from ${n.fgDist} yards.` : "Out of field-goal range."}</div>}
          {n.last && n.last.length > 0 && <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">{n.last.map((t, i) => <div key={i}>{t}</div>)}</div>}</div>
        <div className="grid grid-cols-3 gap-2">{n.type === "4th" ? [["go", "Go for it", "Keep the offense out there"], ["fg", "Kick the field goal", n.canFG ? n.fgDist + " yards" : "Out of range", !n.canFG], ["punt", "Punt", "Flip the field"]].map(([k, l, d, off]) => <button key={k} disabled={off} onClick={() => answer(k)} className={cx("card p-3 text-left hover:brightness-125 active:scale-95 transition-transform", off && "opacity-40")}><div className="font-bold text-sm">{l}</div><div className="text-[11px] text-slate-400">{d}</div></button>)
          : [["kick", "Kick the extra point", "The safe point"], ["two", "Go for two", "About a coin flip"]].map(([k, l, d]) => <button key={k} onClick={() => answer(k)} className="card p-3 text-left hover:brightness-125 active:scale-95 transition-transform"><div className="font-bold text-sm">{l}</div><div className="text-[11px] text-slate-400">{d}</div></button>)}</div>
        <div className="text-[11px] text-slate-500">The game plays itself until a fourth-down or two-point decision is yours. Close this and the game waits for you.</div>
      </div> : <div className="p-5 space-y-3">
        <div className={cx("disp text-3xl text-center", mine > theirs ? "text-emerald-400" : "text-rose-400")}>{mine > theirs ? "You win" : "You lose"}{r.ot ? " in overtime" : ""}</div>
        <div className="space-y-1 max-h-56 overflow-y-auto">{r.smry.map((s, i) => <div key={i} className="flex gap-2 text-xs"><span className="w-7 text-slate-500">{s[0] > 4 ? "OT" : "Q" + s[0]}</span><span className="w-9 font-bold" style={{ color: brightOf(s[1] === 0 ? H : A) }}>{(s[1] === 0 ? H : A).abbr}</span><span className="flex-1 text-slate-300">{s[2]}</span><span className="tnum text-slate-400">{s[3]}–{s[4]}</span></div>)}</div>
        <div className="text-[11px] text-slate-500 text-center">This result is final and already in the books.</div>
        <Btn kind="pri" className="w-full" onClick={() => { onClose(); setTimeout(() => ui.openGame(g.id), 60); }}>See the box score</Btn>
      </div>}
    </Modal>
  );
}

/* ----------------------------- game day card ----------------------------- */
function GameDay({ g }){
  const ui = useUI(), G = ui.G, [live, setLive] = useState(false), [H, A] = gameTeams(G, g), home = isUser(G, g.h), me = home ? H : A, opp = home ? A : H;
  const wx = weatherFor(G, g), edges = useMemo(() => opp.fcs || g.done ? [] : matchupEdges(G, g), [g.id, G.week, g.done]), rv = g.riv != null ? G.riv.find(r => r.i === g.riv) : null, crowd = crowdOf(G, H);
  let streak = 0, holder = null; if (rv) for (const l of rv.last) { const w = l[2] > l[4] ? l[1] : l[3]; if (holder == null) holder = w; if (w !== holder) break; streak++; }
  if (g.done && !live) return <Card title="Your game is final"><ScoreCard g={g} /><div className="text-xs text-slate-400 mt-2">Advance to play the rest of the week's games.</div></Card>;
  const tip = edges.length ? (edges[0].v - edges[1].v >= 4 ? "Your passing game has the better matchup — lean on it." : edges[1].v - edges[0].v >= 4 ? "The run game has the better matchup — pound it." : edges[2].v < -4 ? "Their passing attack worries you. Blitzing could force mistakes — or get you burned." : "No glaring mismatch. Stay balanced.") : "";
  return (<div className="space-y-3">
    {rv && <div className="card p-3 relative overflow-hidden"><div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(110deg, ${T(G, rv.a).c1} 0 50%, ${T(G, rv.b).c1} 50% 100%)` }} />
      <div className="relative flex items-center gap-3 flex-wrap"><div className="text-3xl">🏆</div><div className="flex-1 min-w-0"><div className="text-[10px] uppercase tracking-[.25em] text-amber-300">Rivalry week · {rv.name}</div><div className="disp text-xl truncate">{rv.trophy}</div>
        <div className="text-xs text-slate-300">Series: {T(G, rv.a).abbr} {rv.aw}–{rv.bw} {T(G, rv.b).abbr}{rv.holder != null ? ` · held by ${T(G, rv.holder).name}` : ""}{streak > 1 ? ` · ${T(G, holder).abbr} has won ${streak} straight` : ""}</div></div>
        <div className="flex gap-1">{rv.last.slice(0, 6).reverse().map((l, i) => { const w = T(G, l[2] > l[4] ? l[1] : l[3]); return <div key={i} className="text-center" title={`${l[0]}: ${T(G, l[1]).abbr} ${l[2]}, ${T(G, l[3]).abbr} ${l[4]}`}><div className="w-7 h-7 rounded-md flex items-center justify-center text-[8px] font-black" style={{ background: w.c1, color: inkOn(w.c1) }}>{w.abbr}</div><div className="text-[8px] text-slate-500 mt-0.5">'{String(l[0]).slice(2)}</div></div>; })}</div></div></div>}
    <Card title="Game day" right={<span className="inline-flex gap-3">{wx ? <span title={WX_NAME[wx][2]}>{WX_NAME[wx][0]} {WX_NAME[wx][1]}</span> : <span>☀️ Clear</span>}<span title="Crowd noise causes false starts for the visitors">{home ? "🏟️ Home" : g.neutral ? "Neutral site" : "✈️ Away"}{!g.neutral ? " · crowd " + round(crowd * 100) : ""}</span></span>}>
      {wx && <div className="text-xs text-sky-200 bg-sky-400/10 rounded-lg px-3 py-2 mb-3">{WX_NAME[wx][0]} {WX_NAME[wx][2]}.</div>}
      {edges.length > 0 && <div className="grid sm:grid-cols-2 gap-x-5 gap-y-1.5 mb-3">{edges.map(e => <div key={e.l} className="flex items-center gap-2 text-xs"><div className="flex-1 text-slate-300">{e.l}</div><div className="w-20 h-1.5 rounded-full bg-slate-800 relative overflow-hidden"><div className="absolute inset-y-0" style={{ left: e.v >= 0 ? "50%" : 50 + clamp(e.v, -20, 0) * 2.5 + "%", width: clamp(Math.abs(e.v), 0, 20) * 2.5 + "%", background: e.v >= 0 ? "#4ade80" : "#f87171" }} /></div><div className={cx("w-7 text-right font-bold tnum", e.v >= 0 ? "text-emerald-400" : "text-rose-400")}>{e.v > 0 ? "+" : ""}{e.v}</div></div>)}</div>}
      {tip && <div className="text-xs text-slate-400 mb-3">Scout's note: {tip}</div>}
      <PlanControls />
      <div className="mt-3 flex items-center gap-3 flex-wrap"><Btn kind="pri" onClick={() => setLive(true)}>🎧 {g._calls && g._calls.length ? "Back to the game" : "Coach the key calls"}</Btn><span className="text-[11px] text-slate-500">Play this game now and make the fourth-down and two-point decisions yourself — or just press Play and your plan runs on its own.</span></div>
    </Card>
    {live && ReactDOM.createPortal(<UICtx.Provider value={ui}><LiveCalls g={g} onClose={() => setLive(false)} /></UICtx.Provider>, document.body)}
  </div>);
}

/* ----------------------------- staff, facilities, job security ----------------------------- */
function SeatMeter(){
  const G = useUI().G, s = G.coach.sec == null ? 62 : G.coach.sec, [l, c] = seatLabel(s), t = userTeam(G);
  return <Card title="Job security" right={G.coach.name}><div className="flex items-center gap-3"><div className="disp text-3xl" style={{ color: c }}>{l}</div><div className="flex-1"><div className="h-2.5 rounded-full overflow-hidden" style={{ background: "linear-gradient(90deg,#f87171,#fbbf24 50%,#4ade80)" }}><div className="h-full bg-slate-900/80 ml-auto" style={{ width: 100 - s + "%" }} /></div><div className="text-[11px] text-slate-400 mt-1">{t.pro ? "Ownership expects a winning record and playoff trips." : `At a prestige-${round(t.prestige)} program you're expected to win about ${round(((t.prestige - 45) / 52 * .62 + .2) * 12)} of 12.`} Miss badly for a few years and you'll be let go; win big and better jobs call.</div></div></div></Card>;
}
function StaffTab(){
  const ui = useUI(), G = ui.G, roles = STAFF_ROLES(G), [open, setOpen] = useState(null), st = G.staff || {}, pool = G.staffPool || {}, fac = G.fac || {};
  const what = (k, c) => k === "oc" ? `${c.scheme} · offense ${c.ovr >= 70 ? "+" : ""}${((c.ovr - 70) * .05).toFixed(1)}` : k === "dc" ? `${c.scheme} · defense ${c.ovr >= 70 ? "+" : ""}${((c.ovr - 70) * .05).toFixed(1)}` : k === "rc" ? `+${Math.max(0, round((c.ovr - 62) / 7))} recruiting pitches a year` : `+${Math.max(0, round((c.ovr - 62) / 7)) * 2} draft interviews`;
  return (<div className="space-y-3">
    <SeatMeter />
    <div className="grid md:grid-cols-3 gap-3">{roles.map(([k, label]) => { const c = st[k]; if (!c) return null; return (
      <div key={k} className="card p-3"><div className="text-[10px] uppercase tracking-widest text-slate-500">{label}{c.interim ? " · interim" : ""}</div>
        <div className="flex items-center gap-3 mt-1"><Ring v={c.ovr} label="OVR" size={56} /><div className="min-w-0"><div className="font-bold truncate">{c.name}</div><div className="text-[11px] text-slate-400">Age {c.age} · since {c.since}</div><div className="text-[11px] text-slate-300">{what(k, c)}</div></div></div>
        <div className="mt-2"><Btn small disabled={(G.staffHired || {})[k]} onClick={() => setOpen(open === k ? null : k)}>{(G.staffHired || {})[k] ? "Hired this year" : open === k ? "Close" : "See candidates"}</Btn></div>
        {open === k && <div className="mt-2 space-y-1.5 page-in">{(pool[k] || []).map((x, i) => <div key={i} className="flex items-center gap-2 text-xs bg-white/5 rounded-lg px-2 py-1.5"><Ovr v={x.ovr} /><div className="flex-1 min-w-0"><div className="font-semibold truncate">{x.name}</div><div className="text-[10px] text-slate-400 truncate">age {x.age} · {what(k, x)}</div></div><Btn small kind="pri" onClick={() => { ui.act(G => hireStaff(G, k, i)); setOpen(null); }}>Hire</Btn></div>)}{!(pool[k] || []).length && <div className="text-[11px] text-slate-500">No candidates left this year.</div>}</div>}
      </div>); })}</div>
    <Card title="Default game plan" right="follows your coordinators' schemes until you change it"><PlanControls /></Card>
    <Card title="Facilities" right={<span>Paid for with Legacy Points · you have <b className="text-amber-300">{G.lp || 0} ◆</b></span>}>
      <div className="grid sm:grid-cols-2 gap-3">{FAC(G).map(([k, name, desc]) => { const lv = fac[k] || 0, cost = FAC_COST[lv]; return <div key={k} className="bg-white/5 rounded-xl p-3"><div className="flex items-center justify-between"><div className="font-bold text-sm">{name}</div><div className="flex gap-1">{[0, 1, 2, 3, 4].map(i => <span key={i} className="w-4 h-1.5 rounded-full" style={{ background: i < lv ? "var(--acc)" : "#1c2742" }} />)}</div></div><div className="text-[11px] text-slate-400 mt-0.5">{desc}</div>
        <div className="mt-2">{lv >= 5 ? <span className="text-[11px] text-emerald-400 font-bold">Fully built</span> : <Btn small kind="pri" disabled={(G.lp || 0) < cost} onClick={() => ui.act(G => buyFac(G, k))}>Upgrade to level {lv + 1} · {cost} ◆</Btn>}</div></div>; })}</div></Card>
  </div>);
}
function MedReport({ tid }){
  const G = useUI().G, hurt = rosterOf(G, tid).filter(p => p.inj).sort((a, b) => b.ovr - a.ovr), d = depthChart(G, tid);
  if (!hurt.length) return <div className="text-sm text-slate-400">Everyone is healthy.</div>;
  return <div className="space-y-1.5">{hurt.map(p => { const starter = d[p.pos].indexOf(p) >= 0 && rosterOf(G, tid).filter(x => x.pos === p.pos && x.ovr > p.ovr).length < STARTERS[p.pos]; return <div key={p.id} className="flex items-center gap-2 text-sm"><span className="text-slate-500 text-xs w-6">{p.pos}</span><div className="flex-1 min-w-0"><PLink p={p} />{starter && <span className="ml-1.5 text-[9px] text-amber-300 font-bold">STARTER</span>}<div className="text-[10px] text-slate-500 capitalize">{injPart(G, p)}</div></div><div className="text-right"><div className="text-rose-400 text-xs font-bold">{p.inj >= 10 ? "Out for the season" : p.inj + " wk"}</div>{p.inj < 10 && G.phase === "reg" && <div className="text-[10px] text-slate-500">back week {G.week + p.inj}</div>}</div></div>; })}</div>;
}
function RedshirtCard(){
  const ui = useUI(), G = ui.G, t = userTeam(G); if (t.pro) return null;
  const rs = rosterOf(G, t.id).filter(p => p.rs === G.year), can = rosterOf(G, t.id).filter(p => canRedshirt(G, p) && p.rs !== G.year).sort((a, b) => (a.st.g || 0) - (b.st.g || 0) || a.cls - b.cls || b.pot - a.pot).slice(0, 14);
  return <Card title="Redshirts" right="sit a player this year and he keeps the year of eligibility">
    {rs.length > 0 && <div className="mb-3"><div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Redshirting this season</div><div className="flex flex-wrap gap-1.5">{rs.map(p => <span key={p.id} className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-400/30 text-xs inline-flex items-center gap-2"><span className="text-slate-400">{p.pos}</span><PLink p={p} /><span className="link text-rose-300" onClick={() => ui.act(G => toggleRedshirt(G, p))}>pull it</span></span>)}</div></div>}
    {can.length ? <div className="flex flex-wrap gap-1.5">{can.map(p => <span key={p.id} className="px-2 py-1 rounded-lg bg-white/5 text-xs inline-flex items-center gap-2"><span className="text-slate-400">{p.pos} · {CLS[p.cls]}</span><PLink p={p} /><Ovr v={p.ovr} /><span className="text-violet-300">{p.pot}</span><span className="link text-amber-300" onClick={() => ui.act(G => toggleRedshirt(G, p))}>redshirt</span></span>)}</div> : <div className="text-xs text-slate-500">{G.phase === "reg" ? "Nobody is eligible — a redshirt has to be used before week 10, on a player with four games or fewer who hasn't used one." : "Redshirts are set during the season."}</div>}
    <div className="text-[11px] text-slate-500 mt-2">A redshirted player doesn't play this year, still develops, and comes back next season in the same class.</div></Card>;
}

/* ----------------------------- NIL ----------------------------- */
const kfmt = k => k >= 1000 ? "$" + (k / 1000).toFixed(k % 1000 ? 2 : 1) + "M" : "$" + k + "K";
function NilBar(){
  const ui = useUI(), G = ui.G, n = G.nil, t = userTeam(G); if (!n || t.pro) return null;
  const leaving = rosterOf(G, t.id).filter(p => p.portal).sort((a, b) => b.ovr - a.ovr);
  return <div className="card p-3"><div className="flex items-center gap-3"><div><div className="text-[10px] uppercase tracking-widest text-slate-500">NIL collective</div><div className="disp text-2xl">{kfmt(n.left)} <span className="text-sm text-slate-400">of {kfmt(n.budget)} left</span></div></div><div className="flex-1"><HBar v={n.left} max={n.budget} color="#4ade80" h={8} /><div className="text-[11px] text-slate-400 mt-1">Put money behind a recruit to pull him your way (it matters less to five-stars with other offers), or spend it keeping your own players out of the portal. Resets every offseason; prestige, wins and your recruiting centre grow it.</div></div></div>
    {leaving.length > 0 && <div className="mt-3 pt-3 border-t border-[#1f2a44]"><div className="text-[10px] uppercase tracking-widest text-rose-300 mb-1.5">Your players in the portal</div><div className="flex flex-wrap gap-1.5">{leaving.map(p => <span key={p.id} className="px-2 py-1 rounded-lg bg-white/5 text-xs inline-flex items-center gap-2"><span className="text-slate-400">{p.pos} · {CLS[p.cls]}</span><PLink p={p} /><Ovr v={p.ovr} /><Btn small kind="pri" disabled={n.left < retainCost(p)} onClick={() => { ui.act(G => retainPlayer(G, p)); ui.toast(`${pname(p)} is staying.`); }}>Keep · {kfmt(retainCost(p))}</Btn></span>)}</div></div>}</div>;
}
function NilBtn({ p }){
  const ui = useUI(), G = ui.G, n = G.nil; if (!n) return null; const cur = n.deals[p.id] || 0, need = useMemo(() => nilToLead(G, p), [p.id, cur, G.pitchLeft, G.ivLeft]), can = need > 0 && need <= n.left;
  return <span className="inline-flex items-center gap-1"><button disabled={n.left < 100} onClick={() => ui.act(G => nilOffer(G, p, 100))} title="Add $100K of NIL money to your offer" className={cx("px-1.5 py-1 rounded-md text-[10px] font-bold border", cur ? "border-emerald-400/60 text-emerald-300" : "border-[#26324f] text-slate-300", n.left < 100 && "opacity-40")}>{cur ? kfmt(cur) + " +" : "NIL +"}</button>
    {need > 0 && <button disabled={!can} onClick={() => { ui.act(G => nilOffer(G, p, need)); ui.toast(G.players[p.id] && G.players[p.id].commit === G.uid ? `${pname(p)} commits!` : "Offer raised."); }} title={can ? "Spend exactly what it takes to lead for him — he commits when you do" : "More than you have left"} className={cx("px-1.5 py-1 rounded-md text-[10px] font-bold", can ? "bg-emerald-400 text-slate-950" : "bg-white/5 text-slate-500")}>{can ? "Lock " + kfmt(need) : "needs " + kfmt(need)}</button>}</span>;
}

/* ----------------------------- deadline offers ----------------------------- */
function IncomingOffers(){
  const ui = useUI(), G = ui.G, offers = (G.offers || []).filter(o => G.players[o.pid] && G.players[o.pid].tid === G.uid);
  if (!offers.length) return null;
  return <Card title="Your phone is ringing" right={`deadline: week ${TRADE_DEADLINE}`}>{offers.map(o => { const t = T(G, o.tid), p = G.players[o.pid], v = playerVal(p), fair = o.v / Math.max(.1, v); return (
    <div key={o.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"><Helmet t={t} size={36} /><div className="flex-1 min-w-0"><div className="text-sm"><b>{tname(t)}</b> want <PLink p={p} /> <span className="text-slate-400 text-xs">{p.pos} · {p.ovr} · age {p.age}</span></div><div className="text-xs text-slate-300">They offer {o.get.map(a => a.label).join(" + ")}</div>
      <div className="text-[10px] mt-0.5" style={{ color: fair >= 1 ? "#4ade80" : fair >= .85 ? "#fbbf24" : "#fb923c" }}>{fair >= 1 ? "A strong offer" : fair >= .85 ? "About fair value" : "A lowball"} · expires after week {o.w}</div></div>
      <div className="flex flex-col gap-1"><Btn small kind="pri" onClick={() => { const ok = acceptOffer(G, o.id); ui.act(() => {}); ui.toast(ok ? `${pname(p)} traded to the ${t.nick}.` : "That offer fell through."); }}>Accept</Btn><Btn small onClick={() => ui.act(G => { G.offers = G.offers.filter(x => x.id !== o.id); })}>Decline</Btn></div></div>); })}</Card>;
}

/* ----------------------------- combine ----------------------------- */
function CombineBoard(){
  const ui = useUI(), G = ui.G, b = useMemo(() => combineBoard(G), [G.year, G.offStep, G.week]);
  const lists = [["40-yard dash", b.forty, "forty", "s"], ["Big men, fast feet", b.bigFast, "forty", "s"], ["Bench press", b.bench, "bench", " reps"], ["Vertical", b.vert, "vert", "″"], ["3-cone drill", b.cone, "cone", "s"]];
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{lists.map(([title, rows, k, u]) => <Card key={title} title={title}>{rows.length ? rows.map((x, i) => { const t = T(G, x.p.tid != null ? x.p.tid : x.p.col); return <div key={x.p.id} className="flex items-center gap-2 mb-1.5 text-xs"><span className={cx("disp w-4", i === 0 ? "text-amber-300" : "text-slate-500")}>{i + 1}</span>{t && <Badge t={t} size={14} />}<div className="flex-1 min-w-0 truncate"><PLink p={x.p} /> <span className="text-slate-500">{x.p.pos}</span></div><span className="font-bold tnum">{x.c[k]}{u}</span></div>; }) : <Empty>No prospects yet.</Empty>}</Card>)}
    <Card title="Reading the numbers"><div className="text-xs text-slate-400 space-y-1.5"><p>Workout numbers track a prospect's real athletic ratings, so a freak time on an unscouted player is a hint worth an interview.</p><p>They don't measure football: a 4.3 corner with poor instincts is still a project.</p></div></Card></div>;
}

/* ----------------------------- all-star game ----------------------------- */
function AllStarCard(){
  const G = useUI().G, A = G.awards.pro, g = A && A.asg, [open, setOpen] = useState(false); if (!g) return null;
  return <Card title="All-Star Game" right={<span className="link" onClick={() => setOpen(!open)}>{open ? "Hide rosters" : "Show rosters"}</span>}>
    <div className="flex items-center justify-center gap-6"><div className="text-center"><div className="disp text-xl">{g.confs[0]}</div><div className={cx("disp text-5xl tnum", g.sc[0] > g.sc[1] ? "text-amber-300" : "text-slate-500")}>{g.sc[0]}</div></div><div className="text-slate-600 disp text-2xl">vs</div><div className="text-center"><div className="disp text-xl">{g.confs[1]}</div><div className={cx("disp text-5xl tnum", g.sc[1] > g.sc[0] ? "text-amber-300" : "text-slate-500")}>{g.sc[1]}</div></div></div>
    {g.mvp && <div className="text-center text-sm mt-2">MVP: <PLink pid={g.mvp.pid} name={g.mvp.n} /> <span className="text-slate-400 text-xs">{g.mvp.pos}, {(T(G, g.mvp.tid) || {}).abbr} — {g.mvp.line}</span></div>}
    {open && <div className="grid sm:grid-cols-2 gap-4 mt-3 page-in">{g.confs.map(c => <div key={c}><div className="disp text-sm mb-1">{c}</div>{(A.pb[c] || []).map(r => <div key={r.pid} className="flex items-center gap-2 py-0.5 text-xs"><span className="w-6 text-slate-500 font-bold">{r.pos}</span><Badge t={T(G, r.tid) || { c1: "#333", c2: "#fff", abbr: "" }} size={13} /><PLink pid={r.pid} name={r.n} /></div>)}</div>)}</div>}</Card>;
}

/* ----------------------------- what if? ----------------------------- */
function WhatIf(){
  const ui = useUI(), G = ui.G, [res, setRes] = useState(null), [busy, setBusy] = useState(false), t = userTeam(G);
  const played = [...G.cs, ...G.ps].filter(g => g.done && !g.post && (g.h === G.uid || g.a === G.uid)).length;
  const run = () => { setBusy(true); setTimeout(() => { setRes(whatIf(G, 150)); setBusy(false); }, 30); };
  if (!played) return <Card><Empty>Play some games first. Then this replays your season 150 times to show how much was skill and how much was luck.</Empty></Card>;
  const max = res ? Math.max(...res.dist) : 1, luck = res ? res.actual - res.exp : 0;
  return (<div className="space-y-3">
    <Card title={`What if? · ${G.year} ${t.pro ? t.nick : t.name}`} right={played + " regular-season games played"}>
      <div className="text-sm text-slate-300">Replays every game you've played 150 times with today's roster. Nothing in your save changes.</div>
      <div className="mt-3"><Btn kind="pri" disabled={busy} onClick={run}>{busy ? "Replaying…" : res ? "Run it again" : "Replay my season 150 times"}</Btn></div></Card>
    {res && <React.Fragment>
      <div className="grid sm:grid-cols-4 gap-2">{[["Actual wins", res.actual, "#e2e8f0"], ["Expected wins", res.exp.toFixed(1), "#38bdf8"], [luck >= 0 ? "Luck (wins above expected)" : "Luck (wins below expected)", (luck >= 0 ? "+" : "") + luck.toFixed(1), luck >= 0 ? "#4ade80" : "#f87171"], ["Unbeaten in", round(res.perfect * 100) + "% of replays", "#facc15"]].map(([l, v, c]) => <div key={l} className="card p-3 text-center"><div className="disp text-2xl" style={{ color: c }}>{v}</div><div className="text-[10px] text-slate-400">{l}</div></div>)}</div>
      <Card title="How the season usually goes" right={`you did better than ${round(res.worse * 100)}% of replays`}>
        <div className="flex items-end gap-1 h-36">{res.dist.map((n, w) => <div key={w} className="flex-1 h-full flex flex-col justify-end items-center"><div className="text-[8px] text-slate-400">{n ? round(n / res.n * 100) + "%" : ""}</div><div className="w-full rounded-t growY" style={{ height: n / max * 84 + "%", background: w === res.actual ? "#facc15" : "var(--acc)", opacity: w === res.actual ? 1 : .55, animationDelay: w * 25 + "ms" }} /></div>)}</div>
        <div className="flex gap-1 mt-1">{res.dist.map((_, w) => <div key={w} className={cx("flex-1 text-center text-[9px]", w === res.actual ? "text-amber-300 font-bold" : "text-slate-500")}>{w}</div>)}</div><div className="text-[10px] text-slate-500 text-center mt-1">wins · gold is what really happened</div></Card>
      <Card title="Game by game" pad={false}><table className="st tnum"><thead><tr><th className="l">Wk</th><th className="l">Opponent</th><th className="l">Result</th><th className="l w-1/3">Win chance</th><th>Avg score</th></tr></thead><tbody>{res.rows.map(r => <tr key={r.gid} className="cursor-pointer hover:bg-white/5" onClick={() => ui.openGame(r.gid)}><td className="l text-slate-500">{r.w}</td><td className="l">{r.home ? "vs " : "@ "}<TeamLink t={r.opp} /></td><td className={cx("l font-semibold", r.won ? "text-emerald-400" : "text-rose-400")}>{r.won ? "W" : "L"} {r.us}–{r.them}{r.won && r.p < .35 ? <span className="ml-1.5 text-[9px] text-amber-300">STOLE IT</span> : !r.won && r.p > .65 ? <span className="ml-1.5 text-[9px] text-rose-300">LET ONE SLIP</span> : null}</td><td className="l"><div className="flex items-center gap-2"><div className="flex-1"><HBar v={r.p * 100} max={100} color={r.p >= .5 ? "#4ade80" : "#f87171"} h={6} /></div><span className="w-8 text-right text-xs">{round(r.p * 100)}%</span></div></td><td className="text-slate-400">{round(r.pf)}–{round(r.pa)}</td></tr>)}</tbody></table></Card>
    </React.Fragment>}
  </div>);
}

/* ----------------------------- greatest teams ----------------------------- */
function GreatestTeams(){
  const G = useUI().G, [pro, setPro] = useState(G.mode === "pro"), rows = useMemo(() => greatestTeams(G, pro, 25), [pro, G.year, G.phase]);
  return <Card title="The greatest teams in this save" right={<span className="inline-flex gap-1">{[[false, "College"], [true, "Pro"]].map(([k, l]) => <button key={l} onClick={() => setPro(k)} className={cx("px-2 py-0.5 rounded text-[11px] font-semibold", pro === k ? "bg-acc text-slate-950" : "text-slate-400")}>{l}</button>)}</span>} pad={false}>
    {rows.length ? <table className="st tnum"><thead><tr><th className="l">#</th><th className="l">Team</th><th>Year</th><th>W–L</th><th>Pts +/−</th>{!pro && <th>Rank</th>}<th className="l">Finish</th><th className="l w-24">Score</th></tr></thead><tbody>{rows.map((r, i) => <tr key={r.t.id + "-" + r.h.y} className={r.t.id === G.uid ? "bg-white/5" : ""}><td className={cx("l disp", i < 3 ? "text-amber-300 text-base" : "text-slate-500")}>{i + 1}</td><td className="l"><span className="inline-flex items-center gap-2"><Badge t={r.t} size={15} /><TeamLink t={Object.assign({}, r.t, { rank: 0 })} full={pro} /></span></td><td>{r.h.y}</td><td className="font-semibold">{r.h.w}–{r.h.l}</td><td className="text-slate-300">{(r.h.pf || 0) - (r.h.pa || 0) > 0 ? "+" : ""}{(r.h.pf || 0) - (r.h.pa || 0)}</td>{!pro && <td>{r.h.rk || "—"}</td>}<td className={cx("l", r.champ ? "text-amber-300 font-bold" : "text-slate-300")}>{r.champ ? "🏆 " : ""}{r.h.post || "—"}</td><td className="l"><HBar v={r.s} max={rows[0].s} color={brightOf(r.t)} h={6} /></td></tr>)}</tbody></table> : <Empty>Finish a season and the list starts here.</Empty>}
    <div className="px-4 py-2 text-[11px] text-slate-500">Ranked on win percentage, point margin, titles and final poll position.</div></Card>;
}

/* ----------------------------- compare two players ----------------------------- */
function CompareCard({ p }){
  const ui = useUI(), G = ui.G, [q, setQ] = useState(""), [oid, setOid] = useState(null), o = oid != null ? G.players[oid] : null, grp = GROUP(p.pos);
  const hits = useMemo(() => { const s = q.trim().toLowerCase(); if (s.length < 2) return []; const out = []; for (const id in G.players) { const x = G.players[id]; if (x.id !== p.id && (x.fn + " " + x.ln).toLowerCase().includes(s)) out.push(x); } return out.sort((a, b) => (GROUP(b.pos) === grp) - (GROUP(a.pos) === grp) || b.ovr - a.ovr).slice(0, 8); }, [q]);
  const sugg = useMemo(() => { const out = []; for (const id in G.players) { const x = G.players[id]; if (x.id !== p.id && x.pos === p.pos && x.tid != null && (x.exp != null) === (p.exp != null)) out.push(x); } return out.sort((a, b) => Math.abs(a.ovr - p.ovr) - Math.abs(b.ovr - p.ovr)).slice(0, 4); }, [p.id]);
  const same = o && GROUP(o.pos) === grp, tot = (x, lvl) => { const c = careerTotals(x, lvl); STAT_KEYS.concat(["g"]).forEach(k => { if (x.st[k] && ((lvl === "P") === (x.exp != null))) c[k] = (c[k] || 0) + x.st[k]; }); return c; };
  const keys = grp === "QB" ? [["g", "Games"], ["py", "Pass yds"], ["ptd", "Pass TD"], ["pi", "Int"], ["ry", "Rush yds"]] : p.pos === "RB" ? [["g", "Games"], ["ry", "Rush yds"], ["rtd", "Rush TD"], ["rec", "Rec"], ["rcy", "Rec yds"]] : p.pos === "WR" || p.pos === "TE" ? [["g", "Games"], ["rec", "Rec"], ["rcy", "Rec yds"], ["rctd", "Rec TD"]] : grp === "OL" ? [["g", "Games"], ["gs", "Starts"], ["pk", "Pancakes"], ["sal", "Sacks alw."]] : grp === "KP" ? [["g", "Games"], ["fgm", "FGM"], ["fga", "FGA"], ["pu", "Punts"]] : [["g", "Games"], ["tk", "Tackles"], ["sck", "Sacks"], ["int", "Int"], ["tfl", "TFL"]];
  const tc = x => T(G, x.tid) || (x.col != null ? T(G, x.col) : null) || { c1: "#334155", c2: "#e2e8f0", abbr: "FA" }, ca = brightOf(tc(p)), cb = o ? (brightOf(tc(o)) === ca ? "#f472b6" : brightOf(tc(o))) : "#f472b6";
  return <Card title="Compare" right={o ? <span className="link" onClick={() => { setOid(null); setQ(""); }}>pick someone else</span> : "side by side with any player"}>
    {!o ? <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Type a name…" className="w-full bg-[#0b111e] border border-[#26324f] rounded-lg px-3 py-2 text-sm" />
      <div className="flex flex-wrap gap-1.5 mt-2">{(hits.length ? hits : sugg).map(x => <button key={x.id} onClick={() => setOid(x.id)} className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs"><span className="text-slate-400">{x.pos}</span> {pname(x)} <span className="font-bold" style={{ color: ovrColor(x.ovr) }}>{seen(G, x).ovr}</span> <span className="text-slate-500">{tc(x).abbr}</span></button>)}</div>
      {!hits.length && <div className="text-[10px] text-slate-500 mt-1">{q.trim().length >= 2 ? "No match — showing similar players." : "Suggestions: the closest players at his position."}</div>}
    </div> : <div className="page-in">
      <div className="grid grid-cols-2 gap-3 text-center">{[[p, ca], [o, cb]].map(([x, c]) => <div key={x.id}><div className="text-[10px] text-slate-400">{x.pos} · {tc(x).abbr} · age {x.age}</div><div className="disp text-xl truncate" style={{ color: c }}><PLink p={x} /></div><div className="text-xs"><Ovr v={seen(G, x).ovr} /> <span className="text-slate-500">/</span> <span className="text-violet-300">{seen(G, x).pot}</span></div></div>)}</div>
      {same ? <div className="grid sm:grid-cols-2 gap-3 items-center mt-2"><div className="flex justify-center"><svg viewBox="0 0 190 190" style={{ width: "100%", maxWidth: 220 }}>{(() => { const n = p.r.length, c = 95, R = 65, pt = (i, f) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f]; }, poly = vals => vals.map((v, i) => pt(i, clamp((v - 30) / 69, .04, 1)).join(",")).join(" "); return <g>{[.25, .5, .75, 1].map(f => <polygon key={f} points={p.r.map((_, i) => pt(i, f).join(",")).join(" ")} fill="none" stroke="#24304d" />)}<polygon points={poly(o.r)} fill={cb} fillOpacity=".18" stroke={cb} strokeWidth="2" /><polygon points={poly(p.r)} fill={ca} fillOpacity=".18" stroke={ca} strokeWidth="2" />{RLAB[grp].map((l, i) => { const [x, y] = pt(i, 1.24); return <text key={i} x={x} y={y + 3} textAnchor="middle" fontSize="8.5" fill="#94a3b8">{l}</text>; })}</g>; })()}</svg></div>
        <div>{RLAB[grp].map((l, i) => <CompareBar key={l} label={l} a={p.r[i]} b={o.r[i]} ca={ca} cb={cb} />)}</div></div> : <div className="text-xs text-slate-500 text-center my-3">Different positions — ratings don't line up, so here are the careers.</div>}
      <div className="grid sm:grid-cols-2 gap-3 mt-2">{[["C", "College career"], ["P", "Pro career"]].map(([lvl, title]) => { const a = tot(p, lvl), b = tot(o, lvl); if (!(a.g || b.g)) return null; const ks = same ? keys : [["g", "Games"], ["gs", "Starts"]]; return <div key={lvl} className="bg-white/5 rounded-xl p-3"><div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">{title}</div>{ks.map(([k, l]) => <CompareBar key={k} label={l} a={a[k] || 0} b={b[k] || 0} ca={ca} cb={cb} fmt={x => x.toLocaleString()} />)}</div>; })}</div>
      <div className="grid grid-cols-2 gap-3 mt-2 text-[11px] text-slate-300">{[p, o].map(x => <div key={x.id}>{awardChips(x).filter(c => c.w >= 60).slice(0, 5).map((c, i) => <div key={i} className="truncate">{c.n > 1 ? c.n + "× " : ""}{c.a}</div>)}{!awardChips(x).some(c => c.w >= 60) && <div className="text-slate-600">No major awards</div>}</div>)}</div>
    </div>}
  </Card>;
}

/* ----------------------------- shareable season card ----------------------------- */
function drawSeasonCard(cv, G, t, row, honors){
  const W = 1080, Hh = 1350, x = cv.getContext("2d"); cv.width = W; cv.height = Hh;
  const g = x.createLinearGradient(0, 0, W, Hh); g.addColorStop(0, t.c1); g.addColorStop(.55, "#0b111e"); g.addColorStop(1, "#05080f"); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
  x.globalAlpha = .08; x.fillStyle = t.c2; x.font = "italic 900 620px 'Avenir Next Condensed','Arial Narrow',sans-serif"; x.textAlign = "right"; x.fillText(String(row.y).slice(2), W + 30, 560); x.globalAlpha = 1;
  for (let i = 0; i < 9; i++) { x.strokeStyle = "rgba(255,255,255,.05)"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 760 + i * 70); x.lineTo(W, 760 + i * 70); x.stroke(); }
  const F = (s, w = 800, it = true) => `${it ? "italic " : ""}${w} ${s}px 'Avenir Next Condensed','Barlow Condensed','Arial Narrow','Helvetica Neue',sans-serif`, ink = brightOf(t);
  x.textAlign = "left"; x.fillStyle = "rgba(255,255,255,.75)"; x.font = F(34, 600, false); x.fillText(`${row.y} SEASON  ·  ${t.pro ? t.conf.toUpperCase() + " " + t.div.toUpperCase() : G.confs[t.conf].full.toUpperCase()}`, 70, 110);
  x.fillStyle = "#fff"; x.font = F(124); const nm = (t.pro ? t.city : t.name).toUpperCase(); let fs = 124; while (x.measureText(nm).width > W - 140 && fs > 60) { fs -= 6; x.font = F(fs); } x.fillText(nm, 70, 240);
  x.fillStyle = ink; x.font = F(84); x.fillText(t.nick.toUpperCase(), 70, 330);
  x.fillStyle = "#fff"; x.font = F(330, 900); x.fillText(`${row.w}–${row.l}`, 60, 660);
  const champ = /National Champions|Won Pocket Bowl/.test(row.post || ""), finish = [row.post, row.cc ? "Conference champions" : "", row.rk ? "Final rank No. " + row.rk : ""].filter(Boolean);
  x.font = F(54, 800); x.fillStyle = champ ? "#facc15" : "#e2e8f0"; x.fillText((champ ? "🏆 " : "") + (finish[0] || (t.pro ? "Missed the playoffs" : "No bowl game")).toUpperCase(), 70, 760);
  x.font = F(38, 600, false); x.fillStyle = "rgba(255,255,255,.8)"; x.fillText(finish.slice(1).join("  ·  "), 70, 815);
  x.fillText(`${row.pf} points scored  ·  ${row.pa} allowed${row.cw != null ? `  ·  ${row.cw}–${row.cl} in conference` : ""}`, 70, 870);
  x.fillStyle = ink; x.fillRect(70, 915, 120, 8);
  x.font = F(32, 700, false); x.fillStyle = "rgba(255,255,255,.6)"; x.fillText("HONORS", 70, 975);
  x.font = F(36, 600, false); x.fillStyle = "#f1f5f9"; (honors.length ? honors : [["", "A season in the books."]]).slice(0, 6).forEach(([n, a], i) => { const s = n ? `${n} — ${a}` : a; let str = s; while (x.measureText(str).width > W - 140 && str.length > 10) str = str.slice(0, -2); x.fillText(str === s ? s : str + "…", 70, 1030 + i * 50); });
  x.font = F(30, 600, false); x.fillStyle = "rgba(255,255,255,.55)"; x.fillText(`${t.pro ? "GM" : "Coach"} ${G.coach.name}  ·  career ${G.coach.w}–${G.coach.l}`, 70, Hh - 60);
  x.textAlign = "right"; x.fillStyle = "rgba(255,255,255,.4)"; x.fillText("POCKET GM FOOTBALL", W - 70, Hh - 60);
}
function SeasonCardBtn({ row, tid, label }){
  const ui = useUI(), G = ui.G, [open, setOpen] = useState(false), ref_ = useRef(null), t = T(G, tid);
  const honors = useMemo(() => { const out = []; for (const id in G.players) { const p = G.players[id]; if (!p.aw) continue; const mine = p.hist.some(h => h.y === row.y && h.tid === tid) || (row.y === G.year && (p.tid === tid || p.col === tid)); if (!mine) continue; p.aw.forEach(a => { if (a[0] === row.y && !a[2] && MAJOR_AW.test(a[1]) && !/finalist|Second-team|Pro Bowl|Joe Moore/.test(a[1])) out.push([pname(p), a[1], TOP_AW.test(a[1]) ? 2 : /All-American|All-Pro|of the Year/.test(a[1]) ? 1 : 0]); }); } return out.sort((a, b) => b[2] - a[2]); }, [open, row.y]);
  useEffect(() => { if (open && ref_.current) drawSeasonCard(ref_.current, G, t, row, honors); }, [open]);
  const file = `${(t.pro ? t.nick : t.name).replace(/\W+/g, "-").toLowerCase()}-${row.y}.png`;
  const save = () => { const cv = ref_.current; cv.toBlob(b => { if (!b) return; const f = new File([b], file, { type: "image/png" }); if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: `${row.y} ${t.name || t.nick}` }).catch(() => {}); else { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = file; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } }); };
  return <React.Fragment><Btn small onClick={() => setOpen(true)}>{label || "📸 Season card"}</Btn>
    {open && ReactDOM.createPortal(<Modal onClose={() => setOpen(false)} accent={[t.c1, t.c2]}><div className="p-4"><canvas ref={ref_} style={{ width: "100%", maxWidth: 420, borderRadius: 14, display: "block", margin: "0 auto" }} /><div className="flex justify-center gap-2 mt-3"><Btn kind="pri" onClick={save}>Save or share the image</Btn><Btn onClick={() => setOpen(false)}>Close</Btn></div></div></Modal>, document.body)}</React.Fragment>;
}
