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

## GM depth

- **M** — Three-way trades. `evalTrade` is written for two clubs; a third seat is where the
  genuinely interesting deals live. Not the same thing as `brokerTrade`, which only ever adds a
  cap-space dump for a fee — a real three-way exchanges players and picks in all three directions.

## Season and atmosphere

- **M** — Split the shot maps by situation. `ShotRink` and `NetGrid` aggregate everything
  together; even strength and the power play are different games, and `resolveShots` already
  knows the `strength` of every shot.
- **S** — Split the cycle zone into left and right wall. `SHOT_ZONES` has one `cycle` bucket that
  `ShotRink` draws as two mirrored boxes showing the same number, which is a small lie.

## Interface

- **M** — A season summary export: one page per completed year with the table, leaders, awards and
  the Cup run, printable and copy-pasteable.
- **M** — A dedicated goalie page in the player modal: workload chart by month, and rest-versus-
  save-percentage, now that both are tracked.
- **S** — `CompareModal` still shows the "Pick two players of the same kind" warning as dead
  code for the picker-driven path now that `PlayerPicker` filters by `matchKind` — it only
  remains reachable via `RosterTab`/`StatsTab`'s "Cmp" queue, which can still queue a skater and
  a goalie back to back. Worth a comment noting that's the only path left, or filtering the Cmp
  queue too so the warning becomes unreachable everywhere.

## Housekeeping

- **M** — Memoise roster lookups. `rosterOf` calls `playersOf(G)` which scans every player in the
  league, and it's called several times per simulated game. A per-team index rebuilt on roster
  changes would cut a large slice of sim time.
