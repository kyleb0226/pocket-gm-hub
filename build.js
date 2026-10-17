#!/usr/bin/env node
/**
 * Builds the Pocket GM hub into dist/.
 *
 * The three games live in their own repos and are pulled in at build time, so a
 * redeploy always picks up whatever is on each game's main branch — nothing is
 * vendored into this repo and there is nothing to keep in sync by hand.
 *
 *   node build.js            pull each game from GitHub (what Vercel runs)
 *   node build.js --local    copy from ~/<repo> instead, to preview local edits
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = __dirname;
const SITE = path.join(ROOT, "site");
const DIST = path.join(ROOT, "dist");
const LOCAL = process.argv.includes("--local");

const GAMES = [
  { slug: "soccer", repo: "soccer-gm" },
  { slug: "baseball", repo: "baseball-gm" },
  { slug: "hockey", repo: "hockey-gm" },
];

// Development files that have no business being served to players.
const PRUNE = [
  ".git", ".github", ".claude", ".gitignore", ".DS_Store",
  "tools", "CLAUDE.md", "DAILY-LOG.md", "ROADMAP.md",
];

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

function fetchGame({ slug, repo }) {
  const dest = path.join(DIST, slug);
  if (LOCAL) {
    const src = path.join(os.homedir(), repo);
    if (!fs.existsSync(src)) throw new Error(`--local: ${src} not found`);
    // dereference: a symlinked checkout must be COPIED, never linked into dist —
    // otherwise the prune below deletes .git/tools/CLAUDE.md from the real repo.
    fs.cpSync(src, dest, { recursive: true, dereference: true });
    console.log(`  ${slug}: copied from ${src}`);
  } else {
    run("git", ["clone", "--depth", "1", "--quiet", `https://github.com/kyleb0226/${repo}.git`, dest]);
    const sha = run("git", ["-C", dest, "rev-parse", "--short", "HEAD"]).toString().trim();
    console.log(`  ${slug}: cloned ${repo}@${sha}`);
  }
  if (fs.lstatSync(dest).isSymbolicLink() || fs.realpathSync(dest) !== path.resolve(dest)) {
    throw new Error(`${slug}: dist/${slug} resolves outside dist — refusing to prune through it`);
  }
  for (const junk of PRUNE) fs.rmSync(path.join(dest, junk), { recursive: true, force: true });
  if (!fs.existsSync(path.join(dest, "index.html"))) throw new Error(`${slug}: no index.html`);
  return dest;
}

const edit = (file, fn) => {
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log(`  patched ${path.relative(DIST, file)}`);
  }
};

/**
 * soccer-gm hardcodes the GitHub Pages path /soccer-gm/ in its worker and
 * manifest. Here the game lives at /soccer/, so rewrite those to relative paths.
 */
function patchSoccer(dir) {
  edit(path.join(dir, "sw.js"), s => s.replaceAll("/soccer-gm/", "./"));
  edit(path.join(dir, "manifest.json"), s => {
    const m = JSON.parse(s);
    m.start_url = "./";
    m.scope = "./";
    return JSON.stringify(m, null, 2) + "\n";
  });
}

/** baseball-gm lacks the iOS standalone meta tags the other two carry. */
function patchBaseball(dir) {
  edit(path.join(dir, "index.html"), s =>
    s.includes("apple-mobile-web-app-capable")
      ? s
      : s.replace(
          /<link rel="manifest"[^>]*>/,
          m =>
            `${m}\n  <meta name="apple-mobile-web-app-capable" content="yes" />` +
            `\n  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />` +
            `\n  <meta name="apple-mobile-web-app-title" content="Baseball GM" />`
        )
  );
}

const PATCHES = { soccer: patchSoccer, baseball: patchBaseball };

function dirSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) total += fs.statSync(path.join(e.parentPath ?? e.path, e.name)).size;
  }
  return total;
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(SITE, DIST, { recursive: true });
console.log(`Pocket GM hub → dist/${LOCAL ? "  (local sources)" : ""}`);

for (const game of GAMES) {
  const dir = fetchGame(game);
  PATCHES[game.slug]?.(dir);
}

console.log(`Done — ${(dirSize(DIST) / 1e6).toFixed(1)} MB`);
