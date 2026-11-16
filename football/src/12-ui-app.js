
/* =========================================================================
   UI — menu, new career, and the app shell
   ========================================================================= */
// Team cards for the screens that exist before a world does (same ids newGame will hand out).
const STUBS = (() => {
  const col = [], pro = [];
  CONF_ORDER.forEach(cid => CONFS[cid].teams.split(";").forEach(r => { const [name, nick, abbr, pr, c1, c2, st] = r.split("|"); col.push({ id: 100 + col.length, name, nick, abbr, conf: cid, prestige: +pr, c1, c2, state: st }); }));
  PRO_DEFS.forEach((row, di) => row.split(";").forEach(s => { const [city, nick, abbr, c1, c2] = s.split("|"); pro.push({ id: pro.length, pro: true, city, nick, abbr, name: city, conf: PRO_CONFS[di >> 2], div: PRO_DIVS[di % 4], c1, c2 }); }));
  return { col, pro };
})();
const WEEK_NAMES = { 15: "Championship Saturday", 16: "Playoff · First round", 17: "Playoff · Quarterfinals", 18: "Playoff · Semifinals", 19: "National Championship", 20: "Pro conference title games", 21: "The Pocket Bowl" };
const weekName = w => WEEK_NAMES[w] || "Week " + w;

// A broken screen shouldn't take the whole career down: show the error and keep the tabs working.
class Safe extends React.Component {
  constructor(p){ super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err){ return { err }; }
  componentDidCatch(e){ console.error(e); }
  render(){ return this.state.err ? <div className="card p-4 text-sm"><div className="font-bold text-rose-300">This screen hit a snag.</div><div className="text-slate-400 mt-1">Your career is fine — pick another tab, or reload the page.</div><pre className="text-[10px] text-slate-500 mt-2 whitespace-pre-wrap">{String(this.state.err && this.state.err.message)}</pre></div> : this.props.children; }
}
function MainMenu({ onNew, onLoad }){
  const [slots, setSlots] = useState(listSlots);
  const reel = useMemo(() => { const big = STUBS.col.filter(t => t.prestige >= 84), mix = []; shuffle(big.slice()).slice(0, 9).forEach((t, i) => { mix.push(t); if (i % 3 === 2) mix.push(pick(STUBS.pro)); }); return mix; }, []);
  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="absolute inset-0"><SceneBackdrop teams={reel} hold={6500} dim={.5} /></div>
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="text-[11px] tracking-[.5em] text-white/70 uppercase rise">Pocket GM</div>
        <div className="disp text-6xl sm:text-8xl text-white rise" style={{ textShadow: "0 6px 40px rgba(0,0,0,.7)", animationDelay: "80ms" }}>Football</div>
        <div className="text-sm text-slate-200/90 mt-2 text-center max-w-md rise" style={{ animationDelay: "160ms" }}>138 college programs in their real conferences. A 32-team pro league. One career that can cross between them.</div>
        <div className="mt-7 w-full max-w-md space-y-2 rise" style={{ animationDelay: "240ms" }}>
          <button onClick={onNew} className="w-full rounded-xl py-3.5 font-black text-slate-950 text-lg bg-white hover:brightness-95 active:scale-[.98] transition-all">New career</button>
          {slots.map(s => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl p-2.5 pl-3 cursor-pointer hover:brightness-125 transition-all" style={{ background: "rgba(10,16,30,.78)", border: "1px solid rgba(255,255,255,.12)", backdropFilter: "blur(8px)" }} onClick={() => onLoad(s.id)}>
              <Badge t={s} size={26} />
              <div className="flex-1 min-w-0"><div className="font-bold truncate">{s.name}</div><div className="text-[11px] text-slate-400">{s.coach} · {s.year} {s.phase === "off" ? "offseason" : weekName(s.week).toLowerCase()} · {s.rec}</div></div>
              <span className="text-xs text-slate-300 font-semibold">Continue ▸</span>
              <button onClick={e => { e.stopPropagation(); if (confirm(`Delete the ${s.name} save? This can't be undone.`)) deleteSlot(s.id).then(() => setSlots(listSlots())); }} className="w-7 h-7 rounded-full text-slate-500 hover:text-rose-400 hover:bg-white/5" title="Delete save">×</button>
            </div>))}
        </div>
        <div className="mt-8 grid grid-cols-3 gap-2 w-full max-w-md text-center text-[11px] text-slate-300 rise" style={{ animationDelay: "320ms" }}>
          {[["🏆", "Heisman night, 20+ national awards, All-Americans"], ["📖", "A reference page for every player, college and pro"], ["🎟️", "12-team playoff, 30+ bowls, the Pocket Bowl"]].map(([i, t]) => <div key={t} className="rounded-xl p-2.5" style={{ background: "rgba(10,16,30,.6)", border: "1px solid rgba(255,255,255,.08)" }}><div className="text-xl">{i}</div>{t}</div>)}
        </div>
      </div>
    </div>
  );
}

function NewCareer({ onStart, onBack }){
  const [mode, setMode] = useState("college"), [cid, setCid] = useState("SEC"), [sel, setSel] = useState(STUBS.col[0]), [name, setName] = useState(""), [busy, setBusy] = useState(false);
  const pickMode = m => { setMode(m); setSel(m === "pro" ? STUBS.pro[0] : STUBS.col.find(t => t.conf === cid)); };
  const tile = t => <button key={t.id} onClick={() => setSel(t)} className={cx("flex items-center gap-2 rounded-lg p-2 text-left border transition-all", sel.id === t.id ? "border-white bg-white/10" : "border-[#26324f] hover:border-slate-500 bg-[#0b111e]/80")}><Helmet t={t} size={30} /><div className="min-w-0"><div className="text-sm font-bold truncate">{t.pro ? t.city : t.name}</div><div className="text-[10px] text-slate-400 truncate">{t.nick}{t.pro ? "" : " · prestige " + t.prestige}</div></div></button>;
  const go = () => { setBusy(true); setTimeout(() => onStart({ mode, team: sel.id, name: name.trim() || "Coach" }), 40); };
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-x-0 top-0 h-72"><SceneBackdrop teams={[sel]} dim={.35} /></div>
      <div className="relative z-10 max-w-4xl mx-auto px-3 pt-5 pb-28">
        <button onClick={onBack} className="text-sm text-white/80 hover:text-white">‹ Back</button>
        <div className="mt-24 flex items-end gap-3"><Helmet t={sel} size={76} /><div><div className="text-[11px] uppercase tracking-[.3em] text-white/70">{sel.pro ? `${sel.conf} ${sel.div}` : CONFS[sel.conf].full}</div><div className="disp text-4xl sm:text-5xl text-white" style={{ textShadow: "0 4px 24px rgba(0,0,0,.8)" }}>{tname(sel)}{!sel.pro && <span className="text-2xl text-white/70 ml-2">{sel.nick}</span>}</div></div></div>
        <div className="card p-3 mt-4 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-[#26324f]">{[["college", "College head coach"], ["pro", "Pro general manager"]].map(([m, l]) => <button key={m} onClick={() => pickMode(m)} className={cx("px-3 py-2 text-sm font-semibold", mode === m ? "bg-white text-slate-950" : "text-slate-300")}>{l}</button>)}</div>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="Your name" className="flex-1 min-w-[140px] bg-[#0b111e] border border-[#26324f] rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="text-xs text-slate-400 mt-2 px-1">{mode === "college" ? "Recruit, win your conference, chase the playoff and the Heisman. Bigger programs may come calling." : "Run the cap, the draft and free agency. The college game plays out underneath you and feeds your draft board."}</div>
        <div className="mt-3">
          {mode === "college" && <SubTabs tabs={CONF_ORDER.map(c => [c, CONFS[c].name])} value={cid} onChange={c => { setCid(c); setSel(STUBS.col.find(t => t.conf === c)); }} />}
          {mode === "college" ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">{STUBS.col.filter(t => t.conf === cid).map(tile)}</div>
            : PRO_CONFS.map(c => <div key={c} className="mb-3"><div className="disp text-sm text-slate-300 mb-1.5">{c} Conference</div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{STUBS.pro.filter(t => t.conf === c).map(tile)}</div></div>)}
        </div>
      </div>
      <div className="fixed bottom-0 inset-x-0 z-20 p-3 flex justify-center" style={{ background: "linear-gradient(transparent, #070b14 45%)" }}><button disabled={busy} onClick={go} className="w-full max-w-md rounded-xl py-3.5 font-black text-lg active:scale-[.98] transition-all" style={{ background: sel.c1, color: inkOn(sel.c1), border: "2px solid " + sel.c2 }}>{busy ? "Building the football world…" : "Take over " + (sel.pro ? "the " + sel.nick : sel.name)}</button></div>
    </div>
  );
}

function App(){
  const [screen, setScreen] = useState("menu"), gref = useRef(null), [, bump] = useState(0), [tab, setTab] = useState("Home"), [stack, setStack] = useState([]);
  const [ceremony, setCeremony] = useState(false), [busy, setBusy] = useState(null), [toastMsg, setToastMsg] = useState(null), [menu, setMenu] = useState(false), saveT = useRef(null), toastT = useRef(null);
  const G = gref.current, redraw = () => bump(x => x + 1);
  const toast = m => { setToastMsg(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(null), 3200); };
  const save = () => { clearTimeout(saveT.current); saveT.current = setTimeout(() => { if (gref.current) saveGame(gref.current).catch(() => toast("Couldn't save — storage may be full.")); }, 400); };
  const enter = g => { gref.current = g; setTab("Home"); setStack([]); setCeremony(false); setScreen("play"); window.scrollTo(0, 0); };
  useEffect(() => { const t = G && screen === "play" ? userTeam(G) : null; document.documentElement.style.setProperty("--acc", t ? brightOf(t) : "#38bdf8"); });

  if (screen === "menu") return <MainMenu onNew={() => setScreen("new")} onLoad={id => loadSlot(id).then(g => g ? enter(g) : alert("That save couldn't be loaded.")).catch(() => alert("That save couldn't be loaded."))} />;
  if (screen === "new") return <NewCareer onBack={() => setScreen("menu")} onStart={o => { const g = newGame(o); enter(g); saveGame(g).catch(() => {}); }} />;

  const step = () => { const had = !!G.awards.col; if (G.phase === "reg") simWeek(G); else advanceOff(G); return !had && !!G.awards.col; };
  const advance = () => { if (busy) return; setBusy("Simulating…"); setTimeout(() => { let show = false; try { show = step(); } catch (e) { console.error(e); toast("Something went wrong simulating: " + e.message); } setBusy(null); if (show) setCeremony(true); redraw(); save(); }, 30); };
  // Sim ahead a week at a time so the screen stays alive; stops at the Heisman, the offseason, or a new season.
  const simTo = until => { if (busy) return; setMenu(false); let n = 0; const tick = () => { let show = false, stop = false; try { show = step(); } catch (e) { console.error(e); toast("Something went wrong simulating: " + e.message); stop = true; }
    n++; stop = stop || show || n > 40 || until(G); setBusy(stop ? null : (G.phase === "reg" ? weekName(G.week) : OFF_STEPS[G.offStep]) + "…"); redraw(); if (stop) { if (show) setCeremony(true); save(); } else setTimeout(tick, 20); };
    setBusy("Simulating…"); setTimeout(tick, 30); };
  const ui = { G, act: fn => { fn(G); redraw(); save(); }, go: setTab, toast, setCeremony, openPlayer: id => setStack(s => [...s, ["p", id]]), openTeam: id => setStack(s => [...s, ["t", id]]), openGame: id => setStack(s => [...s, ["g", id]]), openInterview: id => setStack(s => [...s, ["i", id]]) };
  const t = userTeam(G), pop = () => setStack(s => s.slice(0, -1)), top = stack[stack.length - 1], off = G.phase === "off", open = G.events.filter(e => !e.done).length;
  const label = off ? (G.offStep < 5 ? "Next: " + OFF_STEPS[G.offStep + 1] : "Start the " + (G.year + 1) + " season") : "Play " + weekName(G.week).replace(/^Week/, "week");
  const TABS = [["Home", "Home"], ["Team", t.pro ? "Team" : "Team"], ["College", "College"], ["Pro", "Pro"], ["Office", "Front Office"], ["Stories", "Stories"], ["History", "History"]];
  return (
    <UICtx.Provider value={ui}>
      <div className="min-h-screen pb-24">
        <div className="relative overflow-hidden" style={{ height: 132 }}>
          <SceneBackdrop teams={[t]} dim={.5} nolabel />
          <div className="absolute inset-0 max-w-6xl mx-auto px-3 flex items-end pb-3 gap-3">
            <div className="cursor-pointer" onClick={() => ui.openTeam(t.id)}><Helmet t={t} size={62} /></div>
            <div className="flex-1 min-w-0"><div className="text-[10px] uppercase tracking-[.3em] text-white/70">{G.year} · {off ? "Offseason · " + OFF_STEPS[G.offStep] : weekName(G.week)}</div>
              <div className="disp text-3xl sm:text-4xl text-white truncate" style={{ textShadow: "0 3px 18px rgba(0,0,0,.8)" }}>{!t.pro && t.rank ? <span className="text-xl text-white/70 mr-1.5">#{t.rank}</span> : null}{tname(t)}</div>
              <div className="text-xs text-white/80 tnum">{t.w}–{t.l}{!t.pro && t.conf !== "IND" ? ` (${t.cw}–${t.cl} ${G.confs[t.conf].name})` : ""} · {G.coach.name}</div></div>
            <div className="text-right"><div className="cursor-pointer" onClick={() => setTab("Stories")}><LPChip n={G.lp} /></div>
              <div className="relative mt-1"><button onClick={() => setMenu(!menu)} className="text-xs text-white/80 hover:text-white px-2 py-1 rounded-lg bg-black/30">Menu ▾</button>
                {menu && <div className="absolute right-0 top-8 z-40 w-56 card p-1 text-left text-sm pop" onMouseLeave={() => setMenu(false)}>
                  {!off && <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5" onClick={() => simTo(G => G.phase !== "reg" || G.week > COL_WEEKS)}>Sim to the end of the regular season</button>}
                  {!off && <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5" onClick={() => simTo(G => G.phase !== "reg")}>Sim to the offseason</button>}
                  {off && <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5" onClick={() => simTo(G => G.phase === "reg")}>Let the staff finish the offseason</button>}
                  <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5" onClick={() => { setMenu(false); saveGame(G).then(() => toast("Saved.")).catch(() => toast("Couldn't save.")); }}>Save now</button>
                  <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5" onClick={() => { setMenu(false); clearTimeout(saveT.current); saveGame(G).catch(() => {}).then(() => { gref.current = null; setScreen("menu"); }); }}>Save and exit to menu</button>
                </div>}</div></div>
          </div>
        </div>
        <div className="sticky top-0 z-30 border-b border-[#1f2a44]" style={{ background: "rgba(7,11,20,.92)", backdropFilter: "blur(10px)" }}>
          <div className="max-w-6xl mx-auto px-2 flex overflow-x-auto">{TABS.map(([k, l]) => <button key={k} onClick={() => { setTab(k); window.scrollTo({ top: 0 }); }} className={cx("tabbtn px-3 py-3 text-sm font-semibold whitespace-nowrap", tab === k ? "on text-white" : "text-slate-400 hover:text-slate-200")}>{l}{k === "Stories" && open > 0 && <span className="ml-1 inline-block w-4 h-4 rounded-full bg-acc text-slate-950 text-[10px] font-black leading-4 text-center">{open}</span>}</button>)}</div>
        </div>
        <div key={tab} className="max-w-6xl mx-auto px-3 pt-3 rise"><Safe key={tab + G.year + G.phase + G.offStep + G.week}>
          {tab === "Home" && <HomeTab />}
          {tab === "Team" && <TeamTab />}
          {tab === "College" && <CollegeTab />}
          {tab === "Pro" && <ProTab />}
          {tab === "Office" && <OfficeTab key={G.year + G.phase + G.offStep} />}
          {tab === "Stories" && <StoriesTab />}
          {tab === "History" && <HistoryTab />}
        </Safe></div>
        <div className="fixed bottom-0 inset-x-0 z-30 flex justify-end sm:justify-center p-3 pointer-events-none" style={{ background: "linear-gradient(transparent, rgba(7,11,20,.9) 60%)" }}>
          <button disabled={!!busy} onClick={advance} className="pointer-events-auto rounded-full px-6 py-3 font-black text-sm sm:text-base bg-acc text-slate-950 shadow-xl active:scale-95 transition-all" style={{ boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>{busy || label} {!busy && "▸"}</button>
        </div>
        {top && top[0] === "p" && <PlayerPage key={"p" + top[1] + stack.length} pid={top[1]} onClose={pop} />}
        {top && top[0] === "t" && <TeamPage key={"t" + top[1] + stack.length} tid={top[1]} onClose={pop} />}
        {top && top[0] === "g" && <BoxScore key={"g" + top[1] + stack.length} gid={top[1]} onClose={pop} />}
        {top && top[0] === "i" && <InterviewModal key={"i" + top[1] + stack.length} pid={top[1]} onClose={pop} />}
        {ceremony && G.awards.col && <Ceremony onClose={() => setCeremony(false)} />}
        {toastMsg && <div className="fixed left-1/2 -translate-x-1/2 bottom-20 z-[90] px-4 py-2.5 rounded-xl text-sm bg-slate-100 text-slate-950 font-semibold shadow-xl pop max-w-[90vw] text-center">{toastMsg}</div>}
      </div>
    </UICtx.Provider>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
