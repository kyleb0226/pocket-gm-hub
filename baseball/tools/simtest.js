#!/usr/bin/env node
/*
 * Headless sim harness for Pocket GM — Baseball.
 *
 * The whole game is one <script type="text/babel-src"> block inside index.html.
 * This pulls that block out, transpiles it with the vendored Babel, and runs it in
 * a Node vm context with just enough browser shim (localStorage / IndexedDB /
 * document / React) that the module-level code can execute. The UI components are
 * never rendered — we only reach in and call the simulation functions.
 *
 * Usage:
 *   node tools/simtest.js            # run every check
 *   node tools/simtest.js season     # just the full-season invariants
 *
 * Add a case to CHECKS to cover a new rule.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

// Everything the checks below need to reach inside the app bundle.
const EXPORTS = [
  "newGame", "migrate", "simDay", "isMlbId",
  "rules", "setRule", "ruleValue", "applyPendingRules",
  "RULES_DEFAULT", "SEASON_LENGTHS", "SEASON_PRESETS", "countScheduledGames",
  "enterPlayoffs", "activeSeriesList", "playoffSeriesGame", "buildNextRound", "seriesLenFor",
  "payroll", "capSpaceFor", "ROSTER_CAP", "rosterOf",
  "startFantasyDraft", "fantasyOnClock", "fantasyAIPick", "fantasyPick", "DIFFICULTIES",
  "personalityOf", "answerPresser", "pickPresser", "PERSONALITIES",
];

/* ------------------------------- load the app ---------------------------- */
function loadGame() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/<script type="text\/babel-src" id="app-src">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("couldn't find the app-src block in index.html");

  // Babel-standalone expects a browser-ish global; give it one before requiring.
  const babelSandbox = { window: {}, self: {}, console, process, setTimeout, clearTimeout };
  babelSandbox.global = babelSandbox;
  vm.createContext(babelSandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "vendor/babel.min.js"), "utf8"), babelSandbox);
  const Babel = babelSandbox.Babel || babelSandbox.window.Babel;
  if (!Babel) throw new Error("vendored Babel didn't expose a Babel global");

  let code = Babel.transform(m[1], { presets: [["react", { runtime: "classic" }]] }).code;
  // Top-level `const`/`let` in a vm script don't become context globals (only `var`
  // and function declarations do), so publish everything the checks reach for.
  code += `\n;globalThis.__APP__ = {${EXPORTS.map(n => `${n}: typeof ${n} !== "undefined" ? ${n} : undefined`).join(", ")}};`;

  // Minimal shims. Components are never invoked, so React only needs to exist.
  const noop = () => {};
  const store = new Map();
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Math, Date, JSON,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      key: i => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    },
    indexedDB: undefined,                      // forces the localStorage fallback path
    document: { getElementById: () => ({}), addEventListener: noop, removeEventListener: noop, visibilityState: "visible" },
    navigator: { userAgent: "node" },
    React: {
      createElement: (...a) => ({ _el: a }),
      useState: v => [typeof v === "function" ? v() : v, noop],
      useEffect: noop, useRef: v => ({ current: v }), useMemo: (f) => f(),
      useCallback: f => f, useContext: () => noop,
      createContext: () => ({ Provider: noop, Consumer: noop }),
      Fragment: "fragment",
      // The error boundary is a real class component, so `extends
      // React.Component` has to resolve to something constructible even
      // though no component is ever rendered here.
      Component: class { constructor(props){ this.props = props; this.state = null; } setState(){} },
    },
    ReactDOM: { createRoot: () => ({ render: noop }) },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "app-src.js" });
  const A = sandbox.__APP__;
  const missing = EXPORTS.filter(n => A[n] === undefined);
  if (missing.length) console.log(`  \x1b[33m! not exported: ${missing.join(", ")}\x1b[0m`);
  return A;
}

/* --------------------------------- helpers ------------------------------- */
let failures = 0;
let checksRun = 0;
function ok(cond, label, detail) {
  checksRun++;
  if (cond) { console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  else { failures++; console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? `\n      ${detail}` : ""}`); }
}
function section(name) { console.log(`\n\x1b[1m${name}\x1b[0m`); }

// Play a franchise from opening day to the end of the regular season.
function simRegularSeason(A, G) {
  let guard = 0;
  while (G.day < G.schedule.length && guard++ < 400) A.simDay(G);
  return G;
}
const teamGames = t => t.w + t.l;

/* --------------------------------- checks -------------------------------- */
const CHECKS = {
  // Every season-length preset must produce EXACTLY the advertised game count.
  seasonLength(A) {
    section("Season-length rule");
    A.SEASON_LENGTHS.forEach(len => {
      const G = A.newGame(0, { seed: 7, rules: { seasonLen: len } });
      const counts = G.teams.map(t => A.countScheduledGames(G.schedule, t.id));
      const min = Math.min(...counts), max = Math.max(...counts);
      ok(min === len && max === len, `${len}-game season → every club scheduled for exactly ${len}`,
        `got min=${min} max=${max}`);
    });
  },

  // A full season must stay internally consistent: wins balance losses, and every
  // club actually played its whole slate.
  season(A) {
    section("Full-season invariants (108-game slate)");
    const G = A.newGame(0, { seed: 11, rules: { seasonLen: 108 } });
    simRegularSeason(A, G);
    const w = G.teams.reduce((s, t) => s + t.w, 0);
    const l = G.teams.reduce((s, t) => s + t.l, 0);
    ok(w === l, `league wins === losses (${w} vs ${l})`);
    const played = G.teams.map(teamGames);
    ok(Math.min(...played) === 108 && Math.max(...played) === 108,
      "every club played all 108", `min=${Math.min(...played)} max=${Math.max(...played)}`);

    // leaderboard sanity — the run environment shouldn't have moved
    const hitters = Object.values(G.players).filter(p => !p.isP && A.isMlbId(p.teamId) && p.stats.PA > 300);
    const hrLeader = Math.max(...hitters.map(p => p.stats.HR));
    ok(hrLeader >= 25 && hrLeader <= 55, `HR leader in range for a short season (${hrLeader})`);
    const avgLeader = Math.max(...hitters.map(p => p.stats.H / p.stats.AB));
    ok(avgLeader > 0.31 && avgLeader < 0.40, `AVG leader in range (${avgLeader.toFixed(3)})`);
  },

  // Pitchers-hit: pitchers must accrue a hitting line, and it must live in batStats
  // so it never contaminates their pitching counters.
  dh(A) {
    section("Designated-hitter rule");
    const G = A.newGame(0, { seed: 5, rules: { seasonLen: 54, dh: "none" } });
    simRegularSeason(A, G);
    const arms = Object.values(G.players).filter(p => p.isP && A.isMlbId(p.teamId));
    const batted = arms.filter(p => p.batStats && p.batStats.PA > 0);
    ok(batted.length > 20, `pitchers took plate appearances (${batted.length} of them)`);
    const totalPA = batted.reduce((s, p) => s + p.batStats.PA, 0);
    ok(totalPA > 500, `meaningful pitcher PA volume (${totalPA})`);
    // a pitcher's own pitching line must be untouched by his hitting
    const bad = batted.filter(p => p.stats.PA > 0);
    ok(bad.length === 0, "pitcher hitting never wrote into his pitching stats",
      bad.length ? `${bad.length} pitchers had stats.PA set` : "");
    // and they should be genuinely bad hitters
    const paw = batted.reduce((s, p) => s + p.batStats.H, 0) / Math.max(1, batted.reduce((s, p) => s + p.batStats.AB, 0));
    ok(paw < 0.200, `pitchers hit like pitchers (${paw.toFixed(3)})`);

    const G2 = A.newGame(0, { seed: 5, rules: { seasonLen: 54, dh: "universal" } });
    simRegularSeason(A, G2);
    const anyBat = Object.values(G2.players).some(p => p.isP && p.batStats && p.batStats.PA > 0);
    ok(!anyBat, "universal DH → no pitcher ever bats");
  },

  // Mercy + ghost runner: both should shorten games without breaking W/L balance.
  paceRules(A) {
    section("Pace rules (mercy + ghost runner)");

    const base = A.newGame(0, { seed: 3, rules: { seasonLen: 54 } });
    simRegularSeason(A, base);
    const mercy = A.newGame(0, { seed: 3, rules: { seasonLen: 54, mercy: 10 } });
    simRegularSeason(A, mercy);
    const bw = base.teams.reduce((s, t) => s + t.w, 0), bl = base.teams.reduce((s, t) => s + t.l, 0);
    const mw = mercy.teams.reduce((s, t) => s + t.w, 0), ml = mercy.teams.reduce((s, t) => s + t.l, 0);
    ok(bw === bl, `no-mercy league balanced (${bw}/${bl})`);
    ok(mw === ml, `mercy-rule league balanced (${mw}/${ml})`);

    // This used to assert `mercyRuns < baseRuns` over the two seasons' total
    // runs. That was a coin flip: `seed` only seeds LEAGUE GENERATION (newGame
    // restores Math.random so the sim stays genuinely random), so the two
    // seasons are independent draws and the mercy rule's real effect (~1-2%)
    // sits inside season-to-season variance. It failed about half the time on
    // an untouched tree.
    //
    // Assert the mechanism instead, which is deterministic: a mercy game
    // breaks out of the inning loop at 7 or 8, so the away club — which bats
    // in every inning played — has a short line score. Without the rule no
    // regulation game can end before 9.
    const shortGames = G => {
      let n = 0;
      (G.schedule || []).forEach(day => (day || []).forEach(g => {
        if (g && g.box && g.box.ls && Array.isArray(g.box.ls.a) && g.box.ls.a.length < 9) n++;
      }));
      return n;
    };
    const baseShort = shortGames(base), mercyShort = shortGames(mercy);
    ok(baseShort === 0, `no game ends early without the mercy rule (${baseShort} short)`);
    ok(mercyShort > 0, `mercy rule ends blowouts early (${mercyShort} short games)`);

    const ghost = A.newGame(0, { seed: 3, rules: { seasonLen: 54, extras: "ghost" } });
    simRegularSeason(A, ghost);
    const gw = ghost.teams.reduce((s, t) => s + t.w, 0), gl = ghost.teams.reduce((s, t) => s + t.l, 0);
    ok(gw === gl, `ghost-runner league balanced (${gw}/${gl})`);
  },

  // The postseason must reach a champion under every field size.
  playoffs(A) {
    section("Playoff field sizes");
    [3, 4, 5, 6, 8].forEach(n => {
      const G = A.newGame(0, { seed: 13, rules: { seasonLen: 54, playoffTeams: n } });
      simRegularSeason(A, G);
      A.enterPlayoffs(G);
      let guard = 0;
      while (G.phase === "playoffs" && guard++ < 200) {
        const active = A.activeSeriesList(G.playoffs);
        if (!active.length) break;
        const bestOf = A.seriesLenFor(G, G.playoffs.round);
        active.forEach(s => { if (!s.done) A.playoffSeriesGame(G, s, bestOf); });
        if (active.every(s => s.done)) A.buildNextRound(G);
      }
      const champ = G.champion && G.champion.id;
      ok(champ != null, `${n}-team field crowned a champion`, `phase=${G.phase} round=${G.playoffs && G.playoffs.round}`);
    });
  },

  // The save is JSON. Anything the sim hangs off a player must survive stringify —
  // a back-reference (e.g. caching a proxy that points back at its player) makes the
  // whole franchise unsaveable, and the failure only shows up after a real season.
  serializable(A) {
    section("Save stays JSON-serializable");
    [{ dh: "none", extras: "ghost", mercy: 10 }, { dh: "universal" }].forEach(r => {
      const G = A.newGame(0, { seed: 9, rules: Object.assign({ seasonLen: 54 }, r) });
      simRegularSeason(A, G);
      A.enterPlayoffs(G);
      let json = null, err = null;
      try { json = JSON.stringify(G); } catch (e) { err = e.message; }
      ok(json != null, `rules ${JSON.stringify(r)} → save serializes`, err);
      if (json) {
        const back = JSON.parse(json);
        ok(back.teams.length === G.teams.length, `  round-trips (${(json.length / 1024 / 1024).toFixed(1)}MB)`);
      }
    });
  },

  // A fantasy draft must leave every club with a playable roster and lose nobody.
  fantasy(A) {
    section("Fantasy draft");
    const G = A.newGame(0, { seed: 4, rules: { seasonLen: 54 } });
    const beforeMlb = G.teams.reduce((s, t) => s + A.rosterOf(G, t.id).length, 0);
    A.startFantasyDraft(G);
    ok(G.fantasyDraft != null, `draft started with ${G.fantasyDraft.pool.length} players pooled`);
    ok(G.teams.every(t => A.rosterOf(G, t.id).length === 0), "every big-league roster emptied");

    let guard = 0;
    while (G.fantasyDraft && !G.fantasyDraft.done && guard++ < 3000) {
      const c = A.fantasyOnClock(G.fantasyDraft);
      const pick = A.fantasyAIPick(G, c.teamId);
      if (pick == null) break;
      A.fantasyPick(G, pick);
    }
    ok(G.fantasyDraft == null, "draft ran to completion");

    const sizes = G.teams.map(t => A.rosterOf(G, t.id).length);
    ok(Math.min(...sizes) >= 20, `every club ended with a real roster (min ${Math.min(...sizes)})`);
    const short = G.teams.filter(t => {
      const r = A.rosterOf(G, t.id);
      return r.filter(p => !p.isP).length < 9 || r.filter(p => p.isP).length < 5;
    });
    ok(short.length === 0, "every club can field 9 hitters and 5 arms",
      short.length ? `${short.length} clubs came up short` : "");

    // nobody may be lost: drafted + free agents must account for the original pool
    const afterMlb = G.teams.reduce((s, t) => s + A.rosterOf(G, t.id).length, 0);
    ok(afterMlb + G.freeAgents.length >= beforeMlb, `no players vanished (${afterMlb} rostered + ${G.freeAgents.length} FA vs ${beforeMlb})`);

    // and the resulting league must actually play
    simRegularSeason(A, G);
    const w = G.teams.reduce((s, t) => s + t.w, 0), l = G.teams.reduce((s, t) => s + t.l, 0);
    ok(w === l && w > 0, `post-draft season plays out balanced (${w}/${l})`);
  },

  // Difficulty must actually move the dial it advertises.
  difficulty(A) {
    section("Difficulty presets");
    const run = d => {
      const G = A.newGame(0, { seed: 8, difficulty: d, rules: { seasonLen: 54 } });
      simRegularSeason(A, G);
      const injured = Object.values(G.players).filter(p => p.injury).length;
      return { G, injured };
    };
    const casual = run("casual"), hard = run("hardball");
    ok(casual.G.difficulty === "casual", "difficulty persists on the save");
    ok(hard.injured >= casual.injured, `hardball injures more (${hard.injured} vs ${casual.injured})`);
  },

  // Press conferences must fire, resolve cleanly, and respect their cooldown.
  flavor(A) {
    section("Personalities + press conferences");
    const G = A.newGame(0, { seed: 6, rules: { seasonLen: 108 } });
    // every player resolves to a real personality, deterministically
    const p = Object.values(G.players)[0];
    const a = A.personalityOf(p).label, b = A.personalityOf(p).label;
    ok(a === b && !!a, `personality is stable (${a})`);
    const spread = new Set(Object.values(G.players).slice(0, 400).map(x => A.personalityOf(x).label));
    ok(spread.size >= 4, `personalities vary across the league (${spread.size} distinct)`);

    // sim, answering every press conference that appears
    let asked = 0, guard = 0;
    while (G.day < G.schedule.length && guard++ < 400) {
      A.simDay(G);
      if (G.presser) {
        asked++;
        const before = G.teams[0].fanMood;
        A.answerPresser(G, 0);
        ok(G.presser == null, `  presser ${asked} cleared after answering`, "");
        if (asked > 3) break;
      }
    }
    ok(asked > 0, `press conferences fired during the season (${asked})`);
    const room = A.rosterOf(G, G.userTeamId);
    ok(room.every(x => x.morale == null || (x.morale >= 0 && x.morale <= 100)), "morale stayed in range");
    ok(G.teams[G.userTeamId].fanMood >= 20 && G.teams[G.userTeamId].fanMood <= 95, "fan mood stayed in range");
    ok(JSON.stringify(G).length > 0, "save still serializes with a presser system");
  },

  // A rule change staged mid-season must apply at the rollover, not before.
  pendingRules(A) {
    section("Structural rules stage until the rollover");
    const G = A.newGame(0, { seed: 21, rules: { seasonLen: 162 } });
    A.setRule(G, "seasonLen", 54);
    ok(A.rules(G).seasonLen === 162, "live rule unchanged mid-season");
    ok(G.pendingRules && G.pendingRules.seasonLen === 54, "change is staged");
    ok(A.ruleValue(G, "seasonLen") === 54, "UI reads the staged value");
    A.applyPendingRules(G);
    ok(A.rules(G).seasonLen === 54, "applied at the rollover");
    ok(!G.pendingRules, "staging cleared");

    // in-game rules apply immediately
    const G2 = A.newGame(0, { seed: 21 });
    A.setRule(G2, "mercy", 10);
    ok(A.rules(G2).mercy === 10, "non-structural rule applies immediately");
  },
};

/* ---------------------------------- main --------------------------------- */
const want = process.argv[2];
const app = loadGame();
console.log(`Pocket GM — Baseball · headless checks${want ? ` (${want})` : ""}`);
const names = want ? [want] : Object.keys(CHECKS);
for (const n of names) {
  if (!CHECKS[n]) { console.error(`unknown check "${n}" — have: ${Object.keys(CHECKS).join(", ")}`); process.exit(2); }
  CHECKS[n](app);
}
console.log(`\n${failures ? "\x1b[31m" : "\x1b[32m"}${checksRun - failures}/${checksRun} passed\x1b[0m`);
process.exit(failures ? 1 : 0);
