# Pocket GM

Three management sims in one app — soccer, baseball and hockey — behind a single menu. Runs as a
website and as one iOS app, fully offline, with saves kept on your device.

| Folder | Game |
| --- | --- |
| `soccer/` | Pocket GM — Soccer |
| `baseball/` | Pocket GM — Baseball |
| `hockey/` | Pocket GM — Hockey |
| `site/` | the menu page and save backup/restore |
| `ios/` | the iOS app |

The games used to live in their own repos (now renamed `*-OBS`); they were merged in here with
their full history.

## Build

```bash
node build.js
```

Writes the website to `dist/` (what Vercel deploys). Preview it over HTTP so the service workers
register:

```bash
python3 -m http.server 8150 --directory dist
```

## iOS

```bash
node build.js --ios
```

Then open `ios/PocketGM.xcodeproj` and Run. The menu and all three games are bundled into the app.

## Moving saves

The menu's **Your saves** panel backs up every game's saves to one file and restores a backup
without overwriting anything already there. To bring saves over from the old single-game iOS apps:
update each one from Xcode once, open it — it writes `pocket-gm-<game>-saves.json` into its folder
in the Files app (or tap **Move saves to Pocket GM** to share it) — then put that file in
Files → On My iPhone → Pocket GM → Import, or pick it with **Restore from a backup**.
