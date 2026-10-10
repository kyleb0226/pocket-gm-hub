# Pocket GM — context

**One app, three games.** Soccer, baseball and hockey GM sims live together in this repo, with
a menu page in front of them. The same build ships as a website (Vercel) and as one iOS app.

| Folder | What | Started life as |
| --- | --- | --- |
| `soccer/` | Pocket GM — Soccer | `kyleb0226/soccer-gm` (now `soccer-gm-OBS`) |
| `baseball/` | Pocket GM — Baseball | `kyleb0226/baseball-gm` (now `baseball-gm-OBS`) |
| `hockey/` | Pocket GM — Hockey | `kyleb0226/hockey-gm` (now `hockey-gm-OBS`) |
| `site/` | menu page, `saves.js`, hub worker, icons | — |
| `ios/` | the one iOS app (WKWebView) | replaced three single-game wrappers |

Each game folder came in with `git subtree add`, so its full commit history is here. The old
repos and the old `~/soccer-gm`, `~/baseball-gm`, `~/hockey-gm` checkouts are **obsolete — never
edit them**. Each game folder still has its own `CLAUDE.md` describing its engine; read it before
touching that game.

## Update the games together

Kyle's rule (Oct 2026): **when a feature, fix or idea lands in one game, carry it to the other
two wherever it translates.** The three games share a skeleton — single-file React, `G` state,
save slots, a season loop, draft/FA/trades, awards, history — so most systems have an analogue:

- Do it in all three in the same piece of work, adapted to each sport (a soccer transfer window
  is a hockey trade deadline; a baseball rotation is a hockey goalie tandem).
- If it genuinely doesn't fit a game, say so in the commit message rather than skipping silently.
- Prefer the same names, UI placement and wording across games, so they feel like one app.
- Run every game's harness before committing: `node soccer/tools/simtest.js`,
  `node baseball/tools/simtest.js`, `node hockey/tools/simtest.js`.

## Build

```bash
node build.js          # → dist/                (website; what Vercel runs)
node build.js --ios    # → ios/PocketGM/Web/    (bundled into the iOS app)
```

`build.js` copies `site/` plus each game folder, prunes dev files (`tools/`, `CLAUDE.md`, …), and
adds a ⌂ "all games" button bottom-left in every game (the one corner none of them use; z-index 30
keeps it under their modals). The `--ios` build also points menu links at `<game>/index.html`
(file:// won't resolve a folder), drops the hub service worker and the "add to home screen" panel.
Both outputs are generated and gitignored.

Local preview: `node build.js && python3 -m http.server 8150 --directory dist` — registered in
`~/.claude/launch.json` as `pocket-gm-hub` on port 8150.

## iOS app

`ios/PocketGM.xcodeproj`, bundle id `com.kyle.PocketGM`, display name "Pocket GM". One WKWebView
loads `Web/index.html` (the menu); everything is bundled, so it runs offline.

```bash
node build.js --ios
cd ios && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project PocketGM.xcodeproj -scheme PocketGM -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build build
```

The web view stays inside the safe area (baseball has no `env(safe-area-inset-*)` padding of its
own). Swipe-back is on, so an edge swipe returns to the menu.

## Saves: one origin, keys must not collide

All three games share localStorage and IndexedDB (one domain on the web, one file:// origin in the
app). Their keys don't collide:

| Game | localStorage | IndexedDB (store `saves`) |
| --- | --- | --- |
| soccer | `pgsoccer_slots`, `pgsoccer_slot_*` | `pgsoccer_db` |
| baseball | `pocketgm_slots`, `pocketgm_slot_*`, `pocketgm_baseball_v2` | `pgbaseball_db` |
| hockey | `pgmh:meta0-2`, `pgmh:slot0-2` (`pgmh:build:*` is a Babel cache) | `pgmh` |

**Before adding a fourth game, check its keys against this table**, and teach `site/saves.js` about
it. A collision reads as "my franchise disappeared".

## Moving saves (`site/saves.js`)

`PGMSaves.exportAll()` → one JSON backup of every game's slots; `PGMSaves.importBackup(b)` merges
it in and **never overwrites**: soccer/baseball slot ids are unique so entries are added; hockey has
three numbered slots, so an imported career moves to a free one (skipped and reported if full;
de-duplicated by its `at` timestamp).

- **Menu → "Your saves"**: Back up (download on web, share sheet in the app via the `pgmSaves`
  message handler) and Restore (file picker).
- **iOS auto-import**: any `.json` dropped in the app's Documents/Import (Files app → On My iPhone →
  Pocket GM → Import) is merged when the menu loads, then moved to Documents/Imported.
- **The old single-game apps** (`~/PocketGM-{Soccer,Baseball,Hockey}-iOS`) were updated one last
  time to inject `saves.js`: they write `pocket-gm-<game>-saves.json` to their own Documents on
  every launch and show a "Move saves to Pocket GM" button. Verified Oct 2026 in the simulator:
  a hockey career and a baseball franchise both came across and loaded.

Web saves on the Vercel domain need nothing — the URL and keys didn't change.

## Service workers

Each game registers its own worker at `/<game>/sw.js`, scoped to its folder. `site/sw.js` is
scoped to `/` and passes through anything under `/soccer/`, `/baseball/`, `/hockey/` — keep that
list in sync with `GAMES` in `build.js`. soccer's worker used to hardcode `/soccer-gm/`; it is
relative now, like hockey's.

## Hockey's daily autopilot

`.github/workflows/daily.yml` (moved here from hockey-gm) builds one roadmap item a day in
`hockey/`, gated on `hockey/tools/simtest.js`. **Its schedule is paused** — it had failed every
morning before the move, and it only knows hockey while features should now land in all three.
Manual runs still work from the Actions tab.

## Deploy

Vercel builds with `node build.js`, output `dist/`. Pushing to `main` is what publishes — there are
no other repos to push to any more.
