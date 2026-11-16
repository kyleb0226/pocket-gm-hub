
/* =========================================================================
   UI — draft centre (board, mock draft, needs, grades) and interviews
   ========================================================================= */
const Dots = ({ n, max = 5, color = "#fbbf24" }) => <span className="tracking-tighter" style={{ color }}>{"●".repeat(n)}<span className="text-slate-700">{"●".repeat(max - n)}</span></span>;
const InterestBar = ({ v }) => <span className="inline-flex items-center gap-1.5 align-middle"><span className="inline-block w-14 h-1.5 rounded-full bg-slate-800 overflow-hidden"><span className="block h-full rounded-full" style={{ width: v + "%", background: v >= 66 ? "#4ade80" : v >= 40 ? "#fbbf24" : "#f87171" }} /></span><span className="text-[10px] text-slate-400 tnum w-5">{v}</span></span>;
const IV_Q = {
  we: ["What does a normal Tuesday look like for you?", ["\"Honestly? Class, practice, then I'm on my phone.\" He shrugs.", "\"I do what the coaches ask.\" Nothing more, nothing less.", "\"Lift at six, film after practice. Pretty standard.\"", "\"First one in. I've got a key to the weight room.\"", "\"I haven't missed a workout since ninth grade. Ask anybody.\" His coach nods before you can."]],
  ld: ["Tell me about a time the locker room needed someone to speak up.", ["He looks at the floor. \"That's not really my thing.\"", "\"I let the older guys handle that.\"", "\"I'll say something if it needs saying.\"", "\"I called the players-only meeting. We won the next five.\"", "\"Coach lets me run Thursday's practice. The guys listen.\" You believe him."]],
  iq: ["Put this play on the board and walk me through it.", ["He draws it wrong twice, then laughs it off.", "He gets the gist but misses the hot read.", "Clean enough. He knows his job on the play.", "He draws all eleven and tells you where the defense is lying.", "He redraws your play with a better protection. He's right."]],
  cl: ["Worst moment you've had on a field — what happened next?", ["His jaw tightens. \"The refs cost us that game.\"", "\"I was in my head the rest of the night.\"", "\"Next play. That's all you can do.\"", "\"I asked for the ball on the next series.\"", "He grins. \"We scored on the next snap. I don't remember the bad ones.\""]],
};
function InterviewModal({ pid, onClose }){
  const ui = useUI(), G = ui.G, p = G.players[pid]; if (!p) return null;
  const t = T(G, p.tid) || (p.col != null ? T(G, p.col) : null), known = !!G.scouted[p.id], prospect = p.exp == null && !p.recruit, fa = !!p.fa && p.exp != null, c = prospect ? combine(p) : null;
  const acc = t ? [t.c1, t.c2] : ["#38bdf8", "#f8fafc"];
  return (
    <Modal onClose={onClose} accent={acc}>
      <div className="p-5" style={{ background: `radial-gradient(ellipse at top left, ${acc[0]}44, transparent 60%)` }}>
        <div className="text-[10px] uppercase tracking-[.3em] text-slate-400">{p.recruit ? "Home visit" : fa ? "Free-agent meeting" : "Prospect interview"}</div>
        <div className="flex items-center gap-3 mt-1">{t && <Helmet t={t} size={46} />}<div><div className="disp text-3xl"><PLink p={p} /></div><div className="text-xs text-slate-400">{p.pos} · {fmtHt(p.ht)}, {p.wt} lb · {p.recruit ? p.hs + " · " + p.home : t ? tname(t) : ""}{p.stars && p.recruit ? <span className="ml-1.5"><Stars n={p.stars} /></span> : null}</div></div></div>
      </div>
      {!known ? <div className="p-5"><div className="text-sm text-slate-300">Sit down with him and you'll leave knowing his true ratings, what he's like, and what he wants. You have <b className="text-amber-300">{G.ivLeft}</b> {G.mode === "pro" ? "interviews" : "visits"} left this {G.phase === "off" ? "offseason" : "season"}.</div><div className="mt-4"><Btn kind="pri" disabled={G.ivLeft <= 0} onClick={() => ui.act(G => interview(G, p))}>{G.mode === "pro" ? "Start the interview" : "Make the visit"}</Btn></div></div>
        : <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{TRAITS.map(([k, l]) => <div key={k} className="card p-2.5 text-center pop"><div className="text-[10px] uppercase tracking-widest text-slate-500">{l}</div><div className="text-lg mt-0.5"><Dots n={trait(p, k)} /></div></div>)}</div>
          <div className="flex items-center gap-4 flex-wrap text-sm"><span>True rating <Ovr v={p.ovr} /></span><span>Ceiling <Ovr v={p.pot} /></span>{prospect && <span className="text-slate-400">Pro projection <b className="text-slate-100">{proProj(p.ovr)}</b> as a rookie</span>}{redFlag(p) && <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 text-xs font-bold">⚑ Character concerns</span>}</div>
          {c && <div className="grid grid-cols-4 gap-2 text-center">{[["40-yard", c.forty + "s"], ["Bench", c.bench + " reps"], ["Vertical", c.vert + "″"], ["3-cone", c.cone + "s"]].map(([l, v]) => <div key={l} className="rounded-lg bg-white/5 p-2"><div className="text-[10px] uppercase tracking-widest text-slate-500">{l}</div><div className="font-bold tnum">{v}</div></div>)}</div>}
          <div className="space-y-2.5">{TRAITS.map(([k]) => <div key={k} className="text-sm"><div className="text-slate-400 italic">"{IV_Q[k][0]}"</div><div className="text-slate-200 mt-0.5 pl-3 border-l-2" style={{ borderColor: acc[0] }}>{IV_Q[k][1][trait(p, k) - 1]}</div></div>)}</div>
          {p.recruit || p.portal ? <div className="card p-3"><div className="text-[10px] uppercase tracking-widest text-slate-500">What matters most to him</div><div className="font-bold mt-0.5">{PRIOS[prioOf(p)]}</div><div className="flex items-center gap-2 mt-2 text-xs text-slate-400">Interest in {userTeam(G).name}: <InterestBar v={recruitInterest(G, p)} /></div><div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">Leaders: {recruitLeaders(G, p).map(([x]) => <Badge key={x.id} t={x} size={14} />)}</div>
            <div className="mt-3 flex items-center gap-2"><Btn small kind="pri" disabled={G.pitchLeft <= 0 || (G.pitches[p.id] || 0) >= 3} onClick={() => ui.act(G => pitch(G, p))}>Pitch him ({G.pitches[p.id] || 0}/3)</Btn><span className="text-[11px] text-slate-500">Pitches land harder now that you know what he wants.</span></div></div> : null}
          {fa && G.mode === "pro" ? <div className="card p-3 text-sm"><div className="flex items-center gap-2">Interest in the {userTeam(G).nick}: <InterestBar v={faInterest(G, p, G.uid)} /></div><div className="text-xs text-slate-400 mt-1">He's asking {money(askFor(G, p, G.uid))} a year from you (market rate {money(askOf(G, p))}). Players who'd rather be elsewhere charge a premium.</div></div> : null}
          {prospect && <div className="text-xs text-slate-400">Work ethic changes how fast a young player develops. {trait(p, "we") >= 4 ? "This one will get everything out of his talent." : trait(p, "we") <= 2 ? "This one may never reach his ceiling." : ""}</div>}
        </div>}
    </Modal>
  );
}

function MockDraft(){
  const ui = useUI(), G = ui.G, [n, setN] = useState(32), picks = useMemo(() => mockDraft(G, n), [n, G.week, G.offStep, G.draft && G.draft.pick, G.year]);
  const mine = picks.filter(x => G.mode === "pro" ? x.tid === G.uid : x.p.tid === G.uid || x.p.col === G.uid);
  if (!picks.length) return <Card><Empty>The next mock goes up once the new season is under way.</Empty></Card>;
  return (<div className="space-y-3">
    {mine.length > 0 && <div className="card p-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--acc) 50%, transparent)" }}>{G.mode === "pro" ? <span>The mock has you taking {mine.map((x, i) => <span key={x.pk}>{i ? ", " : ""}<PLink p={x.p} /> ({x.p.pos}) at No. {x.pk}</span>)}.</span> : <span>Your players in this mock: {mine.map((x, i) => <span key={x.pk}>{i ? ", " : ""}<PLink p={x.p} /> No. {x.pk} to the {T(G, x.tid).nick}</span>)}.</span>}</div>}
    <Card title={`Mock draft · ${G.year + (G.phase === "off" ? 1 : 1)}`} right={<span className="inline-flex gap-1">{[[32, "Round 1"], [64, "2 rounds"], [96, "3 rounds"]].map(([k, l]) => <button key={k} onClick={() => setN(k)} className={cx("px-2 py-0.5 rounded text-[11px] font-semibold", n === k ? "bg-acc text-slate-950" : "text-slate-400")}>{l}</button>)}</span>} pad={false}>
      <div className="grid md:grid-cols-2 gap-x-3 p-2">{picks.map((x, i) => { const t = T(G, x.tid), ct = T(G, x.p.tid != null ? x.p.tid : x.p.col), hi = x.tid === G.uid || (ct && ct.id === G.uid); return (
        <div key={x.pk} className={cx("flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm pop", hi && "bg-white/10")} style={{ animationDelay: Math.min(i, 40) * 14 + "ms" }}>
          <span className="w-6 text-right text-slate-500 tnum text-xs">{x.pk}</span><span className="cursor-pointer" onClick={() => ui.openTeam(t.id)}><Badge t={t} size={18} /></span>
          <div className="flex-1 min-w-0"><div className="truncate"><PLink p={x.p} /> <span className="text-slate-400 text-xs">{x.p.pos}{ct ? " · " + ct.name : ""}</span></div></div>
          {x.need && <span className="text-[9px] uppercase tracking-wider text-emerald-300/90">need</span>}<span className="text-xs tnum text-slate-400 w-6 text-right">{proProj(seen(G, x.p).ovr)}</span>
        </div>); })}</div>
      <div className="px-4 pb-3 text-[11px] text-slate-500">Built from each team's needs and the consensus board; it shifts as the season goes. The number is the projected rookie rating on the pro scale.</div>
    </Card>
  </div>);
}
function NeedsCard(){
  const ui = useUI(), G = ui.G, [tid, setTid] = useState(G.mode === "pro" ? G.uid : G.pro[0].id), rows = useMemo(() => teamNeeds(G, tid), [tid, G.week, G.offStep, G.draft && G.draft.pick]);
  return <Card title="Team needs" right={<Sel value={tid} onChange={v => setTid(v == null ? G.pro[0].id : v)}>{G.pro.map(t => <option key={t.id} value={t.id}>{tname(t)}</option>)}</Sel>}>
    <div className="space-y-1.5">{rows.map(r => <div key={r.pos} className="flex items-center gap-2 text-xs"><span className="w-7 font-bold text-slate-300">{r.pos}</span><div className="flex-1 relative h-4 rounded bg-slate-800 overflow-hidden"><div className="grow absolute inset-y-0 left-0 rounded" style={{ width: clamp((r.v - 55) / 44 * 100, 2, 100) + "%", background: r.gap <= -3 ? "#f87171" : r.gap < 2 ? "#fbbf24" : "#4ade80" }} /><div className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: clamp((r.lg - 55) / 44 * 100, 0, 100) + "%" }} title="League average" /></div><span className="w-7 tnum text-right font-bold">{r.v}</span><span className={cx("w-8 tnum text-right", r.gap < 0 ? "text-rose-300" : "text-emerald-300")}>{r.gap > 0 ? "+" : ""}{r.gap}</span><span className="w-12 text-slate-500 text-right">age {r.age}</span></div>)}</div>
    <div className="text-[11px] text-slate-500 mt-2">Starter rating by position. The white line is the league average; red is where this team should be shopping.</div></Card>;
}
function DraftGrades(){
  const ui = useUI(), G = ui.G, g = G.draft && G.draft.grades;
  if (!g) return <Card><Empty>Grades are handed out the moment the last pick is in.</Empty></Card>;
  return <Card title={`${G.year + 1} draft grades`} pad={false}><table className="st"><thead><tr><th className="l">Team</th><th>Grade</th><th className="l">Best value</th></tr></thead><tbody>{g.map(r => { const t = T(G, r.tid); return <tr key={r.tid} className={r.tid === G.uid ? "bg-white/5" : ""}><td className="l"><Badge t={t} size={13} /> <TeamLink t={t} full /></td><td className="font-black" style={{ color: r.g[0] === "A" ? "#4ade80" : r.g[0] === "B" ? "#a3e635" : r.g[0] === "C" ? "#fbbf24" : "#f87171" }}>{r.g}</td><td className="l text-xs">{r.best ? <span><PLink pid={r.best[0]} name={r.best[1]} /> <span className="text-slate-500">{r.best[2]} · pick {r.best[3]}, ranked {r.best[4]}</span></span> : "—"}</td></tr>; })}</tbody></table></Card>;
}
function DraftCenter(){
  const ui = useUI(), G = ui.G, d = G.draft, live = d && !d.done && G.offStep === 3, [tab, setTab] = useState(d && d.grades && G.phase === "off" ? "Grades" : live ? "Draft room" : "Big board"), [f, setF] = useState("All");
  const active = d && !d.done, mine = live && G.mode === "pro" && onClock(G) === G.uid, pk = d ? d.pick + 1 : 0, pro = G.mode === "pro";
  const pool = prospects(G).filter(p => f === "All" || p.pos === f).slice(0, 60), log = d && G.phase === "off" ? d.log.slice().reverse() : [];
  const ivBtn = p => <Btn small onClick={() => ui.openInterview(p.id)}>{G.scouted[p.id] ? "Notes" : "Interview"}</Btn>;
  const cols = [["School", p => <TeamLink t={T(G, p.tid != null ? p.tid : p.col)} />, 1], ["Rk", p => (d && d.rank && d.rank[p.id]) || "—"], ["Pro", p => <span className="text-slate-300">{seen(G, p).exact ? "" : "~"}{proProj(seen(G, p).ovr)}</span>], ["40", p => combine(p).forty]];
  return (<div>
    <SubTabs tabs={[active || !d || !d.log.length ? "Big board" : null, live || log.length ? "Draft room" : null, active || G.phase === "reg" ? "Mock draft" : null, active || G.phase === "reg" ? "Combine" : null, "Team needs", d && d.grades && G.phase === "off" ? "Grades" : null].filter(Boolean)} value={tab} onChange={setTab} />
    {tab === "Big board" && <Card title={"Big board · " + (G.year + 1) + " draft"} right={pro ? <span><b className="text-amber-300">{G.ivLeft}</b> interviews left · ~ is an unscouted read</span> : "College ratings; “Pro” is the projected rookie rating"}>
      <PosFilter value={f} onChange={setF} /><PTable rows={pool} empty="No prospects at that position." cols={pro ? [...cols, ["", ivBtn]] : cols} /></Card>}
    {tab === "Draft room" && <div>{myDraftees(G).length > 0 && G.phase === "off" && <div className="card p-3 mb-3 flex items-center gap-3 text-sm"><span className="text-2xl">📞</span><div className="flex-1">{myDraftees(G).length} of your players got the call this year.</div><Btn small kind="pri" onClick={() => ui.act(G => { G.callsSeen = null; })}>Replay the calls</Btn></div>}<DraftNight /><div className="grid lg:grid-cols-5 gap-3">
      <div className="lg:col-span-3"><Card title={d.done ? "Draft complete" : `Round ${Math.ceil(pk / 32)} · Pick ${pk}`} right={d.done ? d.log.length + " picks" : mine ? <span className="text-amber-300 font-bold">You're on the clock</span> : tname(T(G, onClock(G))) + " on the clock"}>
        {mine && <div className="rounded-lg p-2.5 mb-2 text-xs bg-amber-400/10 text-amber-200">Pick a player below. The rest of the league picks until you're up again. Check Team needs and the Mock if you're torn.</div>}
        {!d.done ? <div><PosFilter value={f} onChange={setF} /><PTable rows={pool} empty="No prospects left at that position." cols={[...cols.slice(0, 3), ["", p => <span className="inline-flex gap-1">{pro && ivBtn(p)}{mine && <Btn small kind="pri" onClick={() => ui.act(G => { draftAssign(G, p); draftRun(G, false); })}>Draft</Btn>}</span>]]} /></div>
          : <Empty>All seven rounds are in the books. Undrafted players have hit free agency — see Grades for how every team did.</Empty>}
      </Card></div>
      <div className="lg:col-span-2"><Card title="Picks" pad={false}><div style={{ maxHeight: 520 }} className="overflow-y-auto">{log.length ? <table className="st tnum"><tbody>{log.slice(0, 224).map(r => { const t = T(G, r[1]), ct = r[5] != null ? T(G, r[5]) : null; return <tr key={r[0]} className={t.id === G.uid || (ct && ct.id === G.uid) ? "bg-white/5" : ""}><td className="l w-7 text-slate-500">{r[0]}</td><td className="l"><Badge t={t} size={13} /></td><td className="l"><PLink pid={r[2]} name={r[3]} /> <span className="text-slate-500">{r[4]}</span></td><td className="l text-slate-400">{ct ? ct.abbr : ""}</td></tr>; })}</tbody></table> : <Empty>No picks yet.</Empty>}</div></Card></div>
    </div></div>}
    {tab === "Mock draft" && <MockDraft />}
    {tab === "Combine" && <CombineBoard />}
    {tab === "Team needs" && <NeedsCard />}
    {tab === "Grades" && <DraftGrades />}
  </div>);
}
