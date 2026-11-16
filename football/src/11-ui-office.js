
/* =========================================================================
   UI — Stories (optional play), Front Office, History
   ========================================================================= */
const Sel = ({ value, onChange, children, disabled }) => <select disabled={disabled} value={value == null ? "" : value} onChange={e => onChange(e.target.value === "" ? null : +e.target.value)} className="bg-[#0b111e] border border-[#26324f] rounded-lg px-2 py-1.5 text-xs text-slate-100 max-w-full">{children}</select>;
const PosFilter = ({ value, onChange }) => <div className="flex gap-1 overflow-x-auto pb-1 mb-2">{["All", ...POS].map(x => <button key={x} onClick={() => onChange(x)} className={cx("px-2 py-1 rounded text-[11px] font-semibold border", value === x ? "bg-acc text-slate-950 border-transparent" : "border-[#26324f] text-slate-400")}>{x}</button>)}</div>;
const LPChip = ({ n }) => <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/15 text-amber-300 tnum">◆ {n}</span>;

/* ----------------------------- Stories ----------------------------- */
function StoriesTab(){
  const ui = useUI(), G = ui.G, [tab, setTab] = useState("Stories"), ev = G.events.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || b.id - a.id);
  const slate = G.slate && G.phase === "reg" ? G.slate : null, predOpen = G.phase === "reg" && G.week === 1, pr = G.preds;
  return (<div>
    <div className="card p-3 mb-3 flex items-center gap-3 flex-wrap"><div className="text-3xl">◆</div><div className="flex-1 min-w-[180px]"><div className="disp text-xl text-amber-300">{G.lp} Legacy Points</div><div className="text-[11px] text-slate-400">Everything on this page is optional. Skip it and nothing bad happens — play along and it pays out in points you can spend on your program.</div></div><div className="text-xs text-slate-400 text-right">Pick'em {G.pickRec.w}–{G.pickRec.l}<br />Best streak {G.pickRec.best}</div></div>
    <SubTabs tabs={["Stories", "Pick'em", "Predictions", "Legacy shop", "Ledger"]} value={tab} onChange={setTab} />
    {tab === "Stories" && (ev.length ? <div className="grid md:grid-cols-2 gap-3">{ev.map(e => (
      <div key={e.id} className={cx("card p-4 pop", e.done && "opacity-70")}>
        <div className="text-[10px] uppercase tracking-widest text-slate-500">{e.done ? "Decided" : e.w >= 99 ? "This offseason" : "Decide by week " + e.w}</div>
        <div className="disp text-lg mt-1">{e.title}</div><div className="text-sm text-slate-300 mt-1.5 leading-relaxed">{e.body}</div>
        {e.done ? <div className="mt-3 text-sm rounded-lg p-2.5 bg-white/5"><span className="text-slate-400">You chose: </span><b>{e.opts[e.pick] && e.opts[e.pick].l}</b><div className="text-slate-300 mt-1">{e.result}</div></div>
          : <div className="mt-3 space-y-1.5">{e.opts.map((o, i) => <button key={i} onClick={() => ui.act(G => chooseEvent(G, e.id, i))} className="w-full text-left rounded-lg px-3 py-2 bg-[#1a2540] hover:bg-[#223052] border border-[#2a3860] transition-colors"><div className="text-sm font-semibold">{o.l}</div>{o.d && <div className="text-[11px] text-slate-400">{o.d}</div>}</button>)}</div>}
      </div>))}</div> : <Card><Empty>No stories right now. They turn up through the season — a quarterback controversy, a booster with an idea, a rival talking.</Empty></Card>)}
    {tab === "Pick'em" && (slate && slate.games.length ? <Card title={"Week " + slate.w + " slate"} right="2 ◆ for a strong week · +2 for a perfect one"><div className="space-y-2">{slate.games.map(x => { const g = gameById(G, x.gid); if (!g) return null; const [H, A] = gameTeams(G, g), side = t => <button disabled={g.done} onClick={() => ui.act(() => { x.pick = x.pick === t.id ? null : t.id; })} className={cx("flex-1 flex items-center gap-2 rounded-lg px-2.5 py-2 border transition-all", x.pick === t.id ? "border-transparent text-slate-950 bg-acc" : "border-[#26324f] hover:border-slate-500")}><Badge t={t} size={16} /><span className="text-sm font-semibold truncate">{t.rank ? t.rank + " " : ""}{t.pro ? t.nick : t.name}</span><span className="ml-auto text-[10px] opacity-70">{t.w}–{t.l}</span></button>;
        return <div key={x.gid} className="flex items-center gap-2">{side(A)}<span className="text-[10px] text-slate-500">at</span>{side(H)}{g.done && <span className={x.ok ? "text-emerald-400" : x.pick == null ? "text-slate-600" : "text-rose-400"}>{x.pick == null ? "—" : x.ok ? "✓" : "✗"}</span>}</div>; })}</div></Card>
      : <Card><Empty>The pick'em slate opens each week of the season.</Empty></Card>)}
    {tab === "Predictions" && <div className="grid md:grid-cols-2 gap-3">
      <Card title="Preseason calls" right={predOpen ? "Open until week 1 kicks off" : "Locked"}>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2"><span>National champion <LPChip n={15} /></span><Sel disabled={!predOpen} value={pr.champ} onChange={v => ui.act(() => { pr.champ = v; })}><option value="">—</option>{(G.preTop || []).map((id, i) => <option key={id} value={id}>{i + 1}. {T(G, id).name}</option>)}</Sel></div>
          <div className="flex items-center justify-between gap-2"><span>Heisman winner <LPChip n={10} /></span><Sel disabled={!predOpen} value={pr.heis} onChange={v => ui.act(() => { pr.heis = v; })}><option value="">—</option>{(G.heisCands || []).map(id => G.players[id]).filter(Boolean).map(p => <option key={p.id} value={p.id}>{pname(p)} · {p.pos} · {T(G, p.tid).abbr}</option>)}</Sel></div>
          <div className="flex items-center justify-between gap-2"><span>Pocket Bowl champion <LPChip n={10} /></span><Sel disabled={!predOpen} value={pr.proChamp} onChange={v => ui.act(() => { pr.proChamp = v; })}><option value="">—</option>{G.pro.map(t => <option key={t.id} value={t.id}>{tname(t)}</option>)}</Sel></div>
        </div>
        {pr.result && pr.result.length > 0 && <div className="mt-3 text-xs text-emerald-300">Paid out: {pr.result.join(" · ")}</div>}
      </Card>
      <Card title="Conference champions" right={<LPChip n={2} />}><div className="grid grid-cols-2 gap-2">{CONF_ORDER.filter(c => c !== "IND").map(cid => <div key={cid}><div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">{G.confs[cid].name}</div><Sel disabled={!predOpen} value={(pr.conf || {})[cid]} onChange={v => ui.act(() => { pr.conf = pr.conf || {}; if (v == null) delete pr.conf[cid]; else pr.conf[cid] = v; })}><option value="">—</option>{G.col.filter(t => t.conf === cid).sort((a, b) => a.rkAll - b.rkAll).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Sel></div>)}</div></Card>
    </div>}
    {tab === "Legacy shop" && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{SHOP.filter(it => !it.mode || it.mode === G.mode).map(it => { const ok = G.lp >= it.cost && (!it.can || it.can(G)); return (
      <div key={it.id} className="card p-4 flex flex-col"><div className="flex items-start justify-between gap-2"><div className="font-bold">{it.name}</div><LPChip n={it.cost} /></div><div className="text-xs text-slate-400 mt-1 flex-1">{it.desc}</div><Btn small kind={ok ? "pri" : undefined} disabled={!ok} className="mt-3 self-start" onClick={() => { let msg; ui.act(G => { msg = buy(G, it.id); }); if (msg) ui.toast(msg); }}>{it.can && !it.can(G) ? "Maxed out" : "Spend"}</Btn></div>); })}</div>}
    {tab === "Ledger" && <Card title="Where the points came from">{(G.lpLog || []).length ? <table className="st tnum"><tbody>{G.lpLog.map((r, i) => <tr key={i}><td className="l text-slate-500 w-20">{r[0]} · wk {r[1]}</td><td className="l">{r[3]}</td><td className="text-amber-300 font-bold">+{r[2]}</td></tr>)}</tbody></table> : <Empty>Nothing earned yet.</Empty>}</Card>}
  </div>);
}

/* ----------------------------- Front Office ----------------------------- */
function PTable({ rows, cols, empty }){
  const ui = useUI(), G = ui.G;
  if (!rows.length) return <Empty>{empty || "Nobody here."}</Empty>;
  return <div className="overflow-x-auto"><table className="st tnum"><thead><tr><th className="l">Pos</th><th className="l">Player</th><th>Age</th><th>Ovr</th><th>Pot</th>{cols.map(c => <th key={c[0]} className={c[2] ? "l" : ""}>{c[0]}</th>)}</tr></thead>
    <tbody>{rows.map(p => { const sv = seen(G, p); return <tr key={p.id}><td className="l font-bold text-slate-400">{p.pos}</td><td className="l"><PLink p={p} />{p.stars ? <span className="ml-1.5"><Stars n={p.stars} /></span> : null}</td><td>{p.cls != null ? CLS[p.cls] : p.age}</td><td><Ovr v={sv.ovr} fuzzy={!sv.exact} /></td><td><Ovr v={sv.pot} fuzzy={!sv.exact} /></td>{cols.map(c => <td key={c[0]} className={c[2] ? "l" : ""}>{c[1](p)}</td>)}</tr>; })}</tbody></table></div>;
}
function CapCard(){
  const G = useUI().G, pay = payroll(G, G.uid), top = rosterOf(G, G.uid).slice().sort((a, b) => b.c.amt - a.c.amt).slice(0, 12);
  return <Card title="Salary cap" right={money(pay) + " of " + money(CAP)}><HBar v={pay} max={CAP} color={pay > CAP ? "#f87171" : "var(--acc)"} h={10} /><div className="text-xs text-slate-400 mt-1.5 mb-2">{capRoom(G, G.uid) >= 0 ? money(capRoom(G, G.uid)) + " of room" : money(-capRoom(G, G.uid)) + " over the cap"} · {rosterOf(G, G.uid).length} players under contract</div>
    <PTable rows={top} cols={[["Salary", p => money(p.c.amt)], ["Yrs", p => p.c.yrs]]} /></Card>;
}
function FreeAgentPanel(){
  const ui = useUI(), G = ui.G, [f, setF] = useState("All"), room = capRoom(G, G.uid), n = rosterOf(G, G.uid).length;
  const rows = freeAgents(G).filter(p => f === "All" || p.pos === f).slice(0, 50);
  return <Card title="Free agents" right={`${money(room)} cap room · ${n} on roster`}><PosFilter value={f} onChange={setF} />
    <PTable rows={rows} empty="No free agents at that position." cols={[["Interest", p => <InterestBar v={faInterest(G, p, G.uid)} />], ["Asking", p => money(askFor(G, p, G.uid)) + "/yr"], ["", p => <span className="inline-flex gap-1"><Btn small onClick={() => ui.openInterview(p.id)}>Meet</Btn><Btn small kind="pri" disabled={askFor(G, p, G.uid) > room || n >= 58} onClick={() => { ui.act(G => signFA(G, p, G.uid, 2, askFor(G, p, G.uid))); ui.toast(`${pname(p)} signs for two years.`); }}>Sign</Btn></span>]]} /></Card>;
}
function ResignPanel(){
  const ui = useUI(), G = ui.G, rows = rosterOf(G, G.uid).filter(p => p.expiring).sort((a, b) => b.ovr - a.ovr), d = depthChart(G, G.uid);
  return <Card title="Expiring contracts" right={money(capRoom(G, G.uid)) + " cap room"}>
    <div className="text-xs text-slate-400 mb-2">Anyone you don't re-sign here walks into free agency when you advance.</div>
    <PTable rows={rows} empty={G.offStep > 1 ? "Re-signing is closed for this year." : "Nobody on your roster is out of contract."} cols={[["Role", p => d[p.pos].indexOf(p) < STARTERS[p.pos] ? "Starter" : "Depth"], ["Asking", p => money(askOf(G, p)) + "/yr"], ["", p => <span className="inline-flex gap-1">{[1, 3].map(y => <Btn key={y} small kind={y === 3 ? "pri" : undefined} onClick={() => ui.act(G => resign(G, p, y))}>{y} yr</Btn>)}</span>]]} /></Card>;
}
function DraftPanel(){
  const ui = useUI(), G = ui.G, d = G.draft, [f, setF] = useState("All");
  if (!d || (d.done && !d.log.length)) {
    const rows = colPlayers(G).filter(p => p.cls >= 2 && (f === "All" || p.pos === f)).sort((a, b) => { const x = seen(G, a), y = seen(G, b); return (y.ovr * .68 + y.pot * .32) - (x.ovr * .68 + x.pot * .32); }).slice(0, 50);
    return <Card title={"Big board · " + (G.year + 1) + " draft"} right={G.mode === "pro" ? "~ means an unscouted read" : "Juniors and seniors"}><PosFilter value={f} onChange={setF} /><PTable rows={rows} cols={[["School", p => <TeamLink t={T(G, p.tid)} />, 1], ["Season", p => seasonLine(p) || "—", 1]]} /></Card>;
  }
  const live = G.offStep === 3 && !d.done, mine = live && G.mode === "pro" && onClock(G) === G.uid, pk = d.pick + 1;
  const pool = d.pool.map(id => G.players[id]).filter(p => p && (f === "All" || p.pos === f)).slice(0, 60), log = d.log.slice().reverse();
  return (<div className="grid lg:grid-cols-5 gap-3">
    <div className="lg:col-span-3"><Card title={d.done ? "Draft complete" : live ? `Round ${Math.ceil(pk / 32)} · Pick ${pk}` : "Draft board"} right={d.done ? d.log.length + " picks" : mine ? <span className="text-amber-300 font-bold">You're on the clock</span> : live ? tname(T(G, onClock(G))) + " on the clock" : "The draft starts at the next step"}>
      {mine && <div className="rounded-lg p-2.5 mb-2 text-xs bg-amber-400/10 text-amber-200 pulse">Pick a player below. The rest of the league picks until you're up again.</div>}
      {!d.done && <div><PosFilter value={f} onChange={setF} /><PTable rows={pool} empty="No prospects left at that position." cols={[["College", p => <TeamLink t={T(G, p.col)} />, 1], ["", p => mine ? <Btn small kind="pri" onClick={() => ui.act(G => { draftAssign(G, p); draftRun(G, false); })}>Draft</Btn> : null]]} /></div>}
      {d.done && <Empty>All seven rounds are in the books. Undrafted players have hit free agency.</Empty>}
    </Card></div>
    <div className="lg:col-span-2"><Card title="Picks" pad={false}><div style={{ maxHeight: 520 }} className="overflow-y-auto">{log.length ? <table className="st tnum"><tbody>{log.slice(0, 120).map(r => { const t = T(G, r[1]), ct = r[5] != null ? T(G, r[5]) : null; return <tr key={r[0]} className={t.id === G.uid || (ct && ct.id === G.uid) ? "bg-white/5" : ""}><td className="l w-7 text-slate-500">{r[0]}</td><td className="l"><Badge t={t} size={13} /></td><td className="l"><PLink pid={r[2]} name={r[3]} /> <span className="text-slate-500">{r[4]}</span></td><td className="l text-slate-400">{ct ? ct.abbr : ""}</td></tr>; })}</tbody></table> : <Empty>No picks yet.</Empty>}</div></Card></div>
  </div>);
}
function RecruitPanel({ portal }){
  const ui = useUI(), G = ui.G, [f, setF] = useState("All"), [mineOnly, setMine] = useState(false), [st, setSt] = useState(null), [map, setMap] = useState(true), ut = userTeam(G);
  const all = ((portal ? G.portal : G.rec) || []).map(id => G.players[id]).filter(Boolean);
  const rows = all.filter(p => (f === "All" || p.pos === f) && (!mineOnly || G.pitches[p.id]) && (!st || stOf(p) === st)).slice(0, 40);
  const need = POS.filter(pos => rosterOf(G, ut.id).filter(p => p.pos === pos && !p.portal).length < COL_NEED[pos]);
  if (!all.length) return <Card><Empty>{portal ? "The portal is empty. It fills when the season ends." : G.phase === "off" ? "Signing Day is done — see Class ranks." : "Recruiting opens when the season ends. Your staff is on the road until then."}</Empty></Card>;
  return <div className="space-y-3"><NilBar /><Card title={portal ? "Transfer portal" : "Recruiting board"} right={<span><b className="text-amber-300">{G.pitchLeft}</b> pitches · <b className="text-amber-300">{G.ivLeft}</b> visits left</span>}>
    <div className="text-xs text-slate-400 mb-2">A pitch moves you up a player's list (three at most). Once you clearly lead, he commits and it's locked — stop spending on him. The green “Lock” button shows exactly what it costs to get there, so no money is wasted. A visit shows his true ratings and what he wants — and makes your pitches count for more. He signs on Signing Day with the school that pulls hardest — prestige, home state and your pitches all count. {need.length ? <span>Open spots on your roster: <b className="text-slate-200">{need.join(", ")}</b>.</span> : "Your roster is full at every position."}</div>
    <div className="flex items-center justify-between mb-1"><span className="link text-[11px] text-slate-400" onClick={() => setMap(!map)}>{map ? "▾ Hide" : "▸ Show"} the map</span>{st && <span className="text-[11px]">Showing <b className="text-amber-300">{st}</b> only · <span className="link text-slate-400" onClick={() => setSt(null)}>clear</span></span>}</div>
    {map && <div className="mb-3"><RecruitMap recs={all.filter(p => f === "All" || p.pos === f)} sel={st} onSel={setSt} /></div>}
    <div className="flex items-center gap-3"><div className="flex-1 min-w-0"><PosFilter value={f} onChange={setF} /></div><label className="text-[11px] text-slate-400 whitespace-nowrap mb-2"><input type="checkbox" checked={mineOnly} onChange={e => setMine(e.target.checked)} /> pitched</label></div>
    <PTable rows={rows} empty="Nobody matches." cols={[portal ? ["From", p => <TeamLink t={T(G, p.tid)} />, 1] : ["Rk", p => "#" + p.rk], ["Home", p => p.home, 1],
      ["Interest", p => <InterestBar v={recruitInterest(G, p)} />], ["Wants", p => G.scouted[p.id] ? ({ home: "Home", prestige: "Prestige", win: "Winning", coach: "Coach" })[prioOf(p)] : <span className="text-slate-600">?</span>, 1],
      ["Leaders", p => <span className="inline-flex gap-1">{recruitLeaders(G, p).map(([t], i) => <span key={t.id} className={t.id === ut.id ? "ring-2 ring-amber-300 rounded-md" : i ? "opacity-60" : ""}><Badge t={t} size={13} /></span>)}</span>, 1],
      ["", p => { const n = G.pitches[p.id] || 0; if (p.commit === ut.id) return <span className="inline-flex items-center gap-1.5"><span className="px-2 py-1 rounded-md bg-emerald-400/15 text-emerald-300 text-[11px] font-bold">✓ Committed</span><Btn small onClick={() => ui.openInterview(p.id)}>Notes</Btn></span>; return <span className="inline-flex items-center gap-1.5"><span className="text-amber-300 tracking-tighter">{"●".repeat(n)}<span className="text-slate-700">{"●".repeat(3 - n)}</span></span><Btn small onClick={() => ui.openInterview(p.id)}>{G.scouted[p.id] ? "Notes" : "Visit"}</Btn>{p.tid !== ut.id && <NilBtn p={p} />}<Btn small kind="pri" disabled={G.pitchLeft <= 0 || n >= 3 || p.tid === ut.id} onClick={() => ui.act(G => pitch(G, p))}>Pitch</Btn></span>; }]]} /></Card></div>;
}
function ClassRanks(){
  const G = useUI().G, r = G.classRank;
  if (!r) return <Card><Empty>Class rankings appear after the first Signing Day.</Empty></Card>;
  const max = r[0].pts || 1, mine = r.findIndex(x => x.tid === G.uid), rows = r.slice(0, 25).map((x, i) => [x, i]); if (mine >= 25) rows.push([r[mine], mine]);
  return <Card title="Recruiting class rankings" pad={false}><table className="st tnum"><thead><tr><th className="l">#</th><th className="l">School</th><th>5★</th><th>4★</th><th>Avg</th><th>Signed</th><th className="l w-1/3">Points</th></tr></thead><tbody>{rows.map(([x, i]) => { const t = T(G, x.tid); return <tr key={x.tid} className={x.tid === G.uid ? "bg-white/5" : ""}><td className="l text-slate-500">{i + 1}</td><td className="l"><Badge t={t} size={13} /> <TeamLink t={t} /></td><td>{x.five}</td><td>{x.four}</td><td>{x.avg}</td><td>{x.n}</td><td className="l"><HBar v={x.pts} max={max} color={t.c1 === "#111111" ? t.c2 : t.c1} /></td></tr>; })}</tbody></table></Card>;
}
function SeasonReview(){
  const ui = useUI(), G = ui.G, t = userTeam(G), row = t.hist[t.hist.length - 1] || {}, h = G.hist.find(x => x.y === G.year) || {};
  const honors = rosterOf(G, t.id).concat((G.draft ? G.draft.pool : []).map(id => G.players[id]).filter(p => p && p.col === t.id)).flatMap(p => p.aw.filter(a => a[0] === G.year && !a[2]).map(a => [p, a[1]])).slice(0, 14);
  const earned = (G.lpLog || []).filter(r => r[0] === G.year), tot = sum(earned, r => r[2]);
  return <Card title={G.year + " season review"}>
    <div className="flex items-center gap-4 flex-wrap"><Helmet t={t} size={64} /><div><div className="disp text-3xl">{row.w}–{row.l}{!t.pro && row.rk ? <span className="text-base text-slate-400 ml-2">final rank No. {row.rk}</span> : null}</div><div className="text-sm text-slate-300">{row.post || (t.pro ? "Missed the playoffs" : "No bowl game")}{row.cc ? " · Conference champions" : ""}</div></div>
      <div className="ml-auto text-right text-xs text-slate-400">{row.y && <div className="mb-1"><SeasonCardBtn row={row} tid={t.id} /></div>}{h.natChamp != null && <div>National champion: <TeamLink t={T(G, h.natChamp)} /></div>}{h.heis && h.heis[0] && <div>Heisman: <PLink pid={h.heis[0].pid} name={h.heis[0].n} /></div>}{h.proChamp != null && <div>Pocket Bowl: <TeamLink t={T(G, h.proChamp)} full /></div>}</div></div>
    {honors.length > 0 && <div className="mt-3"><div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Your players' honors</div><div className="flex flex-wrap gap-1.5">{honors.map(([p, a], i) => <span key={i} className="px-2 py-1 rounded-full bg-amber-400/10 text-amber-200 text-[11px]"><PLink p={p} /> · {a}</span>)}</div></div>}
    {earned.length > 0 && <div className="mt-3 text-xs text-slate-400">Legacy Points this year: <b className="text-amber-300">+{tot}</b> — {earned.slice(0, 6).map(r => r[3]).join(", ")}{earned.length > 6 ? "…" : ""}</div>}
  </Card>;
}
function OfficeTab(){
  const ui = useUI(), G = ui.G, pro = G.mode === "pro", off = G.phase === "off", s = G.offStep;
  const tabs = pro ? (off ? ["Re-sign", "Free agents", "Trades", "Draft", "Cap"] : ["Draft", "Trades", "Free agents", "Cap"]) : ["Recruiting", "Portal", "Draft", "Class ranks"];
  const start = pro ? (off ? ["Re-sign", "Re-sign", "Free agents", "Draft", "Free agents", "Cap"][s] : "Draft") : (off ? ["Recruiting", "Recruiting", "Recruiting", "Draft", "Recruiting", "Class ranks"][s] : "Draft");
  const [tab, setTab] = useState(start);
  const tips = pro ? ["Look back on the year, then advance to open contract talks.", "Re-sign the players you want to keep. Everyone else hits the market when you advance.", "Shop the free-agent market. The draft begins when you advance.", "The draft is live. Make your picks; advancing lets your scouts finish it for you.", "College Signing Day happens around the league. Free agents are still available.", "Camp opens. Advancing develops every player and starts the new season."]
    : ["Look back on the year. Recruiting is already open — spend your pitches any time before Signing Day.", "Pro teams are re-signing their own. Keep working the recruiting board.", "Pro free agency is under way. Keep working the recruiting board.", "The draft is in — see where your players went.", "Last call: Signing Day and portal decisions happen when you advance.", "Camp opens. Advancing develops every player and starts the new season."];
  return (<div className="space-y-3">
    {off && <div className="card p-3"><div className="flex gap-1.5 mb-2">{OFF_STEPS.map((x, i) => <div key={x} className="flex-1"><div className={cx("h-1.5 rounded-full", i < s ? "bg-acc" : i === s ? "bg-acc sheen" : "bg-slate-800")} /><div className={cx("text-[9px] sm:text-[10px] mt-1 truncate", i === s ? "text-slate-100 font-bold" : "text-slate-500")}>{x}</div></div>)}</div><div className="text-sm text-slate-300">{tips[s]}</div></div>}
    {off && s === 0 && <SeasonReview />}
    <SubTabs tabs={tabs} value={tab} onChange={setTab} />
    {tab === "Re-sign" && <ResignPanel />}
    {tab === "Free agents" && <FreeAgentPanel />}
    {tab === "Cap" && <div className="space-y-3"><CapCharts tid={G.uid} /><CapCard /></div>}
    {tab === "Trades" && <TradePanel />}
    {tab === "Draft" && <DraftCenter />}
    {tab === "Recruiting" && <RecruitPanel />}
    {tab === "Portal" && <RecruitPanel portal />}
    {tab === "Class ranks" && <ClassRanks />}
  </div>);
}

/* ----------------------------- History ----------------------------- */
function SeasonCard({ h }){
  const ui = useUI(), G = ui.G, [open, setOpen] = useState(false), nc = h.natChamp != null ? T(G, h.natChamp) : null, pc = h.proChamp != null ? T(G, h.proChamp) : null, hw = h.heis && h.heis[0];
  return (<div className="card overflow-hidden">
    <div className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => setOpen(!open)} style={nc ? { background: `linear-gradient(100deg, ${nc.c1}55, transparent 60%)` } : undefined}>
      <div className="disp text-3xl w-16">{h.y}</div>
      <div className="flex-1 grid sm:grid-cols-3 gap-2 text-xs">
        <div><div className="text-[9px] uppercase tracking-widest text-slate-400">National champion</div>{nc ? <div className="flex items-center gap-1.5 font-bold text-sm"><Helmet t={nc} size={22} /><TeamLink t={nc} />{h.natScore && <span className="text-slate-400 font-normal tnum">{h.natScore[0]}–{h.natScore[1]}</span>}</div> : "—"}</div>
        <div><div className="text-[9px] uppercase tracking-widest text-slate-400">Heisman</div>{hw ? <div className="text-sm"><PLink pid={hw.pid} name={hw.n} /> <span className="text-slate-400">{hw.pos}, {(T(G, hw.tid) || {}).abbr}</span></div> : "—"}</div>
        <div><div className="text-[9px] uppercase tracking-widest text-slate-400">Pocket Bowl</div>{pc ? <div className="flex items-center gap-1.5 font-bold text-sm"><Helmet t={pc} size={22} /><TeamLink t={pc} full />{h.proScore && <span className="text-slate-400 font-normal tnum">{h.proScore[0]}–{h.proScore[1]}</span>}</div> : "—"}</div>
      </div><span className="text-slate-500">{open ? "▾" : "▸"}</span>
    </div>
    {open && <div className="p-3 border-t border-[#1f2a44] grid md:grid-cols-3 gap-4 text-xs fade-in">
      <div><div className="disp text-sm mb-1">Final Top 25</div>{(h.top25 || []).map((r, i) => <div key={r[0]} className="flex gap-2 py-0.5"><span className="w-5 text-slate-500 tnum">{i + 1}</span><TeamLink t={T(G, r[0])} className="flex-1" /><span className="tnum text-slate-400">{r[1]}–{r[2]}</span></div>)}</div>
      <div><div className="disp text-sm mb-1">Conference champions</div>{Object.keys(h.confChamps || {}).map(cid => <div key={cid} className="flex gap-2 py-0.5"><span className="w-20 text-slate-500">{G.confs[cid].name}</span><TeamLink t={T(G, h.confChamps[cid])} /></div>)}
        <div className="disp text-sm mb-1 mt-3">National awards</div>{(h.colAwards || []).map((a, i) => <div key={i} className="py-0.5"><span className="text-slate-500">{a.a}: </span><PLink pid={a.pid} name={a.n} /></div>)}</div>
      <div><div className="disp text-sm mb-1">Pro honors</div>{(h.proAwards || []).map((a, i) => <div key={i} className="py-0.5"><span className="text-slate-500">{a.a}: </span><PLink pid={a.pid} name={a.n} /></div>)}{h.pbMvp && <div className="py-0.5"><span className="text-slate-500">Pocket Bowl MVP: </span><PLink pid={h.pbMvp[0]} name={h.pbMvp[1]} /></div>}
        {h.draft && <div><div className="disp text-sm mb-1 mt-3">Draft · top 10</div>{h.draft.slice(0, 10).map(r => <div key={r[0]} className="flex gap-2 py-0.5"><span className="w-5 text-slate-500 tnum">{r[0]}</span><span className="w-9 text-slate-400">{(T(G, r[1]) || {}).abbr}</span><PLink pid={r[2]} name={r[3]} /><span className="text-slate-500">{r[4]}</span></div>)}</div>}
        {h.bowls && <div><div className="disp text-sm mb-1 mt-3">Bowls</div><div style={{ maxHeight: 150 }} className="overflow-y-auto">{h.bowls.map((b, i) => { const w = b[2] > b[4] ? [b[1], b[2], b[3], b[4]] : [b[3], b[4], b[1], b[2]]; return <div key={i} className="py-0.5 truncate"><span className="text-slate-500">{b[0]}: </span>{(T(G, w[0]) || {}).abbr} {w[1]}, {(T(G, w[2]) || {}).abbr} {w[3]}</div>; })}</div></div>}</div>
    </div>}
  </div>);
}
function RecordBook({ title, rec }){
  return <Card title={title} pad={false}><table className="st tnum"><tbody>{REC_KEYS.map(([k, l]) => { const r = rec[k]; return <tr key={k}><td className="l text-slate-400">{l}</td><td className="font-bold">{r ? r.v.toLocaleString() : "—"}</td><td className="l">{r ? <PLink pid={r.pid} name={r.n} /> : ""}</td><td className="l text-slate-500">{r ? r.t + " " + r.y : ""}</td></tr>; })}</tbody></table></Card>;
}
function HistoryTab(){
  const ui = useUI(), G = ui.G, [tab, setTab] = useState("Seasons"), c = G.coach, hofs = ids => ids.map(id => G.players[id]).filter(Boolean);
  const titles = c.hist.filter(r => r.note === "National Champions" || r.note === "Won Pocket Bowl").length;
  return (<div>
    <SubTabs tabs={["Seasons", "Record book", "Halls of Fame", "Greatest teams", "What if?", "Your career"]} value={tab} onChange={setTab} />
    {tab === "Greatest teams" && <GreatestTeams />}
    {tab === "What if?" && <WhatIf />}
    {tab === "Seasons" && (G.hist.filter(h => h.natChamp != null || h.proChamp != null).length ? <div className="space-y-2">{G.hist.slice().reverse().filter(h => h.natChamp != null || h.proChamp != null).map(h => <SeasonCard key={h.y} h={h} />)}</div> : <Card><Empty>History is written one season at a time. Finish {G.year} and it starts here.</Empty></Card>)}
    {tab === "Record book" && <div className="grid md:grid-cols-2 gap-3"><RecordBook title="College · single season" rec={G.records.col} /><RecordBook title="College · career" rec={G.records.colCareer} /><RecordBook title="Pro · single season" rec={G.records.pro} /><RecordBook title="Pro · career" rec={G.records.proCareer} /></div>}
    {tab === "Halls of Fame" && <div className="grid md:grid-cols-2 gap-3">{[["College Football Hall of Fame", hofs(G.colHof), "chof"], ["Pro Hall of Fame", hofs(G.hof), "hof"]].map(([t, ps, k]) => <Card key={k} title={t} right={ps.length + " members"}>{ps.length ? ps.slice().reverse().map(p => <div key={p.id} className="flex items-center gap-2 py-1 border-b border-white/5 text-sm"><span className="text-amber-300">★</span><PLink p={p} /><span className="text-slate-500 text-xs">{p.pos}{p.col != null && T(G, p.col) ? " · " + T(G, p.col).name : ""}</span><span className="ml-auto text-xs text-slate-500">Class of {p[k]}</span></div>) : <Empty>Nobody yet. Careers need time — greats are inducted when they finish.</Empty>}</Card>)}</div>}
    {tab === "Your career" && <div className="grid md:grid-cols-3 gap-3">
      {c.hist.length > 0 && <Card title="Career timeline" className="md:col-span-3"><Timeline rows={c.hist.map(r => Object.assign({ post: r.note }, r))} pro={G.mode === "pro"} colorOf={r => brightOf(T(G, r.tid))} /></Card>}
      <Card title={c.name}><div className="disp text-4xl">{c.w}–{c.l}</div><div className="text-xs text-slate-400 mt-1">{c.hist.length} season{c.hist.length === 1 ? "" : "s"} · {titles} title{titles === 1 ? "" : "s"} · {G.lp} Legacy Points</div>
        <div className="mt-3 flex flex-wrap gap-1.5">{c.aw.length ? c.aw.map((a, i) => <span key={i} className="px-2 py-1 rounded-full bg-amber-400/10 text-amber-200 text-[11px]">{a[0]} {a[1]}</span>) : <span className="text-xs text-slate-500">No hardware yet.</span>}</div>
        </Card>
      <Card title="Season by season" className="md:col-span-2" pad={false}>{c.hist.length ? <table className="st tnum"><thead><tr><th className="l">Year</th><th className="l">Team</th><th>W–L</th><th>Rank</th><th className="l">Finish</th><th /></tr></thead><tbody>{c.hist.slice().reverse().map(r => <tr key={r.y}><td className="l">{r.y}</td><td className="l"><TeamLink t={T(G, r.tid)} full /></td><td>{r.w}–{r.l}</td><td>{r.rk || "—"}</td><td className="l">{[r.cc ? "Conference champions" : "", r.note].filter(Boolean).join(" · ") || "—"}</td><td>{T(G, r.tid).hist.find(h => h.y === r.y) && <SeasonCardBtn row={T(G, r.tid).hist.find(h => h.y === r.y)} tid={r.tid} label="📸" />}</td></tr>)}</tbody></table> : <Empty>Your résumé starts when this season ends.</Empty>}</Card>
    </div>}
  </div>);
}
