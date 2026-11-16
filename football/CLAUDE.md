# Pocket GM — Football

College (138 FBS programs, real 2026 conferences) + a fictional 32-team pro league in one world.
Play as a college head coach or a pro GM. Started Nov 2026.

## Layout — edit `src/`, never `index.html`

`index.html` is generated: `node tools/assemble.js` joins `tools/template.html` + `src/*.js` in
filename order (the game still ships as one file like the other Pocket GM games).

| File | What |
| --- | --- |
| `01-data` | teams, conferences, rivalries, bowls, constants |
| `02-world` | players, rosters, `newGame`, depth chart, play-by-play `simGame` |
| `03-season` | schedules, polls, `simWeek`, CFP/bowls, pro playoffs |
| `04-awards` | Heisman, national/conference awards, All-Americans, records |
| `05-offseason` | `advanceOff` steps, FA, draft (+grades, `toProScale`), recruiting, progression |
| `05b-trades` | pro trades: `playerVal`, `teamPicks`, `evalTrade`, `doTrade`, `shopPlayer`, `aiTrades`, `G.pickOwn` (traded next-draft picks), deadline = week 9 |
| `05c-dynasty` | game day (`weatherFor`, `gameOpts`, `planOf`, `coachGame`/`finishCoached` key calls), staff, NIL + `checkCommit`, `jobReview`/`takeJob`, redshirts, facilities, realignment, `deadlineOffers`, all-star game, `whatIf`, `greatestTeams` |
| `06-events` | Legacy Points, shop, pick'em, predictions, story events |
| `06b-scouting` | traits, interviews, recruit priorities/interest, FA interest, combine, `mockDraft`, `teamNeeds` |
| `10b-ui-viz` | big visuals: `CareerArc`, `RadarVs`, `PollRace`, `HeismanRace`, `BracketTree`, `Timeline`, `RecruitMap`, `FieldDepth`, `DraftNight`, `CapCharts`, `TradePanel` |
| `11c-ui-more` | `GameDay`, `LiveCalls`, `StaffTab`, `MedReport`, `RedshirtCard`, `NilBar`, `IncomingOffers`, `CombineBoard`, `AllStarCard`, `WhatIf`, `GreatestTeams`, `CompareCard`, `SeasonCardBtn` |
| `07-save` | slots: localStorage `pgfootball_slots` + IndexedDB `pgfootball_db` |
| `08`–`12` | UI: building blocks, pages, tabs, office/stories/history, draft centre, app shell |

## Test

```bash
node tools/simtest.js        # 80 engine checks (assembles first)
node tools/audit.js 10       # long sim; prints per-year numbers + FLAGS to eyeball
```

Run the audit after any balance change. Things it caught once: pro ratings inflating every year,
pro rosters shrinking, prestige pinning at 99, RB-only Heismans.

## Things that are easy to break

- College ratings are on a college scale. `toProScale` re-rates a player the day he turns pro
  (draft or undrafted FA). Show `proProj(ovr)` wherever a prospect is compared with pros.
- Back-filled history (`buildProRoster`, `newGame`) must give starter stat lines only to players
  at the top of the depth chart, and keep each pro on one contiguous team path.
- `G.rec` / `G.portal` / `G.draft` don't exist until the first offseason — guard in UI.
- Traits/priorities/combine are hashed from player id (`hsh`), not saved.
- `G.dc[pos]` is the user's manual depth order (set by tapping the field in Team → Depth chart); `depthChart` honours it for `G.uid` only and still drops injured players.
- `G.hwHist` weeks are `[id, score]` pairs (old saves: bare ids — `HeismanRace` handles both). Draft log rows carry the board rank at index 6 for the steal/reach meter.
- Trades are pro-only (college uses the portal). Picks trade as live draft slots during the draft, otherwise through `G.pickOwn`, which `beginOffseason` applies and clears.
- `hsh(id, k)` needs a NUMBER key; a string key silently returns 0 for everyone. Use `hk(id, "name")` in `05c` for string keys.
- A rookie is found with `isRookie(G, p)` (draft year), never `p.exp === 0`: drafted players are already exp 1 in their first season.
- Key calls: `coachGame` replays the user's game from `g._seed` with the answers in `g._calls`; `playGame` finishes a half-coached game from the same seed. Modals opened from inside a tab must go through `ReactDOM.createPortal` — `.page-in` has a transform, which traps `position: fixed`.
- Recruits commit (`p.commit`) once the user leads by 4 pull; signing day honours it. `nilToLead` is the exact Lock price shown in the UI.
- Award ballots live in `G.awards.{pro,col}.votes`; `backfillVotes` / `redoRookies` (one-time, `rkFix`) repair older saves in `migrate`.
- After `node build.js` the preview server on :8150 must be restarted (build deletes `dist/`).
