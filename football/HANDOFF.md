# Football — handoff (Nov 16 2026)

Everything up to commit `425cd29` on `main` is pushed and live at localhost:8150/football/
(`node build.js` from the repo root, then restart launch config `pocket-gm-hub`; Kyle plays his
real save in Safari on that port, so batch rebuilds). `node football/tools/simtest.js` = 112 checks,
all passing. Read `football/CLAUDE.md` first for the file map and the easy-to-break list.

## Done Nov 16 (second session) — NOT committed yet

1. **Rookie contracts** — world gen gives drafted players still on their first team the rest of a
   4-year deal (`buildProRoster`); undrafted rookies who fill a roster sign for 3 years
   (`fillProRosters`); `fixRookieDeals` in `migrate` repairs old saves once (`G.rcFix`).
   In-game draft picks were already on 4 years — the 1-year deals all came from world gen.
2. **Sacramento State in the playoff** — the cause was prestige drift, not the poll: prestige
   had no anchor and "expected wins" ignored the schedule, so over 20–25 years small-conference
   schools reached the 80s–90s (SAC 54→86, TOL 62→95) and mid-table SEC/B1G schools fell to the
   40s. Now `finishCollegeSeason` judges a record against the prestige of the teams played and
   pulls each program toward its historical level `t.pr0` (`basePrestige`; 10%/yr of the gap,
   3% for the user's team). `fixPrestige` in `migrate` pulls every non-user program halfway back
   once (`G.prFix`). `audit.js` prints prestige drift; 25 years now leaves 1 program ≥12 off.
   The poll formula (`rankCollege`) and the auto-bid rule were left alone.
3. **Championship rings** — `ringsOf(G, p)` (04-awards.js) derives them from `G.hist` × `p.hist`;
   pros who never played that year get `p.rg`. `ChampRing` draws them in the `PlayerPage` header.
   Soccer got the same idea as winner's medals (`playerHonours`); baseball and hockey already
   showed rings.
4. **Career page on the hub menu** — `site/career.js` (`PGMCareer`) + "Your career" panel in
   `site/index.html`. Reads saves one at a time on a button press and caches the result in
   localStorage `pgmhub_career` (keyed by each save's last-saved time).

5. **Too many good pro QBs** (Kyle, Nov 17) — every position inflated, QBs most visibly: by year 8,
   30 of 32 starting QBs were 85+ with ~60 backups at 80+. Cause: `toProScale` turned a college 92
   into an 84 rookie and gave nearly every draft pick a 91 ceiling. New conversion (`PRO_SCALE`),
   age 26–27 growth, wider world-gen QB starters, and a one-time `rerateProLeague` for old saves.
   20-year sims (3 seeds): 5–16 starting QBs at 85+, 6–17 below 80, starters 82–85 throughout.

6. **Idea 38 — football's features carried to the other games** (Nov 17). Soccer: award voting
   (ballots now decide Player of the Season / Young Player / Ballon d'Or), compare two players,
   season card, what-if. Baseball: voting, compare from the player modal, season card, what-if.
   Hockey (already had voting + compare): career totals in compare, season card, what-if. Each
   game's CLAUDE.md describes its version. Soccer and baseball what-if are labelled re-rolls (their
   sims can't rewind); hockey replays the exact night for games played since the page loaded.
   Browser-checked in a build: every new panel renders, what-if leaves standings untouched.
   Also fixed in `theme/pgm-theme.css`: hockey's `<body>` carries `bg-[#0b1220]`, so the panel
   blur rule landed on body and every fixed modal was laid out against the whole page (content
   off-screen on long pages). The rule now skips `body`.

## Still open

Nothing from Kyle's list. Ideas: the football-only extras that weren't ported (Heisman-style
ceremony, weekly award race, season-wide luck Monte Carlo) could follow.

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
