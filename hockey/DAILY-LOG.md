# Daily log

One line per autopilot run: what shipped, or why nothing did. The agent reads the last 30 days of
this file before choosing, so **nothing here gets built twice**. If you revert a day, add a line
saying why — that's how you tell it not to try again.

Format: `YYYY-MM-DD · SIZE · what shipped` — or `SKIPPED · reason`.

---

- 2026-08-05 · — · Initial build. 32-club league, line-matchup engine with special teams and
  overtime, 82/56/41-game schedules, divisional and seeded playoff formats, hard cap, trades,
  draft with a weighted lottery, free agency, ageing and progression, awards, save slots, and a
  117-assertion headless harness. Not an autopilot run — this is the starting line.
- 2026-08-05 · L · Cleared the entire opening roadmap in one pass, by hand rather than by
  autopilot. Engine: a real calendar with rest days and back-to-backs, shot-quality zones
  (rush/cycle/point) that decide both who shoots and how stoppable it is, defencemen added to the
  even-strength unit so they actually shoot, goalie fatigue and a starter/backup split, a real
  three-round shootout, empty-net situations, and fighting with a momentum swing. GM: retained
  salary, no-trade clauses, waivers, contract negotiation with counters, a trade deadline with AI
  buyers and sellers, and prospect development on the farm. Season: a record book, in-season
  milestones, an All-Star break carved out of the calendar, franchise history with honoured
  numbers, and per-zone shot tracking for skaters and goalies. Interface: rebuilt around grouped
  navigation with sortable tables everywhere, player pages with a shot-location rink, a
  play-by-play game viewer, club history pages, a schedule tab, playoff series pages, a command
  palette, keyboard shortcuts and save-slot management. Storage moved to IndexedDB with a
  synchronous localStorage mirror. Harness grew from 117 to 214 assertions.
  Bugs the harness and the browser pass caught along the way: ice time was being divided among
  linemates (a first-liner showed 4.7 minutes instead of 21); every club played every single day
  because all sixteen of a round's fixtures landed on one date; the circle method's fixed point
  gave every club identical rest; the draft silently ended at pick 32; scratches were credited
  with games they never dressed for; a club with two injured goalies crashed the engine; and
  saves were being lost to fire-and-forget IndexedDB writes.
- 2026-08-05 · S · Line chemistry: a forward line now tracks how many consecutive games it has
  played intact (`t.lineChem`/`t.lineSig`, capped at `LINE_CHEM_MAX_GAMES`) and earns a small
  `lineOff` bonus for it in `simGame`'s even-strength loop, so shuffling a line every week costs
  offence. Surfaced in the Lines tab with a per-line tooltip and a marker once a line is fully
  jelled. Along the way, retuned the "season milestones fired" harness check off seed 191, which
  put the user's top scorer exactly on the 20-goal threshold with no margin — any small change to
  shot rates could tip it either way, and this one did. Harness grew from 214 to 218 assertions.
- 2026-08-05 · M · Shot attempts and net placement, by hand rather than by autopilot. Every shot
  that reaches the net now has blocked and missed attempts rolled around it, so about 55% of
  attempts are on goal — and blocks are real, credited to an actual defenceman, so `blkd` and
  `blk` reconcile league-wide. On-goal shots are placed in one of nine `NET_CELLS`, the shape of a
  penalty placement chart: hands pick corners, weak shooters hit centre mass, and every goalie
  carries one permanent hole derived from his id. New `NetGrid` and `AttemptBar` components sit
  beside `ShotRink` on player pages, and a **Shot maps** tab aggregates all three by club for and
  against. Career rows now drop the zone and net buckets — carrying them was worth a megabyte over
  eight seasons. Harness grew from 218 to 231 assertions.
- 2026-08-05 · S · A shot-by-shot view of the net, by hand. `NetGrid` gained a `dots` mode that
  plots one dot per shot instead of a percentage — red goals, blue saves, hollow off-target dots
  scattered over the bar and wide of the posts, amber blocked shots in a band below the goal line.
  Positions come from a pure `jitter`/`scatter` pair seeded off the player id, so the cloud is
  stable between renders; one dot stands for several shots once a cell crowds. Toggle sits on both
  the player page and the Shot maps tab.
- 2026-08-05 · M · Real per-shot logs, by hand. `G.shotLog` and `G.gameLog` record every attempt
  and every game for the user's club — day, opponent, clock time, zone, net cell, outcome — so the
  net dots are now actual logged shots with a tooltip each rather than a density rendering, and
  player pages gained a form-bar chart and a game-by-game table. Kept to one club and cleared at
  the rollover, which is what stops it costing a megabyte. Also rewrote `scatter` to place dots at
  random points with a small spill across cell boundaries: the old jittered grid laid dots out in
  index order, which stacked every goal in the top-left of its cell and left the edges bare.
  Replaced the RNG-hostage milestone check with one that drives `checkMilestones` directly, after
  it broke for the second time on an unrelated change. Harness grew from 231 to 251 assertions.
- 2026-08-05 · M · Calibrated net placement against real NHL shot-target data instead of my
  guesses, which had it backwards. Shots are aimed LOW (52% low, 18% high) but goals go in HIGH —
  66% above the pads against a real 67%, top glove 19-21% (real 21%), high blocker 15-16% (real
  15%), five-hole 14% (real 14%), and top glove is the single most-scored-on cell exactly as it is
  in the NHL. Each cell now carries its own aim weight and save offset. Added handedness
  (`p.shoots`, 62% left) as the real cause of the glove-side bias, and `shooterSpot` so every
  shooter has a favourite corner and no two charts look alike. Retuned the save baseline and
  even-strength shot rate together: the league now runs .902-.904 sv%, 9.7% shooting, 30.0 shots
  and ~3.0 goals per team-game against real NHL figures of .903 / 9.6% / 30.5 / 3.1. All four are
  pinned in the harness against NHL bands. Harness grew from 251 to 262 assertions.
- 2026-08-05 · S · Fixed the attempt model: one attempt, one outcome. `resolveShots` was
  generating a shot on goal and then inventing a blocked and a missed attempt around it, so a
  single chance produced up to three records and a shot chart drew three dots for one shot. It now
  loops over attempts, each independently blocked / missed / on goal (24/21/55), with the loop
  count derived so the expected on-goal total is unchanged — league rates held at 3.08 goals and
  30.4 shots per team-game through the rewrite. Also snapshotted All-Star selections
  (`G.allStar.at`) so a player traded across conferences at the deadline doesn't retroactively
  switch benches. Harness grew from 262 to 263 assertions.
- 2026-08-05 · S · Made the offseason walkable. It had no header button at all, so the thing that
  advanced it moved to a different place at every step and the last one sat under a 60-row
  free-agent table. Added `offseasonStage`/`offseasonAction`/`doOffseasonStep`: one derived next
  action, rendered in the header where the sim controls live all season, repeated above the fold
  with a Review → Draft → Free agency breadcrumb and a one-line explanation of what's waiting on
  you. `n` now triggers the header's primary action in any phase. End of playoffs to next season
  is five presses. Harness grew from 263 to 280 assertions.
- 2026-08-05 · S · Season stats now show which club they were earned with. `p.stints` records a
  chronological spell per club (`stintFor` in `applyGame`), so a player traded at the deadline
  reads "61 games with Anchorage, 21 with Tulsa" instead of having the whole year credited to
  wherever he ended up. Player pages gain a by-club table, the career table gains a Tm column, and
  the stats table marks traded players with a `*` and the full path on hover. At the rollover a
  traded year is archived as one career row per club. Spell lines carry no zone or net buckets, so
  the save cost is small. Harness grew from 280 to 294 assertions.
- 2026-08-05 · S · Made every club's shot map its own. `pickZone` used fixed league-wide
  probabilities, so the rush/cycle/point mix was identical for all 32 teams and a club's "what we
  shoot" and "what we concede" maps differed only in volume. The zone mix is now decided by the two
  units on the ice: forward speed generates rush, a shooting defenceman drags play to the point,
  and a quick sound defensive unit denies the middle. Rush share now spans 5 points across the
  league on offence and 9 on defence, with the biggest club gap between its own two maps at 7
  points. Pinned with correlation checks — fast forwards → rush (r=0.79), shooting D → point
  (r=0.68), sound defence → less rush conceded (r=-0.85) — so it can't be flattened back out.
  League rates unchanged. Harness grew from 294 to 302 assertions.
- 2026-08-05 · M · Made the net maps club-specific. Placement depended only on the shooter, so
  every club's CONCEDED net chart was the league average and sat on top of its own — the thing
  that looked predetermined. Shooters now scout: `pickCell` boosts the opposing goalie's
  `goalieHole`, harder for a player with hands, so all 32 clubs concede above-average volume at
  their starter's weak spot (median +3.4 points) and the conceded chart is genuinely theirs. Ice
  zones also gained a modulated cycle term, since leaving cycle as the residual pinned the middle
  of every chart near 50%. Two real bugs fell out: `fillRosters` counted position minimums across
  the whole organisation, so a club could have its second goalie stuck on the farm; and with only
  one dressed goalie `pickStarter` had nobody to rotate to, which had one starter at 77 of 82
  games — `autoLines` now calls a goalie up when it's a man short, and the starter load is back to
  55. NHL calibration held throughout (67% above the pads, top glove 22%, five-hole 14%, .902
  save percentage). Harness grew from 294 to 307 assertions.
- 2026-08-05 · L · Rebuilt the draft. Seven rounds and 224 prospects, and you no longer see true
  ratings: every prospect has fog, so the board shows a read with a ± band that only narrows when
  you spend one of your scouting visits on him — and the AI drafts off its own fogged read plus
  noise, so the thirty-two clubs actually disagree. Prospects carry a style, a background and a
  scouting-report status; the board filters by position, flags where your organisation is thin,
  lists your upcoming picks, and logs every pick as it happens. Where a player was taken is stamped
  on him for life. Undrafted players are now deleted instead of leaking into the save.
  Seven rounds also broke the population maths — 224 in a year against ~50 retirements pushed the
  save to 4.9 MB over eight seasons — so stalled prospects are released and the free-agent pool is
  hard-capped, which brought it back to 2.7 MB. Harness grew from 339 to 362 assertions.
- 2026-08-05 · M · Playoffs are now played a game at a time. `simPlayoffDay` plays one game in
  every live series and ticks the day; `simPlayoffRound` became a fast-forward that loops it, and
  both share `advancePlayoffRound` so the two paths can't disagree about the bracket. The user's
  playoff games now get a play-by-play and shot-log entries like his season games — they had
  neither before, so a whole spring was invisible. Playoff shots are stamped `po` and filtered out
  of season charts. Also added a continuity check that pins the shot log to reality: every record
  must fall on a day the club actually played, name the right opponent, add up to the season
  totals, grow incrementally rather than in one lump, and every logged goal must appear in the
  scoring record. Harness grew from 362 to 390 assertions.
- 2026-08-08 · S · Defence pairs now build chemistry the same way forward lines do. `pairChemistry`
  tracks how many consecutive games a pair has stayed together (`t.pairChem`/`t.pairSig`, capped
  at `PAIR_CHEM_MAX_GAMES`) and feeds a small `unitDef` bonus, so a settled shutdown pair actually
  defends better and shuffling the blue line every week costs real defence — it used to cost
  nothing, since `unitDef` had no continuity term at all. Both chemistry reads now happen in a
  pass before either side's shots are resolved, since a defending pair's streak belongs to the
  opponent of whoever's shooting. The Lines tab shows a filled dot next to a capped-out pair, same
  as it already did for forward lines. Harness grew from 390 to 394 assertions.
- 2026-08-08 · L · Thirteen features in one pass, by hand. Deployment: per-line ice time you can push, and
  matchup control where a checking line chases their best — last change is worth 0.62 at home
  against 0.22 away, so home ice finally means something you can use. Staff: every club has a head
  coach with a system (forecheck/balanced/trap) that multiplies shot rates, plus power play,
  penalty kill and development ratings that all bite. Rivalries paired inside each division, mutual
  by construction, played 4.5% harder with nearly double the fights. The room: characters derived
  from player id, a captain and two alternates computed from leadership rather than stored, and a
  morale figure. A board mandate set from team strength each year and judged against what actually
  happened. Hall of Fame with a three-year wait and a capped class. Club colours, jersey-raising on
  the wire, a trade block that draws real offers, draft-day pick trading, and a pre-game scouting
  report naming the opposing starter and where he's soft. Harness grew from 394 to 452 assertions.
  Worth remembering: two whole React components were missing after a bad edit and all 448 checks
  still passed, because the harness never renders. The browser pass caught it.
- 2026-08-14 · SKIPPED · reverted automatically: tools/simtest.js failed
- 2026-08-15 · SKIPPED · reverted automatically: tools/simtest.js failed
- 2026-08-16 · SKIPPED · reverted automatically: tools/simtest.js failed
