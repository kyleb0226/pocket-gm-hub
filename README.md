# Pocket GM hub

One site, three games. A menu page at the root, with each management sim served from its own path:

| Path | Game | Source |
| --- | --- | --- |
| `/soccer/` | Pocket GM — Soccer | [kyleb0226/soccer-gm](https://github.com/kyleb0226/soccer-gm) |
| `/baseball/` | Pocket GM — Baseball | [kyleb0226/baseball-gm](https://github.com/kyleb0226/baseball-gm) |
| `/hockey/` | Pocket GM — Hockey | [kyleb0226/hockey-gm](https://github.com/kyleb0226/hockey-gm) |

## How it fits together

Nothing is vendored here. `build.js` shallow-clones each game's `main` branch into
`dist/<slug>/` at build time, so **every deploy picks up the latest version of all three
games** — you never copy a file into this repo.

That means: after you push a change to a game repo, redeploy this project to publish it
(Vercel dashboard → Deployments → ⋯ → Redeploy, or push any commit here).

Only `site/` is hand-written — the menu page, its manifest, its worker, its icons.

## Build

```bash
node build.js
```

```bash
node build.js --local
```

`--local` copies from `~/soccer-gm`, `~/baseball-gm` and `~/hockey-gm` instead of cloning,
so you can preview uncommitted work. Output lands in `dist/` either way.

Preview it the same way the games are served — as static files over HTTP, so the service
workers register:

```bash
python3 -m http.server 8150 --directory dist
```

## Install on a phone

Each game is its own installable PWA. Open the game (not the menu) on the phone, then
Add to Home Screen — you get an icon that opens straight into that game. Adding the menu
page instead gives one icon that lands on the three-game list.

The three games use distinct storage keys (`pgsoccer_*`, `pocketgm_*`, `pgmh:*`) and
distinct IndexedDB databases, so sharing one origin does not mix up their saves.

## Build-time patches

Two fixes are applied in `build.js` rather than upstream, so the game repos stay
independent of this site:

- **soccer** hardcodes its GitHub Pages path `/soccer-gm/` in `sw.js` and `manifest.json`;
  both are rewritten to relative paths for `/soccer/`.
- **baseball** is missing the iOS `apple-mobile-web-app-capable` meta tags that soccer and
  hockey carry; they get injected so all three install identically.

If either is ever fixed upstream, the corresponding patch becomes a no-op and can be dropped.
