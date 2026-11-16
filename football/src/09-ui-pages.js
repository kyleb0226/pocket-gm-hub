
/* =========================================================================
   UI — full pages that open over the app: player, team, box score, ceremony
   ========================================================================= */
function Modal({ children, onClose, wide, accent }){
  useEffect(() => { const f = e => e.key === "Escape" && onClose(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center fade-in" style={{ background: "rgba(2,5,12,.78)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={cx("modal-in relative w-full bg-[#0b111e] border border-[#1f2a44] sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col", wide ? "sm:max-w-5xl" : "sm:max-w-3xl")} style={{ maxHeight: "94vh", boxShadow: "0 30px 80px rgba(0,0,0,.6)" }}>
        {accent && <div className="h-1 shrink-0" style={{ background: `linear-gradient(90deg, ${accent[0]}, ${accent[1]})` }} />}
        <button onClick={onClose} className="absolute right-3 top-3 z-10 w-8 h-8 rounded-full bg-black/40 text-slate-200 hover:bg-black/70 text-lg leading-none">×</button>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ----------------------------- player page ----------------------------- */
function PlayerPage({ pid, onClose }){
  const ui = useUI(), G = ui.G, p = G.players[pid]; if (!p) return null;
  const t = T(G, p.tid), ct = p.col != null ? T(G, p.col) : (t && !t.pro ? t : null), grp = GROUP(p.pos), sv = seen(G, p), inCol = t && !t.pro, pro = p.exp != null;
  const tc = t || ct || { c1: "#334155", c2: "#e2e8f0", abbr: "FA" }, chips = awardChips(p), big = chips.filter(c => c.w >= 30), small = chips.filter(c => c.w < 30);
  const colTot = careerTotals(p, "C"), proTot = careerTotals(p, "P"), liveLvl = t ? (t.pro ? "P" : "C") : null;
  const tot = lvl => { const o = Object.assign({}, lvl === "C" ? colTot : proTot); if (liveLvl === lvl) STAT_KEYS.concat(["g"]).forEach(k => { if (p.st[k]) o[k] = (o[k] || 0) + p.st[k]; }); return o; };
  const headline = o => grp === "QB" ? [["Pass Yds", o.py], ["Pass TD", o.ptd], ["Int", o.pi], ["Rush Yds", o.ry]] : p.pos === "RB" ? [["Rush Yds", o.ry], ["Rush TD", o.rtd], ["Rec", o.rec], ["Rec Yds", o.rcy]] : p.pos === "WR" || p.pos === "TE" ? [["Rec", o.rec], ["Rec Yds", o.rcy], ["Rec TD", o.rctd], ["Y/R", o.rec ? (o.rcy / o.rec).toFixed(1) : 0]]
    : grp === "OL" ? [["Starts", o.gs], ["Pancakes", o.pk], ["Sacks alw.", o.sal]] : grp === "KP" ? (p.pos === "K" ? [["FGM", o.fgm], ["FGA", o.fga], ["XPM", o.xpm]] : [["Punts", o.pu], ["Avg", o.pu ? (o.puy / o.pu).toFixed(1) : 0]]) : [["Tackles", o.tk], ["Sacks", o.sck], ["Int", o.int], ["TFL", o.tfl]];
  const status = p.ret ? `Retired ${p.ret}` : p.recruit ? "High school recruit" : p.dcl ? "Draft prospect" : p.fa ? "Free agent" : p.inj ? `Injured — out ${p.inj} wk` : p.portal ? "In the transfer portal" : "Active";
  const colHist = p.hist.filter(r => r.lvl === "C"), years = p.aw.reduce((m, a) => ((m[a[0]] || (m[a[0]] = [])).push(a), m), {});
  const canScout = !sv.exact && G.lp >= 1;
  return (
    <Modal onClose={onClose} wide accent={[tc.c1, tc.c2]}>
      {/* header */}
      <div className="relative px-5 pt-5 pb-4 overflow-hidden" style={{ background: `linear-gradient(120deg, ${tc.c1}55 0%, #0b111e 62%)` }}>
        <div className="absolute -right-6 -top-4 opacity-[.13] disp select-none" style={{ fontSize: 150, color: tc.c2 }}>{p.num}</div>
        <div className="flex items-start gap-4 relative">
          <div className="hidden sm:block mt-1"><Helmet t={tc} size={78} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] tracking-[.2em] text-slate-300 uppercase">{p.pos} · #{p.num} · {status}{p.hof ? " · Hall of Fame " + p.hof : ""}{p.chof ? " · College HoF" : ""}</div>
            <div className="disp text-4xl sm:text-5xl mt-1 truncate">{p.fn} <span style={{ color: brightOf(tc) }}>{p.ln}</span></div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300 mt-2">
              <span>{fmtHt(p.ht)}, {p.wt} lb</span><span>Age {p.age}</span>{p.cls != null && !p.recruit && inCol && <span>{CLS[p.cls]}{p.walkOn ? " · walk-on" : ""}</span>}
              <span>Born in <b className="text-slate-100">{p.home}</b></span><span>HS: {p.hs}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300 mt-1">
              {t && <span>Team: <TeamLink t={t} full className="text-slate-100" /></span>}
              {ct && pro && <span>College: <TeamLink t={ct} className="text-slate-100" /></span>}
              {p.stars && !pro && <span>Recruit: <Stars n={p.stars} />{p.rk ? ` · No. ${p.rk} nationally` : ""}</span>}
              {p.draft && <span>Draft: <b className="text-slate-100">{p.draft.y} · Rd {p.draft.rd}, No. {p.draft.pk}</b> ({p.draft.t})</span>}
              {pro && !p.draft && p.exp != null && <span>Undrafted</span>}
              {p.c && <span>Contract: <b className="text-slate-100">{money(p.c.amt)}</b> × {p.c.yrs} yr</span>}
              {!pro && <span>GPA {p.gpa.toFixed(2)}</span>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 mr-8"><Ring v={sv.ovr} label={sv.exact ? "OVR" : "OVR?"} /><Ring v={sv.pot} label={sv.exact ? "POT" : "POT?"} color="#a78bfa" /></div>
        </div>
        {big.length > 0 && <div className="flex flex-wrap gap-1.5 mt-4 relative">{big.map((c, i) => <span key={i} title={c.ys.join(", ")} className={cx("px-2 py-1 rounded-md text-[11px] font-bold pop", c.w >= 80 ? "bg-amber-400 text-slate-950" : c.w >= 60 ? "bg-amber-400/20 text-amber-200 border border-amber-400/40" : "bg-white/10 text-slate-100 border border-white/10")} style={{ animationDelay: i * 40 + "ms" }}>{c.n > 1 ? c.n + "× " : ""}{c.a}{c.n === 1 ? " " + c.ys[0] : ""}</span>)}</div>}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[["C", "College career", colTot.g || (liveLvl === "C" && p.st.g)], ["P", "Pro career", proTot.g || (liveLvl === "P" && p.st.g)]].filter(x => x[2]).map(([lvl, label]) => { const o = tot(lvl); return (
            <div key={lvl} className="card p-3"><div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: lvl === "C" ? "#c4b5fd" : "#94a3b8" }}>{label} · {o.g || 0} games</div>
              <div className="flex gap-5">{headline(o).map(([l, v]) => <div key={l}><div className="disp text-2xl tnum">{v || 0}</div><div className="text-[10px] text-slate-400">{l}</div></div>)}</div></div>); })}
        </div>

        {/* ratings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card title="Scouting report" className="md:col-span-2" right={sv.exact ? null : "Unscouted — estimates only"}>
            {sv.exact ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 items-center">
              <div className="space-y-2">{RLAB[grp].map((l, i) => <div key={l}><div className="flex justify-between text-xs mb-0.5"><span className="text-slate-300">{l}</span><span className="font-bold tnum" style={{ color: ovrColor(p.r[i]) }}>{p.r[i]}</span></div><HBar v={p.r[i] - 25} max={74} color={ovrColor(p.r[i])} h={6} /></div>)}</div>
              <div className="flex justify-center"><RadarVs p={p} color={brightOf(tc)} /></div>
            </div> : <div className="text-sm text-slate-300">Your scouts have only seen him on tape: roughly a <b>{sv.ovr}</b> now with <b>{sv.pot}</b> upside, give or take. A full report shows his true ratings.
              <div className="mt-3"><Btn kind="pri" disabled={!canScout} onClick={() => ui.act(G => { G.lp -= 1; G.scouted[p.id] = 1; })}>Scout him · 1 Legacy Point</Btn></div></div>}
          </Card>
          <Card title="Career arc" right="rating by age · ★ = major award">
            <CareerArc p={p} color={brightOf(tc)} />
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs"><div className="bg-white/5 rounded-lg p-2"><div className="text-slate-400 text-[10px]">Character</div><div className="font-bold">{p.chr >= 80 ? "Leader" : p.chr >= 60 ? "Solid" : p.chr >= 40 ? "Average" : "Question marks"}</div></div><div className="bg-white/5 rounded-lg p-2"><div className="text-slate-400 text-[10px]">{pro ? "Experience" : "Enrolled"}</div><div className="font-bold">{pro ? (isRookie(G, p) ? "Rookie" : (p.exp || 1) + " yr") : p.enr || "—"}</div></div></div>
          </Card>
        </div>

        {/* stat tables */}
        <div>
          {STAT_TABLES.map(d => <StatTable key={d.name + "C"} p={p} lvl="C" def={d} live={liveLvl === "C" && p.st.g > 0} />)}
          {STAT_TABLES.map(d => <StatTable key={d.name + "P"} p={p} lvl="P" def={d} live={liveLvl === "P" && p.st.g > 0} />)}
          {!p.hist.length && !(p.st.g > 0) && <Card><Empty>{p.recruit ? "A high school prospect — no college games yet." : "No games played yet."}</Empty></Card>}
          <div className="text-[10px] text-slate-500"><span className="text-amber-300 font-bold">Gold</span> = led the {pro ? "league" : "nation"} that season. College rows count bowl and playoff games; pro rows count the postseason.</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* game log */}
          {p.gl && p.gl.length > 0 && <Card title={G.year + " game log"} pad={false}><div className="overflow-x-auto"><table className="st tnum"><thead><tr><th className="l">Wk</th><th className="l">Opp</th><th className="l">Result</th><th className="l">Line</th></tr></thead>
            <tbody>{p.gl.map((r, i) => <tr key={i}><td className="l">{r.w}</td><td className="l">{r.o}</td><td className={cx("l font-semibold", r.r[0] === "W" ? "text-emerald-400" : "text-rose-400")}>{r.r}</td><td className="l text-slate-200">{lineText(r)}</td></tr>)}</tbody></table></div></Card>}
          {/* Heisman voting */}
          {p.hv && p.hv.length > 0 && <Card title="Heisman voting">{p.hv.map(([y, place, pts]) => <div key={y} className="flex items-center gap-3 mb-2"><div className="w-10 text-xs text-slate-400">{y}</div><div className={cx("disp text-xl w-12", place === 1 ? "text-amber-300" : "")}>{ord(place)}</div><div className="flex-1"><HBar v={pts} max={2700} color={place === 1 ? "#facc15" : "#64748b"} /></div><div className="text-xs tnum w-16 text-right">{pts} pts</div></div>)}</Card>}
          {p.av && p.av.length > 0 && <Card title="Award voting">{p.av.slice().reverse().map(([y, a, place, pts], i) => <div key={i} className="flex items-center gap-3 mb-2"><div className="w-10 text-xs text-slate-400">{y}</div><div className={cx("disp text-xl w-12", place === 1 ? "text-amber-300" : "")}>{ord(place)}</div><div className="flex-1 min-w-0 text-xs truncate">{a}</div><div className="text-xs tnum w-14 text-right text-slate-400">{pts} pts</div></div>)}</Card>}
          {/* honors by year */}
          {p.aw.length > 0 && <Card title="Honors & awards">
            {Object.keys(years).sort((a, b) => b - a).map(y => { const list = years[y], wk = list.filter(a => /Player of the Week/.test(a[1])), main = list.filter(a => !/Player of the Week/.test(a[1])); return (
              <div key={y} className="flex gap-3 mb-2 text-xs"><div className="w-10 font-bold text-slate-300 shrink-0">{y}</div><div className="flex-1 space-y-0.5">{main.map((a, i) => <div key={i} className={/Heisman Trophy$|Most Valuable|All-American$|All-Pro/.test(a[1]) ? "text-amber-200 font-semibold" : "text-slate-200"}>{a[1]}</div>)}{wk.length > 0 && <div className="text-slate-400">{wk.length}× Player of the Week (Wk {wk.map(a => a[2]).filter((v, i, s) => s.indexOf(v) === i).join(", ")})</div>}</div></div>); })}
          </Card>}
          {/* story + transactions */}
          {((p.story && p.story.length) || p.tx.length > 0) && <Card title="Story & transactions">
            <div className="relative pl-4 border-l border-[#26324f] space-y-2.5">
              {[...(p.story || []).map(s => ({ y: s[0], w: s[1], txt: s[2], st: 1 })), ...p.tx.map(x => ({ y: x[0], w: -1, txt: x[1] }))].sort((a, b) => b.y - a.y || b.w - a.w).map((e, i) => (
                <div key={i} className="relative text-xs"><span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[#0f1626]" style={{ background: e.st ? "var(--acc)" : "#64748b" }} /><span className="text-slate-500 mr-2 tnum">{e.y}{e.w > 0 ? " · Wk " + e.w : ""}</span><span className={e.st ? "text-slate-100" : "text-slate-300"}>{e.txt}</span></div>))}
            </div>
          </Card>}
        </div>
        {small.length > 0 && <div className="flex flex-wrap gap-1.5">{small.map((c, i) => <span key={i} className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-slate-300">{c.n > 1 ? c.n + "× " : ""}{c.a}</span>)}</div>}
      </div>
    </Modal>
  );
}

/* ----------------------------- team page ----------------------------- */
function RosterTable({ G, tid, onRelease }){
  const d = depthChart(G, tid), t = T(G, tid), [f, setF] = useState("All"), groups = ["All", "QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "KP"];
  const rows = POS.flatMap(pos => d[pos].map((p, i) => ({ p, starter: i < STARTERS[pos] }))).filter(x => f === "All" || GROUP(x.p.pos) === f);
  const key = p => { const s = p.st; return p.pos === "QB" ? `${s.py || 0} yds, ${s.ptd || 0} TD` : p.pos === "RB" ? `${s.ry || 0} yds, ${s.rtd || 0} TD` : p.pos === "WR" || p.pos === "TE" ? `${s.rec || 0}-${s.rcy || 0}, ${s.rctd || 0} TD` : GROUP(p.pos) === "OL" ? `${s.gs || 0} GS, ${s.pk || 0} pk` : p.pos === "K" ? `${s.fgm || 0}/${s.fga || 0} FG` : p.pos === "P" ? `${s.pu ? (s.puy / s.pu).toFixed(1) : "—"} avg` : `${s.tk || 0} tkl, ${s.sck || 0} sck, ${s.int || 0} int`; };
  return (<div>
    <SubTabs tabs={groups} value={f} onChange={setF} />
    <div className="overflow-x-auto"><table className="st tnum"><thead><tr><th className="l">Pos</th><th className="l">Player</th><th>{t.pro ? "Age" : "Cls"}</th><th>Ovr</th><th>Pot</th><th className="l">{G.year} line</th>{t.pro && <th>Salary</th>}{onRelease && <th />}</tr></thead>
      <tbody>{rows.map(({ p, starter }) => { const sv = seen(G, p); return (
        <tr key={p.id}><td className="l"><span className={cx("px-1.5 py-0.5 rounded text-[10px] font-bold", starter ? "bg-acc text-slate-950" : "bg-white/5 text-slate-400")}>{p.pos}</span></td>
          <td className="l"><PLink p={p} />{p.inj ? <span className="ml-1.5 text-[10px] text-rose-400 font-bold">INJ {p.inj}w</span> : null}{p.portal ? <span className="ml-1.5 text-[10px] text-amber-400">PORTAL</span> : null}{p.aw.some(a => a[0] === G.year - 1 && /All-American|All-Pro/.test(a[1])) ? <span className="ml-1 text-amber-300" title="All-American / All-Pro last season">★</span> : null}</td>
          <td className="text-slate-400">{t.pro ? p.age : CLS[p.cls]}</td><td><Ovr v={sv.ovr} fuzzy={!sv.exact} /></td><td className="text-violet-300">{sv.exact ? "" : "~"}{sv.pot}</td><td className="l text-slate-300">{p.st.g ? key(p) : "—"}</td>
          {t.pro && <td>{p.c ? money(p.c.amt) + " · " + p.c.yrs + "y" : "—"}</td>}{onRelease && <td><button className="text-rose-400 text-[11px] hover:underline" onClick={() => onRelease(p)}>Release</button></td>}</tr>); })}</tbody></table></div>
  </div>);
}
function ScheduleList({ G, tid }){
  const ui = useUI(), games = [...G.cs, ...G.ps].filter(g => g.h === tid || g.a === tid).sort((a, b) => a.w - b.w);
  return <div className="space-y-1">{games.map(g => { const home = g.h === tid, [H, A] = gameTeams(G, g), opp = home ? A : H, us = home ? g.hs : g.as, them = home ? g.as : g.hs, rv = g.riv != null ? G.riv.find(r => r.i === g.riv) : null; return (
    <div key={g.id} onClick={() => g.done && ui.openGame(g.id)} className={cx("flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm", g.done ? "hover:bg-white/5 cursor-pointer" : "", g.w === G.week && !g.done ? "bg-white/5 ring-1 ring-[color:var(--acc)]" : "")}>
      <div className="w-9 text-[10px] text-slate-500">{g.post ? "POST" : "WK " + g.w}</div><div className="w-5 text-xs text-slate-500">{g.neutral ? "vs" : home ? "vs" : "@"}</div><Badge t={opp} size={18} />
      <div className="flex-1 min-w-0 truncate"><TeamLink t={opp} />{(g.tag || rv) && <span className="ml-2 text-[10px] text-amber-300/90">{g.tag || rv.name}</span>}</div>
      {g.done ? <div className="tnum font-semibold"><span className={us > them ? "text-emerald-400" : "text-rose-400"}>{us > them ? "W" : "L"}</span> {us}–{them}{g.ot ? " OT" : ""}</div> : <div className="text-xs text-slate-500">{g.conf ? "Conf" : g.div ? "Div" : ""}</div>}
    </div>); })}</div>;
}
function TeamPage({ tid, onClose }){
  const ui = useUI(), G = ui.G, t = T(G, tid), [tab, setTab] = useState("Roster"), c = lineup(G, t, 0);
  const alumni = t.pro ? [] : proPlayers(G).filter(p => p.col === t.id).sort((a, b) => b.ovr - a.ovr), rivs = t.pro ? [] : G.riv.filter(r => r.a === t.id || r.b === t.id);
  const legends = t.pro ? [] : Object.values(G.players).filter(p => (p.col === t.id || p.tid === t.id) && awardScore(p, false) >= 10).sort((a, b) => awardScore(b, false) - awardScore(a, false)).slice(0, 12);
  return (
    <Modal onClose={onClose} wide accent={[t.c1, t.c2]}>
      <div className="relative h-44 overflow-hidden"><SceneBackdrop teams={[t]} dim={.75} />
        <div className="absolute inset-0 flex items-end p-5 gap-4"><Helmet t={t} size={84} />
          <div className="flex-1 min-w-0"><div className="text-[11px] tracking-[.2em] uppercase text-slate-300">{t.pro ? `${t.conf} Conference · ${t.div}` : G.confs[t.conf].full}</div>
            <div className="disp text-4xl sm:text-5xl truncate">{t.rank ? <span className="text-2xl text-slate-300 mr-2">#{t.rank}</span> : null}{t.pro ? t.city : t.name} <span style={{ color: brightOf(t) }}>{t.nick}</span></div>
            <div className="text-xs text-slate-300 mt-1">{t.w}–{t.l}{!t.pro && t.conf !== "IND" ? ` (${t.cw}–${t.cl} ${G.confs[t.conf].name})` : ""} · Coach {t.coach.name}{isUser(G, t.id) ? " (you)" : ""} · {t.coach.w}–{t.coach.l} career</div></div>
        </div></div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {[["Pass offense", c.passOff], ["Run offense", c.runOff], ["Pass defense", c.passDef], ["Run defense", c.runDef]].map(([l, v]) => <div key={l} className="card p-2.5"><div className="text-[10px] text-slate-400 mb-1">{l}</div><div className="flex items-center gap-2"><div className="disp text-xl w-8" style={{ color: ovrColor(v) }}>{round(v)}</div><div className="flex-1"><HBar v={v - 40} max={55} color={brightOf(t)} h={5} /></div></div></div>)}
          <div className="card p-2.5"><div className="text-[10px] text-slate-400 mb-1">{t.pro ? "Cap room" : "Prestige"}</div><div className="disp text-xl">{t.pro ? money(capRoom(G, t.id)) : round(t.prestige)}</div></div>
        </div>
        <SubTabs tabs={["Roster", "Schedule", "History", "Trophy case", ...(t.pro ? [] : ["Pro alumni"])]} value={tab} onChange={setTab} />
        <div key={tab} className="page-in">
          {tab === "Roster" && <RosterTable G={G} tid={tid} />}
          {tab === "Schedule" && <div className="grid md:grid-cols-2 gap-4"><ScheduleList G={G} tid={tid} />{!t.pro && <Card title="Poll position this season"><RankChart hist={t.rkHist} color={brightOf(t)} /></Card>}</div>}
          {tab === "History" && (t.hist.length ? <div><Card title="Program timeline" className="mb-3"><Timeline rows={t.hist} pro={t.pro} colorOf={() => brightOf(t)} /></Card>
            <div className="overflow-x-auto"><table className="st tnum"><thead><tr><th className="l">Year</th><th>W</th><th>L</th>{!t.pro && <th>Conf</th>}{!t.pro && <th>Final rank</th>}<th>PF</th><th>PA</th><th className="l">Postseason</th><th className="l">Coach</th></tr></thead>
              <tbody>{t.hist.slice().reverse().map(h => <tr key={h.y}><td className="l font-semibold">{h.y}</td><td>{h.w}</td><td>{h.l}</td>{!t.pro && <td>{h.cw}–{h.cl}{h.cc ? " 🏆" : ""}</td>}{!t.pro && <td>{h.rk || "—"}</td>}<td>{h.pf}</td><td>{h.pa}</td><td className={cx("l", /Champions|Won Pocket/.test(h.post) ? "text-amber-300 font-bold" : "text-slate-300")}>{h.post || "—"}</td><td className="l text-slate-400">{h.coach}</td></tr>)}</tbody></table></div></div> : <Empty>History builds once a season is complete.</Empty>)}
          {tab === "Trophy case" && <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">{(t.pro ? [["Pocket Bowls", t.titles, "🏆"], ["All-time record", t.allW + "–" + t.allL, "📒"]] : [["National titles", t.titles, "🏆"], ["Conference titles", t.confTitles, "🥇"], ["Heisman winners", t.heismans, "🗿"], ["All-Americans", t.allAm, "⭐"], ["Bowl record", t.bowlW + "–" + t.bowlL, "🏟️"], ["Draft picks", t.picks, "📝"], ["All-time record", t.allW + "–" + t.allL, "📒"]]).map(([l, v, e]) => <div key={l} className="card p-3 text-center"><div className="text-2xl">{e}</div><div className="disp text-2xl mt-1">{v}</div><div className="text-[10px] text-slate-400">{l}</div></div>)}</div>
            {rivs.length > 0 && <Card title="Rivalry trophies">{rivs.map(r => { const o = T(G, r.a === t.id ? r.b : r.a), mine = r.a === t.id ? r.aw : r.bw, theirs = r.a === t.id ? r.bw : r.aw; return <div key={r.i} className="flex items-center gap-3 py-1.5 text-sm border-b border-white/5 last:border-0"><span className="text-lg">{r.holder === t.id ? "🏆" : "▫️"}</span><div className="flex-1 min-w-0"><div className="font-semibold truncate">{r.trophy}</div><div className="text-[11px] text-slate-400">{r.name} vs <TeamLink t={o} /></div></div><div className="tnum text-xs text-slate-300">{mine}–{theirs}</div></div>; })}</Card>}
            {legends.length > 0 && <Card title="Program legends" className="mt-3">{legends.map(p => <div key={p.id} className="flex items-center gap-2 py-1 text-sm"><span className="text-[10px] text-slate-500 w-7">{p.pos}</span><PLink p={p} /><span className="text-[11px] text-amber-200/80 truncate">{awardChips(p).filter(c => c.w >= 60).slice(0, 3).map(c => (c.n > 1 ? c.n + "× " : "") + c.a).join(" · ")}</span></div>)}</Card>}
          </div>}
          {tab === "Pro alumni" && (alumni.length ? <div className="overflow-x-auto"><table className="st tnum"><thead><tr><th className="l">Player</th><th className="l">Pos</th><th className="l">Pro team</th><th>Ovr</th><th className="l">Drafted</th></tr></thead><tbody>{alumni.slice(0, 40).map(p => <tr key={p.id}><td className="l"><PLink p={p} /></td><td className="l">{p.pos}</td><td className="l"><TeamLink t={T(G, p.tid)} full /></td><td><Ovr v={p.ovr} /></td><td className="l text-slate-400">{p.draft ? `${p.draft.y} Rd ${p.draft.rd} (#${p.draft.pk})` : "Undrafted"}</td></tr>)}</tbody></table></div> : <Empty>No alumni in the pros yet.</Empty>)}
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------- box score + gamecast ----------------------------- */
function Gamecast({ pbp, H, A }){
  const [i, setI] = useState(0), [run, setRun] = useState(true), [speed, setSpeed] = useState(1), ref = useRef(null);
  useEffect(() => { if (!run || i >= pbp.length - 1) return; const p = pbp[i], big = p[6] === "td" || p[6] === "to" || p[6] === "fg"; const id = setTimeout(() => setI(x => Math.min(pbp.length - 1, x + 1)), (big ? 1300 : 420) / speed); return () => clearTimeout(id); }, [i, run, speed]);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [i]);
  const p = pbp[i], off = p[1], x = off === 0 ? p[2] : 100 - p[2], q = Math.min(4, Math.floor(p[0] / 900) + 1), left = p[0] >= 3600 ? "OT" : `Q${q} ${Math.floor((900 - (p[0] % 900)) / 60)}:${String((900 - (p[0] % 900)) % 60).padStart(2, "0")}`;
  const kind = p[6];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3"><Badge t={A} size={22} /><span className="disp text-3xl tnum">{p[5]}</span><span className="text-slate-500">–</span><span className="disp text-3xl tnum">{p[4]}</span><Badge t={H} size={22} /></div>
        <div className="text-xs text-slate-300 tnum">{left}</div>
      </div>
      <svg viewBox="0 0 520 150" className="w-full rounded-xl" style={{ background: "#0d3b1f" }}>
        <rect x="10" y="8" width="42" height="134" fill={A.c1} /><rect x="468" y="8" width="42" height="134" fill={H.c1} />
        <text transform="translate(36 75) rotate(-90)" textAnchor="middle" fontSize="13" className="disp" fill={inkOn(A.c1)}>{A.abbr}</text><text transform="translate(484 75) rotate(90)" textAnchor="middle" fontSize="13" className="disp" fill={inkOn(H.c1)}>{H.abbr}</text>
        {Array.from({ length: 11 }, (_, k) => <g key={k}><line x1={52 + k * 41.6} x2={52 + k * 41.6} y1="8" y2="142" stroke="#fff" opacity={k === 5 ? .7 : .28} />{k > 0 && k < 10 && <text x={52 + k * 41.6} y="136" textAnchor="middle" fontSize="8" fill="#fff" opacity=".45">{k <= 5 ? k * 10 : 100 - k * 10}</text>}</g>)}
        <g style={{ transform: `translateX(${52 + x * 4.16}px)`, transition: `transform ${.4 / speed}s ease-out` }}>
          <line x1="0" x2="0" y1="8" y2="142" stroke={kind === "td" ? "#facc15" : "#fde047"} strokeWidth="1.6" opacity=".8" />
          <ellipse cx="0" cy="75" rx="9" ry="5.5" fill="#8b4513" stroke="#fff" strokeWidth="1.2" className={kind === "td" ? "pop" : ""} />
          <polygon points={off === 0 ? "12,75 20,70 20,80" : "-12,75 -20,70 -20,80"} fill={off === 0 ? brightOf(H) : brightOf(A)} />
        </g>
        {kind === "td" && <text x="260" y="60" textAnchor="middle" fontSize="30" className="disp pop" fill="#facc15">TOUCHDOWN</text>}
        {kind === "to" && <text x="260" y="60" textAnchor="middle" fontSize="22" className="disp pop" fill="#f87171">{/INTERCEPT/.test(p[3]) ? "INTERCEPTION" : /FUMBLE/.test(p[3]) ? "FUMBLE" : /downs/.test(p[3]) ? "TURNOVER ON DOWNS" : /no good/.test(p[3]) ? "NO GOOD" : "TURNOVER"}</text>}
        {kind === "fg" && <text x="260" y="60" textAnchor="middle" fontSize="24" className="disp pop" fill="#86efac">FIELD GOAL</text>}
      </svg>
      <div className="flex items-center gap-2 mt-2">
        <Btn small onClick={() => setRun(r => !r)}>{run && i < pbp.length - 1 ? "❚❚ Pause" : "▶ Play"}</Btn>
        {[1, 3, 10].map(s => <Btn key={s} small kind={speed === s ? "pri" : undefined} onClick={() => setSpeed(s)}>{s}×</Btn>)}
        <Btn small onClick={() => { setI(pbp.length - 1); setRun(false); }}>Skip to final</Btn>
        <input type="range" min="0" max={pbp.length - 1} value={i} onChange={e => { setI(+e.target.value); setRun(false); }} className="flex-1 accent-[color:var(--acc)]" />
      </div>
      <div ref={ref} className="mt-2 h-32 overflow-y-auto text-xs space-y-1">{pbp.slice(Math.max(0, i - 14), i + 1).reverse().map((r, k) => <div key={i - k} className={cx("flex gap-2", k === 0 ? "text-white font-semibold" : "text-slate-400")}><span className="w-9 shrink-0 font-bold" style={{ color: brightOf(r[1] === 0 ? H : A) }}>{(r[1] === 0 ? H : A).abbr}</span><span>{r[3]}</span></div>)}</div>
    </div>
  );
}
function BoxScore({ gid, onClose }){
  const ui = useUI(), G = ui.G, g = gameById(G, gid); if (!g || !g.done) return null;
  const [H, A] = gameTeams(G, g), pbp = G._pbp && G._pbp[g.id], [tab, setTab] = useState(pbp ? "Gamecast" : "Summary"), rv = g.riv != null ? G.riv.find(r => r.i === g.riv) : null;
  const tabs = [...(pbp ? ["Gamecast"] : []), "Summary", ...(g.box ? ["Box score"] : [])], hw = g.hs > g.as;
  const boxTable = (side, t) => { const rows = g.box[side].map(([pid, l]) => ({ p: G.players[pid], pid, l })).filter(x => x.p); const sec = (title, f, cols) => { const r = rows.filter(x => f(x.l)); return r.length ? <div className="mb-3"><div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{title}</div><table className="st tnum"><thead><tr><th className="l">{t.abbr}</th>{cols.map(c => <th key={c[1]}>{c[1]}</th>)}</tr></thead><tbody>{r.sort((a, b) => (b.l[cols[0][0]] || 0) - (a.l[cols[0][0]] || 0)).slice(0, 8).map(x => <tr key={x.pid}><td className="l"><PLink p={x.p} /> <span className="text-[10px] text-slate-500">{x.p.pos}</span></td>{cols.map(c => <td key={c[1]}>{typeof c[0] === "function" ? c[0](x.l) : x.l[c[0]] || 0}</td>)}</tr>)}</tbody></table></div> : null; };
    return <div>{sec("Passing", l => l.pa, [["py", "Yds"], [l => `${l.pc || 0}/${l.pa}`, "C/A"], ["ptd", "TD"], ["pi", "Int"]])}{sec("Rushing", l => l.ra, [["ry", "Yds"], ["ra", "Att"], ["rtd", "TD"]])}{sec("Receiving", l => l.rec, [["rcy", "Yds"], ["rec", "Rec"], ["rctd", "TD"]])}{sec("Defense", l => l.tk || l.int, [["tk", "Tkl"], ["sck", "Sck"], ["int", "Int"], ["ff", "FF"]])}</div>; };
  return (
    <Modal onClose={onClose} wide accent={[A.c1, H.c1]}>
      <div className="px-5 pt-5 pb-4" style={{ background: `linear-gradient(90deg, ${A.c1}44, #0b111e 40%, #0b111e 60%, ${H.c1}44)` }}>
        <div className="text-center text-[11px] tracking-[.2em] uppercase text-amber-300/90 mb-2">{g.tag || (rv ? rv.name + " · " + rv.trophy : (H.pro ? "Pro" : "College") + " · Week " + g.w)}{g.neutral ? " · neutral site" : ""}</div>
        <div className="flex items-center justify-center gap-3 sm:gap-8">
          <div className="flex-1 flex flex-col items-end text-right min-w-0"><Helmet t={A} size={56} /><div className="disp text-lg sm:text-2xl mt-1 truncate max-w-full"><TeamLink t={A} /></div><div className="text-[11px] text-slate-400">{A.fcs ? "FCS" : A.w + "–" + A.l}</div></div>
          <div className="text-center"><div className="disp text-5xl sm:text-6xl tnum"><span className={hw ? "text-slate-500" : ""}>{g.as}</span><span className="text-slate-600 mx-2">–</span><span className={hw ? "" : "text-slate-500"}>{g.hs}</span></div><div className="text-[10px] text-slate-400 tracking-widest mt-1">FINAL{g.ot ? " / " + (g.ot > 1 ? g.ot : "") + "OT" : ""}</div></div>
          <div className="flex-1 flex flex-col items-start min-w-0"><Helmet t={H} size={56} flip /><div className="disp text-lg sm:text-2xl mt-1 truncate max-w-full"><TeamLink t={H} /></div><div className="text-[11px] text-slate-400">{H.w}–{H.l}</div></div>
        </div>
        <div className="flex justify-center mt-3"><table className="text-xs tnum"><thead><tr className="text-slate-500"><th className="px-2 text-left font-normal" />{g.q[0].map((_, i) => <th key={i} className="px-2 font-normal">{i < 4 ? i + 1 : "OT"}</th>)}<th className="px-2 font-normal">T</th></tr></thead>
          <tbody>{[[A, 1, g.as], [H, 0, g.hs]].map(([t, i, s]) => <tr key={i}><td className="px-2 text-left font-bold" style={{ color: brightOf(t) }}>{t.abbr}</td>{g.q[i].map((v, k) => <td key={k} className="px-2 text-center text-slate-300">{v}</td>)}<td className="px-2 text-center font-black">{s}</td></tr>)}</tbody></table></div>
      </div>
      <div className="p-4 sm:p-5">
        {tabs.length > 1 && <SubTabs tabs={tabs} value={tab} onChange={setTab} />}
        <div key={tab} className="page-in">
          {tab === "Gamecast" && <Gamecast pbp={pbp} H={H} A={A} />}
          {tab === "Summary" && <div className="grid md:grid-cols-2 gap-4">
            <div>
              {g.flow && <Card title="Game flow" className="mb-3"><FlowChart flow={g.flow} H={H} A={A} /></Card>}
              <Card title="Team stats">{[["Total yards", "yd"], ["Passing yards", "py"], ["Rushing yards", "ry"], ["First downs", "fd"], ["Plays", "pl"], ["Turnovers", "to"]].map(([l, k]) => <CompareBar key={k} label={l} a={Math.max(0, g.tot[1][k])} b={Math.max(0, g.tot[0][k])} ca={brightOf(A)} cb={brightOf(H)} />)}</Card>
            </div>
            <div>
              <Card title="Scoring summary" className="mb-3">{g.smry.map((s, i) => { const t = s[1] === 0 ? H : A; return <div key={i} className="flex items-center gap-2 py-1 text-xs border-b border-white/5 last:border-0"><span className="text-slate-500 w-6">{s[0] > 4 ? "OT" : "Q" + s[0]}</span><Badge t={t} size={15} /><span className="flex-1 text-slate-200">{s[2]}</span><span className="tnum font-bold">{s[4]}–{s[3]}</span></div>; })}</Card>
              <Card title="Top performers">{[[A, 1], [H, 0]].map(([t, i]) => <div key={i} className="mb-2"><div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: brightOf(t) }}>{t.fcs ? t.name : t.abbr}</div>{(g.top[i] || []).map(([pid, txt]) => <div key={pid} className="text-xs flex gap-2 py-0.5"><PLink pid={pid} />{g.potg === pid && <span title="Player of the game">🏅</span>}<span className="text-slate-400">{txt}</span></div>)}{t.fcs && <div className="text-xs text-slate-500">FCS opponent — no individual stats kept.</div>}</div>)}</Card>
            </div></div>}
          {tab === "Box score" && <div className="grid md:grid-cols-2 gap-5">{boxTable(1, A)}{boxTable(0, H)}</div>}
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------- Heisman ceremony ----------------------------- */
function HeismanVote({ votes, reveal = votes.length, w = [3, 2, 1] }){
  const G = useUI().G, max = votes[0].pts;
  return <div className="space-y-2">{votes.map((v, i) => { const t = T(G, v.tid) || { c1: "#475569", c2: "#fff", abbr: "—" }, shown = i >= votes.length - reveal; return (
    <div key={v.pid} className={cx("flex items-center gap-3 transition-opacity duration-500", shown ? "opacity-100" : "opacity-0")}>
      <div className={cx("disp w-7 text-right", i === 0 ? "text-amber-300 text-2xl" : "text-slate-400 text-lg")}>{i + 1}</div><Badge t={t} size={20} />
      <div className="w-40 min-w-0"><div className="text-sm truncate"><PLink pid={v.pid} name={v.n} /></div><div className="text-[10px] text-slate-400 truncate">{[v.pos, v.cls, v.line].filter(Boolean).join(" · ")}</div></div>
      <div className="flex-1 h-5 rounded bg-slate-800/70 overflow-hidden flex">{shown && [["first", "#facc15"], ["second", "#94a3b8"], ["third", "#b45309"]].map(([k, c]) => <div key={k} className="grow h-full" style={{ width: v[k] * (k === "first" ? w[0] : k === "second" ? w[1] : w[2]) / max * 100 + "%", background: c }} title={v[k] + " " + k + "-place votes"} />)}</div>
      <div className="w-14 text-right text-sm font-bold tnum">{shown ? v.pts : ""}</div>
    </div>); })}
    <div className="flex gap-3 text-[10px] text-slate-400 pt-1 pl-10"><span><i className="inline-block w-2 h-2 rounded-sm bg-amber-400 mr-1" />1st-place points</span><span><i className="inline-block w-2 h-2 rounded-sm bg-slate-400 mr-1" />2nd</span><span><i className="inline-block w-2 h-2 rounded-sm bg-amber-700 mr-1" />3rd</span></div></div>;
}
function Ceremony({ onClose }){
  const ui = useUI(), G = ui.G, votes = G.awards.col.heis.slice(0, 5), [n, setN] = useState(0), w = votes[0], wt = T(G, w.tid), done = n >= 5;
  useEffect(() => { if (done) return; const id = setTimeout(() => setN(x => x + 1), n === 4 ? 1900 : 1000); return () => clearTimeout(id); }, [n]);
  const pred = G.preds.heis != null ? G.preds.heis === w.pid : null;
  return (
    <Modal onClose={onClose} accent={["#facc15", "#b45309"]}>
      {done && <Confetti colors={[wt.c1, wt.c2, "#facc15"]} />}
      <div className="p-6 text-center" style={{ background: "radial-gradient(ellipse at top, #3b2a05 0%, #0b111e 60%)" }}>
        <div className="text-[11px] tracking-[.35em] text-amber-300/90 uppercase">New York · {G.year}</div>
        <div className="disp text-4xl mt-2">The Heisman Trophy</div>
        <div className="text-xs text-slate-400 mt-1">900 ballots. Five finalists. {done ? "One winner." : "Counting from fifth place…"}</div>
        {done ? <div className="mt-5 pop"><div className="text-6xl">🏆</div><div className="flex justify-center mt-2"><Helmet t={wt} size={70} /></div><div className="disp text-4xl mt-2" style={{ color: brightOf(wt) }}>{w.n}</div><div className="text-sm text-slate-300">{w.pos} · {w.cls} · {wt.name}</div><div className="text-xs text-slate-400 mt-1">{w.line}</div>
          {pred != null && <div className={cx("mt-3 inline-block px-3 py-1 rounded-full text-xs font-bold", pred ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-slate-400")}>{pred ? "You called it back in August — Legacy Points paid at season's end" : "Not your preseason pick"}</div>}</div> : <div className="mt-6 text-5xl sheen rounded-xl py-4">✉️</div>}
      </div>
      <div className="p-5"><HeismanVote votes={votes} reveal={n} /><div className="mt-4 text-right"><Btn kind="pri" onClick={onClose}>{done ? "Continue" : "Skip"}</Btn></div></div>
    </Modal>
  );
}
