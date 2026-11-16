
/* =========================================================================
   UI — camp battles, promises, selection show, scheduling, contract talks,
   tags, draft-day trade-downs, fans, coaching tree, ring of honour,
   rivalry history
   ========================================================================= */
const Portal = ({ children }) => ReactDOM.createPortal(<UICtx.Provider value={useUI()}>{children}</UICtx.Provider>, document.body);

/* ----------------------------- camp battles ----------------------------- */
function CampCard(){
  const ui = useUI(), G = ui.G, bt = useMemo(() => campBattles(G), [G.offStep, G.year, JSON.stringify(G.camp || {})]), camp = G.camp || {};
  return <Card title="Position battles" right="training camp · close calls are yours to make">
    {bt.length ? <div className="space-y-2">{bt.map(b => <div key={b.pos} className="bg-white/5 rounded-xl p-3"><div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">{b.pos}{STARTERS[b.pos] > 1 ? " · last starting spot" : " · starter"}{camp[b.pos] ? " · settled" : ""}</div>
      <div className="grid grid-cols-2 gap-2">{[b.a, b.b].map(p => { const won = camp[b.pos] === p.id; return <div key={p.id} className={cx("rounded-lg p-2.5 border", won ? "border-[color:var(--acc)] bg-white/5" : "border-[#26324f]")}><div className="flex items-center gap-2"><Ovr v={p.ovr} /><span className="text-violet-300 text-xs">{p.pot}</span><PLink p={p} className="font-semibold truncate" /></div><div className="text-[10px] text-slate-400">{p.cls != null ? CLS[p.cls] : "age " + p.age}</div><div className="text-[11px] text-slate-300 mt-1 italic">{campNote(p)}</div>
        <div className="mt-2">{won ? <span className="text-[11px] font-bold text-emerald-300">✓ Named the starter</span> : <Btn small kind="pri" onClick={() => ui.act(G => settleBattle(G, b.pos, p.id))}>Name him the starter</Btn>}</div></div>; })}</div></div>)}</div>
      : <div className="text-sm text-slate-400">No close competitions this year — every job has a clear winner.</div>}
    <div className="text-[11px] text-slate-500 mt-2">Leave a battle alone and the higher-rated player starts. Camp notes hint at work ethic and upside, which ratings alone don't show.</div></Card>;
}

/* ----------------------------- promises ----------------------------- */
function PromiseBtn({ p }){
  const ui = useUI(), G = ui.G, n = openPromises(G);
  if (G.mode !== "college" || !(p.recruit || p.portal)) return null;
  if (p.promise) return <div className="text-[11px] text-amber-200 mt-2">🤝 You promised him a starting job by {p.promise}. Break it and he transfers — and recruits hear about it.</div>;
  return <div className="mt-2 flex items-center gap-2"><Btn small disabled={n >= 3 || p.commit != null} onClick={() => { ui.act(G => promiseTime(G, p)); ui.toast(G.players[p.id].commit === G.uid ? `${pname(p)} commits!` : "Promise made."); }}>🤝 Promise he'll start by {G.year + (p.portal ? 1 : 2)}</Btn><span className="text-[11px] text-slate-500">A big pull ({3 - n} left). He must start six games that season.</span></div>;
}

/* ----------------------------- selection show ----------------------------- */
function SelectionShow(){
  const ui = useUI(), G = ui.G, t = userTeam(G), col = !t.pro, ready = col ? !!G.cfp : !!G.pp, show = ready && G.phase === "reg" && G.selSeen !== G.year, [n, setN] = useState(0);
  const seeds = !ready ? [] : col ? G.cfp.seeds.map((id, i) => [i + 1, id, ""]) : PRO_CONFS.flatMap(c => G.pp.seeds[c].map((id, i) => [i + 1, id, c]));
  useEffect(() => { if (!show || n >= seeds.length) return; const tm = setTimeout(() => setN(n + 1), col ? 420 : 260); return () => clearTimeout(tm); }, [show, n, seeds.length]);
  if (!show) return null;
  const done = () => ui.act(G => { G.selSeen = G.year; }), order = col ? seeds.slice().reverse() : seeds, mine = seeds.find(s => s[1] === t.id), all = n >= seeds.length;
  const bowl = col ? G.cs.find(g => g.post === "bowl" && (g.h === t.id || g.a === t.id)) : null, r1 = col && mine ? [...G.cfp.r1, ...G.cfp.qf].map(id => gameById(G, id)).find(g => g && (g.h === t.id || g.a === t.id)) : null;
  return <Modal onClose={done} wide accent={[t.c1, t.c2]}>
    <div className="p-5" style={{ background: `radial-gradient(ellipse at top, ${t.c1}55, transparent 65%)` }}>
      <div className="text-[10px] uppercase tracking-[.35em] text-amber-300">{G.year} · Selection {col ? "Sunday" : "night"}</div>
      <div className="disp text-4xl mt-1">{col ? "The playoff field is set" : "The playoff picture"}</div>
      <div className={cx("grid gap-1.5 mt-4", col ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>{order.map((s, i) => { const x = T(G, s[1]), on = i < n, me = s[1] === t.id; return (
        <div key={s[2] + s[0]} className={cx("flex items-center gap-2.5 rounded-xl px-3 py-2 border transition-all duration-500", on ? "opacity-100" : "opacity-0 translate-y-2", me ? "border-amber-300 bg-amber-400/10" : "border-[#1f2a44] bg-white/5")} style={col ? {} : { order: (s[2] === PRO_CONFS[0] ? 0 : 1) + s[0] * 2 }}>
          <div className="disp text-2xl w-8 text-right" style={{ color: s[0] <= (col ? 4 : 1) ? "#facc15" : "#94a3b8" }}>{s[0]}</div><Helmet t={x} size={34} /><div className="min-w-0 flex-1"><div className="font-bold truncate">{x.pro ? x.city + " " + x.nick : x.name}</div><div className="text-[10px] text-slate-400">{x.w}–{x.l}{col ? (s[0] <= 4 ? " · first-round bye" : "") : " · " + s[2] + (s[0] === 1 ? " · bye" : "")}</div></div>{me && <span className="text-[10px] font-black text-amber-300">YOU</span>}</div>); })}</div>
      {all && <div className="card p-4 mt-4 rise"><div className="disp text-2xl" style={{ color: mine ? "#4ade80" : bowl ? "#fbbf24" : "#f87171" }}>{mine ? `You're in — the No. ${mine[0]} seed` : bowl ? "Not this year, but you're going bowling" : col ? "Left out" : "Season over — you missed the playoffs"}</div>
        <div className="text-sm text-slate-300 mt-1">{mine && r1 ? `First up: ${r1.tag ? r1.tag.replace(/.*· /, "") + " — " : ""}${T(G, r1.h === t.id ? r1.a : r1.h).name || T(G, r1.h === t.id ? r1.a : r1.h).nick}.` : mine ? "A week off to get healthy." : bowl ? `${bowl.tag}: you draw ${T(G, bowl.h === t.id ? bowl.a : bowl.h).name}.` : col ? `First four out: ${G.cfp.firstOut.map(id => T(G, id).abbr).join(", ")}. ${G.cfp.firstOut.includes(t.id) ? "That one stings." : "No bowl either — six wins gets you in."}` : "The work starts in the offseason."}</div></div>}
      <div className="mt-4 flex gap-2"><Btn kind="pri" onClick={all ? done : () => setN(seeds.length)}>{all ? "On to the postseason" : "Show them all"}</Btn></div>
    </div></Modal>;
}
function OrderReveal(){
  const ui = useUI(), G = ui.G, t = userTeam(G), d = G.draft, show = t.pro && G.phase === "off" && G.offStep === 0 && d && !d.done && G.orderSeen !== G.year, [n, setN] = useState(0), top = d ? d.order.slice(0, 12) : [];
  useEffect(() => { if (!show || n >= top.length) return; const tm = setTimeout(() => setN(n + 1), 480); return () => clearTimeout(tm); }, [show, n, top.length]);
  if (!show) return null;
  const done = () => ui.act(G => { G.orderSeen = G.year; }), my = d.order.indexOf(t.id) + 1, comp = d.order.length - 224, myComp = d.order.slice(224).filter(x => x === t.id).length;
  return <Modal onClose={done} accent={[t.c1, t.c2]}><div className="p-5">
    <div className="text-[10px] uppercase tracking-[.35em] text-amber-300">{G.year + 1} draft</div><div className="disp text-3xl mt-1">The order is set</div>
    <div className="mt-3 space-y-1">{top.map((id, i) => i).reverse().map(i => { const x = T(G, top[i]), on = top.length - 1 - i < n, me = top[i] === t.id; return <div key={i} className={cx("flex items-center gap-3 rounded-lg px-3 py-1.5 transition-all duration-500", on ? "opacity-100" : "opacity-0 -translate-x-3", me ? "bg-amber-400/15 ring-1 ring-amber-300" : "bg-white/5")}><div className={cx("disp w-8 text-right", i === 0 ? "text-3xl text-amber-300" : "text-xl text-slate-400")}>{i + 1}</div><Helmet t={x} size={i === 0 ? 40 : 28} /><div className="flex-1 font-semibold">{x.city} {x.nick}</div><div className="text-xs text-slate-400 tnum">{(x.hist[x.hist.length - 1] || {}).w}–{(x.hist[x.hist.length - 1] || {}).l}</div></div>; })}</div>
    <div className="text-sm text-slate-300 mt-3">Your first pick is <b className="text-amber-300">No. {my}</b>.{comp > 0 ? ` ${comp} compensatory pick${comp > 1 ? "s were" : " was"} added after round seven for teams that lost free agents${myComp ? " — " + myComp + " of them yours" : ""}.` : ""}</div>
    <div className="mt-4"><Btn kind="pri" onClick={done}>Open the offseason</Btn></div></div></Modal>;
}

/* ----------------------------- scheduling ----------------------------- */
function SchedulePicker(){
  const ui = useUI(), G = ui.G, t = userTeam(G), opts = useMemo(() => schedOptions(G), [G.year, G.uid]), wish = G.ncWish || [], [kind, setKind] = useState("Marquee");
  if (t.pro) return null;
  if (G.phase !== "off") return <Card><Empty>Next year's non-conference schedule opens in the offseason. This year's games are under Team → Schedule.</Empty></Card>;
  const col = { Marquee: "#facc15", "Even fight": "#38bdf8", "Should win": "#a3e635", Cupcake: "#94a3b8" };
  return <Card title={`${G.year + 1} non-conference schedule`} right={`${wish.length}/3 requests`}>
    <div className="text-xs text-slate-400 mb-3">Ask for up to three opponents. Marquee wins lift you in the poll and fire up the fans; a cupcake is a near-certain win that impresses nobody. The rest of the slate is filled for you.</div>
    {wish.length > 0 && <div className="flex flex-wrap gap-1.5 mb-3">{wish.map(id => { const x = T(G, id); return <span key={id} className="px-2 py-1 rounded-lg bg-amber-400/15 border border-amber-300/40 text-xs inline-flex items-center gap-2"><Badge t={x} size={14} />{x.name}<span className="link text-rose-300" onClick={() => ui.act(G => toggleWish(G, id))}>✕</span></span>; })}</div>}
    <SubTabs tabs={["Marquee", "Even fight", "Should win", "Cupcake"]} value={kind} onChange={setKind} />
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">{opts.filter(o => o.kind === kind).slice(0, 18).map(o => { const on = wish.includes(o.t.id); return <button key={o.t.id} disabled={!on && wish.length >= 3} onClick={() => ui.act(G => toggleWish(G, o.t.id))} className={cx("flex items-center gap-2 rounded-lg px-2.5 py-2 text-left border", on ? "border-amber-300 bg-amber-400/10" : "border-[#26324f] hover:bg-white/5")}><Badge t={o.t} size={18} /><div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{o.t.name}</div><div className="text-[10px] text-slate-400">{G.confs[o.t.conf].name} · prestige {round(o.t.prestige)} · {(o.t.hist[o.t.hist.length - 1] || {}).w || 0}–{(o.t.hist[o.t.hist.length - 1] || {}).l || 0} last year</div></div><span className="text-[9px] font-black uppercase" style={{ color: col[o.kind] }}>{on ? "✓" : "+"}</span></button>; })}</div></Card>;
}

/* ----------------------------- contract talks ----------------------------- */
function NegotiateModal({ pid, onClose }){
  const ui = useUI(), G = ui.G, p = G.players[pid], ask = p ? baseAsk(G, p) : 1, [amt, setAmt] = useState(+ask.toFixed(2)), [yrs, setYrs] = useState(p ? wantYears(p) : 2), [gtd, setGtd] = useState(.3), [res, setRes] = useState(null);
  if (!p) return null;
  const t = userTeam(G), s = (G.nego || {})[p.id] || { tries: 0 }, sc = offerScore(G, p, { amt, yrs, gtd }), signed = res && res.ok, dead = s.walked || (res && res.walked);
  const mood = sc >= 1.05 ? ["He'd sign this today", "#4ade80"] : sc >= .97 ? ["Right at his number", "#a3e635"] : sc >= .88 ? ["Close", "#fbbf24"] : sc >= .75 ? ["Well short", "#fb923c"] : ["Insulting", "#f87171"];
  const offer = () => { let r; ui.act(G => { r = negotiate(G, p, { amt, yrs, gtd }); }); setRes(r); if (r && r.ok) ui.toast(`${pname(p)} signs: ${yrs} yr, ${money(amt)}.`); };
  return <Modal onClose={onClose} accent={[t.c1, t.c2]}><div className="p-5">
    <div className="text-[10px] uppercase tracking-[.3em] text-slate-400">Contract talks · round {Math.min(4, s.tries + 1)} of 4</div>
    <div className="flex items-center gap-3 mt-1"><Ring v={p.ovr} label="OVR" size={54} /><div><div className="disp text-3xl"><PLink p={p} /></div><div className="text-xs text-slate-400">{p.pos} · age {p.age} · asking {money(ask)} a year · wants {wantYears(p)} year{wantYears(p) > 1 ? "s" : ""}{p.fa ? " · interest in you " + faInterest(G, p, G.uid) : ""}</div></div></div>
    {signed ? <div className="card p-4 mt-4 text-center pop"><div className="text-3xl">🖊️</div><div className="disp text-2xl text-emerald-400 mt-1">Signed</div><div className="text-sm text-slate-300">{res.msg} {p.c ? `${p.c.yrs} year${p.c.yrs > 1 ? "s" : ""}, ${money(p.c.amt)} a year, ${round((p.c.gtd || 0) * 100)}% guaranteed.` : ""}</div><div className="mt-3"><Btn kind="pri" onClick={onClose}>Done</Btn></div></div>
      : dead ? <div className="card p-4 mt-4 text-center"><div className="text-3xl">📵</div><div className="disp text-xl text-rose-400 mt-1">Talks are off</div><div className="text-sm text-slate-300">{(res && res.msg) || "His agent isn't taking your calls any more this year."}</div><div className="mt-3"><Btn onClick={onClose}>Close</Btn></div></div>
      : <div className="mt-4 space-y-4">
        <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Salary per year</span><b className="tnum">{money(amt)}</b></div><input type="range" min={+(ask * .6).toFixed(2)} max={+(ask * 1.5).toFixed(2)} step="0.05" value={amt} onChange={e => setAmt(+e.target.value)} className="w-full" /></div>
        <div><div className="text-xs text-slate-400 mb-1">Years</div><div className="flex gap-1.5">{[1, 2, 3, 4, 5].map(y => <button key={y} onClick={() => setYrs(y)} className={cx("flex-1 py-1.5 rounded-lg text-sm font-bold border", yrs === y ? "bg-acc text-slate-950 border-transparent" : "border-[#26324f] text-slate-300")}>{y}</button>)}</div></div>
        <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Guaranteed</span><b className="tnum">{round(gtd * 100)}% · {money(amt * gtd)} dead cap if you cut him</b></div><input type="range" min="0" max="1" step="0.05" value={gtd} onChange={e => setGtd(+e.target.value)} className="w-full" /></div>
        <div><div className="flex justify-between text-[11px] mb-1"><span className="font-bold" style={{ color: mood[1] }}>{mood[0]}</span><span className="text-slate-500">cap room {money(capRoom(G, G.uid) + (p.tid === G.uid && p.c ? p.c.amt : 0))}</span></div><div className="relative h-2.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: clamp(sc * 80, 0, 100) + "%", background: mood[1], transition: "width .25s" }} /><div className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: "80%" }} /></div></div>
        {res && <div className="rounded-lg bg-amber-400/10 text-amber-100 text-sm px-3 py-2">{res.msg}{res.counter && <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs">Their counter: <b>{res.counter.yrs} yr · {money(res.counter.amt)} · {round(res.counter.gtd * 100)}% guaranteed</b><Btn small kind="pri" onClick={() => { setAmt(res.counter.amt); setYrs(res.counter.yrs); setGtd(res.counter.gtd); }}>Match it</Btn></div>}</div>}
        <div className="flex gap-2"><Btn kind="pri" onClick={offer}>Make the offer</Btn><Btn onClick={onClose}>Step away</Btn></div>
        <div className="text-[11px] text-slate-500">More guaranteed money or the contract length he wants lets you pay less per year. Four rounds and he walks; an insulting offer can end it sooner.</div>
      </div>}
  </div></Modal>;
}
function NegoBtn({ p, label }){ const [open, setOpen] = useState(false), G = useUI().G, off = ((G.nego || {})[p.id] || {}).walked; return <React.Fragment><Btn small disabled={off} onClick={() => setOpen(true)}>{off ? "Walked" : label || "Negotiate"}</Btn>{open && <Portal><NegotiateModal pid={p.id} onClose={() => setOpen(false)} /></Portal>}</React.Fragment>; }
function TagBtns({ p }){
  const ui = useUI(), G = ui.G;
  return <React.Fragment>{canOption(p) && <Btn small onClick={() => { ui.act(G => fifthYear(G, p)); ui.toast(`Fifth-year option picked up on ${pname(p)}.`); }} >5th-yr option</Btn>}<Btn small disabled={G.tagUsed === G.year} onClick={() => { if (confirm(`Franchise-tag ${pname(p)} for one year at ${money(tagCost(G, p))}? You get one tag a year.`)) { ui.act(G => tagPlayer(G, p)); ui.toast(`${pname(p)} tagged.`); } }}>Tag {money(tagCost(G, p))}</Btn></React.Fragment>;
}

/* ----------------------------- draft day: trade down ----------------------------- */
function TradeDownCard(){
  const ui = useUI(), G = ui.G, offers = useMemo(() => tradeDownOffers(G), [G.draft && G.draft.pick, G.draft && G.draft.order.join(",").length]);
  if (!offers.length) return null;
  return <Card title="The phones are ringing" right="teams want your pick" className="mb-3">{offers.map(o => { const t = T(G, o.tid); return <div key={o.tid} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"><Helmet t={t} size={34} /><div className="flex-1 min-w-0"><div className="text-sm"><b>{tname(t)}</b> want No. {o.i + 1}</div><div className="text-xs text-slate-300">You get No. {o.j + 1} ({pickRound(o.j)}) and No. {o.k + 1} ({pickRound(o.k)})</div><div className="text-[10px]" style={{ color: o.v >= o.v0 * 1.1 ? "#4ade80" : o.v >= o.v0 ? "#a3e635" : "#fbbf24" }}>{o.v >= o.v0 * 1.1 ? "They're overpaying" : o.v >= o.v0 ? "Fair value" : "A little light"} · their picks {o.v} vs yours {o.v0}</div></div><Btn small kind="pri" onClick={() => { ui.act(G => acceptTradeDown(G, o)); ui.toast(`You move down to No. ${o.j + 1}.`); }}>Move down</Btn></div>; })}
    <div className="text-[11px] text-slate-500 mt-1">To move up instead, use Front Office → Trades: picks can change hands any time before the draft ends.</div></Card>;
}

/* ----------------------------- fans, owner, coaching tree ----------------------------- */
function FanCard(){
  const G = useUI().G, f = G.fans == null ? 55 : G.fans, [l, c] = fanLabel(f), t = userTeam(G), era = G.era && G.era.k ? ERAS[G.era.k] : null;
  return <Card title={t.pro ? "Fans and ownership" : "Fans and boosters"} right={"$" + revenueOf(G) + "M revenue this year"}>
    <div className="flex items-center gap-3"><div className="disp text-2xl w-44 shrink-0" style={{ color: c }}>{l}</div><div className="flex-1"><HBar v={f} max={100} color={c} h={9} /><div className="text-[11px] text-slate-400 mt-1">Wins fill the building; big-game and rivalry results count double. A loud house means more false starts for visitors, {t.pro ? "a more patient owner" : "a bigger NIL pot"} and a safer job.</div></div></div>
    {era && <div className="mt-3 text-xs rounded-lg bg-sky-400/10 text-sky-100 px-3 py-2">📜 <b>{era[0]}</b> (since {G.era.y}) — {era[1]}</div>}</Card>;
}
function TreeCard(){
  const G = useUI().G, rows = treeRows(G); if (!rows.length) return null;
  return <Card title="Your coaching tree" right="assistants who became head coaches">{rows.map((r, i) => <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0 text-sm"><span className="text-lg">🌳</span><div className="flex-1 min-w-0"><div className="font-semibold">{r.name}</div><div className="text-[11px] text-slate-400">Your {r.role.toLowerCase()} until {r.y - 1}</div></div>{r.t ? <span className="inline-flex items-center gap-2 text-xs"><Badge t={r.t} size={15} /><TeamLink t={r.t} /><b className="tnum">{r.w}–{r.l}</b></span> : <span className="text-xs text-slate-500">no longer a head coach</span>}</div>)}</Card>;
}
function RingCard({ t }){
  const G = useUI().G, ring = t.ring || []; if (!ring.length) return null;
  return <Card title="Ring of honour" right="retired numbers" className="mt-3"><div className="flex flex-wrap gap-2">{ring.map(r => <div key={r.pid} className="rounded-xl overflow-hidden text-center pop" style={{ width: 86, background: t.c1, color: inkOn(t.c1) }}><div className="disp text-4xl pt-2 leading-none">{r.num}</div><div className="text-[10px] font-bold px-1 truncate"><PLink pid={r.pid} name={r.n.split(" ").slice(-1)[0]} /></div><div className="text-[8px] opacity-70 pb-1.5">{r.pos} · {r.y}</div></div>)}</div></Card>;
}

/* ----------------------------- rivalry history ----------------------------- */
function RivalryHistory(){
  const ui = useUI(), G = ui.G, mine = G.riv.filter(r => r.a === G.uid || r.b === G.uid), [ri, setRi] = useState((mine[0] || G.riv[0] || {}).i), rv = G.riv.find(r => r.i === ri); if (!rv) return null;
  const a = T(G, rv.a), b = T(G, rv.b), games = rv.last.map(l => { const wid = l[2] > l[4] ? l[1] : l[3], m = Math.abs(l[2] - l[4]); return { y: l[0], w: T(G, wid), l: T(G, wid === l[1] ? l[3] : l[1]), ws: Math.max(l[2], l[4]), ls: Math.min(l[2], l[4]), m, home: T(G, l[1]) }; });
  let best = 0, bw = null, run = 0, rw = null; games.slice().reverse().forEach(g => { if (rw && g.w.id === rw.id) run++; else { rw = g.w; run = 1; } if (run > best) { best = run; bw = rw; } });
  const blow = games.slice().sort((x, y) => y.m - x.m)[0], close = games.slice().sort((x, y) => x.m - y.m)[0], tot = Math.max(1, rv.aw + rv.bw);
  return <Card title="Rivalry history" right={<Sel value={ri} onChange={v => v != null && setRi(v)}>{G.riv.map(r => <option key={r.i} value={r.i}>{r.name}</option>)}</Sel>} className="mt-3">
    <div className="flex items-center gap-3"><Helmet t={a} size={44} /><div className="flex-1"><div className="flex justify-between text-sm font-bold"><span>{a.name} {rv.aw}</span><span className="text-amber-300 text-xs">{rv.trophy}</span><span>{rv.bw} {b.name}</span></div><div className="flex h-2.5 rounded-full overflow-hidden mt-1 bg-slate-800"><div style={{ width: rv.aw / tot * 100 + "%", background: brightOf(a) }} /><div style={{ width: rv.bw / tot * 100 + "%", background: brightOf(b) }} /></div></div><Helmet t={b} size={44} flip /></div>
    {games.length ? <React.Fragment>
      <div className="grid sm:grid-cols-3 gap-2 mt-3">{[["Longest streak (in this save)", bw ? `${bw.abbr} · ${best} in a row` : "—"], ["Biggest win", blow ? `${blow.w.abbr} ${blow.ws}–${blow.ls} (${blow.y})` : "—"], ["Closest game", close ? `${close.w.abbr} ${close.ws}–${close.ls} (${close.y})` : "—"]].map(([l, v]) => <div key={l} className="bg-white/5 rounded-lg p-2.5"><div className="text-[9px] uppercase tracking-widest text-slate-500">{l}</div><div className="text-sm font-bold mt-0.5">{v}</div></div>)}</div>
      <div className="flex gap-1 mt-3 overflow-x-auto pb-1">{games.slice().reverse().map(g => <div key={g.y} className="text-center shrink-0" title={`${g.y}: ${g.w.name} ${g.ws}, ${g.l.name} ${g.ls}`}><div className="w-9 h-9 rounded-lg flex items-center justify-center text-[9px] font-black" style={{ background: g.w.c1, color: inkOn(g.w.c1) }}>{g.w.abbr}</div><div className="text-[8px] text-slate-400 tnum mt-0.5">{g.ws}–{g.ls}</div><div className="text-[8px] text-slate-600">'{String(g.y).slice(2)}</div></div>)}</div>
    </React.Fragment> : <div className="text-xs text-slate-500 mt-3">Not yet played in this save. The all-time series total above carries over from before your career began.</div>}
  </Card>;
}
