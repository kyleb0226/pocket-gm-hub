
/* =========================================================================
   UI — building blocks
   ========================================================================= */
const UICtx = React.createContext(null);
const useUI = () => React.useContext(UICtx);
const cx = (...a) => a.filter(Boolean).join(" ");
// Pick black or white text for a background colour.
const inkOn = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#0b1220" : "#ffffff"; };
// A team colour that stays readable on the dark background.
const brightOf = t => { const lum = h => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000; }; return lum(t.c1) > 70 ? t.c1 : lum(t.c2) > 70 ? t.c2 : "#cbd5e1"; };
const fmtHt = h => Math.floor(h / 12) + "′" + (h % 12) + "″";
const ovrColor = v => v >= 88 ? "#facc15" : v >= 80 ? "#4ade80" : v >= 70 ? "#38bdf8" : v >= 60 ? "#cbd5e1" : "#94a3b8";
const rk = t => t && t.rank ? <span className="text-[10px] text-slate-400 mr-1 tnum">{t.rank}</span> : null;

function Helmet({ t, size = 40, flip }){
  const c1 = t.c1, c2 = t.c2 || "#fff";
  return (
    <svg width={size} height={size * .82} viewBox="0 0 100 82" style={{ transform: flip ? "scaleX(-1)" : undefined, flexShrink: 0 }}>
      <path d="M8 46C8 22 27 5 52 5c24 0 40 15 40 34 0 6-2 10-5 13H62c-5 0-8 3-8 8v10H30C17 70 8 60 8 46z" fill={c1} stroke="rgba(255,255,255,.18)" strokeWidth="1.5" />
      <path d="M22 12C38 3 62 3 80 16" fill="none" stroke={c2} strokeWidth="5" strokeLinecap="round" opacity=".95" />
      <path d="M14 30c10-14 30-22 50-20" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="42" cy="48" r="5" fill={c2} opacity=".9" />
      <path d="M56 52h36M60 64h30M72 52v24M88 52c4 8 4 16 0 24H60" fill="none" stroke="#cfd6e4" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Badge({ t, size = 28 }){
  if (!t) return null;
  return <span className="inline-flex items-center justify-center font-black tnum shrink-0" style={{ width: size * 1.5, height: size, borderRadius: 7, background: t.c1, color: inkOn(t.c1), fontSize: size * .38, border: "1px solid " + (t.c2 || "#fff") + "55", letterSpacing: ".02em" }}>{t.abbr}</span>;
}
function TeamLink({ t, full, className }){
  const ui = useUI(); if (!t) return <span>—</span>;
  if (t.fcs) return <span className="text-slate-400">{t.name} <span className="text-[10px]">(FCS)</span></span>;
  return <span className={cx("link", className)} onClick={e => { e.stopPropagation(); ui.openTeam(t.id); }}>{rk(t)}{full ? tname(t) : t.pro ? t.city : t.name}</span>;
}
function PLink({ p, pid, name, className }){
  const ui = useUI(), id = p ? p.id : pid, live = ui.G.players[id];
  if (!live) return <span className={className}>{name || (p && pname(p)) || "—"}</span>;
  return <span className={cx("link font-medium", className)} onClick={e => { e.stopPropagation(); ui.openPlayer(id); }}>{name || pname(live)}</span>;
}
const Stars = ({ n }) => <span className="text-amber-400 tracking-tighter text-[11px]">{"★".repeat(n || 0)}<span className="text-slate-700">{"★".repeat(5 - (n || 0))}</span></span>;
const Card = ({ children, className, title, right, pad = true }) => (
  <div className={cx("card", className)}>
    {title && <div className="flex items-center justify-between px-4 pt-3 pb-2"><div className="disp text-[15px] text-slate-200">{title}</div><div className="text-xs text-slate-400">{right}</div></div>}
    <div className={pad ? (title ? "px-4 pb-4" : "p-4") : ""}>{children}</div>
  </div>
);
function SubTabs({ tabs, value, onChange }){
  return <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">{tabs.map(t => { const [k, l] = Array.isArray(t) ? t : [t, t]; return <button key={k} onClick={() => onChange(k)} className={cx("px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors", value === k ? "bg-acc text-slate-950 border-transparent" : "border-[#26324f] text-slate-300 hover:border-slate-500")}>{l}</button>; })}</div>;
}
const Btn = ({ children, onClick, kind, className, disabled, small }) => <button disabled={disabled} onClick={onClick} className={cx(small ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm", "rounded-lg font-semibold transition-all active:scale-95", kind === "pri" ? "bg-acc text-slate-950 hover:brightness-110" : kind === "ghost" ? "text-slate-300 hover:bg-white/5" : "bg-[#1a2540] text-slate-100 hover:bg-[#223052] border border-[#2a3860]", className)}>{children}</button>;
const Ovr = ({ v, fuzzy }) => <span className="font-bold tnum" style={{ color: ovrColor(v) }}>{fuzzy ? "~" : ""}{v}</span>;
const Empty = ({ children }) => <div className="text-sm text-slate-400 py-6 text-center">{children}</div>;

/* ----------------------------- charts ----------------------------- */
function Spark({ pts, w = 260, h = 70, color = "var(--acc)", min, max, labels, dots = true, invert }){
  if (!pts || pts.length < 2) return <div className="text-xs text-slate-500 py-3">Not enough history yet.</div>;
  const lo = min != null ? min : Math.min(...pts), hi = max != null ? max : Math.max(...pts), span = Math.max(1, hi - lo);
  const X = i => 8 + i * (w - 16) / (pts.length - 1), Y = v => { const f = (v - lo) / span; return 8 + (invert ? f : 1 - f) * (h - 22); };
  const d = pts.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: h * 1.6 }}>
      <path d={d + ` L${X(pts.length - 1)} ${h - 12} L${X(0)} ${h - 12}Z`} fill={color} opacity=".1" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" className="draw" />
      {dots && pts.map((v, i) => <g key={i}><circle cx={X(i)} cy={Y(v)} r="3" fill="#0f1626" stroke={color} strokeWidth="2" /><text x={X(i)} y={Y(v) - 6} textAnchor="middle" fontSize="8" fill="#cbd5e1">{v}</text></g>)}
      {labels && labels.map((l, i) => <text key={i} x={X(i)} y={h - 2} textAnchor="middle" fontSize="7.5" fill="#64748b">{l}</text>)}
    </svg>
  );
}
function Radar({ vals, labels, color = "var(--acc)", size = 190, cmp }){
  const n = vals.length, c = size / 2, R = size / 2 - 30, pt = (i, f) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f]; };
  const poly = f => vals.map((_, i) => pt(i, typeof f === "function" ? f(i) : f).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: size + 40 }}>
      {[.25, .5, .75, 1].map(f => <polygon key={f} points={poly(f)} fill="none" stroke="#24304d" strokeWidth="1" />)}
      {vals.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#1c2742" />; })}
      {cmp && <polygon points={poly(i => clamp((cmp[i] - 30) / 69, .04, 1))} fill="none" stroke="#94a3b8" strokeWidth="1.3" strokeDasharray="3 3" />}
      <polygon points={poly(i => clamp((vals[i] - 30) / 69, .04, 1))} fill={color} fillOpacity=".25" stroke={color} strokeWidth="2" className="pop" style={{ transformOrigin: "center" }} />
      {labels.map((l, i) => { const [x, y] = pt(i, 1.22); return <text key={i} x={x} y={y + 3} textAnchor="middle" fontSize="8.5" fill="#94a3b8">{l}</text>; })}
    </svg>
  );
}
// Poll position by week: No. 1 at the top, unranked drawn along the bottom.
function RankChart({ hist, color }){
  if (!hist || hist.length < 2) return <div className="text-xs text-slate-500 py-3">The poll history fills in as the season goes.</div>;
  const w = 300, h = 90, X = i => 14 + i * (w - 28) / (hist.length - 1), Y = r => r ? 10 + (r - 1) / 24 * (h - 34) : h - 12;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[1, 5, 10, 15, 20, 25].map(r => <g key={r}><line x1="14" x2={w - 14} y1={Y(r)} y2={Y(r)} stroke="#1c2742" strokeDasharray="2 4" /><text x="2" y={Y(r) + 3} fontSize="7" fill="#64748b">{r}</text></g>)}
      <text x="2" y={h - 9} fontSize="7" fill="#64748b">NR</text>
      <path d={hist.map((r, i) => (i ? "L" : "M") + X(i) + " " + Y(r)).join(" ")} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" className="draw" />
      {hist.map((r, i) => <circle key={i} cx={X(i)} cy={Y(r)} r="2.6" fill={r ? color : "#475569"} />)}
    </svg>
  );
}
// Score margin through the game: above the line the home team leads.
function FlowChart({ flow, H, A }){
  if (!flow || flow.length < 2) return null;
  const w = 320, h = 110, end = Math.max(3600, flow[flow.length - 1][0]), m = Math.max(7, ...flow.map(f => Math.abs(f[1]))), X = t => 6 + t / end * (w - 12), Y = d => h / 2 - d / m * (h / 2 - 12);
  let d = "M" + X(0) + " " + Y(0); for (let i = 1; i < flow.length; i++) d += ` L${X(flow[i][0])} ${Y(flow[i - 1][1])} L${X(flow[i][0])} ${Y(flow[i][1])}`; d += ` L${X(end)} ${Y(flow[flow.length - 1][1])}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <defs><clipPath id="up"><rect x="0" y="0" width={w} height={h / 2} /></clipPath><clipPath id="dn"><rect x="0" y={h / 2} width={w} height={h / 2} /></clipPath></defs>
      {[900, 1800, 2700].map(t => <line key={t} x1={X(t)} x2={X(t)} y1="6" y2={h - 6} stroke="#1c2742" strokeDasharray="2 4" />)}
      <path d={d + ` L${X(end)} ${h / 2} L${X(0)} ${h / 2}Z`} fill={brightOf(H)} opacity=".28" clipPath="url(#up)" /><path d={d + ` L${X(end)} ${h / 2} L${X(0)} ${h / 2}Z`} fill={brightOf(A)} opacity=".28" clipPath="url(#dn)" />
      <line x1="6" x2={w - 6} y1={h / 2} y2={h / 2} stroke="#33415f" /><path d={d} fill="none" stroke="#e2e8f0" strokeWidth="1.8" className="draw" />
      <text x="8" y="12" fontSize="8" fill={brightOf(H)}>{H.abbr} leads</text><text x="8" y={h - 5} fontSize="8" fill={brightOf(A)}>{A.abbr} leads</text>
      {["Q1", "Q2", "Q3", "Q4"].map((q, i) => <text key={q} x={X(i * 900 + 450)} y={h - 2} fontSize="7" fill="#475569" textAnchor="middle">{q}</text>)}
    </svg>
  );
}
function CompareBar({ label, a, b, ca, cb, fmt = x => x }){
  const tot = Math.max(1, a + b);
  return <div className="mb-2"><div className="flex justify-between text-xs mb-1"><span className="font-bold tnum">{fmt(a)}</span><span className="text-slate-400">{label}</span><span className="font-bold tnum">{fmt(b)}</span></div>
    <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800 gap-0.5"><div className="grow" style={{ width: a / tot * 100 + "%", background: ca }} /><div className="grow" style={{ width: b / tot * 100 + "%", background: cb, transformOrigin: "right" }} /></div></div>;
}
function HBar({ v, max, color = "var(--acc)", h = 8 }){ return <div className="rounded-full bg-slate-800 overflow-hidden" style={{ height: h }}><div className="grow h-full rounded-full" style={{ width: clamp(v / max * 100, 0, 100) + "%", background: color }} /></div>; }
function Ring({ v, label, color, size = 64 }){
  const r = size / 2 - 6, c = 2 * Math.PI * r;
  return <div className="relative" style={{ width: size, height: size }}><svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c2742" strokeWidth="6" /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || ovrColor(v)} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - clamp((v - 30) / 69, 0, 1))} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 1s ease" }} /></svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="font-black text-lg leading-none tnum">{v}</div><div className="text-[8px] text-slate-400 tracking-widest mt-0.5">{label}</div></div></div>;
}
function Confetti({ colors }){
  const bits = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ l: Math.random() * 100, d: 2.2 + Math.random() * 2.6, dl: Math.random() * 1.2, c: colors[i % colors.length] })), []);
  return <div>{bits.map((b, i) => <i key={i} className="confetti" style={{ left: b.l + "vw", background: b.c, animationDuration: b.d + "s", animationDelay: b.dl + "s" }} />)}</div>;
}

/* ----------------------------- the stadium scene ----------------------------- */
// One venue: sky, stands full of the home colours, light towers, and the field seen
// from behind the end zone. The menu cross-fades between venues.
function Stadium({ t, sky = "night", label }){
  const c1 = t.c1, c2 = t.c2 || "#fff", id = "s" + t.abbr.replace(/\W/g, "") + sky;
  const SKY = { night: ["#03060f", "#0b1730", "#16264d"], dusk: ["#1b1035", "#7a2c4f", "#f08a4b"], snow: ["#1a2233", "#3a4760", "#6b7a94"], day: ["#1763b8", "#4f9be0", "#b9dcf5"] }[sky];
  const yl = i => 268 + 182 * Math.pow(i / 10, 1.75), xl = y => 250 - (y - 268) * 1.92, xr = y => 550 + (y - 268) * 1.92;
  const bits = useMemo(() => Array.from({ length: 46 }, () => [Math.random() * 800, Math.random() * 230, Math.random() * 3, 4 + Math.random() * 6]), []);
  return (
    <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" className="w-full h-full kenburns">
      <defs>
        <linearGradient id={id + "k"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={SKY[0]} /><stop offset=".6" stopColor={SKY[1]} /><stop offset="1" stopColor={SKY[2]} /></linearGradient>
        <linearGradient id={id + "f"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d3b1f" /><stop offset="1" stopColor="#1f7a3c" /></linearGradient>
        <radialGradient id={id + "g"}><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".25" stopColor="#dbeafe" stopOpacity=".5" /><stop offset="1" stopColor="#93c5fd" stopOpacity="0" /></radialGradient>
        <pattern id={id + "c"} width="9" height="7" patternUnits="userSpaceOnUse"><rect width="9" height="7" fill="#0a0f1c" /><circle cx="2.2" cy="2.4" r="1.5" fill={c1} /><circle cx="6.6" cy="4.8" r="1.5" fill={c2} opacity=".85" /><circle cx="6.8" cy="1.6" r="1.1" fill={c1} opacity=".7" /></pattern>
        <linearGradient id={id + "v"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".55" /></linearGradient>
      </defs>
      <rect width="800" height="450" fill={`url(#${id}k)`} />
      {sky === "night" && bits.map((b, i) => <circle key={i} cx={b[0]} cy={b[1] * .6} r={.5 + b[2] * .3} fill="#fff" className="twinkle" style={{ animationDelay: b[2] + "s" }} />)}
      {sky === "dusk" && <circle cx="610" cy="205" r="46" fill="#ffd27a" opacity=".85" />}
      {sky === "day" && <g fill="#fff" opacity=".8"><ellipse cx="160" cy="80" rx="70" ry="16" /><ellipse cx="560" cy="60" rx="90" ry="18" /><ellipse cx="660" cy="120" rx="50" ry="11" /></g>}
      {/* upper deck, lower bowl, side stands */}
      <path d="M0 250 Q400 120 800 250 L800 280 L0 280Z" fill="#0a0f1c" /><path d="M20 250 Q400 136 780 250 L780 272 Q400 168 20 272Z" fill={`url(#${id}c)`} />
      <path d="M60 280 Q400 196 740 280 L740 270 Q400 176 60 270Z" fill={c1} opacity=".9" />
      <path d="M0 280 L250 268 L-200 450 L0 450Z" fill={`url(#${id}c)`} /><path d="M800 280 L550 268 L1000 450 L800 450Z" fill={`url(#${id}c)`} />
      <path d="M90 282 Q400 214 710 282 L550 268 L250 268Z" fill={`url(#${id}c)`} />
      {/* field */}
      <polygon points="250,268 550,268 900,450 -100,450" fill={`url(#${id}f)`} />
      {Array.from({ length: 5 }, (_, i) => { const y0 = yl(i * 2), y1 = yl(i * 2 + 1); return <polygon key={i} points={`${xl(y0)},${y0} ${xr(y0)},${y0} ${xr(y1)},${y1} ${xl(y1)},${y1}`} fill="#fff" opacity=".045" />; })}
      {Array.from({ length: 10 }, (_, i) => { const y = yl(i); return <line key={i} x1={xl(y)} x2={xr(y)} y1={y} y2={y} stroke="#fff" strokeWidth={.6 + i * .22} opacity=".55" />; })}
      <polygon points={`${xl(yl(8.6))},${yl(8.6)} ${xr(yl(8.6))},${yl(8.6)} 900,450 -100,450`} fill={c1} opacity=".92" />
      <text x="400" y="438" textAnchor="middle" fontSize="54" className="disp" fill={c2} opacity=".9" style={{ letterSpacing: "10px" }}>{(t.pro ? t.nick : t.name).toUpperCase().slice(0, 14)}</text>
      <polygon points="250,268 550,268 548,262 252,262" fill={c1} opacity=".8" />
      <g stroke="#facc15" strokeWidth="2.4" fill="none" strokeLinecap="round"><path d="M400 266V246M384 246H416M384 246V214M416 246V214" /></g>
      {/* lights */}
      {[[70, 150], [250, 96], [550, 96], [730, 150]].map(([x, y], i) => <g key={i}><rect x={x - 2} y={y} width="4" height="130" fill="#111827" /><rect x={x - 22} y={y - 14} width="44" height="16" rx="2" fill="#1f2937" />{sky !== "day" && <circle cx={x} cy={y - 6} r="70" fill={`url(#${id}g)`} className="flicker" style={{ animationDelay: i * .7 + "s" }} />}{[-15, -5, 5, 15].map(dx => <circle key={dx} cx={x + dx} cy={y - 6} r="3" fill="#fff" />)}</g>)}
      {sky === "snow" && bits.map((b, i) => <circle key={i} cx={b[0]} cy="0" r={1 + b[2] * .6} fill="#fff" opacity=".8" className="snow" style={{ animationDuration: b[3] + "s", animationDelay: -b[2] * 3 + "s" }} />)}
      <rect width="800" height="450" fill={`url(#${id}v)`} />
    </svg>
  );
}
const skyFor = t => t.pro ? (t.id % 3 === 0 ? "night" : t.id % 3 === 1 ? "dusk" : "day") : ["MI", "WI", "MN", "NY", "OH", "PA", "IA", "NE", "ND", "CO", "WY", "IN", "IL", "MA", "CT", "ID", "UT"].includes(t.state) ? "snow" : ["AZ", "NV", "NM", "CA", "HI", "TX", "OK"].includes(t.state) ? "dusk" : ["FL"].includes(t.state) ? "day" : "night";
// Cross-fading backdrop. `teams` is the playlist; pass one team to hold on it.
function SceneBackdrop({ teams, hold = 7000, dim = .55, nolabel }){
  const [i, setI] = useState(0), list = teams.filter(Boolean);
  useEffect(() => { setI(0); if (list.length < 2) return; const id = setInterval(() => setI(x => x + 1), hold); return () => clearInterval(id); }, [list.map(t => t.abbr).join(",")]);
  const cur = list[i % list.length], prev = list[(i + list.length - 1) % list.length];
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "#03060f" }}>
      {list.length > 1 && <div key={"p" + i} className="scene-layer"><Stadium t={prev} sky={skyFor(prev)} /></div>}
      <div key={"c" + i + cur.abbr} className="scene-layer fade-in" style={{ animationDuration: "1.6s" }}><Stadium t={cur} sky={skyFor(cur)} /></div>
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(3,6,15,${dim * .55}) 0%, rgba(3,6,15,${dim}) 55%, #070b14 100%)` }} />
      {!nolabel && <div key={"l" + i} className="absolute left-14 bottom-3 text-[11px] text-white/70 fade-in tracking-wide"><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: cur.c1, boxShadow: "0 0 0 1px " + cur.c2 }} />{cur.pro ? `${cur.city} ${cur.nick} · ${cur.conf} ${cur.div}` : `${cur.name} ${cur.nick} · ${CONFS[cur.conf].name}`}</div>}
    </div>
  );
}

/* ----------------------------- stat tables ----------------------------- */
const pct = (a, b) => b ? (a / b * 100).toFixed(1) : "—", per = (a, b, d = 1) => b ? (a / b).toFixed(d) : "—";
const passerRating = (r, pro) => { if (!r.pa) return "—"; const a = r.pa, c = r.pc || 0, y = r.py || 0, t = r.ptd || 0, i = r.pi || 0;
  if (!pro) return ((8.4 * y + 330 * t + 100 * c - 200 * i) / a).toFixed(1);
  const f = v => clamp(v, 0, 2.375); return ((f((c / a - .3) * 5) + f((y / a - 3) * .25) + f(t / a * 20) + f(2.375 - i / a * 25)) / 6 * 100).toFixed(1); };
const G_ = [["g", "G"], ["gs", "GS"]];
const STAT_TABLES = [
  { name: "Passing", show: r => r.pa > 0, cols: [...G_, ["pc", "Cmp"], ["pa", "Att"], [r => pct(r.pc || 0, r.pa), "Pct"], ["py", "Yds"], ["ptd", "TD"], ["pi", "Int"], [r => per(r.py || 0, r.pa), "Y/A"], [(r, pro) => passerRating(r, pro), "Rate"], ["sk", "Sk"]] },
  { name: "Rushing & Receiving", show: r => r.ra > 0 || r.rec > 0 || r.tg > 0, cols: [...G_, ["ra", "Att"], ["ry", "Yds"], [r => per(r.ry || 0, r.ra), "Avg"], ["rtd", "TD"], ["tg", "Tgt"], ["rec", "Rec"], ["rcy", "Yds"], [r => per(r.rcy || 0, r.rec), "Y/R"], ["rctd", "TD"], ["fum", "Fmb"]] },
  { name: "Defense", show: r => r.tk > 0 || r.int > 0, cols: [...G_, ["tk", "Tkl"], ["tfl", "TFL"], ["sck", "Sck"], ["int", "Int"], ["pd", "PD"], ["ff", "FF"], ["dtd", "TD"]] },
  { name: "Kicking", show: r => r.fga > 0 || r.xpa > 0, cols: [["g", "G"], ["fgm", "FGM"], ["fga", "FGA"], [r => pct(r.fgm || 0, r.fga), "FG%"], ["fgl", "Lng"], ["xpm", "XPM"], ["xpa", "XPA"], [r => (r.fgm || 0) * 3 + (r.xpm || 0), "Pts"]] },
  { name: "Punting", show: r => r.pu > 0, cols: [["g", "G"], ["pu", "Punts"], ["puy", "Yds"], [r => per(r.puy || 0, r.pu), "Avg"]] },
  { name: "Blocking", show: r => r.pk > 0 || r.sal > 0, cols: [...G_, ["pk", "Pancakes"], ["sal", "Sacks allowed"]] },
];
// Year-by-year table for one level ("C" college / "P" pro), Football-Reference style.
function StatTable({ p, lvl, def, live }){
  const G = useUI().G, rows = p.hist.filter(r => r.lvl === lvl).slice();
  if (live) rows.push(Object.assign({ y: G.year, lvl, t: (T(G, p.tid) || {}).abbr, tid: p.tid, age: p.age, cls: p.cls != null ? CLS[p.cls] : undefined, live: 1 }, p.st));
  const use = rows.filter(r => def.show(r)); if (!use.length) return null;
  const tot = {}; use.forEach(r => STAT_KEYS.concat(["g", "gs"]).forEach(k => { if (r[k]) tot[k] = k === "fgl" ? Math.max(tot[k] || 0, r[k]) : (tot[k] || 0) + r[k]; })); tot.fgl = Math.max(0, ...use.map(r => r.fgl || 0)) || undefined;
  const awOf = y => p.aw.filter(a => a[0] === y && !/Player of the Week|captain/i.test(a[1])).map(a => a[1].replace("Trophy", "").replace("First-team ", "").replace("Consensus ", "").replace("Second-team", "2nd").trim());
  const pro = lvl === "P", cell = (r, c) => typeof c[0] === "function" ? c[0](r, pro) : (r[c[0]] != null ? r[c[0]] : c[0] === "g" || c[0] === "gs" ? 0 : "");
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2 mb-1"><div className="disp text-sm" style={{ color: pro ? "#e2e8f0" : "#c4b5fd" }}>{def.name}</div><div className="text-[10px] text-slate-500 uppercase tracking-widest">{pro ? "Pro" : "College"}</div></div>
      <div className="overflow-x-auto rounded-lg border border-[#1f2a44]"><table className="st tnum">
        <thead><tr><th className="l">Year</th><th className="l">{pro ? "Age" : "Class"}</th><th className="l">Team</th>{def.cols.map((c, i) => <th key={i}>{c[1]}</th>)}<th className="l">Honors</th></tr></thead>
        <tbody>
          {use.map((r, i) => { const t = r.tid != null ? T(G, r.tid) : null; return (
            <tr key={i} className={r.live ? "bg-white/[.03]" : ""}>
              <td className="l font-semibold">{r.y}{r.live ? <span className="text-[9px] text-emerald-400 ml-1">LIVE</span> : ""}</td><td className="l text-slate-400">{pro ? r.age : r.cls}</td>
              <td className="l">{t ? <TeamLink t={Object.assign({}, t, { rank: 0 })} /> : <span className="text-slate-300">{r.t}</span>}</td>
              {def.cols.map((c, j) => { const led = r.ld && typeof c[0] === "string" && r.ld.includes(c[0]); return <td key={j} className={led ? "font-black text-amber-300" : ""} title={led ? "Led the " + (pro ? "league" : "nation") : undefined}>{cell(r, c)}</td>; })}
              <td className="l text-[10px] text-amber-200/80 max-w-[220px] truncate" title={awOf(r.y).join(", ")}>{awOf(r.y).slice(0, 3).join(" · ")}</td>
            </tr>); })}
        </tbody>
        {use.length > 1 && <tfoot><tr className="font-bold"><td className="l">Career</td><td className="l text-slate-400">{use.length} yr</td><td className="l" />{def.cols.map((c, j) => <td key={j}>{cell(tot, c)}</td>)}<td /></tr></tfoot>}
      </table></div>
    </div>
  );
}
// "3× First-team All-SEC" style chips from the raw award list.
function awardChips(p){
  const m = new Map(); p.aw.forEach(([y, a]) => { const k = a.replace(/ \(\d\w\w\)$/, ""); const e = m.get(k) || { n: 0, ys: [] }; e.n++; if (!e.ys.includes(y)) e.ys.push(y); m.set(k, e); });
  const w = a => a === "Heisman Trophy" ? 100 : a === "Most Valuable Player" ? 99 : /Pocket Bowl MVP/.test(a) ? 90 : /Unanimous/.test(a) ? 85 : /All-American$/.test(a) && !/Second|Freshman/.test(a) ? 80 : /All-Pro/.test(a) ? 78 : /(Award|Trophy|Golden Arm)/.test(a) && !/finalist|Joe Moore/.test(a) ? 70 : /of the Year/.test(a) ? 65 : /Heisman Trophy finalist/.test(a) ? 60 : /Pro Bowl/.test(a) ? 55 : /MVP/.test(a) ? 50 : /^First-team All-/.test(a) ? 45 : /Second-team/.test(a) ? 35 : /Freshman/.test(a) ? 30 : /captain/i.test(a) ? 20 : /Week/.test(a) ? 5 : 25;
  return [...m.entries()].map(([a, e]) => ({ a, n: e.n, ys: e.ys, w: w(a) })).sort((x, y) => y.w - x.w);
}
