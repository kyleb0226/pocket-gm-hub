# Pocket GM — Hockey

A single-file hockey management game. 32 clubs, a hard salary cap, four forward lines, three
defence pairs, and a Cup.

```bash
python3 -m http.server 8142 --directory ~/hockey-gm
```

→ http://localhost:8142 — or just open `index.html`. No build step, everything vendored.

Shots come out of **line-vs-line matchups**, not a flat team rating: your first line's ice time
is split across the opponent's three defence pairs, and at home you get last change, so your top
line sees their third pair more often. That's the whole home-ice advantage — there's no bonus
anywhere else.

```bash
node tools/simtest.js     # headless: plays full seasons and checks the books
```

This repo also runs a **daily autopilot** — a GitHub Action that picks one item off
[ROADMAP.md](ROADMAP.md) each morning, builds it, and commits to `main` only if the harness still
passes. See [DAILY-LOG.md](DAILY-LOG.md) for what it's shipped, and [CLAUDE.md](CLAUDE.md) for
how it works and how to steer it.
