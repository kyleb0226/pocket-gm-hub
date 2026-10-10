# Pocket GM — Baseball

Single-file baseball **GM simulation** game (inspired by the iOS *Pocket GM Football/Basketball* apps).
You run the front office of a fictional 30-team baseball league: roster, lineup/rotation, season
sim, trades, free agency, amateur draft, contracts/budget, playoffs, and a multi-season franchise loop.

## Run it
- It's a single static file: `index.html`. Open it directly in a browser, or serve the folder:
  `python3 -m http.server 8124 --directory ~/baseball-gm` → http://localhost:8124
- Registered in `~/.claude/launch.json` as **baseball-gm** (port 8124) for the preview tooling.
- No build step. React 18 + Babel-standalone + Tailwind, all via CDN.

## Architecture (all in `index.html`)
- **Bootstrap:** the app code lives in a `<script type="text/babel-src" id="app-src">` block. A small
  inline `<script>` at the bottom does `Babel.transform(src, {presets:[["react",{runtime:"classic"}]]})`
  then `eval`s it. The explicit **classic** runtime is required — the default `react` preset emits an
  ESM `import` (automatic JSX runtime) which breaks in a non-module inline script.
- **State:** one big `G` object held in `App` `useState`, persisted to `localStorage`
  (`pocketgm_baseball_v2`) via `commit()`. New game built by `newGame(userTeamId, opts)`.
- **Save persistence:** prefer **not** bumping `SAVE_KEY` for shape changes — instead add backfill to
  `migrate(G)` (runs in `loadGame` and on import) so existing franchises keep loading across updates.
  Header has **Save File** / **Load File** (`exportSave`/`importSave`) for manual JSON backups; bump
  `SAVE_VERSION` when you add migration steps.
  - **Multiple save slots + Main Menu:** each franchise lives under its own key `pocketgm_slot_<id>`; a
    `SLOTS_KEY` index lists them (`listSlots`). `saveGame(G)` writes to `slotKey(G.slotId)` (minting a `slotId`
    if absent) and refreshes the index meta (team/season/day/phase/ts). `loadSlot`/`deleteSlot`/`writeKey`/
    `readKey` are the slot primitives; `migrateLegacySave` folds the old single `SAVE_KEY` autosave into a slot
    once (run synchronously in `App` before the menu reads slots). App has a `screen` state
    (`menu`/`splash`/`play`): **`MainMenu`** lists franchises (newest = Continue) with Load/Delete + New
    Franchise; the header **☰ Menu** button (`toMenu`) autosaves then returns to the menu; Load File imports
    as a NEW slot (`g.slotId=null`). `Splash` takes an optional `onBack`.
  - **Save compression (the real quota fix):** the autosave is written **compressed** via a vendored,
    inlined `LZString.compressToUTF16` (MIT, no CDN → works offline / in the iOS wrapper), with a `LZ16:`
    marker prefix. JSON packs ~6–10× (a ~70KB game → ~10KB; a deep franchise that *didn't* fit now lands
    far under the ~5MB quota). `loadGame` sniffs the prefix: `LZ16:`→decompress, else legacy plain JSON
    (those start with `{`) → parse unchanged, so existing saves keep loading. `exportSave` stays **plain
    JSON** (portable backups). This is what actually fixed the "refresh during playoffs/offseason reverts a
    season, players a year younger, old stats/records deleted" bug: the uncompressed save crossed quota,
    `setItem` threw, and a refresh loaded the last write that fit (an older season). Keep `saveGame`/
    `loadGame` **synchronous** (commit pattern depends on it) — don't swap in async IndexedDB casually.
  - **Save size / localStorage quota (~5MB):** even with compression, keep the autosave bounded.
    `saveGame` returns a bool, runs an emergency `trimHistories`/`pruneFreeAgents` + retry on failure (now
    a rare last-ditch backstop), and `commit` toasts a warning — never fail silently. `trimHistories(G)`
    caps year-by-year history (25 entries for notable players — user's org / peak≥75 / decorated; 3 for
    filler). Lossless for game logic: records/HoF/leaders read `p.career` + `G.records` + `team.records`,
    not these arrays. Runs in `startNewSeason` (each rollover) and `migrate` (rescues existing bloated saves
    on load). If you add new per-season-growing per-player data, bound it here too.
  - `G.players` is an **object dict keyed by id** (not an array). Use `Object.values(G.players)` or the
    `rosterOf(G, teamId)` helper. `autoSetLineups` accepts either an array or the dict.
  - `G.seed` holds the league seed (or `null`).
- **Team id namespace:** MLB teams are `G.teams` (ids 0..29); each has a AAA affiliate in `G.aaaTeams`
  (ids 30..59, `id = 30 + parentId`). A player's `teamId` identifies both his org **and level**.
  Helpers: `isAAAId`, `aaaIdOf`, `parentIdOf`, and `teamById(G,id)` (resolves either array). Anything
  iterating `G.teams` (standings, playoffs, splash) stays MLB-only; `Leaders` filters out AAA players.
- **Seeded RNG:** `rint/pick/chance/gauss` route through a swappable `_rng` (default `Math.random`).
  `generateLeague(userTeamId, {seed, shuffle})` installs a `mulberry32(seed)` PRNG **only for the
  league build**, then restores `Math.random` so the season sim stays genuinely random. `shuffle`
  reassigns city/nickname identities across the fixed league/division slots, pinning the user's pick
  (`shuffledTeamDefs`). The Splash screen exposes both (seed accepts a number or a word via `hashSeed`).
- **Sim engine:** `simGame()` runs a real inning-by-inning, plate-appearance model. `paOutcome()`
  converts batter vs. pitcher ratings into K/BB/HR/hit/out probabilities; `advance()` moves baserunners;
  a per-PA steal check populates SB / caught-stealing. Relievers rotate ~each inning via
  `changePitcher`/`bringIn` (tracked by `segOuts`), with the highest-OVR reliever (last in `pen`)
  closing save situations — so innings distribute realistically instead of one arm soaking the game.
  Produces realistic leaders (≈ .330–.350 AVG / 45–55 HR / sub-2 ERA / ~30 SB; SP ~180–220 IP).
- **Box scores (`out.box`, `BoxScore` modal):** `simGame` snapshots every appearing player's line at
  game start (`snapH`/`snapP` → `gSnap`) and per-half-inning runs (`lineScore`), then diffs them into a
  **compact** `out.box` (player **ids + ints**, names resolved at view time): `ls` (per-inning runs, `null`
  = didn't bat → "X"), `hb`/`ab` batting `[pid,AB,R,H,RBI,BB,SO,HR]`, `hp`/`ap` pitching
  `[pid,OUT,H,R,ER,BB,SO,HRA]` (R==ER — sim treats all runs earned), and `dec` (`{w,l,s}` ids, returned
  by `awardDecision`). `simDay` stores it on **every MLB** schedule game (`g.box`, MLB only — not AAA);
  `seriesGame` stores it on each playoff `s.games[]` entry. The `BoxScore` modal (line score grid +
  batting/pitching tables, W/L/S tags) opens by **clicking a played game** in the **Schedule** tab (▦) or a
  **line-score chip in Playoffs**. Storage stays bounded: the schedule is rebuilt each `startNewSeason`, so
  only the **current** season's + current postseason's box scores persist (~1.3MB compressed/season, well
  - **AAA & college postseasons (`runAutoPlayoffs`/`simSeriesAuto`):** at `enterPlayoffs` (after the MLB
    bracket is set up) both secondary leagues run a **full MLB-style bracket** (WC play-in → DS → CS →
    cross-conference final), **auto-simmed to completion** — AAA uses MLB lengths (Bo5/Bo7), college is
    best-of-3. Results live on `G.aaaPlayoffs`/`G.collegePlayoffs` (slim series records, **no box** to keep
    the save small), champions roll into `G.aaaChampions`/`G.collegeChampions`. `seriesGame` was generalized
    to `teamById` (works for any league) and only feeds MLB game-records. The **AAA** and **College** tabs
    render the finished bracket via `MinorBracket` (seeds, per-round series scores, champion, past winners).
    `simSeriesAuto` keeps each game's **box score** (`g.box`), so `MinorBracket` shows clickable per-game
    chips (G1/G2…) that open the shared `BoxScore` modal — same player-by-player sheet as MLB games.
  - **AAA/college records & sub-tabbed pages:** `recordMinorRecords(G, "AAA"|"COL")` (run in `enterPlayoffs`
    before playoff stats) tracks single-season bests + **career bests** (`levelCareerTotal` sums a player's
    history rows at that level + live season; persistent high-water mark) into `G.aaaRecords`/`G.collegeRecords`
    `{season,career}`. The **AAA** and **College** tabs are now organized with in-page `SubTabs`
    (Standings / Leaders / Prospects / Playoffs / Records); the **Records** sub-tab is each league's own
    "Hall of Fame" via `MinorRecords` (champions roll + season bests + career bests). Standings team names open
    the shared `TeamRosterModal` (works for any league; subtitle handles AAA/college — no payroll for amateurs).
  under quota). Final scores/records/history are unaffected and persist forever.
- **Rotation & bullpen:** every team carries a **5-man rotation** (`autoSetLineups` promotes the best
  arms if short of true SPs) and each starter goes every 5th game (≈32–33 GS). The bullpen has a
  user-editable **priority order** (`team.bullpen`, resolved live by `bullpenOrder()`; `pen[0]` = closer).
  `pickReliever` is **role + workload based**: the closer (`pen[0]`) only enters to finish a 9th+ save of
  1–3; the **setup tier** (best ~55% of non-closers) carries normal relief; the fringe mop up blowouts
  (|lead|≥7). Within a role it hands the ball to whoever's thrown the least — first **this game**
  (`gOuts`), then **this season** (`stats.OUT`) — via `loadKey`/`leastLoaded`, and it *excludes the
  current arm* so nobody pitches consecutive innings or runs away with the workload. This replaced an
  older "fresh/unused" model whose exhaustion fallback let one arm soak 600+ IP (esp. in AAA). Result:
  good arms get the meaningful innings (~85–105 IP), fringe arms sit (~10–17 IP), no reliever outlier.
  Edit the rotation order and bullpen priority in the **Lineup** tab. NOTE: a deep enough pen matters —
  AAA carries 8 RP so its setup tier has ~5 arms like the bigs (too few → per-arm IP balloons).
- **Season / schedule (series-based):** `buildSchedule(teams)` builds a 162-game slate as real **2–4 game
  series** (the whole set played at one venue, `home` = host every game). Matchup counts come from
  `gamesBetween` — **18 per division rival, 8 per same-league team, 2 per mirror-division interleague team,
  0 other interleague** (72 + 80 + 10 = 162; mirror-division means the **same division string** across
  leagues, e.g. both "East"). `seriesPlan(n)`/`SERIES_PLAN` split each matchup into series with a balanced
  host alternation: **18→six 3-gamers** (9/9 home/away), **8→two 4-gamers** (4/4), **2→one 2-gamer**.
  Series are placed greedily at the earliest day **both** clubs are free (tracked per-club in `free[]`, so a
  team's series never overlap and nobody plays twice a day), with an occasional per-club off day after a
  series. Result: ~190–200 days, ~12 games/day, exactly 162/team, ~81 home. (Rarely two same-opponent home
  series land back-to-back, reading as one long homestand — benign.) `padSchedules` keeps MLB and AAA
  calendars the same length. `simDay()` plays both `G.schedule` and `G.aaaSchedule` (~4860 sims/season);
  `enterPlayoffs()` fires at `G.day >= G.schedule.length`. Everything uses `G.schedule.length`, not a
  hardcoded day count, so the variable-length calendar is fine.
- **AAA / minor leagues:** every org runs a AAA affiliate that plays its own 162-game season with the
  same `simGame` engine (it just operates on AAA team objects whose players carry the AAA teamId). AAA
  rosters are younger/weaker (`buildAAARoster`, `meanAdj=-6`; **14 hitters + 5 SP + 8 RP**) and prospects
  develop faster in the offseason. Roster screen has a **AAA Affiliate** section with `↑ up` / `↓ AAA`
  (`callUp`/`sendDown`); the **AAA** tab shows affiliate standings + top prospects. Draftees report to AAA.
- **College league (amateur draft pipeline):** a standalone league of **24 amateur clubs**
  (`COLLEGE_DEFS`, 2 conferences Coastal/Heartland × 3 divisions × 4) at **ids 60–83** (`COLLEGE_OFFSET=60`).
  Team-id namespace is now 3-tier: `isMlbId` (<30), `isAAAId` (30–59), `isCollegeId` (≥60); `levelOf(id)`
  returns MLB/AAA/COL/FA; `teamById` resolves all three. Rosters (`buildCollegeRoster`) are 17–21yo, raw
  (`meanAdj=-12`) but high-ceiling — **amateurs** (`p.amateur`, no pro contract, `p.classYr` = 21−age for
  draft eligibility). A lighter ~50-game slate (`collegeGamesBetween`, `buildSchedule(teams, gb)`) sims in
  `simDay` alongside MLB/AAA; `padSchedules` (now variadic) keeps all three calendars aligned. `flushLevel` /
  `recordSeasonHistory` understand a **COL** level (team labels suffix " (C)"; `teamLabel`), so college stats
  land as COL history rows. **MLB-only filters were tightened from `!isAAAId` to `isMlbId`** (Leaders,
  `leagueWarCtx`, season/career records, payIncentives) so college players never leak into MLB boards. The
  offseason contract loops skip `isCollegeId` players (amateurs don't expire/age contracts); college players
  get the same young-player development boost. The **College** tab (`CollegeLeague`) shows standings, full
  leader boards, and the top-30 draft prospects — clickable names everywhere.
- **Draft pipeline (college + HS → draft):** `buildDraft` no longer generates a fresh class. Instead the
  class = **college declarations** (`collegeDeclarations`: 22+ must declare, juniors ~70%, underclassmen only
  if blue-chip — "declare whenever") who leave school (`teamId=null`, stay `amateur` until drafted, carrying
  their **COL history rows**) + **~16–26 elite HS prospects** (`makeHSProspects`: 17–18, fat ceiling, a
  freshly-generated **HS** stat line via `genHSLine` stored as an "HS" history row — HS is NOT simulated) +
  generic filler only if supply is short (board guaranteed ≥160 for the 150 picks). `refillCollege` restocks
  each school to ~25 with freshmen. The draft `assign` flips a pick from amateur→pro (`amateur=false`, rookie
  contract, `teamId=aaaIdOf(owner)`) and stamps `draftInfo.from` ("College"/"HS", shown in `PlayerModal`).
  In `doProgression`, college players' season stats are reset **without** `mergeCareer` (amateur stats live
  only in history, never the pro career line). `YearByYear` styles COL (violet) and HS (rose) rows.
  **College/AAA playoffs + the FA overhaul are built in later phases.**
- **AI roster management (`aiAlignOrg`):** keeps each org's BEST talent on the big-league club instead of
  buried in AAA. Promotes by OVR while guaranteeing a natural fielder at every position and a 5-man-capable
  staff (≤16 hitters + ≤14 pitchers up, the rest to the affiliate). Called at league gen (all clubs) and in
  `startNewSeason` for AI clubs (after their FA fill, before `trimRoster`/`autoSetLineups`); the user's club is
  left alone so manual call-ups stand. `migrate` runs it once on old saves (guarded by `G._aiAligned`,
  skipping the user). Without it, randomly-generated/aged orgs stranded 70+ OVR players behind MLB scrubs.
- **Defensive positions:** `team.pos` maps playerId → assigned position (8 fielders + one DH). The
  `LineupEditor` is a **drag-and-drop field diagram** (tap a player then a spot, or drag) backed by
  `placeAtPosition`, which glues the position to the player and keeps the lineup a valid permutation
  (bench bat dropped on a fielder takes his batting-order slot). It flags missing/duplicates;
  `teamDefRating` applies an out-of-position penalty and ignores the DH. The Hub shows an end-of-season
  reminder linking to Finances → Contracts when players are in a contract year (`years<=1`).
- **AI draft & team situations:** `teamSituation(G,teamId)` classifies a club's **mode** (Win-now /
  Contender / Retool / Rebuild, from top-13 MLB OVR strength + last-season win%) and its **positional
  needs** (lineup slots / SP / RP under an OVR threshold). AI picks use `aiDraftSelect`/`aiDraftScore`:
  among the top ~15 prospects by `prospectGrade` (so a blue-chipper never slides far), it favors a club's
  need positions and weights by mode (win-now → ready bats/arms by OVR; rebuilders → ceiling/POT).
  `aiDraftPickTrades` (run in `buildDraft` before ordering) does a few value-fair AI-to-AI pick swaps —
  win-now/contender clubs send packages of later picks to **trade up** for an early pick a rebuilder would
  rather flip for volume (logged to the news wire). The **Draft** tab shows the on-the-clock club's
  mode + needs, a mode tag on each pick in the order sidebar, and a collapsible **Team Situations** panel
  (all 30 clubs, mode + needs + strength). `MODE_STYLE` maps modes to colors.
- **Draft picks:** `G.picks` is a flat list of owned, **tradeable** picks (5 per team). `pickValue`
  scales with the original team's projected finish (worse team → earlier slot → more value). The draft
  builds its selection order from owned picks (`G.draftPicks`, by round then orig-team reverse
  standings), so traded picks keep their slot. `Trades` can include players (MLB or AAA) and picks.
  When a prospect is drafted (`assign`), `p.draftInfo = {year, round, overall, by}` is stamped on him
  (shown in `PlayerModal`).
- **Trade market:** a **deadline** (`G.tradeDeadline` ≈ 58% through the calendar) closes the market —
  `Trades` disables proposing past it (banner + disabled button) and the Hub shows a countdown.
  **AI-initiated offers** (`makeAITradeOffer`): each sim-day before the deadline an AI club may pitch the
  user a deal (`chance(0.045)`, ≤2 pending, expire after 12 days), coveting a useful user MLB player and
  assembling a comparable-value package (no single piece worth ≫ the target; total ~0.9–1.15× — fair,
  user decides). Offers live in `G.tradeOffers`; the **Hub** renders Accept/Reject cards. Accept runs
  `executeOffer` (preserves MLB/AAA level, refreshes lineups, logs to the news wire). `startNewSeason`
  recomputes the deadline and clears pending offers.
- **Per-level season stats (`levelStats(p, level)`):** leaderboards, awards, and WAR are computed on a
  player's **MLB-only / AAA-only / COL-only** line, not the pooled `p.stats` — so a mid-season call-up's AAA
  numbers never count toward MLB boards/awards, and vice versa. `levelStats` combines the banked `_levelStats`
  buckets (flushed at each call-up/send-down via `flushLevel`) with the un-flushed current stint
  (`p.stats − _levelSnap`). The MLB `Leaders` and the AAA `Leaders` sub-tab build a per-player level line
  (`S(p)`) over the **MLB+AAA** pool (anyone with stats at that level qualifies, regardless of where he is
  now); `computeAwards` uses `levelStats(p,"MLB")` (and `mvpScore`/`cyScore`/`awardLine` now take a stats
  object). A season split across levels already yields **two year-by-year rows** (e.g. 2027 MLB + 2027 AAA)
  via `recordSeasonHistory`. **WAR is graded per league:** `leagueWarCtx(G, level)` builds the avg wOBA/FIP
  baseline from that level's stats; **MLB, AAA, and College Leaders each have WAR — Position / WAR — Pitcher**
  boards (`warOf(p, ctx, S(p))`). `PlayerModal`'s season-WAR pill uses the player's current level's ctx+line.
- **Postseason & BA Cup stats are separate from the regular season:** playoff and cup games run **real
  `simGame`**, but `bankSeparate(roster, snap, target)` moves the per-game delta OUT of `p.stats` (which stays
  regular-season only) into a career bucket — so they never pollute the regular-season line/leaderboards/
  year-by-year. `seriesGame` banks into **`p.postStats[level]`** (MLB/AAA/COL, via `postBucket(lvl)`), so each
  level's postseason is its own collective career row. The **BA Cup** (`cupGameSim` replaced the old
  strength-only `cupGame`) banks into **`p.cupStats`** — one combined total since the cup crosses MLB↔AAA.
  `YearByYear` renders up to four collective rows under the yearly lines: **MLB Playoffs / AAA Playoffs /
  College Playoffs / BA Cup** (each shown only if the player has games there). `inductIfWorthy` snapshots
  `postStats`/`cupStats` onto HoF entries. NOTE: cup games now use the full sim (~63/season) — slightly
  heavier than the old model but fine; rosters are guaranteed playable by `simDay`'s refill before cup ticks.
- **Per-season history:** every game tags the team a player suited up for into `p._yrTeams`
  (`tagTeam` in `markGamesPlayed` for hitters and at the end of `simGame` for the pitchers who threw —
  so mid-season trades record *both* teams). At the offseason rollover `recordSeasonHistory(p, season)`
  (called at the top of `doProgression`, before aging) pushes `{season, age, ovr, teams[], stats}` onto
  `p.history` and clears `_yrTeams`; `mergeCareer` then folds the line into career totals. `PlayerModal`
  renders a **Year by Year** table from `p.history`.
- **Contracts:** each deal is `p.contract` — a per-year array of guaranteed salaries (cap hits);
  `p.salary` mirrors `contract[0]` (the current-year hit everything reads), `p.years = contract.length`.
  `p.incentives` is a list of off-cap, stat-based bonuses `{stat, need, amount}` (multiple per deal;
  hitting stats for hitters, pitching for pitchers, via `STAT_INCENTIVES`). Helpers: `setContract`
  (install a flat schedule), `ensureContract` (migrate/backfill — also heals empty contracts),
  `requiredAAV`/`willSign` (acceptance; incentives count **½** toward the ask, with a price `factor`
  for hometown discounts), `contractLabel`, `payIncentives`.
  - **Negotiation** runs through `ContractModal` (sign a FA or extend your own: set years + base AAV +
    add incentives, live accept/“wants more” verdict) and `RestructureModal` (defer current-year money
    to later years for a 10% premium). Finances → Contracts has Extend/Restructure; Free Agency has
    Negotiate. `payroll` counts only the base (`p.salary`).
  - **Competitive free agency (`refreshFAMarket` / `processFAWave` / `offerFit`):** AI clubs bid on
    free agents **first**, based on `teamSituation` needs + cap space — `refreshFAMarket(G)` writes each FA's
    `p.offers` (top few) and `p.bestOffer` (interested clubs only, so weak/unneeded FAs get **no bids** while
    coveted ones get many). A player signs the **best FIT** (`offerFit`: guaranteed money dominates, then
    years, then a winner nudge), so a contender can land a guy for slightly less. `processFAWave(G, intensity)`
    is one round of the market moving — rival clubs sign their best-fit targets (they can **steal** someone you
    wanted). To sign anyone, the **user must beat the standing offer**: `ContractModal` takes `bestOffer` +
    `userSit`, shows the competing bid, and only accepts when the user's `offerFit` ≥ the rival's AND the
    player's ask is met. Timeline: `doProgression` opens the market (a light wave + refresh) so offers exist
    before you look; the **Free Agency** tab shows each FA's top offer + a **"Let rivals sign"** button
    (`advanceMarket` → `processFAWave`); `startNewSeason` runs ~6 waves (then a fallback fill) so AI rosters
    fill through the market. Replaced the old "AI signs best affordable" loop.
  - **Money:** incentives are off-cap but real — `payIncentives` (called in `enterPlayoffs`) settles
    earned bonuses and **deducts them from the team's budget** (`t.incentivesPaid`), so the growth
    formula in `startNewSeason` builds on the reduced figure. Each offseason a rostered contract
    `shift()`s a year and expires to FA when empty; **free agents are skipped** (their contract is an
    ask, not a deal in progress).
- **Postseason:** 5 seeds/league (3 division winners + 2 wild cards). Wild Card is a **single play-in
  game** (`SERIES_LEN.wc=1`) between seeds 4 & 5 (higher hosts); the winner becomes the 4th team. Then
  Division Bo5 (**#1 vs play-in winner, #2 vs #3**) → LCS Bo7 → World Series Bo7. Played **game by game** —
  each series is a `mkSeries` object (`hw/lw/games[]`); `playoffSeriesGame` plays one game (2-2-1 home
  pattern), `activeSeriesList` is the round's live series, `buildNextRound` builds the next round once
  they're all decided. The `Playoffs` UI offers **Sim Next Game** (one game per active
  series, with line scores) / **Sim Whole Round** / **Advance**, then crowns the champion → offseason.
- **Economy:** **revenue/budget evolves** at season rollover (`startNewSeason`) — `t.budget` shifts with
  win% (`(wp-.5)*0.45`) plus playoff/championship bonuses, then regresses 6%/yr toward a ~160 market mean
  (clamped 95–290) so a dynasty can't run payroll away forever. `t.budgetDelta` is stored and shown on the
  Finances budget card; the user's change is logged to the news wire. **Waiver wire** (`G.waivers`): cut
  players (in-season user releases via `placeOnWaivers`, plus occasional AI churn via `maybeAIWaive`) sit on
  waivers ~2 days (user has first claim from the Free Agency tab) then `processWaivers` lets AI clubs claim
  in reverse-standings order; unclaimed after ~4 days they clear to free agency. Cleared/flushed each new
  season. ROSTER_CAP and cap space gate claims.
- **Offseason loop:** aging/development toward potential + decline, retirements, contract expiry →
  free agency, `buildDraft()` (5-round amateur draft), then `startNewSeason()` rolls everything over
  (resets MLB + AAA records/schedules, regenerates next year's `G.picks`). Before resetting records,
  `startNewSeason` pushes the finished season into each `team.history` (`{season,w,l,made,champ}`).
- **BA Cup:** a single-game knockout (FA-Cup style) open to **all 60 clubs** — every MLB team AND its AAA
  affiliate — whose rounds are **sprinkled through the regular season** and play automatically as you sim
  (not a manual event). `startBACup` shuffles the 60 ids into a 64-bracket (4 random byes) and assigns each
  of the 6 rounds a target day (`roundDays`, fractions of `schedule.length`: R64→R32→R16→QF→SF→Final).
  `simDay` calls `ensureSeasonCup` + `tickBACup` (plays any round whose day has arrived, catching up if
  several are overdue); `startNewSeason` starts a fresh bracket each year; `enterPlayoffs` calls
  `finishBACup` as a safety so the Cup always crowns before the season closes. Games are scored by a
  lightweight ace-weighted strength model (`cupGame`/`cupPower`) so **cup play never touches league
  stats/records** (career BA Cup stats may come later). State on `G.baCup = {season, roundIdx, matches,
  past[], champion, roundDays}`; winners roll into `G.baCupChampions`. The **BA Cup** tab is informational
  (auto-inits via `useEffect`): current/upcoming round, your club's matchup or knockout round, past rounds,
  past winners. NOTE: champion is a team id (0..59) — all "has a champion" checks use `!= null` (id 0 is falsy).
- **Rivalries:** `assignRivals` pairs teams up (two pairs per division + the odd team gets a cross-league
  mirror-division rival), stored as `team.rivalId`. Shown on the Hub (season series + next meeting) and
  highlighted in the Schedule. Migrate backfills rivals for old saves.
- **History / Hall of Fame:** `G.champions` is the title roll (pushed in `buildNextRound`'s WS case);
  `team.history` holds per-season records. **Championship rings:** when a team wins the WS, every player on
  its MLB roster gets a ring (`p.rings` = array of seasons) in `buildNextRound`. `p.peakOvr` tracks
  career-best OVR; on retirement `inductIfWorthy` adds a snapshot to `G.hof` when `hofScore(p) >=
  HOF_THRESHOLD` (175). **`hofScore` weighs counting stats + a peak-greatness bonus + hardware**:
  `accCount(p,award)` (MVP ×28, Cy Young ×24, All-Star ×7) and `ringCount(p)` (×9) — so a decorated,
  ring-laden career clears the bar that a mere compiler wouldn't. The hof entry stores `mvp/cy/allStar/rings`
  counts for display. `PlayerModal` shows a 💍 ring badge next to MVP/All-Star honors.
- **Records:** `recordFranchiseRecords` (per-club, `team.records`, single-season) runs in `enterPlayoffs`.
  League-wide records live on **`G.records = {game, season, career}`** (each entry `{value, holder, team,
  season}`): `recordSeasonRecords` (single-season bests, PA≥300/OUT≥120 qualifiers) + `recordCareerRecords`
  (best career totals = `career`+live-season, persistent high-water mark so it survives pruning) run in
  `enterPlayoffs`; **game records** are fed live by `updateGameRecords` from `simGame`'s `out.gameLines`
  (a per-player diff vs a start-of-game snapshot `gSnap`) — MLB regular-season (`simDay`) + playoff
  (`seriesGame`) games only, so they fill in **going forward** (no retro). `migrate` carries the old flat
  `G.leagueRecords` into `G.records.season` and seeds `.career` from current players (once, when `G.records`
  is first created). The **Hall of Fame** tab's League Records card has Game/Season/Career toggle tabs.
- **League news / transaction wire (`logNews`, `G.news`):** a persistent, newest-first, capped-250 log of
  notable moves — FA **signings** + extensions, **trades**, **roster** moves (call-up/option/release),
  the user's **draft** picks, end-of-season **awards** (MVP/Cy Young), and World Series **titles**. Each
  entry is `{season, day, phase, type, msg, teamId}`. Hooked in at each action site (FreeAgency, Finances,
  Trades, Roster, Draft, `computeAwards`, `buildNextRound`). The **News** tab (`NewsFeed`, type-filtered via
  `NEWS_META`) renders the full wire; the Hub shows the latest five. Backfilled empty in `migrate`.

## Player model
- **Tracked stats:** hitters `G/PA/AB/H/2B/3B/HR/R/RBI/BB/SO/SB/CS/SF/HBP/GIDP/TC/E`; pitchers
  `G/GS/QS/OUT/H/ER/BB/SO/W/L/SV/HLD/HRA/HBP/WP/BK/GO/AO/TC/E`. **CS** is logged in the steal-fail branch; **QS** (6+ IP,
  ≤3 ER) is credited post-game by diffing the starter's OUT/ER against a pre-game snapshot (`startSnap`);
  **HLD** is credited in `awardDecision` to used relievers in a ≤3-run win other than the winner/saver
  (an approximation — it runs a bit high because relievers rotate ~per inning). Shown in
  `HitterTable`/`PitcherTable`/`PlayerModal` and as **Quality Starts** / **Holds** leaderboards.
  - **Counting stats added in the PA loop (`halfInning`):** **SF** (sac fly: air-out with a runner on 3rd, <2
    outs — runner scores, no AB), **HBP** (≈0.9% of PAs via `paOutcome`, advances like a walk),
    **GIDP** (grounder with a runner on 1st, <2 outs — batter out + lead runner erased, 2 outs recorded),
    **WP**/**BK** (only with a runner aboard, bump every runner up a base, scoring from 3rd), and
    **GO/AO** (every ball-in-play out flagged ground/air via `res.ground` from `paOutcome`). These shift the
    run environment slightly, so rates are tuned modest and `babip` base was bumped 0.300→0.304 to offset the
    HBP carve. Re-verify with a full-season sim (W===L per league; AVG leader ~.330–.355; HR leader ~45–55).
  - **Fielding (`TC`/`E` → FPCT):** `fieldChance(fieldTeamId, pitcher, canErr)` charges a ball in play to a
    fielder by a realistic position distribution (`FIELD_DIST`, resolved via `fielders` = team.pos → player,
    DH excluded). Every ball in play except a HR is a chance (`TC`); on outs the fielder can boot it (`E`,
    prob scales inverse to DEF). **Errors are pure bookkeeping — they do NOT put a runner on or change the
    score**, so the tuned run environment is untouched; only `E` and `fpct(s)` = (TC−E)/TC show on the boards.
  - **Derived rate stats (pure math helpers near `avg`/`era`):** hitting `iso` (SLG−AVG), `babip`,
    `woba` (wOBA-lite, standard linear weights); pitching `kp9`, `bb9`, `kbb`, `fip`. `FIP_CONST` (3.51) is
    **calibrated** so league FIP centers on this league's ERA (~3.9 env) — re-check if the run environment
    shifts. Shown in the `PlayerModal` rate line (per season + career) and as `Leaders` boards (ISO/wOBA/BABIP,
    FIP/K9/BB9/K-BB, plus Doubles/Triples).
  - **WAR (`warOf(p, ctx, st?)`, `leagueWarCtx(G)`):** simplified but calibrated. Position WAR = wOBA-based
    batting runs above average (`wRAA`) + positional adjustment (`POS_ADJ`, scaled by G/162) + a light DEF
    term + replacement runs, all ÷ `RUNS_PER_WIN` (11.5). Pitcher WAR = FIP runs saved vs a replacement arm
    (`PIT_REP_CUSHION` 0.85 R/9) over IP ÷ `PIT_RPW` (9.5). `ctx` carries league-avg wOBA/FIP. **Calibrated so
    league WAR sums ~57% position / 43% pitching, total ~1000** (re-tune RUNS_PER_WIN if the run env shifts).
    Shown as a `PlayerModal` pill (live season WAR + career WAR) and `Leaders` WAR — Position/Pitcher boards.
    Per-season WAR is **stamped into history** at the offseason rollover (`doProgression` computes one
    `warCtx` for the finished season, writes `h.war` on each MLB history row) → year-by-year WAR column and a
    summed career WAR. Old saves' pre-WAR history rows show "—" (fills in going forward, like game records).
- **Franchise records (`recordFranchiseRecords`, `team.records`):** each club's all-time single-season
  bests (team wins; HR/RBI/H/R/SB/AVG by a hitter; W/K/SV/ERA by a pitcher), each `{value, holder, season}`.
  Updated in `enterPlayoffs` (after `computeAwards`, before stats reset) with PA≥300 / OUT≥120 qualifiers.
  Rendered on the **Hall of Fame** tab with a team selector.
- **Prospect rankings (`prospectGrade`):** AAA players + young (≤22) MLB rookies ranked by a scouting grade
  (POT-weighted + current ability + youth), with an `prospectETA` estimate, on the **AAA** tab (top 30).
- Hitters rated CON/POW/EYE/SPD/DEF; pitchers STU/CTL/STM. `computeOvr()` derives OVR; `pot` is ceiling.
- `salaryFor()` scales salary by OVR + age (pre-arb discount).
- **Trade/FA value (`playerValue`):** built on `abilityValue(ovr)` — a steeply **convex** curve
  (≈ 50→3, 65→18, 80→42, 85→67, 92→95) so stars are scarce and you can't bundle scrubs to equal one
  (an 85 ≈ 22× a 50). Value blends current ability with **projected peak** (`ovr + (pot−ovr)·youth`,
  `youth = (28−age)/13` clamped), weighted toward projection for the young — so high-ceiling prospects
  are worth a lot (a 19yo pot-90 ≈ a mid-30s star). Past-prime players take a decline tax; salary is a
  small drag. `pickValue` is tuned to match (a top pick ≈ a blue-chip prospect).
- **Extensions:** `extensionTerms(G,p)` supplies the price `factor` + `refuses` flag for the extend
  `ContractModal` (Finances → Contracts, eligible when `years<=2`). Winning clubs get a hometown
  discount, losing clubs pay a premium, and a star (`ovr>=75`) on a sub-.400 team refuses (wants to
  test FA). Uses a neutral .500 baseline until the team has played ≥20 games. The factor is threaded
  into `requiredAAV`/`willSign` so the displayed discount actually drives acceptance.
- **Talent curve:** rating means sit a bit high and ~8% of generated players get a `+8–18` "star"
  boost to their primary tools (in `makeHitter`/`makePitcher`) for a fat top end. If you bump these,
  re-check the `paOutcome` `hrP` formula — league HR is sensitive to the POW mean × `hrP` slope/cap.
- **HR formula (`paOutcome` `hrP`):** `0.019 + 0.074*(pow−.5) + 0.040*(con−.5) − 0.030*(pitStu−.5)`.
  The **contact term is deliberate** — HR needs power *and* some contact, so a one-dimensional slugger who
  can't make contact no longer leads the league in homers (the old power-only slope let a 58 OVR mash 36 HR).
  Tuned targets (3-seed check): HR leader ~48–53, ~3–6 hitters over 40, no sub-60 OVR sluggers over ~32.
- **Potential & boom prospects (`setPotential`):** `pot = ovr + age-scaled room` (room up to ~24). On top,
  young players (≤22) have a ~3.5% chance to be a **boom prospect** — a raw, low-OVR youngster with a
  huge ceiling (e.g. 55 OVR / 85 POT, gaps up to ~45). Rare, and most never fully realize it, but a
  long-grind star can emerge from the draft/AAA.
- **Retirement (`doProgression`, offseason):** retirement odds are driven by **both age and quality** —
  base ramps with age (`(age-31)*0.06` past 31), reduced for good players (`(ovr-60)/100*1.4`, so a 35+
  vet still ~65 OVR keeps playing) and increased for genuinely bad aging players (`ovr<55` adds
  `(age-33)*0.05`). A stable per-player longevity factor (~0.78–1.22 from the id) adds variety; 44+ almost
  always retire. Replaced the old flat age-bucket table.
- **Development & regression (`doProgression`, offseason):** each attribute shifts by `gauss(center,1.2)`.
  `center` ramps with age — young players climb toward potential (≤23 fastest, growth fades to a ~26-28
  peak), 29-30 gentle decline, 31-33 steeper, 34+ falls off a cliff. Modifiers: **AAA prospects (≤25)
  get +1.2** (develop faster in the minors); a **performance term** (`seasonPerf(p)` → score×weight)
  adds growth for productive young players (so a kid promoted early who rakes keeps developing fast) and
  lets veterans who still rake age gracefully. Young breakouts can raise their `pot`; 29+ erodes it.
  `p._lastDelta` records the OVR change and feeds the **Player Development risers/decliners report**
  shown on the offseason Hub. Tune the `center` ramp / performance multipliers there.
- **Awards (`computeAwards`, run in `enterPlayoffs` before stats reset):** per league it picks a
  **Player of the Year** (`mvpScore`), **Cy Young** (`cyScore`), and **All-Star** team (best at each of
  9 lineup slots + top 6 pitchers). Stored on `G.awards` (current) and unshifted into `G.awardHistory`;
  each honor is also appended to the player's `p.accolades` (shown in `PlayerModal` and surviving
  retirement because award records carry name/line snapshots). The **Awards** tab renders it all.
- **Roster size:** `makeTeam` builds ~30 players (16 hitters = 9 starters + 7 bench; 14 pitchers =
  5 SP + 9 RP). `ROSTER_CAP` (32) bounds offseason rosters; `startNewSeason` AI fills to ~28.

## UI notes
- `HitterTable`/`PitcherTable` take optional `badge` ("ST"/"BN" pill), `bo` (batting-order #, hitters),
  `slots` (per-row labels like SP1/CL, pitchers), `posMap` (show assigned defense, amber if out of
  position), `onName` (opens `PlayerModal`), and action callbacks `onRelease`/`onSend`/`onCallUp`
  (rendered by `RowActions`). `Roster` splits into Starting Lineup / Bench / Rotation / Closer /
  Bullpen / AAA Affiliate using these.
- `Leaders` qualifier thresholds scale with games played (`paQual`/`outQual`); AAA players excluded.
- Player movement helpers: `movePlayer(G,p,destMlbId)` (preserves level), `movePlayerToFA(G,p)`.
- **`PlayersBrowser`** (Players tab): league-wide table of every player with filters (name search,
  team, level MLB/AAA/FA, position, age min/max) and sort (OVR/POT/trade value/age/salary/HR/AVG/ERA).
  Shows a `Val` column (`playerValue`) and a key stat line; names open `PlayerModal`. Capped to 400 rows.
- **`Awards`** tab: current-season MVP/Cy Young/All-Stars per league + an award-history table.
- **Clickable names everywhere (`PlayerCtx` + `PlayerLink`):** a React context provided at `App` root holds
  one `openPlayer(p)` that opens a **single global `PlayerModal`** (rendered at App root, gets `G`). Drop
  `<PlayerLink p={playerObj} text? className?/>` anywhere a name appears — it opens that player's full stats
  (falls back to plain text if no player resolves). Wired into Leaders, Awards (resolves the live player via
  the award record's `id`), AAA prospects, Draft (board + selections), BoxScore (resolves `G.players[pid]`),
  Finances contracts, and the offseason dev report. The older per-tab modals (Roster/Lineup/Players/FreeAgency
  via `onName`) still work alongside it — both coexist.
- **`YearByYear` (shared by `PlayerModal` + `HofModal`):** renders `p.history` with a per-season **honors**
  column (`honorBadges(season, accolades, ringSeasons)` → MVP/CY/AS chips + 💍, deduped) and a **WAR** column
  (`h.war`, MLB rows only). Works retroactively for active players (accolades/rings/history already align by
  season). `inductIfWorthy` now snapshots `history`/`accolades`/`ringSeasons` onto the HoF entry so a legend's
  plaque (`HofModal`) shows full year-by-year + honors (old pre-existing inductees lack these → career only).

## Gotchas / tuning ideas
- Win leader can reach ~25 (a touch high) — tune `awardDecision()` / rotation depth if desired.
- After an auto-simmed offseason the user roster can dip into the low 20s (and rotation below 5 SP if
  starters retire/expire); fill via Free Agency. The sim tolerates short staffs.
- AI trade acceptance: accepts if value received ≥ 0.97× value given (`Trades` component).
- HR distribution is the most sensitive balance knob. Targets after a full season: AVG leader
  ~.330–.355, HR leader ~45–55 with ~6–10 hitters over 40, ERA leader ~1.8–2.2. Verify by simming a
  fresh league to playoffs and checking total W === total L (2430 per league; both MLB and AAA balance).
- **Sim performance:** `simDay` builds a `rosterIndex(G.players)` (team→players) **once per day** and
  threads it (`idx`) into `simGame`/`getPitchers`/`bullpenOrder`/`lineupHitters`/`distributeRuns`/
  `markGamesPlayed` so games don't each re-scan the whole player dict. Sim cost is now ~flat in total
  player count (≈0.5–2 ms/day) instead of O(players × games). If you add a hot per-game helper that needs
  a team's roster, take the optional `idx` and use `teamRoster(players, teamId, idx)`.
- **Unfieldable-roster guard (`refillRoster`, in `simDay`):** over many seasons, call-ups/trades/lopsided
  draft classes can drain a roster (esp. AAA) below what a game needs — a team with no pitcher or <9 hitters
  used to **crash `simGame` mid-day, throwing out of the whole Sim loop and hanging the button forever**
  (this was the real "days take forever / stuck" report, not slowness). `simDay` now checks every MLB/AAA
  club against a playable minimum and refills depleted ones before any game (then rebuilds the index).
- **Player-pool is bounded** so sim speed stays flat across seasons: `startNewSeason` caps AAA rosters
  (`trimRoster(t, AAA_CAP=38)`), sweeps orphaned teamless players (e.g. leftover draft class) into the FA
  pool, then `pruneFreeAgents` (keep best ~220, delete the rest from `G.players`). `migrate` runs a
  one-time cleanup on already-bloated saves (>2800 players). Without this the dict grew +150/yr forever.

## Recent feature additions (2026-06 batch)
- **Hitting & win streaks:** `updateHitStreaks` (MLB regular-season only, fed from `simGame`'s
  per-game `gameLines`, which now carry `pid`/`ab`) tracks each hitter's active streak (`p._hitStreak`,
  career best `p._bestHitStreak`); 15+ logs to the wire (then every 5). League records: `G.records.season.hitStreak`
  + `.career.cHitStreak`, and team `winStreak` (per-season max `t._wsMax`, in franchise + league records).
  Shown in the Hall of Fame League Records cards. `_hitStreak`/`_wsMax` reset each season.
- **Comeback Player of the Year** (`computeAwards`, per league): biggest WAR rebound vs the prior MLB season
  (or a productive return after missing last year, +bonus). Needs prior MLB experience + a real down/lost
  year + ≥3 WAR now. Accolade "Comeback Player" + Awards tab (`cpoy`) + news.
- **All-Star Game** (`playAllStarGame`, fired at the season midpoint in `simDay`): a real-sim exhibition
  (Empire vs Pioneer) on ad-hoc team objects + a custom roster index; banked into `p.asgStats` (like the
  BA Cup) so it never touches regular-season stats. All-Star MVP accolade + news. Shown on the Hub with a
  clickable box score (`BoxScore` gained `box.homeT/awayT` label fallbacks for the ad-hoc teams). `G.allStarGame`.
- **Owner mandate / GM hot seat** (USER team only): `setOwnerMandate` (in `newGame`+`startNewSeason`) sets a
  goal from `teamSituation` mode; `evalOwnerMandate` (in `enterPlayoffs`) grades it — a met/close season
  resets `G.gmStrikes`, only a BADLY missed one adds a strike; 3 straight → `G.gmFired` (the `GMFired`
  game-over screen, checked in `App`). Hub shows the mandate + strike pips. AI clubs unaffected.
- **Hall of Fame voting** replaced auto-induction: on retirement `nominateForHOF` (score ≥ `HOF_BALLOT_FLOOR`
  120) pushes a self-contained snapshot onto `G.hofBallot`; each offseason `runHofVote` grades vote% =
  `hofVotePct(score, yearsOnBallot)` (75+ inducts, 90+ first year = `firstBallot` 💎, lingers ≤6 yrs then
  falls off). HOF tab shows the live ballot + induction vote%/diamond. Inductions hit the wire.
- **Trade rumor mill** (`tickTradeRumors`, in `simDay`, ~few/week within 28 days of the deadline): flavor
  `rumor`-type news driven by team situations + player value (sellers shop vets, buyers scout their top
  need, stars draw interest); a 6-deep `G._rumorRecent` ring blocks back-to-back repeats. New "Rumors" NEWS_META filter.
- **Arbitration + qualifying offers** (`applyArbitration`/`qoEligible`/`qoAmount`/`awardCompPick`/`onFreeAgentSigned`,
  all in the offseason contract loop): under-control MLB players ≤27 get bounded performance-based raises
  (not flat); a good expiring player gets a 1-yr QO (accept = stays; decline = tests FA and his club gets a
  round-2 comp pick in the NEXT draft via `onFreeAgentSigned`, hooked into the AI wave + user sign + fallback fill).
- **Ballparks + park factors:** `makeTeam` assigns `t.ballpark = {name, pf}` from `BALLPARK_NAMES` +
  `parkFactorFor` (30 factors symmetric around 1.0, avg EXACTLY 1.0 → league run env unchanged). `simGame`
  passes the home park's `pf` to `paOutcome`, nudging HR (×1.6) and BABIP (×0.6) — both clubs share it, so
  W/L balance is untouched. `BallparkView` renders an inline-SVG park at the bottom of the Roster tab. Migrate backfills.
- **Varied park shapes + handedness:** `ballparkGeom(seed)` procedurally generates each park's outfield wall
  (seeded by the park NAME → stable): ~50% normal/symmetric, ~35% asymmetric, ~15% quirky (short porch + an
  angular corner). `BallparkView` draws field/wall/grandstand/towers from those points; it also renders in the
  `TeamRosterModal` so EVERY club's park is viewable (not just the user's). `ballparkHand(name)` derives a
  platoon bias from the SAME geometry (RF shorter than LF → `+` favors LHB, LF shorter → `−` favors RHB; ~0 for
  the symmetric majority), stored as `t.ballpark.hand` (migrate backfills). `paOutcome(...,parkHand)` nudges a
  batter's HR by his pull side vs the porch (≤±20%; switch hitters neutral). Hand averages ~0 league-wide so
  total run env + W/L balance stay intact; `parkHandLabel` shows the lean.
- **Game log (scoring-play log):** `simGame` builds `out.plays` — a compact entry per run-scoring event
  `{i,btm,o,b(atter),p(itcher),k(ind),r(uns),hs,as}` (sum of `r` per side === final score, verified) — plus
  `out.walkoff`/`out.finalInning`. WALK-OFFS now end the half early: `halfInning` breaks when the home club
  (bottom 9th+) takes the lead (tiny, symmetric PA effect; W/L balance verified intact). Stored only where
  bounded: the USER's regular-season games (`simDay` gates on `userTeamId`) and ALL postseason games (MLB via
  `playoffSeriesGame`, AAA/college via `simSeriesAuto`, both through `seriesGame` which attaches plays to the
  box). The `BoxScore` modal renders a **Game Log** card (inning arrows ▲/▼, batting club, play description,
  running score, 🎉 walk-off badge) under the line score. Plays live on `box.plays` so all existing
  `setBoxGame(g.box)` call sites just work.
- **Accurate runs scored (R):** `advance()` (+ the SF and WP/BK branches) now credits R to the actual
  runner who crosses the plate (batter on a HR); the old random `distributeRuns` is gone. R now follows
  lineup logic (leadoff/2-hole score most). Verified team R === team runs, league R === league runs.
- **Earned vs unearned runs:** pitchers track `R` (runs allowed) separately from `ER`. `chargeRuns` (in
  `halfInning`) tags a small DEFENSE-dependent share of runs unearned (`ueRate` from `defN[pitId]`, ~6%
  league-wide) — tagging only, so total runs / the run environment are unchanged. ERA & QS now use earned
  runs; the box score shows R and ER as distinct columns. `FIP_CONST` recalibrated 3.51→3.40.
- **Platoon + venue splits:** `simGame(...,recordSplits)` (true only for regular-season MLB in `simDay`)
  accrues each batter's PA into `p._splits` buckets `vL/vR` (pitcher hand) + `home/away`; reset at rollover,
  shown as a table in `PlayerModal`. `obp` now includes HBP/SF.
- **Handedness parks + platoon engine:** `ballparkHand(name)` derives a platoon bias from the drawn
  geometry (RF-short → +favors LHB, LF-short → −favors RHB); `paOutcome`'s `hside` nudges HR by the
  batter's pull side (switch-hitters always get the favorable side). NOTE: an engine-wide platoon HIT bonus
  was tried and REVERTED — platoon-optimized lineups broke the net-neutral calibration and inflated HR. So
  there is intentionally no batter-vs-pitcher-hand hit bonus.
- **Platoon starts (bench usage):** `platoonLineup(team,players,idx,oppStarter)` spells a NON-STAR (ovr<72)
  regular at a platoon disadvantage with a comparable bench bat that holds the edge (≤2 swaps). Gives bench
  bats ~150 PA instead of 0; stars always play so leaderboards are untouched; no engine offense bonus.
- **Steals of 3rd + double steals** added to the steal phase (runner on 2nd; runners on 1st&2nd). Tuned
  conservative — SB leader ~25-35, ~68% success, run env unchanged.
- **Pennant race (Hub):** a Playoff Picture card (from ~45% of the schedule) shows division rank/GB, wild-
  card position, magic numbers, games left, and an in-the-field/outside/clinched badge.
- **Franchise all-time leaders:** `accumulateAllTime(G)` (in `enterPlayoffs`) grows each club's career
  leaderboards (HR/H/RBI/R/SB; W/SO/SV/IP) on `team.allTime`, keyed by player id, capped 25/cat, persistent
  past pruning. Shown on a HOF-tab card (team selector).
- **Jersey numbers + retired numbers:** players carry `p.num` (1-99; migrate backfills). `hofSnapshot` records
  `num` + `primaryTeam` (most MLB seasons); `runHofVote` retires the number with that franchise (`team.retired`).
  HOF tab shows a Retired Numbers wall; the player card shows `#num`.
- **All-Star Game** now also keeps the scoring-play log on its box (`res.box.plays`).
- **Season recap:** `buildSeasonRecap(G)` (in `enterPlayoffs`) snapshots the year to `G.seasonRecap` (user
  record/finish, top hitter/pitcher by WAR, their awards, league leaders, longest hit streak, best record);
  the Offseason Hub renders a recap card. Pitcher leaders use OUT≥300 (starter-level).

## Recent feature additions (2026-06, "depth" batch)
- **Park/league-adjusted stats:** `leagueWarCtx` also returns league OBP/SLG/ERA; `opsPlus`/`wrcPlus`/`eraPlus`
  (100 = avg, park-adjusted at half-strength via `parkAdj(pf)`) shown as player-card pills + Leaders boards.
- **Two lineups:** `team.lineupVsL`/`posVsL` (edited via a vs-RHP/vs-LHP toggle in `LineupEditor`;
  `placeAtPosition` takes lineup/pos keys). `dayLineup`/`posMapFor` use the vs-L lineup verbatim vs a LHP
  starter (else auto-platoon). AI never sets it.
- **Mid-season award races:** Awards tab shows a live MVP/Cy/Rookie "Award Watch" (mvpScore/cyScore/WAR) once >15% in.
- **Player/Pitcher of the Month + monthly splits:** season split into 6 "months"; `tickMonthly` (simDay)
  snapshots + awards via mvpScore/cyScore, stores `p._monthly`, counts `p.potm`/`potmP`. Settings toggle `potm`.
- **Scouting fog:** `scoutConf(p)` (rises with pro games + age; amateurs foggy), `scoutedOvr/Pot` apply a
  deterministic per-id lean × (1−conf). `ScoutOvrPill`/`ScoutPotPill`/`ScoutPot` used in Draft board, AAA
  Prospects, IFA list, player-card header. AI/sim still use TRUE ratings — display only.
- **Trade block + shop:** `p.onBlock` (drives `makeAITradeOffer` ~75%); `shopPlayer(G,target)` returns
  fair-value offers from needy clubs; "Shop a Player" card in Trades.
- **Attendance/revenue:** `t.ballpark.capacity` (market size); `computeAttendance(t)` → fill% from win% +
  recent momentum; the rollover budget evolves from fill (re-centered) → regresses to ~160. Finances shows it.
- **Morale / trade demands / no-trade:** `playerMorale`/`updateMoraleAndStatus` (in `enterPlayoffs`); unhappy
  star (morale≤35, ovr≥76) requests a trade (😤), cornerstone (ovr≥80, 31+, 4+ yr, content) gets a no-trade
  clause (🔒, blocked in Trades). `extensionTerms` factors morale. Pill on the player card.
- **International FA:** `makeIFAClass`/`signIFA`/`aiSignIFAs`; `G.ifaClass` + `t.ifaPool` built in `buildDraft`;
  user signs from the pool (Free Agency "International FAs" card, scouting-fogged) → AAA; AI signs at the
  rollover, unsigned expire.
- **Pitcher types:** `p.gb` (0.30 FB ↔ 0.66 GB, mean ~0.48; migrate backfills). In `paOutcome` sets the
  ground/air split and scales HR (centered → league HR unchanged). `pitcherType(gb)` label on the card.
- **Spring training:** `springTraining(G)` (end of `startNewSeason`) = net-neutral OVR variance for ≤26;
  Hub shows risers/fallers + position battles early each season (`G._springReport`).
- **Manager Mode (opt-in):** `G.managerMode` + `G.tactics{steal,hook}` (Hub card). `simGame(...,tactics)`
  (threaded only into the user's games via simDay) scales his steal rate + starter leash (incl. the
  scoreless cap). AI + run environment untouched.
- **Earned/unearned, accurate R, OBP(HBP/SF), splits, handedness parks, game log, pennant race, franchise
  all-time leaders, jersey/retired numbers** — see the prior batch notes above.

## League rules, difficulty & flavor (2026-08 batch)
- **League rules (`G.rules`, `RULES_DEFAULT`, `rules(G)`):** every commissioner-editable knob in
  one object, read through `rules(G)` so a save that predates a knob always sees a complete set.
  `setRule(G,k,v)` routes **structural** knobs (`STRUCTURAL_RULES`: season length, playoff shape,
  draft order) into `G.pendingRules` mid-season; `applyPendingRules(G)` promotes them at the top of
  `startNewSeason` before the calendar/bracket are rebuilt. `ruleValue(G,k)` reads staged-then-live
  (what the UI shows). Edited from **📋 Rules** in the header (`LeagueRulesModal`, tabs
  Game/Season/Playoffs/Money/Difficulty); starting values also picked on `Splash`.
  - **Season length:** `SEASON_PRESETS` are explicit matchup tables (162/108/72/54), not a scaled
    float, so every preset is an EXACT per-club game count. `gamesForLength`/`leagueGames(G)` feed
    `buildSchedule(teams, gb)`; `collegeGamesFor(G)` scales the amateur slate to match.
    `countScheduledGames` is used by `migrate` to infer which preset an old save was built under.
  - **DH (`R.dh`):** `universal` / `empire` (home park governs) / `none`. With pitchers hitting,
    the weakest bat in `lineups[tid]` is replaced by the `PITCHER_SLOT` sentinel, which resolves at
    each PA to `cur[batId].p` — so a pitching change changes the batter. `pitcherAtBat(p, cache)`
    returns a proxy whose `.stats` points at **`p.batStats`**, kept apart from `p.stats` (whose
    H/BB/SO/R mean the opposite for an arm). The proxy cache is a **per-game Map**, never stored on
    the player — hanging it off `p` made the save circular. `realBatters(tid)` filters the sentinel
    out of every box-score path (gSnap/gameLines/batLine); a pitcher can't share a `gSnap` key with
    his own pitching line. His hitting shows as an "At the plate" card on the player page.
  - **Pace:** `R.extras` (`standard` / `ghost` runner on 2nd each extra half) and `R.mercy`
    (0/10/15 run margin after 7). Both verified W/L-neutral.
  - **Playoffs:** `playoffSeeds(teams, league, n)` takes a field size; `pairRound(alive)` builds a
    generic seeded round giving the TOP seeds byes when the field isn't a power of two (n=5
    reproduces the classic 3-div-winners + 2-WC bracket exactly). `bracketRounds(n)`,
    `roundKeyFor(i,total)` (last round = cs, one before = ds, earlier = wc) and `seriesLenFor(G,key)`
    drive labels and lengths. `G.playoffs[lg]` is now `{seeds, rounds:[[series]], byes}` with
    `po.ri`/`po.nRounds`; `activeSeriesList`/`buildNextRound`/`Playoffs` all keep a **legacy branch**
    for a postseason already in flight from before this change. `R.reseed` re-sorts survivors by seed.
    AAA/college (`runAutoPlayoffs`) intentionally keep their own fixed 5-team shape.
  - **Money:** `capLimitFor`/`capSpaceFor`/`luxuryTaxFor`/`floorShortfallFor`. `capMode` `none`
    (classic per-club budget + the standing `LUX_LINE`), `soft` (spend past `capAmount`, pay
    `taxRate` of the overage at the rollover via `finBonus`), `hard` (never exceed). **Every**
    spending gate — AI FA bids, waiver claims, QO paths, user signings, trade cash — goes through
    `capSpaceFor`. Optional `floorAmount` charges the shortfall.
  - Also: `rosterCap` (26/32/40, read by `trimRoster`/waiver claims), `tradeDeadlineOn`,
    `draftLottery` (weighted lottery over the bottom 12 for the top 4 picks).
- **Difficulty (`G.difficulty`, `DIFFICULTIES`, `diff(G)`):** Casual/Normal/Hardball bundles that
  scale the USER's payroll budget, rival FA bid aggression (`refreshFAMarket` mult), injury
  frequency (`tickInjuries`), AI trade-offer rate, and the owner's patience (`mandateAdj` shifts the
  `evalOwnerMandate` "badly missed" win% thresholds). It changes pressure on the user, never the
  AI's arithmetic. The Difficulty tab lists every multiplier explicitly.
- **Fantasy draft:** opt-in at franchise creation. `startFantasyDraft(G)` nulls every MLB `teamId`
  into one pool (AAA/college untouched — each org keeps its farm); `fantasyOnClock` is a snake over
  a shuffled order; `fantasyAIPick` is best-available weighted by `fantasyNeeds` with guardrails
  (≥9 hitters / ≥5 arms); `finishFantasyDraft` sends the undrafted to FA then runs
  `aiAlignOrg`/`autoSetLineups`. `FantasyDraftScreen` takes over `App` while `G.fantasyDraft` is live.
- **Navigation:** `navGroups(G)` splits the old flat 18-tab strip into 5 sections
  (Club/League/Market/Org/History); phase-only tabs (Draft, Playoffs) fold into their section.
  `groupOf(tab)` keeps the section row in sync when something else navigates. `CommandPalette`
  (⌘K / Ctrl-K / `?`) is a fuzzy jump-to; the key handler ignores events from inputs.
- **Player compare:** `PlayersBrowser` has a tick column (max 4) feeding a compare card that
  highlights the best value per row; all-hitters or all-pitchers get the full stat set.
- **Personalities (`PERSONALITIES`, `personalityOf(p)`):** deterministic from the player id (so old
  saves get one without reshuffling anyone). Pure character — never touches ratings or the sim —
  shown on the player card and scaling how hard a press conference moves that player's morale.
- **Press conferences (`PRESSERS`, `pickPresser`, `answerPresser`):** fires in `simDay` off the
  club's rolling `t.form` (**1 = win / 0 = loss**, newest last) — a 4-game skid, a 5-game run, or a
  slumping star — at most one open at a time and no more often than `PRESSER_COOLDOWN` days. Three
  answers, each a real trade-off between clubhouse morale and `t.fanMood`; the quote hits the wire.
  Toggle under Rules → Game.
- **Bug fixed (pre-existing):** `markGamesPlayed` stored the roster **index object** in `p._lastD`
  instead of the day number, putting a back-reference to every player inside every player.
  IndexedDB's structured clone tolerated the cycle but `JSON.stringify` did not — **Save File and
  the localStorage fallback both threw** on any played franchise. Signature is now
  `markGamesPlayed(home, away, players, idx, day)`; `migrate` sweeps the poisoned values (`_lastDFixed`).
- **Dev gotcha — the service worker caches the bundle.** `sw.js` is network-first but a plain
  reload can still hand you a STALE `index.html` (you'll edit the file, reload, and see nothing
  change — the served bytes are right, the page's are not). When verifying a change in a browser,
  load `index.html?v=N` with a fresh N, or unregister the SW and clear caches first. The headless
  harness is unaffected — it reads the file directly, which is another reason to check logic there.
- **`tools/simtest.js`:** headless harness — extracts the `app-src` block, transpiles with the
  vendored Babel, runs it in a Node `vm` with minimal shims, and publishes the functions listed in
  `EXPORTS` (top-level `const` doesn't become a vm global, hence the explicit epilogue). Checks run
  full simulated seasons: season lengths, W/L balance, DH, pace rules, every playoff field size,
  **save serializability**, fantasy draft, difficulty, pressers, rule staging. `node tools/simtest.js`
  for all, or pass a check name. Add a case to `CHECKS` when you add a rule.
