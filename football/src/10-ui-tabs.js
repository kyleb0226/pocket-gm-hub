
/* =========================================================================
   UI — the main tabs
   ========================================================================= */
function ScoreCard({ g }){
  const ui = useUI(), G = ui.G, [H, A] = gameTeams(G, g), rv = g.riv != null ? G.riv.find(r => r.i === g.riv) : null, mine = isUser(G, g.h) || isUser(G, g.a);
  const row = (t, s, won) => <div className="flex items-center gap-2"><Badge t={t} size={17} /><div className={cx("flex-1 truncate text-sm", g.done && !won ? "text-slate-400" : "font-semibold")}>{rk(t)}{t.fcs ? t.name : t.pro ? t.city : t.name}</div>{g.done ? <div className={cx("tnum font-bold", won ? "" : "text-slate-500")}>{s}</div> : <div className="text-[10px] text-slate-500 tnum">{t.fcs ? "FCS" : t.w + "-" + t.l}</div>}</div>;
  return (
    <div onClick={() => g.done && ui.openGame(g.id)} className={cx("card p-2.5 space-y-1.5 transition-transform", g.done ? "cursor-pointer hover:-translate-y-0.5" : "", mine ? "ring-1 ring-[color:var(--acc)]" : "")}>
      {(g.tag || rv) && <div className="text-[9px] uppercase tracking-widest text-amber-300/90 truncate">{g.tag || rv.name}</div>}
      {row(A, g.as, g.as > g.hs)}{row(H, g.hs, g.hs > g.as)}
      {g.done && g.top && g.top[g.hs > g.as ? 0 : 1][0] && <div className="text-[10px] text-slate-500 truncate">{(G.players[g.top[g.hs > g.as ? 0 : 1][0][0]] || {}).ln}: {g.top[g.hs > g.as ? 0 : 1][0][1]}</div>}
    </div>
  );
}
function Scores({ games, maxWeek }){
  const G = useUI().G, [w, setW] = useState(Math.min(maxWeek, G.phase === "reg" ? Math.max(1, G.week - (games.some(g => g.w === G.week && g.done) ? 0 : 1)) : maxWeek));
  const list = games.filter(g => g.w === w).sort((a, b) => { const h = g => (T(G, g.h).rank ? 30 - T(G, g.h).rank : 0) + (g.a >= 0 && T(G, g.a).rank ? 30 - T(G, g.a).rank : 0) + (isUser(G, g.h) || isUser(G, g.a) ? 100 : 0); return h(b) - h(a); });
  return <div><div className="flex gap-1 overflow-x-auto pb-2 mb-2">{Array.from({ length: maxWeek }, (_, i) => i + 1).map(x => <button key={x} onClick={() => setW(x)} className={cx("w-8 h-8 rounded-lg text-xs font-bold shrink-0", w === x ? "bg-acc text-slate-950" : x === G.week ? "bg-white/10" : "bg-white/5 text-slate-400")}>{x}</button>)}</div>
    {list.length ? <div key={w} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 page-in">{list.map(g => <ScoreCard key={g.id} g={g} />)}</div> : <Empty>No games this week.</Empty>}</div>;
}
function Leaderboard({ title, pool, k, n = 5, fmt }){
  const G = useUI().G, rows = pool.filter(p => (p.st[k] || 0) > 0).sort((a, b) => b.st[k] - a.st[k]).slice(0, n), max = rows[0] ? rows[0].st[k] : 1;
  return <Card title={title}>{rows.length ? rows.map((p, i) => { const t = T(G, p.tid); return <div key={p.id} className="flex items-center gap-2 mb-1.5"><div className="w-4 text-[10px] text-slate-500">{i + 1}</div><Badge t={t} size={15} /><div className="w-32 min-w-0 truncate text-xs"><PLink p={p} /></div><div className="flex-1"><HBar v={p.st[k]} max={max} color={brightOf(t)} h={6} /></div><div className="w-11 text-right text-xs font-bold tnum">{fmt ? fmt(p.st[k]) : p.st[k]}</div></div>; }) : <Empty>No stats yet.</Empty>}</Card>;
}
const LEADER_CATS = [["Passing yards", "py"], ["Passing TD", "ptd"], ["Rushing yards", "ry"], ["Rushing TD", "rtd"], ["Receiving yards", "rcy"], ["Receptions", "rec"], ["Tackles", "tk"], ["Sacks", "sck"], ["Interceptions", "int"]];
function Bracket({ rounds, seedOf }){
  const ui = useUI(), G = ui.G;
  return <div className="flex gap-3 overflow-x-auto pb-2">{rounds.map(([title, ids], ri) => (
    <div key={ri} className="flex flex-col justify-around gap-3 min-w-[168px] flex-1"><div className="text-[10px] uppercase tracking-widest text-slate-500 text-center">{title}</div>
      {ids.length ? ids.map(id => { const g = gameById(G, id); if (!g) return null; const H = T(G, g.h), A = T(G, g.a); return (
        <div key={id} onClick={() => g.done && ui.openGame(id)} className={cx("card p-2 text-xs space-y-1 pop", g.done ? "cursor-pointer hover:brightness-125" : "")} style={{ animationDelay: ri * 90 + "ms" }}>
          {g.tag && <div className="text-[9px] text-amber-300/80 truncate">{g.tag.replace(/ · .*/, "")}</div>}
          {[[H, g.hs, g.hs > g.as], [A, g.as, g.as > g.hs]].map(([t, s, won], i) => <div key={i} className={cx("flex items-center gap-1.5", g.done && !won ? "opacity-45" : "")}><span className="w-4 text-[9px] text-slate-500 tnum">{seedOf ? seedOf(t.id) : ""}</span><Badge t={t} size={14} /><span className="flex-1 truncate font-semibold">{t.pro ? t.nick : t.name}</span><span className="tnum font-bold">{g.done ? s : ""}</span></div>)}
        </div>); }) : <div className="card p-3 text-[11px] text-slate-500 text-center border-dashed">To be decided</div>}
    </div>))}</div>;
}
function BumpChart({ hist, G }){
  if (!hist || hist.length < 2) return <div className="text-xs text-slate-500 py-3">The race takes shape after a couple of weeks.</div>;
  const ids = hist[hist.length - 1].slice(0, 10), w = 320, h = 150, X = i => 22 + i * (w - 70) / (hist.length - 1), Y = r => 10 + r * (h - 24) / 11;
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-full">{[1, 5, 10].map(r => <text key={r} x="4" y={Y(r - 1) + 3} fontSize="7" fill="#64748b">#{r}</text>)}
    {ids.map((id, k) => { const t = T(G, id), pts = hist.map(wk => { const i = wk.indexOf(id); return i < 0 || i > 11 ? 11 : i; }); return <g key={id}><path d={pts.map((r, i) => (i ? "L" : "M") + X(i) + " " + Y(r)).join(" ")} fill="none" stroke={brightOf(t)} strokeWidth={k < 3 ? 2.6 : 1.5} opacity={k < 3 ? 1 : .6} strokeLinejoin="round" className="draw" /><text x={X(hist.length - 1) + 5} y={Y(k) + 3} fontSize="8" fontWeight="700" fill={brightOf(t)}>{t.abbr}</text></g>; })}</svg>;
}

/* ----------------------------- Home ----------------------------- */
function MatchupCard({ g }){
  const ui = useUI(), G = ui.G, [H, A] = gameTeams(G, g), ch = lineup(G, H, 0), ca = lineup(G, A, 0), rv = g.riv != null ? G.riv.find(r => r.i === g.riv) : null;
  return (
    <div className="card overflow-hidden relative">
      <div className="absolute inset-0 opacity-70" style={{ background: `linear-gradient(100deg, ${A.c1}66 0%, transparent 42%, transparent 58%, ${H.c1}66 100%)` }} />
      <div className="relative p-4">
        <div className="text-center text-[10px] tracking-[.25em] uppercase text-amber-300/90">{g.tag || (rv ? rv.name + " — for the " + rv.trophy : "Week " + g.w + (g.conf ? " · conference game" : g.div ? " · division game" : ""))}</div>
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex-1 flex flex-col items-center text-center min-w-0"><Helmet t={A} size={64} /><div className="disp text-xl sm:text-2xl mt-1 truncate max-w-full"><TeamLink t={A} /></div><div className="text-[11px] text-slate-400">{A.fcs ? "FCS" : `${A.w}–${A.l}`}</div></div>
          <div className="disp text-2xl text-slate-500">{g.neutral ? "VS" : "AT"}</div>
          <div className="flex-1 flex flex-col items-center text-center min-w-0"><Helmet t={H} size={64} flip /><div className="disp text-xl sm:text-2xl mt-1 truncate max-w-full"><TeamLink t={H} /></div><div className="text-[11px] text-slate-400">{H.w}–{H.l}</div></div>
        </div>
        <div className="mt-3 max-w-md mx-auto">{[["Pass offense", "passOff"], ["Run offense", "runOff"], ["Pass defense", "passDef"], ["Run defense", "runDef"]].map(([l, k]) => <CompareBar key={k} label={l} a={round(ca[k])} b={round(ch[k])} ca={brightOf(A)} cb={brightOf(H)} />)}</div>
      </div>
    </div>
  );
}
function NewsFeed({ items, n = 12 }){
  const ui = useUI(), icon = { champ: "🏆", award: "🏅", upset: "⚡", riv: "⚔️", inj: "🩹", poll: "📊", post: "🎟️", draft: "📝", rec: "✍️", portal: "🔁", coach: "🎧", fa: "💼", ret: "👋", hof: "🏛️", pro: "🏈", off: "📅" };
  return <div className="space-y-2">{items.slice(0, n).map((x, i) => <div key={i} className="flex gap-2.5 text-[13px] leading-snug"><span className="shrink-0">{icon[x.tag] || "•"}</span><div className={cx("flex-1", x.tid != null ? "cursor-pointer hover:text-white" : "")} onClick={() => x.tid != null && x.tid >= 0 && ui.openTeam(x.tid)}><span className="text-slate-200">{x.txt}</span> <span className="text-[10px] text-slate-500 whitespace-nowrap">{x.y}{x.w ? " · wk " + x.w : ""}</span></div></div>)}</div>;
}
function HomeTab(){
  const ui = useUI(), G = ui.G, t = userTeam(G), next = G.phase === "reg" ? userGame(G, G.week) : null, last = [...G.cs, ...G.ps].filter(g => g.done && (g.h === G.uid || g.a === G.uid)).sort((a, b) => b.w - a.w)[0];
  const open = G.events.filter(e => !e.done).length, unpicked = G.slate && G.slate.w === G.week ? G.slate.games.filter(x => x.pick == null).length : 0;
  const standing = t.pro ? proStandings(G, t.conf, t.div) : t.conf === "IND" ? G.col.slice().sort((a, b) => a.rkAll - b.rkAll).slice(0, 8) : confStandings(G, t.conf).slice(0, 8);
  return (
    <div className="space-y-3">
      {G.phase === "off" ? <Card title={"Offseason · " + OFF_STEPS[G.offStep]}><div className="text-sm text-slate-300">The {G.year} season is over. Work through the offseason in the <b>Front Office</b> tab, or press Advance to let your staff handle each step.</div><div className="flex gap-1 mt-3">{OFF_STEPS.map((s, i) => <div key={s} className={cx("flex-1 h-1.5 rounded-full", i < G.offStep ? "bg-acc" : i === G.offStep ? "bg-acc sheen" : "bg-slate-800")} title={s} />)}</div></Card>
        : next ? <div className="space-y-3">{!next.done && <MatchupCard g={next} />}<GameDay g={next} /></div> : <Card><Empty>{G.week > (t.pro ? PRO_WEEKS : COL_WEEKS) ? "Your season is over — the postseason plays on without you." : "Bye week. Rest up."}</Empty></Card>}
      {(open > 0 || unpicked > 0) && <div onClick={() => ui.go("Stories")} className="card p-3 flex items-center gap-3 cursor-pointer hover:brightness-125" style={{ borderColor: "color-mix(in srgb, var(--acc) 50%, transparent)" }}><div className="w-9 h-9 rounded-full bg-acc text-slate-950 font-black flex items-center justify-center pulse">{open + (unpicked ? 1 : 0)}</div><div className="flex-1 text-sm"><b>Optional this week:</b> {[open ? `${open} stor${open > 1 ? "ies" : "y"} waiting on a decision` : "", unpicked ? `${unpicked} pick'em game${unpicked > 1 ? "s" : ""} open` : ""].filter(Boolean).join(" · ")}<div className="text-[11px] text-slate-400">Nothing here is required — skip it and the season rolls on. Play along and you earn Legacy Points.</div></div><span className="text-slate-400">→</span></div>}
      <div className="grid md:grid-cols-3 gap-3">
        <Card title="Headlines" className="md:col-span-2"><NewsFeed items={G.news} /></Card>
        <div className="space-y-3">
          {last && <div><div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 px-1">Last game</div><ScoreCard g={last} /></div>}
          <Card title={t.pro ? `${t.conf} ${t.div}` : t.conf === "IND" ? "Top of the poll" : G.confs[t.conf].name} pad={false}><table className="st tnum"><tbody>{standing.map((x, i) => <tr key={x.id} className={x.id === t.id ? "bg-white/5" : ""}><td className="l w-5 text-slate-500">{i + 1}</td><td className="l"><TeamLink t={x} /></td><td>{x.w}–{x.l}</td>{!t.pro && <td className="text-slate-400">{x.cw}–{x.cl}</td>}</tr>)}</tbody></table></Card>
          {G.hw.length > 0 && <Card title="Heisman watch">{G.hw.slice(0, 4).map(([id, s], i) => { const p = G.players[id]; return p ? <div key={id} className="flex items-center gap-2 mb-1.5 text-xs"><span className="w-3 text-slate-500">{i + 1}</span><Badge t={T(G, p.tid)} size={14} /><PLink p={p} className="flex-1 truncate" /><span className="text-slate-500">{p.pos}</span></div> : null; })}</Card>}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Team ----------------------------- */
function Formation({ G, tid }){
  const d = depthChart(G, tid), t = T(G, tid), spots = [["WR", 0, 8, 62], ["OT", 0, 30, 60], ["OG", 0, 40, 60], ["C", 0, 50, 60], ["OG", 1, 60, 60], ["OT", 1, 70, 60], ["TE", 0, 80, 62], ["WR", 1, 92, 62], ["WR", 2, 20, 68], ["QB", 0, 50, 72], ["RB", 0, 50, 86], ["K", 0, 90, 90], ["P", 0, 10, 90],
    ["DE", 0, 28, 46], ["DT", 0, 43, 46], ["DT", 1, 57, 46], ["DE", 1, 72, 46], ["LB", 0, 30, 34], ["LB", 1, 50, 32], ["LB", 2, 70, 34], ["CB", 0, 8, 38], ["CB", 1, 92, 38], ["S", 0, 36, 16], ["S", 1, 64, 16]];
  const ui = useUI();
  return (
    <div className="relative rounded-xl overflow-hidden" style={{ background: "linear-gradient(#0d3b1f,#14532d)", paddingBottom: "92%" }}>
      {[10, 30, 50, 70, 90].map(y => <div key={y} className="absolute left-0 right-0 border-t border-white/15" style={{ top: y + "%" }} />)}
      <div className="absolute left-0 right-0 border-t-2 border-amber-300/70" style={{ top: "53%" }} />
      <div className="absolute left-2 text-[9px] uppercase tracking-widest text-white/50" style={{ top: "3%" }}>Defense</div><div className="absolute left-2 text-[9px] uppercase tracking-widest text-white/50" style={{ top: "94%" }}>Offense</div>
      {spots.map(([pos, i, x, y], k) => { const p = d[pos][i]; return (
        <div key={k} onClick={() => p && ui.openPlayer(p.id)} className="absolute -translate-x-1/2 -translate-y-1/2 text-center cursor-pointer pop" style={{ left: x + "%", top: y + "%", animationDelay: k * 18 + "ms" }}>
          <div className="mx-auto w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[11px] font-black border-2" style={{ background: t.c1, color: inkOn(t.c1), borderColor: p && p.inj ? "#f87171" : t.c2 }}>{p ? p.ovr : "—"}</div>
          <div className="text-[8px] sm:text-[9px] leading-tight mt-0.5 text-white drop-shadow font-semibold whitespace-nowrap">{pos} {p ? p.ln : ""}</div>
        </div>); })}
    </div>
  );
}
function TeamTab(){
  const ui = useUI(), G = ui.G, t = userTeam(G), [tab, setTab] = useState("Depth chart"), pro = G.mode === "pro";
  return (<div>
    <SubTabs tabs={["Depth chart", "Roster", "Staff & facilities", "Schedule", "Program"]} value={tab} onChange={setTab} />
    <div key={tab} className="page-in">
      {tab === "Depth chart" && <div className="grid md:grid-cols-2 gap-3"><FieldDepth tid={t.id} /><div className="space-y-3">
        <Card title="Starters at a glance">{(() => { const c = lineup(G, t, 0); return [["Pass offense", c.passOff], ["Run offense", c.runOff], ["Pass defense", c.passDef], ["Run defense", c.runDef]].map(([l, v]) => <div key={l} className="flex items-center gap-2 mb-2 text-xs"><div className="w-24 text-slate-300">{l}</div><div className="flex-1"><HBar v={v - 40} max={55} /></div><div className="w-7 text-right font-bold tnum" style={{ color: ovrColor(v) }}>{round(v)}</div></div>); })()}
          <div className="text-[11px] text-slate-400 mt-2">Tap a spot on the field to choose who starts there. Injured starters are replaced automatically.</div></Card>
        <Card title="Medical report"><MedReport tid={t.id} /></Card>
        {pro && <Card title="Salary cap"><div className="flex justify-between text-xs mb-1"><span>{money(payroll(G, t.id))} committed</span><span className="text-slate-400">{money(CAP)} cap</span></div><HBar v={payroll(G, t.id)} max={CAP} color={capRoom(G, t.id) < 0 ? "#f87171" : "var(--acc)"} h={10} /><div className="text-xs mt-1 text-slate-300">{money(Math.abs(capRoom(G, t.id)))} {capRoom(G, t.id) < 0 ? "over" : "of room"}</div></Card>}
      </div></div>}
      {tab === "Roster" && <div className="space-y-3"><Card pad><RosterTable G={G} tid={t.id} onRelease={pro ? p => { if (confirm(`Release ${pname(p)}? He becomes a free agent.`)) ui.act(G => releaseP(G, p)); } : null} /></Card><RedshirtCard /></div>}
      {tab === "Staff & facilities" && <StaffTab />}
      {tab === "Schedule" && <div className="grid md:grid-cols-2 gap-3"><Card><ScheduleList G={G} tid={t.id} /></Card>{!pro && <Card title="Poll position"><RankChart hist={t.rkHist} color={brightOf(t)} /></Card>}</div>}
      {tab === "Program" && <div className="text-center py-6"><Btn kind="pri" onClick={() => ui.openTeam(t.id)}>Open the full {t.pro ? t.nick : t.name} page — history, trophy case{t.pro ? "" : ", pro alumni"}</Btn></div>}
    </div>
  </div>);
}

/* ----------------------------- College ----------------------------- */
function CollegeTab(){
  const ui = useUI(), G = ui.G, [tab, setTab] = useState("Top 25"), ut = userTeam(G), [cid, setCid] = useState(!ut.pro && ut.conf !== "IND" ? ut.conf : "SEC"), [aaT, setAaT] = useState("aa1"), A = G.awards.col;
  const pool = useMemo(() => colPlayers(G), [G.week, G.year, G.phase]), prevPoll = G.pollHist[G.pollHist.length - 2];
  const order = G.col.slice().sort((a, b) => a.rkAll - b.rkAll), cfp = G.cfp;
  return (<div>
    <SubTabs tabs={["Top 25", "Conferences", "Scores", "Leaders", "Heisman", "Awards", "Playoff & bowls", "Rivalries"]} value={tab} onChange={setTab} />
    <div key={tab} className="page-in">
      {tab === "Top 25" && <div className="grid md:grid-cols-5 gap-3">
        <Card title={G.pollHist.length ? "The poll" : "Preseason poll"} className="md:col-span-3" pad={false}><table className="st tnum"><thead><tr><th className="l">#</th><th className="l" /><th className="l">Team</th><th>Rec</th><th className="l">Conf</th><th className="l">Last</th></tr></thead>
          <tbody>{order.slice(0, 25).map((t, i) => { const was = prevPoll ? prevPoll.indexOf(t.id) : -1, mv = prevPoll ? (was < 0 ? "new" : was - i) : 0, lr = t.res[t.res.length - 1]; return (
            <tr key={t.id} className={t.id === G.uid ? "bg-white/5" : ""}><td className="l disp text-base w-7">{i + 1}</td><td className="l w-9 text-[10px]">{mv === "new" ? <span className="text-sky-300">NEW</span> : mv > 0 ? <span className="text-emerald-400">▲{mv}</span> : mv < 0 ? <span className="text-rose-400">▼{-mv}</span> : <span className="text-slate-600">–</span>}</td>
              <td className="l"><span className="inline-flex items-center gap-2"><Badge t={t} size={16} /><TeamLink t={Object.assign({}, t, { rank: 0 })} /></span></td><td>{t.w}–{t.l}</td><td className="l text-slate-400">{G.confs[t.conf].name}</td><td className="l text-slate-400">{lr ? (lr[1] > lr[2] ? "W " : "L ") + lr[1] + "–" + lr[2] + " " + (lr[0] < 0 ? "FCS" : T(G, lr[0]).abbr) : "—"}</td></tr>); })}</tbody></table></Card>
        <div className="md:col-span-2 space-y-3"><Card title="Race for No. 1"><PollRace /></Card>
          <Card title="Also receiving votes"><div className="flex flex-wrap gap-1.5">{order.slice(25, 37).map(t => <span key={t.id} className="text-xs bg-white/5 rounded px-2 py-1"><TeamLink t={t} /> <span className="text-slate-500">{t.w}–{t.l}</span></span>)}</div></Card></div>
      </div>}
      {tab === "Conferences" && <div>
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">{CONF_ORDER.map(c => <button key={c} onClick={() => setCid(c)} className={cx("px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap", cid === c ? "bg-acc text-slate-950" : "bg-white/5 text-slate-300")}>{G.confs[c].name}</button>)}</div>
        <div key={cid} className="grid md:grid-cols-3 gap-3 page-in">
          <Card title={G.confs[cid].full} right={cid === "IND" ? "No conference title" : G.confs[cid].games + " conference games · top two meet for the title"} className="md:col-span-2" pad={false}><div className="overflow-x-auto"><table className="st tnum"><thead><tr><th className="l">#</th><th className="l">Team</th><th>Conf</th><th>Overall</th><th>PF</th><th>PA</th><th>Strk</th><th className="l w-24">Wins</th></tr></thead>
            <tbody>{(cid === "IND" ? G.col.filter(t => t.conf === "IND").sort((a, b) => a.rkAll - b.rkAll) : confStandings(G, cid)).map((t, i) => <tr key={t.id} className={cx(t.id === G.uid ? "bg-white/5" : "", i === 1 && cid !== "IND" ? "border-b-2 border-dashed border-amber-400/40" : "")}><td className="l text-slate-500">{i + 1}</td><td className="l"><span className="inline-flex items-center gap-2"><Badge t={t} size={15} /><TeamLink t={t} />{G.confs[cid].champ === t.id && <span title="Conference champion">🏆</span>}</span></td><td className="font-semibold">{t.cw}–{t.cl}</td><td>{t.w}–{t.l}</td><td>{t.pf}</td><td>{t.pa}</td><td className={t.streak > 0 ? "text-emerald-400" : "text-rose-400"}>{t.streak ? (t.streak > 0 ? "W" : "L") + Math.abs(t.streak) : "—"}</td><td className="l"><HBar v={t.w} max={13} color={brightOf(t)} h={6} /></td></tr>)}</tbody></table></div></Card>
          <div className="space-y-3"><Card title="Champions">{G.confs[cid].champs.length ? G.confs[cid].champs.slice(0, 8).map(([y, id]) => <div key={y} className="flex justify-between text-sm py-0.5"><span className="text-slate-400">{y}</span><TeamLink t={Object.assign({}, T(G, id), { rank: 0 })} /></div>) : <div className="text-sm text-slate-400">No champion crowned yet in this save.</div>}</Card>
            {(G.realign || []).length > 0 && <Card title="Realignment">{G.realign.slice(0, 6).map((r, i) => <div key={i} className="text-xs py-0.5"><span className="text-slate-500 mr-2">{r.y}</span><TeamLink t={Object.assign({}, T(G, r.tid), { rank: 0 })} /> <span className="text-slate-400">{G.confs[r.from].name} → {G.confs[r.to].name}</span></div>)}</Card>}
            {A && A.conf[cid] && <Card title={"All-" + G.confs[cid].name + " honors"}>{[["opoy", "Offensive POY"], ["dpoy", "Defensive POY"], ["foy", "Freshman OY"], ["noy", "Newcomer OY"], ["olm", "Lineman OY"], ["st", "Special teams"]].map(([k, l]) => A.conf[cid][k] ? <div key={k} className="flex justify-between gap-2 text-xs py-0.5"><span className="text-slate-400">{l}</span><span className="truncate"><PLink pid={A.conf[cid][k].pid} name={A.conf[cid][k].n} /> <span className="text-slate-500">{(T(G, A.conf[cid][k].tid) || {}).abbr}</span></span></div> : null)}<div className="flex justify-between text-xs py-0.5"><span className="text-slate-400">Coach OY</span><span>{A.conf[cid].coy.name} <span className="text-slate-500">{T(G, A.conf[cid].coy.tid).abbr}</span></span></div></Card>}</div>
        </div></div>}
      {tab === "Scores" && <Scores games={G.cs} maxWeek={Math.max(...G.cs.map(g => g.w))} />}
      {tab === "Leaders" && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{LEADER_CATS.map(([l, k]) => <Leaderboard key={k} title={l} pool={pool} k={k} />)}</div>}
      {tab === "Heisman" && (A ? <div className="space-y-3"><Card title={G.year + " Heisman Trophy voting"} right={<span className="link" onClick={() => ui.setCeremony(true)}>Replay the ceremony ▶</span>}><HeismanVote votes={A.heis} /></Card><Card title="How the race unfolded"><HeismanRace /></Card></div>
        : <div className="grid md:grid-cols-2 gap-3"><Card title="Heisman watch" right={"Through week " + Math.max(0, G.week - 1)}>{G.hw.length ? G.hw.map(([id, s], i) => { const p = G.players[id]; if (!p) return null; const t = T(G, p.tid); return <div key={id} className="flex items-center gap-2 mb-2"><div className={cx("disp w-6 text-right", i === 0 ? "text-amber-300 text-xl" : "text-slate-400")}>{i + 1}</div><Badge t={t} size={18} /><div className="w-36 min-w-0"><div className="text-sm truncate"><PLink p={p} /></div><div className="text-[10px] text-slate-400 truncate">{p.pos} · {seasonLine(p)}</div></div><div className="flex-1"><HBar v={s} max={G.hw[0][1]} color={brightOf(t)} /></div></div>; }) : <Empty>The watch list opens after week 1.</Empty>}</Card>
          <Card title="How the race has moved"><HeismanRace />
            {G.preds.heis != null && G.players[G.preds.heis] && <div className="text-xs text-slate-400 mt-2">Your preseason pick: <PLink pid={G.preds.heis} /></div>}</Card></div>)}
      {tab === "Awards" && <div className="space-y-3">
        {G.potw && G.potw.w && <Card title={"Players of the week · week " + G.potw.w}><div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">{[["National offense", G.potw.off], ["National defense", G.potw.def], ...Object.keys(G.potw.conf).map(c => [G.confs[c].name, G.potw.conf[c]])].filter(x => x[1]).map(([l, r]) => <div key={l} className="flex gap-2"><span className="w-28 text-slate-400 shrink-0">{l}</span><span className="truncate"><PLink pid={r.pid} name={r.n} /> <span className="text-slate-500">{r.pos}, {(T(G, r.tid) || {}).abbr} — {r.line}</span></span></div>)}</div></Card>}
        {A ? <React.Fragment>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{[{ a: "Heisman Trophy", note: "Most outstanding player", pid: A.heis[0].pid, n: A.heis[0].n, tid: A.heis[0].tid, pos: A.heis[0].pos, line: A.heis[0].line }, ...A.nat].map((x, i) => { const t = T(G, x.tid) || { c1: "#334155", c2: "#fff", abbr: "" }; return <div key={i} className="card p-3 relative overflow-hidden pop" style={{ animationDelay: i * 25 + "ms" }}><div className="absolute inset-y-0 left-0 w-1" style={{ background: t.c1 }} /><div className="text-[10px] uppercase tracking-widest text-amber-300/90">{x.a}</div><div className="font-bold mt-0.5"><PLink pid={x.pid} name={x.n} /></div><div className="text-[11px] text-slate-400 truncate">{x.pos} · {t.abbr} · {x.line}</div><div className="text-[10px] text-slate-500">{x.note}</div></div>; })}
            <div className="card p-3"><div className="text-[10px] uppercase tracking-widest text-amber-300/90">Coach of the Year</div><div className="font-bold mt-0.5">{A.coy.name}</div><div className="text-[11px] text-slate-400">{T(G, A.coy.tid).name} · {A.coy.rec}</div></div>
            <div className="card p-3"><div className="text-[10px] uppercase tracking-widest text-amber-300/90">Joe Moore Award</div><div className="font-bold mt-0.5"><TeamLink t={T(G, A.joeMoore)} /></div><div className="text-[11px] text-slate-400">Best offensive line unit</div></div></div>
          <AwardVoting A={A} voters={100} />
          <Card title="All-America teams" right={<span className="flex gap-2">{[["aa1", "First"], ["aa2", "Second"], ["faa", "Freshman"]].map(([k, l]) => <span key={k} className={cx("link", aaT === k ? "acc font-bold" : "")} onClick={() => setAaT(k)}>{l}</span>)}</span>}><div key={aaT} className="grid sm:grid-cols-2 gap-x-6 page-in">{A[aaT].map(r => <div key={r.pid} className="flex items-center gap-2 py-1 text-xs border-b border-white/5"><span className="w-6 font-bold text-slate-400">{r.pos}</span><Badge t={T(G, r.tid) || { c1: "#333", c2: "#fff", abbr: "" }} size={14} /><PLink pid={r.pid} name={r.n} />{A.unan.includes(r.pid) && aaT === "aa1" && <span className="text-[9px] bg-amber-400 text-slate-950 font-bold px-1 rounded">UNANIMOUS</span>}<span className="text-slate-500 truncate">{r.line}</span></div>)}</div></Card>
        </React.Fragment> : <Card><Empty>National awards, the All-America teams and all-conference honors are announced after championship weekend (week 15).</Empty></Card>}
      </div>}
      {tab === "Playoff & bowls" && (cfp ? <div className="space-y-3">
        <Card title="College Football Playoff" right={cfp.champ != null ? "Champion: " + T(G, cfp.champ).name : "12 teams"}><BracketTree champ={cfp.champ} champLabel="National champions" seedOf={id => cfp.seeds.indexOf(id) + 1} rounds={[["First round", cfp.r1], ["Quarterfinals", cfp.qf], ["Semifinals", cfp.sf], ["National championship", cfp.final ? [cfp.final] : []]]} />
          <div className="text-[11px] text-slate-400 mt-2">Seeds 1–4 ({cfp.seeds.slice(0, 4).map(id => T(G, id).abbr).join(", ")}) had byes. First four out: {cfp.firstOut.map(id => T(G, id).abbr).join(", ")}. Automatic bids went to the five highest-ranked conference champions.</div></Card>
        <Card title="Bowl season"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{G.cs.filter(g => g.post === "bowl").map(g => <ScoreCard key={g.id} g={g} />)}</div></Card>
      </div> : <Card title="Playoff picture" right="If the season ended today"><div className="grid sm:grid-cols-2 gap-x-6">{order.slice(0, 12).map((t, i) => <div key={t.id} className="flex items-center gap-2 py-1 text-sm border-b border-white/5"><span className="disp w-6 text-slate-400">{i + 1}</span><Badge t={t} size={15} /><TeamLink t={Object.assign({}, t, { rank: 0 })} /><span className="text-slate-500 text-xs">{t.w}–{t.l}</span>{i < 4 && <span className="text-[9px] bg-white/10 px-1 rounded">BYE</span>}</div>)}</div><div className="text-[11px] text-slate-400 mt-2">The real field is set after the conference championship games: the five best conference champions plus the seven highest-ranked teams left. Every other team with six wins goes bowling.</div></Card>)}
      {tab === "Rivalries" && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{G.riv.slice().sort((a, b) => ((b.a === G.uid || b.b === G.uid) ? 1 : 0) - ((a.a === G.uid || a.b === G.uid) ? 1 : 0)).map(r => { const a = T(G, r.a), b = T(G, r.b), l = r.last[0]; return (
        <div key={r.i} className="card p-3 relative overflow-hidden"><div className="absolute inset-0 opacity-25" style={{ background: `linear-gradient(110deg, ${a.c1} 0 50%, ${b.c1} 50% 100%)` }} /><div className="relative"><div className="disp text-base truncate">{r.name}</div><div className="text-[10px] text-amber-300/90 mb-2">{r.trophy}{r.holder != null ? " — held by " + T(G, r.holder).name : ""}</div>
          <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-1.5"><Badge t={a} size={15} /><TeamLink t={a} /></span><span className="disp text-lg tnum">{r.aw}–{r.bw}</span><span className="flex items-center gap-1.5"><TeamLink t={b} /><Badge t={b} size={15} /></span></div>
          <div className="text-[10px] text-slate-400 mt-1.5">{l ? `${l[0]}: ${T(G, l[1]).abbr} ${l[2]}, ${T(G, l[3]).abbr} ${l[4]}` : "Not yet played in this save"}</div></div></div>); })}</div>}
    </div>
  </div>);
}

/* ----------------------------- Pro ----------------------------- */
function ProTab(){
  const ui = useUI(), G = ui.G, [tab, setTab] = useState("Standings"), pool = useMemo(() => proPlayers(G), [G.week, G.year, G.phase]), A = G.awards.pro, pp = G.pp;
  return (<div>
    <SubTabs tabs={["Standings", "Scores", "Leaders", "Playoffs", "Awards"]} value={tab} onChange={setTab} />
    <div key={tab} className="page-in">
      {tab === "Standings" && <div className="grid md:grid-cols-2 gap-3">{PRO_CONFS.map(c => <div key={c} className="space-y-2"><div className="disp text-lg">{c} Conference</div>{PRO_DIVS.map(d => <Card key={d} title={d} pad={false}><table className="st tnum"><thead><tr><th className="l">Team</th><th>W</th><th>L</th><th>Div</th><th>PF</th><th>PA</th><th>Strk</th></tr></thead><tbody>{proStandings(G, c, d).map(t => <tr key={t.id} className={t.id === G.uid ? "bg-white/5" : ""}><td className="l"><span className="inline-flex items-center gap-2"><Badge t={t} size={15} /><TeamLink t={t} full />{pp && pp.seeds[c].includes(t.id) && <span className="text-[9px] text-emerald-400">({pp.seeds[c].indexOf(t.id) + 1})</span>}</span></td><td className="font-semibold">{t.w}</td><td>{t.l}</td><td>{t.dw}–{t.dl}</td><td>{t.pf}</td><td>{t.pa}</td><td className={t.streak > 0 ? "text-emerald-400" : "text-rose-400"}>{t.streak ? (t.streak > 0 ? "W" : "L") + Math.abs(t.streak) : "—"}</td></tr>)}</tbody></table></Card>)}</div>)}</div>}
      {tab === "Scores" && <Scores games={G.ps} maxWeek={Math.max(...G.ps.map(g => g.w))} />}
      {tab === "Leaders" && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{LEADER_CATS.map(([l, k]) => <Leaderboard key={k} title={l} pool={pool} k={k} />)}</div>}
      {tab === "Playoffs" && (pp ? <Card title={"Road to Pocket Bowl " + ROMAN(G.year - 1965)} right={pp.champ != null ? "Champion: " + tname(T(G, pp.champ)) : ""}><BracketTree champ={pp.champ} champLabel={"Pocket Bowl " + ROMAN(G.year - 1965)} seedOf={id => { const t = T(G, id); return pp.seeds[t.conf].indexOf(id) + 1; }} rounds={[["Wild card", pp.rounds[0] || []], ["Divisional", pp.rounds[1] || []], ["Conference", pp.rounds[2] || []], ["Pocket Bowl", pp.rounds[3] || []]]} /></Card>
        : <Card title="Playoff picture" right="Seven teams per conference"><div className="grid sm:grid-cols-2 gap-4">{PRO_CONFS.map(c => { const win = PRO_DIVS.map(d => proStandings(G, c, d)[0]).sort(proSort), rest = proStandings(G, c).filter(t => !win.includes(t)); return <div key={c}><div className="disp mb-1">{c}</div>{[...win, ...rest.slice(0, 5)].map((t, i) => <div key={t.id} className={cx("flex items-center gap-2 text-sm py-1", i === 6 ? "border-b-2 border-dashed border-rose-400/40" : "border-b border-white/5")}><span className="w-4 text-slate-500 text-xs">{i + 1}</span><Badge t={t} size={15} /><TeamLink t={t} full /><span className="text-slate-500 text-xs">{t.w}–{t.l}</span>{i < 4 && <span className="text-[9px] bg-white/10 px-1 rounded">DIV</span>}</div>)}</div>; })}</div></Card>)}
      {tab === "Awards" && (A ? <div className="space-y-3"><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{A.list.map((x, i) => { const t = T(G, x.tid) || { c1: "#334155", abbr: "" }; return <div key={i} className="card p-3 relative overflow-hidden pop" style={{ animationDelay: i * 30 + "ms" }}><div className="absolute inset-y-0 left-0 w-1" style={{ background: t.c1 }} /><div className="text-[10px] uppercase tracking-widest text-amber-300/90">{x.a}</div><div className="font-bold mt-0.5"><PLink pid={x.pid} name={x.n} /></div><div className="text-[11px] text-slate-400 truncate">{x.pos} · {t.abbr} · {x.line}</div></div>; })}<div className="card p-3"><div className="text-[10px] uppercase tracking-widest text-amber-300/90">Coach of the Year</div><div className="font-bold mt-0.5">{A.coy.name}</div><div className="text-[11px] text-slate-400">{tname(T(G, A.coy.tid))} · {A.coy.rec}</div></div></div>
        <AwardVoting A={A} voters={50} />
        <AllStarCard />
        {A.rook && A.rook.length > 0 && <Card title="All-Rookie Team"><div className="grid sm:grid-cols-2 gap-x-6">{A.rook.map(r => <div key={r.pid} className="flex items-center gap-2 py-1 text-xs border-b border-white/5"><span className="w-6 font-bold text-slate-400">{r.pos}</span><Badge t={T(G, r.tid) || { c1: "#333", c2: "#fff", abbr: "" }} size={14} /><PLink pid={r.pid} name={r.n} /><span className="text-slate-500 truncate">{r.line}</span></div>)}</div></Card>}
        <Card title="First-team All-Pro"><div className="grid sm:grid-cols-2 gap-x-6">{A.ap1.map(r => <div key={r.pid} className="flex items-center gap-2 py-1 text-xs border-b border-white/5"><span className="w-6 font-bold text-slate-400">{r.pos}</span><Badge t={T(G, r.tid) || { c1: "#333", c2: "#fff", abbr: "" }} size={14} /><PLink pid={r.pid} name={r.n} /><span className="text-slate-500 truncate">{r.line}</span></div>)}</div></Card></div> : <Card><Empty>Pro awards and the All-Pro team are named when the regular season ends (week 17).</Empty></Card>)}
    </div>
  </div>);
}
