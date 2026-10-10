# ⚾ Pocket GM — Baseball

A single-file baseball **general-manager simulation** game, inspired by the iOS *Pocket GM Football /
Basketball* apps. Run the front office of a fictional 30-team league across multiple seasons.

**[▶ Play it](index.html)** — it's one static HTML file. No build, no install.

## Run

Just open `index.html` in a browser. Or serve the folder:

```bash
python3 -m http.server 8124 --directory .
# → http://localhost:8124
```

Your franchise autosaves to the browser (localStorage), and you can **Save File / Load File** from the
header to keep a JSON backup that survives updates.

## Features

- Pick from 30 fictional teams in two leagues, then play a 162-game season on a realistic schedule
  **with off days** (spread over ~224 days) — you play division rivals most, your league next, and
  interleague games are rare (only your mirror division)
- **Rivalries** — every club has a rival (with a cross-league twist for some); your season series and
  next meeting show on the Hub and rival games are flagged on the schedule
- **Hall of Fame & history** — past champions and every team's season records are saved, and great
  players are inducted into the Hall of Fame when they retire after a legendary career
- **League News wire** — a persistent, filterable transaction feed logs every signing, extension,
  trade, call-up/option/release, your draft picks, season awards, and World Series title; the Hub
  shows the latest headlines
- **Freshly randomized league every new franchise** — optionally shuffle cities across
  divisions, or enter a **seed** (number or word) to reproduce/share an exact league
- Sim controls: day / week / month / straight to the playoffs
- Deeper rosters (~30 players: a full lineup + bench and a 5-man rotation + bullpen), with a
  **fatter talent curve** so star players genuinely stand out
- Roster screen split into **Starting Lineup / Bench / Rotation / Closer / Bullpen** with ST/BN badges
- **Drag-and-drop lineup field** — tap or drag players onto a baseball diamond to set your defense;
  positions follow the player, and out-of-position guys take a fielding penalty (shown in amber)
- Editable **5-man rotation and bullpen priority** — set your closer & setup man; relief is role- and
  workload-based, so your **good arms get the high-leverage innings** (the closer locks down saves, the
  setup tier carries the load) while mop-up arms take blowouts and no one arm gets overworked — at the
  big-league club *and* at AAA
- Players **develop and regress realistically** — young players climb toward their potential (fastest
  in AAA, and faster still when they produce, so a kid promoted early who rakes keeps improving), peak
  in their mid-20s, then decline with age; the offseason shows a **risers & decliners report**
- **Rare boom prospects** — once in a while a raw, low-rated youngster carries a sky-high ceiling (think
  55 overall, 85 potential): a long-shot grind that can pay off years later with a homegrown star
- **Realistic retirements** — players hang it up based on both age *and* skill, so a still-productive
  veteran keeps grinding into his late 30s while a washed-up one walks away — with natural variety
- Browse **every player in the league** on the Players tab — filter by team, level (MLB/AAA/FA),
  position, and age, then sort by OVR, potential, trade value, salary, or any stat
- End-of-season **awards**: Player of the Year, Cy Young, and full **All-Star teams** per league, with
  an award-history table; honors stick to a player's profile (e.g. "🏆 2× MVP")
- **AAA affiliates** — every club runs a minor-league team that plays its own full season (with its
  own standings and stat lines). Develop prospects there, then **call them up / send players down**
- **Smart AI front offices** — rival clubs keep their best talent on the big-league roster (they won't
  leave a star buried in AAA behind a scrub), promoting by ability while still fielding a player at
  every position
- **Tradeable draft picks** — deal future picks whose value scales with each team's projected finish,
  alongside players (big-leaguers or prospects)
- **Trade deadline** — the market closes partway through the season; load up before it passes or stand pat
- **AI trade offers** — rival GMs come to you mid-season with deals for your players, shown on the Hub
  with Accept / Reject — fair-value packages you can take or leave
- Inning-by-inning, plate-appearance sim engine driven by player ratings — including stolen
  bases and a rotating bullpen — produces realistic stat lines
- Rich box-score stats everywhere: hitters show G/AB/R/H/HR/RBI/BB/SO/SB and AVG/OBP/SLG/OPS;
  pitchers show GS/IP/H/BB/SO/ER and ERA/WHIP/SV
- Click any player for a detail card with **season, career, and full year-by-year history** — each
  season's stat line, the team(s) he played for that year, plus his draft pedigree (year, round, pick)
- Standings and 19 stat leaderboards (AVG, HR, RBI, OBP, SLG, OPS, Hits, Runs, BB, SB, ERA,
  Innings, K, K−BB, W, Quality Starts, SV, Holds, WHIP) with qualifiers that scale through the season
- Richer box scores — hitters add **caught stealing**, pitchers add **quality starts** and **holds**
- **Franchise record books** — every club's all-time single-season bests (team wins, plus the top
  HR/RBI/hits/runs/SB/AVG and pitcher W/K/SV/ERA), each with the holder and year, on the History tab
- **League-wide prospect rankings** — every team's young talent ranked by a scouting grade (ceiling,
  ability, and age) with an MLB-ready ETA, on the AAA tab
- Trades with value-based AI on a **steep talent curve** — elite (80+) players are genuinely scarce
  and can't be matched by a pile of scrubs, while high-ceiling young prospects carry real value; free
  agency with a salary cap, contracts & budget view
- **Re-sign your own players** to early extensions before they hit free agency — winning earns a
  hometown discount, but a struggling club pays a premium (and its stars may walk)
- **Incentive-laden contracts** — sign a free agent for a lower guaranteed base (cap hit) plus off-cap
  performance bonuses, to fit a star under the budget for less up front
- **Revenue that follows winning** — your payroll budget grows when you win (and shrinks when you lose),
  with playoff and title bonuses, so building a winner pays off at the bank too
- **Waiver wire** — when clubs cut players mid-season they hit waivers; claim them from the Free Agency
  tab (you get first crack before rival GMs, worst record claiming first)
- **Play the postseason game by game** — sim one game at a time and watch each series' line scores,
  or fast-forward a whole round
- Full postseason: Wild Card → Division Series → League Championship → World Series
- Multi-season franchise loop: player aging/development, retirements, expiring contracts,
  a 5-round amateur draft, and season rollover

## Tech

React 18 + Babel-standalone + Tailwind, all via CDN. Everything lives in `index.html`.
See [CLAUDE.md](CLAUDE.md) for architecture notes.

## License

MIT
