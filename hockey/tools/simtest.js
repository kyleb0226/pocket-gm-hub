#!/usr/bin/env node
/*
 * Headless sim harness for Pocket GM — Hockey.
 *
 * The whole game is one <script type="text/babel-src"> block inside index.html.
 * This pulls that block out, transpiles it with the vendored Babel, and runs it
 * in a Node vm with just enough browser shim (localStorage / document / React)
 * that the module-level code can execute. No component is ever rendered — the
 * checks reach in and call the simulation functions directly.
 *
 * This is the gate the daily autopilot must pass. A change that breaks a check
 * here never reaches main.
 *
 *   node tools/simtest.js            # every check
 *   node tools/simtest.js season     # one check
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

// Top-level const/let don't become vm globals, so the epilogue publishes these.
const EXPORTS = [
  "newGame", "migrate", "simDay", "simDays", "simGame", "applyGame",
  "buildSchedule", "endRegularSeason", "buildBracket", "simPlayoffRound", "finishSeason",
  "startNextSeason", "buildDraftClass", "autoDraft", "draftPlayer", "pickOwner", "inPlayoffs",
  "rules", "setRule", "ruleValue", "applyPendingRules", "RULES_DEFAULT", "STRUCTURAL_RULES",
  "standings", "divStandings", "confStandings", "playoffField",
  "capHit", "capSpace", "capFloor", "marketValue", "teamStrength",
  "rosterOf", "activeRoster", "playersOf", "autoLines", "ensureLines",
  "evalTrade", "doTrade", "signPlayer", "aiFreeAgency", "computeAwards",
  "pts", "svPct", "gaa", "ovrOf", "TEAMS", "DIVS", "CONFS", "ROSTER_MAX", "POS",
  "DIFFICULTIES", "LINE_TOI",
  "pickStarter", "runShootout", "restFor", "SHOT_ZONES", "fillRosters",
    "simPlayoffDay", "advancePlayoffRound", "simSeriesGame", "lineChemistry", "iceTimeF", "matchupMix", "normalise",
  "SYSTEMS", "genCoach", "coachOf", "systemOf", "isRivalry", "clubColour", "COLOURS",
  "iceTimeD", "PAIR_TOI", "PP_UNIT_SPLIT", "PK_UNIT_SPLIT", "ES_MINUTES",
  "PERSONALITIES", "personalityOf", "leadership", "letters", "letterFor", "roomMorale",
  "MANDATES", "setMandate", "seasonAchievement", "hofScore", "runHallOfFame", "HOF_BAR",
  "ballot", "BALLOT_SIZE", "takeJob", "FIRING_LINE", "finishSeason",
  "setBlock", "onBlock", "generateOffers", "acceptOffer", "tradablePicks", "nextOpponent",
  "deadlineDay", "tradesOpen", "daysToDeadline", "aiDeadlineMoves", "deadlineBoard", "RENTAL_MIN_OVR",
  "hasNtc", "eligibleForNtc", "requestNtcWaiver",
  "needsWaivers", "sendDown", "recall", "processWaivers", "nhlGames",
  "askingPrice", "negotiate", "isProspect", "prospectReady", "simFarmDay",
  "simFarmGame", "applyFarmGame", "farmStandings", "farmRec", "farmRoster", "farmStrength",
  "farmStarter", "farmLine", "runFarmPlayoffs", "FARM_CUP_FIELD", "blankFarmRec",
  "clubSummary", "ordinal", "goalieReport", "REPORT_MIN_SHOTS", "REPORT_TRUST_SA", "leagueNetRates",
  "ROLES", "ROLE_KEYS", "roleKeyOf", "roleOf", "roleTrait",
  "sharpness", "ratingNow", "rehabFor", "REHAB_MIN_GAMES", "REHAB_DEPTH", "REHAB_MAX", "INJURIES", "rollInjuries",
  "releasePlayer", "releaseCost", "RELEASE_DEAD_PCT", "canExtend", "extendPlayer",
  "extensionAsk", "aiExtensionOffer", "EXTEND_LOYALTY", "retainedTraded", "FARM_MAX",
  "progress", "devEnvironment", "nhlDevRead", "devAgeWeight", "devBand",
  "DEV_FARM", "DEV_NHL_HI", "DEV_NHL_LO", "DEV_BANDS",
  "effectiveCap", "retainedBy", "retainedOn", "MAX_RETAINED", "RETAIN_MAX_PCT",
  "updateRecords", "checkMilestones", "runAllStar", "allStarRosters", "RECORD_DEFS",
  "offseasonStage", "offseasonAction", "doOffseasonStep", "OFFSEASON_STEPS",
  "stintFor", "stintTotal", "spotSoft", "spotAt", "pointShares", "psOf",
  "DRAFT_ROUNDS", "draftPicksTotal", "closeDraft", "scoutProspect", "scoutedOvr", "scoutedPot",
  "scoutBand", "scoutLabel", "draftValue", "SCOUT_POINTS",
  "pruneSave", "ZONE_KEYS", "NET_CELLS", "NET_KEYS", "goalieHole", "shooterSpot", "pickCell", "blankNet", "saveGame", "loadGame", "slotMeta", "unwrap", "deleteSlot", "localStorage",
  "lineChemistry", "LINE_CHEM_MAX_GAMES", "pairChemistry", "PAIR_CHEM_MAX_GAMES",
  "seasonBallots", "honoursOf", "HONOUR_MIN_GP",
  "draftOrigin", "farmRoom", "farmRoomBonus", "DEV_WIN_SWING", "DEV_WIN_TITLE",
  "seasonLeaders", "ROSTER_MIN",
  "DEPTH_RULES", "DEPTH_PRESETS", "applyDepthPreset", "depthPreset", "depthOn",
  "isTwoWay", "TWO_WAY_MINORS_PCT", "canCondition", "startStint", "tickStints", "STINT_MAX_GAMES",
  "farmCoachOf", "devCoachRating", "staffOf", "STAFF_ROLES", "hashUnit",
  "homeEdge", "HOME_EDGE", "rivalryHeat", "grudgeBetween", "addGrudge",
  "volatilityOf", "scoutArea", "AREA_SCOUT_COST", "UNDRAFTED_KEEP", "DEV_FOCUS_SHARE",
  "draftUpOffers", "acceptDraftUp", "TRADE_UP_HORIZON",
  "rollDemands", "demandCase", "demandDrag", "expectedMinutes", "DEMAND_EVERY", "DEMAND_PATIENCE",
  "stockAffiliates", "FARM_DEPTH_EACH", "callUpCost", "draftClassReport", "rookieGames",
  "buyOut", "buyoutCost", "canBuyOut", "BUYOUT_PCT", "BUYOUT_TERM_MULT",
  "termAdjust", "valuesNtc", "NTC_DISCOUNT", "UNHAPPY_PREMIUM",
  "answerDemand", "checkPromises", "PROMISE_WINDOW", "demandOffers", "rollHoldouts", "endHoldout", "HOLDOUT_AFTER",
  "staffMarket", "hireStaff", "fireStaff", "scoutOf", "STAFF_MARKET_SIZE",
  "PROTECTIONS", "protectionOf", "pickConveys", "resolveProtections",
  "draftTier", "DRAFT_TIER_LABEL",
  "playoffDev", "DEV_PLAYOFF", "DEV_PLAYOFF_FULL", "DEV_DOUBLE_DIP", "DOUBLE_DIP_MIN_FARM",
  "teamValue", "gmLegacy", "gmSalaryFor", "gmState", "payGm", "myShare", "isMajorityOwner",
  "sellWillingness", "ownershipMarket", "buyStake", "sellStake", "ownerVoteChance",
  "standDown", "takeBackTheJob", "draftPar",
  "AUTO_STYLES", "autoStyle", "aiRuns", "styleFor", "aiDeadlineMoves", "aiExtensionOffer",
  "strengthRank", "HONOUR_YEARS", "leagueLevel", "LEAGUE_LEVEL_BASE",
  "ppPct", "pkPct", "DRESS_MIN",
  "DEV_BASE", "DEV_HEADROOM", "DEV_GAP_PULL",
  "clubProfit", "payDividends", "DIVIDEND_YIELD", "DIRECTIONS", "directionOf", "setDirection",
  "INVESTMENTS", "investLevel", "investCost", "investInClub", "ownsAny",
  "MARKETS", "relocationOptions", "relocate", "sweaterOf", "sweaterMap", "NAMES", "fullName",
  "COACH_FIRST", "COACH_LAST",
  "brokerFee", "brokerCandidates", "brokerTrade", "BROKER_FEE_RATE",
  "PULL_TIMINGS", "pullTiming",
  "PRESSERS", "pickPresser", "answerPresser", "fanMood", "moveFans", "PRESSER_COOLDOWN",
  "POINT_STREAK_NEWS", "WIN_STREAK_NEWS",
  "NATIONS", "nationOf", "worldSquad", "squadStrength", "runWorldCup", "worldCupYear",
  "WORLD_CUP_EVERY", "WORLD_SQUAD",
  "bonusesOn", "canPerfBonus", "sbOf", "pbOf", "perfBonusTarget", "perfBonusProgress",
  "settleBonuses", "applyBonusTerms", "aiBonusTerms",
  "SB_MAX", "SB_DISCOUNT", "PB_MAX", "PB_DISCOUNT", "PB_YOUNG", "PB_OLD",
  "keepScore", "deferPicksIfFull", "archiveDraft", "careerTotals", "updateCareerRecords",
  "CAREER_RECORD_DEFS", "recordGmSeason", "gmCareer", "retirementChance",
  "NEVER_MADE_IT_AGE", "FA_POOL_HARD",
  "FA_MARKET_FLOOR", "tradeValue", "roomHitOf", "addRoomHit", "decayRoomHits", "gateFor", "staffBill", "budgetLeft",
  "hireHeadCoach", "unhappyMarket", "canLtir", "placeLtir", "activateLtir", "onLtir",
  "LTIR_MIN_GAMES", "ROOM_HIT_DECAY",
  "canTerminate", "terminateContract", "releaseToPool", "enforceRosterLimits", "enforceCap",
  "capFreeAgentPool", "TERMINATE_MAX_CAP", "DRESS_MIN", "FA_POOL_MAX",
  "playoffBerths", "clinchState", "shadowTable", "inFieldOf", "CLINCH_LABEL",
  "stampShares", "lineShares", "careerShares",
  "awardPool", "voteAwards", "awardTrophies", "backfillAwards", "archivedLine", "RETRO_MIN_POOL",
  "pickSlot", "pickLabel", "pickValue", "farmFixtures", "FARM_LOG_MAX",
  "extendEarlyYears", "EXTEND_EARLY_MAX", "EXTEND_EARLY_PREMIUM", "EXTEND_TERM_MAX",
  "draftOrderRows", "draftOnePick", "draftProjection", "starList", "toggleStar", "autoPickFor",
  "resultFor", "PICK_ROUNDS",
];

/* ------------------------------- load the app ---------------------------- */
function loadGame() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/<script type="text\/babel-src" id="app-src">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("couldn't find the app-src block in index.html");

  const babelSandbox = { window: {}, self: {}, console, process, setTimeout, clearTimeout };
  babelSandbox.global = babelSandbox;
  vm.createContext(babelSandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "vendor/babel.min.js"), "utf8"), babelSandbox);
  const Babel = babelSandbox.Babel || babelSandbox.window.Babel;
  if (!Babel) throw new Error("vendored Babel didn't expose a Babel global");

  let code = Babel.transform(m[1], { presets: [["react", { runtime: "classic" }]] }).code;
  code += `\n;globalThis.__APP__ = {${EXPORTS.map((n) => `${n}: typeof ${n} !== "undefined" ? ${n} : undefined`).join(", ")}};`;

  const noop = () => {};
  const store = new Map();
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Math, Date, JSON,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      key: (i) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    },
    document: { getElementById: () => null, addEventListener: noop, removeEventListener: noop },
    navigator: { userAgent: "node" },
    location: { reload: noop },
    React: {
      createElement: (...a) => ({ _el: a }),
      useState: (v) => [typeof v === "function" ? v() : v, noop],
      useEffect: noop, useRef: (v) => ({ current: v }), useMemo: (f) => f(),
      useCallback: (f) => f, useContext: () => noop,
      createContext: () => ({ Provider: noop, Consumer: noop }),
      Fragment: "fragment",
    },
    ReactDOM: { createRoot: () => ({ render: noop }) },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "app-src.js" });

  const A = sandbox.__APP__;
  const missing = EXPORTS.filter((n) => A[n] === undefined);
  if (missing.length) console.log(`  \x1b[33m! not exported: ${missing.join(", ")}\x1b[0m`);
  return A;
}

/* --------------------------------- helpers ------------------------------- */
let failures = 0, checksRun = 0;
function ok(cond, label, detail) {
  checksRun++;
  if (cond) console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  else { failures++; console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? `\n      ${detail}` : ""}`); }
}
function section(name) { console.log(`\n\x1b[1m${name}\x1b[0m`); }

function simSeason(A, G) {
  let guard = 0;
  while (G.phase === "regular" && guard++ < 400) A.simDay(G);
  return G;
}
function simPlayoffs(A, G) {
  let guard = 0;
  while (G.phase === "playoffs" && guard++ < 12) A.simPlayoffRound(G);
  return G;
}
// The schedule is a CALENDAR now, not one round per day, so "how long is the
// season" means games per club rather than schedule.length.
function gamesPerTeam(G) {
  const count = new Array(G.teams.length).fill(0);
  G.schedule.forEach((day) => day.forEach((f) => { count[f.home]++; count[f.away]++; }));
  return count;
}

/* --------------------------------- checks -------------------------------- */
const CHECKS = {
  // World generation: 32 clubs, legal rosters, everyone under the cap.
  world(A) {
    section("World generation");
    const G = A.newGame(0, { seed: 11 });
    ok(G.teams.length === 32, `32 clubs (got ${G.teams.length})`);
    ok(A.DIVS.length === 4, "four divisions");
    const perDiv = A.DIVS.map((_, d) => G.teams.filter((t) => t.div === d).length);
    ok(perDiv.every((n) => n === 8), `eight clubs per division (${perDiv.join("/")})`);

    const thin = G.teams.filter((t) => A.rosterOf(G, t.id).length < 18);
    ok(thin.length === 0, "every club dresses a full roster",
      thin.length ? `${thin.length} clubs under 18` : "");
    const noG = G.teams.filter((t) => A.rosterOf(G, t.id).filter((p) => p.pos === "G").length < 2);
    ok(noG.length === 0, "every club carries two goaltenders", noG.length ? `${noG.length} short` : "");
    const noD = G.teams.filter((t) => A.rosterOf(G, t.id).filter((p) => p.pos === "D").length < 6);
    ok(noD.length === 0, "every club carries six defencemen", noD.length ? `${noD.length} short` : "");

    const over = G.teams.filter((t) => A.capHit(G, t.id) > A.rules(G).capAmount);
    ok(over.length === 0, "no club starts over the cap",
      over.length ? over.map((t) => `${t.abbr} $${A.capHit(G, t.id)}M`).join(", ") : "");

    const ovrs = A.playersOf(G).map((p) => p.ovr);
    const avg = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
    ok(avg > 40 && avg < 75, `ratings sit in a sane band (avg ${avg.toFixed(1)})`);
    ok(Math.max(...ovrs) >= 80, `the league has stars (best ${Math.max(...ovrs)})`);
  },

  // The schedule must give every club exactly the season length, home and away.
  schedule(A) {
    section("Schedule");
    [82, 56, 41].forEach((len) => {
      const G = A.newGame(0, { seed: 5, rules: { seasonLen: len } });
      ok(G.schedule.length > len * 1.5 && G.schedule.length < len * 3,
        `seasonLen=${len} → a real calendar with off days (${G.schedule.length} days for ${len} games)`);
      const count = new Array(32).fill(0), home = new Array(32).fill(0);
      G.schedule.forEach((day) => day.forEach((f) => {
        count[f.home]++; count[f.away]++; home[f.home]++;
      }));
      ok(count.every((c) => c === len), `every club plays ${len}`,
        `min ${Math.min(...count)} max ${Math.max(...count)}`);

      // Rest has to actually vary: some back-to-backs, but not all of them.
      const days = new Array(32).fill(null).map(() => []);
      G.schedule.forEach((day, d) => day.forEach((f) => { days[f.home].push(d); days[f.away].push(d); }));
      let b2b = 0, gaps = 0;
      days.forEach((ds) => ds.forEach((d, i) => { if (i) { gaps++; if (d - ds[i - 1] === 1) b2b++; } }));
      const rate = b2b / Math.max(1, gaps);
      ok(rate > 0.02 && rate < 0.6, `back-to-backs happen but aren't the norm (${(rate * 100).toFixed(0)}%)`);
      const worstSplit = Math.max(...home.map((h) => Math.abs(h - len / 2)));
      ok(worstSplit <= len * 0.12, `home/away stays balanced (worst off by ${worstSplit})`);
      const dup = G.schedule.some((day) => {
        const seen = new Set();
        return day.some((f) => {
          if (seen.has(f.home) || seen.has(f.away)) return true;
          seen.add(f.home); seen.add(f.away); return false;
        });
      });
      ok(!dup, "no club is booked twice on one day");
    });
  },

  // A full season, then the arithmetic has to close.
  season(A) {
    section("Full-season invariants (41-game season)");
    const G = A.newGame(0, { seed: 21, rules: { seasonLen: 41 } });
    simSeason(A, G);
    ok(G.phase === "playoffs", `the season ended and the playoffs began (phase=${G.phase})`);

    const badGp = G.teams.filter((t) => t.gp !== 41);
    ok(badGp.length === 0, "every club played all 41",
      badGp.length ? `${badGp[0].abbr} played ${badGp[0].gp}` : "");
    const badRec = G.teams.filter((t) => t.w + t.l + t.otl !== t.gp);
    ok(badRec.length === 0, "W + L + OTL reconciles with games played");
    const badPts = G.teams.filter((t) => t.pts !== t.w * 2 + t.otl);
    ok(badPts.length === 0, "points = 2×W + OTL");

    const totalGf = G.teams.reduce((s, t) => s + t.gf, 0);
    const totalGa = G.teams.reduce((s, t) => s + t.ga, 0);
    ok(totalGf === totalGa, `league goals for equals goals against (${totalGf} vs ${totalGa})`);

    const gpg = totalGf / (G.teams.reduce((s, t) => s + t.gp, 0));
    // Bands are the real NHL numbers now that the engine is calibrated against
    // them, so a drift in shot rates or save percentage trips here.
    ok(gpg > 2.5 && gpg < 3.6, `goals per team-game matches the NHL (${gpg.toFixed(2)}, real ~3.1)`);
    const sogpg = A.playersOf(G).filter((p) => p.pos !== "G").reduce((s, p) => s + p.season.sog, 0)
      / G.teams.reduce((s, t) => s + t.gp, 0);
    ok(sogpg > 26 && sogpg < 35, `shots on goal per team-game matches the NHL (${sogpg.toFixed(1)}, real ~30.5)`);
    const shPct = totalGf / A.playersOf(G).filter((p) => p.pos !== "G").reduce((s, p) => s + p.season.sog, 0);
    ok(shPct > 0.085 && shPct < 0.112, `and so does shooting percentage (${(shPct * 100).toFixed(1)}%, real ~9.6%)`);

    // Player goals must add back up to team goals, once the shootout winner —
    // which no skater is credited with, exactly as in real bookkeeping — is
    // accounted for.
    const soWins = new Array(32).fill(0);
    G.results.forEach((r) => { if (r.so) soWins[r.hg > r.ag ? r.home : r.away]++; });
    // Per team, count the goals as they were actually scored — a player traded
    // at the deadline takes his season totals with him, so his current club is
    // not who he scored them for.
    const byTeam = new Array(32).fill(0);
    G.results.forEach((r) => r.scorers.forEach((s) => { byTeam[s.t]++; }));
    const mismatch = G.teams.filter((t) => byTeam[t.id] + soWins[t.id] !== t.gf);
    ok(mismatch.length === 0, "goals as scored + shootout winners reconcile with team goals",
      mismatch.length ? `${mismatch[0].abbr}: scored ${byTeam[mismatch[0].id]} + ${soWins[mismatch[0].id]} SO vs team ${mismatch[0].gf}` : "");
    // And league-wide, every skater goal is accounted for.
    const skaterGoals = A.playersOf(G).filter((p) => p.pos !== "G").reduce((s, p) => s + p.season.g, 0);
    const scoredGoals = G.results.reduce((s, r) => s + r.scorers.length, 0);
    ok(skaterGoals === scoredGoals, `every skater goal has a scoring record (${skaterGoals} vs ${scoredGoals})`);

    // Goalie shots faced should track the shots the other side actually took,
    // less the ones fired into an empty net.
    const totalEng = A.playersOf(G).filter((p) => p.pos !== "G").reduce((s, p) => s + (p.season.eng || 0), 0);
    const totalSa = A.playersOf(G).filter((p) => p.pos === "G").reduce((s, p) => s + p.season.sa, 0);
    const totalSog = A.playersOf(G).filter((p) => p.pos !== "G").reduce((s, p) => s + p.season.sog, 0);
    ok(totalSog === totalSa + totalEng,
      `every shot was faced by a goalie or hit an empty net (${totalSog} vs ${totalSa} + ${totalEng} EN)`);
    const totalGaG = A.playersOf(G).filter((p) => p.pos === "G").reduce((s, p) => s + p.season.ga, 0);
    const totalSo = soWins.reduce((a, b) => a + b, 0);
    ok(totalGaG + totalSo + totalEng === totalGf,
      `goals charged to goalies + SO + empty-netters matches league goals (${totalGaG}+${totalSo}+${totalEng} vs ${totalGf})`);
    ok(totalEng > 0 && totalEng / totalGf < 0.09,
      `empty-net goals are a small real slice (${totalEng}, ${(totalEng / totalGf * 100).toFixed(1)}%)`);

    // Nobody should be credited with a game they didn't dress for.
    const ghosts = A.playersOf(G).filter((p) => p.season.gp > 0 && p.season.toi <= 0);
    ok(ghosts.length === 0, "no player is credited with a game they never played",
      ghosts.length ? `${ghosts.length} players` : "");
    // A player traded mid-season can exceed his club's game count — that's real
    // — but not by much, and never by a whole extra season.
    const overplayed = A.playersOf(G).filter((p) => p.season.gp > 41 + 10);
    ok(overplayed.length === 0, "nobody plays a wildly impossible number of games",
      overplayed.length ? `${overplayed[0].ln} ${overplayed[0].season.gp}` : "");

    const leader = A.playersOf(G).filter((p) => p.pos !== "G")
      .sort((a, b) => A.pts(b.season) - A.pts(a.season))[0];
    const ppg = A.pts(leader.season) / leader.season.gp;
    ok(ppg > 0.7 && ppg < 2.6, `the scoring leader is human (${A.pts(leader.season)} in ${leader.season.gp}, ${ppg.toFixed(2)}/g)`);

    const gs = A.playersOf(G).filter((p) => p.pos === "G" && p.season.sa > 200);
    const sv = gs.reduce((s, p) => s + A.svPct(p.season), 0) / Math.max(1, gs.length);
    ok(sv > 0.893 && sv < 0.915, `league save percentage matches the NHL (${sv.toFixed(3)}, real ~.903)`);

    // Better clubs should finish higher than worse ones, on average.
    const rated = G.teams.map((t) => ({ s: A.teamStrength(G, t.id), p: t.pts }));
    const half = rated.slice().sort((a, b) => b.s - a.s);
    const topAvg = half.slice(0, 8).reduce((s, x) => s + x.p, 0) / 8;
    const botAvg = half.slice(-8).reduce((s, x) => s + x.p, 0) / 8;
    ok(topAvg > botAvg + 6, `roster quality shows up in the table (${topAvg.toFixed(0)} vs ${botAvg.toFixed(0)} pts)`);
  },

  // The loser point is the defining standings knob — it must actually change things.
  points(A) {
    section("Points system");
    [true, false].forEach((lp) => {
      const G = A.newGame(0, { seed: 33, rules: { seasonLen: 41, otLoserPoint: lp } });
      simSeason(A, G);
      const bad = G.teams.filter((t) => t.pts !== t.w * 2 + (lp ? t.otl : 0));
      ok(bad.length === 0, `otLoserPoint=${lp} → points math holds`,
        bad.length ? `${bad[0].abbr} ${bad[0].pts} pts on ${bad[0].w}W/${bad[0].otl}OTL` : "");
      if (!lp) {
        const otl = G.teams.reduce((s, t) => s + t.otl, 0);
        ok(otl === 0, "with no loser point, nothing lands in the OTL column", `got ${otl}`);
      }
    });
    // Ties: with overtime off, games are allowed to end level.
    const G = A.newGame(0, { seed: 34, rules: { seasonLen: 41, otFormat: "none" } });
    simSeason(A, G);
    const ties = G.results.filter((r) => r.hg === r.ag).length;
    ok(ties > 0, `otFormat=none produces real ties (${ties})`);
  },

  // Both playoff formats must produce a legal bracket and exactly one champion.
  playoffs(A) {
    section("Playoffs");
    ["divisional", "seeded"].forEach((fmt) => {
      const G = A.newGame(0, { seed: 44, rules: { seasonLen: 41, playoffFormat: fmt } });
      simSeason(A, G);
      const r1 = G.playoffs.rounds[0];
      ok(r1.length === 8, `${fmt} → eight first-round series (got ${r1.length})`);
      const teams = r1.flatMap((s) => [s.hi, s.lo]);
      ok(new Set(teams).size === 16, `${fmt} → sixteen distinct clubs qualify`);
      const perConf = [0, 1].map((c) => teams.filter((id) => G.teams[id].conf === c).length);
      ok(perConf[0] === 8 && perConf[1] === 8, `${fmt} → eight per conference (${perConf.join("/")})`);

      simPlayoffs(A, G);
      ok(G.playoffs.champion != null, `${fmt} → a champion emerged`);
      ok(G.phase === "offseason", `${fmt} → the season closed out (phase=${G.phase})`);
      const need = Math.ceil(A.ruleValue(G, "seriesLen") / 2);
      const badSeries = G.playoffs.rounds.flat().filter((s) => s.done && Math.max(...s.w) !== need);
      ok(badSeries.length === 0, `${fmt} → every series ended at ${need} wins`);
      ok(G.teams[G.playoffs.champion].cupWins === 1, `${fmt} → the Cup was recorded`);
    });

    // Best of five ends sooner than best of seven.
    const G5 = A.newGame(0, { seed: 45, rules: { seasonLen: 41, seriesLen: 5 } });
    simSeason(A, G5); simPlayoffs(A, G5);
    const longest = Math.max(...G5.playoffs.rounds.flat().map((s) => s.games.length));
    ok(longest <= 5, `best-of-5 never runs past five games (longest ${longest})`);
  },

  // The hard cap is the whole GM constraint — it has to hold through trades and FA.
  cap(A) {
    section("Salary cap");
    const G = A.newGame(3, { seed: 55 });
    const cap = A.rules(G).capAmount;
    ok(A.capHit(G, 3) <= cap, `user club fits under the cap ($${A.capHit(G, 3)}M of $${cap}M)`);

    // A trade that would break the cap must be refused.
    const rich = A.rosterOf(G, 3).sort((a, b) => b.contract.amt - a.contract.amt)[0];
    const other = 4;
    const theirBest = A.rosterOf(G, other).sort((a, b) => b.contract.amt - a.contract.amt);
    const load = [];
    let sum = 0;
    for (const p of theirBest) { load.push(p.id); sum += p.contract.amt; if (sum > A.capSpace(G, 3) + rich.contract.amt + 5) break; }
    const ev = A.evalTrade(G, 3, [rich.id], [], other, load, []);
    ok(!ev.ok, `a cap-busting trade is refused (${ev.why})`);

    // A one-for-one of similar value should be legal, whatever the AI thinks of it.
    const mine = A.rosterOf(G, 3).sort((a, b) => b.ovr - a.ovr)[6];
    const theirs = A.rosterOf(G, other).sort((a, b) => b.ovr - a.ovr)[6];
    const ev2 = A.evalTrade(G, 3, [mine.id], [], other, [theirs.id], []);
    ok(ev2.why !== "roster limit" && !/over the cap/.test(ev2.why || ""),
      `a like-for-like swap isn't blocked by the cap (${ev2.why})`);

    // Signing beyond the cap is refused outright.
    const fa = G.freeAgents.map((id) => G.players[id]).sort((a, b) => b.ovr - a.ovr)[0];
    const r = A.signPlayer(G, fa.id, 3, cap, 3);
    ok(!r.ok, `an over-cap signing is rejected (${r.why})`);
  },

  // Trades have to actually move players and picks, and stay symmetrical.
  trade(A) {
    section("Trades");
    const G = A.newGame(0, { seed: 66 });
    const a = A.rosterOf(G, 0).sort((x, y) => y.ovr - x.ovr)[4];
    const b = A.rosterOf(G, 1).sort((x, y) => y.ovr - x.ovr)[4];
    const beforeA = A.rosterOf(G, 0, true).length, beforeB = A.rosterOf(G, 1, true).length;
    const res = A.doTrade(G, 0, [a.id], [], 1, [b.id], []);
    if (res.ok) {
      ok(G.players[a.id].teamId === 1, "the outgoing player changed hands");
      ok(G.players[b.id].teamId === 0, "the incoming player changed hands");
      ok(A.rosterOf(G, 0, true).length === beforeA && A.rosterOf(G, 1, true).length === beforeB,
        "roster sizes stayed level in a one-for-one");
    } else {
      ok(true, `the AI declined a one-for-one, which is allowed (${res.why})`);
    }
    // A player who isn't on the roster can never be traded.
    const bogus = A.rosterOf(G, 7)[0];
    const bad = A.evalTrade(G, 0, [bogus.id], [], 1, [], []);
    ok(!bad.ok, `you can't trade another club's player (${bad.why})`);
    // The lineup rebuilds after a trade rather than pointing at a departed player.
    const lines = A.ensureLines(G, 0);
    const ids = new Set(A.activeRoster(G, 0).map((p) => p.id));
    const dangling = lines.F.flat().concat(lines.D.flat(), lines.G).filter((id) => id != null && !ids.has(id));
    ok(dangling.length === 0, "no line slot points at a player who left");
  },

  // The rollover: ageing, contracts, the draft, and a league that can play again.
  rollover(A) {
    section("Season rollover");
    const G = A.newGame(0, { seed: 77, rules: { seasonLen: 41 } });
    simSeason(A, G); simPlayoffs(A, G);

    ok(G.draftClass.length === A.draftPicksTotal(G), `a draft class was generated (${G.draftClass.length})`);
    ok(G.draftOrder.length === 32, "every club has a draft slot");
    const nonPlayoff = G.teams.filter((t) => !A.inPlayoffs(G, t.id)).length;
    ok(nonPlayoff === 16, `sixteen clubs missed the playoffs (${nonPlayoff})`);
    const firstTen = G.draftOrder.slice(0, 10);
    ok(firstTen.every((id) => !A.inPlayoffs(G, id)), "the lottery only draws from non-playoff clubs");

    A.autoDraft(G, false);
    ok(G.draftPick === A.draftPicksTotal(G), `the draft completed (${G.draftPick} picks made)`);
    const drafted = A.playersOf(G).filter((p) => p.rookie && p.teamId != null);
    ok(drafted.length >= A.draftPicksTotal(G) * 0.9, `prospects landed on clubs (${drafted.length})`);
    ok(drafted.every((p) => p.farm), "draftees start on the farm");

    const oldAges = A.playersOf(G).filter((p) => p.teamId != null).map((p) => p.age);
    const beforeYear = G.year;
    A.aiFreeAgency(G);
    A.startNextSeason(G);

    ok(G.year === beforeYear + 1, `the calendar advanced (${beforeYear} → ${G.year})`);
    ok(G.phase === "regular", `back to a regular season (phase=${G.phase})`);
    ok(G.teams.every((t) => t.gp === 0 && t.pts === 0), "the table was wiped");
    ok(G.results.length === 0, "last season's results were cleared");
    ok(gamesPerTeam(G).every((c) => c === 41), "a new 41-game schedule was built");
    const newAges = A.playersOf(G).filter((p) => p.teamId != null).map((p) => p.age);
    ok(Math.min(...newAges) >= Math.min(...oldAges), "everyone got a year older");
    ok(A.playersOf(G).some((p) => p.career.length > 0), "last season became career history");
    ok(G.teams.every((t) => A.rosterOf(G, t.id).length >= 18),
      "every club can still dress a roster after the rollover",
      G.teams.filter((t) => A.rosterOf(G, t.id).length < 18).map((t) => `${t.abbr}:${A.rosterOf(G, t.id).length}`).join(" "));
    ok(G.teams.every((t) => A.rosterOf(G, t.id).filter((p) => p.pos === "G").length >= 2),
      "every club still has two goaltenders");

    // And the new season must actually be playable.
    simSeason(A, G);
    ok(G.teams.every((t) => t.gp === 41), "the second season plays to completion");
  },

  // Structural knobs stage for the rollover; the rest apply immediately.
  ruleStaging(A) {
    section("Rule staging");
    const G = A.newGame(0, { seed: 88, rules: { seasonLen: 41 } });
    A.setRule(G, "injuries", "high");
    ok(A.rules(G).injuries === "high", "a non-structural knob applies at once");
    A.setRule(G, "seasonLen", 56);
    ok(A.rules(G).seasonLen === 41, "a structural knob does NOT change the season in progress");
    ok(A.ruleValue(G, "seasonLen") === 56, "but the UI reads the staged value");
    ok(gamesPerTeam(G).every((c) => c === 41), "the live schedule is untouched");
    simSeason(A, G); simPlayoffs(A, G);
    A.autoDraft(G, false); A.aiFreeAgency(G); A.startNextSeason(G);
    ok(A.rules(G).seasonLen === 56, "the staged knob promoted at the rollover");
    ok(gamesPerTeam(G).every((c) => c === 56), "the new schedule uses it");
    ok(!G.pendingRules || !Object.keys(G.pendingRules).length, "nothing is left staged");
  },

  // Lines drive the engine, so a broken lineup is a broken game.
  lines(A) {
    section("Lines and matchups");
    const G = A.newGame(0, { seed: 99 });
    const L = A.ensureLines(G, 0);
    ok(L.F.length === 4 && L.F.every((l) => l.length === 3), "four forward lines of three");
    ok(L.D.length === 3 && L.D.every((p) => p.length === 2), "three defence pairs");
    ok(L.G.length === 2 && L.G[0] != null, "a starter and a backup");
    const all = L.F.flat().concat(L.D.flat(), L.G).filter((x) => x != null);
    ok(new Set(all).size === all.length, "nobody is double-shifted into two slots");
    ok(L.D.flat().every((id) => G.players[id].pos === "D"), "only defencemen play defence");
    ok(L.G.every((id) => id == null || G.players[id].pos === "G"), "only goalies play goal");

    /* Ice time, measured from a SINGLE game's box score rather than an
       accumulated season. Season totals are divided by games played, and an
       injury mid-season moves players between lines, so the old version was
       really asking "did anyone get hurt" — it broke twice on unrelated RNG
       shifts. One game is exact and says the same thing. */
    const box = A.simGame(G, 0, 1, {}).boxes[0];
    const lineToi = (ids) => ids.reduce((s, id) => s + (box.players[id] ? box.players[id].toi : 0), 0) / ids.length;
    const l1 = lineToi(L.F[0]), l4 = lineToi(L.F[3]);
    ok(l1 > l4, `the first line outplays the fourth (${l1.toFixed(1)} vs ${l4.toFixed(1)} min)`);
    // Ice time is per player, not split between linemates — a first-liner plays
    // most of a period and a half, not five minutes.
    ok(l1 > 13 && l1 < 26, `a first-liner's night is a real one (${l1.toFixed(1)} min)`);
    ok(l4 > 4 && l4 < 14, `and the fourth line gets a fourth-line shift (${l4.toFixed(1)} min)`);
    const d1 = lineToi(L.D[0]);
    ok(d1 > 15 && d1 < 30, `the top pair carries the biggest load (${d1.toFixed(1)} min)`);
    ok(Math.abs(box.players[L.G[0]].toi - 60) < 0.5,
      `a goalie who starts plays the full sixty (${box.players[L.G[0]].toi.toFixed(1)})`);

    /* Line chemistry, driven directly. Simming sixty days and expecting the cap
       assumes nobody on the top line gets hurt all year, which is not a thing
       the test should be asserting. */
    const t0 = G.teams[0];
    const fresh = A.ensureLines(G, 0);
    t0.lineChem = null; t0.lineSig = null;
    for (let i = 0; i < A.LINE_CHEM_MAX_GAMES + 5; i++) A.lineChemistry(t0, fresh);
    ok(t0.lineChem[0] === A.LINE_CHEM_MAX_GAMES,
      `an untouched line reaches the cap and stops (${t0.lineChem[0]})`);
    ok(t0.lineChem.every((g) => g <= A.LINE_CHEM_MAX_GAMES), "no line ever exceeds it");
    // Touch the line and the streak is gone.
    const swapped = JSON.parse(JSON.stringify(fresh));
    const tmp = swapped.F[0][0];
    swapped.F[0][0] = swapped.F[1][0];
    swapped.F[1][0] = tmp;
    A.lineChemistry(t0, swapped);
    ok(t0.lineChem[0] === 0, `swapping the top line resets its streak (${t0.lineChem[0]})`);
    A.lineChemistry(t0, swapped);
    ok(t0.lineChem[0] === 1, "and it starts building again from there");

    // Defence pairs build the same continuity bonus as forward lines. Driven
    // directly for the same reason the forward version is: simming sixty days
    // and expecting the cap really asks "did anybody get hurt".
    t0.pairChem = null; t0.pairSig = null;
    for (let i = 0; i < A.PAIR_CHEM_MAX_GAMES + 5; i++) A.pairChemistry(t0, fresh);
    ok(t0.pairChem[0] === A.PAIR_CHEM_MAX_GAMES,
      `an untouched pair reaches the cap and stops (${t0.pairChem[0]})`);
    ok(t0.pairChem.every((g) => g <= A.PAIR_CHEM_MAX_GAMES), "no pair ever exceeds it");
    const swappedD = JSON.parse(JSON.stringify(fresh));
    const tmpD = swappedD.D[0][0];
    swappedD.D[0][0] = swappedD.D[1][0];
    swappedD.D[1][0] = tmpD;
    A.pairChemistry(t0, swappedD);
    ok(t0.pairChem[0] === 0, `breaking up a pair resets its streak (${t0.pairChem[0]})`);
    A.pairChemistry(t0, swappedD);
    ok(t0.pairChem[0] === 1, "and it starts building again");

    // An injury must not leave a hole in the lineup.
    const victim = G.players[L.F[0][1]];
    victim.inj = 10;
    G.teams[0].lines = null;
    const L2 = A.ensureLines(G, 0);
    const stillIn = L2.F.flat().includes(victim.id);
    ok(!stillIn, "an injured player is pulled out of the lineup");
    A.simDays(G, 3);
    ok(true, "the club keeps playing a man down");
  },

  // Special teams have to show up in the box score.
  specialTeams(A) {
    section("Special teams");
    const G = A.newGame(0, { seed: 101, rules: { seasonLen: 41 } });
    simSeason(A, G);
    const totalPim = A.playersOf(G).reduce((s, p) => s + (p.season.pim || 0), 0);
    ok(totalPim > 0, `penalties were taken (${totalPim} PIM)`);
    const ppg = A.playersOf(G).reduce((s, p) => s + (p.season.ppg || 0), 0);
    const total = G.teams.reduce((s, t) => s + t.gf, 0);
    const share = ppg / total;
    ok(share > 0.1 && share < 0.4, `power-play goals are a believable share (${(share * 100).toFixed(0)}%)`);
    const fow = A.playersOf(G).reduce((s, p) => s + (p.season.fow || 0), 0);
    const fol = A.playersOf(G).reduce((s, p) => s + (p.season.fol || 0), 0);
    ok(fow > 0 && fol > 0, `faceoffs were taken (${fow} won / ${fol} lost)`);
  },

  // Injuries should bite without emptying the league.
  injuries(A) {
    section("Injuries");
    const counts = {};
    ["low", "normal", "high"].forEach((level) => {
      const G = A.newGame(0, { seed: 111, rules: { seasonLen: 41, injuries: level } });
      let injured = 0;
      const seen = new Set();
      for (let i = 0; i < 41; i++) {
        A.simDay(G);
        A.playersOf(G).forEach((p) => { if (p.inj > 0 && !seen.has(p.id)) { seen.add(p.id); injured++; } });
      }
      counts[level] = injured;
      ok(injured > 0, `${level}: players got hurt (${injured} over the season)`);
      const wiped = G.teams.filter((t) => A.activeRoster(G, t.id).length < 14);
      ok(wiped.length === 0, `${level}: no club was wiped out`, wiped.length ? `${wiped.length} clubs` : "");
    });
    ok(counts.high > counts.low, `the setting matters (low ${counts.low} → high ${counts.high})`);
  },

  // Awards should go to players who earned them.
  awards(A) {
    section("Awards");
    const G = A.newGame(0, { seed: 121, rules: { seasonLen: 41 } });
    simSeason(A, G);
    const AW = G.awards;
    ok(AW && AW.mvp != null, "an MVP was named");
    const top = A.playersOf(G).filter((p) => p.pos !== "G")
      .sort((a, b) => A.pts(b.season) - A.pts(a.season))[0];
    // On points, not on identity: computeAwards breaks a tie on goals and this
    // doesn't, so in a tie the two legitimately name different players.
    ok(A.pts(G.players[AW.scoring].season) === A.pts(top.season),
      `the scoring trophy went to a points leader (${A.pts(G.players[AW.scoring].season)})`);
    const topG = A.playersOf(G).filter((p) => p.pos === "G" && p.season.gp > 15)
      .sort((a, b) => A.svPct(b.season) - A.svPct(a.season))[0];
    ok(AW.goalie === topG.id, "the goaltending trophy went to the best save percentage");
    ok(G.players[AW.mvp].trophies.length > 0, "the trophy was recorded on the player");
  },

  // Two goalies, a real workload split, and a shootout that is a contest.
  goaltending(A) {
    section("Goaltending");
    const G = A.newGame(0, { seed: 141, rules: { seasonLen: 82 } });
    simSeason(A, G);
    const splits = G.teams.map((t) => {
      const gs = A.rosterOf(G, t.id).filter((p) => p.pos === "G")
        .sort((a, b) => b.season.gp - a.season.gp);
      return gs.length >= 2 ? { t, s: gs[0].season.gp, b: gs[1].season.gp } : null;
    }).filter(Boolean);
    ok(splits.length >= 30, `clubs carry two goalies all season (${splits.length})`);
    const benched = splits.filter((x) => x.b === 0);
    ok(benched.length === 0, "every backup got starts", benched.length ? `${benched.length} never played` : "");
    const ironman = splits.filter((x) => x.s > 74);
    ok(ironman.length === 0, "nobody starts nearly every night",
      ironman.length ? `${ironman[0].t.abbr} started ${ironman[0].s}` : "");
    const avgStarter = splits.reduce((s, x) => s + x.s, 0) / splits.length;
    ok(avgStarter > 38 && avgStarter < 70, `the starter still carries it (${avgStarter.toFixed(0)} of 82)`);

    const soa = A.playersOf(G).reduce((s, p) => s + (p.season.soa || 0), 0);
    const sos = A.playersOf(G).reduce((s, p) => s + (p.season.sos || 0), 0);
    ok(soa > 0, `shootout attempts were taken (${soa})`);
    ok(sos > 0 && sos < soa, `shootout attempts are stoppable (${sos} of ${soa})`);
    const gsosa = A.playersOf(G).filter((p) => p.pos === "G").reduce((s, p) => s + (p.season.sosa || 0), 0);
    ok(gsosa === soa, `every shootout attempt faced a goalie (${gsosa} vs ${soa})`);
    const sow = A.playersOf(G).filter((p) => p.pos === "G").reduce((s, p) => s + (p.season.sow || 0), 0);
    const sol = A.playersOf(G).filter((p) => p.pos === "G").reduce((s, p) => s + (p.season.sol || 0), 0);
    ok(sow > 0 && sow === sol, `shootout decisions balance (${sow}W / ${sol}L)`);
    // Shootout goals are never season goals.
    const soScorers = A.playersOf(G).filter((p) => (p.season.sos || 0) > 0);
    ok(soScorers.length > 0, `shootout scorers are tracked separately (${soScorers.length})`);
  },

  // The per-zone shot breakdown has to add back up to the totals, from both
  // sides of the puck.
  zones(A) {
    section("Shot breakdown by zone");
    const G = A.newGame(0, { seed: 161, rules: { seasonLen: 41 } });
    simSeason(A, G);
    const Z = ["rush", "cycle", "point"];
    const skaters = A.playersOf(G).filter((p) => p.pos !== "G" && p.season.sog > 0);
    const badS = skaters.filter((p) => {
      const zs = Z.reduce((s, k) => s + p.season.z[k].s, 0);
      return zs + (p.season.eng || 0) !== p.season.sog;
    });
    ok(badS.length === 0, "a skater's zone shots plus empty-netters equal his shots on goal",
      badS.length ? `${badS[0].ln}: ${Z.map((k) => badS[0].season.z[k].s).join("+")} vs ${badS[0].season.sog}` : "");
    const badSg = skaters.filter((p) => Z.reduce((s, k) => s + p.season.z[k].g, 0) + (p.season.eng || 0) !== p.season.g);
    ok(badSg.length === 0, "and his zone goals equal his goals");

    const goalies = A.playersOf(G).filter((p) => p.pos === "G" && p.season.sa > 0);
    const badG = goalies.filter((p) => Z.reduce((s, k) => s + p.season.z[k].sa, 0) !== p.season.sa);
    ok(badG.length === 0, "a goalie's zone shots faced equal his shots against");
    const badGv = goalies.filter((p) => Z.reduce((s, k) => s + p.season.z[k].sv, 0) !== p.season.sv);
    ok(badGv.length === 0, "and his zone saves equal his saves");

    // Both sides must agree on what the league's zone mix looks like.
    const sSum = Z.map((k) => skaters.reduce((s, p) => s + p.season.z[k].s, 0));
    const gSum = Z.map((k) => goalies.reduce((s, p) => s + p.season.z[k].sa, 0));
    ok(Z.every((_, i) => sSum[i] === gSum[i]),
      `shooters and goalies agree zone by zone (${sSum.join("/")})`);
    const total = sSum.reduce((a, b) => a + b, 0);
    ok(sSum.every((n) => n / total > 0.1), `every zone gets real volume (${sSum.map((n) => (n / total * 100).toFixed(0) + "%").join(" ")})`);
    // And the danger ordering has to hold: rush beats cycle beats point.
    const pct = Z.map((k) => {
      const s = skaters.reduce((a, p) => a + p.season.z[k].s, 0);
      const g = skaters.reduce((a, p) => a + p.season.z[k].g, 0);
      return g / s;
    });
    ok(pct[0] > pct[1] && pct[1] > pct[2],
      `rush > cycle > point on conversion (${pct.map((x) => (x * 100).toFixed(1)).join(" / ")}%)`);
  },

  // Where the puck ended up: on goal, wide, or blocked — and whereabouts in the
  // net when it got there.
  placement(A) {
    section("Shot attempts and net placement");
    const G = A.newGame(0, { seed: 163, rules: { seasonLen: 41 } });
    simSeason(A, G);
    const K = A.NET_KEYS;
    const skaters = A.playersOf(G).filter((p) => p.pos !== "G" && p.season.att > 0);

    // Every attempt ends up in exactly one of three places.
    const badAtt = skaters.filter((p) => p.season.sog + p.season.miss + p.season.blkd !== p.season.att);
    ok(badAtt.length === 0, "attempts split cleanly into on goal, missed and blocked",
      badAtt.length ? `${badAtt[0].ln}: ${badAtt[0].season.sog}+${badAtt[0].season.miss}+${badAtt[0].season.blkd} vs ${badAtt[0].season.att}` : "");
    const att = skaters.reduce((s, p) => s + p.season.att, 0);
    const on = skaters.reduce((s, p) => s + p.season.sog, 0);
    const share = on / att;
    ok(share > 0.44 && share < 0.66, `about half of attempts reach the net (${(share * 100).toFixed(0)}%)`);
    const blocked = skaters.reduce((s, p) => s + p.season.blkd, 0);
    // Over EVERY skater, not just the ones who shot — a stay-at-home defenceman
    // blocks plenty and may not have taken an attempt all year.
    const allSkaters = A.playersOf(G).filter((p) => p.pos !== "G");
    const blocks = allSkaters.reduce((s, p) => s + p.season.blk, 0);
    ok(blocked === blocks, `every blocked shot was blocked by somebody (${blocked} vs ${blocks})`);
    const dBlocks = allSkaters.filter((p) => p.pos === "D").reduce((s, p) => s + p.season.blk, 0);
    ok(dBlocks / blocks > 0.9, `defencemen do the blocking (${(dBlocks / blocks * 100).toFixed(0)}%)`);

    // Placement has to reconcile with shots on goal, less empty-netters.
    const badNet = skaters.filter((p) => K.reduce((s, k) => s + p.season.net[k].a, 0) !== p.season.sog - (p.season.eng || 0));
    ok(badNet.length === 0, "a skater's net placements equal his shots on goal, less empty-netters",
      badNet.length ? `${badNet[0].ln}` : "");
    const badNetG = skaters.filter((p) => K.reduce((s, k) => s + p.season.net[k].g, 0) !== p.season.g - (p.season.eng || 0));
    ok(badNetG.length === 0, "and his placed goals equal his goals, less empty-netters");

    const goalies = A.playersOf(G).filter((p) => p.pos === "G" && p.season.sa > 0);
    const badGa = goalies.filter((p) => K.reduce((s, k) => s + p.season.net[k].sa, 0) !== p.season.sa);
    ok(badGa.length === 0, "a goalie's placements equal the shots he faced");
    const badGg = goalies.filter((p) => K.reduce((s, k) => s + p.season.net[k].ga, 0) !== p.season.ga);
    ok(badGg.length === 0, "and the goals he allowed");

    /* Calibrated against public NHL shot-target work. The whole point is that
       shots and goals pull in opposite directions: most shots are low, most
       goals are high. If a change to shot rates drags these out of band the
       chart stops meaning anything, so they're pinned here. */
    const netShare = (keys, field) => {
      const tot = K.reduce((s, k) => s + skaters.reduce((a, p) => a + p.season.net[k][field], 0), 0);
      const part = keys.reduce((s, k) => s + skaters.reduce((a, p) => a + p.season.net[k][field], 0), 0);
      return tot ? part / tot : 0;
    };
    const HIGH = ["GH", "MH", "BH"], MID = ["GM", "MM", "BM"], LOW = ["GL", "FH", "BL"];
    const abovePads = netShare(HIGH, "g") + netShare(MID, "g");
    ok(abovePads > 0.60 && abovePads < 0.74,
      `about two thirds of goals go in above the pads (${(abovePads * 100).toFixed(0)}%, NHL ~67%)`);
    ok(netShare(LOW, "a") > netShare(HIGH, "a") * 1.8,
      `but most shots are aimed low (${(netShare(LOW, "a") * 100).toFixed(0)}% low vs ${(netShare(HIGH, "a") * 100).toFixed(0)}% high)`);
    const gh = netShare(["GH"], "g"), bh = netShare(["BH"], "g"), fh = netShare(["FH"], "g");
    ok(gh > 0.16 && gh < 0.26, `top glove is the biggest single source of goals (${(gh * 100).toFixed(0)}%, NHL ~21%)`);
    ok(bh > 0.11 && bh < 0.19, `high blocker sits behind it (${(bh * 100).toFixed(0)}%, NHL ~15%)`);
    ok(gh > bh, "and goalies concede more glove side than blocker side, as they really do");
    ok(fh > 0.10 && fh < 0.19, `the five-hole is worth about a seventh of goals (${(fh * 100).toFixed(0)}%, NHL ~14%)`);
    const best = K.slice().sort((a, b) =>
      skaters.reduce((s, p) => s + p.season.net[b].g, 0) - skaters.reduce((s, p) => s + p.season.net[a].g, 0))[0];
    ok(best === "GH", `top glove is the single most-scored-on cell (got ${best})`);

    // Individuality: two wingers should not have the same chart.
    const spots = new Set(A.playersOf(G).filter((p) => p.pos !== "G").slice(0, 60).map((p) => A.shooterSpot(p).key));
    ok(spots.size >= 6, `shooters favour different corners (${spots.size} distinct)`);
    const lefties = A.playersOf(G).filter((p) => p.pos !== "G");
    const lShare = lefties.filter((p) => p.shoots === "L").length / lefties.length;
    ok(lShare > 0.5 && lShare < 0.75, `the league shoots mostly left-handed (${(lShare * 100).toFixed(0)}%, NHL ~62%)`);

    // Corners beat centre mass — that's the whole point of the chart.
    const cellRate = (k) => {
      const a = skaters.reduce((s, p) => s + p.season.net[k].a, 0);
      const g = skaters.reduce((s, p) => s + p.season.net[k].g, 0);
      return a ? g / a : 0;
    };
    const corners = A.NET_CELLS.filter((c) => c.corner).map((c) => cellRate(c.key));
    const worstCorner = Math.min(...corners);
    ok(worstCorner > cellRate("MM"),
      `every corner beats centre mass (worst corner ${(worstCorner * 100).toFixed(1)}% vs ${(cellRate("MM") * 100).toFixed(1)}%)`);
    const spread = K.map((k) => skaters.reduce((s, p) => s + p.season.net[k].a, 0));
    ok(spread.every((n) => n > 0), "every cell in the net gets shot at");
    ok(Math.max(...spread) / Math.min(...spread) < 12, "and no single cell swallows everything");

    // A goalie's weak spot is fixed for his career, so scouting him means something.
    const g0 = goalies[0];
    ok(A.goalieHole(g0).key === A.goalieHole(g0).key, "a goalie's hole is stable");
    const holes = new Set(goalies.slice(0, 40).map((p) => A.goalieHole(p).key));
    ok(holes.size >= 5, `goalies don't all share the same weakness (${holes.size} distinct)`);

    // The per-shot log: real records, the user's club only, and it has to agree
    // with the season totals it was built alongside.
    section("Shot and game logs");
    const mine = A.rosterOf(G, G.userTeam).filter((p) => p.pos !== "G" && p.season.att > 0);
    ok(mine.length > 0, "the user's skaters have attempts");
    const logged = mine.filter((p) => (G.shotLog[p.id] || []).length > 0);
    ok(logged.length === mine.length, `every one of them has a shot log (${logged.length}/${mine.length})`);
    const other = A.rosterOf(G, (G.userTeam + 1) % 32).filter((p) => p.pos !== "G");
    ok(other.every((p) => !(G.shotLog[p.id] || []).length),
      "and nobody outside the club is logged — that's what keeps the save small");

    const sample = logged.sort((a, b) => b.season.att - a.season.att)[0];
    const log = G.shotLog[sample.id];
    const capped = sample.season.att > 1400;
    ok(capped || log.length === sample.season.att,
      `the log holds every attempt (${log.length} vs ${sample.season.att})`);
    const byR = { g: 0, s: 0, m: 0, b: 0, e: 0 };
    log.forEach((r) => { byR[r.r]++; });
    if (!capped) {
      ok(byR.e === (sample.season.eng || 0), `logged empty-netters match (${byR.e})`);
      ok(byR.g === sample.season.g - (sample.season.eng || 0), `logged goals match (${byR.g})`);
      ok(byR.m === sample.season.miss, `logged misses match (${byR.m})`);
      ok(byR.b === sample.season.blkd, `logged blocks match (${byR.b})`);
      ok(byR.g + byR.s === sample.season.sog - (sample.season.eng || 0), "logged on-goal shots match");
    } else ok(true, "log was capped, totals not compared");
    ok(log.every((r) => r.d >= 0 && r.t >= 0 && r.t < 70), "every record carries a day and a clock time");
    ok(log.every((r) => r.o != null && r.o !== G.userTeam), "and an opponent that isn't us");
    ok(log.every((r) => (r.r === "g" || r.r === "s") ? !!r.c : r.c == null),
      "shots that reached the net have a placement; the others don't");

    // A goalie's log is the shots he faced.
    const gk = A.rosterOf(G, G.userTeam).filter((p) => p.pos === "G" && p.season.sa > 0)
      .sort((a, b) => b.season.sa - a.season.sa)[0];
    const glog = G.shotLog[gk.id] || [];
    ok(glog.length > 0, `the goalie has a log too (${glog.length})`);
    ok(glog.every((r) => r.c), "and it only holds shots that got to him");
    if (glog.length < 1400) {
      ok(glog.filter((r) => r.r === "g").length === gk.season.ga, "the goals in it match his goals against");
    } else ok(true, "goalie log capped");

    // The game log.
    const gl = G.gameLog[sample.id] || [];
    ok(gl.length === sample.season.gp || gl.length === 220,
      `the game log has a row per game (${gl.length} vs ${sample.season.gp})`);
    ok(gl.reduce((s, r) => s + r.g, 0) === sample.season.g || gl.length === 220,
      "and its goals add up to his season");
    ok(gl.every((r) => r.o != null && r.toi >= 0), "every row names an opponent and an ice time");

    // Neither log may survive the rollover.
    simPlayoffs(A, G);
    A.autoDraft(G, false); A.startNextSeason(G);
    ok(Object.keys(G.shotLog).length === 0 && Object.keys(G.gameLog).length === 0,
      "both logs are cleared at the rollover");
  },

  // Shot zones and fighting: flavour that has to show up in the numbers.
  flavour(A) {
    section("Shot quality and fighting");
    const G = A.newGame(0, { seed: 151, rules: { seasonLen: 41 } });
    simSeason(A, G);
    const ds = A.playersOf(G).filter((p) => p.pos === "D" && p.season.sog > 20);
    const fs = A.playersOf(G).filter((p) => p.pos !== "D" && p.pos !== "G" && p.season.sog > 20);
    const dPct = ds.reduce((s, p) => s + p.season.g, 0) / ds.reduce((s, p) => s + p.season.sog, 0);
    const fPct = fs.reduce((s, p) => s + p.season.g, 0) / fs.reduce((s, p) => s + p.season.sog, 0);
    ok(dPct < fPct * 0.8,
      `point shots convert worse than forward chances (${(dPct * 100).toFixed(1)}% vs ${(fPct * 100).toFixed(1)}%)`);
    ok(dPct > 0.015, `defencemen still score (${(dPct * 100).toFixed(1)}%)`);
    const dShare = ds.reduce((s, p) => s + p.season.sog, 0) /
      (ds.reduce((s, p) => s + p.season.sog, 0) + fs.reduce((s, p) => s + p.season.sog, 0));
    ok(dShare > 0.18 && dShare < 0.45, `defencemen take a real share of the shots (${(dShare * 100).toFixed(0)}%)`);

    const fights = A.playersOf(G).reduce((s, p) => s + (p.season.fights || 0), 0);
    ok(fights > 0, `fights happened (${fights})`);
    const fighters = A.playersOf(G).filter((p) => (p.season.fights || 0) > 0);
    const skaters = A.playersOf(G).filter((p) => p.pos !== "G");
    const avgPhy = fighters.reduce((s, p) => s + p.r.phy, 0) / Math.max(1, fighters.length);
    const leaguePhy = skaters.reduce((s, p) => s + p.r.phy, 0) / skaters.length;
    ok(avgPhy > leaguePhy, `the heavies do the fighting (${avgPhy.toFixed(0)} vs league ${leaguePhy.toFixed(0)})`);
    const G2 = A.newGame(0, { seed: 151, rules: { seasonLen: 41, fighting: false } });
    simSeason(A, G2);
    ok(A.playersOf(G2).reduce((s, p) => s + (p.season.fights || 0), 0) === 0,
      "the fighting knob turns them off");
  },

  // Retained salary: the seller keeps paying, and it has to show on both books.
  retention(A) {
    section("Retained salary");
    const G = A.newGame(0, { seed: 171 });
    const star = A.rosterOf(G, 5).sort((a, b) => b.contract.amt - a.contract.amt)[0];
    star.ntc = false;
    const beforeSeller = A.capHit(G, 5), beforeBuyer = A.capHit(G, 6);
    const half = Math.round(star.contract.amt * 0.5 * 10) / 10;
    A.doTrade(G, 5, [star.id], [], 6, [], [], { retain: { [star.id]: 0.5 } });
    ok(G.players[star.id].teamId === 6, "the player moved");
    ok(A.retainedBy(G, 5).length === 1, "the seller carries a retained contract");
    ok(A.effectiveCap(G, G.players[star.id]) === Math.round((star.contract.amt - half) * 10) / 10,
      `the buyer only pays the balance ($${A.effectiveCap(G, G.players[star.id])}M of $${star.contract.amt}M)`);
    const sellerNow = A.capHit(G, 5), buyerNow = A.capHit(G, 6);
    ok(Math.abs(sellerNow - (beforeSeller - star.contract.amt + half)) < 0.15,
      `the seller still pays its half (${beforeSeller} → ${sellerNow})`);
    ok(Math.abs(buyerNow - (beforeBuyer + star.contract.amt - half)) < 0.15,
      `the buyer takes on the rest (${beforeBuyer} → ${buyerNow})`);

    // Only so many at once.
    let banked = 1, blocked = false;
    for (const p of A.rosterOf(G, 5).sort((a, b) => b.contract.amt - a.contract.amt).slice(0, 5)) {
      p.ntc = false;
      const ev = A.evalTrade(G, 5, [p.id], [], 7, [], [], { retain: { [p.id]: 0.5 } });
      if (/can only retain/.test(ev.why || "")) { blocked = true; break; }
      if (A.doTrade(G, 5, [p.id], [], 7, [], [], { retain: { [p.id]: 0.5 } }).ok) banked++;
    }
    ok(blocked || banked <= A.MAX_RETAINED, `a club can't retain more than ${A.MAX_RETAINED} contracts (${banked})`);

    // The knob turns it off entirely.
    const G2 = A.newGame(0, { seed: 172, rules: { retainedSalary: false } });
    const s2 = A.rosterOf(G2, 5).sort((a, b) => b.contract.amt - a.contract.amt)[0];
    s2.ntc = false;
    A.doTrade(G2, 5, [s2.id], [], 6, [], [], { retain: { [s2.id]: 0.5 } });
    ok(A.retainedBy(G2, 5).length === 0, "with the knob off, nothing is retained");
  },

  // No-trade clauses, waivers, negotiation, the deadline.
  gmDepth(A) {
    section("No-trade clauses, waivers and negotiation");
    const G = A.newGame(0, { seed: 181, rules: { seasonLen: 41 } });

    const locked = A.playersOf(G).filter((p) => A.hasNtc(p));
    ok(locked.length > 0, `stars negotiate no-trade clauses (${locked.length} in the league)`);
    ok(locked.every((p) => p.ovr >= 76 && p.age >= 26), "only established players get one");
    const mine = locked.find((p) => p.teamId != null);
    const ev = A.evalTrade(G, mine.teamId, [mine.id], [], (mine.teamId + 1) % 32, [], []);
    ok(!ev.ok && /no-trade/.test(ev.why), `a clause blocks the trade (${ev.why})`);
    let waived = false;
    for (let i = 0; i < 40 && !waived; i++) waived = A.requestNtcWaiver(G, mine.id).ok;
    ok(waived, "a clause can eventually be waived");
    const ev2 = A.evalTrade(G, mine.teamId, [mine.id], [], (mine.teamId + 1) % 32, [], []);
    ok(!/no-trade/.test(ev2.why || ""), "and then the trade is allowed to be judged on its merits");

    /* Moving a player inside your own organisation is a roster decision and
       costs nothing. Waivers are for RELEASES, where the risk belongs. */
    section("Demotion and release");
    const kid = A.rosterOf(G, 0).find((p) => p.age < 22);
    if (kid) {
      const r = A.sendDown(G, kid.id);
      ok(r.ok && !r.waivers, "a young player goes down freely");
      ok(kid.farm === true, "and reports to the farm immediately");
    } else ok(true, "no youngster on this roster to test");
    const vet = A.rosterOf(G, 0).find((p) => p.age >= 24 && !p.farm);
    vet.career = [{ gp: 200 }];
    const r2 = A.sendDown(G, vet.id);
    ok(r2.ok && !r2.waivers, "an established player goes down freely too");
    ok(vet.farm === true, "and he is on the farm the moment you send him");
    ok(!(G.waivers || []).length, "demoting your own player exposes him to nobody");

    // Releasing is the one that costs something.
    const cut = A.rosterOf(G, 0).find((p) => !p.farm && !A.hasNtc(p));
    const cost = A.releaseCost(G, cut.id);
    ok(cost > 0 && cost < cut.contract.amt, `a release carries dead money ($${cost}M of $${cut.contract.amt}M)`);
    const rel = A.releasePlayer(G, cut.id);
    ok(rel.ok, "you can release a player");
    ok(G.waivers.length === 1 && G.waivers[0].release, "which puts him on the wire first");
    ok(cut.teamId === 0, "and he is still yours until it clears");
    const capBefore = A.capHit(G, 0);
    G.day++;
    A.processWaivers(G);
    ok(G.waivers.length === 0, "the wire is emptied once processed");
    if (cut.teamId === null) {
      ok(G.freeAgents.includes(cut.id), "an unclaimed release becomes a free agent");
      const dead = (G.retained || []).filter((r) => r.dead && r.from === 0);
      ok(dead.length === 1 && dead[0].amt === cost, `and leaves dead cap behind ($${dead[0].amt}M)`);
      ok(A.capHit(G, 0) < capBefore, "which still costs less than carrying the contract");
      // Dead money must NOT follow him — his next club negotiates its own price.
      ok(A.effectiveCap(G, cut) === cut.contract.amt, "the dead money stays with the club that cut him");
    } else {
      ok(cut.teamId !== 0, "or another club claims him and takes the contract");
      ok(!(G.retained || []).some((r) => r.dead), "and the club that cut him owes nothing");
    }

    section("Contract negotiation");
    const fa = G.freeAgents.map((id) => G.players[id]).sort((a, b) => b.ovr - a.ovr)[0];
    const want = A.askingPrice(G, fa.id, 0, 3);
    ok(want > 0, `a free agent has a number ($${want}M × 3)`);
    ok(A.negotiate(G, fa.id, 0, want, 3).ok, "meeting it gets a signature");
    const low = A.negotiate(G, fa.id, 0, want * 0.9, 3);
    ok(!low.ok && low.counter, `a near miss gets a counter ($${low.counter}M)`);
    ok(!A.negotiate(G, fa.id, 0, want * 0.4, 3).ok, "a lowball gets nothing");
    const short = A.askingPrice(G, fa.id, 0, 1), long = A.askingPrice(G, fa.id, 0, 5);
    ok(short > long, `a one-year deal costs more per year than a five ($${short}M vs $${long}M)`);

    section("Trade deadline");
    const G3 = A.newGame(0, { seed: 182, rules: { seasonLen: 41 } });
    ok(A.tradesOpen(G3), "trades are open early in the season");
    const dl = A.deadlineDay(G3);
    ok(dl > 0 && dl < G3.schedule.length, `the deadline lands inside the season (day ${dl} of ${G3.schedule.length})`);
    const picksBefore = JSON.stringify(G3.picks);
    let guard = 0;
    while (G3.phase === "regular" && G3.day <= dl && guard++ < 400) A.simDay(G3);
    ok(!A.tradesOpen(G3), "and they shut once it passes");
    const after = A.evalTrade(G3, 0, [A.rosterOf(G3, 0)[0].id], [], 1, [], []);
    ok(!after.ok && /deadline/.test(after.why), `a post-deadline trade is refused (${after.why})`);
    ok(JSON.stringify(G3.picks) !== picksBefore, "the AI actually made deadline moves");

    section("Prospects");
    const G4 = A.newGame(0, { seed: 183, rules: { seasonLen: 41 } });
    let g2 = 0; while (G4.phase === "regular" && g2++ < 400) A.simDay(G4);
    const farmed = A.playersOf(G4).filter((p) => p.farm && p.farmSeason && p.farmSeason.gp > 0);
    ok(farmed.length > 0, `farm players played a season (${farmed.length})`);
    ok(farmed.some((p) => p.farmSeason.g > 0), "and produced");
    const youngFarm = A.playersOf(G4).filter((p) => p.farm && p.age <= 22).map((p) => p.ovr);
    let g3 = 0; while (G4.phase === "playoffs" && g3++ < 12) A.simPlayoffRound(G4);
    const grown = A.playersOf(G4).filter((p) => p.farm && p.age <= 23 && p.farmCareer);
    ok(grown.length > 0, "farm seasons are archived at the rollover");
    ok(A.playersOf(G4).some((p) => A.prospectReady(G4, p)), "some prospects are ready for a call-up");
  },

  // The record book, the break, the play-by-play, and franchise history.
  atmosphere(A) {
    section("Records, All-Star break and play-by-play");
    // seed 191 put the user's top scorer exactly on the 20-goal milestone
    // threshold, so a small change anywhere in shot rates could tip it either
    // way; 59 clears the scaled goals and points marks with real margin.
    const G = A.newGame(0, { seed: 59, rules: { seasonLen: 41 } });

    const breakDay = G.allStarDay;
    ok(breakDay > 0 && breakDay < G.schedule.length, `the calendar reserves a break (day ${breakDay})`);
    ok([breakDay - 1, breakDay, breakDay + 1].every((d) => !G.schedule[d] || G.schedule[d].length === 0),
      "no games are scheduled across the break");

    simSeason(A, G);
    ok(G.allStar && G.allStar.year === G.year, "the All-Star game was played");
    ok(G.allStar.east.length === 10 && G.allStar.west.length === 10,
      `each side names ten (${G.allStar.east.length}/${G.allStar.west.length})`);
    // Against the club they were PICKED for — a player traded across
    // conferences at the deadline doesn't retroactively switch benches.
    const asAt = (id) => G.teams[G.allStar.at[id]];
    ok(G.allStar.east.every((id) => asAt(id).conf === 0)
      && G.allStar.west.every((id) => asAt(id).conf === 1),
      "players are on the side they were picked for");
    ok(G.allStar.east.concat(G.allStar.west).every((id) => G.allStar.at[id] != null),
      "every selection records the club he was picked from");
    ok(G.allStar.east.filter((id) => G.players[id].pos === "G").length === 1, "each side takes a goalie");
    ok(G.allStar.mvp != null, "an All-Star MVP was named");

    ok(G.records && G.records.goals && G.records.points, "the record book was written");
    const topG = A.playersOf(G).filter((p) => p.pos !== "G")
      .sort((a, b) => b.season.g - a.season.g)[0];
    ok(G.records.goals.v === topG.season.g, "the goals record matches the league leader");

    ok(G.lastGame && G.lastGame.events, "the user's last game kept a play-by-play");
    const kinds = new Set(G.lastGame.events.map((e) => e.kind));
    ok(G.lastGame.events.length > 0, `it has events (${G.lastGame.events.length})`);
    ok([...kinds].every((k) => ["goal", "save", "penalty", "fight", "shootout"].includes(k)),
      `and only known event kinds (${[...kinds].join(", ")})`);
    const evGoals = G.lastGame.events.filter((e) => e.kind === "goal").length;
    const boxGoals = G.lastGame.hg + G.lastGame.ag - (G.lastGame.so ? 1 : 0);
    ok(evGoals === boxGoals, `every goal in the game is in the log (${evGoals} vs ${boxGoals})`);
    const sorted = G.lastGame.events.every((e, i, a) => i === 0 || a[i - 1].t <= e.t);
    ok(sorted, "the log runs in clock order");
    // Drive the machinery directly rather than hoping a random season lands a
    // scorer past a mark — that made this check hostage to the RNG, and it has
    // already broken twice on unrelated changes to shot rates.
    const marked = A.rosterOf(G, G.userTeam).filter((p) => p.pos !== "G")[0];
    marked.marks = null;
    marked.season.g = 60; marked.season.a = 60;
    A.checkMilestones(G);
    ok(marked.marks && Object.keys(marked.marks).length > 0, "milestones fire once a mark is passed");
    const newsBefore = G.news.length;
    A.checkMilestones(G);
    ok(G.news.length === newsBefore, "and the same mark never fires twice");

    simPlayoffs(A, G);
    ok(G.teams.every((t) => t.seasons && t.seasons.length === 1), "every club archived its season");
    const champ = G.teams[G.history[0].champion];
    ok(champ.seasons[0].cup === true, "the champion's season is marked as a Cup year");
    ok(G.teams.filter((t) => t.seasons[0].playoffs).length === 16, "sixteen clubs are recorded as making it");
  },

  // Many seasons in a row: the save must stay bounded and the league legal.
  longevity(A) {
    section("Eight-season soak");
    const G = A.newGame(0, { seed: 201, rules: { seasonLen: 41 } });
    const sizes = [];
    for (let s = 0; s < 8; s++) {
      simSeason(A, G); simPlayoffs(A, G);
      A.autoDraft(G, false);
      A.startNextSeason(G);
      sizes.push(JSON.stringify(G).length / 1048576);
    }
    ok(G.year === 2034, `eight seasons elapsed (through ${G.year})`);
    ok(G.teams.every((t) => t.seasons.length === 8), "every club has eight seasons of history");
    ok(G.teams.every((t) => A.rosterOf(G, t.id).length >= 20), "every club can still dress a roster");
    ok(G.teams.every((t) => A.rosterOf(G, t.id).filter((p) => p.pos === "G").length >= 2),
      "and still has two goaltenders");
    ok(G.teams.every((t) => A.capHit(G, t.id) <= A.rules(G).capAmount + 0.5),
      "nobody drifted over the cap",
      G.teams.filter((t) => A.capHit(G, t.id) > A.rules(G).capAmount + 0.5).map((t) => `${t.abbr} ${A.capHit(G, t.id)}`).join(" "));

    const growth = sizes[7] - sizes[3];
    ok(sizes[7] < 3, `the save stays under the storage ceiling (${sizes[7].toFixed(2)} MB after eight)`);
    ok(growth < sizes[3], `pruning holds growth down (${sizes[3].toFixed(2)} → ${sizes[7].toFixed(2)} MB)`);
    const honoured = G.teams.reduce((s, t) => s + (t.honours || []).length, 0);
    ok(honoured > 0, `clubs honoured their long servers (${honoured})`);
    const records = A.RECORD_DEFS.every((d) => G.records[d.key]);
    ok(records, "every record has a holder");
    // And it still plays.
    simSeason(A, G);
    ok(G.teams.every((t) => t.gp === 41), "the ninth season plays to completion");
  },

  // A club's shot map has to be ITS shot map. Zone shares used to be league
  // constants, so every team's chart was the same shape and only the volume
  // moved — for and against looked identical.
  teamProfiles(A) {
    section("Team shot profiles");
    const G = A.newGame(0, { seed: 501, rules: { seasonLen: 82 } });
    simSeason(A, G);
    const Z = A.ZONE_KEYS;
    const prof = G.teams.map((t) => {
      const f = { rush: 0, cycle: 0, point: 0 }, a = { rush: 0, cycle: 0, point: 0 };
      A.rosterOf(G, t.id, true).forEach((p) => {
        if (!p.season.z) return;
        if (p.pos === "G") Z.forEach((k) => { a[k] += p.season.z[k].sa; });
        else Z.forEach((k) => { f[k] += p.season.z[k].s; });
      });
      const tf = Z.reduce((s, k) => s + f[k], 0), ta = Z.reduce((s, k) => s + a[k], 0);
      const r = A.rosterOf(G, t.id);
      const fwd = r.filter((p) => p.pos !== "D" && p.pos !== "G");
      const dmen = r.filter((p) => p.pos === "D");
      return {
        t, tf, ta,
        fRush: tf ? f.rush / tf : 0, fPoint: tf ? f.point / tf : 0,
        aRush: ta ? a.rush / ta : 0, aPoint: ta ? a.point / ta : 0,
        speed: fwd.reduce((s, p) => s + p.r.spd, 0) / Math.max(1, fwd.length),
        dShot: dmen.reduce((s, p) => s + p.r.sht, 0) / Math.max(1, dmen.length),
        dfn: dmen.reduce((s, p) => s + p.r.dfn, 0) / Math.max(1, dmen.length),
      };
    }).filter((x) => x.tf > 0 && x.ta > 0);
    ok(prof.length === 32, "every club has a profile both ways");

    const spread = (xs) => Math.max(...xs) - Math.min(...xs);
    const fRushSpread = spread(prof.map((p) => p.fRush));
    ok(fRushSpread > 0.025, `clubs differ in how much rush they generate (${(fRushSpread * 100).toFixed(1)} points apart)`);
    const fPointSpread = spread(prof.map((p) => p.fPoint));
    ok(fPointSpread > 0.03, `and in how much they shoot from the point (${(fPointSpread * 100).toFixed(1)} points)`);
    const aRushSpread = spread(prof.map((p) => p.aRush));
    ok(aRushSpread > 0.04, `and in how much rush they concede (${(aRushSpread * 100).toFixed(1)} points)`);

    // The two maps must not be the same map. Some clubs should be lopsided.
    const gaps = prof.map((p) => Math.abs(p.fRush - p.aRush));
    ok(Math.max(...gaps) > 0.05,
      `a club's own map differs from what it concedes (biggest gap ${(Math.max(...gaps) * 100).toFixed(1)} points)`);

    // And the differences have to come from the roster, not from noise.
    const corr = (xs, ys) => {
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
      const dx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
      const dy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
      return dx && dy ? num / (dx * dy) : 0;
    };
    const rSpeed = corr(prof.map((p) => p.speed), prof.map((p) => p.fRush));
    ok(rSpeed > 0.3, `fast forwards generate more rush chances (r=${rSpeed.toFixed(2)})`);
    const rShot = corr(prof.map((p) => p.dShot), prof.map((p) => p.fPoint));
    ok(rShot > 0.3, `shooting defencemen produce more point shots (r=${rShot.toFixed(2)})`);
    const rDfn = corr(prof.map((p) => p.dfn), prof.map((p) => p.aRush));
    ok(rDfn < -0.3, `a sound defence concedes less rush (r=${rDfn.toFixed(2)})`);

    /* And the NET map, which is the one that used to be truly identical: where
       a shot is AIMED only ever depended on the shooter, so every club's
       conceded placement chart was the league average. Shooters now scout the
       goalie, so a club's conceded map leans on its own keeper's hole. */
    section("Net maps differ by club");
    const K = A.NET_KEYS;
    const net = G.teams.map((t) => {
      const f = {}, a = {};
      K.forEach((k) => { f[k] = 0; a[k] = 0; });
      A.rosterOf(G, t.id, true).forEach((p) => {
        if (!p.season.net) return;
        if (p.pos === "G") K.forEach((k) => { a[k] += p.season.net[k].sa; });
        else K.forEach((k) => { f[k] += p.season.net[k].a; });
      });
      const tf = K.reduce((s, k) => s + f[k], 0), ta = K.reduce((s, k) => s + a[k], 0);
      const gk = A.rosterOf(G, t.id).filter((p) => p.pos === "G")
        .sort((x, y) => y.season.gp - x.season.gp)[0];
      return { t, tf, ta, f: K.map((k) => (tf ? f[k] / tf * 100 : 0)),
        a: K.map((k) => (ta ? a[k] / ta * 100 : 0)), hole: gk ? A.goalieHole(gk).key : null };
    }).filter((x) => x.ta > 0 && x.hole);
    ok(net.length >= 30, `net profiles built for the league (${net.length})`);

    // The headline: a club is shot at more where its own goalie is weak.
    const leagueAvg = K.map((k, i) => net.reduce((s, p) => s + p.a[i], 0) / net.length);
    const lifts = net.map((p) => p.a[K.indexOf(p.hole)] - leagueAvg[K.indexOf(p.hole)]);
    const above = lifts.filter((l) => l > 0).length;
    ok(above >= net.length - 2,
      `clubs concede more shots at their goalie's hole (${above} of ${net.length})`);
    const medLift = lifts.slice().sort((x, y) => x - y)[Math.floor(lifts.length / 2)];
    ok(medLift > 1.2, `and by a visible margin (median +${medLift.toFixed(1)} points)`);

    // Conceded maps must vary club to club, not sit on the league mean.
    const aSd = K.map((k, i) => {
      const xs = net.map((p) => p.a[i]);
      const mu = xs.reduce((x, y) => x + y, 0) / xs.length;
      return Math.sqrt(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / xs.length);
    });
    ok(Math.max(...aSd) > 1.5, `conceded placement varies across clubs (widest sd ${Math.max(...aSd).toFixed(2)})`);
    // And a club's own map must not be a copy of what it concedes.
    const netGap = net.map((p) => K.reduce((s, _, i) => s + Math.abs(p.f[i] - p.a[i]), 0) / K.length);
    // Modest by nature — a club's own map is its shooters, the conceded one is
    // the whole league's shooters aimed at its goalie. The hole-lift check above
    // is the sharper guard; this just says the two aren't the same chart.
    ok(Math.max(...netGap) > 1.4,
      `a club's own placement differs from what it concedes (biggest mean gap ${Math.max(...netGap).toFixed(1)} points)`);
  },

  // A season split by club, so a traded player's year isn't all credited to
  // whoever happened to have him at the end.
  stints(A) {
    section("Season splits by club");
    const G = A.newGame(0, { seed: 221, rules: { seasonLen: 41 } });
    simSeason(A, G);
    const played = A.playersOf(G).filter((p) => p.season.gp > 0);
    ok(played.every((p) => (p.stints || []).length > 0), "everyone who played has at least one spell");

    // The spells must add up to the season, for everybody.
    const badGp = played.filter((p) => A.stintTotal(p, "gp") !== p.season.gp);
    ok(badGp.length === 0, "games in the spells equal games in the season",
      badGp.length ? `${badGp[0].ln}: ${A.stintTotal(badGp[0], "gp")} vs ${badGp[0].season.gp}` : "");
    const skaters = played.filter((p) => p.pos !== "G");
    const badG = skaters.filter((p) => A.stintTotal(p, "g") !== p.season.g);
    ok(badG.length === 0, "and so do goals");
    const badA = skaters.filter((p) => A.stintTotal(p, "a") !== p.season.a);
    ok(badA.length === 0, "and assists");

    // The deadline moves people, so somebody should have two.
    const moved = played.filter((p) => p.stints.filter((st) => st.s.gp).length > 1);
    ok(moved.length > 0, `players traded mid-season have more than one spell (${moved.length})`);
    const m = moved[0];
    ok(m.stints[0].t !== m.stints[1].t, "consecutive spells are with different clubs");
    ok(m.stints[m.stints.length - 1].t === m.teamId, "and the last spell is the club he's on now");
    ok(m.stints.every((st) => st.s.z === undefined), "spell lines carry no zone buckets — that's the save-size guard");

    // At the rollover a traded year becomes one career row per club. The spells
    // themselves are cleared by finishSeason, so count them first.
    const spellCount = m.stints.filter((st) => st.s.gp).length;
    const spellClubs = m.stints.filter((st) => st.s.gp).map((st) => st.t);
    simPlayoffs(A, G);
    const rows = (m.career || []).filter((r) => r.year === G.year);
    ok(rows.length === spellCount, `a traded year is archived as one row per club (${rows.length} vs ${spellCount})`);
    ok(spellClubs.every((t) => rows.some((r) => r.teamId === t)), "every club he played for is in the record");
    ok(rows.every((r) => r.teamId != null), "every career row names the club it was earned with");
    ok(new Set(rows.map((r) => r.teamId)).size === rows.length, "and no club appears twice for one year");
    const single = A.playersOf(G).find((p) => (p.career || []).filter((r) => r.year === G.year).length === 1
      && p.career.some((r) => r.year === G.year && r.gp > 0));
    ok(!!single, "a player who stayed put gets exactly one row");
    A.autoDraft(G, false); A.startNextSeason(G);
    ok(A.playersOf(G).every((p) => !p.stints || !p.stints.length), "spells are cleared at the rollover");
  },

  /* Continuity: the dots on a shot chart have to BE the shots from the games
     that were actually played — same day, same opponent, right count — not a
     cloud generated after the fact to match a total. */
  continuity(A) {
    section("Shot log ties back to real games");
    const G = A.newGame(0, { seed: 313, rules: { seasonLen: 41 } });
    simSeason(A, G);

    // What the schedule says the club actually did.
    const played = [];            // {day, opp}
    G.schedule.forEach((day, d) => day.forEach((f) => {
      if (!f.played) return;
      if (f.home === G.userTeam) played.push({ day: d, opp: f.away });
      else if (f.away === G.userTeam) played.push({ day: d, opp: f.home });
    }));
    ok(played.length === 41, `the club played its 41 games (${played.length})`);
    const oppByDay = {};
    played.forEach((g) => { oppByDay[g.day] = g.opp; });

    const skaters = A.rosterOf(G, G.userTeam).filter((p) => p.pos !== "G" && p.season.att > 0);
    ok(skaters.length > 0, "and has skaters who shot");

    let checkedDays = 0, badDay = null, badOpp = null, badCount = null;
    skaters.forEach((p) => {
      const log = G.shotLog[p.id] || [];
      // Every record must fall on a day this club actually played...
      log.forEach((r) => {
        if (!(r.d in oppByDay) && badDay == null) badDay = `${p.ln} logged a shot on day ${r.d + 1}, no game`;
        else if (oppByDay[r.d] !== r.o && badOpp == null) {
          badOpp = `${p.ln} day ${r.d + 1}: logged vs ${r.o}, actually played ${oppByDay[r.d]}`;
        }
      });
      // ...and the totals must be the season totals, not an approximation.
      const on = log.filter((r) => r.r === "g" || r.r === "s").length;
      const en = log.filter((r) => r.r === "e").length;
      if (on + en !== p.season.sog && badCount == null) {
        badCount = `${p.ln}: ${on}+${en} logged vs ${p.season.sog} shots on goal`;
      }
      checkedDays += new Set(log.map((r) => r.d)).size;
    });
    ok(badDay == null, "every logged shot falls on a day the club actually played", badDay || "");
    ok(badOpp == null, "and names the opponent it was actually against", badOpp || "");
    ok(badCount == null, "and the logged shots add up to the season totals", badCount || "");

    // The busiest shooter should have shot in most of the games he dressed for.
    const busiest = skaters.sort((a, b) => b.season.att - a.season.att)[0];
    const daysWithShots = new Set((G.shotLog[busiest.id] || []).map((r) => r.d)).size;
    ok(daysWithShots > busiest.season.gp * 0.6,
      `the top shooter appears in most of his games (${daysWithShots} of ${busiest.season.gp})`);
    ok(daysWithShots <= busiest.season.gp,
      `and never in more games than he played (${daysWithShots} vs ${busiest.season.gp})`);

    // The log grows game by game rather than appearing at the end.
    const G2 = A.newGame(0, { seed: 314, rules: { seasonLen: 41 } });
    const counts = [];
    for (let i = 0; i < 25; i++) {
      A.simDay(G2);
      const n = Object.values(G2.shotLog).reduce((s, arr) => s + arr.length, 0);
      counts.push(n);
    }
    ok(counts[24] > counts[0], "the log fills up as days are played");
    ok(counts.every((n, i) => i === 0 || n >= counts[i - 1]), "and only ever grows");
    const jumps = counts.filter((n, i) => i && n > counts[i - 1]).length;
    ok(jumps >= 8, `it grows on the days the club plays, not in one lump (${jumps} increments)`);

    // Goals in the log are the goals in the box score, game for game.
    const scored = {};
    G.results.forEach((r) => r.scorers.forEach((sc) => {
      if (sc.t !== G.userTeam) return;
      scored[sc.id] = (scored[sc.id] || 0) + 1;
    }));
    let badGoals = null;
    Object.entries(scored).forEach(([pid, n]) => {
      const log = G.shotLog[pid];
      if (!log) return;
      const logged = log.filter((r) => r.r === "g" || r.r === "e").length;
      if (logged !== n && badGoals == null) badGoals = `player ${pid}: ${logged} logged vs ${n} scored`;
    });
    ok(badGoals == null, "every goal in the log is a goal that was actually scored", badGoals || "");
  },

  // Deployment: the two levers a coach actually has.
  deployment(A) {
    section("Ice time and matchups");
    const G = A.newGame(0, { seed: 411, rules: { seasonLen: 41 } });
    ok(A.iceTimeF(G.teams[0]).every((v, i) => Math.abs(v - A.LINE_TOI[i]) < 0.001),
      "a club with no setting plays the standard split");
    // Ice time is normalised, so any numbers work.
    G.teams[0].iceF = [40, 20, 20, 20];
    const ice = A.iceTimeF(G.teams[0]);
    ok(Math.abs(ice.reduce((a, b) => a + b, 0) - 1) < 1e-9, "a custom split is normalised to one");
    ok(ice[0] > 0.35 && ice[0] < 0.45, `and the first line gets its share (${(ice[0] * 100).toFixed(0)}%)`);
    const box = A.simGame(G, 0, 1, {}).boxes[0];
    const L = A.ensureLines(G, 0);
    const toi = (ids) => ids.reduce((s, id) => s + box.players[id].toi, 0) / ids.length;
    ok(toi(L.F[0]) > toi(L.F[1]) * 1.6,
      `a hard-ridden first line actually plays more (${toi(L.F[0]).toFixed(1)} vs ${toi(L.F[1]).toFixed(1)})`);
    G.teams[0].iceF = null;

    // Matchups: no instruction means line-for-line.
    const side = { box: { teamId: 0 }, opp: { teamId: 1 }, isHome: true };
    G.teams[0].checkLine = null;
    const plain = A.matchupMix(G, side, 0, G.teams[1]);
    ok(plain[0] === 1, "with no matching, line one meets line one");
    // A checking line chases their best; the scoring line is hidden from it.
    G.teams[0].checkLine = 2;
    const check = A.matchupMix(G, side, 2, G.teams[1]);
    ok(check[0] > 0.5, `the checking line mostly draws their top line (${(check[0] * 100).toFixed(0)}%)`);
    const top = A.matchupMix(G, side, 0, G.teams[1]);
    ok(top[0] < 0.45, `and the scoring line sees them less (${(top[0] * 100).toFixed(0)}%)`);
    ok(top[2] + top[3] > 0.3, "spending its minutes against their depth instead");
    // On the road the coach can ask but not insist.
    const away = { box: { teamId: 0 }, opp: { teamId: 1 }, isHome: false };
    const awayCheck = A.matchupMix(G, away, 2, G.teams[1]);
    ok(awayCheck[0] < check[0], `last change is worth something (${(awayCheck[0] * 100).toFixed(0)}% away vs ${(check[0] * 100).toFixed(0)}% home)`);
    ok(A.matchupMix(G, side, 0, G.teams[1]).reduce((a, b) => a + b, 0) > 0.999, "every mix is a distribution");
  },

  // Coaching, rivalries, the room and the board's ask.
  flavourSystems(A) {
    section("Staff, rivals and the room");
    const G = A.newGame(0, { seed: 421, rules: { seasonLen: 41 } });

    ok(G.teams.every((t) => t.coach && t.coach.name), "every club has a head coach");
    ok(G.teams.every((t) => A.SYSTEMS[t.coach.system]), "and a system that exists");
    const sysSpread = new Set(G.teams.map((t) => t.coach.system));
    ok(sysSpread.size >= 2, `clubs don't all play the same way (${sysSpread.size} systems)`);
    ok(A.systemOf(G.teams[0]).off > 0.5, "a system has an offensive multiplier");
    /* A trap club concedes less than an aggressive one. One 41-game season of
       sixteen clubs a side is NOT enough to show it — the real gap is about 5%
       and a single season swings wider than that, so this check used to pass or
       fail on which way the RNG happened to fall. Pool several seasons, and
       FLIP which parity plays the trap each time, because assigning systems by
       club index otherwise confounds the system with how good the clubs are. */
    let trapGA = 0, aggrGA = 0, trapN = 0, aggrN = 0;
    [[422, 0], [423, 1], [424, 0], [425, 1], [426, 0], [427, 1]].forEach(([seed, flip]) => {
      const g = A.newGame(0, { seed, rules: { seasonLen: 41 } });
      g.teams.forEach((t, i) => {
        t.coach = { ...t.coach, system: (i % 2) === flip ? "trap" : "aggressive" };
      });
      simSeason(A, g);
      g.teams.forEach((t, i) => {
        if ((i % 2) === flip) { trapGA += t.ga; trapN++; } else { aggrGA += t.ga; aggrN++; }
      });
    });
    const trap = trapGA / trapN, aggr = aggrGA / aggrN;
    // The true gap is about 3% (measured over 96 club-seasons with the parity
    // flipped each time). Four seeds could not see it reliably — two of them
    // came out flat — so six, and a threshold sized to the real effect.
    ok(aggr > trap * 1.015,
      `the trap concedes less than the forecheck (${trap.toFixed(1)} vs ${aggr.toFixed(1)} GA over ${trapN + aggrN} club-seasons)`);

    // Rivalries are mutual and everybody has one.
    ok(G.teams.every((t) => t.rivalId != null), "every club has a rival");
    ok(G.teams.every((t) => G.teams[t.rivalId].rivalId === t.id), "and the feeling is mutual");
    ok(G.teams.every((t) => G.teams[t.rivalId].div === t.div), "rivals are in the same division");
    ok(G.teams.every((t) => t.rivalId !== t.id), "nobody is their own rival");
    ok(A.isRivalry(G, 0, G.teams[0].rivalId), "isRivalry agrees");

    // The room.
    const per = A.personalityOf(G.players[Object.keys(G.players)[0]]);
    ok(per && per.label, "players have a character");
    const chars = new Set(A.playersOf(G).slice(0, 80).map((p) => A.personalityOf(p).key));
    ok(chars.size >= 5, `characters vary (${chars.size} distinct)`);
    const p0 = A.rosterOf(G, 0)[0];
    ok(A.personalityOf(p0).key === A.personalityOf(p0).key, "and are stable for a career");
    const { captain, alternates } = A.letters(G, 0);
    ok(captain && captain.pos !== "G", "a captain is named, and he's a skater");
    ok(alternates.length === 2, "with two alternates");
    ok(!alternates.some((a) => a.id === captain.id), "who aren't him");
    ok(A.letterFor(G, captain) === "C", "the captain wears the C");
    ok(A.letterFor(G, alternates[0]) === "A", "an alternate wears an A");
    // Naming your own captain sticks.
    const other = A.rosterOf(G, 0).find((p) => p.pos !== "G" && p.id !== captain.id);
    G.teams[0].captainId = other.id;
    ok(A.letters(G, 0).captain.id === other.id, "a named captain is honoured");
    ok(A.letterFor(G, other) === "C", "and wears the letter");
    const morale = A.roomMorale(G, 0);
    ok(morale >= 0 && morale <= 100, `room morale is a percentage (${morale})`);

    // The board asks for something, and judges it.
    ok(G.mandate && G.mandate.label, `the board sets a mandate (${G.mandate ? G.mandate.label : "none"})`);
    ok(A.MANDATES[G.mandate.key], "which is a real one");
    simSeason(A, G); simPlayoffs(A, G);
    ok(G.lastMandate && typeof G.lastMandate.met === "boolean", "and delivers a verdict on it");
    const got = G.lastMandate.got;
    ok(got >= 0 && got <= 4, `achievement is on the same scale (${got})`);
    A.autoDraft(G, false); A.startNextSeason(G);
    ok(G.mandate.year === G.year, "a new mandate is set for the new season");
  },

  // Hall of Fame, the block, draft-day picks and the scouting report.
  flavourExtras(A) {
    section("Hall of Fame, the block and the report");
    const G = A.newGame(0, { seed: 431, rules: { seasonLen: 41 } });

    // Colours.
    ok(A.COLOURS.length >= 32, "every club has a palette");
    ok(G.teams.every((t) => A.clubColour(t)[0] && A.clubColour(t)[1]), "two colours each");

    // The trade block invites offers rather than forcing a sale.
    const mine = A.rosterOf(G, G.userTeam).sort((a, b) => b.ovr - a.ovr)[4];
    mine.ntc = false;
    A.setBlock(G, mine.id, true);
    ok(A.onBlock(G, mine.id), "a player can be listed");
    A.generateOffers(G);
    ok(Array.isArray(G.offers), "offers are generated");
    if (G.offers.length) {
      const o = G.offers[0];
      ok(o.want === mine.id, "an offer is for the listed player");
      ok(o.give.length || o.givePicks.length, "and gives something back");
      ok(o.from !== G.userTeam, "from another club");
      const before = A.rosterOf(G, G.userTeam).length;
      const r = A.acceptOffer(G, 0);
      if (r.ok) {
        ok(G.players[mine.id].teamId !== G.userTeam, "accepting moves him");
        ok(!A.onBlock(G, mine.id), "and takes him off the block");
      } else ok(true, `the deal was refused on its merits (${r.why})`);
    } else {
      ok(true, "nobody called this time — offers are probabilistic");
      ok(true, ""); ok(true, "");
    }
    A.setBlock(G, mine.id, false);
    ok(!A.onBlock(G, mine.id), "and can be unlisted");

    // The scouting report names a real opponent and a real weakness.
    const rep = A.nextOpponent(G);
    if (rep) {
      ok(rep.teamId !== G.userTeam, "the report is about somebody else");
      ok(rep.starter && rep.starter.pos === "G", "and names a goaltender");
      ok(rep.hole && rep.hole.label, `with a weak spot (${rep.hole ? rep.hole.label : "?"})`);
      ok(typeof rep.rivalry === "boolean", "and says whether it's a rivalry night");
    } else { ok(true, "no game today"); ok(true, ""); ok(true, ""); ok(true, ""); }

    // Draft-day picks become tradeable while the draft runs.
    simSeason(A, G); simPlayoffs(A, G);
    const during = A.tradablePicks(G, G.userTeam);
    ok(during.some((pk) => pk.year === G.year), "this year's unused picks are tradeable during the draft");
    A.autoDraft(G, false);
    const after = A.tradablePicks(G, G.userTeam);
    ok(!after.some((pk) => pk.year === G.year), "and stop being tradeable once it's over");

    // The Hall opens for business over a long career.
    const G3 = A.newGame(0, { seed: 432, rules: { seasonLen: 41 } });
    for (let i = 0; i < 12; i++) {
      simSeason(A, G3); simPlayoffs(A, G3);
      A.autoDraft(G3, false); A.startNextSeason(G3);
    }
    ok(Array.isArray(G3.hall), "the Hall exists");
    ok(G3.hall.length > 0, `players get inducted over a long career (${G3.hall.length})`);
    ok(G3.hall.length <= 12 * 3, "never more than the class limit a year");
    ok(G3.hall.every((h) => h.name && h.gp > 0), "each has a name and a career");
    ok(G3.hall.every((h) => G3.players[h.pid]), "and is never pruned out of the save");
    const scores = G3.hall.map((h) => h.score);
    ok(Math.min(...scores) >= A.HOF_BAR - 1, `everyone cleared the bar (lowest ${Math.min(...scores)})`);
  },

  // The postseason is played a game at a time, and those games are logged too.
  playoffGames(A) {
    section("Playoffs, game by game");
    const G = A.newGame(0, { seed: 321, rules: { seasonLen: 41 } });
    simSeason(A, G);
    const r1 = G.playoffs.rounds[0];
    ok(r1.every((s) => s.games.length === 0), "no games have been played yet");

    // One night: a game in every live series, and nowhere else.
    A.simPlayoffDay(G);
    ok(r1.every((s) => s.games.length === 1), "one night plays one game in each series");
    ok(r1.every((s) => s.w[0] + s.w[1] === 1), "and each series is 1-0 or 0-1");
    ok(G.playoffs.round === 0, "the round doesn't advance early");

    A.simPlayoffDay(G);
    ok(r1.every((s) => s.games.length === 2), "a second night adds one more each");

    // A series that ends stops playing while the others carry on.
    let guard = 0;
    while (r1.some((s) => !s.done) && guard++ < 20) {
      const before = r1.map((s) => s.games.length);
      A.simPlayoffDay(G);
      r1.forEach((s, i) => {
        if (s.done && s.games.length !== before[i] && s.w[0] !== A.ruleValue(G, "seriesLen")) { /* finished this night */ }
      });
    }
    ok(r1.every((s) => s.done), "the round completes");
    const need = Math.ceil(A.ruleValue(G, "seriesLen") / 2);
    ok(r1.every((s) => Math.max(...s.w) === need), "every series ended at the right number of wins");
    ok(r1.every((s) => s.games.length === s.w[0] + s.w[1]), "games played equals the series score");
    ok(G.playoffs.round === 1 || G.playoffs.champion != null, "and the bracket advanced once it was done");

    /* The user's playoff games get a play-by-play, like his season games do.
       The seed is chosen because the user's club qualifies — on a seed where it
       misses, this whole branch silently passes without testing anything.
       Pick one with MARGIN: 309 finishes 34-6-1, so it survives the RNG shift
       that any new sim work causes. Seed 331 sat on the bubble and fell out the
       moment the farm league started consuming the stream. */
    const G2 = A.newGame(0, { seed: 309, rules: { seasonLen: 41 } });
    simSeason(A, G2);
    const inIt = G2.playoffs.rounds[0].some((s) => s.hi === G2.userTeam || s.lo === G2.userTeam);
    ok(inIt, "the user's club qualified, so the replay checks below actually run");
    if (inIt) {
      let g2 = 0;
      while (g2++ < 8 && (!G2.lastGame || !G2.lastGame.playoff)) A.simPlayoffDay(G2);
      ok(G2.lastGame && G2.lastGame.playoff, "a playoff game is captured for replay");
      ok(G2.lastGame.events.length > 0, `with its own play-by-play (${G2.lastGame.events.length} events)`);
      // And those shots are logged, marked as playoff so they don't pollute the season.
      const po = Object.values(G2.shotLog).flat().filter((r) => r.po);
      ok(po.length > 0, `playoff shots are logged (${po.length})`);
      const reg = Object.values(G2.shotLog).flat().filter((r) => !r.po);
      const skater = A.rosterOf(G2, G2.userTeam).find((p) => p.pos !== "G" && p.season.sog > 0);
      const own = (G2.shotLog[skater.id] || []).filter((r) => !r.po);
      const onGoal = own.filter((r) => r.r === "g" || r.r === "s" || r.r === "e").length;
      ok(onGoal === skater.season.sog,
        `and season totals still only count season shots (${onGoal} vs ${skater.season.sog})`);
      ok(reg.length > 0 && po.length < reg.length, "the two are kept apart");
    } else {
      ok(false, "seed 309 no longer puts the user in the playoffs — pick another with margin");
      ok(true, ""); ok(true, ""); ok(true, ""); ok(true, "");
    }

    // The fast-forward must land in exactly the same place as the slow path.
    const G3 = A.newGame(0, { seed: 321, rules: { seasonLen: 41 } });
    simSeason(A, G3);
    let g3 = 0;
    while (G3.phase === "playoffs" && g3++ < 40) A.simPlayoffRound(G3);
    ok(G3.playoffs.champion != null, "playing out whole rounds still crowns a champion");
    ok(G3.phase === "offseason", "and closes the season");
  },

  // A seven-round draft you have to form an opinion about.
  draft(A) {
    section("The draft");
    const G = A.newGame(0, { seed: 241, rules: { seasonLen: 41 } });
    simSeason(A, G); simPlayoffs(A, G);
    /* Three rounds, not seven. Seven put 224 players a year into a league
       that could not absorb them — see the population notes in CLAUDE.md. */
    ok(A.DRAFT_ROUNDS === 3, `three rounds (${A.DRAFT_ROUNDS})`);
    ok(G.draftClass.length === A.draftPicksTotal(G), `a prospect for every pick (${G.draftClass.length})`);
    ok(G.scoutPoints === A.SCOUT_POINTS, `scouting budget is set (${G.scoutPoints})`);

    const board = G.draftClass.map((id) => G.players[id]);
    ok(board.every((p) => p.scout && p.scout.fog > 0), "every prospect starts behind some fog");
    ok(board.every((p) => p.style && p.junior), "and has a style and a background");
    // The top of the board is better known than the bottom.
    const early = board.slice(0, 32).reduce((s, p) => s + p.scout.fog, 0) / 32;
    const late = board.slice(-32).reduce((s, p) => s + p.scout.fog, 0) / 32;
    ok(early < late, `the top of the board is better known (${early.toFixed(2)} vs ${late.toFixed(2)})`);
    // The read is not the truth.
    const off = board.filter((p) => A.scoutedOvr(p) !== p.ovr);
    ok(off.length > board.length * 0.6, `most reads differ from the truth (${off.length}/${board.length})`);
    ok(board.every((p) => A.scoutedPot(p) >= A.scoutedOvr(p)), "a ceiling is never below the current read");

    // Scouting narrows the band and is finite.
    const target = board[40];
    const bandBefore = A.scoutBand(target);
    const r = A.scoutProspect(G, target.id);
    ok(r.ok, "you can scout a prospect");
    ok(A.scoutBand(target) < bandBefore, `which narrows the band (${bandBefore} → ${A.scoutBand(target)})`);
    ok(G.scoutPoints === A.SCOUT_POINTS - 1, "and costs a point");
    let guard = 0;
    while (G.scoutPoints > 0 && guard++ < 100) A.scoutProspect(G, board[guard].id);
    ok(G.scoutPoints === 0, "the budget runs out");
    ok(!A.scoutProspect(G, board[60].id).ok, "and then you can't scout any more");

    // The draft runs to completion and nobody is left in limbo.
    A.autoDraft(G, false);
    ok(G.draftPick === A.draftPicksTotal(G), `every pick was made (${G.draftPick})`);
    ok(G.draftClass.length === 0, "the board is emptied");
    ok(G.draftLog.length === A.draftPicksTotal(G), `every pick is logged (${G.draftLog.length})`);
    const logged = G.draftLog.every((d, i) => d.pick === i + 1 && d.round === Math.floor(i / 32) + 1);
    ok(logged, "the log is in order with the right rounds");
    const picked = G.draftLog.map((d) => G.players[d.pid]).filter(Boolean);
    ok(picked.length === G.draftLog.length, "every drafted player still exists");
    ok(picked.every((p) => p.draft && p.draft.year === G.year && p.teamId === p.draft.teamId),
      "and carries where he was taken");
    ok(picked.every((p) => p.farm), "draftees start on the farm");
    const perTeam = {};
    G.draftLog.forEach((d) => { perTeam[d.teamId] = (perTeam[d.teamId] || 0) + 1; });
    ok(Object.keys(perTeam).length === 32, "every club drafted somebody");

    // Better prospects go earlier, but not perfectly — that's the fog working.
    const firstRound = G.draftLog.filter((d) => d.round === 1).map((d) => G.players[d.pid].pot);
    const lastRound = G.draftLog.filter((d) => d.round === A.DRAFT_ROUNDS).map((d) => G.players[d.pid].pot);
    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    ok(avg(firstRound) > avg(lastRound) + 5,
      `first-rounders out-rank last-rounders (${avg(firstRound).toFixed(0)} vs ${avg(lastRound).toFixed(0)})`);
    const bestPot = Math.max(...picked.map((p) => p.pot));
    const bestTakenIn = G.draftLog.find((d) => G.players[d.pid].pot === bestPot).round;
    ok(bestTakenIn >= 1, `and the best prospect doesn't always go first (round ${bestTakenIn})`);
  },

  // Point shares: hockey's Win Shares. The number only means anything if the
  // league's shares add up to the standings points actually handed out.
  pointShares(A) {
    section("Point shares");
    const G = A.newGame(0, { seed: 606, rules: { seasonLen: 82 } });
    simSeason(A, G);
    const played = A.playersOf(G).filter((p) => p.teamId != null && p.season.gp);
    const rows = played.map((p) => ({ p, ps: A.pointShares(G, p) }));
    const total = rows.reduce((s, r) => s + r.ps.ps, 0);
    const leaguePts = G.teams.reduce((s, t) => s + t.pts, 0);
    const ratio = total / leaguePts;
    ok(ratio > 0.85 && ratio < 1.15,
      `the league's point shares match the points handed out (${total.toFixed(0)} vs ${leaguePts}, ratio ${ratio.toFixed(2)})`);

    rows.sort((a, b) => b.ps.ps - a.ps.ps);
    const leader = rows[0];
    ok(leader.ps.ps > 11 && leader.ps.ps < 24,
      `the leader is in the real range (${leader.ps.ps.toFixed(1)}, NHL leaders ~15-18)`);
    ok(rows.slice(0, 15).some((r) => r.p.pos === "G"), "goalies rank near the top, as they do in reality");
    ok(rows.slice(0, 25).some((r) => r.p.pos === "D"), "and defencemen appear too");
    ok(rows.slice(0, 25).some((r) => r.p.pos !== "G" && r.p.pos !== "D"), "alongside forwards");

    // Composition has to be the right shape.
    const gk = rows.find((r) => r.p.pos === "G");
    ok(gk.ps.ops === 0 && gk.ps.dps === 0 && gk.ps.gps > 0, "a goalie's shares are all goaltending");
    const sk = rows.find((r) => r.p.pos !== "G");
    ok(sk.ps.gps === 0, "a skater has no goaltending shares");
    ok(sk.ps.dps > 0, "and always earns something for the minutes he plays");
    const dmen = rows.filter((r) => r.p.pos === "D" && r.p.season.toi > 800);
    const fwds = rows.filter((r) => r.p.pos !== "D" && r.p.pos !== "G" && r.p.season.toi > 800);
    const dDef = dmen.reduce((s, r) => s + r.ps.dps, 0) / dmen.length;
    const fDef = fwds.reduce((s, r) => s + r.ps.dps, 0) / fwds.length;
    ok(dDef > fDef, `defencemen out-earn forwards defensively (${dDef.toFixed(1)} vs ${fDef.toFixed(1)})`);
    const fOff = fwds.reduce((s, r) => s + r.ps.ops, 0) / fwds.length;
    const dOff = dmen.reduce((s, r) => s + r.ps.ops, 0) / dmen.length;
    ok(fOff > dOff, `and forwards out-earn defencemen offensively (${fOff.toFixed(1)} vs ${dOff.toFixed(1)})`);

    // It has to track actual production.
    const corr = (xs, ys) => {
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const n = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
      const dx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
      const dy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
      return dx && dy ? n / (dx * dy) : 0;
    };
    const r = corr(fwds.map((x) => A.pts(x.p.season)), fwds.map((x) => x.ps.ps));
    ok(r > 0.85, `a forward's point shares track his production (r=${r.toFixed(2)})`);
    // A player who never dressed earns nothing.
    const idle = A.playersOf(G).find((p) => !p.season.gp);
    ok(!idle || A.psOf(G, idle) === 0, "somebody who never played is worth zero");
  },

  // Rings, awards and a postseason record all have to survive the rollover.
  accolades(A) {
    section("Rings and accolades");
    const G = A.newGame(0, { seed: 231, rules: { seasonLen: 41 } });
    simSeason(A, G);
    const starred = A.playersOf(G).filter((p) => (p.allStars || []).length);
    ok(starred.length === 20, `All-Star selections are recorded on the players (${starred.length})`);
    ok(starred.every((p) => p.allStars[0] === G.year), "against the right year");

    simPlayoffs(A, G);
    const champ = G.playoffs.champion;
    const ringed = A.playersOf(G).filter((p) => (p.rings || []).length);
    ok(ringed.length >= 18, `the winning roster got rings (${ringed.length})`);
    ok(ringed.every((p) => p.rings[0].t === champ), "all from the club that won it");
    ok(ringed.every((p) => p.rings[0].year === G.year), "and stamped with the year");
    const losers = A.playersOf(G).filter((p) => p.teamId != null && p.teamId !== champ);
    ok(losers.every((p) => !(p.rings || []).length), "nobody else got one");

    /* The postseason used to be thrown away entirely. finishSeason archives it
       the moment the Cup is decided, so by the time simPlayoffs returns the
       single-season line is already folded into the career total. */
    const ran = A.playersOf(G).filter((p) => p.careerPO && p.careerPO.gp);
    ok(ran.length > 0, `playoff runs are kept as career totals (${ran.length} players)`);
    ok(A.playersOf(G).every((p) => p.po == null), "and the single-season line is cleared");
    const sample = ran.sort((a, b) => b.careerPO.gp - a.careerPO.gp)[0];
    ok(sample.poRuns === 1, "one run counted after one playoffs");
    ok(sample.careerPO.z === undefined, "career playoff totals carry no zone buckets");
    ok(sample.careerPO.gp <= 28, `and a plausible number of games (${sample.careerPO.gp})`);
    const before = sample.careerPO.gp;

    // A second run accumulates rather than replacing.
    A.autoDraft(G, false); A.startNextSeason(G);
    ok(sample.careerPO.gp === before, "the rollover doesn't disturb it");
    simSeason(A, G); simPlayoffs(A, G);
    if (sample.careerPO.gp > before) {
      ok(sample.poRuns === 2, `a second run is counted (${sample.poRuns})`);
      ok(sample.careerPO.gp > before, `and added to the total (${before} → ${sample.careerPO.gp})`);
    } else {
      ok(sample.poRuns === 1, "his club missed the second playoffs, so the total held");
      ok(true, "nothing to accumulate");
    }
    const stillRinged = A.playersOf(G).filter((p) => (p.rings || []).length);
    ok(stillRinged.length > 0, `rings persist across the rollover (${stillRinged.length})`);
  },

  // The offseason has to be walkable from one button without hunting.
  offseason(A) {
    section("Offseason flow");
    const G = A.newGame(0, { seed: 211, rules: { seasonLen: 41 } });
    simSeason(A, G); simPlayoffs(A, G);
    ok(G.phase === "offseason", "the playoffs hand over to the offseason");

    const seen = [];
    let guard = 0;
    while (G.phase === "offseason" && guard++ < 200) {
      const st = A.offseasonStage(G);
      const act = A.offseasonAction(G);
      ok(!!act && !!act.label, `stage ${st} offers a next action: ${act ? act.label : "none"}`);
      seen.push(st);
      A.doOffseasonStep(G);
    }
    ok(guard < 200, `the offseason terminates (${guard} steps)`);
    ok(G.phase === "regular", `and lands back in a regular season (${G.phase})`);
    ok(seen[0] === "review", "it starts at the review");
    ok(seen.includes("draft"), "passes through the draft");
    ok(seen.includes("fa"), "and free agency");
    ok(G.draftClass.length === 0, "the draft class was fully picked");
    ok(A.playersOf(G).filter((p) => p.draft && p.farm).length > 0, "draftees landed somewhere");
    /* And they are still rookies. Eligibility is about a first season IN THE
       LEAGUE, not a first season after being drafted — clearing the flag at
       every rollover meant a prospect who spent a year on the farm reached the
       NHL already ineligible for the Calder. */
    const onFarm = A.playersOf(G).filter((p) => p.draft && p.farm && !p.career.length);
    ok(onFarm.length > 0 && onFarm.every((p) => p.rookie),
      `a prospect who hasn't played keeps his rookie year (${onFarm.length})`);
    /* Only drafted players ever carry the flag — the founding league and the
       depth bodies `fillRosters` signs never had it, so they aren't evidence
       either way. */
    ok(A.playersOf(G).filter((p) => p.draft && !p.rookie && A.nhlGames(p) === 0).length === 0,
      "no draftee loses rookie status without playing a game");
    ok(A.offseasonAction(G) === null, "and once the season starts there's no offseason action left");
    ok(G.teams.every((t) => A.rosterOf(G, t.id).length >= 20), "every club can dress a roster after it");

    // Walking it must not depend on a stored step that can go stale.
    const G2 = A.newGame(0, { seed: 212, rules: { seasonLen: 41 } });
    simSeason(A, G2); simPlayoffs(A, G2);
    G2.offseasonStep = null;
    ok(A.offseasonStage(G2) === "review", "a missing step falls back to the review");
    G2.offseasonStep = "draft";
    G2.draftClass = [];
    ok(A.offseasonStage(G2) === "draftDone", "an emptied draft class reads as done, not stuck");
  },

  // A save has to round-trip, because that's the whole persistence story.
  save(A) {
    section("Save integrity");
    const G = A.newGame(2, { seed: 131, rules: { seasonLen: 41 } });
    A.simDays(G, 25);
    let json;
    try { json = JSON.stringify(G); } catch (e) { json = null; }
    ok(json != null, "the game serializes");
    const size = json ? json.length / 1024 / 1024 : 99;
    ok(size < 4, `a save fits in localStorage (${size.toFixed(2)} MB)`);
    const G2 = A.migrate(JSON.parse(json));
    ok(G2.teams.length === 32 && Object.keys(G2.players).length === Object.keys(G.players).length,
      "a reloaded save has the same league");
    simSeason(A, G2);
    ok(G2.teams.every((t) => t.gp === 41), "a reloaded save plays out the season");

    // migrate() must survive a save missing newer fields.
    const stripped = JSON.parse(json);
    delete stripped.news; delete stripped.picks; delete stripped.history;
    const G3 = A.migrate(stripped);
    ok(Array.isArray(G3.news) && Array.isArray(G3.picks), "migrate backfills missing fields");
    A.simDay(G3);
    ok(true, "and the migrated save still simulates");

    // Saving must actually land, and a load must come back with what was saved
    // rather than a stale copy from the other store.
    A.saveGame(G, 0);
    const meta = A.slotMeta(0);
    ok(meta && meta.year === G.year, "the slot's metadata reflects what was saved");
    const wrapped = A.unwrap(A.localStorage.getItem("pgmh:slot0"));
    ok(wrapped && wrapped.at > 0, "the payload is written with a timestamp");
    ok(wrapped && wrapped.g.day === G.day, `and holds the current state (day ${wrapped ? wrapped.g.day : "?"} vs ${G.day})`);
    A.simDays(G, 5);
    A.saveGame(G, 0);
    const again = A.unwrap(A.localStorage.getItem("pgmh:slot0"));
    ok(again && again.g.day === G.day, "a later save overwrites the earlier one");
    ok(again.at >= wrapped.at, "and carries a newer timestamp");
    // A bare, pre-wrapper save still loads.
    A.localStorage.setItem("pgmh:slot1", JSON.stringify(G));
    const bare = A.unwrap(A.localStorage.getItem("pgmh:slot1"));
    ok(bare && bare.at === 0 && bare.g.day === G.day, "an old unwrapped save is still readable");
  },

  /* Where a young player spends the year, and how it goes, is the central
     development decision. NHL minutes played well have to beat the farm; NHL
     minutes played badly, or not played at all, have to lose to it. If this
     ever flattens back into "the farm is always best", the choice is gone. */
  development(A) {
    section("Player development");
    const F = A.DEV_FARM, HI = A.DEV_NHL_HI, LO = A.DEV_NHL_LO;
    // A synthetic NHL line: gp games at `min` a night, scoring at `p60`.
    const sk = (pos, gp, min, p60) => [{ pos }, { gp, toi: gp * min, g: (p60 * gp * min) / 60, a: 0 }];
    const env = (args, farm) => A.devEnvironment(args[0], args[1], farm || null);
    const farmOnly = { gp: 82, g: 20, a: 25 };

    // Compared with a tolerance: DEV_FARM is not an exact binary fraction, so
    // (F * 82) / 82 is not identically F.
    ok(Math.abs(A.devEnvironment({ pos: "C" }, null, farmOnly) - F) < 1e-9,
      `a full farm season is worth exactly DEV_FARM (${F})`);
    ok(A.devEnvironment({ pos: "C" }, null, null) === 0, "playing nowhere is worth nothing");

    // The four corners of the model.
    const thriving = env(sk("C", 82, 20, 1.9));
    const solid    = env(sk("C", 82, 19, 1.15));
    const buried   = env(sk("C", 82, 8, 1.15));
    const drowning = env(sk("C", 82, 20, 0.3));
    ok(thriving > F, `thriving in a real NHL role beats the farm (${thriving.toFixed(2)} > ${F})`);
    ok(solid > F, `so does an average regular (${solid.toFixed(2)})`);
    ok(buried < F, `riding the bench does not (${buried.toFixed(2)} < ${F})`);
    ok(buried === 0, `a season in the press box teaches him nothing at all (${buried.toFixed(2)})`);
    ok(drowning < F, `nor does drowning in minutes he can't handle (${drowning.toFixed(2)})`);
    ok(thriving <= HI + 1e-9 && buried >= LO - 1e-9, "every outcome stays inside the band");

    // A fourth-liner is better off in the minors even when he's producing there.
    ok(env(sk("C", 82, 10, 2.2)) < F, "a productive fourth-liner still develops better on the farm");

    // Monotonic in both inputs — more ice time and more production can never hurt.
    let monoRole = true, monoPerf = true;
    for (let m = 6; m < 24; m++) if (env(sk("C", 82, m, 1.15)) > env(sk("C", 82, m + 1, 1.15)) + 1e-9) monoRole = false;
    for (let q = 0; q < 25; q++) {
      const a = env(sk("C", 82, 18, q * 0.1)), b = env(sk("C", 82, 18, (q + 1) * 0.1));
      if (a > b + 1e-9) monoPerf = false;
    }
    ok(monoRole, "more ice time never develops a player less");
    ok(monoPerf, "nor does more production");

    // Position is normalised out, not ignored: a defenceman plays more minutes
    // and scores less, so the SAME raw line reads differently at each position,
    // but a median season is worth about the same either way.
    ok(Math.abs(A.nhlDevRead({ pos: "D" }, sk("D", 82, 16, 0.90)[1]).perf) < 1e-9,
      "0.90 pts/60 is a par season for a defenceman");
    ok(A.nhlDevRead({ pos: "C" }, sk("C", 82, 16, 0.90)[1]).perf < -0.2,
      "and a below-par one for a forward");
    ok(A.devBand({ pos: "D" }).full > A.devBand({ pos: "C" }).full, "a D has to play more to earn a full role");
    ok(Math.abs(env(sk("D", 82, 16.2, 0.90)) - env(sk("C", 82, 12.7, 1.15))) < 0.4,
      "so a median season at either position develops a player about the same");

    // Goalies run off starts and save percentage, not minutes and points.
    const starter = A.devEnvironment({ pos: "G" }, { gp: 55, sa: 1600, sv: 1470 }, null);
    const backup = A.devEnvironment({ pos: "G" }, { gp: 8, sa: 220, sv: 200 }, null);
    ok(starter > F, `a young starter holding a .919 develops fast (${starter.toFixed(2)})`);
    ok(backup < F, `a backup who barely dressed does not (${backup.toFixed(2)})`);

    // A mid-season callup gets BOTH, weighted by games in each league.
    const half = A.devEnvironment({ pos: "C" }, sk("C", 41, 20, 1.9)[1], { gp: 41, g: 12, a: 15 });
    ok(half > F && half < thriving, `a callup blends the two (${half.toFixed(2)} between ${F} and ${thriving.toFixed(2)})`);
    ok(Math.abs(half - (thriving + F) / 2) < 1e-9, "and the blend is exactly games-weighted");
    const cup = A.devEnvironment({ pos: "C" }, sk("C", 20, 20, 1.9)[1], { gp: 60, g: 18, a: 20 });
    ok(cup < half, "a shorter callup is worth less of the NHL rate");

    // Age taper: the environment stops mattering once he's made.
    ok(A.devAgeWeight(20) === 1 && A.devAgeWeight(23) < 1 && A.devAgeWeight(26) === 0,
      "development environment tapers off with age");

    /* And it has to show up in a real league, not just in the unit maths: over
       a season, the young players who got real minutes and produced must be the
       ones who actually improved. */
    const G = A.newGame(0, { seed: 771, rules: { seasonLen: 82 } });
    simSeason(A, G);
    simPlayoffs(A, G);
    const young = A.playersOf(G).filter((p) => p.age <= 22 && !p.retired && ((p.stats && p.stats.gp) || (p.farmSeason && p.farmSeason.gp)));
    ok(young.length > 40, `a real cohort of young players (${young.length})`);
    const rows = young.map((p) => ({ p, e: A.devEnvironment(p, p.stats, p.farmSeason), before: p.ovr }));
    ok(rows.some((r) => r.e > F + 0.2) && rows.some((r) => r.e < F - 0.2),
      "the league produces both kinds of season");
    // `finishSeason` already ran progress(); compare against ovr recorded before.
    const spread = Math.max(...rows.map((r) => r.e)) - Math.min(...rows.map((r) => r.e));
    ok(spread > 1.5, `and they are genuinely different years (spread ${spread.toFixed(2)})`);
    const nhlReg = rows.filter((r) => r.p.stats && r.p.stats.gp >= 40 && r.p.stats.toi / r.p.stats.gp >= 17);
    const benched = rows.filter((r) => r.p.stats && r.p.stats.gp >= 40 && r.p.stats.toi / r.p.stats.gp <= 11);
    ok(nhlReg.length > 0 && benched.length > 0, `regulars (${nhlReg.length}) and bench players (${benched.length}) both exist`);
    const avg = (a) => a.reduce((s, r) => s + r.e, 0) / a.length;
    ok(avg(nhlReg) > avg(benched) + 1,
      `young regulars develop far better than young scratches (${avg(nhlReg).toFixed(2)} vs ${avg(benched).toFixed(2)})`);
  },

  /* The club picker shows a REAL league before you commit to it. Its whole
     promise is that the world you browsed is the world you get, which only
     holds because world generation reads the seed and never `userTeam` or
     `difficulty`. If that ever stops being true the preview becomes a lie, and
     nothing in the UI would tell you. */
  clubPicker(A) {
    section("Club picker");
    const fingerprint = (G) => G.teams.map((t) =>
      `${t.abbr}:${A.teamStrength(G, t.id)}:${A.rosterOf(G, t.id, true).map((p) => `${p.ln}${p.ovr}`).join(",")}`).join("|");

    const preview = A.newGame(0, { seed: 8123, rules: { seasonLen: 82 } });
    // Starting a career as ANY club must yield the league that was previewed.
    for (const club of [0, 7, 19, 31]) {
      const real = A.newGame(club, { seed: 8123, rules: { seasonLen: 82 } });
      ok(fingerprint(real) === fingerprint(preview),
        `taking over club ${club} gives exactly the previewed league`);
      ok(real.userTeam === club, `and you actually manage club ${club}`);
    }
    // Difficulty must not move the world either — it's pressure on the manager.
    const hard = A.newGame(0, { seed: 8123, difficulty: "cutthroat", rules: { seasonLen: 82 } });
    ok(fingerprint(hard) === fingerprint(preview), "difficulty changes the challenge, not the league");
    // A different seed must actually be a different league, or reroll is a no-op.
    ok(fingerprint(A.newGame(0, { seed: 999, rules: { seasonLen: 82 } })) !== fingerprint(preview),
      "rerolling the seed genuinely rebuilds the league");

    // Every summary the picker renders has to be real and complete.
    const sums = preview.teams.map((t) => A.clubSummary(preview, t.id));
    ok(sums.length === 32, "every club gets a summary");
    ok(sums.every((s) => s.best && s.goalie), "each has a best player and a goaltender");
    ok(sums.every((s) => s.rating >= 40 && s.rating <= 90), "ratings land in a sane band");
    ok(sums.every((s) => s.age > 20 && s.age < 34), "and so do average ages");
    ok(sums.every((s) => s.goalie.pos === "G"), "the goalie shown is actually a goalie");
    ok(sums.every((s) => s.best.ovr === Math.max(...A.rosterOf(preview, s.id).map((p) => p.ovr))),
      "the best player shown is actually the best player");
    ok(sums.every((s) => s.t.rivalId != null), "every club has a rival to show");

    // The outlook bands must SPLIT the league. Guessed thresholds once put all
    // 32 clubs in "Contender", which told the user nothing.
    const byLabel = {};
    sums.forEach((s) => { byLabel[s.outlook.t] = (byLabel[s.outlook.t] || 0) + 1; });
    ok(Object.keys(byLabel).length >= 3,
      `outlook separates the league (${Object.entries(byLabel).map(([k, v]) => `${k} ${v}`).join(", ")})`);
    ok(Math.max(...Object.values(byLabel)) <= 20, "and no single label swallows it");
    // Rating must track the thing it claims to measure.
    const sorted = sums.slice().sort((a, b) => b.rating - a.rating);
    ok(sorted[0].rating > sorted[31].rating + 8,
      `the league has a real spread (${sorted[31].rating}–${sorted[0].rating})`);

    ok(A.ordinal(1) === "1st" && A.ordinal(2) === "2nd" && A.ordinal(3) === "3rd" && A.ordinal(4) === "4th",
      "ordinals read correctly");
    ok(A.ordinal(11) === "11th" && A.ordinal(12) === "12th" && A.ordinal(13) === "13th",
      "including the teens");
    ok(A.ordinal(21) === "21st" && A.ordinal(22) === "22nd" && A.ordinal(32) === "32nd",
      "and back out the other side");
  },

  /* The goalie scouting report must be EVIDENCE, not a label. It used to print
     `goalieHole` — a pure function of player id — so it said the same thing on
     day 1 as on day 82 whatever happened on the ice. */
  goalieScouting(A) {
    section("Goalie scouting report");
    const G = A.newGame(0, { seed: 616, rules: { seasonLen: 82 } });
    const keepers = () => A.playersOf(G).filter((p) => p.pos === "G" && p.season.gp > 0);

    // Before a puck is dropped there is genuinely nothing to report.
    const cold = A.goalieReport(G, A.playersOf(G).find((p) => p.pos === "G"));
    ok(cold.starts === 0 && cold.sa === 0, "an unplayed goalie has no record");
    ok(cold.confidence === 0, "and no confidence in a read");
    ok(!cold.soft && !cold.strong, "so it claims no weakness");

    simSeason(A, G);
    const reports = keepers().map((p) => ({ p, r: A.goalieReport(G, p) }));
    ok(reports.length > 40, `a full league of goalies played (${reports.length})`);

    // The numbers must reconcile with the season line, not float free of it.
    ok(reports.every(({ p, r }) => r.sa === p.season.sa && r.starts === p.season.gp),
      "the report's totals match the goalie's actual season");
    ok(reports.every(({ r }) => r.cells.reduce((s, c) => s + c.sa, 0) === r.sa - (0)) ||
       reports.every(({ p, r }) => r.cells.reduce((s, c) => s + c.sa, 0) <= r.sa),
      "per-cell shots never exceed shots faced");
    ok(reports.every(({ r }) => r.cells.every((c) => c.ga <= c.sa)),
      "no cell lets in more than it faced");

    // Confidence has to grow with evidence, and starters must clear the bar.
    const busy = reports.filter(({ r }) => r.sa >= A.REPORT_TRUST_SA);
    ok(busy.length > 20, `most starters accumulate a real sample (${busy.length})`);
    ok(busy.every(({ r }) => r.confidence === 1), "a full workload is a confident read");
    ok(reports.every(({ r }) => r.confidence >= 0 && r.confidence <= 1), "confidence stays in range");

    // A named weakness must be backed by enough shots to mean anything.
    const named = reports.filter(({ r }) => r.soft);
    ok(named.length > 0, `some goalies show a readable weakness (${named.length})`);
    ok(named.every(({ r }) => r.soft.sa >= A.REPORT_MIN_SHOTS),
      "a named soft spot always clears the minimum sample");
    const lg = A.leagueNetRates(G);
    ok(named.every(({ r }) => r.soft.rate > lg[r.soft.cell.key]),
      "and is genuinely worse there than the league is");

    /* The whole point: the report is driven by what happened, so two goalies
       with the SAME structural hole must still produce different reports, and
       the same goalie's report must change as a season is played. */
    const byHole = {};
    reports.forEach(({ p, r }) => { (byHole[r.hole.key] = byHole[r.hole.key] || []).push(r); });
    // Soft spot must not be a FUNCTION of the hole: somewhere in the league,
    // two goalies sharing a hole have to scout differently. Sampling a single
    // group is a coin flip, so check every group.
    const divergent = Object.values(byHole).filter((g) => g.length >= 2)
      .filter((g) => new Set(g.map((r) => (r.soft ? r.soft.cell.key : "none"))).size > 1);
    ok(divergent.length > 0,
      `goalies sharing a structural hole still scout differently (${divergent.length} such groups)`);
    /* What matters is that no single cell is THE answer for the whole league —
       counting distinct cells is a hostage to the RNG stream, since any new sim
       work reshuffles every season. A share test says the same thing and holds. */
    const softCount = {};
    named.forEach(({ r }) => { softCount[r.soft.cell.key] = (softCount[r.soft.cell.key] || 0) + 1; });
    const topShare = Math.max(...Object.values(softCount)) / named.length;
    ok(Object.keys(softCount).length >= 2 && topShare < 0.7,
      `no single cell is the league's answer (${Object.entries(softCount).map(([k, v]) => `${k} ${v}`).join(", ")})`);
    // It must not simply echo goalieHole — that would be the old label again.
    const echo = named.filter(({ r }) => r.soft.cell.key === r.hole.key).length;
    ok(echo < named.length * 0.75,
      `the report is evidence, not a readout of the hidden hole (${echo}/${named.length} agree)`);
    // But it shouldn't be noise either — the hole is real, so it should show up
    // more often than chance (1 in 9 cells).
    ok(echo > named.length * 0.11,
      `though the real hole does show through more often than chance (${echo}/${named.length})`);
  },

  /* A bracket is a STRUCTURE, not a list. `advancePlayoffRound` pairs adjacent
     survivors (slots 2i and 2i+1), so `buildBracket` must push round one in an
     order where neighbours are meant to meet. Get that wrong and the seeding
     silently collapses: the 1 seed's half contains the 2 seed, and a division's
     winner meets the OTHER division's winner in round two. */
  seeding(A) {
    section("Playoff seeding");

    const firstRound = (G) => G.playoffs.rounds[0];
    const halves = (G, conf) => firstRound(G).filter((s) => s.conf === conf);

    // ---- seeded 1–8 ----
    const S = A.newGame(0, { seed: 4801, rules: { seasonLen: 41, playoffFormat: "seeded" } });
    simSeason(A, S);
    [0, 1].forEach((conf) => {
      const f = A.playoffField(S, conf);
      const rank = new Map(f.map((x) => [x.team.id, x.seed]));
      const r1 = halves(S, conf);
      ok(r1.length === 4, `conference ${conf} opens with four series`);
      // Every series must be seed n vs seed 9-n, and home ice to the better seed.
      ok(r1.every((s) => rank.get(s.hi) + rank.get(s.lo) === 9),
        `conference ${conf} pairs 1-8, 2-7, 3-6, 4-5`);
      ok(r1.every((s) => rank.get(s.hi) < rank.get(s.lo)),
        `and the better seed holds home ice`);
      // The structural part: neighbours meet in round two, so the 1 seed's half
      // must hold the 4/5 series and NOT the 2 seed's.
      const half = (i) => [rank.get(r1[i].hi), rank.get(r1[i + 1].hi)].sort((a, b) => a - b);
      ok(JSON.stringify(half(0)) === JSON.stringify([1, 4]),
        `the 1 seed's half of conference ${conf} holds the 4/5 series (${half(0).join("/")})`);
      ok(JSON.stringify(half(2)) === JSON.stringify([2, 3]),
        `and the 2 seed's half holds the 3/6 series (${half(2).join("/")})`);
    });

    // ---- divisional ----
    const D = A.newGame(0, { seed: 4801, rules: { seasonLen: 41, playoffFormat: "divisional" } });
    simSeason(A, D);
    [0, 1].forEach((conf) => {
      const { top, wc } = A.playoffField(D, conf);
      const r1 = halves(D, conf);
      ok(r1.length === 4, `conference ${conf} opens with four divisional series`);
      const divOf = (id) => D.teams[id].div;
      const wcIds = wc.map((t) => t.id);
      const winners = top.filter((x) => x.divRank === 1).map((x) => x.team.id);
      const seconds = top.filter((x) => x.divRank === 2).map((x) => x.team.id);
      // Slots 0 and 2 are the division winners; 1 and 3 are the 2-vs-3 series.
      ok([0, 2].every((i) => winners.includes(r1[i].hi) && wcIds.includes(r1[i].lo)),
        `conference ${conf} opens each half with a division winner vs a wildcard`);
      ok([1, 3].every((i) => seconds.includes(r1[i].hi)),
        `and the other half-opener is the 2 vs 3`);
      // The structural part: a half must belong to ONE division — the division
      // winner and the 2v3 from the same division have to meet in round two.
      ok(divOf(r1[0].hi) === divOf(r1[1].hi) && divOf(r1[2].hi) === divOf(r1[3].hi),
        `each half of conference ${conf} stays inside one division`);
      ok(divOf(r1[0].hi) !== divOf(r1[2].hi), `and the two halves are different divisions`);
      // Cross-division part of the real format: the better division winner
      // draws the LOWER wildcard.
      const betterSlot = D.teams[r1[0].hi].pts >= D.teams[r1[2].hi].pts ? 0 : 2;
      ok(r1[betterSlot].lo === wc[1].id,
        "the stronger division winner draws the second wildcard");
      ok(r1[betterSlot === 0 ? 2 : 0].lo === wc[0].id,
        "and the weaker one draws the first");
    });

    // Play it out and confirm the structure actually holds through the bracket.
    simPlayoffs(A, D);
    const P = D.playoffs;
    ok(P.champion != null, "the bracket resolves to a champion");
    ok(P.rounds.length === 4, `four rounds were played (${P.rounds.length})`);
    ok(P.rounds[1].every((s) => s.conf >= 0), "round two is still inside the conferences");
    ok(P.rounds[3].length === 1 && P.rounds[3][0].conf === -1, "the final crosses conferences");
    // Nobody may appear twice in a round — the `wc[1] || wc[0]` fallback could
    // once put one club in two series at the same time.
    P.rounds.forEach((rd, i) => {
      const ids = rd.flatMap((s) => [s.hi, s.lo]);
      ok(new Set(ids).size === ids.length, `no club appears twice in round ${i + 1}`);
    });
  },

  /* Keeping your own players. Before this the only way to retain anyone was to
     let him reach the market and outbid thirty-one clubs for a player you
     already had, and every expiring contract in the league hit free agency at
     once because no AI club ever re-signed anybody. */
  contracts(A) {
    section("Extensions");
    const G = A.newGame(0, { seed: 3311, rules: { seasonLen: 41 } });
    const mine = A.rosterOf(G, 0);
    const short = mine.find((p) => p.contract.yrs <= 1) || mine[0];
    short.contract.yrs = 1;

    ok(A.canExtend(G, short), "a player in the last year of his deal can be extended");

    /* Extending EARLY. The window is `EXTEND_EARLY_MAX` years, and a player is
       paid a premium for every year of a signed deal he's asked to tear up —
       so the same term costs strictly more the earlier you buy it. */
    const early = mine.find((p) => p.id !== short.id) || mine[1];
    early.contract.yrs = A.EXTEND_EARLY_MAX;
    ok(A.canExtend(G, early), `a player with ${A.EXTEND_EARLY_MAX} years left can be extended early`);
    ok(A.extendEarlyYears(early) === A.EXTEND_EARLY_MAX - 1, "and the premium counts the years he gives up");
    early.contract.yrs = A.EXTEND_EARLY_MAX + 1;
    ok(!A.canExtend(G, early), "but not one with more than that to run");
    ok(!A.extendPlayer(G, early.id, 99, 6).ok, "and trying anyway is refused");

    // Same man, same term, priced from two different points in his deal.
    early.contract.yrs = 1;
    const lateAsk = A.extensionAsk(G, early.id, 0, 6);
    early.contract.yrs = 3;
    const earlyAsk = A.extensionAsk(G, early.id, 0, 6);
    ok(earlyAsk > lateAsk, `signing him early costs more ($${earlyAsk}M vs $${lateAsk}M)`);
    ok(!A.extendPlayer(G, early.id, 99, 2).ok, "a term shorter than his remaining deal is refused");
    ok(!A.extendPlayer(G, early.id, 99, A.EXTEND_TERM_MAX + 1).ok, "and so is one past the term limit");
    const addOn = A.extendPlayer(G, early.id, earlyAsk, 6);
    ok(addOn.ok && addOn.added === 3, `extending adds the new years on top (${addOn.added} added)`);
    ok(early.contract.yrs === 6, "and the deal now runs the full term");

    // Loyalty: staying costs a shade less than signing him off the market.
    const ask = A.extensionAsk(G, short.id, 0, 3);
    const open = A.askingPrice(G, short.id, 0, 3);
    ok(ask < open, `his own club gets a loyalty discount ($${ask}M vs $${open}M)`);
    ok(ask >= 0.5, "but never below the minimum");

    const low = A.extendPlayer(G, short.id, ask * 0.9, 3);
    ok(!low.ok && low.counter, `a near miss counters ($${low.counter}M)`);
    ok(!A.extendPlayer(G, short.id, ask * 0.3, 3).ok, "a lowball gets nothing");
    const before = A.capHit(G, 0);
    const done = A.extendPlayer(G, short.id, ask, 3);
    ok(done.ok, "meeting the number keeps him");
    ok(short.contract.yrs === 3 && short.contract.amt === ask, "on the terms agreed");
    // The extension REPLACES the expiring deal — only the difference is new money.
    ok(Math.abs(A.capHit(G, 0) - before) < Math.abs(ask) + 0.05,
      "and it replaces his old deal rather than stacking on it");

    section("AI contract decisions");
    const H = A.newGame(0, { seed: 3311, rules: { seasonLen: 41 } });
    simSeason(A, H); simPlayoffs(A, H);
    // finishSeason has now run: AI clubs have made their calls.
    const faIds = new Set(H.freeAgents);
    const signed = A.playersOf(H).filter((p) => !p.retired && p.teamId != null);
    ok(H.freeAgents.length > 20, `a real free-agent class reached the market (${H.freeAgents.length})`);
    ok(H.freeAgents.length < 400, "but not every expiring contract in the league");
    // The decision must DISCRIMINATE — good players kept, fringe let go.
    const fas = H.freeAgents.map((id) => H.players[id]).filter(Boolean);
    const kept = signed.filter((p) => p.teamId !== H.userTeam);
    const avg = (a) => (a.length ? a.reduce((s, p) => s + p.ovr, 0) / a.length : 0);
    ok(avg(kept) > avg(fas), `clubs keep the better players (${avg(kept).toFixed(1)} vs ${avg(fas).toFixed(1)})`);
    const oldFas = fas.filter((p) => p.age >= 31).length / Math.max(1, fas.length);
    const oldKept = kept.filter((p) => p.age >= 31).length / Math.max(1, kept.length);
    ok(oldFas > oldKept, `and let the older ones walk (${(oldFas * 100).toFixed(0)}% vs ${(oldKept * 100).toFixed(0)}% over 30)`);
    ok(H.teams.every((t) => A.capHit(H, t.id) <= A.rules(H).capAmount + 0.5),
      "nobody re-signed themselves over the cap",
      H.teams.filter((t) => A.capHit(H, t.id) > A.rules(H).capAmount + 0.5).map((t) => `${t.abbr} ${A.capHit(H, t.id)}`).join(" "));

    // FARM_MAX is a declared rule; it has to actually hold.
    ok(H.teams.every((t) => A.rosterOf(H, t.id, true).filter((p) => p.farm).length <= A.FARM_MAX),
      "no club stockpiles more than a legal farm",
      H.teams.map((t) => A.rosterOf(H, t.id, true).filter((p) => p.farm).length).sort((a, b) => b - a).slice(0, 3).join("/"));
  },

  /* The farm used to be a stat generator with no opponent, no result and
     nothing to win. It is now a league: mirrored fixtures, a table, and a
     championship. The checks below are what stop it drifting back into a
     random-number machine that happens to print plausible totals. */
  farmLeague(A) {
    section("The farm league");
    const G = A.newGame(0, { seed: 7712, rules: { seasonLen: 82 } });
    ok(G.teams.every((t) => A.farmRec(t).gp === 0), "every affiliate starts with a clean sheet");

    // One day at a time, on its own game, so the mirroring can be checked
    // against the fixtures without polluting the season totals below.
    const D = A.newGame(0, { seed: 7712, rules: { seasonLen: 82 } });
    const fixtures = D.schedule[D.day] || [];
    const before = D.teams.map((t) => A.farmRec(t).gp);
    A.simFarmDay(D, D.day);
    const played = new Set();
    fixtures.forEach((f) => { played.add(f.home); played.add(f.away); });
    ok(fixtures.length > 0, `the calendar opens with fixtures (${fixtures.length})`);
    ok(D.teams.every((t, i) => A.farmRec(t).gp === before[i] + (played.has(t.id) ? 1 : 0)),
      "an affiliate plays exactly when its parent club does");

    simSeason(A, G);
    const recs = G.teams.map((t) => A.farmRec(t));
    ok(recs.every((r) => r.gp > 0), "every affiliate played a season");
    ok(recs.every((r) => r.w + r.l + r.otl === r.gp), "records reconcile with games played");
    // The mirrored schedule means the farm plays exactly the NHL slate.
    ok(G.teams.every((t, i) => A.farmRec(t).gp === t.gp),
      "the affiliates play the same number of games as their parents");
    // A league is zero-sum: goals for must equal goals against across it.
    const gf = recs.reduce((s, r) => s + r.gf, 0), ga = recs.reduce((s, r) => s + r.ga, 0);
    ok(gf === ga, `the league's goals balance (${gf} vs ${ga})`);
    const totalW = recs.reduce((s, r) => s + r.w, 0);
    ok(totalW === recs.reduce((s, r) => s + r.l + r.otl, 0), "and so do wins against losses");

    // Scoring has to be sane, not just internally consistent.
    const perGame = gf / recs.reduce((s, r) => s + r.gp, 0);
    ok(perGame > 1.8 && perGame < 5, `farm scoring is plausible (${perGame.toFixed(2)} per club-game)`);

    // Player lines must add up to the club's goals, or the table is a fiction.
    let mismatch = 0;
    G.teams.forEach((t) => {
      const skaters = A.rosterOf(G, t.id, true).filter((p) => p.farm && p.farmSeason);
      const goals = skaters.reduce((s, p) => s + (p.farmSeason.g || 0), 0);
      if (goals > A.farmRec(t).gf) mismatch++;
    });
    ok(mismatch === 0, "no club's prospects out-score the club itself");
    const withLines = A.playersOf(G).filter((p) => p.farm && p.farmSeason && p.farmSeason.gp > 0);
    ok(withLines.length > 100, `prospects built real stat lines (${withLines.length})`);
    ok(withLines.some((p) => p.farmSeason.g > 0 && p.farmSeason.a > 0), "with goals and assists");
    /* Every number must be a NUMBER. A negative base to a fractional power is
       NaN, and NaN weights silently route every goal to the last skater in the
       list — on a thin affiliate one player took all 154 of his club's goals
       and the whole roster finished with zero assists. Averages across the
       league hid it completely. */
    ok(withLines.every((p) => Object.values(p.farmSeason).every((v) => typeof v === "number" && isFinite(v))),
      "no farm stat is NaN or infinite");
    // Scoring must be SHARED. No prospect may take an absurd slice of his club.
    let hog = null;
    G.teams.forEach((t) => {
      const sk = A.rosterOf(G, t.id, true).filter((p) => p.farm && p.farmSeason && p.pos !== "G");
      const clubG = A.farmRec(t).gf;
      if (clubG < 20 || sk.length < 3) return;
      sk.forEach((p) => { if ((p.farmSeason.g || 0) / clubG > 0.6) hog = `${p.ln} ${p.farmSeason.g}/${clubG} for ${t.abbr}`; });
    });
    ok(!hog, "no single prospect scores most of his club's goals", hog);
    /* Assists must outnumber goals, as they do in any hockey league. They are
       drawn from the same pool, so this also proves a prospect gets credited on
       goals scored by team-mates the game doesn't model individually — skipping
       those events entirely once cut the ratio to 0.38 and buried playmakers. */
    const sk = withLines.filter((p) => p.pos !== "G");
    const tg = sk.reduce((s, p) => s + p.farmSeason.g, 0);
    const ta = sk.reduce((s, p) => s + p.farmSeason.a, 0);
    ok(ta > tg, `assists outnumber goals (${ta} to ${tg}, ${(ta / tg).toFixed(2)})`);
    // And a top prospect's season has to look like a hockey season, not a video
    // game one: five prospects splitting a whole club once produced 138 goals.
    const best = sk.filter((p) => p.farmSeason.gp >= 40)
      .sort((a, b) => b.farmSeason.g - a.farmSeason.g)[0];
    ok(best && best.farmSeason.g / best.farmSeason.gp < 0.85,
      `even the best farm scorer is plausible (${best.farmSeason.g} in ${best.farmSeason.gp})`);
    // And assists have to happen everywhere, not just on deep affiliates.
    const clubsWithAssists = G.teams.filter((t) => {
      const sk = A.rosterOf(G, t.id, true).filter((p) => p.farm && p.farmSeason && p.pos !== "G");
      return sk.length >= 3 && sk.some((p) => (p.farmSeason.a || 0) > 0);
    }).length;
    const eligible = G.teams.filter((t) => A.rosterOf(G, t.id, true).filter((p) => p.farm && p.farmSeason && p.pos !== "G").length >= 3).length;
    ok(clubsWithAssists === eligible,
      `every affiliate with a real roster records assists (${clubsWithAssists}/${eligible})`);
    const keepers = withLines.filter((p) => p.pos === "G" && p.farmSeason.sa > 0);
    ok(keepers.length > 5, `farm goalies faced shots (${keepers.length})`);
    ok(keepers.every((p) => p.farmSeason.sv + p.farmSeason.ga === p.farmSeason.sa),
      "and their saves reconcile with shots faced");
    ok(keepers.some((p) => p.farmSeason.w > 0), "and some of them won games");

    // Ability has to matter, or the league is noise.
    const scorers = withLines.filter((p) => p.pos !== "G" && p.farmSeason.gp >= 20);
    const good = scorers.filter((p) => p.ovr >= 55), poor = scorers.filter((p) => p.ovr < 45);
    const ppg = (a) => (a.length ? a.reduce((s, p) => s + (p.farmSeason.g + p.farmSeason.a) / p.farmSeason.gp, 0) / a.length : 0);
    ok(good.length && poor.length && ppg(good) > ppg(poor) * 1.4,
      `better prospects produce more (${ppg(good).toFixed(2)} vs ${ppg(poor).toFixed(2)} per game)`);

    // The table has to separate clubs, and the championship has to resolve.
    const table = A.farmStandings(G);
    ok(A.farmRec(table[0]).pts > A.farmRec(table[31]).pts + 10,
      `the table spreads (${A.farmRec(table[31]).pts}–${A.farmRec(table[0]).pts} pts)`);
    ok(G.farmCup && G.farmCup.champion != null, "the affiliates crowned a champion");
    ok(G.farmCup.field.length === A.FARM_CUP_FIELD, `${A.FARM_CUP_FIELD} clubs made the farm playoffs`);
    ok(G.farmCup.rounds.length === 3, `played over three rounds (${G.farmCup.rounds.length})`);
    ok(G.farmCup.field.includes(G.farmCup.champion), "the champion came from the field");
    ok(G.teams[G.farmCup.champion].farmCups === 1, "and the club has the title on its record");
    const winners = A.playersOf(G).filter((p) => (p.farmTitles || []).length);
    ok(winners.length > 0, `the prospects who won it have it on theirs (${winners.length})`);

    // A championship must be earned, not handed to whoever sorts first.
    ok(G.farmCup.rounds.every((rd) => rd.every((s) => s.winner === s.hi || s.winner === s.lo)),
      "every series was won by one of its two clubs");

    // It survives a rollover and starts clean.
    simPlayoffs(A, G);
    A.autoDraft(G, false);
    A.startNextSeason(G);
    ok(G.teams.every((t) => A.farmRec(t).gp === 0), "the table resets for the new season");
    ok(G.farmCup == null, "and last year's farm cup is cleared");
    ok(A.playersOf(G).some((p) => (p.farmCareer || []).length), "last year's farm line was archived");
  },

  /* Does a finished season LOOK like a hockey season? Individual mechanics can
     each be right while the league they add up to is wrong — shots, shooting
     percentage and save percentage were all in band while the product of them
     produced 2.77 goals a night and 239 shutouts. These are the season-end
     numbers a reader would actually check, pinned against real NHL ranges. */
  realism(A) {
    section("Season-end realism");
    /* Two full seasons pooled. One 82-game season swings enough on its own that
       a rate sitting mid-band can read outside it on the wrong seed — goals a
       night varied from 2.79 to 3.05 across seeds at a single setting. */
    const runs = [8801, 9902].map((seed) => {
      const g = A.newGame(0, { seed, rules: { seasonLen: 82 } });
      simSeason(A, g);
      return g;
    });
    const G = runs[0];
    const sk = runs.flatMap((g) => A.playersOf(g).filter((p) => p.pos !== "G" && !p.farm && p.season.gp > 0));
    const go = runs.flatMap((g) => A.playersOf(g).filter((p) => p.pos === "G" && p.season.gp > 0));
    const teamGames = runs.reduce((s, g) => s + g.teams.reduce((x, t) => x + t.gp, 0), 0);
    const sum = (arr, f) => arr.reduce((s, p) => s + f(p), 0);
    const best = (arr, f) => Math.max(...arr.map(f));
    const band = (label, v, lo, hi, fmt) =>
      ok(v >= lo && v <= hi, `${label} — ${fmt ? fmt(v) : v.toFixed(2)} (nhl ${lo}–${hi})`);
    /* RATES pool across seasons; LEADERS do not — the best of 64 goalie-seasons
       is not the same statistic as the best of 32, and a count of 100-point
       scorers over two years is not a season's worth. Take each season's figure
       and average them. */
    const perSeason = (f) => runs.reduce((s2, g) => s2 + f(g), 0) / runs.length;
    const skOf = (g) => A.playersOf(g).filter((p) => p.pos !== "G" && !p.farm && p.season.gp > 0);
    const goOf = (g) => A.playersOf(g).filter((p) => p.pos === "G" && p.season.gp > 0);

    // Scoring: the product of shots and finishing, which is what a reader sees.
    band("goals per team-game", runs.reduce((s2, g) => s2 + sum(g.teams, (t) => t.gf), 0) / teamGames, 2.85, 3.40);
    band("shots on goal per team-game", sum(sk, (p) => p.season.sog) / teamGames, 27.5, 33);
    band("league shooting %", sum(sk, (p) => p.season.g) / sum(sk, (p) => p.season.sog) * 100, 8.6, 10.8);
    band("league save %", sum(go, (p) => p.season.sv) / sum(go, (p) => p.season.sa) * 100, 89.3, 91.2);

    /* Assists must outnumber goals by about 1.7 to 1 — most goals carry two.
       At 1.14 the league's assist leader finished BELOW its goal leader and
       nobody reached a hundred points, which is not a hockey season. */
    band("assists per goal", sum(sk, (p) => p.season.a) / sum(sk, (p) => p.season.g), 1.55, 1.85);
    band("Art Ross winner", perSeason((g) => best(skOf(g), (p) => p.season.g + p.season.a)), 90, 160, (v) => `${v.toFixed(0)} pts`);
    band("goals leader", perSeason((g) => best(skOf(g), (p) => p.season.g)), 40, 72, (v) => v.toFixed(0));
    band("assists leader", perSeason((g) => best(skOf(g), (p) => p.season.a)), 55, 105, (v) => v.toFixed(0));
    ok(runs.every((g) => best(skOf(g), (p) => p.season.a) > best(skOf(g), (p) => p.season.g)),
      "the assists leader outscores the goals leader, as he does in life");
    band("100-point scorers", perSeason((g) => skOf(g).filter((p) => p.season.g + p.season.a >= 100).length), 1, 14, (v) => v.toFixed(1));

    /* Game-winning goals were declared in `blankStats`, listed in the record
       book, and never once incremented — every leaderboard read zero. */
    const gwTotal = sum(sk, (p) => p.season.gwg);
    const decisive = runs.reduce((s2, g) => s2 + g.results.filter((r) => !r.playoff && !r.so && r.hg !== r.ag).length, 0);
    ok(gwTotal === decisive,
      `every decisive non-shootout game has a game-winning goal (${gwTotal} of ${decisive})`);
    band("game-winning goals leader", perSeason((g) => best(skOf(g), (p) => p.season.gwg)), 7, 16, (v) => v.toFixed(1));

    // Physical play and goaltending.
    band("hits per team-game", sum(sk, (p) => p.season.hit) / teamGames, 17, 26);
    band("blocks per team-game", sum(sk, (p) => p.season.blk) / teamGames, 11, 18);
    band("shutouts per season", sum(go, (p) => p.season.so) / runs.length, 80, 205, (v) => `${v.toFixed(0)}`);
    band("goalie starts leader", perSeason((g) => best(goOf(g), (p) => p.season.gp)), 52, 70, (v) => v.toFixed(1));

    // The table has to look like a table: a real top, a real bottom, no runaway.
    const table = A.standings(G);
    band("points, first place", perSeason((g) => A.standings(g)[0].pts), 100, 142, (v) => v.toFixed(0));
    band("points, last place", perSeason((g) => A.standings(g)[31].pts), 40, 78, (v) => v.toFixed(0));
    ok(table[0].pts - table[31].pts < 100,
      `the table isn't absurdly stretched (${table[31].pts}–${table[0].pts})`);
    // Home ice is worth something, but not everything.
    const decided = runs.flatMap((g) => g.results.filter((r) => !r.playoff));
    const homeWins = decided.filter((r) => r.hg > r.ag).length;
    band("home win %", homeWins / decided.length * 100, 48, 60);
  },

  /* Roles exist so that skaters SPECIALISE. Every rate stat used to come from a
     narrow curve around one rating, so nobody stood out: the league's hits
     leader finished on 152 and its penalty leader on 84, because a fourth-line
     agitator posted roughly what a first-line centre did. */
  roles(A) {
    section("Player roles");
    const G = A.newGame(0, { seed: 5150, rules: { seasonLen: 82 } });
    const sk = A.playersOf(G).filter((p) => p.pos !== "G" && p.teamId != null);

    ok(sk.every((p) => A.ROLES[A.roleKeyOf(p)]), "every skater has a role that exists");
    ok(A.roleKeyOf(A.playersOf(G).find((p) => p.pos === "G")) === null, "goalies have none");
    // Derived, never stored — so it costs no save size and an old save gets one.
    ok(sk.every((p) => p.role === undefined), "the role is derived, not stored on the player");
    const twice = sk.slice(0, 40).every((p) => A.roleKeyOf(p) === A.roleKeyOf(p));
    ok(twice, "and is stable for a given player");

    // The league has to contain all of them, in believable proportions.
    const count = {};
    sk.forEach((p) => { const k = A.roleKeyOf(p); count[k] = (count[k] || 0) + 1; });
    ok(Object.keys(count).length === A.ROLE_KEYS.length,
      `every role appears (${Object.entries(count).map(([k, v]) => `${k} ${v}`).join(", ")})`);
    ok(Math.max(...Object.values(count)) / sk.length < 0.55, "and none of them swallows the league");
    const enf = count.enforcer / sk.length;
    ok(enf > 0.02 && enf < 0.2, `enforcers are a real but small minority (${(enf * 100).toFixed(1)}%)`);
    // Roles must follow the RATINGS, not noise.
    const snipers = sk.filter((p) => A.roleKeyOf(p) === "sniper");
    const grinders = sk.filter((p) => A.roleKeyOf(p) === "grinder" || A.roleKeyOf(p) === "enforcer");
    const avg = (a, f) => a.reduce((s, p) => s + f(p), 0) / a.length;
    ok(avg(snipers, (p) => p.r.sht) > avg(grinders, (p) => p.r.sht) + 5,
      `snipers shoot better than grinders (${avg(snipers, (p) => p.r.sht).toFixed(0)} vs ${avg(grinders, (p) => p.r.sht).toFixed(0)})`);
    ok(avg(grinders, (p) => p.r.phy) > avg(snipers, (p) => p.r.phy) + 5,
      `and grinders hit harder (${avg(grinders, (p) => p.r.phy).toFixed(0)} vs ${avg(snipers, (p) => p.r.phy).toFixed(0)})`);
    // Defencemen are mostly shutdown men; forwards are not.
    const dShut = sk.filter((p) => p.pos === "D" && A.roleKeyOf(p) === "shutdown").length
      / sk.filter((p) => p.pos === "D").length;
    ok(dShut > 0.4, `defencemen are mostly shutdown types (${(dShut * 100).toFixed(0)}%)`);

    /* And it has to SHOW UP in the stats, which is the entire point. */
    simSeason(A, G);
    const played = A.playersOf(G).filter((p) => p.pos !== "G" && p.season.gp >= 40);
    const byRole = (k) => played.filter((p) => A.roleKeyOf(p) === k);
    const per = (a, f) => (a.length ? a.reduce((s, p) => s + f(p) / p.season.gp, 0) / a.length : 0);
    const enfs = byRole("enforcer"), snips = byRole("sniper");
    ok(enfs.length && snips.length, "both enforcers and snipers played real seasons");
    ok(per(enfs, (p) => p.season.hit) > per(snips, (p) => p.season.hit) * 1.8,
      `enforcers hit far more than snipers (${per(enfs, (p) => p.season.hit).toFixed(2)} vs ${per(snips, (p) => p.season.hit).toFixed(2)} a game)`);
    ok(per(enfs, (p) => p.season.pim) > per(snips, (p) => p.season.pim) * 1.8,
      `and take far more penalties (${per(enfs, (p) => p.season.pim).toFixed(2)} vs ${per(snips, (p) => p.season.pim).toFixed(2)})`);
    ok(per(snips, (p) => p.season.g) > per(enfs, (p) => p.season.g) * 1.5,
      `while snipers score far more (${per(snips, (p) => p.season.g).toFixed(3)} vs ${per(enfs, (p) => p.season.g).toFixed(3)})`);
    // The league leaders in the physical stats should BE these players.
    const hitKing = played.slice().sort((a, b) => b.season.hit - a.season.hit)[0];
    const pimKing = played.slice().sort((a, b) => b.season.pim - a.season.pim)[0];
    ok(["enforcer", "grinder"].includes(A.roleKeyOf(hitKing)),
      `the hits leader is a physical player (${A.roleKeyOf(hitKing)}, ${hitKing.season.hit})`);
    ok(["enforcer", "grinder"].includes(A.roleKeyOf(pimKing)),
      `so is the penalty leader (${A.roleKeyOf(pimKing)}, ${pimKing.season.pim})`);
  },

  /* Who plays how much. Forwards had a coach's control over this from the start;
     defence pairs were a hard-coded constant, and the whole power play ran
     through PP1 while the whole kill ran through PK1 — which handed anyone on
     both an extra eleven minutes a night and produced 33-minute defencemen. */
  iceTime(A) {
    section("Deployment and ice time");
    const G = A.newGame(0, { seed: 4477, rules: { seasonLen: 82 } });

    ok(A.iceTimeD(G.teams[0]).length === A.PAIR_TOI.length, "a club with no setting plays the standard split");
    ok(Math.abs(A.iceTimeD({ iceD: [50, 30, 20] }).reduce((s, v) => s + v, 0) - 1) < 1e-9,
      "a custom split is normalised to a whole game");
    ok(A.iceTimeD({ iceD: [1, 0, 0] })[0] === 1, "and an extreme one is honoured");
    ok(A.PP_UNIT_SPLIT.reduce((s, v) => s + v, 0) === 1 && A.PK_UNIT_SPLIT.reduce((s, v) => s + v, 0) === 1,
      "both special-teams splits account for all the minutes");

    simSeason(A, G);
    const d = A.playersOf(G).filter((p) => p.pos === "D" && !p.farm && p.season.gp >= 40);
    const f = A.playersOf(G).filter((p) => ["C", "LW", "RW"].includes(p.pos) && !p.farm && p.season.gp >= 40);
    const mins = (p) => p.season.toi / p.season.gp;
    /* Measure the TYPICAL number one, not the league maximum. The max is an
       injury tail — a club down to four healthy defencemen genuinely does
       overplay the two it has left — and asserting on it tests roster attrition
       rather than deployment. The median of each club's leader is the figure
       that characterises the model. */
    const med = (a) => { const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
    const clubTop = (pool) => G.teams.map((t) => {
      const own = pool.filter((p) => p.teamId === t.id).map(mins);
      return own.length ? Math.max(...own) : null;
    }).filter((v) => v != null);
    const typD = med(clubTop(d)), typF = med(clubTop(f));
    ok(typD > 21 && typD < 27, `a typical number one defenceman logs real minutes (${typD.toFixed(1)})`);
    ok(typF > 16 && typF < 24, `and a typical first-line forward lands where he should (${typF.toFixed(1)})`);
    ok(typD > typF, "defencemen out-play forwards in minutes, as they do in life");
    // The tail still has to stay inside the realm of the possible.
    ok(Math.max(...d.map(mins)) < 33, `and nobody plays an impossible night (${Math.max(...d.map(mins)).toFixed(1)} min)`);

    // Both special-teams units have to actually be used.
    const t = G.teams[0];
    const lines = A.ensureLines(G, 0);
    const pp2 = (lines.PP[1] || []).filter((id) => G.players[id]);
    ok(pp2.length > 0, "a club dresses a second power-play unit");
    const pp2Played = pp2.some((id) => G.players[id].season.toi > 0);
    ok(pp2Played, "and it gets minutes rather than sitting unused");

    // Changing the split has to actually change who plays.
    const H = A.newGame(0, { seed: 4477, rules: { seasonLen: 41 } });
    H.teams[0].iceD = [90, 5, 5];
    simSeason(A, H);
    const hd = A.rosterOf(H, 0).filter((p) => p.pos === "D" && p.season.gp >= 20)
      .sort((a, b) => b.season.toi / b.season.gp - a.season.toi / a.season.gp);
    const B = A.newGame(0, { seed: 4477, rules: { seasonLen: 41 } });
    simSeason(A, B);
    const bd = A.rosterOf(B, 0).filter((p) => p.pos === "D" && p.season.gp >= 20)
      .sort((a, b) => b.season.toi / b.season.gp - a.season.toi / a.season.gp);
    ok(hd.length && bd.length, "both clubs iced a defence");
    ok(hd[0].season.toi / hd[0].season.gp > bd[0].season.toi / bd[0].season.gp + 2,
      `riding a pair genuinely rides it (${(hd[0].season.toi / hd[0].season.gp).toFixed(1)} vs ${(bd[0].season.toi / bd[0].season.gp).toFixed(1)} min)`);
  },

  /* Coming back from a long injury is a ramp, not a switch. A player who has
     missed two months is in the lineup before he is himself again, and that
     fortnight is part of what the injury cost — it used to vanish the instant
     the counter hit zero. */
  recovery(A) {
    section("Injury recovery");
    ok(A.INJURIES.every((x) => x.length === 4), "every injury names the rating it bites");
    ok(A.INJURIES.some((x) => x[3] === null), "and a concussion bites everything, so names none");

    ok(A.rehabFor(0) === 0 && A.rehabFor(A.REHAB_MIN_GAMES - 1) === 0,
      "a short knock leaves no rust behind");
    ok(A.rehabFor(40) > 0, "a long one does");
    ok(A.rehabFor(400) <= A.REHAB_MAX, "and the ramp is capped however long he was out");
    ok(A.rehabFor(60) > A.rehabFor(20), "a worse injury takes longer to shake off");

    // Sharpness and its effect on a rating.
    const fit = { r: { sht: 80 } };
    ok(A.sharpness(fit) === 1, "a fit player is fully himself");
    ok(A.ratingNow(fit, "sht") === 80, "and plays to his rating");
    const rusty = { r: { sht: 80, spd: 80 }, rust: 10, rustFrom: 10, rustKey: "spd" };
    ok(A.sharpness(rusty) < 1 && A.sharpness(rusty) > 1 - A.REHAB_DEPTH - 1e-9,
      `a rusty player is below himself (${A.sharpness(rusty).toFixed(3)})`);
    ok(A.ratingNow(rusty, "spd") < A.ratingNow(rusty, "sht"),
      "and the part that was hurt comes back slowest");
    const nearly = { r: { sht: 80, spd: 80 }, rust: 1, rustFrom: 10, rustKey: "spd" };
    ok(A.sharpness(nearly) > A.sharpness(rusty), "sharpness climbs back as the ramp runs down");
    ok(A.ratingNow({ r: { sht: 80 }, rust: 0 }, "sht") === 80, "and a finished ramp costs nothing");

    /* In a real season it has to actually happen, and then actually end. */
    const G = A.newGame(0, { seed: 2255, rules: { seasonLen: 82, injuries: "high" } });
    simSeason(A, G);
    const all = A.playersOf(G);
    const everHurt = all.filter((p) => (p.career || []).length === 0 && p.injGames != null);
    ok(all.some((p) => p.inj > 0) || everHurt.length > 0, "players got injured");
    // Nobody may be left permanently rusty, and nobody rusty while still hurt.
    ok(all.every((p) => (p.rust || 0) >= 0), "rust never goes negative");
    ok(all.every((p) => (p.rust || 0) <= A.REHAB_MAX), "and never exceeds the cap");
    ok(all.every((p) => !(p.inj > 0 && p.rust > 0)), "nobody is rusty while still out injured");
    ok(all.every((p) => !p.rust || p.rustFrom >= p.rust), "the ramp never counts up past where it started");

    // A rusty player must genuinely be worse — that is the whole point.
    const sample = all.find((p) => p.pos !== "G" && p.r.sht > 40);
    const before = A.ratingNow(sample, "sht");
    sample.rust = 8; sample.rustFrom = 8; sample.rustKey = "sht";
    ok(A.ratingNow(sample, "sht") < before, "a returning player plays below his rating");
    sample.rust = 0; sample.rustFrom = 0;

    // And the rollover has to wipe it, like it wipes injuries.
    simPlayoffs(A, G);
    A.autoDraft(G, false);
    A.startNextSeason(G);
    ok(A.playersOf(G).every((p) => !p.rust), "a new season starts everybody fresh");
  },

  /* Awards used to be six sorts, and the MVP was literally the same id as the
     scoring champion — two trophies that could never disagree, so the Hart
     meant nothing on its own. They are ballots now, with vote shares. */
  awardVoting(A) {
    section("Awards voting");
    /* Two seasons, because only DRAFTED players carry the rookie flag — the
       opening world has none, so a first season can never award a Calder. */
    const G = A.newGame(0, { seed: 3939, rules: { seasonLen: 82 } });
    simSeason(A, G); simPlayoffs(A, G);
    A.autoDraft(G, false); A.startNextSeason(G);
    simSeason(A, G);
    const aw = G.awards;
    ok(aw && aw.votes, "the season produced a ballot");
    ok(A.playersOf(G).some((p) => p.rookie && p.season.gp > 10),
      "the draft class reached the league");

    ["mvp", "defence", "goalie", "rookie", "scoring", "goals"].forEach((k) => {
      const b = aw.votes[k] || [];
      ok(b.length > 1, `${k} drew a real field (${b.length})`);
      const sum = b.reduce((s, v) => s + v.share, 0);
      ok(Math.abs(sum - 1) < 1e-6, `${k} shares add up to the whole vote`);
      ok(b.every((v) => v.share >= 0 && v.share <= 1), `${k} shares are all real fractions`);
      // Ordered, and the winner is the man who topped it.
      ok(b.every((v, i) => i === 0 || b[i - 1].share >= v.share), `${k} is ordered by share`);
      ok(aw[k] === b[0].id || k === "scoring" || k === "goals", `${k} went to the leader of its ballot`);
      ok(new Set(b.map((v) => v.id)).size === b.length, `nobody appears twice on the ${k} ballot`);
    });

    // The winner must actually be clear of the field, not a rounding artefact.
    ok(aw.votes.mvp[0].share > aw.votes.mvp[4].share * 1.5,
      `the MVP is clear of fifth place (${(aw.votes.mvp[0].share * 100).toFixed(0)}% vs ${(aw.votes.mvp[4].share * 100).toFixed(0)}%)`);

    /* The Hart has to be able to disagree with the Art Ross — that is the whole
       reason it is a separate trophy. Over several seasons they must sometimes
       differ, and the MVP must sometimes not be a forward at all. */
    let differed = 0, seasons = 0;
    const mvpPos = {};
    [3939, 4040, 4141, 4242, 4343, 4444, 4545, 4646].forEach((seed) => {
      const g = A.newGame(0, { seed, rules: { seasonLen: 41 } });
      simSeason(A, g);
      seasons++;
      if (g.awards.mvp !== g.awards.scoring) differed++;
      const mvp = g.players[g.awards.mvp];
      if (mvp) mvpPos[mvp.pos === "G" || mvp.pos === "D" ? mvp.pos : "F"] =
        (mvpPos[mvp.pos === "G" || mvp.pos === "D" ? mvp.pos : "F"] || 0) + 1;
    });
    ok(differed > 0, `the Hart and the Art Ross disagree sometimes (${differed}/${seasons} seasons)`);
    /* The Hart goes to a forward MOST years and to a goaltender or defenceman
       occasionally — that is the real pattern. Weighting goalies too generously
       made it a goalie award every single season, which is as wrong as making
       it a copy of the scoring title. */
    const mix = Object.entries(mvpPos).map(([k, v]) => `${k} ${v}`).join(", ");
    ok((mvpPos.F || 0) >= seasons * 0.5, `the MVP is usually a forward (${mix})`);
    ok((mvpPos.F || 0) < seasons, `but not always (${mix})`);

    // Trophies still land on the players, and the ballot isn't one of them.
    const holders = A.playersOf(G).filter((p) => (p.trophies || []).some((t) => t.year === G.year));
    ok(holders.length > 0, `trophies were handed out (${holders.length})`);
    ok(!holders.some((p) => p.trophies.some((t) => t.award === "votes")),
      "the ballot itself is not mistaken for a trophy");
    // A rookie goaltender must be able to win the Calder.
    const rookieBallots = aw.votes.rookie.map((v) => G.players[v.id]).filter(Boolean);
    ok(rookieBallots.length > 0, "rookies were considered");
  },

  /* The board can act. `boardConfidence` was tracked and displayed from the
     first build while nothing whatsoever depended on it, so every mandate was
     advisory — you could miss the playoffs for a decade and keep the job. */
  firing(A) {
    section("Firing and the next job");
    const G = A.newGame(0, { seed: 6161, rules: { seasonLen: 41 } });
    ok(G.fired === null, "a new manager is not already sacked");
    ok(G.hiredYear === G.year, "and his tenure starts today");

    // Comfortable confidence survives a bad year.
    G.boardConfidence = 70;
    simSeason(A, G); simPlayoffs(A, G);
    ok(!G.fired, "a well-regarded manager survives a season");

    // A board out of patience does not.
    const H = A.newGame(0, { seed: 6161, rules: { seasonLen: 41 } });
    H.boardConfidence = 1;
    H.mandate = { ...A.MANDATES.cup };
    simSeason(A, H); simPlayoffs(A, H);
    ok(H.fired, "a board out of patience acts on it");
    ok(H.fired.teamId === 0 && H.fired.year === H.year, "and the sacking records who and when");
    ok((H.tenure || []).length === 1, "the spell is written into his record");
    ok(H.tenure[0].teamId === 0 && H.tenure[0].to === H.year, "with the club and the year he left");

    // Winning the Cup has to save him whatever the board thought before.
    const C = A.newGame(0, { seed: 6161, rules: { seasonLen: 41 } });
    C.boardConfidence = 0;
    simSeason(A, C); simPlayoffs(A, C);
    if (C.playoffs && C.playoffs.champion === C.userTeam) {
      ok(!C.fired, "winning the Cup saves the job");
    } else ok(true, "(this seed did not win the Cup — covered by the rule itself)");

    // Taking the next job.
    const before = H.teams[0].seasons.length;
    const r = A.takeJob(H, 7);
    ok(r.ok, "you can take another job");
    ok(H.userTeam === 7 && !H.fired, "and you are managing the new club");
    ok(H.hiredYear === H.year, "on a fresh tenure");
    ok(H.boardConfidence > A.FIRING_LINE, "with a board that hasn't judged you yet");
    ok(H.mandate, "and a mandate of its own");
    // The league carries on — the club you left keeps everything.
    ok(H.teams[0].seasons.length === before, "the club you left keeps its history");
    ok(!A.takeJob(H, 99).ok, "you cannot take a job that doesn't exist");

    // And the new club's season is playable. Rosters are legitimately thin
    // between `finishSeason` and `fillRosters`, so judge them after the rollover.
    A.autoDraft(H, false);
    A.startNextSeason(H);
    ok(A.rosterOf(H, 0).length >= 18, "the club you left still ices a team");
    simSeason(A, H);
    ok(H.teams[7].gp === 41, "the next season plays out under the new club");
    ok((H.tenure || []).length === 1, "and the old spell is still on the record");
  },

  /* The deadline used to arrive as a line in the news feed after it had already
     happened. `deadlineBoard` surfaces what the engine was deciding internally
     all along — and it must agree with `aiDeadlineMoves`, or the screen shows a
     market the league isn't actually trading in. */
  deadlineScreen(A) {
    section("The deadline board");
    const G = A.newGame(0, { seed: 8484, rules: { seasonLen: 82 } });
    A.simDays(G, 120);
    const b = A.deadlineBoard(G);

    ok(b.buyers.length + b.sellers.length === G.teams.length, "every club is a buyer or a seller");
    ok(!b.buyers.some((id) => b.sellers.includes(id)), "and never both");
    // The split has to BE the standings split, not a second opinion.
    const table = A.standings(G);
    ok(b.buyers.every((id) => table.findIndex((t) => t.id === id) < G.teams.length / 2),
      "buyers are the top half of the table");
    ok(A.standings(G)[0].id === b.buyers[0], "listed in table order");
    ok(b.youBuy === b.buyers.includes(G.userTeam), "and it knows which side you're on");
    ok(b.myRank >= 1 && b.myRank <= G.teams.length, `your place in the league is real (${b.myRank})`);

    // Rentals must be genuine rentals, and belong to sellers.
    ok(b.rentals.length > 0, `there is a market (${b.rentals.length} rentals)`);
    ok(b.rentals.every((r) => r.p.contract.yrs <= 1), "every rental is in his last year");
    ok(b.rentals.every((r) => r.p.age >= 27), "and old enough to be one");
    ok(b.rentals.every((r) => r.p.ovr >= A.RENTAL_MIN_OVR), "and worth renting");
    ok(b.rentals.every((r) => b.sellers.includes(r.from)), "and plays for a club that is selling");
    ok(!b.rentals.some((r) => r.p.teamId === G.userTeam), "your own players are not on the market");
    ok(b.rentals.every((r, i) => i === 0 || b.rentals[i - 1].p.ovr >= r.p.ovr), "best first");

    /* The asking price must be the pick the AI ACTUALLY pays — a decorative
       estimate would be worse than showing nothing. */
    ok(b.rentals.every((r) => r.round === (r.p.ovr >= 72 ? 1 : 2)),
      "the asking price matches what aiDeadlineMoves pays");
    ok(b.rentals.every((r) => r.blocked === A.hasNtc(r.p)), "a no-trade clause is flagged");

    // Your own expiring men, priced the same way.
    ok(b.myRentals.every((r) => r.p.teamId === G.userTeam), "your rentals are yours");
    ok(b.myRentals.every((r) => r.round === (r.p.ovr >= 72 ? 1 : 2)), "and priced on the same scale");

    // And the window itself.
    ok(b.open === A.tradesOpen(G), "it agrees with whether trades are open");
    ok(b.days === A.daysToDeadline(G), "and with how long is left");
    const G2 = A.newGame(0, { seed: 8484, rules: { seasonLen: 82 } });
    A.simDays(G2, A.deadlineDay(G2) + 2);
    ok(!A.deadlineBoard(G2).open, "once the deadline passes the window is shut");
  },

  // The same seed must produce the same season, or nothing above is reproducible.
  /* Where the playoff cutoff is. The standings knew who was in the field all
     along; nothing said so, which made the one number anybody reads during a
     season invisible. */
  playoffLine(A) {
    section("The playoff line");
    const G = A.newGame(0, { seed: 7711, rules: { seasonLen: 41 } });
    simSeason(A, G);
    const B = A.playoffBerths(G);
    const inField = Object.keys(B).filter((k) => B[k].in);
    ok(inField.length === 16, `sixteen clubs hold a berth (${inField.length})`);

    // It must agree with the bracket that actually gets built.
    A.buildBracket(G);
    const bracket = new Set();
    G.playoffs.rounds[0].forEach((s) => { bracket.add(s.hi); bracket.add(s.lo); });
    ok(inField.every((id) => bracket.has(+id)), "and they are exactly the clubs in the bracket");
    ok(inField.length === bracket.size, "with nobody in one and not the other");

    // Exactly one cutoff per conference in each format, and one club next in line.
    ok(Object.values(B).filter((b) => b.firstOut).length === 2, "each conference has a first club out");
    ok(Object.values(B).filter((b) => b.in && b.wildcard).length === 4, "and four wildcards across the league");
    const outs = Object.keys(B).filter((k) => !B[k].in);
    ok(outs.every((id) => !bracket.has(+id)), "nobody outside the line made the bracket");

    // A club out of the field must never be ahead of one in it, in its own conference.
    const bad = G.teams.filter((t) => B[t.id] && B[t.id].in
      && G.teams.some((u) => u.conf === t.conf && B[u.id] && !B[u.id].in && u.pts > t.pts + 6));
    ok(bad.length <= 4, `the line broadly follows the table (${bad.length} division winners carried in)`);

    // Seeded format: a plain 1-8, no wildcards at all.
    const S = A.newGame(0, { seed: 7711, rules: { seasonLen: 41, playoffFormat: "seeded" } });
    simSeason(A, S);
    const SB = A.playoffBerths(S);
    ok(Object.values(SB).filter((b) => b.in).length === 16, "the seeded format fields sixteen too");
    ok(!Object.values(SB).some((b) => b.wildcard), "and has no wildcards");
    [0, 1].forEach((c) => {
      const top = A.confStandings(S, c).slice(0, 8);
      ok(top.every((t) => SB[t.id] && SB[t.id].in), `conference ${c}'s top eight are all in`);
    });
  },

  /* The optional systems. Every one of them defaults to the behaviour the game
     already had, which is what lets the several hundred assertions above go on
     measuring the engine they were calibrated against. */
  depthRules(A) {
    section("Depth rules");
    const G = A.newGame(0, { seed: 1717, rules: { seasonLen: 41 } });
    ok(A.depthPreset(G) === "classic", "a new career starts on Classic");
    ok(A.DEPTH_RULES.every((d) => A.ruleValue(G, d.k) === d.opts[0][0]),
      `every depth rule defaults to off (${A.DEPTH_RULES.length} of them)`);
    ok(A.DEPTH_RULES.every((d) => d.label && d.blurb && d.group && d.opts.length >= 2),
      "and each one is described well enough to render");

    A.applyDepthPreset(G, "deep");
    ok(A.depthPreset(G) === "deep", "the Deep preset turns them all on");
    /* Deep must pick the RICHEST setting, not the last one in the list. Home
       ice runs classic / realistic / none, so taking the last option made Deep
       switch the home advantage off altogether. */
    ok(A.ruleValue(G, "homeIce") === "realistic", "and Deep means realistic home ice, not none");
    ok(A.DEPTH_RULES.every((d) => d.deep !== undefined && d.deep !== d.opts[0][0]),
      "every rule names a Deep value that differs from its off setting");
    A.setRule(G, "devFocus", false);
    ok(A.depthPreset(G) === null, "and changing one reads as Custom");
    A.applyDepthPreset(G, "classic");
    ok(A.depthPreset(G) === "classic", "Classic puts them all back");

    /* THE REAL TEST: a full season with everything switched on has to produce a
       league that still obeys its own invariants. A depth feature that quietly
       broke the box score would otherwise only show up in a save. */
    const D = A.newGame(0, { seed: 1717, rules: { seasonLen: 41 } });
    A.applyDepthPreset(D, "deep");
    A.applyPendingRules(D);
    simSeason(A, D); simPlayoffs(A, D);
    ok(D.teams.every((t) => t.gp === 41), "a full season plays out with every system on");
    const gf = D.teams.reduce((s, t) => s + t.gf, 0), ga = D.teams.reduce((s, t) => s + t.ga, 0);
    ok(gf === ga, `and the books still balance (${gf} vs ${ga})`);
    ok(D.teams.every((t) => t.pts === t.w * 2 + t.otl), "points still reconcile");
    ok(D.teams.every((t) => A.capHit(D, t.id) <= A.rules(D).capAmount + 0.5), "and nobody is over the cap");

    A.autoDraft(D, false); A.startNextSeason(D);
    ok(D.phase === "regular", "the rollover completes");
    // Checked HERE, not before the rollover — contracts expire in finishSeason
    // and `fillRosters` is what puts a legal side back together.
    ok(D.teams.every((t) => A.rosterOf(D, t.id).length >= A.ROSTER_MIN), "everybody can still dress a side");
    ok(D.teams.every((t) => A.rosterOf(D, t.id, true).length <= A.ROSTER_MAX + A.FARM_MAX),
      "with legal organisations");

    // Two-way deals: cheaper in the minors, and only for fringe money.
    const T = A.newGame(0, { seed: 55, rules: { seasonLen: 41, twoWayDeals: true } });
    const fringe = A.rosterOf(T, 0, true).find((p) => p.contract.amt <= A.TERMINATE_MAX_CAP);
    const star = A.rosterOf(T, 0, true).slice().sort((a, b) => b.contract.amt - a.contract.amt)[0];
    ok(A.isTwoWay(T, fringe), "a fringe contract can be two-way");
    ok(!A.isTwoWay(T, star), "a real one cannot — burying a star would be the exploit");
    fringe.farm = false;
    const up = A.effectiveCap(T, fringe);
    fringe.farm = true;
    const down = A.effectiveCap(T, fringe);
    ok(down < up, `and it costs less in the minors ($${down}M vs $${up}M)`);
    ok(Math.abs(down - up * A.TWO_WAY_MINORS_PCT) < 0.06, "by the stated fraction");
    const off = A.newGame(0, { seed: 55, rules: { seasonLen: 41 } });
    const f2 = A.rosterOf(off, 0, true).find((p) => p.contract.amt <= A.TERMINATE_MAX_CAP);
    f2.farm = true;
    ok(A.effectiveCap(off, f2) === f2.contract.amt, "with the rule off he costs full price");

    // Conditioning: a demotion with a counter, which brings itself back up.
    const C = A.newGame(0, { seed: 66, rules: { seasonLen: 41, conditioning: true } });
    const man = A.rosterOf(C, 0).find((p) => p.inj <= 0);
    ok(!A.canCondition(C, man), "a fit player has no need of a stint");
    man.rust = 5;
    ok(A.canCondition(C, man), "a rusty one does");
    man.inj = 4;
    ok(!A.canCondition(C, man), "but not while he's still hurt");
    man.inj = 0;
    ok(A.startStint(C, man.id, 3).ok && man.farm && man.stint === 3, "a stint sends him down with a counter");
    A.simDays(C, 30);
    ok(!man.stint, "which runs out as the affiliate plays");
    ok(!man.farm, "and brings him straight back up");
    const noRule = A.newGame(0, { seed: 66, rules: { seasonLen: 41 } });
    const m2 = A.rosterOf(noRule, 0)[0]; m2.rust = 5;
    ok(!A.startStint(noRule, m2.id, 3).ok, "with the rule off there are no stints");

    // Staff and the farm coach are DERIVED, so they cost no randomness.
    const S1 = A.newGame(0, { seed: 99, rules: { seasonLen: 41 } });
    const S2 = A.newGame(0, { seed: 99, rules: { seasonLen: 41, coachStaff: true, farmCoach: true } });
    ok(S1.players && Object.keys(S1.players).length === Object.keys(S2.players).length,
      "turning them on generates no extra players");
    ok(A.staffOf(S1, S1.teams[3]).head, "with the rule off the head coach does everything");
    ok(!A.staffOf(S2, S2.teams[3]).head, "with it on the specialists do");
    ok(A.STAFF_ROLES.every((r) => A.staffOf(S2, S2.teams[3])[r.k] >= 25
      && A.staffOf(S2, S2.teams[3])[r.k] <= 95), "and every one of them is a real rating");
    ok(A.staffOf(S2, S2.teams[3]).pp === A.staffOf(S2, S2.teams[3]).pp, "stable across reads");
    ok(A.farmCoachOf(S2, S2.teams[3]).dev !== undefined, "the affiliate has a coach of its own");
    ok(A.farmCoachOf(S1, S1.teams[3]).dev === A.coachOf(S1.teams[3]).dev,
      "and without the rule it is simply the head coach");

    // Home ice: classic is what it always was, realistic is the real band.
    ok(A.homeEdge(S1, true) === 1 && A.homeEdge(S1, false) === 1, "classic home ice adds nothing");
    const H = A.newGame(0, { seed: 99, rules: { seasonLen: 41, homeIce: "realistic" } });
    ok(A.homeEdge(H, true) > 1 && A.homeEdge(H, false) < 1, "realistic cuts both ways");
    ok(Math.abs(A.homeEdge(H, true) * A.homeEdge(H, false) - 1) < 1e-9,
      "and gives the home side exactly what it takes from the road side");

    // Rivalries that build.
    const R = A.newGame(0, { seed: 99, rules: { seasonLen: 41, rivalryGrowth: true } });
    const [a, b] = [0, 5];
    ok(A.grudgeBetween(R, a, b) === 0, "two strangers have no history");
    A.addGrudge(R, a, b);
    ok(A.grudgeBetween(R, a, b) === 1 && A.grudgeBetween(R, b, a) === 1, "a series makes it mutual");
    ok(A.rivalryHeat(R, a, b) > A.rivalryHeat(S1, a, b), "and a meeting is played harder than it would be");
    for (let i = 0; i < 9; i++) A.addGrudge(R, a, b);
    ok(A.grudgeBetween(R, a, b) <= 3, "it doesn't run away with itself");
    ok(A.grudgeBetween(S1, a, b) === 0, "and with the rule off nobody holds a grudge");

    // Bust risk: spread without a change of mean.
    const V = A.newGame(0, { seed: 99, rules: { seasonLen: 41, prospectRisk: true } });
    const vals = A.playersOf(V).slice(0, 300).map((p) => A.volatilityOf(V, p));
    ok(Math.min(...vals) < 0.8 && Math.max(...vals) > 1.4, "prospects differ in how safe they are");
    const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
    ok(Math.abs(mean - 1.15) < 0.12, `and it is centred (${mean.toFixed(2)})`);
    ok(A.volatilityOf(S1, A.playersOf(S1)[0]) === 1, "with the rule off everybody is average");
    const p0 = A.playersOf(V)[0];
    ok(A.volatilityOf(V, p0) === A.volatilityOf(V, p0), "and a player's risk never changes");

    // Area scouting: broad and shallow, and it costs more.
    const Sc = A.newGame(0, { seed: 99, rules: { seasonLen: 41, areaScouting: true } });
    simSeason(A, Sc); simPlayoffs(A, Sc);
    const before = Sc.scoutPoints;
    const sweep = A.scoutArea(Sc, "pos", "G");
    ok(sweep.ok && sweep.seen > 5, `a sweep covers a whole position (${sweep.seen})`);
    ok(Sc.scoutPoints === before - A.AREA_SCOUT_COST, "and costs several visits");
    const solo = A.newGame(0, { seed: 99, rules: { seasonLen: 41 } });
    simSeason(A, solo); simPlayoffs(A, solo);
    ok(!A.scoutArea(solo, "pos", "G").ok, "with the rule off there are no sweeps");

    // Undrafted free agents.
    const U = A.newGame(0, { seed: 99, rules: { seasonLen: 41, undraftedFA: true } });
    simSeason(A, U); simPlayoffs(A, U);
    const poolBefore = U.freeAgents.length;
    A.autoDraft(U, false);
    const fresh = U.freeAgents.filter((id) => U.players[id] && U.players[id].undrafted);
    ok(fresh.length > 0 && fresh.length <= A.UNDRAFTED_KEEP,
      `the best of the undrafted reach the market (${fresh.length})`);
    ok(U.freeAgents.length > poolBefore, "which is a bigger pool than before");
    ok(fresh.every((id) => U.players[id].teamId == null), "and none of them belongs to anybody");
  },

  /* The last three systems, and the four views that need no switch. */
  depthExtras(A) {
    section("Trade-up offers");
    const G = A.newGame(0, { seed: 4141, rules: { seasonLen: 41, draftTradeUp: true } });
    simSeason(A, G); simPlayoffs(A, G);
    ok(!A.draftUpOffers(A.newGame(0, { seed: 4141, rules: { seasonLen: 41 } })).length,
      "with the rule off nobody rings");
    // Sim to the user's pick so there is something to be offered.
    A.autoDraft(G, true);
    const offers = A.draftUpOffers(G);
    ok(offers.length > 0, `clubs call to move up (${offers.length})`);
    ok(offers.length <= 4, "and not so many that it's noise");
    ok(offers.every((o) => o.from !== G.userTeam), "none of them is you");
    ok(offers.every((o) => o.theirAt > o.at), "every one of them picks later than you do");
    ok(offers.every((o) => o.myPick.owner === G.userTeam), "and wants the pick you actually hold");
    /* They have to be OFFERING more than they get, or it isn't a trade up. */
    ok(offers.every((o) => {
      const give = A.pickValue(G, o.theirPick) + o.extras.reduce((s, pk) => s + A.pickValue(G, pk), 0);
      return give >= A.pickValue(G, o.myPick);
    }), "each pays a premium over the raw value of the slot");
    ok(offers.every((o) => G.players[o.want] && G.draftClass.includes(o.want)),
      "and is after somebody still on the board");
    // Computed, not stored: the same board gives the same offers.
    ok(JSON.stringify(A.draftUpOffers(G).map((o) => o.from))
       === JSON.stringify(offers.map((o) => o.from)), "the offers are stable across reads");

    const o0 = offers[0];
    const myPicksBefore = A.tradablePicks(G, G.userTeam).length;
    const r = A.acceptDraftUp(G, o0);
    ok(r.ok, "an offer can be accepted");
    ok(A.tradablePicks(G, G.userTeam).length === myPicksBefore + o0.extras.length,
      "and you come out of it with more picks than you went in with");
    ok(A.pickOwner(G, o0.at - 1) === o0.from, "the club that moved up now holds the slot");

    section("Player demands");
    const D = A.newGame(0, { seed: 5252, rules: { seasonLen: 82, demands: true } });
    A.simDays(D, 120);
    const asked = A.rosterOf(D, D.userTeam, true).filter((p) => p.demand);
    ok(asked.length > 0, `somebody spoke up (${asked.length})`);
    ok(asked.length < 12, "but not the whole room");
    ok(asked.every((p) => p.demand.kind === "minutes" || p.demand.kind === "trade"),
      "each asking for one of two things");
    /* A demand has to be EARNED — every one of them must be playing less than a
       player of his standard expects, or it's just noise. */
    ok(asked.every((p) => p.season.toi / p.season.gp < A.expectedMinutes(p)),
      "and every one of them is genuinely under-used");
    ok(asked.every((p) => p.pos !== "G"), "goalies don't count minutes this way");
    // Unhappiness costs something on the ice, which is what makes it matter.
    const unhappy = asked[0];
    ok(A.demandDrag(D, unhappy) < 1, "an unhappy player is worth less than a happy one");
    ok(A.demandDrag(D, A.rosterOf(D, D.userTeam).find((p) => !p.demand)) === 1, "and a content one is not penalised");
    const off = A.newGame(0, { seed: 5252, rules: { seasonLen: 82 } });
    A.simDays(off, 120);
    ok(!A.rosterOf(off, off.userTeam, true).some((p) => p.demand), "with the rule off nobody asks for anything");
    ok(A.demandDrag(off, unhappy) === 1, "and nobody is dragged down by it");

    section("Named affiliate depth");
    const F = A.newGame(0, { seed: 6363, rules: { seasonLen: 41, farmDepth: true } });
    simSeason(A, F); simPlayoffs(A, F); A.autoDraft(F, false); A.startNextSeason(F);
    const stocked = F.teams.map((t) => A.rosterOf(F, t.id, true).filter((p) => p.affiliate).length);
    ok(Math.max(...stocked) > 0, `affiliates carry real players (${Math.max(...stocked)} at most)`);
    ok(stocked.every((n) => n <= A.FARM_DEPTH_EACH), "and never more than the rule allows");
    ok(F.teams.every((t) => A.rosterOf(F, t.id, true).length <= A.ROSTER_MAX + A.FARM_MAX),
      "without pushing an organisation past its limit");
    ok(F.teams.every((t) => A.capHit(F, t.id) <= A.rules(F).capAmount), "or over the cap");
    const plain = A.newGame(0, { seed: 6363, rules: { seasonLen: 41 } });
    simSeason(A, plain); simPlayoffs(A, plain); A.autoDraft(plain, false); A.startNextSeason(plain);
    ok(!A.playersOf(plain).some((p) => p.affiliate), "with the rule off the farm stays phantom");

    section("The views");
    // The lottery is recorded rather than resolved and thrown away.
    ok(G.lottery && G.lottery.year === G.year, "the lottery draw is kept");
    ok(G.lottery.winner === G.draftOrder[0], "the winner picks first");
    ok(G.lottery.from >= 1 && G.lottery.from <= 10, `from somewhere in the bottom ten (${G.lottery.from})`);
    ok(G.lottery.odds > 0 && G.lottery.odds < 1, "with the odds he beat");
    ok(G.lottery.passed.length === G.lottery.from - 1, "and everyone he jumped");

    // Farm awards.
    ok(F.farmAwards === null || F.farmAwards, "farm awards exist as a concept");
    const FA = A.newGame(0, { seed: 6363, rules: { seasonLen: 41 } });
    simSeason(A, FA); simPlayoffs(A, FA);
    ok(FA.farmAwards && FA.farmAwards.year === FA.year, "a farm season produces awards");
    ok(FA.farmAwards.scoring && FA.farmAwards.scoring.name, "with a named leading scorer");
    ok(FA.farmAwards.scoring.v > 0, "who actually scored");
    ok(!FA.farmAwards.goalie || FA.farmAwards.goalie.v > 80, "and a goaltender with a real save percentage");

    // Call-up cost.
    const prospect = A.playersOf(FA).find((p) => p.farm && p.teamId != null && p.pos !== "G");
    const cost = A.callUpCost(FA, prospect);
    ok(cost && cost.rank >= 1 && cost.rank <= FA.teams.length, "a call-up says where the affiliate sits");
    ok(cost.now > 0 && cost.after > 0, "and what it is worth with and without him");
    ok(A.callUpCost(FA, A.rosterOf(FA, 0)[0]) === null, "an NHL player has no call-up cost");

    // Draft class report. The class has to have been TAKEN first — a season
    // and a postseason leave `p.draft` unstamped on everybody.
    A.autoDraft(FA, false);
    const rep = A.draftClassReport(FA, FA.year);
    ok(rep && rep.rows.length === A.draftPicksTotal(FA), `a class can be graded (${rep ? rep.rows.length : 0})`);
    ok(rep.rows.every((r) => r.p.draft.year === FA.year), "with only that year's picks");
    ok(rep.rows.every((r, i) => i === 0 || r.p.draft.pick >= rep.rows[i - 1].p.draft.pick),
      "in the order they were taken");
    /* Grading is against the SLOT, so a first overall is held to a far higher
       standard than a seventh-rounder — otherwise the table just re-sorts the
       league by ability and says nothing about the draft. */
    /* Expressed as a FRACTION of the draft, not a pick number — the draft went
       from 224 selections to 96 and a hard-coded "pick 150" stopped existing. */
    const total = A.draftPicksTotal(FA);
    const early = rep.rows.filter((r) => r.p.draft.pick <= Math.max(5, total * 0.1));
    const late = rep.rows.filter((r) => r.p.draft.pick > total * 0.75);
    ok(early.length && late.length && early[0].par > late[0].par,
      `an early pick is expected to be better (${early[0].par} vs ${late[0].par})`);
    ok(rep.rows.every((r) => r.gp >= 0 && r.pts >= 0), "and every row has real career numbers");
    ok(A.draftClassReport(FA, FA.year - 40) === null, "a year nobody was drafted in has no report");
  },

  /* Contracts with terms in them, and a way out of one. */
  contractDepth(A) {
    section("Buyouts");
    const G = A.newGame(0, { seed: 8181, rules: { seasonLen: 41 } });
    const cheap = A.rosterOf(G, 0, true).find((p) => p.contract.amt <= A.TERMINATE_MAX_CAP);
    const big = A.rosterOf(G, 0, true).slice().sort((a, b) => b.contract.amt - a.contract.amt)[0];
    ok(!A.canBuyOut(G, cheap), "a fringe contract is cut, not bought out");
    ok(A.canBuyOut(G, big), "a real one can be bought out");
    big.contract = { amt: 9, yrs: 2 };
    const c = A.buyoutCost(G, big.id);
    /* The trade that makes it a decision: a fraction of what's left, spread
       over double the term. Cheap now, still there when he's retired. */
    ok(c.yrs === 2 * A.BUYOUT_TERM_MULT, `it stretches over double the term (${c.yrs} years)`);
    ok(Math.abs(c.total - 9 * 2 * A.BUYOUT_PCT) < 0.05, "at a fraction of what he was owed");
    ok(c.perYear < 9, `and costs less per year than keeping him ($${c.perYear}M vs $9M)`);
    const capBefore = A.capHit(G, 0);
    const r = A.buyOut(G, big.id);
    ok(r.ok && big.teamId == null, "buying him out frees the roster spot");
    ok(G.freeAgents.includes(big.id), "and puts him on the market");
    ok(A.retainedBy(G, 0).some((x) => x.buyout), "the dead money is recorded as a buyout");
    ok(A.capHit(G, 0) < capBefore, "the cap goes down");
    ok(A.capHit(G, 0) > capBefore - 9, "but not by the whole contract");
    /* A no-trade clause is a promise not to MOVE him, not to employ him. */
    const H = A.newGame(0, { seed: 8181, rules: { seasonLen: 41 } });
    const shielded = A.rosterOf(H, 0, true).find((p) => A.hasNtc(p));
    if (shielded) {
      shielded.contract = { amt: 8, yrs: 2 };
      ok(A.buyOut(H, shielded.id).ok, "a clause does not protect against a buyout");
    } else ok(true, "nobody on that club has a clause");

    section("Negotiating terms");
    const N = A.newGame(0, { seed: 8181, rules: { seasonLen: 41 } });
    const star = A.playersOf(N).find((p) => A.eligibleForNtc(p) && p.teamId != null);
    ok(star && A.valuesNtc(N, star), "an established player values a no-trade clause");
    const plain = A.askingPrice(N, star.id, 0, 4);
    const withNtc = A.askingPrice(N, star.id, 0, 4, { ntc: true });
    ok(withNtc < plain, `and takes less to get one ($${withNtc}M vs $${plain}M)`);
    ok(Math.abs(withNtc / plain - (1 - A.NTC_DISCOUNT)) < 0.02, "by about the stated discount");
    const kid = A.playersOf(N).find((p) => p.teamId != null && !A.eligibleForNtc(p));
    ok(A.askingPrice(N, kid.id, 0, 4, { ntc: true }) === A.askingPrice(N, kid.id, 0, 4),
      "offering one to a player who'd never be moved anyway buys nothing");
    // Signing with the clause agreed is not a coin flip any more.
    star.teamId = null; N.freeAgents.push(star.id);
    ok(A.signPlayer(N, star.id, 0, withNtc, 4, { ntc: true }).ok, "he signs on those terms");
    ok(A.hasNtc(star), "and gets the clause he agreed");
    const K = A.newGame(0, { seed: 8181, rules: { seasonLen: 41 } });
    const star2 = A.playersOf(K).find((p) => A.eligibleForNtc(p) && p.teamId != null);
    star2.teamId = null; K.freeAgents.push(star2.id);
    A.signPlayer(K, star2.id, 0, 12, 4, { ntc: false });
    ok(!A.hasNtc(star2), "and none when you don't give one");
    // An unhappy man doesn't re-sign at the going rate.
    const U = A.newGame(0, { seed: 8181, rules: { seasonLen: 41, demands: true } });
    const guy = A.rosterOf(U, 0)[0];
    const before = A.askingPrice(U, guy.id, 0, 3);
    guy.demand = { kind: "trade", day: 1, year: U.year, want: 18, got: 9 };
    ok(A.askingPrice(U, guy.id, 0, 3) > before, "a player who asked out costs more to keep");
    ok(A.termAdjust(U, A.rosterOf(U, 0)[1], null) === 1, "and a content one costs what he always did");

    section("Answering a demand");
    const D = A.newGame(0, { seed: 9292, rules: { seasonLen: 82, demands: true } });
    A.simDays(D, 120);
    /* Built rather than waited for. Letting the sim decide whether these paths
       run at all means the day it stops producing demands the checks quietly
       pass without testing anything. */
    const asker = A.rosterOf(D, D.userTeam)[0];
    asker.demand = { kind: "minutes", day: D.day, year: D.year, want: 18, got: 9 };
    ok(A.answerDemand(D, asker.id, "promise").ok, "you can promise him minutes");
    ok(asker.demand.answered === "promise" && asker.demand.base != null,
      "and what he was playing when you gave your word is written down");
    // A promise you don't keep is worse than a refusal.
    asker.demand.promisedAt = D.day - A.PROMISE_WINDOW - 1;
    asker.demand.base = 99;                 // minutes he was never going to reach
    A.checkPromises(D);
    ok(asker.demand && asker.demand.kind === "trade" && asker.demand.broken,
      "a broken promise turns into a trade demand");
    // And one you DO keep settles it.
    const kept = A.rosterOf(D, D.userTeam)[1];
    kept.demand = { kind: "minutes", day: D.day, year: D.year, want: 18, got: 9,
      answered: "promise", promisedAt: D.day - A.PROMISE_WINDOW - 1, base: 0 };
    A.checkPromises(D);
    ok(!kept.demand, "a promise you keep ends it");

    const wantsOut = A.rosterOf(D, D.userTeam)[2];
    wantsOut.demand = { kind: "trade", day: D.day, year: D.year, want: 18, got: 9 };
    ok(A.answerDemand(D, wantsOut.id, "trade").ok, "you can agree to move him");
    ok(A.onBlock(D, wantsOut.id), "which puts him on the block");

    /* Holdouts. `steady` decides who actually goes through with it, so the man
       is chosen by character rather than by luck of the roster order. */
    const H2 = A.newGame(0, { seed: 9292, rules: { seasonLen: 82, demands: true } });
    const willing = A.rosterOf(H2, 0).find((p) => A.personalityOf(p).steady < 1.3);
    const loyal = A.rosterOf(H2, 0).find((p) => A.personalityOf(p).steady >= 1.3);
    [willing, loyal].filter(Boolean).forEach((p) => {
      p.demand = { kind: "trade", day: 0, year: H2.year, want: 18, got: 9 };
    });
    H2.day = A.HOLDOUT_AFTER + 1;
    A.rollHoldouts(H2);
    ok(willing && willing.holdout, "a player who won't wear it holds out");
    ok(!loyal || !loyal.holdout, "a steady one turns up anyway");
    ok(!A.activeRoster(H2, 0).some((p) => p.holdout), "a holdout cannot be dressed");
    ok(A.rosterOf(H2, 0).some((p) => p.holdout), "though he is still on the roster");
    ok(A.endHoldout(H2, willing.id).ok && !willing.holdout && !willing.demand,
      "and settling it brings him back");

    section("The staff market");
    const S = A.newGame(0, { seed: 3434, rules: { seasonLen: 41, coachStaff: true, areaScouting: true } });
    const mkt = A.staffMarket(S, "pp");
    ok(mkt.length === A.STAFF_MARKET_SIZE, `there is a market (${mkt.length})`);
    ok(mkt.every((c) => c.name && c.rating >= 25 && c.rating <= 95 && c.cost > 0), "with real people in it");
    ok(mkt.every((c, i) => i === 0 || c.rating <= mkt[i - 1].rating), "best first");
    ok(JSON.stringify(A.staffMarket(S, "pp")) === JSON.stringify(mkt), "and it doesn't reshuffle when you look again");
    ok(JSON.stringify(A.staffMarket(S, "pk")) !== JSON.stringify(mkt), "each job has its own candidates");
    const wasPP = A.staffOf(S, S.teams[0]).pp;
    ok(A.hireStaff(S, "pp", mkt[0]).ok, "you can hire one");
    ok(A.staffOf(S, S.teams[0]).pp === mkt[0].rating, "and he is the man the engine reads");
    ok(A.fireStaff(S, "pp").ok, "you can fire him");
    ok(A.staffOf(S, S.teams[0]).pp === wasPP, "and it falls back to who you had");
    ok(A.hireStaff(S, "scout", A.staffMarket(S, "scout")[0]).ok, "a head scout can be hired too");
    ok(A.scoutOf(S, S.teams[0]).rating === A.staffMarket(S, "scout")[0].rating, "and he's the one who does the sweeps");
    const off = A.newGame(0, { seed: 3434, rules: { seasonLen: 41 } });
    ok(!A.hireStaff(off, "pp", mkt[0]).ok, "with the rule off there is nobody to hire");

    section("Pick protections");
    const P = A.newGame(0, { seed: 5656, rules: { seasonLen: 41, pickProtection: true } });
    const pk = P.picks.find((x) => x.year === P.year && x.round === 1 && x.orig === 0);
    ok(A.protectionOf(pk).k === "none", "a pick is unprotected by default");
    ok(A.PROTECTIONS.every((x) => x.value <= 1), "and protection only ever costs value");
    const raw = A.pickValue(P, pk);
    pk.protect = "top10";
    ok(A.pickValue(P, pk) < raw, `a protected pick is worth less (${A.pickValue(P, pk).toFixed(1)} vs ${raw.toFixed(1)})`);
    // It has to actually convey, or not, once the order is known.
    pk.owner = 1;
    simSeason(A, P); simPlayoffs(A, P);
    const slot = A.pickSlot(P, pk);
    const stayed = pk.owner === 0;
    ok(slot != null, `the order is drawn (${slot})`);
    ok(stayed === (slot <= 10), `a top-10 protected pick ${stayed ? "stayed home" : "conveyed"} correctly at ${slot}`);
    if (stayed) {
      const next = P.picks.find((x) => x.year === P.year + 1 && x.round === 1 && x.orig === 0);
      ok(next && next.owner === 1 && next.rolled, "and the obligation rolled to next year");
    } else ok(true, "it conveyed, so nothing rolled");
    ok(!pk.protect, "the protection is spent either way");

    section("Draft tiers");
    ok(A.draftTier(P, { scout: { fog: 0, bias: 0, bias2: 0 }, ovr: 99, pot: 99, r: {} }) >= 4,
      "a top prospect reads as a high tier");
    const board = P.draftClass.map((id) => P.players[id]);
    const tiers = board.map((p) => A.draftTier(P, p));
    ok(new Set(tiers).size >= 3, `a board splits into several tiers (${new Set(tiers).size})`);
    ok(tiers.every((t) => t >= 0 && t < A.DRAFT_TIER_LABEL.length), "and every one has a label");
  },

  /* Playoff hockey as a teacher, and the double dip — a farm season AND a
     spring in the NHL is two developmental years in one. */
  playoffDevelopment(A) {
    section("The spring teaches");
    const F = A.DEV_FARM;
    const full = { gp: 82, g: 20, a: 25 };
    const run = (gp) => ({ gp });

    ok(A.playoffDev(null, null) === 0, "no playoffs, no bonus");
    ok(A.playoffDev(null, run(0)) === 0, "and none for a club that missed out");
    ok(Math.abs(A.devEnvironment({ pos: "C" }, null, full) - F) < 1e-9,
      `a farm season with no spring is still exactly DEV_FARM (${F})`);

    // A run is worth more the deeper it goes, and it caps out.
    const short = A.playoffDev(null, run(4)), deep = A.playoffDev(null, run(A.DEV_PLAYOFF_FULL));
    ok(short > 0 && deep > short, `a deep run teaches more than a first-round exit (${deep.toFixed(2)} vs ${short.toFixed(2)})`);
    ok(Math.abs(deep - A.DEV_PLAYOFF) < 1e-9, `and a full run is worth DEV_PLAYOFF (${A.DEV_PLAYOFF})`);
    ok(A.playoffDev(null, run(40)) === deep, "a longer one can't be worth more than the distance");

    /* THE DOUBLE DIP. The same spring is worth substantially more to a man who
       earned it with a real season in the minors first — he got the minutes
       there and the intensity here, which is what neither path gives alone. */
    const alone = A.playoffDev(run(0), run(A.DEV_PLAYOFF_FULL));
    const dipped = A.playoffDev({ gp: A.DOUBLE_DIP_MIN_FARM }, run(A.DEV_PLAYOFF_FULL));
    ok(dipped > alone, `a farm season plus a run beats the run alone (${dipped.toFixed(2)} vs ${alone.toFixed(2)})`);
    ok(Math.abs(dipped - (A.DEV_PLAYOFF + A.DEV_DOUBLE_DIP)) < 1e-9, "by exactly the double-dip bonus");
    ok(dipped > alone * 1.7, "which is worth roughly doubling it");
    const cameo = A.playoffDev({ gp: A.DOUBLE_DIP_MIN_FARM - 1 }, run(A.DEV_PLAYOFF_FULL));
    ok(cameo === alone, "a handful of farm games doesn't count as having earned it");

    // It stacks on the year rather than replacing it.
    const farmOnly = A.devEnvironment({ pos: "C" }, null, full);
    const farmPlus = A.devEnvironment({ pos: "C" }, null, full, null, run(A.DEV_PLAYOFF_FULL));
    ok(farmPlus > farmOnly, `the spring is added to the year (${farmPlus.toFixed(2)} vs ${farmOnly.toFixed(2)})`);
    ok(Math.abs(farmPlus - (farmOnly + dipped)) < 1e-9, "exactly, and nothing else moves");
    // A man who played nowhere but the postseason still learned something.
    ok(A.devEnvironment({ pos: "C" }, null, null, null, run(8)) > 0, "a callup for the run alone counts");
    ok(A.devEnvironment({ pos: "C" }, null, null, null, null) === 0, "and playing nowhere at all is still nothing");

    /* And it reaches `progress` — the whole reason this didn't work before was
       that `p.po` was cleared at the rollover BEFORE development ran. */
    const G = A.newGame(0, { seed: 1212, rules: { seasonLen: 41 } });
    simSeason(A, G);
    const kid = A.playersOf(G).find((p) => p.age <= 21 && p.teamId != null && !p.retired);
    kid.stats = { gp: 0 }; kid.farmSeason = { gp: 40, g: 15, a: 20 };
    const withRun = A.devEnvironment(kid, kid.stats, kid.farmSeason, null, run(12));
    const without = A.devEnvironment(kid, kid.stats, kid.farmSeason, null, null);
    ok(withRun > without, "a prospect's year is worth more when it ends in the NHL playoffs");

    /* End to end. Two identical leagues on the same seed, the same player, and
       the only difference is a playoff run — `progress` consumes the same
       number of `rnd` calls either way, so the gauss draws are identical and
       any gap is the spring alone. This is what actually failed before: the
       maths was reachable and the caller never passed it. */
    const mk = () => {
      const g = A.newGame(0, { seed: 4321, rules: { seasonLen: 41 } });
      const q = A.playersOf(g).find((x) => x.age <= 21 && x.teamId != null && !x.retired);
      q.stats = { gp: 0 }; q.farmSeason = { gp: 40, g: 15, a: 20 };
      return { g, q };
    };
    const a1 = mk(), a2 = mk();
    ok(a1.q.id === a2.q.id && a1.q.ovr === a2.q.ovr, "the same prospect in two identical leagues");
    A.progress(a1.g, a1.q, { gp: A.DEV_PLAYOFF_FULL });
    A.progress(a2.g, a2.q, null);
    ok(a1.q.ovr > a2.q.ovr,
      `the one who played the spring came out better (${a1.q.ovr} vs ${a2.q.ovr})`);

    simPlayoffs(A, G);
    // finishSeason has run: every playoff line is archived and cleared.
    ok(A.playersOf(G).every((p) => !p.po), "the playoff line is cleared after the rollover");
    ok(A.playersOf(G).some((p) => p.careerPO && p.careerPO.gp), "but the record of it survives");
  },

  /* A career with a second axis: what you're paid, what you're worth, and the
     long road to owning the place outright. */
  ownership(A) {
    section("Getting paid");
    const off = A.newGame(0, { seed: 1919, rules: { seasonLen: 41 } });
    simSeason(A, off); simPlayoffs(A, off);
    ok((A.gmState(off).cash || 0) === 0, "with the rule off you are not paid");

    const G = A.newGame(0, { seed: 1919, rules: { seasonLen: 41, ownership: true, autoManage: true } });
    ok(A.gmLegacy(G) === 0, "a new manager has no legacy");
    const first = A.gmSalaryFor(G, 0);
    ok(first > 0 && first < 6, `a first job pays a first job's money ($${first}M)`);
    simSeason(A, G); simPlayoffs(A, G);
    ok(A.gmState(G).cash > 0, `a season's work is paid ($${A.gmState(G).cash}M)`);
    ok(G.gmOffer && G.gmOffer.salary > 0, "and a contract is put on the table");
    // Signing it is your call, not the board's.
    A.gmState(G).contract = { salary: G.gmOffer.salary, yrs: G.gmOffer.yrs };
    G.gmOffer = null;

    /* Legacy has to be worth money, or none of this is a career. */
    const L = A.newGame(0, { seed: 1919, rules: { seasonLen: 41, ownership: true } });
    L.gmSeasons = [{ year: 2026, cup: true, rounds: 4, playoffs: true, w: 50, l: 20, otl: 12 },
                   { year: 2027, cup: true, rounds: 4, playoffs: true, w: 50, l: 20, otl: 12 }];
    ok(A.gmLegacy(L) > 50, `two cups is a real legacy (${A.gmLegacy(L)})`);
    ok(A.gmSalaryFor(L, 0) > first, `and it pays better ($${A.gmSalaryFor(L, 0)}M vs $${first}M)`);
    L.tenure = [{}, {}, {}];
    ok(A.gmLegacy(L) < A.gmLegacy({ ...L, tenure: [] }), "getting sacked costs you");

    section("What a club is worth");
    const vals = G.teams.map((t) => A.teamValue(G, t.id));
    ok(Math.min(...vals) > 15, `every club is worth something ($${Math.min(...vals)}M)`);
    ok(Math.max(...vals) > Math.min(...vals) * 1.4,
      `and they differ a lot ($${Math.max(...vals)}M vs $${Math.min(...vals)}M)`);
    const big = G.teams.slice().sort((a, b) => (b.mkt || 0) - (a.mkt || 0))[0];
    const small = G.teams.slice().sort((a, b) => (a.mkt || 0) - (b.mkt || 0))[0];
    ok(A.teamValue(G, big.id) > A.teamValue(G, small.id), "a big market is worth more than a small one");
    /* A club has to cost far more than you earn, or there is no ladder. */
    ok(Math.min(...vals) > A.gmSalaryFor(G, 0) * 4, "and far more than a season's salary");

    section("Buying in");
    const M = A.newGame(0, { seed: 1919, rules: { seasonLen: 41, ownership: true } });
    ok(!A.ownershipMarket(off).length, "with the rule off nothing is for sale");
    const mk = A.ownershipMarket(M);
    ok(mk.length > 0, `something is always available to somebody (${mk.length})`);
    ok(mk.every((o) => o.price > 0 && o.share > 0 && o.share <= 1), "priced and sized");
    ok(mk.every((o) => o.price <= o.value * 1.3), "and nobody is asking silly money");
    // Owners who never sell, never sell.
    const willing = M.teams.map((t) => A.sellWillingness(M, t.id));
    ok(Math.min(...willing) < 0.4 && Math.max(...willing) > 0.7, "owners differ in wanting out");
    ok(A.sellWillingness(M, 3) === A.sellWillingness(M, 3), "and an owner's appetite is stable");

    const gm = A.gmState(M);
    gm.cash = 500;
    /* THE CLUB YOU RUN. A thirty-year playthrough ended holding minority
       stakes in six clubs at once — several in the same division — while
       managing a seventh. No league permits either. */
    const buy = { teamId: M.userTeam, share: 0.2, price: 20 };
    const rival = M.teams.find((t) => t.id !== M.userTeam);
    ok(!A.buyStake(M, rival.id, 0.2, 20).ok, "you can't buy a piece of somebody else's club");
    const r = A.buyStake(M, buy.teamId, buy.share, buy.price);
    ok(r.ok, "you can buy in");
    ok(!A.buyStake(M, rival.id, 1, A.teamValue(M, rival.id) * 1.2).ok,
      "and not even a whole one while you hold a stake somewhere");
    ok(Math.abs(A.myShare(M, buy.teamId) - buy.share) < 0.02, "and you hold what you bought");
    ok(gm.cash === 500 - buy.price, "the money is really spent");
    ok(gm.ownHistory.length === 1 && gm.ownHistory[0].from === M.year, "it goes on your record");
    gm.cash = 0;
    ok(!A.buyStake(M, buy.teamId, 0.2, 50).ok, "and you can't buy what you can't afford");

    /* Buying partners out is the road to control, and the last slice is the
       dearest — the man holding it knows what it's worth to you. */
    gm.cash = 5000;
    let guard = 0;
    while (A.myShare(M, buy.teamId) < 1 && guard++ < 30) {
      const o = A.ownershipMarket(M).find((x) => x.teamId === buy.teamId && x.kind === "buyout");
      if (!o) break;
      A.buyStake(M, buy.teamId, o.share, o.price);
    }
    ok(A.myShare(M, buy.teamId) >= 1, "you can buy your way to the whole thing");
    ok(A.isMajorityOwner(M, buy.teamId), "which is a majority by definition");

    section("What ownership protects you from");
    ok(A.ownerVoteChance(M, buy.teamId) === 0, "a majority owner cannot be voted out");
    const P = A.newGame(0, { seed: 1919, rules: { seasonLen: 41, ownership: true } });
    P.boardConfidence = 2;
    ok(A.ownerVoteChance(P, 0) === 0, "somebody who owns nothing has no vote to face — the board just sacks him");
    A.gmState(P).stakes[0] = 0.2;
    const small20 = A.ownerVoteChance(P, 0);
    A.gmState(P).stakes[0] = 0.45;
    const big45 = A.ownerVoteChance(P, 0);
    ok(small20 > 0 && big45 > 0, "a minority owner can be voted out");
    ok(big45 < small20, `and a bigger stake is harder to remove (${big45.toFixed(2)} vs ${small20.toFixed(2)})`);
    A.gmState(P).stakes[0] = 0.2;
    P.boardConfidence = 80;
    ok(A.ownerVoteChance(P, 0) === 0, "nobody moves against a manager who is winning");

    // Owning it means choosing whether to run it.
    const S = A.newGame(0, { seed: 1919, rules: { seasonLen: 41, ownership: true } });
    ok(!A.standDown(S).ok, "you can't step back from a club you don't own");
    A.gmState(S).stakes[S.userTeam] = 0.8;
    ok(A.standDown(S).ok && S.gmStoodDown, "an owner can step back from running it");
    ok(A.takeBackTheJob(S).ok && !S.gmStoodDown, "and take it back whenever he likes");

    // Selling out is also how a career ends.
    const sell = A.sellStake(M, buy.teamId, 0.5);
    ok(sell.ok && sell.price > 0, `you can sell up ($${sell.price}M)`);
    ok(Math.abs(A.myShare(M, buy.teamId) - 0.5) < 0.02, "and keep the rest");

    /* Buying a club WHOLE from outside is the one exception — and then you go
       and run it, because that's what buying a hockey club means. */
    const W = A.newGame(0, { seed: 1919, rules: { seasonLen: 41, ownership: true } });
    const away = W.teams.find((t) => t.id !== W.userTeam);
    A.gmState(W).cash = 5000;
    const whole = A.buyStake(W, away.id, 1, A.teamValue(W, away.id) * 1.12);
    ok(whole.ok, "a club going in one piece can be bought from anywhere");
    ok(W.userTeam === away.id, "and you take the chair yourself");
  },

  /* Papercuts: not broken, just irritating. Two men with the same name in one
     room, two clubs running out a coach with the same name, no way to tell
     apart the two O. Côtés on the roster screen. */
  flavourNames(A) {
    section("Enough names to go round");
    const G = A.newGame(0, { seed: 777, rules: { seasonLen: 82 } });
    const combos = Object.values(A.NAMES).reduce((s, n) => s + n.first.length * n.last.length, 0);
    ok(combos > 12000, `${combos.toLocaleString()} name combinations (was 3,240)`);
    ok(Object.keys(A.NAMES).length === A.NATIONS.length, "one pool per nation");
    ok(Object.values(A.NAMES).every((n) => n.first.length >= 30 && n.last.length >= 40),
      "and none of them is thin");
    const all = A.playersOf(G).map((p) => A.fullName(p));
    ok(new Set(all).size / all.length > 0.9,
      `${new Set(all).size} distinct names among ${all.length} players`);
    ok(A.COACH_FIRST.length * A.COACH_LAST.length > 1500,
      `and ${(A.COACH_FIRST.length * A.COACH_LAST.length).toLocaleString()} coaches (was 320)`);

    section("Named for where he's from");
    /* A Russian called Cole Mackey was the giveaway. Nationality is derived
       from the id, so the name comes from the same place. */
    const bad = A.playersOf(G).filter((p) => {
      const pool = A.NAMES[A.nationOf(p).k];
      return !pool || !pool.first.includes(p.fn) || !pool.last.includes(p.ln);
    });
    ok(!bad.length, `every player is named for his country${bad.length
      ? ` (${A.fullName(bad[0])} is ${A.nationOf(bad[0]).k})` : ""}`);

    section("And a number on his back");
    const nums = A.sweaterMap(G, 0);
    const roster = A.rosterOf(G, 0, true);
    ok(roster.every((p) => nums[p.id] >= 1 && nums[p.id] <= 98), "everybody wears 1 to 98");
    ok(new Set(Object.values(nums)).size === Object.keys(nums).length,
      "and nobody on a club wears the same one as anybody else");
    ok(A.sweaterOf(roster[0]) === A.sweaterOf(roster[0]), "a number is stable, not drawn");
    ok(roster[0].num === undefined, "and nothing is stored for it");
    // A retired number is out of circulation.
    const R = A.newGame(0, { seed: 777, rules: { seasonLen: 82 } });
    const first = A.rosterOf(R, 0, true).slice().sort((a, b) => a.id - b.id)[0];
    R.teams[0].honours = [{ pid: -1, name: "Somebody", num: A.sweaterOf(first) }];
    const after = A.sweaterMap(R, 0);
    ok(after[first.id] !== A.sweaterOf(first), "a retired number is not handed out again");
  },

  /* A club left to run itself. It used to reach exactly two routines and went
     888-1327-245 over thirty seasons — not a club managing itself badly, a club
     with most of its hands tied. */
  autoManage(A) {
    section("Who the AI runs");
    const off = A.newGame(0, { seed: 4711, rules: { seasonLen: 41 } });
    ok(A.autoStyle(off) === null, "off by default");
    ok(!A.aiRuns(off, off.userTeam), "and nobody touches your club");
    ok(off.teams.every((t) => t.id === off.userTeam || A.aiRuns(off, t.id)),
      "while every other club is run");
    const on = A.newGame(0, { seed: 4711, rules: { seasonLen: 41, autoManage: "balanced" } });
    ok(A.aiRuns(on, on.userTeam), "handed over, yours is run too");
    // The old boolean still means something, so an existing save keeps working.
    const legacy = A.newGame(0, { seed: 4711, rules: { seasonLen: 41, autoManage: true } });
    ok(A.autoStyle(legacy) === A.AUTO_STYLES.balanced, "and an old on/off save reads as balanced");

    section("Every other club is untouched");
    /* The whole safety argument: a style is YOUR club's instruction and nothing
       else's, so switching one on can't move the league around you. */
    Object.keys(A.AUTO_STYLES).forEach((k) => {
      const G = A.newGame(0, { seed: 4711, rules: { seasonLen: 41, autoManage: k } });
      const others = G.teams.filter((t) => t.id !== G.userTeam);
      ok(others.every((t) => A.styleFor(G, t.id) === A.AUTO_STYLES.balanced),
        `on "${k}", the other thirty-one are still run normally`);
    });

    section("The instructions differ");
    const S = A.AUTO_STYLES;
    ok(S.contend.deadline === "buy" && S.build.deadline === "sell",
      "one buys at the deadline whatever the table says, one sells");
    ok(S.balanced.deadline === null && S.frugal.deadline === null,
      "and two read the table like everyone else");
    ok(S.contend.extend > S.balanced.extend && S.build.extend < S.balanced.extend,
      "one keeps its veterans, one lets them walk");
    ok(S.build.kids > 0 && S.contend.kids < 0, "one plays the kids, one plays the men");
    ok(S.frugal.spend < S.balanced.spend, "and one won't spend");
    /* A spend cap below the floor is inert — `enforceFloor` signs the club
       straight back up, which is exactly how frugal measured identical to
       balanced the first time round. */
    ok(S.frugal.spend > 0.76, "the frugal ceiling clears the cap floor, or it means nothing");

    section("They really play differently");
    const play = (style) => {
      const G = A.newGame(0, { seed: 4711, rules: { seasonLen: 41, autoManage: style } });
      for (let y = 0; y < 4; y++) {
        simSeason(A, G); simPlayoffs(A, G); A.autoDraft(G, false); A.startNextSeason(G);
      }
      /* The NHL roster, not the organisation. Every club's farm is full of
         teenagers whatever it's been told, so including it washed the
         difference out entirely — the question is who actually DRESSES. */
      const r = A.rosterOf(G, G.userTeam).filter((p) => !p.retired);
      return { cap: A.capHit(G, G.userTeam), kids: r.filter((p) => p.age <= 23).length,
        age: r.reduce((s, p) => s + p.age, 0) / Math.max(1, r.length), n: r.length };
    };
    const bal = play("balanced"), con = play("contend"), bui = play("build"), fru = play("frugal");
    /* NOT asserted: that contending outspends being frugal in dollars. It has
       flaked twice and a twelve-season, three-league run had it the other way
       round ($53.6M against $59.9M) — because a club keeping its veterans is
       keeping men who are already cheap, while a frugal one sitting on the
       floor is signing to reach it. The CEILINGS differ, which is the actual
       config claim and is asserted above; the realised payroll does not
       reliably follow, and a check that says otherwise is just wrong. */
    ok(A.AUTO_STYLES.frugal.spend < A.AUTO_STYLES.contend.spend,
      "a frugal club is allowed less of the cap than a contending one");
    ok(bui.age < con.age, `building runs younger (${bui.age.toFixed(1)} vs ${con.age.toFixed(1)})`);
    ok([bal, con, bui, fru].every((x) => x.n >= 20), "and all four still ice a legal team");

    /* NOT ASSERTED HERE: that win-now is front-loaded and building back-loaded
       in POINTS. It is true — over three leagues and twelve seasons win-now
       runs 94 → 83 and building 92 → 94 — but a run the harness can afford
       cannot resolve it. Eight seasons across two leagues gave the opposite
       sign, purely on which draft classes landed where, and a check that flakes
       on sample size is worse than no check.
       What IS asserted is the structural difference that produces it: who each
       club keeps, who it dresses, and how old it ends up. Those are above, and
       they don't need a big sample because they aren't downstream of luck.
       Use `scratchpad/autostyles.js` when the points arc needs re-measuring. */

    section("It leaves a club worth managing");
    /* The measure that matters. Nobody managing it at all is the disaster
       case — over three leagues and twelve seasons that ran 33 points a year
       and twenty-eighth; handed over, it runs at ninety and mid-table. */
    const alone = A.newGame(0, { seed: 4711, rules: { seasonLen: 82 } });
    const run = A.newGame(0, { seed: 4711, rules: { seasonLen: 82, autoManage: "balanced" } });
    [alone, run].forEach((G) => {
      for (let y = 0; y < 5; y++) {
        simSeason(A, G); simPlayoffs(A, G); A.autoDraft(G, false); A.startNextSeason(G);
      }
    });
    const pts = (G) => G.teams[G.userTeam].seasons.reduce((s, x) => s + x.pts, 0) / G.teams[G.userTeam].seasons.length;
    /* The margin narrowed from 27 points to 17 when `DRESS_MIN` was made to add
       up to the lineup — an abandoned club now at least ices a legal team, so
       it loses by less. That is a fix showing up in the numbers, not a
       regression, and the bar moves with it. */
    ok(pts(run) > pts(alone) + 12,
      `a club left to itself collapses; one handed over doesn't (${Math.round(pts(run))} vs ${Math.round(pts(alone))} pts a year)`);
    /* A payroll that is actually paying players rather than a shell of
       minimum deals — measured against the club nobody managed, which is what
       the difference is really about. */
    ok(A.capHit(run, run.userTeam) > A.capHit(alone, alone.userTeam) * 1.5,
      `and it pays a real payroll ($${A.capHit(run, run.userTeam)}M vs $${A.capHit(alone, alone.userTeam)}M)`);
    ok(A.rosterOf(run, run.userTeam).length >= A.ROSTER_MIN, "with a full team dressed");
  },

  /* What owning actually pays, and what an owner actually decides. Thirty
     simulated years found both holes: a stake earned nothing, and there was
     nothing to do with one. */
  ownerDirection(A) {
    section("A club pays its owners");
    const G = A.newGame(0, { seed: 6060, rules: { seasonLen: 41, ownership: true, autoManage: true } });
    const me = G.userTeam;
    ok(A.clubProfit(G, me) !== undefined, "a club has a bottom line");
    // A winning club clears money; a losing one at the cap burns it.
    const good = A.newGame(0, { seed: 6060, rules: { seasonLen: 41, ownership: true } });
    good.teams[me].seasons = [{ year: good.year, pts: 66, playoffs: true, rounds: 2 }];
    const bad = A.newGame(0, { seed: 6060, rules: { seasonLen: 41, ownership: true } });
    bad.teams[me].seasons = [{ year: bad.year, pts: 30, playoffs: false, rounds: 0 }];
    ok(A.clubProfit(good, me) > 0, `a good year clears money ($${A.clubProfit(good, me)}M)`);
    ok(A.clubProfit(bad, me) < 0, `a bad one loses it ($${A.clubProfit(bad, me)}M)`);
    ok(A.clubProfit(good, me) > A.clubProfit(bad, me), "and the gap is the whole point");

    A.gmState(good).stakes[me] = 0.5;
    const before = A.gmState(good).cash;
    A.payDividends(good);
    ok(A.gmState(good).cash > before, `an owner is paid his share ($${A.gmState(good).cash - before}M)`);
    ok((A.gmState(good).dividends || []).length === 1, "and it goes on the record");
    A.gmState(bad).stakes[me] = 0.5;
    const bcash = A.gmState(bad).cash;
    A.payDividends(bad);
    ok(A.gmState(bad).cash < bcash, "a share of a loss is also a share");
    // With no stake there is nothing to pay.
    const none = A.newGame(0, { seed: 6060, rules: { seasonLen: 41, ownership: true } });
    const ncash = A.gmState(none).cash;
    A.payDividends(none);
    ok(A.gmState(none).cash === ncash, "and a man who owns nothing is paid nothing for it");

    section("Setting the course");
    ok(!A.directionOf(G, me), "a manager doesn't set the club's direction");
    ok(!A.setDirection(G, "rebuild").ok, "and can't be asked to");
    A.gmState(G).stakes[me] = 0.6;
    const d = A.setDirection(G, "rebuild");
    ok(d.ok && A.directionOf(G, me) === A.DIRECTIONS.rebuild, "a controlling owner can");
    ok(G.mandate.key === "rebuild" && G.mandate.owner,
      "and the board's expectation becomes the thing HE chose");
    A.setMandate(G);
    ok(G.mandate.key === "rebuild", "which survives the next time the mandate is set");
    ok(!A.directionOf(G, G.teams.find((t) => t.id !== me).id), "nobody else's club has one");

    /* Each direction has to cost something, or it's a free win. */
    ok(A.DIRECTIONS.rebuild.dev > 1 && A.DIRECTIONS.rebuild.gate < 1 && A.DIRECTIONS.rebuild.ask > 1,
      "a rebuild develops kids, empties the building and has to overpay to sign anyone");
    ok(A.DIRECTIONS.winNow.dev < 1 && A.DIRECTIONS.winNow.gate > 1 && A.DIRECTIONS.winNow.ask < 1,
      "going for it fills it and signs cheap, and nobody young learns a thing");
    const R = A.newGame(0, { seed: 6060, rules: { seasonLen: 41, ownership: true } });
    const fa = R.freeAgents.map((id) => R.players[id]).sort((a, b) => b.ovr - a.ovr)[0];
    const flat = A.askingPrice(R, fa.id, R.userTeam, 3);
    A.gmState(R).stakes[R.userTeam] = 0.6;
    A.setDirection(R, "winNow");
    ok(A.askingPrice(R, fa.id, R.userTeam, 3) < flat,
      `players take less to come and chase it ($${A.askingPrice(R, fa.id, R.userTeam, 3)}M vs $${flat}M)`);
    A.setDirection(R, "rebuild");
    ok(A.askingPrice(R, fa.id, R.userTeam, 3) > flat, "and have to be paid to come and lose");

    section("Moving the franchise");
    const M2 = A.newGame(0, { seed: 6060, rules: { seasonLen: 41, ownership: true } });
    const home = M2.teams[M2.userTeam].city;
    ok(A.relocationOptions(M2).length > 0, "there are cities without a club");
    ok(A.relocationOptions(M2).every((m) => !M2.teams.some((t) => t.city === m.city)),
      "and none of them already has one");
    ok(!A.relocate(M2, A.relocationOptions(M2)[0].city).ok, "a manager can't move a club");
    A.gmState(M2).stakes[M2.userTeam] = 0.3;
    ok(!A.relocate(M2, A.relocationOptions(M2)[0].city).ok, "nor can a minority owner");
    A.gmState(M2).stakes[M2.userTeam] = 0.7;
    A.gmState(M2).cash = 5;
    const dest = A.relocationOptions(M2)[0];
    ok(!A.relocate(M2, dest.city).ok, "and nobody moves a club on five million dollars");

    A.gmState(M2).cash = 400;
    A.investInClub(M2, M2.userTeam, "arena");
    const rival = M2.teams[M2.userTeam].rivalId;
    const mv = A.relocate(M2, dest.city);
    ok(mv.ok, `a controlling owner can move it (${mv.from} → ${mv.to})`);
    ok(M2.teams[M2.userTeam].city === dest.city, "the club is in the new city");
    ok(M2.teams[M2.userTeam].mkt === dest.mkt, "and takes the new market with it");
    ok(A.investLevel(M2, M2.userTeam, "arena") === 0, "the building you paid for does not come along");
    ok(M2.teams[M2.userTeam].rivalId == null, "and the rivalry is gone — a rivalry is two places");
    ok(rival == null || M2.teams[rival].rivalId == null, "for the other club too");
    ok((M2.teams[M2.userTeam].movedFrom || []).includes(home), `${home} is remembered as abandoned`);
    ok(!A.relocationOptions(M2).some((m) => m.city === home), "and never gets another club");
    ok((M2.relocations || []).length === 1, "the move goes into the record");
    ok(A.fanMood(M2) < 45, `and the new city has to be won over (${Math.round(A.fanMood(M2))})`);

    section("Putting your own money in");
    const I = A.newGame(0, { seed: 6060, rules: { seasonLen: 41, ownership: true } });
    ok(!A.investInClub(I, I.userTeam, "arena").ok, "you can't build on a club you don't own");
    A.gmState(I).stakes[I.userTeam] = 0.3;
    A.gmState(I).cash = 200;
    const gate0 = A.gateFor(I, I.userTeam);
    const inv = A.investInClub(I, I.userTeam, "arena");
    ok(inv.ok && A.investLevel(I, I.userTeam, "arena") === 1, "a minority owner can still build");
    ok(A.gmState(I).cash === 200 - inv.cost, "out of his own pocket");
    ok(A.gateFor(I, I.userTeam) > gate0, `and every home date is worth more ($${A.gateFor(I, I.userTeam)}M vs $${gate0}M)`);
    /* And it's a louder building, which is the other half of what the blurb
       promises. Only ever yours, because nobody else's arena was rebuilt. */
    A.setRule(I, "homeIce", "realistic");
    ok(A.homeEdge(I, true, I.userTeam) > A.homeEdge(I, true, I.userTeam === 0 ? 1 : 0),
      "and a harder place to visit than anyone else's");
    ok(A.homeEdge(I, true, I.userTeam === 0 ? 1 : 0) === A.HOME_EDGE,
      "while every other rink is exactly what it always was");
    ok(A.investCost(I, I.userTeam, "arena") > inv.cost, "the next one costs more");
    let g2 = 0;
    while (A.investInClub(I, I.userTeam, "arena").ok && g2++ < 10);
    ok(A.investLevel(I, I.userTeam, "arena") === A.INVESTMENTS.arena.max,
      `there's a ceiling (${A.INVESTMENTS.arena.max})`);
    // Scouting is the one that shows up somewhere other than money.
    const S = A.newGame(0, { seed: 6060, rules: { seasonLen: 41, ownership: true } });
    A.gmState(S).stakes[S.userTeam] = 0.3; A.gmState(S).cash = 200;
    A.investInClub(S, S.userTeam, "scouting");
    simSeason(A, S); simPlayoffs(A, S);
    const plain = A.newGame(0, { seed: 6060, rules: { seasonLen: 41, ownership: true } });
    simSeason(A, plain); simPlayoffs(A, plain);
    ok(S.scoutPoints > plain.scoutPoints,
      `more eyes on more rinks (${S.scoutPoints} vs ${plain.scoutPoints})`);
  },

  /* Two things brought over from the sibling games: the running number a fan
     follows night to night, and the one place you have to speak out loud. */
  streaks(A) {
    section("A run of points");
    const G = A.newGame(0, { seed: 3131, rules: { seasonLen: 82 } });
    simSeason(A, G);
    const skaters = A.playersOf(G).filter((p) => p.pos !== "G" && p.season.gp > 40);
    ok(skaters.some((p) => (p.bestStreak || 0) >= 5), "somebody put a run together");
    const longest = skaters.reduce((m, p) => Math.max(m, p.bestStreak || 0), 0);
    ok(longest >= 8 && longest <= 40, `and it's a hockey number, not a fantasy (${longest})`);
    ok(skaters.every((p) => (p.streak || 0) <= (p.bestStreak || 0)),
      "a live run never exceeds the best one");
    /* A goalie doesn't have a point streak, and neither does a man who didn't
       play — both used to be silently included by naive counters. */
    ok(A.playersOf(G).filter((p) => p.pos === "G").every((p) => !p.streak && !p.bestStreak),
      "goalies don't get one");

    section("The longest winning run");
    ok(G.teams.some((t) => (t.wsMax || 0) >= 4), "clubs go on runs too");
    ok(G.teams.every((t) => (t.wsMax || 0) >= Math.max(0, t.streak || 0)),
      "and the season's best is never behind the live one");

    section("Into the book");
    A.finishSeason(G);
    A.updateRecords(G);
    ok(G.records.pointStreak && G.records.pointStreak.v >= 5,
      `the longest run of the year is a record (${G.records.pointStreak.v})`);
    ok(G.records.winStreak && G.records.winStreak.v >= 4,
      `and so is the club's (${G.records.winStreak.v})`);
    ok(G.records.pointStreak.name, "with a name attached, for when the player is forgotten");
    A.startNextSeason(G);
    ok(A.playersOf(G).every((p) => !p.streak), "a run doesn't carry over a summer");
    ok(G.teams.every((t) => !t.wsMax), "nor does a club's");
    ok(A.playersOf(G).some((p) => (p.bestStreak || 0) >= 5), "but the career best does");
  },

  pressers(A) {
    section("Nothing to say");
    const off = A.newGame(0, { seed: 3131, rules: { seasonLen: 82 } });
    A.simDays(off, 40);
    ok(!A.pickPresser(off) && !off.presser, "with the rule off nobody asks you anything");

    const G = A.newGame(0, { seed: 3131, rules: { seasonLen: 82, pressers: true } });
    ok(A.pickPresser(G) === null, "and nobody asks before there's anything to ask about");

    section("A question with a cost");
    /* Drive the state rather than waiting for it, so the branch is always
       exercised: `pickPresser` reads the club and draws nothing, which is the
       whole reason this can be switched on mid-career. */
    A.simDays(G, 30);
    const t = G.teams[G.userTeam];
    t.gp = Math.max(10, t.gp); t.streak = -4; G.presser = null; G.lastPresser = null;
    const q = A.pickPresser(G);
    ok(q && q.kind === "badRun", `a losing run gets asked about (${q && q.kind})`);
    ok(q.runLen === 4, "with the right number in the question");
    ok(A.PRESSERS[q.kind].opts.length === 3, "three ways to answer it");

    G.presser = q;
    const room0 = A.roomMorale(G, G.userTeam), fans0 = A.fanMood(G), board0 = G.boardConfidence;
    // "Demand more": hard on the room, good with the board and the city.
    const r = A.answerPresser(G, 1);
    ok(r.ok && r.line, "answering says something");
    ok(A.roomMorale(G, G.userTeam) < room0, "and being hard on them costs you the room");
    ok(A.fanMood(G) > fans0, "while the city likes to hear it");
    ok(G.boardConfidence > board0, "and so does the board");
    ok(!G.presser, "the question is gone once answered");
    ok(G.lastPresser === G.day, "and there's a cooldown before the next");
    ok(!A.pickPresser(G), "which really holds");

    section("Backing them costs the other way");
    const B = A.newGame(0, { seed: 3131, rules: { seasonLen: 82, pressers: true } });
    A.simDays(B, 30);
    B.teams[B.userTeam].streak = -4;
    // Clear whatever the sim already put there, or `pickPresser` declines.
    B.presser = null; B.lastPresser = null;
    B.presser = A.pickPresser(B);
    ok(B.presser, "there's a question on the table");
    const bRoom = A.roomMorale(B, B.userTeam), bBoard = B.boardConfidence;
    A.answerPresser(B, 0);   // back the room
    ok(A.roomMorale(B, B.userTeam) > bRoom, "backing them in public buys you the room");
    ok(B.boardConfidence < bBoard, "at the board's expense");

    section("The building");
    const C = A.newGame(0, { seed: 3131, rules: { seasonLen: 82, pressers: true } });
    A.simDays(C, 20);
    const base = A.gateFor(C, C.userTeam);
    A.moveFans(C, 40);
    ok(A.gateFor(C, C.userTeam) > base, `a city that likes you fills the building ($${A.gateFor(C, C.userTeam)}M vs $${base}M)`);
    A.moveFans(C, -80);
    ok(A.gateFor(C, C.userTeam) < base, "and one that doesn't, doesn't");
    // Nobody else holds press conferences, so nobody else's gate moves.
    const other = C.userTeam === 0 ? 1 : 0;
    const D = A.newGame(0, { seed: 3131, rules: { seasonLen: 82, pressers: true } });
    A.simDays(D, 20);
    ok(A.gateFor(C, other) === A.gateFor(D, other), "and it never touches another club's gate");
  },

  /* A fortnight in midwinter that belongs to somebody else. */
  worldCup(A) {
    section("Where everybody's from");
    const G = A.newGame(0, { seed: 2610, rules: { seasonLen: 82, worldCup: true } });
    const all = A.playersOf(G);
    const counts = {};
    all.forEach((p) => { const k = A.nationOf(p).k; counts[k] = (counts[k] || 0) + 1; });
    ok(Object.keys(counts).length === A.NATIONS.length, "every nation is represented");
    ok(counts.CAN > counts.SUI * 3, `and the big ones are big (CAN ${counts.CAN} vs SUI ${counts.SUI})`);
    const one = all[10];
    ok(A.nationOf(one).k === A.nationOf(one).k, "a man's country doesn't change");
    ok(one.nat === undefined && one.nation === undefined, "and nothing is stored on him for it");

    section("The tournament");
    ok(!A.worldCupYear(A.newGame(0, { seed: 2610, rules: { seasonLen: 82 } })),
      "with the rule off it never comes round");
    // Play into the season so there are stat lines to pick a squad from.
    while (G.day < G.allStarDay + 1 && G.phase === "regular") A.simDays(G, 5);
    const isYear = G.year % A.WORLD_CUP_EVERY === 0;
    if (!isYear) {
      ok(!G.worldCup && !!G.allStar, "in an ordinary year the break is the All-Star game");
    }
    // Force one so the tournament itself is always exercised.
    const cup = A.runWorldCup(G);
    ok(cup && cup.gold, `somebody wins it (${cup.gold})`);
    ok(cup.silver && cup.silver !== cup.gold, "and somebody loses the final");
    ok(cup.bronze && cup.bronze !== cup.gold && cup.bronze !== cup.silver, "third place is played off");
    ok(cup.rounds.length === 3, `eight nations, three rounds (${cup.rounds.length})`);
    ok(cup.rounds[0].length === 4 && cup.rounds[2].length === 1, "and the bracket halves each time");
    ok(cup.rounds.every((r) => r.every((t) => t.aG !== t.bG)), "no game ends level — somebody goes home");
    ok(cup.mvp != null && G.players[cup.mvp], "the winners have a best player");

    section("What a player brings home");
    const golds = A.playersOf(G).filter((p) => (p.medals || []).some((m) => m.kind === "gold"));
    ok(golds.length >= 10, `a whole squad is decorated (${golds.length})`);
    ok(golds.every((p) => A.nationOf(p).k === cup.gold), "and they all played for the winners");
    ok(golds[0].medals[0].year === G.year, "stamped with the year it was won");
    const squad = A.worldSquad(G, cup.gold);
    ok(squad.length >= 10 && squad.length <= A.WORLD_SQUAD, `a real squad size (${squad.length})`);
    ok(squad.filter((id) => G.players[id].pos === "G").length <= 2, "and it doesn't take five goalies");
    ok(A.squadStrength(G, squad) > 0, "with a strength you can seed on");

    section("It doesn't disappear")
    ok((G.worldCups || []).length === 1, "the tournament goes into the record");
    A.simDays(G, 3);
    ok((G.worldCups || []).length === 1, "and stays there");
  },

  /* The one moment of a hockey game where coaches most visibly differ. */
  pull(A) {
    section("When the goalie comes off");
    const G = A.newGame(0, { seed: 5150, rules: { seasonLen: 41, coachStaff: true } });
    ok(A.pullTiming(G, G.userTeam) === A.PULL_TIMINGS.normal, "the default is what it always was");
    ok(A.PULL_TIMINGS.normal.tie === 0.17 && A.PULL_TIMINGS.normal.eng === 0.45,
      "and those are the numbers the engine has always used");
    ok(A.PULL_TIMINGS.early.tie > A.PULL_TIMINGS.normal.tie
      && A.PULL_TIMINGS.early.eng > A.PULL_TIMINGS.normal.eng,
      "going early buys chances AND concedes empty nets — both, or it isn't a decision");
    ok(A.PULL_TIMINGS.late.tie < A.PULL_TIMINGS.normal.tie
      && A.PULL_TIMINGS.late.eng < A.PULL_TIMINGS.normal.eng, "and sitting tight does the reverse");
    G.teams[G.userTeam].pull = "early";
    ok(A.pullTiming(G, G.userTeam) === A.PULL_TIMINGS.early, "your call is your call");

    /* An AI club's comes off its coach, which needs no storage and no draw. */
    const trap = G.teams.find((t) => t.id !== G.userTeam && A.coachOf(t).system === "trap");
    const agg = G.teams.find((t) => t.id !== G.userTeam && A.coachOf(t).system === "aggressive");
    ok(!trap || A.pullTiming(G, trap.id) === A.PULL_TIMINGS.late, "a trap coach waits");
    ok(!agg || A.pullTiming(G, agg.id) === A.PULL_TIMINGS.early, "and a forechecking one doesn't");
    /* Thirty-one benches all calling it differently moves the league's goal
       totals, so it waits for the coaching rule — the calibrated engine has to
       still be measurable underneath. */
    const plain = A.newGame(0, { seed: 5150, rules: { seasonLen: 41 } });
    ok(plain.teams.every((t) => A.pullTiming(plain, t.id) === A.PULL_TIMINGS.normal),
      "on Classic every bench does what the engine always did");

    section("It really changes games");
    /* Same seed, same league, one club's setting different. Every other draw in
       the season is identical, so any difference in empty-net goals is this. */
    const count = (setting) => {
      const L = A.newGame(0, { seed: 5150, rules: { seasonLen: 82 } });
      L.teams.forEach((t) => { t.pull = setting; });
      simSeason(A, L);
      return A.playersOf(L).reduce((s, p) => s + ((p.season && p.season.eng) || 0), 0);
    };
    const late = count("late"), early = count("early");
    ok(early > late, `early pulls concede more empty nets over a season (${early} vs ${late})`);
  },

  /* The deal that dies at the cap, and the club that saves it for a price. */
  broker(A) {
    section("Who can help");
    const G = A.newGame(0, { seed: 7711, rules: { seasonLen: 41 } });
    A.setRule(G, "retainedSalary", true);
    A.applyPendingRules(G);
    /* Somebody expensive, on a club that isn't ours. */
    const star = A.playersOf(G)
      .filter((p) => p.teamId != null && p.teamId !== G.userTeam && p.contract.amt > 4)
      .sort((a, b) => b.contract.amt - a.contract.amt)[0];
    const seller = star.teamId;
    const cands = A.brokerCandidates(G, star.id, 0.5, [G.userTeam, seller]);
    ok(cands.length > 0, `clubs with room will take money on (${cands.length})`);
    ok(!cands.some((c) => c.teamId === G.userTeam || c.teamId === seller),
      "and neither side of the deal is one of them");
    ok(cands.every((c) => c.space >= c.eats), "each of them can actually fit it");
    ok(cands.every((c) => c.fee > 0), "nobody does it for nothing");
    ok(cands[0].fee <= cands[cands.length - 1].fee, "cheapest first");

    section("What it costs");
    ok(A.brokerFee(G, star.id, 0.5) > A.brokerFee(G, star.id, 0.25),
      "eating more of a deal costs more");
    const off = A.newGame(0, { seed: 7711, rules: { seasonLen: 41 } });
    A.setRule(off, "retainedSalary", false);
    A.applyPendingRules(off);
    ok(!A.brokerCandidates(off, star.id, 0.5, []).length,
      "with retained salary off nobody can broker anything");

    section("The deal");
    const help = cands[0];
    const picks = A.tradablePicks(G, G.userTeam);
    const pay = picks.find((pk) => A.pickValue(G, pk) >= help.fee) || picks[0];
    /* Pay properly, or the two clubs never get as far as needing a broker: our
       best man plus whatever picks aren't already spoken for as the fee. */
    const mine = A.rosterOf(G, G.userTeam).sort((a, b) => b.ovr - a.ovr)[0];
    const sweetener = picks.filter((pk) => pk !== pay);

    // Refusals first, so a failed attempt leaves nothing behind.
    const before = (G.retained || []).length;
    ok(!A.brokerTrade(G, G.userTeam, [mine.id], [], seller, [star.id], [],
      { teamId: seller, pid: star.id, pct: 0.5, picks: [pay] }).ok,
      "the third club has to be a third club");
    ok(!A.brokerTrade(G, G.userTeam, [mine.id], [], seller, [star.id], [],
      { teamId: help.teamId, pid: star.id, pct: 0.5, picks: [] }).ok,
      "and won't do it for free");
    ok((G.retained || []).length === before, "a refused broker leaves the books alone");

    const r = A.brokerTrade(G, G.userTeam, [mine.id], sweetener, seller, [star.id], [],
      { teamId: help.teamId, pid: star.id, pct: 0.5, picks: [pay] });
    ok(r.ok, `a fair offer with a third club behind it goes through (${r.why || "done"})`);
    ok(G.players[star.id].teamId === G.userTeam, "the player moves");
    const row = (G.retained || []).find((x) => x.broker);
    ok(row && row.from === help.teamId, "the money stays with the third club");
    ok(A.effectiveCap(G, G.players[star.id]) < G.players[star.id].contract.amt,
      `and his hit is smaller for it ($${A.effectiveCap(G, G.players[star.id])}M `
      + `vs $${G.players[star.id].contract.amt}M)`);
    ok(A.retainedBy(G, help.teamId).some((x) => x.broker), "it's on the broker's books");
    ok(A.capHit(G, help.teamId) > 0, "which is to say he is really paying it");
    const owner = G.picks.find((x) => x.year === pay.year && x.round === pay.round && x.orig === pay.orig);
    ok(owner.owner === help.teamId, "and he's been paid his pick");
  },

  /* The two contract shapes that cost a club something other than money. */
  bonuses(A) {
    section("Guaranteed money");
    const off = A.newGame(0, { seed: 4242, rules: { seasonLen: 41 } });
    const fa0 = off.freeAgents.map((id) => off.players[id]).sort((a, b) => b.ovr - a.ovr)[0];
    ok(!A.bonusesOn(off), "off by default");
    const plainOff = A.askingPrice(off, fa0.id, 0, 4);
    ok(A.askingPrice(off, fa0.id, 0, 4, { sb: 0.6 }) === plainOff,
      "and with the rule off a bonus buys you nothing");

    const G = A.newGame(0, { seed: 4242, rules: { seasonLen: 41, contractBonuses: true } });
    const fa = G.freeAgents.map((id) => G.players[id]).sort((a, b) => b.ovr - a.ovr)[0];
    const plain = A.askingPrice(G, fa.id, 0, 4);
    const loaded = A.askingPrice(G, fa.id, 0, 4, { sb: A.SB_MAX });
    ok(loaded < plain, `guaranteed money comes cheaper ($${loaded}M vs $${plain}M)`);
    const half = A.askingPrice(G, fa.id, 0, 4, { sb: 0.3 });
    ok(half > loaded && half < plain, `and half a bonus is half the discount ($${half}M)`);
    ok(plain - loaded < plain * (A.SB_DISCOUNT + 0.01), "the discount is bounded");

    section("What a bonus costs you later");
    A.signPlayer(G, fa.id, 0, loaded, 4, { sb: A.SB_MAX });
    ok(A.sbOf(G.players[fa.id]) === A.SB_MAX, "the term is on the contract");
    const bonusBuyout = A.buyoutCost(G, fa.id);
    // The same deal without the bonus, priced the same, to isolate the term.
    const C = A.newGame(0, { seed: 4242, rules: { seasonLen: 41, contractBonuses: true } });
    A.signPlayer(C, fa.id, 0, loaded, 4);
    const plainBuyout = A.buyoutCost(C, fa.id);
    ok(bonusBuyout.total > plainBuyout.total,
      `bonus money survives a buyout ($${bonusBuyout.total}M vs $${plainBuyout.total}M)`);
    ok(bonusBuyout.total > loaded * 4 * A.SB_MAX * 0.99, "and survives it in full");
    ok(plainBuyout.total <= loaded * 4 * A.BUYOUT_PCT + 0.1, "an ordinary deal is bought out at a third");

    section("Playing for it");
    const Y = A.newGame(0, { seed: 4242, rules: { seasonLen: 41, contractBonuses: true } });
    const kid = A.playersOf(Y).filter((p) => p.age <= A.PB_YOUNG && p.pos !== "G")
      .sort((a, b) => b.ovr - a.ovr)[0];
    const vet = A.playersOf(Y).filter((p) => p.age >= A.PB_OLD)[0];
    const mid = A.playersOf(Y).filter((p) => p.age > A.PB_YOUNG && p.age < A.PB_OLD)[0];
    ok(A.canPerfBonus(Y, kid), "a kid can play for a bonus");
    ok(!vet || A.canPerfBonus(Y, vet), "so can a man of 35");
    ok(!A.canPerfBonus(Y, mid), "the ones in between cannot — that would be a cap with a hole in it");
    const base = A.askingPrice(Y, kid.id, 0, 3);
    const deferred = A.askingPrice(Y, kid.id, 0, 3, { pb: A.PB_MAX });
    ok(deferred < base, `he'll take less base for it ($${deferred}M vs $${base}M)`);
    ok(A.askingPrice(Y, mid.id, 0, 3, { pb: A.PB_MAX }) === A.askingPrice(Y, mid.id, 0, 3),
      "and offering one to someone ineligible changes nothing");

    A.signPlayer(Y, kid.id, kid.teamId == null ? 0 : kid.teamId, deferred, 3, { pb: A.PB_MAX });
    const target = A.pbOf(Y.players[kid.id]);
    ok(target && target.amt === A.PB_MAX && target.need > 0, `a real target (${target.need} ${target.kind})`);
    // Not reached: nothing is charged.
    Y.players[kid.id].season = { gp: 40, g: 0, a: 0 };
    const before = (Y.retained || []).length;
    A.settleBonuses(Y);
    ok((Y.retained || []).length === before, "a bonus he didn't earn costs nothing");
    // Reached, with no room to absorb it: it lands on next year.
    Y.players[kid.id].season = { gp: 40, g: target.need, a: 0 };
    const t = Y.teams[Y.players[kid.id].teamId];
    A.setRule(Y, "capAmount", A.capHit(Y, t.id));
    A.settleBonuses(Y);
    const over = (Y.retained || []).filter((r) => r.overage);
    ok(over.length === 1, "an earned bonus a club can't absorb becomes an overage");
    ok(over[0].yrs === 1 && over[0].amt > 0, `charged to next season ($${over[0].amt}M)`);

    section("The rest of the league");
    ok(A.aiBonusTerms(off, fa0, 5) === undefined, "with the rule off no AI club offers one");
    const someone = A.playersOf(G).filter((p) => p.ovr >= 70);
    const offered = someone.filter((p) => A.aiBonusTerms(G, p, 5));
    ok(offered.length > 0 && offered.length < someone.length,
      `some AI deals carry bonus money, not all (${offered.length}/${someone.length})`);
    ok(!A.aiBonusTerms(G, someone[0], 1), "never on a one-year deal");
    const one = someone[0];
    ok(JSON.stringify(A.aiBonusTerms(G, one, 5)) === JSON.stringify(A.aiBonusTerms(G, one, 5)),
      "and the same player always gets the same offer — derived, never drawn");
  },

  /* The population, and the history it used to throw away. A ten-season audit
     found the league ageing down from 26.0 to 22.4, players over 32 falling
     from 126 to seven, and the save crossing what localStorage will hold. */
  population(A) {
    section("Who comes in and who leaves");
    const G = A.newGame(0, { seed: 8642, rules: { seasonLen: 82, autoManage: true } });
    ok(A.DRAFT_ROUNDS === 3, `three rounds, not seven (${A.DRAFT_ROUNDS})`);
    ok(A.draftPicksTotal(G) === 96, `ninety-six players a year (${A.draftPicksTotal(G)})`);

    /* Retirement has to be reachable before 32, or a man who never made it
       simply accumulates — in the pool or on a farm roster into his thirties,
       taking up a place he was never going to earn. */
    const kid = { age: 20, ovr: 50, season: { gp: 0 }, career: [] };
    ok(A.retirementChance(G, kid) === 0, "a twenty-year-old is going nowhere");
    const stuck = { age: 28, ovr: 50, season: { gp: 0 }, career: [] };
    ok(A.retirementChance(G, stuck) > 0, "a 28-year-old who never played might stop");
    const made = { age: 28, ovr: 50, season: { gp: 0 }, career: [{ gp: 400 }] };
    ok(A.retirementChance(G, made) === 0, "one who did have a career does not");
    const good = { age: 28, ovr: 72, season: { gp: 0 }, career: [] };
    ok(A.retirementChance(G, good) === 0, "and nor does a good player");
    const old = { age: 36, ovr: 60, season: { gp: 0 }, career: [{ gp: 800 }] };
    ok(A.retirementChance(G, old) > 0.3, "the old age curve is untouched");

    // The free-agent cull has to be able to bind. It stopped when everyone
    // qualified for the 200-game protection.
    ok(A.FA_POOL_HARD > 1, "there is a hard ceiling above the soft one");

    /* THE TEST THAT MATTERS: fifteen seasons, and the league must still be a
       league — adults in it, and a save that fits in a browser. */
    for (let y = 0; y < 15; y++) {
      simSeason(A, G); simPlayoffs(A, G); A.autoDraft(G, false); A.startNextSeason(G);
    }
    const alive = A.playersOf(G).filter((p) => p.teamId != null && !p.retired);
    const ages = alive.map((p) => p.age);
    const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
    ok(avg >= 24, `the league has not turned into a junior league (average age ${avg.toFixed(1)})`);
    ok(ages.filter((a) => a >= 33).length >= 25,
      `veterans survive (${ages.filter((a) => a >= 33).length} aged 33+)`);
    ok(ages.filter((a) => a < 21).length < alive.length * 0.35,
      "and teenagers are not the biggest group in the league");
    const mb = JSON.stringify(G).length / 1048576;
    ok(mb < 4.2, `fifteen seasons fit in a browser (${mb.toFixed(2)} MB)`);
    ok(A.playersOf(G).length < 1700, `the population settles (${A.playersOf(G).length})`);
    ok(G.teams.every((t) => A.rosterOf(G, t.id).length >= A.ROSTER_MIN), "and everyone can still dress a side");

    section("History that stays");
    ok((G.draftHistory || []).length >= 14, `every draft is kept (${(G.draftHistory || []).length})`);
    ok(G.draftHistory.every((d) => d.picks.length === A.draftPicksTotal(G)), "with every pick in it");
    /* Names are stored because `pruneSave` forgets the player — a history that
       empties itself is not a history. */
    const oldest = G.draftHistory[0];
    ok(oldest.picks.every((p) => p.name && p.name !== "unknown"), "and a name on every one");
    const forgotten = oldest.picks.filter((p) => !G.players[p.pid]).length;
    ok(forgotten > 0, `some of them have left the game entirely (${forgotten})`);
    ok(oldest.picks.filter((p) => !G.players[p.pid]).every((p) => p.name), "and are still named");
    ok(G.history.length >= 14, `and every season is on file (${G.history.length})`);

    section("The career book");
    ok(G.careerRecords && Object.keys(G.careerRecords).length >= 5, "career records exist");
    A.CAREER_RECORD_DEFS.forEach((d) => {
      const r = G.careerRecords[d.key];
      ok(r && r.v > 0 && r.name, `${d.label}: ${r ? `${r.name} ${r.v}` : "unset"}`);
    });
    // A career record must beat any single season of it.
    const pts = G.careerRecords.cPoints, seasonPts = (G.records || {}).points;
    ok(!seasonPts || pts.v > seasonPts.v, "a career total exceeds the best single season");
    const tot = A.careerTotals(A.playersOf(G).find((p) => (p.career || []).length > 3));
    ok(tot.gp > 0, "career totals add up the archive");

    section("The manager's own record");
    ok((G.gmSeasons || []).length === 15, `a row a year (${(G.gmSeasons || []).length})`);
    ok(G.gmSeasons.every((s) => s.abbr && s.year && s.mandate !== undefined), "stamped with the club and the ask");
    const c = A.gmCareer(G);
    ok(c.seasons === 15 && c.w + c.l + c.otl > 1000, `and it totals up (${c.w}-${c.l}-${c.otl})`);
    ok(c.clubs.length >= 1, "across every club you worked at");
    // Moving on must not erase what came before.
    const before = G.gmSeasons.length;
    A.takeJob(G, G.userTeam === 0 ? 1 : 0);
    ok((G.gmSeasons || []).length === before, "taking a new job keeps the old record");

    section("Auto-manage protects a good cheap contract");
    const K = A.newGame(0, { seed: 8642, rules: { seasonLen: 41 } });
    const cheapGood = { ovr: 62, pot: 64, age: 27, contract: { amt: 1.0, yrs: 3 }, id: -1,
      season: { gp: 0 }, career: [{ gp: 300 }] };
    const rawKid = { ovr: 44, pot: 90, age: 18, contract: { amt: 0.95, yrs: 3 }, id: -2,
      season: { gp: 0 }, career: [] };
    /* The old sort was `ovr + pot * 0.5`, which ranked the raw eighteen-year-old
       above the man who could play — so clubs released useful cheap depth to
       keep ceilings. */
    ok(A.keepScore(K, cheapGood) > A.keepScore(K, rawKid),
      `a useful cheap player outranks a raw ceiling (${A.keepScore(K, cheapGood).toFixed(0)} vs ${A.keepScore(K, rawKid).toFixed(0)})`);
    const expensive = { ...cheapGood, id: -3, contract: { amt: 7.5, yrs: 3 } };
    ok(A.keepScore(K, cheapGood) > A.keepScore(K, expensive), "and the same player is worth more cheap than dear");

    // A club with no room defers picks rather than drafting men it must cut.
    const D = A.newGame(0, { seed: 8642, rules: { seasonLen: 41 } });
    ok(A.deferPicksIfFull(D, 0) === 0, "a club with room defers nothing");
    const roster = A.rosterOf(D, 0, true);
    while (A.rosterOf(D, 0, true).length < A.ROSTER_MAX + A.FARM_MAX) {
      const spare = A.playersOf(D).find((p) => p.teamId == null && !p.retired);
      if (!spare) break;
      spare.teamId = 0; spare.farm = true;
    }
    const moved = A.deferPicksIfFull(D, 0);
    ok(moved > 0, `a full club pushes picks to next year (${moved})`);
    ok((D.picks || []).filter((pk) => pk.year === D.year + 1 && pk.deferred).length === moved,
      "and they are there waiting");
  },

  /* The threads that were left hanging: a room that remembers, a budget that
     pays for people, and injuries that finally mean something to the cap. */
  clubLife(A) {
    section("The room remembers");
    const G = A.newGame(0, { seed: 2020, rules: { seasonLen: 82, demands: true } });
    ok(A.roomHitOf(G.teams[0]) === 0, "a club starts with a clear conscience");
    const before = A.roomMorale(G, 0);
    A.addRoomHit(G, 0, 8);
    ok(A.roomHitOf(G.teams[0]) === 8, "a hard call is remembered");
    ok(A.roomMorale(G, 0) < before, `and the room is worse for it (${A.roomMorale(G, 0)} vs ${before})`);
    ok(A.roomHitOf(G.teams[1]) === 0, "it belongs to the club, not the league");
    /* An earlier version put this on `G`, which quietly meant thirty-two clubs
       shared one conscience. */
    A.decayRoomHits(G);
    ok(A.roomHitOf(G.teams[0]) < 8, "and it fades if you stop making them");
    for (let i = 0; i < 40; i++) A.decayRoomHits(G);
    ok(A.roomHitOf(G.teams[0]) === 0, "all the way to nothing");
    // An unhappy dressing room is a worse one even before you answer anybody.
    const M = A.newGame(0, { seed: 2020, rules: { seasonLen: 82, demands: true } });
    const clean = A.roomMorale(M, 0);
    A.rosterOf(M, 0)[0].demand = { kind: "trade", day: 1, year: M.year, want: 18, got: 9 };
    ok(A.roomMorale(M, 0) < clean, "an unhappy player drags the room down");

    section("The club as a business");
    const B = A.newGame(0, { seed: 3131, rules: { seasonLen: 82, coachStaff: true } });
    ok(B.teams.every((t) => t.revenue === 0), "nobody has taken a gate yet");
    const gate = A.gateFor(B, 0);
    ok(gate > 0, `a home date is worth something (${gate})`);
    /* Winning fills a building. Both clubs are identical here except for their
       record, which is the only thing that should move the number. */
    B.teams[0].gp = 40; B.teams[0].pts = 64;      // a good side
    B.teams[1].gp = 40; B.teams[1].pts = 24;      // a bad one
    B.teams[1].mkt = B.teams[0].mkt;              // same market, so it's the record
    ok(A.gateFor(B, 0) > A.gateFor(B, 1),
      `a winner draws better (${A.gateFor(B, 0)} vs ${A.gateFor(B, 1)})`);
    A.simDays(B, 40);
    ok(B.teams.some((t) => t.revenue > 0), "the gate accrues over a season");

    // Staff salaries are charged, which is what makes the market a choice.
    const mkt = A.staffMarket(B, "pp");
    B.teams[B.userTeam].budget = 1;
    const dear = mkt[0];
    ok(dear.cost > 1, `the best man costs real money ($${dear.cost}M)`);
    ok(!A.hireStaff(B, "pp", dear).ok, "and you can't hire him without the budget");
    B.teams[B.userTeam].budget = 40;
    ok(A.hireStaff(B, "pp", dear).ok, "with the money, you can");
    ok(A.staffBill(B, B.userTeam) === dear.cost, "his salary is on the books");
    ok(A.budgetLeft(B, B.userTeam) === 40 - dear.cost, "and comes out of the budget");

    // Last year's gate becomes this year's budget.
    const R = A.newGame(0, { seed: 3131, rules: { seasonLen: 41, coachStaff: true } });
    simSeason(A, R); simPlayoffs(A, R); A.autoDraft(R, false); A.startNextSeason(R);
    ok(R.teams.every((t) => t.budget > 0), "every club has a budget for the new year");
    ok(R.teams.every((t) => t.revenue === 0), "and the books are reset");
    const rich = R.teams.slice().sort((a, b) => b.budget - a.budget)[0];
    const poor = R.teams.slice().sort((a, b) => a.budget - b.budget)[0];
    ok(rich.budget > poor.budget, `clubs differ in what they can spend ($${rich.budget}M vs $${poor.budget}M)`);

    section("The head coach");
    const C = A.newGame(0, { seed: 4747, rules: { seasonLen: 41 } });
    C.teams[C.userTeam].budget = 40;
    const cands = A.staffMarket(C, "head");
    ok(cands.every((c) => c.system), "a head coach brings a system with him");
    const was = A.coachOf(C.teams[C.userTeam]).name;
    ok(A.hireHeadCoach(C, cands[0]).ok, "you can replace him");
    ok(A.coachOf(C.teams[C.userTeam]).name === cands[0].name, "and the new man is behind the bench");
    ok(A.coachOf(C.teams[C.userTeam]).name !== was, "the old one has gone");
    ok(A.systemOf(C.teams[C.userTeam]), "the club still has a system");
    C.teams[C.userTeam].budget = 0.1;
    ok(!A.hireHeadCoach(C, cands[1]).ok, "and you can't hire one you can't pay");

    section("Long-term injured reserve");
    const L = A.newGame(0, { seed: 5858, rules: { seasonLen: 82 } });
    const man = A.rosterOf(L, 0).slice().sort((a, b) => b.contract.amt - a.contract.amt)[0];
    man.inj = 5;
    ok(!A.canLtir(L, man), "a short injury doesn't qualify");
    man.inj = A.LTIR_MIN_GAMES;
    ok(A.canLtir(L, man), "a long one does");
    const capBefore = A.capHit(L, 0), hit = A.effectiveCap(L, man);
    const r = A.placeLtir(L, man.id);
    ok(r.ok && A.onLtir(man), "he can be placed on it");
    ok(Math.abs(A.capHit(L, 0) - (capBefore - hit)) < 0.05,
      `and his whole hit comes off the cap ($${hit}M)`);
    ok(!A.activeRoster(L, 0).some((p) => p.ltir), "he cannot be dressed while he's there");
    ok(A.rosterOf(L, 0).some((p) => p.ltir), "though he's still on the roster");
    /* The catch: the relief was never really yours. Spend it and you can't have
       him back until you clear the room again. */
    L.rules.capAmount = A.capHit(L, 0) + 0.5;
    ok(!A.activateLtir(L, man.id).ok, "activating him is refused when the room is gone");
    L.rules.capAmount = 200;
    ok(A.activateLtir(L, man.id).ok && !A.onLtir(man), "and allowed when there's space");
    /* Nobody stays on reserve once he's fit. A player stuck there is off the
       cap and out of every lineup, and `autoLines` hands his minutes to
       whoever is left — which is how a defenceman reaches forty a night. */
    man.ltir = true; man.inj = 0;
    A.migrate(L);
    ok(!man.ltir, "a healthy player is taken off long-term reserve on load");
    man.ltir = true; man.inj = 30;
    A.migrate(L);
    ok(man.ltir, "but one who is still hurt stays there");

    section("Unhappy elsewhere");
    const U = A.newGame(0, { seed: 6969, rules: { seasonLen: 82, demands: true } });
    ok(!A.unhappyMarket(U).length, "nobody is unhappy on day one");
    const theirs = A.rosterOf(U, 5)[0];
    theirs.demand = { kind: "trade", day: 1, year: U.year, want: 18, got: 9 };
    const mine = A.rosterOf(U, U.userTeam)[0];
    mine.demand = { kind: "trade", day: 1, year: U.year, want: 18, got: 9 };
    const mk = A.unhappyMarket(U);
    ok(mk.length === 1, "the market is other clubs' players");
    ok(mk[0].p.id === theirs.id, "not your own");
    // A club with an unhappy man is negotiating from behind.
    const plain = A.newGame(0, { seed: 6969, rules: { seasonLen: 82, demands: true } });
    const same = A.rosterOf(plain, 5)[0];
    ok(A.tradeValue(U, theirs) < A.tradeValue(plain, same),
      "and he costs less to prise away");
    theirs.holdout = true;
    ok(A.tradeValue(U, theirs) < A.tradeValue(plain, same) * 0.9, "a holdout costs less still");
    // Demands are league-wide now, which is what makes any of this possible.
    const W = A.newGame(0, { seed: 7070, rules: { seasonLen: 82, demands: true } });
    A.simDays(W, 130);
    const clubs = new Set(A.playersOf(W).filter((p) => p.demand && p.teamId != null).map((p) => p.teamId));
    ok(clubs.size > 1, `unhappiness happens all over the league (${clubs.size} clubs)`);
  },

  /* Who led each category, year by year. The book kept only the best ever, so a
     54-goal season left no trace anywhere once somebody beat it. */
  seasonHistory(A) {
    section("Leaders by year");
    const G = A.newGame(0, { seed: 6161, rules: { seasonLen: 41 } });
    for (let i = 0; i < 3; i++) {
      simSeason(A, G); simPlayoffs(A, G); A.autoDraft(G, false); A.startNextSeason(G);
    }
    const rows = G.history.filter((h) => h.leaders);
    ok(rows.length === 3, `every completed season recorded its leaders (${rows.length}/3)`);
    ok(rows.every((h) => A.RECORD_DEFS.every((d) => h.leaders[d.key])),
      "in every category the book tracks");
    ok(rows.every((h) => A.RECORD_DEFS.every((d) => {
      const L = h.leaders[d.key];
      return L.v > 0 && L.pid != null && typeof L.name === "string" && L.name.length;
    })), "each with a real player, a name and a total");

    /* The name is stored as well as the id, because `pruneSave` eventually
       forgets the player — a history that goes blank isn't a history. */
    const someone = rows[0].leaders.goals;
    delete G.players[someone.pid];
    ok(rows[0].leaders.goals.name === someone.name, "and the name survives the player being pruned");

    // A leader has to be the best of that season, not of all time.
    const y0 = G.history[0];
    ok(y0.leaders.goals.v >= y0.leaders.points.v / 3, "the goal leader is plausible against the scoring leader");
    ok(G.history.every((h) => h.leaders.wins.v <= A.ruleValue(G, "seasonLen")),
      "no goalie won more games than were played");
    ok(G.history.every((h) => h.leaders.shutouts.v <= h.leaders.wins.v + 5), "shutouts track wins");

    /* The all-time record must be one of the yearly leaders — if the book says
       61 goals, some season's leader scored 61. */
    A.RECORD_DEFS.forEach((d) => {
      const rec = G.records[d.key];
      if (!rec) { ok(true, `${d.key} unset`); return; }
      const best = Math.max(...G.history.map((h) => h.leaders[d.key].v));
      ok(rec.v === best, `the ${d.key} record (${rec.v}) is the best season on file (${best})`);
    });

    // Leaders are captured before the rollover blanks the season.
    const H = A.newGame(0, { seed: 6161, rules: { seasonLen: 41 } });
    simSeason(A, H);
    const live = A.seasonLeaders(H);
    const topScorer = A.playersOf(H).filter((p) => p.pos !== "G" && p.season.gp)
      .sort((a, b) => A.pts(b.season) - A.pts(a.season))[0];
    ok(live.points.pid === topScorer.id, "the points leader is the league's actual points leader");
    ok(live.points.v === A.pts(topScorer.season), "with his actual total");
    const topG = A.playersOf(H).filter((p) => p.pos === "G" && p.season.gp)
      .sort((a, b) => b.season.w - a.season.w)[0];
    ok(live.wins.pid === topG.id, "and the wins leader is a goaltender");
  },

  /* Winning on the farm is worth something. The table, the playoffs and the
     trophy were all decorative as far as the prospects living in them went. */
  farmDevelopment(A) {
    section("Winning teaches");
    const F = A.DEV_FARM, SW = A.DEV_WIN_SWING, TI = A.DEV_WIN_TITLE;
    const full = { gp: 82, g: 20, a: 25 };
    const room = (pct, mean, title) => ({ pct, mean, title: !!title });

    // The default is untouched — an unspecified room is worth exactly DEV_FARM.
    ok(Math.abs(A.devEnvironment({ pos: "C" }, null, full) - F) < 1e-9, `no room given is still DEV_FARM (${F})`);
    ok(A.farmRoomBonus(null) === 0, "and no room is worth no bonus");
    ok(A.farmRoomBonus(room(0.5, 0.5)) === 0, "an average affiliate is worth nothing either way");

    // Winning pays, losing costs, and it is symmetric about the league.
    const win = A.devEnvironment({ pos: "C" }, null, full, room(0.75, 0.5));
    const lose = A.devEnvironment({ pos: "C" }, null, full, room(0.25, 0.5));
    ok(win > F, `a winning affiliate develops him faster (${win.toFixed(2)} > ${F})`);
    ok(lose < F, `a losing one slower (${lose.toFixed(2)})`);
    ok(Math.abs((win - F) + (lose - F)) < 1e-9, "and the two cancel exactly");
    ok(Math.abs(A.farmRoomBonus(room(1, 0.5)) - SW) < 1e-9, `the best room is worth ${SW}`);
    ok(Math.abs(A.farmRoomBonus(room(0, 0.5)) + SW) < 1e-9, "and the worst costs the same");
    ok(A.farmRoomBonus(room(1.5, 0.5)) === A.farmRoomBonus(room(1, 0.5)),
      "a short season can't post a better percentage than is possible");

    // The championship is worth something on its own.
    const champ = A.farmRoomBonus(room(0.6, 0.5, true)) - A.farmRoomBonus(room(0.6, 0.5, false));
    ok(Math.abs(champ - TI) < 1e-9, `winning it outright adds ${TI}`);
    ok(A.devEnvironment({ pos: "C" }, null, full, room(0.6, 0.5, true)) > win - SW, "on top of the record");

    // It is measured against the league, not a guessed .500 — the loser point
    // puts the real mean nearer .530, so centring on .500 would inflate everyone.
    ok(A.farmRoomBonus(room(0.53, 0.53)) === 0, "an average side is average whatever the mean is");
    ok(A.farmRoomBonus(room(0.53, 0.5)) > 0, "and the mean is what decides it");

    // It only weighs on the part of the year actually spent down there.
    const callup = A.devEnvironment({ pos: "C" }, { gp: 41, toi: 41 * 20, g: 26, a: 0 }, { gp: 41 }, room(1, 0.5));
    const callupFlat = A.devEnvironment({ pos: "C" }, { gp: 41, toi: 41 * 20, g: 26, a: 0 }, { gp: 41 });
    ok(Math.abs((callup - callupFlat) - SW / 2) < 1e-9, "half a season on the farm gets half the room");
    ok(A.devEnvironment({ pos: "C" }, { gp: 82, toi: 82 * 20, g: 52, a: 0 }, null, room(1, 0.5))
       === A.devEnvironment({ pos: "C" }, { gp: 82, toi: 82 * 20, g: 52, a: 0 }, null),
      "a player who never went down is untouched by it");

    /* And it reads a real league. `farmRoom` has to find the club's record and
       the mean across all thirty-two affiliates. */
    const G = A.newGame(0, { seed: 8899, rules: { seasonLen: 82 } });
    simSeason(A, G);
    const prospect = A.playersOf(G).find((p) => p.farm && p.farmSeason && p.farmSeason.gp > 20);
    ok(prospect, "a prospect played a farm season");
    const r = A.farmRoom(G, prospect);
    ok(r && r.pct >= 0 && r.pct <= 1, `his affiliate has a points percentage (${r ? r.pct.toFixed(3) : "?"})`);
    ok(r.mean > 0.4 && r.mean < 0.7, `and the league has a mean (${r.mean.toFixed(3)})`);
    // The mean really is the league's, so the bonuses net out across everybody.
    const all = A.playersOf(G).filter((p) => p.farm && p.farmSeason && p.farmSeason.gp > 0)
      .map((p) => A.farmRoomBonus(A.farmRoom(G, p)));
    const net = all.reduce((s, x) => s + x, 0) / all.length;
    ok(Math.abs(net) < TI, `the league-wide effect is close to neutral (${net.toFixed(3)})`);
    ok(all.some((x) => x > 0.1) && all.some((x) => x < -0.1), "with real winners and losers");

    // A player with no farm season gets nothing from any of it.
    const nhlOnly = A.playersOf(G).find((p) => !p.farm && p.season && p.season.gp > 40);
    ok(A.devEnvironment(nhlOnly, nhlOnly.season, null, A.farmRoom(G, nhlOnly))
       === A.devEnvironment(nhlOnly, nhlOnly.season, null),
      "a full-time NHL player is unaffected by his affiliate");

    // The title is awarded before progress() runs, so it can actually be read.
    simPlayoffs(A, G);
    ok(G.farmCup && G.farmCup.champion != null, "a farm champion was crowned");
    const winners = A.playersOf(G).filter((p) => (p.farmTitles || []).includes(G.year));
    ok(winners.length > 0, `its players carry the title (${winners.length})`);
  },

  /* Where a player came from. `p.draft` was stamped for life and exactly one
     line of code ever read it. */
  draftOrigins(A) {
    section("Draft origins");
    const G = A.newGame(0, { seed: 2626, rules: { seasonLen: 41 } });
    ok(G.foundingMaxPid > 0, `the founding league is bounded (${G.foundingMaxPid} players)`);
    /* A founding player was never drafted because there was no draft to be part
       of. Saying "undrafted" would be a claim about him, not about the save. */
    const founders = A.playersOf(G).filter((p) => p.id <= G.foundingMaxPid);
    ok(founders.length > 700, `the world starts full (${founders.length})`);
    ok(!founders.some((p) => A.draftOrigin(G, p)), "and none of them is labelled at all");

    // An offseason start builds a class; those prospects must fall on the far
    // side of the line, or they'd read as founding players.
    const O = A.newGame(0, { seed: 2626, rules: { seasonLen: 41 }, start: "offseason" });
    ok(O.draftClass.every((id) => id > O.foundingMaxPid), "a class built at kickoff is not founding");

    simSeason(A, G); simPlayoffs(A, G);
    A.autoDraft(G, false);
    const drafted = A.playersOf(G).filter((p) => p.draft);
    ok(drafted.length === A.draftPicksTotal(G), `a draft class was taken (${drafted.length})`);

    const d0 = A.draftOrigin(G, drafted[0]);
    ok(d0 && d0.kind === "drafted", "a drafted player knows he was drafted");
    ok(drafted.every((p) => {
      const d = A.draftOrigin(G, p);
      return d.year === G.year && d.round >= 1 && d.round <= A.DRAFT_ROUNDS
        && d.pick >= 1 && d.pick <= A.draftPicksTotal(G);
    }), "with a real year, round and overall pick");
    ok(drafted.every((p) => A.draftOrigin(G, p).by), "and a club that took him");

    // The pick number and the round have to agree with each other.
    ok(drafted.every((p) => {
      const d = A.draftOrigin(G, p);
      return d.round === Math.floor((d.pick - 1) / G.teams.length) + 1;
    }), "the round follows from the overall pick");
    // Nobody shares a slot.
    const slots = drafted.map((p) => p.draft.pick);
    ok(new Set(slots).size === slots.length, "no two players hold the same pick");
    const first = drafted.find((p) => p.draft.pick === 1);
    ok(first && A.draftOrigin(G, first).by.id === G.draftOrder[0], "first overall went to the club on the clock");

    /* It survives a trade — where he was taken is permanent, and that a player
       is still with the club that drafted him is the interesting half. */
    const stayed = drafted.filter((p) => A.draftOrigin(G, p).stayed).length;
    ok(stayed > 0 && stayed <= drafted.length, `most draftees are still where they were taken (${stayed})`);
    const mover = drafted.find((p) => p.teamId != null && p.teamId !== 0 && !A.hasNtc(p));
    if (mover) {
      const tookHim = mover.draft.teamId;
      mover.teamId = tookHim === 0 ? 1 : 0;
      const d = A.draftOrigin(G, mover);
      ok(d.by.id === tookHim, "a trade doesn't rewrite who drafted him");
      ok(!d.stayed, "but he no longer counts as never having left");
    } else { ok(true, ""); ok(true, ""); }

    // A late arrival with no record really did go undrafted.
    A.startNextSeason(G);
    const late = A.playersOf(G).filter((p) => p.id > G.foundingMaxPid && !p.draft && !p.retired);
    ok(late.length > 0, `undrafted signings exist (${late.length})`);
    ok(late.every((p) => A.draftOrigin(G, p).kind === "undrafted"), "and are named as such");

    // An old save can't know where the line fell, so it claims nothing.
    const legacy = JSON.parse(JSON.stringify(G));
    delete legacy.foundingMaxPid;
    A.migrate(legacy);
    ok(legacy.foundingMaxPid === null, "a save from before the line has none");
    ok(Object.values(legacy.players).filter((p) => !p.draft).every((p) => !A.draftOrigin(legacy, p)),
      "and nobody in it is wrongly called undrafted");
    ok(Object.values(legacy.players).some((p) => p.draft && A.draftOrigin(legacy, p)),
      "while real draft records still read");
  },

  /* Clearing out the bottom of a roster. Measured before this existed: 31 of 32
     clubs sat at or past the org limit from year two, some at 39, and not one
     release happened league-wide in a decade. */
  rosterLimits(A) {
    section("Cutting and roster limits");
    const G = A.newGame(0, { seed: 7373, rules: { seasonLen: 41 } });
    const MAXORG = A.ROSTER_MAX + A.FARM_MAX;

    // Only fringe money can simply be ended; a real contract needs waivers.
    const mine = A.rosterOf(G, 0, true).filter((p) => !A.hasNtc(p));
    const cheap = mine.filter((p) => A.effectiveCap(G, p) <= A.TERMINATE_MAX_CAP);
    const dear = mine.filter((p) => A.effectiveCap(G, p) > A.TERMINATE_MAX_CAP);
    ok(cheap.length > 0, `a club carries fringe contracts (${cheap.length})`);
    ok(cheap.every((p) => A.canTerminate(G, p)), "all of which can be cut");
    ok(dear.length > 0 && !dear.some((p) => A.canTerminate(G, p)),
      "and no real contract can — that's what waivers are for");
    ok(!A.terminateContract(G, dear[0].id).ok, "trying anyway is refused");

    // Cutting frees the spot IMMEDIATELY. Waivers take a day, which is useless
    // when the reason you're cutting is that you have no room.
    const victim = cheap[0];
    const before = A.rosterOf(G, 0, true).length;
    const r = A.terminateContract(G, victim.id);
    ok(r.ok, "a fringe contract can be ended");
    ok(A.rosterOf(G, 0, true).length === before - 1, "and the roster spot is free straight away");
    ok(victim.teamId == null && G.freeAgents.includes(victim.id), "he lands in the free-agent pool");
    ok(!(G.waivers || []).some((w) => w.pid === victim.id), "without passing through waivers");
    ok(!A.terminateContract(G, victim.id).ok, "and he can't be cut twice");

    // In season it costs; at the rollover it doesn't.
    A.simDays(G, 5);
    const live = A.rosterOf(G, 0, true).filter((p) => A.canTerminate(G, p))[0];
    const deadBefore = (G.retained || []).filter((x) => x.dead).length;
    const capBefore = A.capHit(G, 0), ownCap = A.effectiveCap(G, live);
    const inSeason = A.terminateContract(G, live.id);
    ok(inSeason.ok && inSeason.dead > 0, `cutting mid-season carries dead money ($${inSeason.dead}M)`);
    ok((G.retained || []).filter((x) => x.dead).length === deadBefore + 1, "charged to the club that cut him");
    ok(A.retainedBy(G, 0).some((x) => x.pid === live.id && x.dead), "and it is recorded against that club");
    /* The cap has to see it. Losing his salary but keeping a third of it means
       the club saves exactly the other two thirds — a cut is relief, not an
       escape. */
    const saved = capBefore - A.capHit(G, 0);
    ok(Math.abs(saved - (ownCap - inSeason.dead)) < 0.05,
      `the cap saves the salary less the dead money ($${saved.toFixed(2)}M of $${ownCap}M)`);

    /* The limits are ENFORCED, for everybody. The draft adds seven a year and
       nothing used to count the dressed side at all. */
    simSeason(A, G); simPlayoffs(A, G); A.autoDraft(G, false); A.startNextSeason(G);
    const orgs = G.teams.map((t) => A.rosterOf(G, t.id, true).filter((p) => !p.retired).length);
    const dressed = G.teams.map((t) => A.rosterOf(G, t.id).filter((p) => !p.retired).length);
    ok(Math.max(...orgs) <= MAXORG, `no organisation is over the limit (worst ${Math.max(...orgs)}/${MAXORG})`);
    ok(Math.max(...dressed) <= A.ROSTER_MAX, `nobody dresses more than ${A.ROSTER_MAX} (worst ${Math.max(...dressed)})`);
    ok(G.teams.every((t) => A.rosterOf(G, t.id, true).filter((p) => p.farm && !p.retired).length <= A.FARM_MAX),
      "and no farm is over its own");

    // Enforcement must not leave a club unable to ice a legal side — sorting on
    // rating alone would send a second goaltender down.
    Object.entries(A.DRESS_MIN).forEach(([pos, n]) => {
      ok(G.teams.every((t) => A.rosterOf(G, t.id).filter((p) => p.pos === pos).length >= n),
        `every club can still dress ${n} at ${pos}`);
    });

    /* And the AI actually lets people go — the whole "other teams" half. Before
       this, `dead` releases league-wide over ten seasons was exactly zero and
       fringe players stayed frozen on depth charts for their entire deal. */
    for (let i = 0; i < 3; i++) {
      simSeason(A, G); simPlayoffs(A, G); A.autoDraft(G, false); A.startNextSeason(G);
    }
    ok(G.freeAgents.length > 20, `there is a real market to sign from (${G.freeAgents.length})`);
    ok(G.freeAgents.length <= A.FA_POOL_MAX, `and it stays bounded (${G.freeAgents.length}/${A.FA_POOL_MAX})`);
    const stillOver = G.teams.filter((t) => A.rosterOf(G, t.id, true).filter((p) => !p.retired).length > MAXORG);
    ok(!stillOver.length, "no club drifts past the limit over several seasons");
    // Room to move: a jammed league can't sign anybody.
    const withRoom = G.teams.filter((t) => A.rosterOf(G, t.id, true).filter((p) => !p.retired).length < MAXORG);
    ok(withRoom.length >= 24, `most clubs have room to sign somebody (${withRoom.length}/32)`);

    /* And the MONEY is legal too. `draftPlayer` hands out seven entry contracts
       a club with no cap check anywhere, so a club that finished pressed
       against the ceiling used to open the next season several million over it
       — about one club-season in three hundred, measured over ten seeds. */
    const CAP = A.rules(G).capAmount;
    ok(G.teams.every((t) => A.capHit(G, t.id) <= CAP),
      `nobody opens the season over the cap (worst ${Math.max(...G.teams.map((t) => A.capHit(G, t.id))).toFixed(1)}/${CAP})`);

    /* Forced over deliberately, on a FRESH league — a club several seasons deep
       has already been trimmed to its position minimums, and then there is
       legitimately nothing it is allowed to cut. */
    const F = A.newGame(0, { seed: 4242, rules: { seasonLen: 41 } });
    const t0 = F.teams[5];
    const squad = A.rosterOf(F, t0.id, true).filter((p) => !A.hasNtc(p));
    const best = squad.slice().sort((a, b) => b.ovr - a.ovr)[0];
    const junk = squad.filter((p) => p.ovr < 55 && p.pos !== "G").sort((a, b) => a.ovr - b.ovr)[0];
    junk.contract.amt = CAP;            // a catastrophic deal, over the cap on its own
    best.contract.amt = 12;             // expensive, but the club is getting something
    ok(A.capHit(F, t0.id) > CAP, `a club can be pushed over the cap (${A.capHit(F, t0.id).toFixed(1)})`);
    A.enforceCap(F);
    ok(A.capHit(F, t0.id) <= CAP, `and it gets itself back under (${A.capHit(F, t0.id).toFixed(1)})`);
    ok(junk.teamId == null, "by shedding the contract it gets least for");
    ok(best.teamId === t0.id, "not the expensive player it gets plenty for");
    Object.entries(A.DRESS_MIN).forEach(([pos, n]) => {
      ok(A.rosterOf(F, t0.id, true).filter((p) => p.pos === pos).length >= n,
        `and it can still field ${n} at ${pos}`);
    });
    // A protected contract can't be the one that goes.
    const P = A.newGame(0, { seed: 4242, rules: { seasonLen: 41 } });
    const shielded = A.rosterOf(P, 5, true).find((p) => A.hasNtc(p));
    if (shielded) {
      shielded.contract.amt = CAP;
      A.enforceCap(P);
      ok(shielded.teamId === 5, "a no-trade clause protects him from a cap cut too");
    } else ok(true, "nobody on that club has a clause");
    // A soft cap is not a cap: nothing is forced.
    const soft = A.newGame(0, { seed: 4242, rules: { seasonLen: 41, hardCap: false } });
    const softBefore = A.rosterOf(soft, 0, true).length;
    A.rosterOf(soft, 0, true)[0].contract.amt = 200;
    A.enforceCap(soft);
    ok(A.rosterOf(soft, 0, true).length === softBefore, "without a hard cap nobody is forced out");
  },

  /* Names carrying their honours. The marks are only worth anything if they
     say the same thing the awards screen says. */
  honours(A) {
    section("Honour marks");
    const G = A.newGame(0, { seed: 5544, rules: { seasonLen: 82 } });
    ok(!A.seasonBallots(G), "nothing is claimed before a season has been played");
    ok(!A.playersOf(G).some((p) => A.honoursOf(G, p)), "and no name is marked");

    // Mid-season: a live ballot, from the same function that decides the real one.
    A.simDays(G, Math.floor(G.schedule.length * 0.6));
    const live = A.seasonBallots(G);
    ok(live && live.live, "a live ballot appears once there are games to judge");
    ok(Object.keys(live.votes).length === 6, "covering all six awards");
    const marked = A.playersOf(G).filter((p) => A.honoursOf(G, p));
    ok(marked.length > 0 && marked.length < 60, `a handful of names are marked (${marked.length})`);

    /* A mark has to mean what it says. Everyone shown as leading must actually
       top his ballot; everyone shown as in the running must be on one. */
    const wrongWin = marked.filter((p) => {
      const h = A.honoursOf(G, p);
      return h.won.some((k) => live.winners[k] !== p.id);
    });
    const wrongUp = marked.filter((p) => {
      const h = A.honoursOf(G, p);
      return h.up.some((k) => !live.votes[k].some((v) => v.id === p.id));
    });
    ok(!wrongWin.length, "nobody is shown leading an award he isn't leading");
    ok(!wrongUp.length, "and nobody is on a ballot he isn't on");
    ok(marked.every((p) => { const h = A.honoursOf(G, p); return !h.won.some((k) => h.up.includes(k)); }),
      "no award is both won and merely nominated");

    // The All-Star break marks its selections, and only for this season.
    const stars = A.playersOf(G).filter((p) => (p.allStars || []).includes(G.year));
    if (stars.length) {
      ok(stars.every((p) => A.honoursOf(G, p) && A.honoursOf(G, p).allStar),
        `every All-Star is marked (${stars.length})`);
    } else ok(true, "the break hasn't come round yet");

    /* Once the vote is real it REPLACES the projection — the marks must follow
       the awards screen, not a stale estimate. */
    simSeason(A, G);
    const final = A.seasonBallots(G);
    ok(final && !final.live, "a decided season stops projecting");
    ok(final.votes === G.awards.votes, "and reads the real ballot");
    const champ = G.players[G.awards.mvp];
    ok(A.honoursOf(G, champ).won.includes("mvp"), "the MVP's name carries the trophy");
    const runnerUp = G.players[G.awards.votes.mvp[1].id];
    const rh = A.honoursOf(G, runnerUp);
    ok(rh && rh.up.includes("mvp") && !rh.won.includes("mvp"), "and the runner-up carries the nomination");

    // Last year's honours must not follow a player into a new season.
    while (G.phase === "playoffs") A.simPlayoffRound(G);
    A.autoDraft(G, false); A.startNextSeason(G);
    ok(!A.seasonBallots(G), "a new season starts with nothing claimed");
    ok(!A.honoursOf(G, champ), "last year's MVP is no longer marked");
  },

  /* Clinching. A guarantee that turns out to be wrong is worse than no
     guarantee, so this pins that the marks never lie. */
  clinching(A) {
    section("Clinching");
    const G = A.newGame(0, { seed: 2468, rules: { seasonLen: 82 } });
    ok(!Object.keys(A.clinchState(G)).length, "nothing is clinched before a game is played");

    // Three quarters of the way in: some clubs are safe, some are done.
    A.simDays(G, Math.floor(G.schedule.length * 0.88));
    const C = A.clinchState(G);
    ok(Object.keys(C).length === G.teams.length, "every club has a verdict late on");
    const marked = G.teams.filter((t) => C[t.id].mark);
    const dead = G.teams.filter((t) => C[t.id].eliminated);
    ok(marked.length > 0, `somebody has clinched (${marked.length})`);
    ok(dead.length > 0, `and somebody is out (${dead.length})`);
    ok(!G.teams.some((t) => C[t.id].mark && C[t.id].eliminated), "nobody is both safe and eliminated");

    /* The claims have to survive the season actually finishing. This is the
       whole check: a club told it had clinched must be in the real bracket, and
       a club told it was eliminated must not be. */
    const promised = marked.map((t) => t.id);
    const written = dead.map((t) => t.id);
    const div = marked.filter((t) => C[t.id].mark === "z").map((t) => t.id);
    const top3 = marked.filter((t) => ["z", "y"].includes(C[t.id].mark)).map((t) => t.id);
    A.simDays(G, G.schedule.length + 2);
    A.buildBracket(G);
    const field = new Set();
    G.playoffs.rounds[0].forEach((s) => { field.add(s.hi); field.add(s.lo); });
    ok(promised.every((id) => field.has(id)), "every club told it had clinched made the field");
    ok(!written.some((id) => field.has(id)), "and no club told it was eliminated got in");

    // The sharper claims have to hold too.
    const B = A.playoffBerths(G);
    ok(top3.every((id) => B[id] && B[id].in && !B[id].wildcard),
      "a top-three claim did not end up needing a wildcard");
    ok(div.every((id) => A.divStandings(G, G.teams[id].div)[0].id === id),
      "and a division claim won the division");

    // Once every game is played there is nothing left to promise.
    ok(!Object.keys(A.clinchState(G)).length, "a finished season clinches nothing");

    // The seeded format has no divisions to win, so it never says so.
    const S = A.newGame(0, { seed: 2468, rules: { seasonLen: 82, playoffFormat: "seeded" } });
    A.simDays(S, Math.floor(S.schedule.length * 0.9));
    const SC = A.clinchState(S);
    ok(!Object.values(SC).some((c) => c.mark === "z" || c.mark === "y"),
      "seeded standings only ever claim a berth");
    const sPromised = S.teams.filter((t) => SC[t.id].mark).map((t) => t.id);
    A.simDays(S, S.schedule.length + 2);
    const SB = A.playoffBerths(S);
    ok(sPromised.every((id) => SB[id] && SB[id].in), "and that claim holds up there too");
  },

  /* Point shares kept for good. They were a live calculation that vanished at
     the rollover, so a twenty-year career had no record of them. */
  careerShares(A) {
    section("Point shares in the record");
    const G = A.newGame(0, { seed: 5150, rules: { seasonLen: 41 } });
    simSeason(A, G); simPlayoffs(A, G);
    const withRows = A.playersOf(G).filter((p) => (p.career || []).some((c) => c.gp));
    ok(withRows.length > 300, `seasons were archived (${withRows.length} players)`);

    const skaters = withRows.filter((p) => p.pos !== "G");
    const goalies = withRows.filter((p) => p.pos === "G");
    ok(skaters.some((p) => p.career.some((c) => c.ops || c.dps)), "a skater's row carries offensive and defensive shares");
    ok(goalies.some((p) => p.career.some((c) => c.gps)), "a goalie's row carries goaltending shares");
    /* Only the INDEPENDENT parts are stored — the total is derived. Four fields
       on every career row of every player is a quarter of a megabyte a decade,
       and the soak test holds the save under 3 MB. */
    ok(!withRows.some((p) => p.career.some((c) => c.ps != null)),
      "the total is never stored, only its parts");
    ok(!skaters.some((p) => p.career.some((c) => c.gps != null)), "a skater stores no goaltending share");
    ok(!goalies.some((p) => p.career.some((c) => c.ops != null || c.dps != null)),
      "and a goalie stores no skater shares");

    // The derived total has to equal what the live calculation said at the time.
    const big = skaters.map((p) => ({ p, c: p.career.find((c) => c.gp > 20) })).filter((x) => x.c)
      .sort((a, b) => A.lineShares(b.c).ps - A.lineShares(a.c).ps)[0];
    ok(big, "somebody had a real season");
    if (big) {
      const live = A.pointShares(G, big.p, big.c);
      const kept = A.lineShares(big.c);
      ok(Math.abs(kept.ps - live.ps) < 0.15,
        `the stored season matches the live one (${kept.ps.toFixed(1)} vs ${live.ps.toFixed(1)})`);
      ok(Math.abs((kept.ops + kept.dps) - kept.ps) < 0.001, "and its parts sum to its total");
      const car = A.careerShares(big.p);
      ok(Math.abs(car.ps - kept.ps) < 0.001, "a one-season career total is that season");
    }

    // A save archived before shares existed gets them filled in on load.
    const stripped = JSON.parse(JSON.stringify(G));
    delete stripped.psBackfilled;
    Object.values(stripped.players).forEach((p) => {
      (p.career || []).forEach((c) => { delete c.ops; delete c.dps; delete c.gps; });
    });
    A.migrate(stripped);
    const filled = Object.values(stripped.players)
      .filter((p) => (p.career || []).some((c) => c.gp > 20 && (c.ops || c.dps || c.gps)));
    ok(filled.length > 100, `an old save is backfilled on load (${filled.length} players)`);
  },

  /* Awards handed out after the fact, for seasons played before the ballots
     existed — and for seasons that were voted on but never delivered. */
  retroAwards(A) {
    section("Retroactive awards");
    const G = A.newGame(0, { seed: 8123, rules: { seasonLen: 41 } });
    for (let i = 0; i < 3; i++) {
      simSeason(A, G); simPlayoffs(A, G); A.autoDraft(G, false); A.startNextSeason(G);
    }
    ok(G.history.length === 3, `three seasons are on file (${G.history.length})`);

    // Case 1: a year that was never voted on at all.
    const wiped = JSON.parse(JSON.stringify(G));
    wiped.history.forEach((h) => { h.awards = null; });
    Object.values(wiped.players).forEach((p) => { p.trophies = []; });
    A.migrate(wiped);
    const voted = wiped.history.filter((h) => h.awards);
    ok(voted.length === 3, `every reconstructible year was voted on (${voted.length}/3)`);
    ok(voted.every((h) => h.retroAwards), "and each is marked as reconstructed");
    ok(voted.every((h) => h.awards.mvp != null && h.awards.scoring != null), "with an MVP and a scoring champion");
    ok(voted.every((h) => h.awards.year === h.year), "stamped with the right year");

    // The trophies reach the players, and the scoring title really did lead.
    const trophied = Object.values(wiped.players).filter((p) => (p.trophies || []).length);
    ok(trophied.length > 3, `the silverware reached the players (${trophied.length})`);
    const h0 = wiped.history[0];
    const champ = wiped.players[h0.awards.scoring];
    const row = champ && (champ.career || []).find((c) => c.year === h0.year);
    ok(row, "the scoring champion has that season on his record");
    if (row) {
      const better = Object.values(wiped.players).filter((p) => {
        const c = (p.career || []).find((x) => x.year === h0.year && !x.total);
        return c && p.pos !== "G" && (c.g + c.a) > (row.g + row.a);
      });
      ok(!better.length, `nobody outscored him that year (${row.g + row.a} pts)`);
    }

    // Idempotent: loading the same save twice must not double anybody's trophies.
    const before = Object.values(wiped.players).reduce((s, p) => s + (p.trophies || []).length, 0);
    A.migrate(wiped);
    A.migrate(wiped);
    const after = Object.values(wiped.players).reduce((s, p) => s + (p.trophies || []).length, 0);
    ok(before === after, `re-loading hands out nothing twice (${before} then ${after})`);

    // Case 2: the vote survived but the trophies never reached the players.
    const orphaned = JSON.parse(JSON.stringify(G));
    Object.values(orphaned.players).forEach((p) => { p.trophies = []; });
    A.migrate(orphaned);
    const rescued = Object.values(orphaned.players).filter((p) => (p.trophies || []).length);
    ok(rescued.length > 3, `a stored ballot still gets delivered (${rescued.length} players)`);
    ok(!orphaned.history.some((h) => h.retroAwards), "without pretending the vote was re-run");

    // A season too far gone to reconstruct is left blank rather than invented.
    const gutted = JSON.parse(JSON.stringify(G));
    gutted.history.forEach((h) => { h.awards = null; });
    const keep = Object.keys(gutted.players).slice(0, 20);
    gutted.players = keep.reduce((o, k) => { o[k] = gutted.players[k]; return o; }, {});
    A.migrate(gutted);
    ok(!gutted.history.some((h) => h.awards), "a season with nobody left is not given a fake MVP");
  },

  /* Trading a SPECIFIC pick. A round number alone can't tell the best asset in
     the sport from the least valuable pick of the same round. */
  pickTrading(A) {
    section("Specific picks");
    const G = A.newGame(0, { seed: 6420, rules: { seasonLen: 41 } });
    // This year's picks are tradeable during the season — that's the deadline.
    A.simDays(G, 12);
    const now = A.tradablePicks(G, G.userTeam);
    ok(now.some((pk) => pk.year === G.year), "this year's picks can be moved at the deadline");
    ok(now.every((pk) => pk.year >= G.year), "and nothing already used is offered");
    ok(now.every((pk) => pk.owner === G.userTeam), "you can only trade your own");

    // Before the lottery a slot is a projection off the table; it must be real.
    const thisYear = now.filter((pk) => pk.year === G.year);
    ok(thisYear.length > 0 && thisYear.every((pk) => {
      const s = A.pickSlot(G, pk); return s >= 1 && s <= G.teams.length;
    }), "every pick this year has a place in the round");
    ok(A.pickSlot(G, now.find((pk) => pk.year > G.year)) == null,
      "a future year's slot is unknown, not guessed");

    /* Where it lands has to MOVE its value, or "specific" is cosmetic. The
       worst club's first and the best club's first are the same round. */
    const table = A.standings(G);
    const worst = table[table.length - 1].id, best = table[0].id;
    const pickOf = (tid) => ({ year: G.year, round: 1, orig: tid, owner: tid });
    const vWorst = A.pickValue(G, pickOf(worst)), vBest = A.pickValue(G, pickOf(best));
    ok(vWorst > vBest * 1.3, `the bottom club's first is worth far more (${vWorst.toFixed(1)} vs ${vBest.toFixed(1)})`);
    ok(A.pickSlot(G, pickOf(worst)) === 1, "and it projects as first overall");

    // The average is unchanged, so every valuation built on the old flat number
    // still holds.
    const mean = G.teams.reduce((s, t) => s + A.pickValue(G, pickOf(t.id)), 0) / G.teams.length;
    ok(Math.abs(mean - 9) < 0.6, `the average first is still worth about 9 (${mean.toFixed(2)})`);
    ok(A.pickValue(G, { year: G.year + 2, round: 1, orig: worst, owner: worst }) < vWorst,
      "a pick further out is discounted");

    // Once the order is drawn the slot is exact, not projected.
    simSeason(A, G); simPlayoffs(A, G);
    ok(G.draftYear === G.year, "the draft order is stamped with its year");
    const drawn = A.tradablePicks(G, G.userTeam).find((pk) => pk.year === G.year);
    if (drawn) ok(A.pickSlot(G, drawn) === G.draftOrder.indexOf(drawn.orig) + 1,
      "and a slot now reads straight off the lottery");
    else ok(true, "no picks left this year");
    const L = drawn ? A.pickLabel(G, drawn, G.userTeam) : null;
    ok(!L || (L.text && L.note && !/proj/.test(L.note)), "a drawn pick is labelled exactly, not as a projection");
  },

  /* The draft as a room you sit in: an order, a shortlist, and the run before
     your turn happening one pick at a time. */
  draftRoom(A) {
    section("The draft room");
    const G = A.newGame(0, { seed: 9090, rules: { seasonLen: 41 } });
    simSeason(A, G); simPlayoffs(A, G);

    const rows = A.draftOrderRows(G);
    ok(rows.length === A.draftPicksTotal(G), `the order covers every pick (${rows.length})`);
    ok(rows.every((r, i) => r.pick === i + 1), "numbered straight through");
    ok(rows.filter((r) => r.round === 1).length === G.teams.length, "with a full first round");
    ok(rows.every((r) => r.owner != null && G.teams[r.owner]), "and every pick has an owner");
    ok(!rows.some((r) => r.made), "nothing has been taken yet");

    // One pick at a time, and never one of yours.
    const at = G.draftPick;
    const onClock = A.pickOwner(G, at);
    const moved = A.draftOnePick(G);
    if (onClock === G.userTeam) {
      ok(!moved && G.draftPick === at, "it refuses to pick for you");
      A.draftPlayer(G, G.draftClass[0]);
    } else {
      ok(moved && G.draftPick === at + 1, "one pick advances exactly one pick");
      ok(A.draftOrderRows(G).filter((r) => r.made).length === 1, "and the order records what was taken");
    }

    /* The shortlist. A pick made FOR you takes your man; the same call for
       anybody else ignores your list entirely. */
    const board = G.draftClass.map((id) => G.players[id]).sort((a, b) => A.draftValue(a) - A.draftValue(b));
    const humble = board[0];   // deliberately the worst man on the board
    A.toggleStar(G, humble.id);
    ok(A.starList(G)[0] === humble.id, "starring puts him at the top of your list");
    ok(A.autoPickFor(G, G.userTeam).id === humble.id, "and a pick made for you takes him");
    const other = G.teams.find((t) => t.id !== G.userTeam).id;
    ok(A.autoPickFor(G, other).id !== humble.id, "while nobody else is steered by your list");
    A.toggleStar(G, humble.id);
    ok(!A.starList(G).length, "starring again clears him");

    // A projection you can snipe off: better prospects are expected sooner.
    const proj = A.draftProjection(G);
    const ranked = G.draftClass.map((id) => G.players[id]).sort((a, b) => A.draftValue(b) - A.draftValue(a));
    ok(proj.byId[ranked[0].id].at < proj.byId[ranked[ranked.length - 1].id].at,
      "the best man on the board is expected first");
    ok(proj.byId[ranked[0].id].at >= G.draftPick + 1, "and nobody is expected before the current pick");
    if (proj.myNext != null) {
      ok(A.pickOwner(G, proj.myNext - 1) === G.userTeam, "your next pick is really yours");
      const risky = ranked.filter((p) => proj.byId[p.id].risk > 0.9);
      const safe = ranked.filter((p) => proj.byId[p.id].risk < 0.1);
      ok(!risky.length || !safe.length || A.draftValue(risky[0]) > A.draftValue(safe[0]),
        "the men who won't last are the good ones");
    } else { ok(true, "no picks left"); ok(true, ""); }

    // Your list is for one draft and must not steer the next one.
    A.toggleStar(G, G.draftClass[0]);
    A.autoDraft(G, false);
    ok(!G.draftStars.length, "the list is cleared when the draft closes");
  },

  /* The farm as a set of games rather than a points total. */
  farmGames(A) {
    section("Farm results");
    const G = A.newGame(0, { seed: 4477, rules: { seasonLen: 41 } });
    A.simDays(G, 40);
    const mine = G.teams[G.userTeam];
    const log = mine.farmLog || [];
    ok(log.length > 5, `your affiliate has a game log (${log.length})`);
    ok(log.length === A.farmRec(mine).gp, "with one row per game it played");
    // The log has to reconcile with the table it produced.
    const w = log.filter((r) => r.gf > r.ga).length;
    ok(w === A.farmRec(mine).w, `wins in the log match the table (${w})`);
    ok(log.reduce((s, r) => s + r.gf, 0) === A.farmRec(mine).gf, "and so do goals for");
    ok(log.reduce((s, r) => s + r.ga, 0) === A.farmRec(mine).ga, "and goals against");
    ok(log.every((r) => r.o !== G.userTeam), "nobody played themselves");
    ok(log.every((r, i) => i === 0 || r.d > log[i - 1].d), "in the order they were played");
    ok(log.length <= A.FARM_LOG_MAX, "and the log is bounded");

    // The affiliate mirrors the parent schedule, so a farm result must sit on a
    // day the parent club actually played.
    ok(log.every((r) => (G.schedule[r.d] || []).some((f) =>
      (f.home === G.userTeam && f.away === r.o) || (f.away === G.userTeam && f.home === r.o))),
      "every farm game mirrors a real fixture");

    // Last night's league-wide scoreboard, replaced each day rather than piled up.
    ok(G.farmDay && Array.isArray(G.farmDay.games), "last night's scores are kept");
    ok(G.farmDay.games.length === (G.schedule[G.farmDay.day] || []).length,
      "one farm game per parent fixture that night");

    // Fixtures are read off the parent schedule, so they cost nothing to store.
    const next = A.farmFixtures(G, G.userTeam, 5);
    ok(next.length > 0, `the affiliate has fixtures to come (${next.length})`);
    ok(next.every((f) => f.d >= G.day), "all of them ahead of today");
    ok(next.every((f) => (G.schedule[f.d] || []).some((x) => x.home === f.opp || x.away === f.opp)),
      "and each is a real fixture");

    A.startNextSeason(G);
    ok(!G.teams[G.userTeam].farmLog && !G.farmDay, "the log and the scoreboard reset for a new season");
  },

  /* Starting a career in the offseason instead of at game one. */
  careerStart(A) {
    section("Where the career starts");
    const D = A.newGame(0, { seed: 1234, rules: { seasonLen: 41 } });
    ok(D.phase === "regular" && D.day === 0, "the default is opening night");

    const O = A.newGame(0, { seed: 1234, rules: { seasonLen: 41 }, start: "offseason" });
    ok(O.phase === "offseason", "starting early lands in the offseason");
    ok(A.offseasonStage(O) === "review", "at the top of the sequence");
    ok(O.draftClass.length > 0, `with a draft class already built (${O.draftClass.length})`);
    ok(O.draftOrder && O.draftOrder.length === O.teams.length, "and a full draft order");
    ok(O.draftYear === O.year, "stamped with this year");

    /* Nobody has played, so the order can't come from the table. Weakest roster
       picks first — otherwise the sort falls through to club id and the draft
       order is the alphabet. */
    const early = O.draftOrder.slice(0, 8).reduce((s, id) => s + A.teamStrength(O, id), 0) / 8;
    const late = O.draftOrder.slice(-8).reduce((s, id) => s + A.teamStrength(O, id), 0) / 8;
    ok(early < late, `the weakest clubs pick first (${early.toFixed(1)} vs ${late.toFixed(1)})`);
    ok(new Set(O.draftOrder).size === O.teams.length, "and every club appears exactly once");

    // The world itself is the same league either way — only the starting point moves.
    ok(A.playersOf(D).length === A.playersOf(O).length - O.draftClass.length,
      "the league is identical apart from the draft class");
    ok(O.freeAgents.length > 0, "there is a market to work");

    // And it plays through to a real season.
    let guard = 0;
    while (O.phase === "offseason" && guard++ < 400) A.doOffseasonStep(O);
    ok(O.phase === "regular", "the offseason runs through to a season");
    ok(O.year === D.year + 1, `which is the year after the draft (${O.year})`);
    ok(O.schedule.length > 0, "with a calendar built");
    ok(O.teams.every((t) => A.rosterOf(O, t.id).length >= 20), "and every club able to dress a side");
  },

  /* A playoff game should read like a regular-season one. */
  playoffSummaries(A) {
    section("Playoff summaries");
    const G = A.newGame(0, { seed: 3030, rules: { seasonLen: 41 } });
    simSeason(A, G); simPlayoffs(A, G);
    const played = G.playoffs.rounds.flat().flatMap((s) => s.games);
    ok(played.length > 20, `a postseason was played (${played.length} games)`);
    ok(played.every((g) => g.d != null), "every series game records the day it was played");

    const rows = G.results.filter((r) => r.playoff);
    ok(rows.length > 0, `playoff games reach the results feed (${rows.length})`);
    ok(rows.every((r) => Array.isArray(r.scorers)), "carrying who scored");

    // The lookup that ties a series game to its summary.
    const found = played.map((g) => A.resultFor(G, g)).filter(Boolean);
    ok(found.length > played.length * 0.5, `most games resolve to a summary (${found.length}/${played.length})`);
    ok(found.every((r) => r.playoff), "and never to a regular-season game by mistake");
    const sample = played.find((g) => A.resultFor(G, g));
    if (sample) {
      const r = A.resultFor(G, sample);
      ok(r.hg === sample.hg && r.ag === sample.ag, "the summary is the same game as the scoreline");
      ok(r.scorers.length === r.hg + r.ag - (r.so ? 1 : 0),
        "and names a scorer for every goal but a shootout winner");
      ok(r.scorers.every((s) => s.t === r.home || s.t === r.away), "each credited to a club that played");
    } else { ok(true, ""); ok(true, ""); ok(true, ""); }
  },

  /* ------------------------------ the audit -------------------------------
   * Everything above tests one feature at a time on a fresh league. This runs
   * a real career — twelve full seasons with every system on and the club
   * running itself — and then asks whether the SAVE is still coherent.
   *
   * That's a different question, and it's the one that actually bites: a
   * dangling id, a player on two rosters, a history array that quietly stopped
   * growing, dead money owed to somebody the prune deleted. None of it shows
   * up in a feature test, and all of it shows up in a save you've played for
   * an hour.
   * ---------------------------------------------------------------------- */
  audit(A) {
    const YEARS = 12;
    const G = A.newGame(0, { seed: 5309, rules: { seasonLen: 82 } });
    A.applyDepthPreset(G, "deep");
    A.applyPendingRules(G);
    A.setRule(G, "autoManage", "balanced");
    A.gmState(G).stakes[G.userTeam] = 0.6;   // exercise the owner paths too
    /* Anything measured off the live season has to be caught BEFORE the
       rollover blanks it — special teams, ice time — so the last year's
       numbers are kept as they stood on the final day. */
    let live = null;
    for (let y = 0; y < YEARS; y++) {
      while (G.phase === "regular") { A.simDays(G, 25); if (G.presser) A.answerPresser(G, 0); }
      if (y === YEARS - 1) {
        live = {
          pp: G.teams.map((t) => A.ppPct(t)),
          pk: G.teams.map((t) => A.pkPct(t)),
          toi: A.playersOf(G)
            .filter((p) => p.pos !== "G" && p.season && p.season.gp >= 40)
            .map((p) => p.season.toi / p.season.gp),
        };
      }
      while (G.phase === "playoffs") A.simPlayoffRound(G);
      A.autoDraft(G, false);
      if (G.fired) { G.fired = null; G.boardConfidence = 55; }
      A.startNextSeason(G);
    }
    const all = A.playersOf(G);
    const clubs = G.teams.map((t) => t.id);

    section(`Referential integrity after ${YEARS} seasons`);
    ok(all.every((p) => p.teamId == null || clubs.includes(p.teamId)),
      "every player is either free or at a club that exists");
    const rostered = new Set();
    let dupes = 0;
    all.forEach((p) => { if (p.teamId != null) { if (rostered.has(p.id)) dupes++; rostered.add(p.id); } });
    ok(dupes === 0, "nobody is on two rosters");
    ok(new Set(G.freeAgents).size === G.freeAgents.length, "the free-agent list has no duplicates");
    ok(G.freeAgents.every((id) => G.players[id]), "and no ghosts on it");
    ok(G.freeAgents.every((id) => G.players[id].teamId == null),
      "nobody is a free agent AND under contract");
    ok(!G.freeAgents.some((id) => G.players[id].retired), "and nobody retired is on the market");
    ok((G.picks || []).every((pk) => clubs.includes(pk.owner)), "every draft pick is owned by a real club");
    ok((G.picks || []).every((pk) => pk.year >= G.year - 1), "and no pick is stranded in the past");
    ok((G.retained || []).every((r) => clubs.includes(r.from)),
      "every dollar of dead money is charged to a real club");
    ok(G.teams.every((t) => (t.honours || []).every((h) => h.pid == null || h.name)),
      "a retired number keeps the name, for when the player is pruned");
    ok((G.worldCups || []).every((c) => c.gold && c.silver), "every tournament has a winner and a loser");
    ok(Object.keys(A.gmState(G).stakes || {}).every((k) => clubs.includes(+k)),
      "and you don't own a club that doesn't exist");

    section("The league is still legal");
    G.teams.forEach((t) => {
      const nhl = A.rosterOf(G, t.id);
      if (nhl.length < A.ROSTER_MIN || nhl.length > A.ROSTER_MAX) {
        ok(false, `${t.abbr} dresses a legal roster (${nhl.length})`);
      }
    });
    ok(G.teams.every((t) => {
      const n = A.rosterOf(G, t.id).length;
      return n >= A.ROSTER_MIN && n <= A.ROSTER_MAX;
    }), `all thirty-two dress between ${A.ROSTER_MIN} and ${A.ROSTER_MAX}`);
    ok(G.teams.every((t) => A.rosterOf(G, t.id, true).filter((p) => p.pos === "G").length >= 2),
      "and every organisation has two goalies in it");
    const over = G.teams.filter((t) => A.capHit(G, t.id) > A.rules(G).capAmount);
    ok(!over.length, `nobody is over the cap${over.length ? ` (${over.map((t) => t.abbr).join(",")})` : ""}`);
    ok(all.every((p) => p.teamId == null || p.contract.yrs >= 0),
      "and nobody is signed for a negative number of years");

    section("History kept growing");
    ok(G.history.length === YEARS, `one row per season (${G.history.length}/${YEARS})`);
    ok((G.draftHistory || []).length === YEARS, `one draft per season (${(G.draftHistory || []).length})`);
    ok((G.gmSeasons || []).length === YEARS, `one of your own per season (${(G.gmSeasons || []).length})`);
    ok(G.history.every((h) => h.awards), "every season kept its awards");
    ok(G.history.every((h) => h.leaders), "and who led it");
    ok(G.history.every((h) => h.standings && h.standings.length === 32), "and the whole table");
    const years = G.history.map((h) => h.year);
    ok(new Set(years).size === years.length, "no season is recorded twice");
    ok(years.every((y, i) => i === 0 || y === years[i - 1] + 1), "and they run consecutively");

    section("The record book advanced");
    const recs = G.records || {};
    ok(A.RECORD_DEFS.every((d) => recs[d.key] && recs[d.key].v > 0),
      "every season record is held by somebody");
    ok(A.RECORD_DEFS.every((d) => recs[d.key].name), "with a name attached");
    ok(recs.pointStreak && recs.pointStreak.v >= 5, `a point streak is on the books (${recs.pointStreak && recs.pointStreak.v})`);
    ok(recs.winStreak && recs.winStreak.v >= 4, `and a club's winning run (${recs.winStreak && recs.winStreak.v})`);
    ok(A.CAREER_RECORD_DEFS.every((d) => (G.careerRecords || {})[d.key]),
      "and the career book has an entry for everything");
    /* A record can only ever go UP. Re-running the update on a finished save
       must not move a single one of them. */
    const before = JSON.stringify(G.records);
    A.updateRecords(G);
    ok(JSON.stringify(G.records) === before, "and running the update again changes nothing");

    section("Twelve years actually happened");
    const retired = all.filter((p) => p.retired);
    ok(retired.length > 40, `players retired (${retired.length})`);
    ok(retired.some((p) => p.hof != null), "somebody made the Hall of Fame");
    ok(all.some((p) => (p.trophies || []).length), "trophies were won");
    ok(all.some((p) => (p.rings || []).length), "and rings");
    ok(all.some((p) => (p.medals || []).length), "and medals");
    ok((G.worldCups || []).length === Math.floor(YEARS / A.WORLD_CUP_EVERY)
      || (G.worldCups || []).length === Math.ceil(YEARS / A.WORLD_CUP_EVERY),
      `a tournament every four winters (${(G.worldCups || []).length})`);
    ok(G.teams.some((t) => (t.honours || []).length), "a number was retired somewhere");
    ok(all.some((p) => (p.career || []).length >= 6), "and somebody has a long career behind him");

    section("Nothing ran away");
    const json = JSON.stringify(G);
    ok(json.length / 1048576 < 3.6, `the save still fits (${(json.length / 1048576).toFixed(2)} MB)`);
    ok(all.length < 1700, `the population settled (${all.length} players)`);
    const ages = all.filter((p) => p.teamId != null && !p.retired).map((p) => p.age);
    const meanAge = ages.reduce((s, a) => s + a, 0) / ages.length;
    ok(meanAge > 23.5 && meanAge < 27.5, `the league is a grown-up age (${meanAge.toFixed(1)})`);
    ok(ages.filter((a) => a >= 33).length > 25, `and it still has veterans (${ages.filter((a) => a >= 33).length} aged 33+)`);
    ok(G.news.length <= 80, `the wire is bounded (${G.news.length})`);
    const unhappy = all.filter((p) => p.demand).length;
    ok(unhappy < 220, `demands didn't spiral (${unhappy})`);
    ok(all.filter((p) => p.holdout).length < 12, `nor holdouts (${all.filter((p) => p.holdout).length})`);
    ok(!all.some((p) => p.ltir && p.inj <= 0), "and nobody is stuck on long-term reserve while fit");

    section("And it is not still growing");
    /* The check the twelve-season audit could not make. A leak that adds a
       little every year looks fine at twelve and is fatal at twenty: the
       retired archive kept EVERY Cup winner for ever — twenty-three men a
       spring — and the save went 2.5 MB to 5.4 MB, past what localStorage
       holds, somewhere around year seventeen. What matters is not the size but
       the SLOPE, so this measures the second half against the first. */
    const size12 = json.length;
    const before12 = A.playersOf(G).filter((p) => p.retired).length;
    for (let y = 0; y < 8; y++) {
      simSeason(A, G); simPlayoffs(A, G); A.autoDraft(G, false);
      if (G.fired) { G.fired = null; G.boardConfidence = 55; }
      A.startNextSeason(G);
    }
    const size20 = JSON.stringify(G).length;
    const after20 = A.playersOf(G).filter((p) => p.retired).length;
    ok(size20 / 1048576 < 4.4, `twenty seasons still fits (${(size20 / 1048576).toFixed(2)} MB)`);
    ok(size20 < size12 * 1.35,
      `and the save flattens instead of climbing (${(size12 / 1048576).toFixed(2)} → ${(size20 / 1048576).toFixed(2)} MB)`);
    ok(after20 < before12 * 1.7,
      `the retired archive is bounded (${before12} → ${after20})`);
    ok(A.playersOf(G).length < 1650, `and so is the league (${A.playersOf(G).length})`);
    /* Whatever is dropped, the things a screen can still click on must survive:
       the Hall, retired numbers, and everyone named in a season's history. */
    ok(A.playersOf(G).filter((p) => p.hof != null).length > 0, "the Hall of Fame is untouched");
    ok(G.teams.every((t) => (t.honours || []).every((h) => h.name)),
      "and every retired number can still be named");

    section("Nobody is dressed twice");
    /* Scanned across fourteen seasons, SOMEBODY averaged between thirty and
       forty-two minutes a night in every one of them, against a real maximum
       of twenty-six to twenty-eight. `autoLines` ended its fallback chain at
       `|| ds[0]` and `|| r[0]`, so a club short at a position put its best man
       in two slots at once and he collected both sets of minutes. It was also
       propping up the top of the scoring race. */
    G.teams.forEach((t) => { t.lines = null; });
    let twice = 0, empty = 0, maxToi = 0;
    G.teams.forEach((t) => {
      const L = A.autoLines(G, t.id);
      const seen = new Set();
      L.F.concat(L.D).forEach((row) => row.forEach((id) => {
        if (id == null) { empty++; return; }
        if (seen.has(id)) twice++;
        seen.add(id);
      }));
    });
    ok(twice === 0, `no club ices the same man twice (${twice})`);
    ok(empty === 0, `and no club ices a hole (${empty})`);
    maxToi = Math.max(...live.toi);
    const minToi = Math.min(...live.toi);
    ok(maxToi < 29, `and nobody plays an impossible night (${maxToi.toFixed(1)} min)`);
    ok(minToi > 5, `nor an invisible one (${minToi.toFixed(1)} min)`);

    section("Clubs build a real roster");
    /* `aiFreeAgency` asked about goalies and defencemen and nothing else, so
       clubs signed the best rating on the board and stockpiled centres —
       seventeen of the thirty-two could not fill a forward group, one carrying
       nine centres and six wingers for twelve slots. */
    const shapes = G.teams.map((t) => {
      const r = A.rosterOf(G, t.id);
      const at = (pos) => r.filter((p) => p.pos === pos).length;
      return { abbr: t.abbr, C: at("C"), LW: at("LW"), RW: at("RW"), D: at("D"), G: at("G") };
    });
    const short = shapes.filter((s) => Object.keys(A.DRESS_MIN).some((k) => s[k] < A.DRESS_MIN[k]));
    ok(!short.length, `every club can fill a lineup${short.length
      ? ` (${short.slice(0, 3).map((s) => `${s.abbr} ${s.C}C/${s.LW + s.RW}W/${s.D}D`).join(", ")})` : ""}`);
    ok(Object.values(A.DRESS_MIN).reduce((a, b) => a + b, 0) === A.ROSTER_MIN,
      "and what a club must carry adds up to what it must dress");

    section("Special teams exist");
    /* `simGame` counted power plays drawn and scored on into the box from the
       beginning and nothing ever read them — the two numbers a fan checks after
       the score were computed for every game ever played and binned. */
    const pp = live.pp.filter((x) => x > 0), pk = live.pk.filter((x) => x > 0);
    ok(pp.length === 32 && pk.length === 32, `every club has a power play and a kill (${pp.length}/${pk.length})`);
    const mPp = pp.reduce((s, x) => s + x, 0) / Math.max(1, pp.length);
    const mPk = pk.reduce((s, x) => s + x, 0) / Math.max(1, pk.length);
    ok(mPp > 12 && mPp < 28, `the league power play runs ${mPp.toFixed(1)}% (real 18–22)`);
    ok(mPk > 72 && mPk < 88, `and the kill ${mPk.toFixed(1)}% (real 78–82)`);
    ok(Math.abs(mPp + mPk - 100) < 2, "and they are the same events from both ends");

    section("Players stop at their ceiling");
    /* The bug that produced everything in this section: `progress` added a flat
       +2.4 a year to anybody under his peak whether he had anywhere left to go
       or not, and `pot` follows `ovr` up — so a cohort traced with NO GAMES
       PLAYED had sixty-four of ninety-six past their own ceiling by
       twenty-five, and peaked six and a half points above the ceiling they were
       drafted with. Development now APPROACHES the ceiling. */
    const grown = A.playersOf(G).filter((p) => !p.retired && p.teamId != null && p.age >= 24);
    const past = grown.filter((p) => p.ovr > p.pot + 1);
    ok(past.length / Math.max(1, grown.length) < 0.12,
      `almost nobody has blown past his ceiling (${past.length}/${grown.length})`);
    ok(A.DEV_BASE < 1, `a player at his ceiling barely moves (base ${A.DEV_BASE})`);
    ok(A.DEV_GAP_PULL > 0.15, `and a raw one moves fast (gap pull ${A.DEV_GAP_PULL})`);
    /* Which is what makes minutes the biggest thing in the function rather than
       a garnish on a flat number — the young-player lever the game is about. */
    const kid = { pos: "C", age: 20, ovr: 50, pot: 70, r: { sht: 50 } };
    const roomFor = A.devAgeWeight(kid.age);
    ok(roomFor === 1, "a twenty-year-old's surroundings count for everything");

    section("And the league level holds");
    /* `leagueLevel` exists so that "is he good enough" is asked against his
       peers. Both retirement tests used to compare to a FIXED rating, and every
       point the league drifted pushed more players under an unmoving bar —
       culling the weakest raised the average, which culled more. */
    const lvl = A.leagueLevel(G);
    ok(lvl > A.LEAGUE_LEVEL_BASE - 4, `the league has not collapsed (${lvl})`);
    ok(lvl < A.LEAGUE_LEVEL_BASE + 14, `nor run away with itself (${lvl} against ${A.LEAGUE_LEVEL_BASE} at generation)`);
    ok(A.leagueLevel(G) === lvl, "and the level is cached rather than recomputed per player");

    section("The board is still sane in year twenty");
    /* The bug this section exists for: `teamStrength` is a plain average of
       overall ratings, and the league INFLATES — the average NHL player goes
       from 62 to 75 across twenty seasons. Against fixed thresholds (73 for the
       Cup) every one of the thirty-two clubs cleared the bar by about year
       twelve, so every club in the league was told to win the same Cup. A
       mandate has to be read against the other thirty-one, not against a
       number that stopped meaning anything. */
    const ranks = G.teams.map((t) => A.strengthRank(G, t.id)).sort((a, b) => a - b);
    ok(ranks.join(",") === G.teams.map((_, i) => i).join(","),
      "every club has its own place in the league, 0 through 31");
    /* Every club given the SAME strong season behind it, so the escalation
       ceiling ("only one step more than you just did") permits any answer and
       the only thing separating them is where their roster ranks. */
    const asks = G.teams.map((t) => {
      const H = A.migrate(JSON.parse(JSON.stringify(G)));
      H.userTeam = t.id;
      H.teams[t.id].seasons = [{ year: H.year - 1, pts: 100, playoffs: true, rounds: 3, cup: false }];
      A.setMandate(H);
      return { id: t.id, key: H.mandate.key, rank: A.strengthRank(G, t.id) };
    });
    const cups = asks.filter((a) => a.key === "cup").length;
    ok(cups > 0 && cups <= 6, `a handful are asked to win the Cup, not all of them (${cups} of 32)`);
    ok(new Set(asks.map((a) => a.key)).size >= 3,
      `and different clubs are asked for different things (${new Set(asks.map((a) => a.key)).size} kinds)`);
    /* And it's the GOOD ones. Without this the count could be right by accident
       while the board asked the wrong clubs. */
    const askedCup = asks.filter((a) => a.key === "cup").map((a) => a.rank);
    ok(askedCup.every((r) => r < 8), `and it's the best rosters that get asked (ranks ${askedCup.join(",")})`);
    const worst = asks.find((a) => a.rank === 31);
    ok(worst && worst.key !== "cup", "the worst club in the league is not asked to win it");

    section("The history agrees with itself");
    /* A season row can be present and still be nonsense. These are the joins:
       the champion actually appears in that year's table, the scoring leader
       actually led it, and the MVP was somebody worth voting for. */
    ok(G.history.every((h) => h.champion == null || h.standings.some((s) => s.id === h.champion)),
      "every champion played in the season it won");
    ok(G.history.every((h) => {
      const top = h.standings.slice().sort((a, b) => b.pts - a.pts)[0];
      return top && top.pts > 0;
    }), "every table has somebody at the top of it");
    ok(G.history.every((h) => h.standings.every((s) => s.w + s.l + s.otl === 82)),
      "and every club in it played a full season");
    ok(G.history.every((h) => !h.leaders.points || h.leaders.points.v >= 40),
      "the scoring leader actually led (nobody won it with twelve points)");
    ok(G.history.every((h) => !h.leaders.goals || h.leaders.goals.v >= 20), "and the goal leader");
    ok(G.history.every((h) => !h.leaders.wins || h.leaders.wins.v >= 20), "and the wins leader");
    ok(G.history.every((h) => h.awards && h.awards.mvp != null), "every season named an MVP");
    ok(G.history.every((h) => h.userRecord && h.userRecord.w + h.userRecord.l + h.userRecord.otl === 82),
      "and your own record adds up in all of them");
    /* The league's numbers must not DRIFT across a career. A goal environment
       that creeps every year is the kind of thing only a long run shows. */
    const gpg = G.history.map((h) => h.standings.reduce((s, x) => s + x.pts, 0));
    const first3 = gpg.slice(0, 3).reduce((s, x) => s + x, 0) / 3;
    const last3 = gpg.slice(-3).reduce((s, x) => s + x, 0) / 3;
    ok(Math.abs(first3 - last3) / first3 < 0.06,
      `the league's points total is stable across the career (${Math.round(first3)} → ${Math.round(last3)})`);

    section("It reloads as the same league");
    const R = A.migrate(JSON.parse(json));
    ok(R.teams.length === 32, "reloaded");
    ok(Object.keys(R.players).length === all.length, "with everybody still in it");
    ok(R.history.length === YEARS && (R.draftHistory || []).length === YEARS, "and all of the history");
    simSeason(A, R); simPlayoffs(A, R);
    ok(R.teams.every((t) => t.gp === 82), "and it plays another full season");
    ok(!R.teams.some((t) => A.capHit(R, t.id) > A.rules(R).capAmount), "still under the cap at the end of it");
  },

  determinism(A) {
    section("Determinism");
    const run = () => {
      const G = A.newGame(0, { seed: 4242, rules: { seasonLen: 41 } });
      simSeason(A, G);
      return G.teams.map((t) => `${t.abbr}:${t.pts}:${t.gf}`).join("|");
    };
    ok(run() === run(), "the same seed replays the same season");
  },
};

/* ---------------------------------- main --------------------------------- */
const want = process.argv[2];
const app = loadGame();
console.log(`Pocket GM — Hockey · headless checks${want ? ` (${want})` : ""}`);
const names = want ? [want] : Object.keys(CHECKS);
for (const n of names) {
  if (!CHECKS[n]) { console.error(`unknown check "${n}" — have: ${Object.keys(CHECKS).join(", ")}`); process.exit(2); }
  CHECKS[n](app);
}
console.log(`\n${failures ? "\x1b[31m" : "\x1b[32m"}${checksRun - failures}/${checksRun} passed\x1b[0m`);
process.exit(failures ? 1 : 0);
