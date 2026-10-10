# Pocket GM — Hockey

Single-file React hockey-manager game (sibling of `~/soccer-gm` and `~/baseball-gm`). You run a
club in a 32-team, two-conference, four-division league: set the four forward lines, three
defence pairs and your goaltending, work the hard cap, sim the season, and chase the Cup.

**This repo is also the guinea pig for a daily autopilot.** A GitHub Action runs every morning,
picks one item off `ROADMAP.md`, builds it, and commits to `main` — but only if
`tools/simtest.js` still passes. See "The daily autopilot" at the bottom.

## On a phone
It's a PWA: `manifest.json`, icons, `sw.js` and the iOS meta tags are all in place, so Add to
Home Screen gives a standalone app. Two things to know:
- **`sw.js` uses paths relative to its own scope**, so the same file works at a domain root, under
  a `/hockey-gm/` subpath, or off a LAN address. soccer-gm hardcodes `/soccer-gm/` and breaks
  anywhere else — don't copy that.
- **The Babel output is cached in localStorage under a hash of the app source.** Transpiling ~5,000
  lines every load is fine on a laptop and painful on a phone (421ms → 165ms on desktop, far more
  on device). The hash means editing the source invalidates it automatically; there is no version
  to remember to bump. Older builds are deleted before a new one is written.
- A service worker needs HTTPS, so offline only works from a real deployment, not from a
  `http://192.168.x.x` LAN address.

## Run it
- One static file: `index.html`. Serve the folder —
  `python3 -m http.server 8142 --directory ~/hockey-gm` → http://localhost:8142 — or open it
  directly.
- Registered in `~/.claude/launch.json` as **hockey-gm** (port 8142) for the preview tooling.
- No build step. React 18 + Babel-standalone + Tailwind, all vendored under `vendor/`.

## Architecture
- The app lives in a `<script type="text/babel-src" id="app-src">` block; an inline script at the
  bottom does `Babel.transform(src, {presets:[["react",{runtime:"classic"}]]})` then `eval`s it.
  The **classic** runtime is required — the default preset emits an ESM `import` that breaks in a
  non-module inline script.
- **State:** one `G` object in `App` `useState`, persisted per save-slot in localStorage. Shape
  changes go in `migrate(G)` rather than bumping the save key.
- **Randomness:** everything routes through `rnd(G)`, a seeded PRNG stored on `G.seed`. Never use
  `Math.random()` in engine code — the harness relies on the same seed replaying the same season.
- **World:** `TEAMS` (32 clubs, four divisions of eight, `DIV_CONF` maps division → conference).
  A club is its index into `TEAMS`; `G.teams[i]` carries the record and the lineup.
- **Players:** `G.players` keyed by id. Skaters carry `SKATER_KEYS`
  (sht/pss/hnd/spd/dfn/phy/fo/sta/dur), goalies carry `GOALIE_KEYS` (rfx/pos/reb/sta/dur), and
  `ovrOf(p)` weights them differently per position. `p.season` is the live stat line, `p.stats`
  is last season, `p.career` is the archive.
- **Calendar:** `buildSchedule(G)` runs the circle method over all 32 clubs to decide **who plays
  whom**, a running `homeCount` to decide **who is at home**, and then spreads the fixtures across
  a real calendar of roughly `len * CAL_DAYS_PER_ROUND` days — an 82-game season runs ~176 days,
  so clubs have off nights and back-to-backs mean something. Two details are load-bearing:
  fixtures are placed by their index in the whole list, **not** by round (anchoring on the round
  drops all sixteen of a round's games on one night), and each round's fixtures are **shuffled**
  first, because the circle method has a fixed point — club 0 never moves — and without the
  shuffle every club lands in the same slot every round and every rest gap comes out identical.
  Three nights in midwinter are reserved for the All-Star break (`G.allStarDay`).
- **Rest:** `restFor(G, teamId)` reads `G.lastPlayed`. 0 means a genuine back-to-back, which costs
  a few percent of everything and pushes the backup goalie into the net.

## The match engine
This is deliberately NOT soccer-gm's xG model. Shots are generated per **line-vs-line matchup**,
which is what makes line construction and last change matter.

- `simGame(G, home, away, opts)` splits ~47 even-strength minutes across the four forward lines
  (`LINE_TOI`) and, for each, across the three opposing defence pairs (`PAIR_TOI`). Shot rate for
  a matchup is `(30.5/60) * lineOff(forwards) / unitDef(oppForwards, oppPair)`, times `momentum`
  (from a fight) and `legs` (from rest).
- **The unit on the ice is five skaters.** The forward line is joined by one of the side's own
  defence pairs, drawn by ice-time share. Without this, defencemen never shoot — they used to
  appear only in the *defensive* unit, and took 5% of shots instead of ~29%.
- **Ice time is per player, not per line.** Each player on the ice gets the full shift length. It
  is not divided among linemates — that bug made a first-liner look like a 4.7-minute player.
- **Last change:** at home, line 1 is skewed toward the opponent's third pair (`share *= 1.28`)
  and away from their first (`0.78`). That is the whole home-ice advantage — there is no flat
  bonus anywhere.
- **Line chemistry:** `lineChemistry(t, lines)` tracks, per forward line, how many consecutive
  games it has played with the same three players (`t.lineChem`/`t.lineSig`, capped at
  `LINE_CHEM_MAX_GAMES`) and is called once per side per game in the even-strength loop, which
  both reads the current streak and advances it. It feeds a small `lineOff` multiplier
  (`LINE_CHEM_PER_GAME`), so shuffling a line every week costs real offence. `pairChemistry(t,
  lines)` is the same idea for defence pairs (`t.pairChem`/`t.pairSig`, `PAIR_CHEM_MAX_GAMES`),
  feeding a `unitDef` multiplier (`PAIR_CHEM_PER_GAME`). Both are computed for each side **before**
  either side's shots are resolved, in their own pass at the top of the even-strength loop — a
  defending pair's continuity has to be known (it belongs to the *opponent* of the side generating
  shots) before that opponent's shot rate is calculated, so the two can't share the single
  attacker-only pass `lineChemistry` used alone.
- **Shot zones (`SHOT_ZONES`, `pickZone`):** every shot picks a zone first — rush, cycle or point
  — and the zone decides both *who* shoots (`dBias` makes the point a defenceman's shot) and *how
  stoppable* it is (`save` offsets the goalie's percentage). Conversion must stay ordered
  rush > cycle > point; the harness checks it.
  **The zone mix is NOT a league constant — it's an argument between the two units on the ice.**
  Speed up front turns pucks into rush chances, a defenceman who can shoot drags play out to the
  point, and a quick sound defensive unit denies the middle (less rush, more point against). It
  used to be fixed probabilities, which meant every club's shot map was the same shape and only
  the volume moved — a team's "for" and "against" maps looked identical. The harness now pins the
  spread across clubs AND the causal correlations (fast forwards → rush r>0.3, shooting D → point
  r>0.3, sound defence → less rush conceded r<-0.3), so flattening this back out will fail.
- **Attempts vs shots on goal. One attempt, one outcome.** `resolveShots` loops over ATTEMPTS, not
  over shots on goal: each attempt independently either hits a shin pad, sails wide, or reaches the
  goalie (~24% / 21% / 55%). `shots` is the number expected to reach the net, so the loop runs
  `shots / pOnGoal` times. It must NOT generate an on-goal shot and then invent a blocked and a
  missed sibling around it — that's what it used to do, and it meant one chance produced up to
  three records, so a player's shot chart drew three dots for one shot. **Blocks are real**,
  credited to an actual defenceman from `defIds`, which is why `blkd` and `blk` reconcile
  league-wide; with no defenceman modelled on the ice the attempt becomes a miss rather than an
  uncredited block. The invariants are `sog + miss + blkd === att` and one log record per attempt.
- **Net placement (`NET_CELLS`, `pickCell`, `goalieHole`, `shooterSpot`).** Every shot on goal is
  placed in one of nine cells, the shape of a penalty placement chart. **The table is calibrated
  against public NHL shot-target work, not invented**, and the point is that shots and goals pull
  in opposite directions: most shots are aimed LOW (the 3/4/5 holes), but about **67% of goals go
  in above the pads**, with top glove ~21%, high blocker ~15% and the five-hole ~14%. So each
  cell has a `w` (how often it's aimed at — low-heavy) and a `save` offset (how stoppable it is —
  top corners lethal). The engine reproduces this to within a point or two; the harness pins the
  shares, so **do not "simplify" the table without re-checking them**.
  **Shooters scout the goalie.** `pickCell` takes the keeper and boosts his `goalieHole` cell,
  harder for a player with hands. This is what makes a club's CONCEDED net map its own: without it
  placement depended only on the shooter, so every club's against-map was the league average and
  looked identical to its own. Every club now concedes above-average volume at its starter's hole
  (median +3 points); the harness pins it.
  A shooter bends the base distribution three ways: hands (can he elevate?), handedness
  (`p.shoots`, ~62% left league-wide — the real cause of the glove-side bias, since left shots come
  off the right wing), and `shooterSpot`, a favourite corner fixed by his id so no two charts look
  alike. **Every goalie has one permanent hole** from `goalieHole`. Placement is chosen *before*
  the save roll and genuinely affects it, which is why the save clamp runs to 0.55 — a top-corner
  shot has to be allowed to be nearly unstoppable. Empty-net goals get no placement, so the
  invariant is `sum(net[k].a) === sog - eng`.
- **League rates are calibrated and pinned:** ~.903 save percentage, ~9.6% shooting, ~30.5 shots
  on goal per team-game, ~3.1 goals. The harness asserts all four against real NHL bands, so a
  change to shot rates that quietly inflates scoring will fail rather than drift.
- `resolveShots` turns shots into goals against a goalie's save percentage
  (`0.9032 + (quality - 55) * 0.0016 - tired * 0.015`, plus the zone and net-cell offsets, clamped
  to .55–.99 — the wide low end is deliberate, so a top-corner shot can be near-unstoppable),
  and assigns 0–2 assists weighted by `pss`. Even-strength goals move `+/-` on both sides. Per-zone
  shots and goals are recorded on both the shooter and the goalie (`s.z` / `blankZones`).
- **Special teams** run separately: penalties drawn → PP minutes at a much higher shot rate,
  with a small chance of a shorthanded look the other way.
- **Goaltending:** `pickStarter` hands the net to the backup when the starter is worn down or it's
  a back-to-back — with a higher fatigue threshold when the backup is much worse. Goalies gain 14
  fatigue a start and shed 4.2 a day, which produces roughly a 55/27 split over 82 games.
- **The last two minutes:** trailing by one, the goalie comes out. Six-on-five can tie it, or the
  puck goes the other way — and an **empty-net goal has no goalie behind it**, so it adds to the
  shooter's `sog` and `eng` but charges no save opportunity. The invariant is
  `sum(zone shots) + eng === sog`.
- **Overtime:** in the playoffs, and whenever the shootout is off, OT loops `resolveShots` until
  somebody scores, so every goal has a scorer. `runShootout` is three rounds then sudden death,
  `hnd` against `rfx`, tracked in `sos`/`soa` and `sosa`/`sosv`. The **shootout is the one goal
  nobody is credited with** — the team's score goes up and no skater's total does, exactly as in
  real bookkeeping. The harness accounts for this; don't "fix" it by crediting a player.

## The population
**Seven rounds was the root of almost everything.** 224 players a year into a league that lost
nowhere near that many: over ten measured seasons the save reached **4.94 MB** (past what
localStorage holds), average age fell **26.0 → 22.4**, players over 32 went **126 → 7**, and orgs
jammed so hard that `enforceRosterLimits` released solid cheap veterans to fit 42-rated draftees.
Four changes, measured over fifteen seasons:

- **`DRAFT_ROUNDS` is 3.** Ninety-six a year is a pipeline the league can absorb.
- **`retirementChance` is reachable before 32.** A player past `NEVER_MADE_IT_AGE` with under
  `NEVER_MADE_IT_GAMES` NHL games and no ability stops — he was accumulating in the pool into his
  thirties taking up a place he was never going to earn. The old age curve is untouched.
- **`FA_POOL_HARD`** — the 200-game protection on the free-agent cull has to be able to lose. So
  many players qualified after a decade that the cap stopped binding at all and the pool reached
  575 against a limit of 150. Past 1.6× the limit only the Hall, a trophy or a ring saves you.
- **`FA_MARKET_FLOOR`** — and clubs stop before the market is bare. At three rounds the AI signed
  the pool down to ONE player and there was nothing to sign all year; past the legal minimum a club
  now only signs what improves it.

Result at fifteen seasons: average age **25.6**, 82 players aged 33+, save **3.52 MB** and nearly
flat, a live market of 20–45 free agents. The `population` check pins all of it.

**`keepScore` replaced `ovr + pot * 0.5` in the roster trim.** That formula valued a raw
eighteen-year-old's ceiling above a useful player's present, so clubs released a 62-rated man who
could play to keep a 46-rated ceiling — over a decade it shreds exactly the cheap established depth
a roster is built on. Now: what he is, what he might become, **what he costs**, and whether he has
actually played. **`deferPicksIfFull`** is the other half — a club with no room pushes its picks a
year forward rather than drafting players it must then cut.

## Career and ownership
Behind the `ownership` rule, off by default. The whole game was played from a chair somebody else
could take away, and a twenty-season career had nothing to show for itself but a trophy count.

- **You are paid.** `gmSalaryFor` runs off market size and `gmLegacy` (cups dominate; rounds and
  seasons accumulate; being sacked costs you), banked by `payGm` at the rollover. A contract
  expires and the next offer is what your record says you're worth — it sits in `G.gmOffer` until
  you sign it.
- **A club costs far more than you earn, on purpose.** `teamValue` runs $50–110M against a first
  salary near $2M. The route in is a MINORITY STAKE alongside other investors, and from there you
  buy them out one slice at a time — **the last slice is always dearest**, because the man holding
  it knows exactly what it's worth to you.
- **`sellWillingness` is derived from the club id**, so an owner who never sells never sells. It's
  nudged by losing and by market size: the club that comes up is the struggling one in the small
  market. An outright sale is a once-a-decade event; groups forming are the common way in.
- **A majority owner cannot be sacked** — that is what the majority is for. A MINORITY owner faces
  an owners' vote instead, and `ownerVoteChance` falls as his stake rises: a stake buys patience,
  not immunity. Owning nothing means no vote at all, because the board simply sacks you.
- **`standDown` / `takeBackTheJob`** — an owner doesn't have to run his own club, and can take the
  job back whenever he likes. That is the whole difference between owning the place and working
  there.

## The development curve, and what it inflated
Traced on a single draft class run through `progress` with **no games played at all**
(`scratchpad/curve.js` — one second, and it settles the question):

| | old | now |
|---|---|---|
| past his own ceiling by 25 | 64 of 96 | ~5 of 96 |
| `pot` across the cohort | 65.4 → **72.0** | 65.4 → 66.4 |
| cohort peak vs drafted ceiling | **+6.5** | −0.6 |

The cause was a flat `+2.4` added every year to anybody under his peak whether he had anywhere left
to go or not, and `p.pot = Math.max(p.ovr, …)` ratcheting the ceiling up behind him. Now the GAP
does the work — `DEV_BASE` 0.35 plus `head × DEV_GAP_PULL` (0.22, well up from 0.135) — so a raw
draftee with 27 points to travel gains six a year, **faster than the old curve ever moved him**, and
a man who has arrived stops. Ice time is scaled by the same headroom (`DEV_HEADROOM`), which makes
minutes the biggest single term in the function rather than a garnish on a flat number.

Two related fixes: **`leagueLevel`** — both retirement tests compared a rating to a FIXED figure, so
every point the league drifted pushed more players under an unmoving bar, and culling the weakest
raised the average again. They read against the league now, written so year one is identical. And
**a goalie peaks at 27, not 28** — two extra climbing years put a goalie cohort 2.2 points above the
skaters it was drafted with, amplified by there being 64 goaltending jobs against 672, which is why
save percentage climbed .898 → .909 while goals slid 6.08 → 5.52.

**What is NOT fixed, measured rather than guessed.** The league still rises about 9–11 points over
its first dozen seasons and then plateaus. That is not a runaway — it is a STARTING-CONDITION
mismatch: `newGame` generates ~872 players and the simulation sustains ~1120, so the NHL is picking
the top 736 of a pool that keeps growing until it fills. Fixing it properly means generating the
initial league at the population and quality it actually holds, which moves every year-one
calibrated number and needs its own measured pass.

**And the cap has never bound.** Year one, before any development whatsoever: mean payroll **$35.0M
against an $88M ceiling and a $66.9M floor — all thirty-two clubs under the floor**
(`scratchpad/cap.js`). This is pre-existing and was masked: the old inflation carried salaries up
into the cap by about year twelve, so it *looked* calibrated in a long save. `capAmount`,
`CAP_FLOOR_PCT` and `marketValue` need matching to each other, and that is the next real job.

## Names, numbers, and the papercut scan
`scratchpad/papercuts.js` — things that aren't broken, just irritating. After ten seasons it found
duplicate names inside one dressing room, two clubs employing a coach with the same name, and no way
to tell apart the two "O. Côté" on a roster screen.

- **`NAMES` is per-nation.** One pool of 54 first names and 60 surnames gave 3,240 combinations for a
  league that churns fifteen hundred players. Players already had a nationality (`nationOf`, derived
  from the id for the tournament), so the name comes from the same place: **16,000 combinations**,
  and a Finn who sounds Finnish instead of a Russian called Cole Mackey. `genPlayer` still makes
  exactly two draws, so no seed shifts. Coaches went 320 → 2,500.
- **`sweaterOf` / `sweaterMap`.** A number derived from the id, never stored, so every player in an
  existing save has one for free. Weighted toward the numbers players actually wear. Collisions and
  retired numbers are resolved per club at read time — lower id keeps it — so nothing is persisted
  and it stays stable. It also settles the duplicate-name papercut: two men with the same surname
  are now visibly different on the roster screen.

## Relocation and the building
`MARKETS` / `relocationOptions` / `relocate`, needing a controlling interest — a minority holder does
not get to move a club out of its city, and neither does a manager. A bigger market pays for ever
(`t.mkt` drives the gate and the club's value), and the cost is the point: you leave **the arena you
paid for** (`t.invest.arena` resets), **the city's goodwill** (`fanMood` drops to 35 — a new town has
to be won over), and **the rivalry**, because a rivalry is two places and not two badges. `t.movedFrom`
remembers the abandoned city so it never gets another club.

The arena investment now goes to five levels rather than three and does two things: the gate, and
`homeEdge` — a building an owner has poured money into is a louder one, worth a fifth of the base
home advantage at the top level, and only ever yours.

## The anomaly scan
`scratchpad/scan.js` — not "is the save consistent" but "does any of this look like hockey".
Distributions and outliers across a long save, checked against real NHL ranges. It found four:

- **Somebody averaged 30 to 42 minutes a night in every single season.** `autoLines` ended its
  fallback chain at `|| ds[0]` and `|| r[0]`, so a club short at a position put its best man in TWO
  SLOTS AT ONCE — and because everyone on the ice is on for the whole shift, he collected both sets
  of minutes. Replaced with an allocator that can't reuse anybody: a slot goes to the best man who
  plays there, then the best forward left over (a centre plays the wing, as they do), and failing
  that stays empty. Ice time now runs 7.5 to 24.0 instead of 1.7 to 42.5.
- **Seventeen of thirty-two clubs couldn't ice a legal forward group** — one carried nine centres
  and six wingers for twelve slots — because `aiFreeAgency` asked about goalies and defencemen and
  nothing else. It reads `DRESS_MIN` now. And `DRESS_MIN` itself asked for ten forwards when four
  lines need twelve; four of each is twenty, which is exactly `ROSTER_MIN`, so the two numbers
  finally describe the same team.
- **`t.pp` and `t.ppg` were counted every game and never read by anything.** The two numbers a fan
  checks after the score were computed for every game ever played and binned. They land on the club
  now, with the kill derived from the opponent's, and both are in the standings: 17.8% and 82.3%
  league-wide, summing to 100 because they're the same events from both ends.
- **The scoring tail was being carried by the double-shift defect.** With it fixed the league had
  ONE hundred-point scorer a year against a real one to fourteen, and the assist leader finished
  below the goal leader. `LINE_TOI` was 30/27/24/19 — a first-to-fourth ratio of 1.6 where the NHL
  runs 2.1, tuned when a star could be double-shifted. At 34/28/22/16 a first line plays sixteen
  minutes instead of fourteen and the tail comes back: four 100-point scorers, assist leader clear
  at 76.

## The audit
`node tools/simtest.js audit`. Every other case tests one feature on a fresh league; this plays a
real career — twelve full seasons on Deep with the club running itself, then eight more — and asks
whether the **save** is still coherent. Referential integrity (no dangling ids, nobody on two
rosters, no dead money owed by a club that doesn't exist), league legality, history that kept
growing and agrees with itself, the record book, and the growth SLOPE.

It found three things a feature test structurally cannot:

- **The save grew without a ceiling.** `pruneSave` kept every "honoured" player for ever, and a Cup
  decorates twenty-three men every spring — 476 retired players by season twenty and **2.5 → 5.4 MB,
  past what localStorage holds around year seventeen**. The Hall and retired numbers are permanent
  now; a ring, trophy or medal keeps a man for `HONOUR_YEARS` (30) and then lets him go, by which
  point nothing on any screen names him. 5.40 → 4.10 MB at twenty, and the slope flattens.
- **THE LEAGUE INFLATES.** Average NHL overall runs 62 → 75 across twenty seasons, and goalies
  inflate faster than skaters (62 → 82 against 62 → 75) — which is why goals per game slide 6.08 →
  5.62 and save percentage climbs .898 → .906 while shot volume stays flat. The inflation itself is
  still there and is the next thing worth looking at; what's fixed is the damage it did.
- **…which had already broken the board.** `teamStrength` is a plain average of overall, and
  `setMandate` compared it to FIXED numbers (73 for the Cup). By about year twelve every one of the
  thirty-two clubs cleared the bar, so every club in the league was being asked to win the same Cup.
  `strengthRank` reads a club against the other thirty-one instead — "top two", "top seven" — which
  survives any amount of inflation. Verified in year twenty: five clubs asked, ranks 0–4.

## A club that runs itself
`autoManage` was a boolean that reached exactly TWO routines — AI extension offers and the AI
free-agent sweep. Every other thing an AI club does for itself explicitly skipped the user, so a club
left to run itself never made a deadline trade, never sold a rental, never answered a demand and
never touched the cap floor. Measured over three leagues and twelve seasons it ran **55 points in the
first half and 10 in the second** while the payroll withered to $18M. That is not a club managing
itself badly; it's a club with most of its hands tied.

**`aiRuns(G, teamId)`** is now the single gate all of them ask. And the setting is no longer on/off
but an INSTRUCTION — `AUTO_STYLES`, four real strategies with real costs:

| | deadline | keeps | dresses | spends |
|---|---|---|---|---|
| Balanced | reads the table | everyone equally | best available | to the ceiling |
| Win now | always buys | veterans (`keepVet` 1.6) | the men | to the ceiling |
| Build | always sells | its own kids (`keepKid` 1.4) | the kids | 0.85 |
| Frugal | reads the table | almost nobody | slight youth lean | 0.79 |

`styleFor` returns the balanced numbers — all 1 — for **every club but yours**, so switching a style
on cannot move the league around you. There is a check for exactly that.

Measured, three leagues × twelve seasons, points in the first half vs the second:

| | early | late | finish | age | U24 | payroll |
|---|---|---|---|---|---|---|
| nobody managing | 55 | 10 | 28.8 | — | — | $18M |
| Balanced | 94 | 87 | 15.0 | 24.9 | 13 | $72.8M |
| Win now | **98** | 85 | 14.7 | 26.4 | 12 | $75.6M |
| Build | 94 | **88** | 15.0 | 22.9 | 18 | $77.8M |
| Frugal | 90 | 89 | 15.9 | 23.4 | 18 | $72.9M |

Win-now is front-loaded and gives it back; building is flat and young. **Frugal does NOT bank the
difference** — it earns less than the others, because a club that isn't good enough doesn't fill its
building either. The blurb says so rather than pretending otherwise.

Three things the runs caught that a unit test never would:
- **A single `extend` multiplier made "build" let its own prospects walk** alongside the veterans, so
  it measured OLDER than the win-now club. Split into `keepVet` / `keepKid`: who you keep IS the
  strategy, how many you keep is just a budget.
- **`dressRank` had to reach three places, not one.** Setting the lineup wasn't enough — the roster
  trim sorted on raw rating and sent the kids straight back down, and the free-agent sweep signed the
  best rating available, so a building club shed its own veterans and then signed everyone else's.
- **`spend` gated only free agency**, so a frugal club re-signed its way past the budget anyway and
  ended up spending MORE than one told to contend. It gates extensions too now. And a ceiling below
  `CAP_FLOOR_PCT` is inert, because `enforceFloor` signs the club straight back up — which is exactly
  how frugal measured identical to balanced the first time.

## What thirty simulated years found
The ownership layer shipped, and then got played — thirty seasons, buying whatever was affordable.
It failed in four separate ways, none of which a unit test would have caught.

- **A stake earned nothing.** The only income was the GM salary, so a career banked $2.4M a year
  against slices priced at $26M and NEVER REACHED A MAJORITY: six clubs held at 15% after thirty
  seasons, control of none of them. `clubProfit` / `payDividends` fix it — a yield on what the place
  is worth, scaled by how it's actually run. A winning club clears real money, a losing one at the
  cap LOSES it and every owner pays his share, so the stake compounds and buying into a badly run
  club is the mistake it should be.
- **The slices were too big.** 45% of the remainder in one lump meant thirteen years of saving with
  no partial progress. A quarter buys a step every few years — a takeover you creep up on.
- **You could own six clubs, and manage a seventh.** The run ended holding pieces of both sides of
  a playoff series while working somewhere else entirely. `buyStake` now allows the club you RUN,
  a slice at a time — plus the one exception of a club going in its entirety, which you can take on
  from anywhere and then go and run.
- **There was nothing to DO with a stake.** You bought it and the game carried on identically.
  `DIRECTIONS` (rebuild / compete / win now) is the thing an owner actually decides: it costs
  something real either way — a rebuild develops kids fast, empties the building and has to overpay
  to sign anyone; going for it fills the place and signs cheap and stops anyone young learning —
  and **an owner is not judged by his own board**, so `setMandate` returns the course he chose.
  `INVESTMENTS` (building / facility / scouting) is where career earnings turn into hockey.

After: first stake year 7, majority year 25, outright by 30 on a winning club — and on a losing one
it stalls, which is the point.

## Brought over from the sibling games
`~/soccer-gm` and `~/baseball-gm` are the same architecture; these are the ideas worth having here,
written for hockey rather than translated knob-for-knob.

**Press conferences** (from soccer, where it's the best thing in the game). Behind the `pressers`
rule. Everything a manager does here he does through a spreadsheet; this is the one place he has to
say something out loud and then live with it. Three constituencies who want different things: the
room wants backing, the board wants accountability, and **the building** — `G.fanMood`, which is
new, feeds `gateFor`, and is exactly 1.0 at neutral so a club that never opens its mouth takes the
gate it always did. Triggers are hockey-native: a losing run, a winning run, a rivalry game next,
a man who's asked out, and a goalie whose save percentage has cratered. `pickPresser` **draws
nothing** — it reads club state and returns the first thing worth asking — so switching it on
mid-career cannot shift a downstream number.

`addRoomHit` now accepts NEGATIVES (clamped -20..40) so backing the room in public is credit rather
than the absence of a debt, and `decayRoomHits` fades by magnitude. Nothing else in the game ever
passes a negative, so a club with the rule off sees the identical number.

**Streaks** (from baseball). `p.streak` / `p.bestStreak` for points, `t.wsMax` for a club's longest
winning run — the live `t.streak` was erased by the next loss, so fourteen straight in November left
nothing behind by April. Both go in the record book (`pointStreak`, `winStreak`), which needed them
outside `RECORD_DEFS` because neither lives on a stat line. Zero RNG; pure accounting off results.

## The world tournament
Behind the `worldCup` rule. Every fourth winter the midwinter break belongs to the countries
instead — there is no All-Star game that year, which is what the league actually does.

**Nationality is derived, never stored.** `nationOf(p)` runs `hashUnit(p.id)` against a weighted
table, so all fourteen hundred players in an existing save get a country for free: no save size, no
draw, no migration, and the same answer every time. The weights are the shape of the sport, which is
what makes an upset an upset.

Squads come off the season to date (`worldSquad`), so a hot winter is worth something beyond the
standings. Eight nations, straight knockout, seeded by `squadStrength`; no game ends level. Medals
land on `p.medals` and survive `pruneSave` — a gold medallist counts as `honoured` even if his club
career never amounted to anything. `G.worldCups` keeps every tournament ever played, like the drafts.

## Pulling the goalie
`PULL_TIMINGS` + `t.pull`. The engine already resolved the last two minutes — at one fixed pair of
odds for all thirty-two clubs, which is the one moment of a game where coaches most visibly differ.
`normal` IS the old pair (0.17/0.45), the draw stays exactly where it was and there is still exactly
one of it, so only the thresholds move and every calibrated seed replays unchanged. Measured over a
season: 118 empty-net goals against on `early`, 70 on `late`.

**The AI's derivation sits behind `coachStaff`** — thirty-one benches all calling it differently
moves the league's goal totals, and three realism checks caught exactly that. Your own choice always
applies, because you asked for it.

## The third club
`brokerTrade`. The deal that dies at the cap: you have the pieces, they have the piece, neither of
you can fit the contract, so the best player available at the deadline goes nowhere. In real hockey
somebody else eats the money — which is the only reason a bad team's cap space is an asset.

It reuses everything that already exists. The broker's share is an ordinary `G.retained` row stamped
with HIS club id, so `effectiveCap` discounts the contract and `capHit` charges him for it with no
new accounting anywhere. **The row goes on the books BEFORE `evalTrade` runs** — that's the point,
since the deal only clears the cap because of it — and is spliced straight back off if the two clubs
still can't agree. `brokerCandidates` ranks clubs by fee; the further from a playoff place the
cheaper they are, because this is a favour a contender never does. The fee is quoted in trade-value
points and settled in picks.

## Bonus money
Behind the `contractBonuses` rule. A contract was an amount and a term, and both of those are just
cap. The two shapes that matter are the two that cost a club something other than money.

- **Signing bonus** (`p.contract.sb`, a fraction of the deal). He takes a smaller cap hit for it —
  guaranteed beats promised — and `buyoutCost` applies its third to the SALARY only, with the bonus
  owed in full. Cheaper today, welded to you for ever. That is the whole trade.
- **Performance bonus** (`p.contract.pb` = `{amt, kind, need}`). He takes less base now and gets
  paid if he does the thing. Restricted by `canPerfBonus` to players 23 and under or 35 and over,
  because a league where everyone defers salary into bonuses is a league with no cap. `settleBonuses`
  runs at the top of `finishSeason` — before `p.season` is blanked, since that line IS the test —
  and anything the club can't absorb becomes a one-year OVERAGE row in `G.retained`.
- **`aiBonusTerms` derives from the player id**, never `rnd(G)`, so switching the rule on doesn't
  shift a single downstream draw and every calibrated seed replays unchanged.
- UI: `ContractTerms` on the free-agency screen (each row hidden unless its rule is on and the
  player is someone it can apply to), a standing signing-bonus offer above the extension list that
  re-quotes every button, and `BonusNote` in the player bio for the chase.

## The room settles itself
**`aiAnswerDemands`.** Demands went league-wide and only YOU could resolve one, so an AI club's
unhappy player stayed unhappy for ever — measured over ten seasons the count climbed 180 → 906,
half the league, with holdouts reaching 59 and never playing again. Other clubs now do the same
three things you can: play a man who deserves it, let go of one who doesn't, or wear it. Also
**`DEMAND_SQUAD_RANK`** — `expectedMinutes` is an absolute, and a four-line club can only give
top-six minutes to six forwards, so every decent third-liner in the league had a grievance. Outside
his own club's best twelve a player is not being wronged, he is being ranked. Together: **29 → 197
over a decade, holdouts near zero.**

**`enforceFloor`.** `capFloor` computed a number and nothing read it; every club sat below it for
six measured seasons. A club under the floor now signs the best man it can fit, at most
`FLOOR_SIGNINGS` a year — a nudge, not a spree — and never past `FA_MARKET_FLOOR`, because
thirty-two clubs reaching for the floor will strip the market bare.

## The draft class, and how prospects grow
**Draftees arrive RAW.** Top picks were landing at 61–66 overall at eighteen — nearly NHL players
already — which left the farm nothing to do and put 80 of every 96 draftees straight into the
league. `DRAFT_TIER_BASE`/`DRAFT_TIER_SPREAD` put a first overall near the low fifties and a late
third-rounder in the low thirties, `DRAFT_OVR_CAP` is a hard ceiling (an eighteen-year-old is not a
finished hockey player however the dice land), and what separates the top of the board from the
bottom is now the CEILING: gaps of ~40 early against ~14 late.

**So the gap has to pull harder.** `DEV_GAP_PULL` (0.135, was 0.09) — at the old rate a fifty-
overall kid with a ninety ceiling was still a fringe player at 23. `DEV_FARM` rose 1.5 → 1.95, but
it **must stay below what a genuine NHL role gives** (`solid` measures ~2.2) or the trade-off the
whole development model rests on inverts and everyone is better off hidden in the minors.

Measured: draft mean 45.6 → **39.2**, NHL regulars at nineteen 32 → 26, and the class still reaches
a *higher* mean by 24 (74.5 → 76.4) with more attrition (83 survivors → 71). Raw in, fast up,
more busts.

**`draftPar` makes "bust" reachable.** The old curve expected a last pick to reach 8 overall, which
every living player beats — across seven graded classes there were **zero busts, ever**. It now runs
`DRAFT_PAR_TOP` (74) to `DRAFT_PAR_LAST` (44): 28 hit / 44 bust / 29 regulars on a measured class.
`draftClassReport` reads `G.draftHistory` when it exists, so men the save has forgotten still
appear as "never played" rather than silently vanishing — which is why a 96-pick draft used to read
as "73 players drafted" a decade later.

## The board
It used to be unreasonable in two separate ways, and both are fixed.

- **`(got - want) * 9` was linear and blind.** A club told to win the Cup that made the playoffs
  instead lost 27 confidence — a good season punished as hard as a collapse — so from a start of 62
  you were sacked in two years for reaching the postseason twice. Missing by a little is now cheap
  and **a season in the playoffs is never a disaster**, whatever was asked. Missing them entirely
  still hurts, more the more was expected.
- **Mandates read a RATING, not a RESULT.** Strength quartiles are 60/65/69, so a Cup threshold of
  66 asked the top third of the league for a thing one club can have — eleven clubs failing by
  construction every year. It now takes 73, or a finalist at 68. **And the board can only ask for
  one step more than you actually did**: a club it watched miss the playoffs is asked to make them,
  not to win four rounds. Over twelve measured seasons that moved mandates met from 0/12 to 4/12
  and let confidence recover instead of only falling.

## History that stays
- **`archiveDraft`** — `G.draftLog` was wiped at the top of every `buildDraftClass`, so last June
  existed only until the next one. Every draft is kept in `G.draftHistory` with **names and
  positions alongside the ids**, because `pruneSave` forgets the player and a history that empties
  itself is not a history.
- **`CAREER_RECORD_DEFS` / `G.careerRecords`** — the book held single SEASONS only, so the longest
  careers in a save left no mark on it. Totals include the season in progress, so it reads live.
- **`G.gmSeasons` is the manager's `t.seasons`.** A club kept its history for ever and you kept a
  start year, an end year and a cup count — a career at four clubs recorded nothing about any of
  them. One row a year, stamped with the club, so moving on doesn't erase what came before.

## Simming years at a time
**`autoManage` exists because the "sim and walk away" baseline was a catastrophe.** Every piece of
AI management deliberately skipped your club — right when you're playing, ruinous when you're not.
A measured decade with no user input: 82 points, 68, 76, then **seven straight seasons last**, with
**every one of the eight players Hartford drafted who reached 80 overall** on another club. Entry
deals are three years signed at 18, so they expire at 21 — exactly when the player becomes good.
With the rule on, the same seed climbs from a $23M payroll to $72.6M and keeps three of those eight.
It flips two filters, nothing more: `aiExtensionOffer` in `finishSeason` and the club order in
`aiFreeAgency`.

**The board could sack you every single year.** Nothing cleared `G.fired` or moved the confidence
that triggered it, so the condition stayed true at every rollover — the same manager was fired eight
times in one unbroken spell and `G.tenure` grew an entry each time. `!G.fired` is the guard.

**A mandate reads recent seasons, not just team strength.** A roster of 21-year-olds on entry deals
still rates as competitive on paper, which is how a club that finished last four years running kept
being told to win a round. Two seasons under 60 points and out of the playoffs earns a rebuild.

`simFullYear` plays the rest of the schedule, the postseason, the draft and the market in one press.
Each stage calls the same function the buttons do — the draft still runs through `doOffseasonStep`,
so your shortlist is honoured. The loop is bounded by a step budget rather than a condition, so a
stage that ever stops advancing stops the whole thing instead of locking the tab.

## The room, the money, and LTIR
Four things were declared and never wired, three of them by me. They are joined up now.

- **`t.roomHit` lives on the CLUB.** An earlier version put it on `G`, which quietly meant all
  thirty-two clubs shared one conscience. Refusing a demand or breaking a promise raises it,
  `roomMorale` subtracts it, and it decays weekly — so a hard call fades if you stop making them.
  `roomMorale` also subtracts for each unhappy player, and both terms are zero unless the demands
  rule is on.
- **`t.revenue` had no source and `t.budget` was decoration.** A home date now takes a gate priced
  off market size, points percentage and morale; at the rollover last year's gate becomes this
  year's budget. **This is not a business simulation and must not become one** — it exists so the
  people you employ cost something. The salary CAP is untouched by it: players are a separate
  economy and mixing the two would rewrite every cap check.
- **Staff salaries are charged.** The market showed a price and charged nothing, so there was one
  correct answer — hire the best — and therefore no decision. `staffBill` must include the head
  coach, who lives on `t.coach` rather than in `t.staffHired`; leaving him out let you hire a man
  you couldn't pay.
- **The head coach is hireable**, always, with no rule gating him: he predates the staff system and
  he sets the SYSTEM, which is the club's identity. He brings his system with him.
- **`p.oneWay` is now set** when a contract above `TERMINATE_MAX_CAP` is signed — `isTwoWay` has
  checked it since it was written and nothing ever wrote it.
- **LTIR** — `rollInjuries` always produced long absences and nothing did anything with them, so a
  club losing a star for half a season carried his full hit while icing a man short. The relief
  **vanishes on activation**, which is the whole mechanism: spend it and you have to clear the
  space again to get him back.
- **Demands and holdouts are LEAGUE-WIDE.** They began as something that happened to you, which
  made them a tax rather than a system. `unhappyMarket` is the payoff — a club holding a man who
  has asked out negotiates from behind (`tradeValue` discounts him, more so if he is holding out),
  so other clubs' rooms become something to watch.

## Depth rules
`DEPTH_RULES` is a list of optional systems, each **defaulting to the behaviour the game already
had**. That default is not politeness — `false` means an existing save loads into the league it was
saved from, and the thousand-odd harness assertions calibrated against the old engine keep
measuring the old engine. A depth feature that moved the baseline would have to re-prove every one
of them. `applyDepthPreset` flips the lot (Classic / Deep); `depthOn(G, k)` is the read.

**The Deep value is spelled out per rule (`d.deep`), not taken as the last option.** Home ice runs
classic / realistic / none, where the richest setting is the middle one — taking the last option
made "Deep" silently switch the home advantage off. The `depthRules` check pins this.

- **`twoWayDeals`** — a contract at or under `TERMINATE_MAX_CAP` costs `TWO_WAY_MINORS_PCT` while
  the player is in the minors. Fringe money only, and `p.oneWay` marks a deal immune: burying a
  star and recalling him in April is the exploit this bar exists to prevent.
- **`conditioning`** — `p.rust` burns off by PLAYING, so the honest way to get a man fit was a
  demotion you had to remember to reverse. A stint is a demotion with a counter; `tickStints`
  brings him back when the games are served or the rust is gone. Counted in GAMES, so an affiliate
  that doesn't play doesn't shorten anybody's rehab.
- **`farmCoach` / `coachStaff`** — one coach object carried `pp`, `pk` and `dev`, so the man
  running your power play was necessarily the man developing your prospects. Both are **derived
  from the club id** (`hashUnit`), the same pattern as `personalityOf` and `goalieHole`, and here
  it is load-bearing: generating them in `newGame` costs `rnd(G)` calls, shifts every subsequent
  draw and desynchronises every calibrated seed — two realism checks failed on the first attempt
  for exactly that reason. Derived, they cost no randomness, no save size and no replay.
- **`homeIce`** — last change was the whole advantage and measures out at ~50% against a real
  52–55%. `realistic` adds `HOME_EDGE` as a shot-rate multiplier where `momentum` and `legs`
  already multiply, and it is **solved, not guessed**: 53.4% over 5,248 games. `none` disables the
  last-change bend too.
- **`devFocus`** — `progress` applied one delta to all nine ratings, which is why nobody ever
  specialised. A focus REDISTRIBUTES `DEV_FOCUS_SHARE` of the year's gain; the total is unchanged,
  so the choice is what kind of player he becomes, not how good.
- **`prospectRisk`** — `scout.fog` is how well you've SEEN him; volatility is how wide the range of
  outcomes actually is. Two different kinds of not-knowing, and only the first existed. It scales
  the variance in `progress` and leaves the mean alone.
- **`undraftedFA`** — required making the class **bigger than the draft**. It was exactly
  `DRAFT_ROUNDS × teams`, so every prospect was taken and "undrafted" could not happen. The extra
  `UNDRAFTED_POOL` is generated only when the rule is on, and both generation curves run off
  `picks` rather than `total`, so the men who'd have been in the class anyway are drawn exactly as
  before and the extras are tacked on below them.
- **`areaScouting`** — a sweep costs `AREA_SCOUT_COST` visits and cuts fog on everyone in a region
  or position by much less than a personal viewing. Breadth or depth.
- **`rivalryGrowth`** — `t.grudges` counts playoff meetings and stacks heat on top of the built-in
  divisional pairing. With the rule off `rivalryHeat` returns the old 0-or-1 exactly.

- **`draftTradeUp`** — clubs ring YOU to move up. `draftUpOffers` is **computed on demand, not
  stored and not random**: every input is on the board, a stored offer would go stale the moment a
  pick was made, and the per-club taste that stops thirty-two clubs coveting the same player comes
  from `hashUnit`. **`acceptDraftUp` passes the OFFERING club as side A** — `evalTrade` asks
  whether side A gave side B enough and applies the AI's asking-price margin when side A is the
  user, which is right for a deal you propose and exactly wrong for one proposed to you. With the
  user as side A the engine rejected offers for being too generous to him (a pick worth 9 for a
  package worth 12.8, refused because "they want more back").
- **A promise is a debt.** `answerDemand` is the missing half of the demands system: promise him
  minutes, tell him no, or agree to move him. `checkPromises` then looks at whether his minutes
  ACTUALLY moved — so this is the one place in the game where saying the easy thing costs more
  than saying the hard one, and a broken promise lands harder than the original complaint.
  `rollHoldouts` is the end of the line; `activeRoster` filters holdouts exactly as it filters
  injuries, so the engine needs no special case anywhere.
- **`staffMarket` / `hireStaff`** — a staff you can see and cannot change is furniture. The market
  is derived from the YEAR, so it is stable all offseason, costs no save size and shifts no draw.
  `t.staffHired` overrides the derived default, which is why a club you take over keeps whoever it
  had. The head scout is hired the same way and sets how much a region sweep actually reveals.
- **`PROTECTIONS`** — `G.picks` recorded an owner and an origin and nothing else, so every traded
  pick was unconditional and no club would ever sell a first. A protection is a range the pick
  does not convey in; `resolveProtections` runs when the order is drawn and **rolls the obligation
  to next year** if it's caught. It discounts `pickValue`, because the outcomes it removes are the
  ones worth having.
- **`draftTier`** — a ranked list hides the thing scouts actually talk about ("the top four, then
  a gap"), because the gap between the 4th and 5th names can be enormous or nothing and the
  numbers look identical either way. Cut off YOUR read, so a badly scouted board draws its lines
  in the wrong places.
- **`demands`** — `personalityOf` and `roomMorale` existed from the first build with nothing ever
  coming of them. A demand is earned, never random: a player must be playing measurably less than
  `expectedMinutes` for his standard, and `steady` decides how long he wears it. An ignored
  ice-time demand curdles into a trade request after `DEMAND_PATIENCE` days, and `demandDrag`
  makes unhappiness cost something in `lineOff` — which is what makes meeting it worth anything.
- **`farmDepth`** — `FARM_DEPTH_EACH` real players per affiliate, stocked in `startNextSeason`
  BEFORE `enforceRosterLimits` so they're trimmed like anyone else and can't push a club over its
  cap. Deliberately a handful: full farm rosters would put hundreds of dead rows in the save.

**Rookie eligibility is a first season IN THE LEAGUE.** `p.rookie` was cleared at every rollover,
so a prospect who spent a year on the farm — which is most of them — reached the NHL already
ineligible for the Calder. It now survives until he actually plays `rookieGames(G)` NHL games
(25, scaled to season length).

**Save export/import** (`exportSave` / `importSave`) is the only way to move a career between
devices, since a save lives in one browser's localStorage. `migrate` runs on the way in.

**Four views that need no switch.** `G.lottery` records the draw `buildDraftClass` used to resolve
and throw away — the one dramatic moment of the offseason, previously invisible. `G.farmAwards`
gives the affiliate league individual honours it never had. `callUpCost` says what recalling a
prospect does to the club he leaves, which `farmStrength` has always modelled silently.
`draftClassReport` grades a class **against the SLOT** (`par` falls away steeply with pick number)
rather than against the league — otherwise the table just re-sorts everyone by ability and says
nothing about the draft; a player with fewer than 60 NHL games and under 24 reads "too early"
rather than "bust".

**`index.html` has passed 500KB**, so Babel now logs a deoptimisation note on load. It is benign
(transpiling still works and the result is cached in localStorage by source hash) but it is the
first sign the single-file approach is straining — the IndexedDB caching item on the roadmap
matters more now than it did.

## Rules, difficulty, money
- **`G.rules` / `RULES_DEFAULT` / `rules(G)`** — always read through `rules(G)` so a save that
  predates a knob still sees a complete object. `setRule(G,k,v)` routes **structural** knobs
  (`STRUCTURAL_RULES`: `seasonLen`, `playoffFormat`, `seriesLen`) into `G.pendingRules`;
  `applyPendingRules(G)` promotes them at the top of `startNextSeason`, before the calendar is
  rebuilt. `ruleValue(G,k)` reads staged-then-live (what the UI shows).
  - **`otLoserPoint`** — the loser point. Off means `pts === w*2` and nothing lands in OTL.
  - **`otFormat`** — `3on3` / `5on5` / `none`. `none` allows real ties.
  - **`playoffFormat`** — `divisional` (top 3 per division + 2 conference wildcards, the
    interesting one) or `seeded` (1–8). Both must produce exactly 8 first-round series.
    **`playoffBerths(G)` turns the field into a per-club verdict the table can render** (`A1`,
    `WC2`, a plain seed, `bubble`, `firstOut`) and **`clinchState(G)` says who is mathematically
    safe or done** — `z` division, `y` top three, `x` berth, `e` eliminated. Clinching is not
    reasoned about case by case: it asks `playoffField` on a hypothetical table where every rival
    wins out and takes every tie (and the mirror for elimination). Conservative, and it can never
    disagree with the bracket, because it *is* the bracket's own function. The harness plays the
    season out and checks that every club told it had clinched actually made the field.
  - **`hardCap` / `capAmount`** — the hard cap is the defining GM constraint. `evalTrade` and
    `signPlayer` both refuse to breach it.
- **Difficulty** (`DIFFICULTIES`, `diff(G)`) scales budget, AI asking prices, injury frequency and
  how sharply the board reacts. Pressure on the manager only — the AI never gets better
  information.

## The draft
Seven rounds (`DRAFT_ROUNDS`), 224 prospects, and **you never see a prospect's true rating**.
Each carries `p.scout = {fog, bias, bias2}`; `scoutedOvr`/`scoutedPot` apply the bias scaled by
the fog, so the read is deterministic per player and only `scoutProspect` moves it. The top of the
board starts better known than the bottom. `SCOUT_POINTS` visits per offseason, each cutting a
prospect's fog to ~45% of what it was. **The AI drafts off `draftValue`, which is the FOGGED read
plus extra noise**, so thirty-two clubs genuinely disagree about the board.
`p.draft = {year, round, pick, teamId}` is stamped on the player for life and `G.draftLog` records
the pick-by-pick order. `closeDraft` deletes everyone left on the board — without it a hundred-odd
undrafted prospects leaked into `G.players` every year.

**The draft is a room you sit in, not a button you press.**
- `draftOrderRows(G)` is the ORDER: who picked, what they took, who's on the clock, who's coming,
  and whose picks have changed hands. The board used to show only what was left and a reverse log
  of what had gone.
- `draftOnePick(G)` advances exactly one selection (never the user's) — "sim to my pick" skipped
  past the twelve picks that decide whether your man survives, which is the part worth watching.
  **The board's draft button makes the pick and STOPS**; advancing is its own button.
- `draftProjection(G)` is where the sniping lives: clubs draft off `draftValue` plus noise, so the
  board sorted by that value IS the expected order. `risk` shades how likely a man is gone before
  your next turn; `NOISE_PICKS` is the honest width of the guess.
- `G.draftStars` is a RANKED shortlist in the order you starred them. `autoPickFor(G, team)` takes
  the top surviving star for YOUR picks and reads its own fogged board for everybody else's — the
  AI branch must stay exactly one `gauss` call or determinism breaks. `closeDraft` clears the list;
  left standing it holds ids of players who no longer exist.
- `DraftDealModal` points the ordinary `evalTrade`/`doTrade` machinery at a single target — an
  upcoming pick or a player somebody just took — so you never leave the draft. Only picks and
  prospects can go the other way, which is the honest scope of a draft-day deal.

**Attrition is not optional.** Seven rounds puts 224 players a year into a league that loses ~50
to retirement, so without culling the save reached 4.9 MB in eight seasons. Two mechanisms in
`finishSeason`: stalled prospects (23+, still poor, nothing on their record) are released, and the
free-agent pool is hard-capped at `FA_POOL_MAX` — players who can't get a contract leave the
sport, keeping only those with trophies, rings or 200+ career games. That holds it at 2.7 MB.

## The club picker
`Splash` generates a REAL preview league with `newGame(0, {seed})` and hands the same seed to
`onStart`, so **the league you browsed is the league you manage**. That only works because world
generation reads the seed and never `userTeam` or `difficulty` — the `clubPicker` check pins it
for four different clubs and both difficulties. Break that and the preview silently becomes a
lie that nothing in the UI would reveal.
- `clubSummary(G, id)` builds the row: rating, best player, starting goalie, average age, cap
  space, prospect count and average prospect ceiling, coach, and an outlook band.
- **The outlook thresholds are MEASURED** (256 clubs over 8 seeds: range 47–80, median 65,
  quartiles 60/65/69). Guessed ones put all 32 clubs in "Contender". The harness fails if any
  single label swallows the league.

## Contracts
- **Demotion is free.** Moving a player between your own NHL roster and your own farm exposes him
  to nobody. Waivers used to gate this and made shuffling depth a gamble.
- **Three ways out of a contract, and they are not interchangeable.** `terminateContract` ends
  fringe money outright. `releasePlayer` puts a real contract on waivers, where somebody may claim
  it. **`buyOut` is the one for a deal nobody will take and you cannot cut**: a fraction of what's
  owed, spread over DOUBLE the remaining term, which is what makes it a decision rather than an
  undo — cheap now, still on your books when he has retired. A no-trade clause does **not** protect
  against a buyout: it is a promise not to move him to another club, not a promise to employ him.
- **A contract has terms, not just a number.** The no-trade clause used to be a coin flip at
  signing (`rnd(G) < 0.55`), so it happened TO you. It is now currency: a player who values one
  takes `NTC_DISCOUNT` less to get it, and `signPlayer`/`extendPlayer` only fall back to the roll
  when no terms were negotiated — which is what every AI signing still does. Offering one to a
  player who'd never be moved against his will buys nothing, because he doesn't value it.
  `UNHAPPY_PREMIUM` is applied unconditionally in `askingPrice` and is still safe for every
  calibrated seed, because `p.demand` only ever exists on the user's roster and only when the
  demands rule is on.
- **Cutting is not the same as releasing, and conflating them jammed the whole league.** Waivers
  are the right process for a player somebody else might want; they are the wrong one for the
  bottom of an organisation. `terminateContract` ends a contract at or under `TERMINATE_MAX_CAP`
  (1.6× the minimum) outright — no wire, the roster spot is free immediately, which is the point
  when the reason you're cutting is that you have no room. It is deliberately limited to fringe
  money: this clears out depth, it is not an escape hatch from a bad long-term deal. **In season
  it costs the same third of salary a release does; at the rollover it costs nothing** (the roster
  is being rebuilt anyway, and otherwise thirty-two clubs would accrue dead money every year for
  ordinary housekeeping).
- **`enforceCap` counts the MONEY, and it exists because the draft never did.** `draftPlayer`
  hands out seven entry contracts per club with no cap check anywhere, so a club that finished the
  season against the ceiling opened the next one several million over it — **measured at roughly
  one club-season in three hundred across ten seeds, and present since long before the roster work
  above** (it surfaced when a development change shifted the RNG onto the harness's seed; the
  pre-existing worst breach was larger than the one that exposed it). A club over a HARD cap sheds
  worst-value-per-dollar first — the bad deal, not the cheap body — never below `DRESS_MIN` or
  `ROSTER_MIN`, and never a no-trade contract. It runs twice in `startNextSeason`: once before
  `fillRosters` so anything it opens up gets topped back up, once at the end because the market and
  the top-ups both add salary. A soft cap forces nothing.
- **`enforceRosterLimits` is the AI's release mechanism as well as the clean-up.** `ROSTER_MAX`
  and `FARM_MAX` were both declared and only the farm one was ever enforced. Surplus on the
  dressed roster reports to the farm, surplus in the ORGANISATION is released worst-first.
  **Measured before this existed: 31 of 32 clubs sat at or past the 35-man org limit from year
  two, some at 39, and `dead` releases league-wide over ten seasons were exactly zero** — seven
  draftees a year arrive on three-year deals and nothing ever let them go, so fringe players stayed
  frozen on depth charts for their whole entry deal and no club could sign anyone. Afterwards orgs
  settle at ~31.6 with none at the limit. It runs at `finishSeason` and again at the END of
  `startNextSeason` — after `aiFreeAgency` and `fillRosters`, because both add players and the
  draft has just added seven more. **Demotion is position-aware** (`DRESS_MIN`, shared with
  `fillRosters`): sorting on rating alone sends a club's second goaltender down, `fillRosters`
  calls him straight back up, and the two undo each other every rollover.
- `capFreeAgentPool` is split out of `finishSeason` so it can run after enforcement too —
  otherwise the surplus of thirty-two organisations sat in the pool all season (it cost 0.12 MB
  of save size).
- **Waivers are for RELEASES.** `releasePlayer` puts him on the wire; another club can claim him
  and take the contract. If he clears he becomes a free agent and the club carries
  `RELEASE_DEAD_PCT` (a third) of his salary as dead cap for the remaining term.
  **Dead money must not follow the player** — `retainedOn` filters `dead` entries so his next club
  negotiates its own price, while `retainedBy` still sees it because that's the half that hits the
  cap. `retainedTraded` is the non-dead subset, used for the `MAX_RETAINED` trade limit.
- **You can re-sign your own, and you can do it EARLY.** `canExtend` opens with up to
  `EXTEND_EARLY_MAX` (3) years still to run → `extensionAsk` (`askingPrice` × `EXTEND_LOYALTY`,
  plus `EXTEND_EARLY_PREMIUM` for every year he's asked to tear up) → `extendPlayer`. `yrs` is the
  TOTAL length of the new deal, capped at `EXTEND_TERM_MAX`, and a term shorter than what he
  already has is refused. The extension REPLACES the existing deal, so only the difference is new
  money against the cap — you don't get to pay the old price and hold the new term. Buying
  certainty early is expensive now and can look like a bargain in three years; that trade-off only
  exists because the price moves.
- **AI clubs make real decisions.** `aiExtensionOffer` runs in `finishSeason` before contracts
  expire: core players and rising youngsters get kept, veterans and fringe players walk.
  **The baseline is deliberately low (0.1).** Starting from a coin flip meant clubs kept everybody
  — and since a signed player never enters the free-agent pool, he also never hit `FA_POOL_MAX`,
  so eight seasons put ~500 extra bodies in the save. The harness pins that clubs keep the better
  players and let the older ones walk.
- `FARM_MAX` was declared but never enforced; farms drifted past sixteen. `enforceRosterLimits`
  now trims each org to its best twelve on the farm and twenty-three above it, and sends the rest
  to the market.
- **`p.stats` carries no `z`/`net` buckets.** Last season's shot maps are never rendered, and
  keeping nine net cells plus three zones on every player in the league cost ~0.3 MB. `migrate`
  strips them from old saves. Only `p.season` is live.

## The farm league
Prospects used to accumulate a stat line in a vacuum — no opponent, no result, nothing to win.
Every affiliate now plays a real league with a table and a championship.

- **Affiliates MIRROR the parent schedule.** When Hartford visit Boston, so do their farm clubs.
  That's a deliberate simplification: no second calendar to build, store or keep in sync, no way
  for the two to drift apart, and every farm game still has a real opponent and a real result.
- **The sim is coarse on purpose.** `simFarmGame` is strength-vs-strength, not the line-matchup
  engine — running the full engine 1,300 extra times a season would cost far more than it tells
  anyone. For the same reason a farm line carries **no zone or net buckets**.
- **Non-prospects are PHANTOM WEIGHT, not records.** A club carries only two to five prospects,
  but an affiliate ices `FARM_DRESSED` skaters; the rest is its own signed depth, modelled as
  weight in the scoring draw at `FARM_FILLER_OVR`. Giving each club ten more player objects would
  put three hundred dead rows back in the save. Without the phantoms, five prospects split every
  goal their club scored and the best of them finished on **138 goals in 82 games**.
- **A goal drawn to a phantom still generates assists.** Skipping the whole event when the scorer
  wasn't tracked cut league assists to a third of goals and buried every playmaker. Credit the
  goal only if the scorer is real, but always draw the helpers.
- `runFarmPlayoffs` seeds `FARM_CUP_FIELD` clubs, best-of-three, three rounds, resolved in one go
  at `endRegularSeason`. Winners get `t.farmCups` and `p.farmTitles`.
- **The scorelines are kept, but only twice over.** `G.farmDay` is last night's league-wide
  scoreboard, replaced every day so it costs the same in March as in October; `t.farmLog` is a
  full season of results **for the user's club only** (capped at `FARM_LOG_MAX`), because nobody
  opens Calgary's affiliate's game log and thirty-two of them cost thirty-two times as much.
  Fixtures are not stored at all — `farmFixtures` reads the parent schedule, which the farm
  mirrors. Both reset in `startNextSeason`.
- `prospectReady` now also fires on farm production — a prospect outscoring the league is telling
  you he's finished learning there, whatever his rating says.

## Player roles
`roleOf(p)` derives what a skater is FOR — sniper, playmaker, two-way, shutdown, grinder,
enforcer — from whichever of his own ratings stands furthest above his personal average, so a
fourth-liner gets an identity rather than being "a worse forward". **Derived, never stored**, same
pattern as `personalityOf`: no save size, never drifts out of sync with development, old saves get
one free.

It exists because every rate stat used to come from a narrow curve around one rating, so nobody
specialised — the hits leader finished on 152 and the penalty leader on 84. Three draws that were
**uniform random** are now weighted by it: who takes the penalty, whose block it is, and who
answers the bell. Hits scale by role, with the divisor absorbing the league-wide weighted mean
(~1.19) so the overall rate holds.

Two things were measured and deliberately left alone. Steepening `LINE_TOI` toward the real
first-to-fourth ratio made scoring WORSE, so the remaining 20/30-goal overage is in the shape of
the shooter draw, not the minutes split. And the blocks leader stays high with role weighting
neutralised entirely — that was top-pair minutes, fixed in the special-teams split below.

## Deployment
- **`iceTimeD(t)`** mirrors `iceTimeF`: defence pairs are a coaching decision, and the opposing
  pairs play the split THEIR coach set rather than a league constant. Last change is applied as a
  **bend that re-normalises** (`HOME_TOP_LINE_BEND`) — the pre-computed table it replaced only
  worked for the default split, and scaling raw shares handed the home side extra minutes.
- **Both special-teams units get used.** `lines.PP[1]` and `lines.PK[1]` existed from the first
  build and nothing ever touched them, so the whole power play ran through PP1 and the whole kill
  through PK1 — worth an extra eleven minutes a night to anyone on both, which is where
  33-minute defencemen came from. `PP_UNIT_SPLIT` / `PK_UNIT_SPLIT`; the kill's split is its own.
- Typical number one D now 23.6 min, first-line forward 20.4. **Measure the median of each club's
  leader, not the league maximum** — the max is an injury tail and tests roster attrition instead.

## Injuries and recovery
Injuries carry a KIND (`INJURIES[i][3]`) as well as a length, naming the rating the rehab bites
hardest. `p.rust` is the ramp back, sized to time missed via `rehabFor` and capped; **`ratingNow`
is what the engine asks for instead of reading `p.r`** — line strength, unit defence, goaltending
and the shooter draw all route through it, so a rusty player is worse in every phase.
- **Rust burns off by PLAYING**, not by the calendar. Sitting him doesn't start the clock.
- **`REHAB_DEPTH` must stay small.** It applies to every rating a returning player has, so it
  moves league rates: at 0.16 league save percentage fell almost a full point.
- `sharpness`, not `formOf` — that name is already the hot/cold scoring flag.

## Awards
Each trophy runs a `ballot` with vote shares; scores are shifted so fifth place sits near zero,
or every ballot renders as a four-way tie. **The MVP is not the scoring leader** — it used to be
literally the same id, two trophies that could never disagree.
**Point shares are not a voting ballot.** Scoring the Hart on raw shares gave it to a goalie in
8 seasons of 8; discounting goalies gave it to a defenceman in 5 of 8. Goalies are discounted
(0.72) because a starter's saves-over-replacement dwarfs a forward's goals-over-replacement, and
for skaters the ballot weights `ops` over `dps` because a defenceman's shares come mostly from ice
time. Only drafted players carry `p.rookie`, so the opening season can never award a Calder.

**One vote, two callers.** `awardPool` builds the electorate (a line and a club record per
player), `voteAwards` runs the ballots, `awardTrophies` hands out the silverware — idempotent on
(player, year, award). `computeAwards` is the live path; `backfillAwards` is the retroactive one,
and they MUST stay one function. Two implementations of "who was the MVP" is two records of the
same season, and the one nobody looks at is the one that drifts.

**Retroactive awards** (`backfillAwards`, run last in `migrate`) fix two different holes: a season
never voted on at all is rebuilt from career rows and put through the same ballot; a season that
*was* voted on but whose trophies never reached the players just gets them delivered. The rebuild
is refused below `RETRO_MIN_POOL` surviving skaters — `pruneSave` eventually collapses and drops
old players, and electing an MVP from forty survivors is an invention, not a record. Rebuilt years
are flagged `h.retroAwards`.

**Leaders are kept year by year, not just all-time.** `seasonLeaders` snapshots who led every
`RECORD_DEFS` category into `G.history[].leaders` at the rollover — captured there because
`p.season` is blanked further down — storing the NAME as well as the id, since `pruneSave`
eventually forgets the player and a history that goes blank isn't a history. The record book only
ever held the best ever, so a 54-goal season left no trace once somebody beat it. The Records page
renders it as a season-by-season table and stars the marks that still stand.

**Where a player came from.** `p.draft` was stamped for life from the first draft build and
exactly one line of code ever read it (a news item about a stalled high pick). `draftOrigin` now
surfaces it in his bio. The third case is why `G.foundingMaxPid` exists: a founding player has no
record because there was no draft to be part of, and calling him undrafted would be a claim about
him rather than about the save — so nothing is said. Anyone with a higher id arrived later, and a
later arrival with no record really did go undrafted. Stamped BEFORE `buildDraftClass`, or an
offseason start files its prospects on the wrong side of the line. Old saves get `null` and claim
nothing.

**Honour marks follow the name, and the ballots run LIVE.** `honoursOf(G, p)` / `HonourMark` put a
filled amber star (leading or won), a hollow blue star (on the ballot) and an `AS` chip wherever a
player is listed — stats leaderboards, the roster, the player modal, the Home scoring list. Keying
this off `G.awards` alone would mean the marks appeared the moment they stopped being interesting,
since awards are only decided at `endRegularSeason`; instead `seasonBallots` runs `voteAwards`
itself during the season, so you can see who is in the running in February. That is safe because
`voteAwards` is pure — no `rnd`, no mutation — and it is the SAME function that decides the real
thing in April, so a name marked as leading the Hart leads the actual Hart ballot. Once the real
vote exists it replaces the projection. Cached in a WeakMap keyed on `G`: every state change
replaces `G` with a fresh clone, so the cache invalidates itself and one pass over the league is
shared by every row on screen. Nothing is marked below `HONOUR_MIN_GP`, where a "leader" is just
whoever started hot.

**A counting title is not a vote.** `ballot` stores `val` (the raw score) beside `share`. The
scoring and goal-scoring titles render `val` with bars scaled to the leader; the Hart, Norris,
Vezina and Calder render the share as a percentage. Printing "31% of the vote" next to a man who
scored 54 goals was a made-up number where the real one belonged.

## The board, and getting sacked
`boardConfidence` was tracked and displayed from the first build with nothing depending on it, so
every mandate was advisory. Below `FIRING_LINE` the board acts; winning the Cup buys a year
regardless. `takeJob(G, teamId)` moves you on — the club you left keeps its history, roster and
record, and `G.tenure` holds each spell. The fired screen reuses `ClubPicker`, which is why that
was built as a component rather than inlined into the splash.

## The deadline
`deadlineBoard(G)` surfaces what `aiDeadlineMoves` was already deciding internally. The
buyer/seller split IS the standings split it uses, and the asking price IS the pick it pays (a
first at 72+, else a second). The harness pins both — a decorative estimate would be worse than
showing nothing.

## Development
`progress(G, p)` runs **once a year, in `finishSeason`**, never in-season. The age curve (peak 26
for skaters, 28 for goalies) is the base; the interesting part is the environment term.

**NHL minutes are the best teacher in the sport, but only if he's actually playing them and
holding his own.** `devEnvironment(p, st, farm)` reads the season two ways — `role` (was he on the
ice?) and `perf` (did he hold his own?), both normalised per position by `DEV_BANDS` — and
combines them so that **role gates the whole term**: playing badly still teaches something, not
playing teaches nothing (`DEV_NHL_LO` is 0, deliberately — a buried player isn't punished, he just
gains nothing). Beating the farm takes roughly top-nine minutes *and* around-average production; a
productive fourth-liner is still better off in the minors. That trade-off is the point. It replaced
a flat "+1.5 if he's on the farm", which gave every prospect the same answer.

- **`DEV_BANDS` are MEASURED, not invented** — forwards run ~12.7 min a night at ~1.15 pts/60,
  defencemen ~16.2 and ~0.90, goalies ~.907. Re-measure against a simmed season before retuning
  them, or the thresholds stop meaning anything.
- **A mid-season move gets both**, weighted by games in each league, so a December callup is worth
  exactly the share of the year it covered. Note that AI clubs almost never shuttle players (3 of
  318 under-24s in a sample season), so in practice this mostly matters for the user's own callups.
- **Winning teaches.** A farm season was worth a flat `DEV_FARM` whether the affiliate won the
  championship or finished last, which made the farm league's table, playoffs and trophy
  decorative as far as the prospects living in them were concerned. `farmRoom(G, p)` reads the
  club's points percentage and whether it won; `farmRoomBonus` turns that into up to
  `DEV_WIN_SWING` either way plus `DEV_WIN_TITLE` for the title itself. It is **symmetric about
  the league mean, not about a guessed .500** — the loser point puts the real mean near .530, so
  centring on .500 would have quietly inflated everybody; measured league-wide the net effect is
  ~0.02. The room is an OPTIONAL fourth argument to `devEnvironment`, so every existing call (and
  every harness assertion pinning the farm term to exactly `DEV_FARM`) is unchanged, and it only
  weighs on the share of the year actually spent down there.
- **The spring teaches, and doing BOTH teaches most.** `p.po` was cleared at the rollover *before*
  `progress` ran, so a prospect called up for a Cup run developed exactly as if he'd sat at home —
  the maths was reachable and the caller never passed it. `finishSeason` now holds the playoff line
  until after `progress`. A run is worth up to `DEV_PLAYOFF`, scaled by how deep it went; a player
  who also played a real farm season (`DOUBLE_DIP_MIN_FARM`) gets `DEV_DOUBLE_DIP` on top, roughly
  doubling it — he got the minutes down there and the intensity up here, which is exactly what
  neither path gives alone. **The term is additive and starts at zero**, so a player with no
  playoff games is unaffected and every existing `devEnvironment` assertion still holds.
- **Nobody stays on LTIR once he's fit.** `migrate` clears it, because a player stuck on reserve is
  off the cap and out of every lineup and `autoLines` hands his minutes to whoever is left — which
  is how a defenceman reaches forty minutes a night. Measured in clean leagues the skater maximum
  is 25–32; a stuck reserve was what produced 41.5.
- `devAgeWeight` tapers it out: full to 21, 0.75 to 23, 0.4 to 25, nothing after — where a player
  spends the year stops mattering once he's made.
- **Read `p.stats`, not `p.season`.** By the time `progress` runs, `finishSeason` has already done
  `p.stats = p.season` and blanked `p.season`. `p.farmSeason` is still intact (it's archived
  further down), and `p.age` has *already* been incremented, so the age gates are post-birthday.
- `DevelopmentNote` in the player modal surfaces all of this mid-season, while there's still time
  to act. It is the only place the model is visible — **the harness never renders it**.
- The `development` check in `tools/simtest.js` pins the corners (thriving/solid/buried/drowning),
  monotonicity in both inputs, the games-weighted blend, and that young regulars in a real simmed
  league develop far better than young scratches.

## Season-end realism
The `realism` check in `tools/simtest.js` pins what a finished season LOOKS like, pooled over two
82-game seasons because one swings too much on its own. It exists because **every individual
mechanic can be in band while the league they add up to is wrong**: shots (29.3), shooting
percentage (9.5%) and save percentage (90.7%) were each realistic while their product gave 2.77
goals a night and 239 shutouts a season.

Things that were wrong and are now pinned:
- **Assists ran 1.14 per goal against a real 1.70.** `assistsFrom` used a 24/38/38 split for
  0/1/2 assists; the NHL is about 3/27/70. The league's assist leader finished *below* its goal
  leader and nobody ever reached a hundred points.
- **`gwg` was never incremented.** Game-winning goals were declared in `blankStats`, listed in the
  record book, and always read zero. `applyGame` now credits the winner's `(loser's total + 1)`-th
  goal from `box.scorers`; a shootout winner is credited to nobody by design, so nobody gets it.
- **Hits ran 31.7 a team-game against a real ~21.**
- **Base save percentage** is the lever that sets scoring, since goals = SOG × (1 − SV%). Moving
  it changes shutouts, GAA and the standings spread at the same time — re-run the audit, don't
  tune it in isolation.
- **Team tier spread** (`gauss(56, 4.4)`) sets how far apart clubs are. It was wide enough that
  the bottom club finished on 43 points against a real floor near 55, and the blowouts inflated
  shutouts and 30-goal counts. **Re-measure the club picker's outlook quartiles whenever this
  changes** — narrowing it moved every one of them.

Known and still out of band (a future pass): too many 20/30-goal scorers, no hit/PIM specialists
(leaders too low) while blocks over-concentrate (leader too high), top-pair ice time reaching 33
minutes, empty-net goals low, and home-ice advantage effectively nil (~50% against a real 52–55%).

## Point shares
**The three constants move together.** `GOALS_PER_POINT` divides everything except
`DEF_POINTS_PER_MIN`, so raising one without scaling the other silently re-weights skaters against
goalies — that alone pushed a .931 goalie from 3rd in the league to 18th. `REPL_SV` must sit about
.022 below league save percentage, so it has to be re-solved whenever scoring moves. Check all
three against the `pointShares` assertions (sum ≈ league points, leader 15–18, a goalie in the top
15) rather than one at a time.

**Shares are STORED on archived seasons, and stored narrowly.** `stampShares` writes them onto
each career row at the rollover; `lineShares(row)` derives the four numbers on read. Only the
*independent* parts are kept — `ops`/`dps` for a skater, `gps` for a goalie — at one decimal, with
zeros omitted and the total never stored. Four fields per row per player per season is a quarter
of a megabyte a decade and the soak test holds the save under 3 MB (currently 2.95). They are
stamped rather than recomputed because the constants are calibrated against *that* season's
league: re-deriving 1998 under 2020's rules would rewrite history on every patch. `migrate`
backfills a pre-shares save once, gated on the save-level `G.psBackfilled` flag — a per-row test
can't tell "not done" from "done, and it was zero", and migrate runs on every trade-screen click.

`pointShares(G, p, line)` is hockey's Win Shares — the closest thing the sport has to WAR that a
box score can produce — split into `ops` / `dps` / `gps` and measured in **standings points**.
It is a Point Shares-*style* estimate, not Hockey Reference's exact formula (that needs league
constants this engine doesn't produce). `GOALS_PER_POINT`, `REPL_SV`, `REPL_GC_PER_MIN` and
`DEF_POINTS_PER_MIN` were **solved numerically** so the league's shares sum to the standings
points actually handed out (~0.95) and the leader lands in the real 15–18 range. The harness pins
the sum, the leader, the positional composition, and the correlation with production — retune the
constants only against those.
The LIVE season is still derived from `p.season` on demand; only finished seasons are stamped.

## Seasons split by club
`p.stints` is a chronological list of spells — one slim stat line per club a player turned out for
this season, in order, created lazily by `stintFor(p, teamId)` in `applyGame`. It exists because
`p.season` alone credits a traded player's whole year to whoever happens to have him at the end.
The spell lines deliberately carry **no `z`/`net` buckets** (that's the save-size guard), and
`stintTotal(p, field)` must always reconcile with `p.season`.
At the rollover `finishSeason` archives a traded year as **one career row per club** — the way a
real record book reads — and a player who stayed put gets exactly one. `p.stints` is then cleared.
Playoff stats are not split.

## The logs
`G.allStar.at` snapshots the club each selection was picked from — a deadline trade to the other
conference must not retroactively move a player to the other bench.

`G.shotLog` and `G.gameLog` are keyed by player id and kept **only for the user's club** — doing
it league-wide would add well over a megabyte to a save for data nobody opens. `recordLogs` files
them in `applyGame`: one record per shot attempt (day, opponent, clock time, zone, net cell,
outcome `g`/`s`/`m`/`b`/`e`, strength) and one row per game. A goalie's shot log holds only the
attempts that actually reached him. Both are capped (`SHOT_LOG_MAX`, `GAME_LOG_MAX`) and both are
**cleared at the rollover** — they're a this-season view. As with the play-by-play, the game and
the outcome are real; the clock time within the game is generated.

## Deployment, the staff and the room
- **Ice time** (`t.iceF`, `iceTimeF`) is a per-club split, normalised on read, so a save without
  one plays the standard 30/27/24/19. Riding a line costs fatigue, which is already wired.
- **Matchups** (`t.checkLine`, `matchupMix`) decide which of THEIR lines each of yours sees.
  Line-for-line is the default; a checking line chases their best and the scoring line is steered
  toward their depth. **Last change is the whole point**: the effect is 0.62 at home and 0.22 away.
- **Coaching** (`SYSTEMS`, `coachOf`): the system multiplies shot rate in the same place `momentum`
  and `legs` do — ours pushes our volume, theirs decides what they allow. `pp`/`pk` move special
  teams, `dev` moves prospect progression in `progress()`.
- **Rivalries** (`t.rivalId`, `isRivalry`) are paired inside a division, so they're always mutual
  and nobody is left out. A rivalry night plays 4.5% harder both ways and fights nearly double.
- **The room**: `personalityOf` is derived from the player id, so it's stable for a career and an
  old save gets one for free. It is pure character and **never touches a rating**. `letters()`
  computes the C and the two A's from `leadership()` on the fly rather than storing them, so a
  trade can't leave a departed player wearing the C; `t.captainId` overrides it.
- **The board's ask** (`MANDATES`, `setMandate`, `seasonAchievement`): set from team strength at
  every rollover and judged when the Cup is handed out, so `boardConfidence` moves against a
  stated expectation instead of a flat did-you-make-the-playoffs.
- **Hall of Fame** (`hofScore`, `runHallOfFame`): eligible `HOF_WAIT` years after retiring, capped
  at `HOF_CLASS_MAX` a year over `HOF_BAR`. Inductees are exempt from `pruneSave`.
- **The block** (`setBlock`, `generateOffers`, `acceptOffer`): listing a player invites offers
  every fifth day; the AI still has to want him and be able to fit him.
- **Draft-day picks**: `tradablePicks` includes **this year's picks all season** — the draft for
  year Y happens at the END of year Y, so until the class is on the clock they're future assets
  like any other, and excluding them removed the most-traded asset in the sport ("our second in
  June") from the deadline. Once the draft is running a pick survives only until its own slot
  comes up. `seedPicks` starts at the CURRENT year. Only `PICK_ROUNDS` rounds are tradeable; the
  rest fall back to `orig`.
- **A pick is a SLOT, not a round.** `pickSlot` is exact once the lottery is drawn (guarded on
  `G.draftYear === G.year` — last June's order survives the rollover and reading it as this
  June's prices every pick off a stale lottery) and projected off the current table before that.
  `pickValue` multiplies by 1.5 at first overall down to 0.75 at the end of the round, on a convex
  curve whose mean over a uniform draw is exactly 1 — so the average pick is worth what it always
  was and every valuation the deadline logic depends on still holds. Without this the worst club's
  first and the Cup holder's first were both flatly worth 9, and "trade a specific pick" was
  cosmetic.

**A React component that doesn't exist still passes the harness** — the harness never renders. A
UI addition needs a browser pass; two components were silently missing while 448 checks were green.

## The GM layer
- **Retained salary** (`G.retained`, `effectiveCap`, `retainedBy`): a club keeps up to
  `RETAIN_MAX_PCT` of a contract it trades away, for the contract's full remaining term, capped at
  `MAX_RETAINED` per club. `capHit` = roster contracts *less* what others retain on them, *plus*
  what this club retains for others.
- **No-trade clauses** (`eligibleForNtc`, `hasNtc`, `requestNtcWaiver`): attach to established
  players at signing. `evalTrade` refuses outright; the odds of a waiver rise with how badly the
  club is doing.
- **Waivers** (`needsWaivers`, `sendDown`, `processWaivers`): past `WAIVER_EXEMPT_GAMES` NHL
  games a player must clear waivers before going down. Claims are processed worst-club-first the
  following day.
- **Negotiation** (`askingPrice`, `negotiate`): term and the club's position in the table both
  move the number. A near miss returns a `counter`; a lowball returns nothing.
- **The deadline** (`deadlineDay`, `tradesOpen`): trades close at 74% of the calendar and stay
  shut through the playoffs. `aiDeadlineMoves` runs on the day and sorts the league into buyers
  and sellers.
- **Prospects** (`isProspect`, `prospectReady`, `simFarmDay`): farm players accumulate a
  `farmSeason` line. Whether that beats an NHL seat is the whole question — see "Development".

## Continuity of the shot log
The dots on a shot chart **are the shots from the games that were played** — recorded inside
`resolveShots` as each game runs, with that game's day and opponent, not generated afterwards to
match a total. The `continuity` check pins this: every logged shot must fall on a day the club
actually played, must name the opponent it was actually against, must add up to the season totals,
must grow incrementally as days are simmed rather than in one lump, and every logged goal must be
a goal that appears in `G.results`. If a change ever makes the chart cosmetic, that check fails.
Playoff records are logged too and stamped `po: true`; the player page filters them out so a
season chart shows season shots. Don't mix them.

## Season lifecycle
`simDay` → … → `endRegularSeason` (awards + bracket) → `simPlayoffDay` × N → `finishSeason` →
offseason UI → `startNextSeason`.

**The postseason is played a game at a time.** `simPlayoffDay` plays one game in every series
that's still alive and ticks `G.day`, so a seven-game series is lived through rather than resolved
in a click; `simPlayoffRound` is a fast-forward that loops it. Both share `advancePlayoffRound`,
so the two paths can't disagree about how the bracket moves. The user's playoff games get the same
`events` and `log` treatment his regular-season games get.

**A career can start at either end of the offseason.** `newGame(..., {start: "offseason"})` drops
you in at `offseasonStage` "review" with a draft class already built, so your first roster is one
you assembled; the season that follows is `G.year + 1`. It's the real sequence, not a cutscene.
Two things it exposed: nobody has played, so `buildDraftClass` falls back to **team strength**
when no club has a game played (otherwise the sort falls through to club id and the draft order is
the alphabet), and `HomeTab` must only read today's fixture **during the regular season** — the
calendar is built before the first puck drops, so the header cheerfully announced tonight's game
in the middle of the draft.

**Ageing, progression, retirement and contract expiry all happen in `finishSeason`, not at the
rollover.** That is deliberate: it means the offseason screens show next year's ratings and a
real free-agent class instead of last year's leftovers. `startNextSeason` only advances the year,
runs `aiFreeAgency` + `fillRosters`, wipes the table and rebuilds the calendar.

## Interface
- Tabs are grouped (`TABS`, `GROUPS`) into Club / League / Market / History rather than one long
  strip. `SortTable` is the single sortable table used by every screen — add columns to it rather
  than writing another `<table>`.
- `PlayerModal` and `ClubModal` open from anywhere; almost every name and row is clickable.
- **Three chart components, all driven off the same buckets and reused for players and clubs:**
  `ShotRink` (where on the ice), `NetGrid` (where in the goal), `AttemptBar` (on goal / missed /
  blocked). Each takes `mode="S"` for a shooter's view or `mode="G"` for a goalie's, and `NetGrid`
  takes an optional `hole` to outline a goalie's weak spot. `NetGrid` has two views: `pct` shades
  each cell and prints a rate, `dots` plots **one dot per shot** — red for goals, blue for saves,
  hollow around the frame for off target, amber in a band below for blocked, purple in the middle
  for empty-netters. When `G.shotLog` has records for that player the dots are **real** — one per
  logged shot, each with a `<title>` giving the opponent, day, clock time, zone, placement and
  outcome — and it falls back to a density rendering of the per-cell counts for anyone outside
  your club. Positions come from `jitter`/`scatter`, which places dots at genuinely random points
  with a small `spill` so a shot can straddle a gridline: the cell is how the shot was counted,
  not a wall. Placement must NOT be laid out in index order — records arrive grouped by outcome,
  so a grid layout put every goal in the top-left of its cell. The **Shot maps** tab
  (`AnalyticsTab` / `teamShotProfile`) aggregates the same data by club, for and against.
- Career rows deliberately **drop `z` and `net`** when archived in `finishSeason`. Carrying nine
  net cells and three ice zones per player per season is what pushed a long save past the storage
  ceiling; the shot maps are a current-season view.
- **A playoff game reads like a regular-season one.** `G.results` has carried `scorers` for every
  game since the first build, playoff rows included, and only the regular season ever showed them
  — so a Cup run was seven rows of bare numbers. Series games now record the DAY they were played,
  `resultFor(G, g)` ties one to its row, and `ScoringSummary` renders it. `SeriesPage` counts its
  leaders from those summaries rather than from `p.po`, which was wrong twice over: it credited a
  man's other rounds to this series, and `finishSeason` blanks it, so every series opened after
  the Cup said "No games played" about seven games you had just watched.
- `GameTab` replays `G.lastGame`, which holds the **user's most recent game only** — a full
  season of play-by-play would dwarf everything else in the save. Events carry an invented clock
  time and are sorted; the events themselves are real.
- ⌘K / `?` opens the command palette; `d` and `w` sim a day and a week; **`n` does whatever the
  header's primary button does in any phase** — play a day, play a round, or take the next
  offseason step.
- **The offseason is a sequence with exactly one next action, always in the same place.**
  `offseasonStage(G)` derives where you are from state (never a stored field that can go stale),
  `offseasonAction(G)` names the next step, `doOffseasonStep(G)` performs it. The header renders it
  where the sim controls live during the season, and `OffseasonTab` repeats it above the fold with
  a Review → Draft → Free agency breadcrumb. Don't bury the advance button under the free-agent
  table again — that was the original complaint.

## Gotchas
- `emptyBox` covers the **whole organisation** (farm and injured included) so a stray player id
  can never miss a lookup. `applyGame` then skips anyone with `toi <= 0`, which is what stops
  scratches being credited with a game. Both halves are load-bearing.
- **A negative base to a fractional power is `NaN`.** `(p.ovr - 32) ** 1.6` looks harmless until a
  player is rated under 32; then every weight is NaN, every comparison is false, and a weighted
  draw silently hands everything to the last item in the list. On a thin affiliate that gave one
  prospect all 154 of his club's goals and the whole roster zero assists — and league *averages*
  hid it completely. Clamp the base at zero.
- **`SortTable` remembers its sort column, and React reuses the instance across sibling branches.**
  Two different tables rendered at the same position in a `? :` share one component, so a sort key
  from one carried into the other, matched nothing, and fell back to sorting by name. Give each a
  distinct `key` when the columns differ.
- **The harness never renders, and a crash on mount blanks the whole page.** `setTeam` does not
  exist in `App` — the club-modal setter is `setClub` — and 732 checks passed while the new tab
  threw a ReferenceError. Every UI addition needs a browser pass, without exception.
- **In a bracket, ORDER IS THE STRUCTURE.** `advancePlayoffRound` pairs adjacent survivors (slots
  2i and 2i+1), so `buildBracket` must push round one with the series that are meant to meet
  sitting next to each other: `[1v8, 4v5, 2v7, 3v6]` seeded, and each division's two series
  adjacent in the divisional format. Listing all the top-seed openers first put the 1 and 2 seeds
  in the SAME half — they met in round two instead of the conference final, and both formats were
  wrong for months because every other playoff check still passed. The `seeding` check pins it.
- The goalie scouting report reads `p.season.net` — what he has ACTUALLY conceded — not
  `goalieHole`. The hole is real and bends `pickCell`, so evidence correlates with it (~13% of
  reports name it, against an 11% chance floor) but must not simply echo it; the harness pins both
  bounds. Printing the hole directly meant the note said the same thing on day 1 as on day 82.
- `G.draftPick` counts picks made overall; `G.draftClass` shrinks as it goes. Never compare them
  to each other — that bug silently ended the draft at pick 32.
- `autoLines` needs **two** healthy goaltenders dressed and calls the farm up when it only has
  one — with nobody to hand the net to, `pickStarter` rides the starter and he ends up playing
  nearly every night. It falls back to the least-injured body if the whole organisation is hurt;
  a team with no dressed goalie used to crash `resolveShots`.
- `fillRosters` enforces its position minimums on the **dressed roster**, not the organisation.
  Counting the farm left clubs with their second goalie in the minors.
- Read a lineup through `ensureLines`, never `t.lines` — an injury nulls it and it is only
  rebuilt lazily at the next game.
- Lines are invalidated by setting `t.lines = null` (on injury, trade, recall). `ensureLines`
  rebuilds lazily — don't call `autoLines` directly from engine code.
- **Injuries are quoted in games, not days.** They only tick down for clubs that actually played
  that calendar day.
- **A traded player takes his season totals with him.** Reconciling goals per club must use the
  scoring records in `G.results`, not `p.season.g` against `p.teamId`.
- **`saveGame` writes localStorage synchronously and IndexedDB in the background**, both wrapped
  as `{at, data}`, and `loadGame` takes whichever is newer. An earlier version wrote only to
  IndexedDB fire-and-forget and silently lost saves. `unwrap` still reads the old bare format.
- UI state that mirrors engine state goes stale. `OffseasonTab` derives its step from `G.phase`
  rather than trusting `G.offseasonStep`, because a completed rollover otherwise leaves a draft
  board on screen.
- The Hall of Fame check ("players get inducted over a long career") is **thin by nature** — a
  healthy league inducts 1–5 over twelve seasons, so a single seed returning 0 is weak evidence of
  a regression. Before tuning anything to fix it, sweep several seeds under both the old and new
  code and compare the distributions; a change to progression shifts every downstream outcome even
  when the RNG call count is identical.
- Milestones and honours use **rates scaled to the season length**, not raw totals — a 41-game
  season would never reach a 50-goal mark or a 300-point career.
- `tools/simtest.js`'s "season milestones fired" check (`atmosphere`) picks a fixed seed and
  checks a real player's season line against a scaled integer threshold. A seed that lands the
  user's top scorer *exactly* on the threshold has no margin — any small, unrelated change to
  shot rates can flip it. If a change you didn't expect to touch scoring trips this check, prefer
  swapping to a seed with real margin over touching the threshold itself.

## `tools/simtest.js`
Headless harness: extracts the `app-src` block, transpiles it with the vendored Babel, runs it in
a Node `vm` with minimal shims, and publishes the functions listed in `EXPORTS` (top-level
`const` doesn't become a vm global, hence the explicit epilogue). It plays full seasons over the
32-club world and checks world generation, calendar integrity and rest distribution for all three season lengths,
box-score reconciliation (player goals + shootout winners must equal team goals; goalie shots
faced must equal skater shots on goal), the points system, both playoff formats, the cap, trades,
the rollover, rule staging, lines, special teams, injuries, awards, save round-tripping, and
determinism, plus goaltending workload, shot zones, retained salary, waivers, negotiation, the deadline, prospects, records, the All-Star break, play-by-play, an eight-season soak and save durability.

Newer checks worth knowing: `playoffLine` and `clinching` (the marks must agree with the bracket
that actually gets built — a guarantee that turns out wrong is worse than no guarantee),
`careerShares` (stored shares match the live calculation, and the total is never stored),
`retroAwards` (rebuilt years are real and re-loading hands out nothing twice), `pickTrading` (slot
moves value, and the average first is still worth 9), `draftRoom`, `farmGames`, `careerStart` and
`playoffSummaries`.

```bash
node tools/simtest.js          # all checks
node tools/simtest.js season   # one check
```

**Add a case to `CHECKS` (and any new function to `EXPORTS`) when you add a feature.** A feature
with no check is a feature the autopilot can silently break tomorrow.

## The daily autopilot
`.github/workflows/daily.yml` runs every morning at 8am ET:

1. **Pick** one item — a `> **NEXT:**` line at the top of `ROADMAP.md` wins, then an open issue
   labelled `next`, then the top unblocked roadmap item. It may not repeat anything in the last
   30 days of `DAILY-LOG.md`.
2. **Build** it, then run `node tools/simtest.js` until green.
3. **Verify** independently in the workflow. If the harness fails, or if the number of assertions
   in the harness went *down*, the whole change is reverted and the day is logged as skipped.
4. **Commit** one commit to `main` and refill the roadmap.

**Size budget:** S or M Monday–Saturday, L allowed on Sundays. Items are tagged in `ROADMAP.md`.

**To steer it:** edit `ROADMAP.md` (reorder, delete, or add a `> **NEXT:**` line), or open an
issue labelled `next`. To undo a day: `git revert <sha>` and add a line to `DAILY-LOG.md` saying
why, so it doesn't try the same thing again.

**Rails the daily prompt enforces:** never touch `.github/`, never delete an existing feature,
no new dependencies or network calls, no `Math.random()` in engine code, and never weaken
`tools/simtest.js` to make a change pass.
