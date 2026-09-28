# Pocket GM hub — context

One Vercel site that hosts all three Pocket GM games under a single domain, with a menu page
at the root.

| Path | Game repo | Local checkout |
| --- | --- | --- |
| `/` | this repo | `~/pocket-gm-hub` |
| `/soccer/` | `kyleb0226/soccer-gm` | `~/soccer-gm` |
| `/baseball/` | `kyleb0226/baseball-gm` | `~/baseball-gm` |
| `/hockey/` | `kyleb0226/hockey-gm` | `~/hockey-gm` |

## The one thing to understand

**The games are not copied into this repo.** `build.js` shallow-clones each game's `main`
branch into `dist/<slug>/` every build. So:

- Editing a game means editing its own repo, pushing, then redeploying this project.
- Never commit a game's `index.html` here. If you find yourself copying one in, stop.
- A game repo that fails to clone fails the build, loudly. That is intended.

`site/` holds the only hand-written files: the menu page, `manifest.json`, `sw.js`, icons.
`dist/` is generated and gitignored.

## Local preview

```bash
node build.js --local && python3 -m http.server 8150 --directory dist
```

`--local` copies from `~/soccer-gm` etc. instead of cloning, so uncommitted game work shows up.
Registered in `~/.claude/launch.json` as `pocket-gm-hub` on port 8150. Serve over HTTP, not
`file://` — the service workers need an origin.

## Build-time patches (in `build.js`)

Applied here so the game repos stay independent of this site:

- **soccer** used to hardcode its GitHub Pages path `/soccer-gm/` inside `sw.js` and
  `manifest.json`; `patchSoccer` rewrites them to relative paths.
- **baseball** used to lack `apple-mobile-web-app-capable` and friends; `patchBaseball` injects them.

As of the 2026-09 parity pass both games fix this at the source (relative paths; the same `<head>`
and safe-area padding as hockey), so once that reaches each repo's `main` both patches are no-ops.
They stay as guards — they only act when the problem is present.

Each game's CLAUDE.md now opens with an identical **"The Pocket GM family"** section (ports, save
keys, shared conventions, feature-parity table). If you change one copy, change all three.

## Why one origin is safe

The three games share `localStorage` and IndexedDB on this domain. Their keys do not collide:

| Game | localStorage | IndexedDB |
| --- | --- | --- |
| soccer | `pgsoccer_slots`, `pgsoccer_slot_*` | `pgsoccer_db` |
| baseball | `pocketgm_slots`, `pocketgm_slot_*`, `pocketgm_baseball_v2` | `pgbaseball_db` |
| hockey | `pgmh:*` | `pgmh` |

**If you add a fourth game, check its keys against this table first.** A collision would let one
game overwrite another's saves — the failure would look like "my franchise disappeared".

## Service workers

Each game registers its own worker at `/<slug>/sw.js`, scoped to its own folder. The hub's
`site/sw.js` is scoped to `/` and would otherwise intercept game requests, so it explicitly
passes through anything under `/soccer/`, `/baseball/` or `/hockey/`. Keep that list in sync
with `GAMES` in `build.js` when adding a game.

## Deploy

Vercel project builds with `node build.js`, output `dist/`. Redeploying is what publishes new
game versions — pushing to a game repo alone does nothing to this site.
