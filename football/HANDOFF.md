# Football — handoff (Nov 16 2026)

Everything up to commit `425cd29` on `main` is pushed and live at localhost:8150/football/
(`node build.js` from the repo root, then restart launch config `pocket-gm-hub`; Kyle plays his
real save in Safari on that port, so batch rebuilds). `node football/tools/simtest.js` = 98 checks,
all passing. Read `football/CLAUDE.md` first for the file map and the easy-to-break list.

## Asked for but NOT started yet (do these next, in this order)

1. **Rookie contracts look like 1 year, should be 4.** Drafted players do get `yrs: 4` in
   `draftAssign` (05-offseason.js). The likely cause is world generation: `buildProRoster`
   (02-world.js, `p.c = { amt: salaryFor(p), yrs: rint(1, 4) }`) gives year-one rookies a random
   1–4 year deal, and `fillProRosters` signs fill-ins for 1 year. Fix: at world gen give players
   with `exp <= 3` and a `draft` the remainder of a 4-year deal (`max(1, 4 - exp)`), and add a
   one-time repair in `migrate` (07-save.js, flag e.g. `G.rcFix`) that does the same for existing
   saves and clears a wrong `p.expiring`. Use `isRookie(G, p)` / `p.draft.y`, never `p.exp === 0`.
   Add a simtest check.
2. **"#4 Sacramento State 14–1" reached a playoff game against #11 Oregon — Kyle says that
   shouldn't be possible.** Sacramento State is in the data at prestige 54 (01-data.js). Not yet
   investigated. Suspects: `rankCollege` (03-season.js) rewards record too much against a weak
   schedule (`perf` = win% × 55 + sos × 34…), so a low-prestige team that runs the table in a weak
   conference climbs to the top 5; and prestige drift may be letting small schools get too good.
   Run `node tools/audit.js 10` and print, per year, the lowest-prestige team in the final top 10
   and its schedule strength. Probably wants a bigger SOS weight or a cap for teams that played no
   ranked opponents. Check the CFP auto-bid rule too (five best conference champions).
3. **Championship rings on player profiles** — one for a college national title, one for a
   Pocket Bowl, for every player on the winning roster. Can be derived, no new state:
   for each `G.hist` row, `natChamp` / `proChamp` vs the player's `p.hist` row for that year
   (`lvl` "C"/"P", `tid`), plus the current season before `archiveStats` runs. Draw them in the
   `PlayerPage` header (09-ui-pages.js) as small SVG rings in the team colour with the year.
4. **Idea 39 — a career page on the hub menu** (`site/index.html`, new panel above "Your saves")
   totalling seasons and titles across all four sports. Save shapes already looked up:
   - football: slot index `pgfootball_slots`; blob `G.coach.hist` rows `{y, tid, w, l, note, cc}`,
     title = note is "National Champions" or "Won Pocket Bowl".
   - soccer: `pgsoccer_slots` (`club`, `season`); blob `G.career.seasons` rows with `trophies`,
     `G.career.seasonsManaged`, `G.champions` rows `{season, id}` vs `G.userTeamId`.
   - baseball: `pocketgm_slots`; blob `G.champions` rows `{season, id}` vs `G.userTeamId`.
   - hockey: `pgmh:meta0-2` already has `cups`, `year`, `record`.
   `PGMSaves.exportAll()` returns everything (`idb[dbName][key]`), but blobs are several MB, so
   load on a button press, not on menu load.
5. **Idea 38 — carry football's features to soccer, baseball and hockey** (the hub rule). Nothing
   ported yet. Best candidates: award voting, compare two players, season card, what-if replay.
   Each game is one ~600 KB `index.html` with its own engine; read that game's CLAUDE.md first.

## Known loose ends

- `audit.js` sometimes flags one "oversized roster" pro team (>60) and 1–2 genuine A→B→A returns.
- In the contract-talks modal, a successful signing closes the modal (the row unmounts) so only
  the toast confirms it.
- Dark club colours give only a faint tint in the other three games' themed header
  (`theme/pgm-theme.js` could lighten them).
- Not clicked through in a browser (headless only): accepting a deadline offer, being fired,
  realignment invitation, hiring a coordinator, trade-down on the clock, selection show, order
  reveal, franchise tag.
- iOS app not rebuilt since football was added (`node build.js --ios`, then the Xcode build in the
  hub CLAUDE.md).
- Other three games got the look only (`theme/`), no new features.
