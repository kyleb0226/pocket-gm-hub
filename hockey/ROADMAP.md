# Roadmap

The idea pool the daily autopilot draws from. **Edit this file to steer it.**

- Reorder items to change what gets built next.
- Delete anything you don't want.
- Add a `> **NEXT:** ...` line directly under this paragraph to jump the queue for one day.
- Every item is tagged **S** (an hour), **M** (an evening) or **L** (a real feature).
  The autopilot may only pick **L** on Sundays.

The agent removes what it ships and adds one or two fresh ideas each run, so this list should
never run dry. If it drifts somewhere you don't like, prune it — that's the steering wheel.

---

## Coaching and tactics

- **M** — Team systems. A forecheck setting (aggressive / balanced / trap) that trades shot volume
  against shots allowed, applied as a multiplier in the same place `momentum` and `legs` are.
- **M** — Goalie pull strategy. The last-two-minutes block uses fixed 17%/28% odds; make when to
  pull a user setting (down one from 2:00, from 1:00, never) with the payoff moving accordingly.
- **S** — Chemistry-aware auto lines. `autoLines` rebuilds a lineup from scratch by depth chart
  every time it's called (after an injury, a trade, a recall), which throws away whatever streak
  `lineChemistry`/`pairChemistry` had going even when the roster change doesn't touch that line or
  pair. Have it keep any line/pair untouched by the change instead of always sorting from zero.

## GM depth

- **L** — Long-term injured reserve. Injuries over ~25 games should be placeable on LTIR for cap
  relief, with the space vanishing when the player is activated. `rollInjuries` already produces
  the long ones; nothing does anything with them.
- **M** — Contract buyouts. Pay off a bad deal for a fraction over double the term, tracked in
  `G.retained` alongside retained salary since the cap plumbing is already there.
- **M** — Scouting. Draft prospects should show fuzzed ratings that tighten as you spend scouting
  budget on them, so `autoDraft` picking pure `pot` stops being the optimal strategy.
- **S** — Pick protections. `G.picks` records owner and origin but nothing else; add
  lottery-protected and top-10-protected picks that roll over a year if they land in range.
- **M** — Three-way trades. `evalTrade` is written for two clubs; a third seat is where the
  genuinely interesting deals live.

## Season and atmosphere

- **L** — An international tournament in the break, using the All-Star selection logic to build
  national squads from `FIRST`/`LAST` name origin.
- **S** — Player comparison. Two players side by side with their ratings bars and shot rinks
  overlaid; the `ShotRink` component already takes any zone object.
- **S** — Scout the opposing goalie. `goalieHole` gives every goalie a permanent weak spot and the
  Shot maps tab already visualises it, but nothing surfaces the *next opponent's* starter before
  the game — a pre-game note on the Home screen would turn a chart into a decision.
- **M** — Split the shot maps by situation. `ShotRink` and `NetGrid` aggregate everything
  together; even strength and the power play are different games, and `resolveShots` already
  knows the `strength` of every shot.
- **S** — Split the cycle zone into left and right wall. `SHOT_ZONES` has one `cycle` bucket that
  `ShotRink` draws as two mirrored boxes showing the same number, which is a small lie.

## Interface

- **M** — A season summary export: one page per completed year with the table, leaders, awards and
  the Cup run, printable and copy-pasteable.
- **S** — Save export and import as a JSON file, so a career can move between browsers.
- **S** — Club colours. `TEAMS` has no palette; two colours per club would lift the standings,
  bracket and box score at once.
- **M** — A dedicated goalie page in the player modal: workload chart by month, and rest-versus-
  save-percentage, now that both are tracked.
- **S** — Chemistry in the box score. `GameTab` replays `G.lastGame` but never shows which lines
  or D pairs were fully jelled (`t.lineChem[i] >= LINE_CHEM_MAX_GAMES`, and now `t.pairChem[i] >=
  PAIR_CHEM_MAX_GAMES`) going into that game; a small note next to the line score would make the
  chemistry bonus visible, not just felt.

## Housekeeping

- **M** — Memoise roster lookups. `rosterOf` calls `playersOf(G)` which scans every player in the
  league, and it's called several times per simulated game. A per-team index rebuilt on roster
  changes would cut a large slice of sim time.
- **S** — Split the vendored Babel transform out of page load. The game transpiles ~2,700 lines on
  every open; caching the compiled output in IndexedDB keyed by a hash of the source would make
  a reload near-instant.
