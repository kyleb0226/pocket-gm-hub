#!/usr/bin/env node
/**
 * Builds Pocket GM — the menu plus all three games — into one folder.
 *
 * The games live in this repo (soccer/, baseball/, hockey/). This copies them
 * next to the menu, drops the development files, and adds a small "all games"
 * button to each so you can get back to the menu without a browser back button.
 *
 *   node build.js           → dist/                    (what Vercel serves)
 *   node build.js --ios     → ios/PocketGM/Web/        (bundled into the iOS app)
 *
 * The iOS build loads from file://, where a link to "soccer/" opens a folder
 * listing instead of the game, so every menu/home link points at index.html
 * explicitly there.
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SITE = path.join(ROOT, "site");
const IOS = process.argv.includes("--ios");
const OUT = IOS ? path.join(ROOT, "ios", "PocketGM", "Web") : path.join(ROOT, "dist");

const GAMES = ["soccer", "baseball", "hockey"];

// Development files that have no business being served to players.
const PRUNE = [
  ".git", ".github", ".claude", ".gitignore", ".DS_Store",
  "tools", "CLAUDE.md", "DAILY-LOG.md", "ROADMAP.md", "README.md", "LICENSE",
];

const edit = (file, fn) => {
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) fs.writeFileSync(file, after);
};

// Bottom-left is the one corner none of the games use (their toasts sit
// bottom-centre). z-index 30 keeps it under every game's modals (z-40+).
const homeButton = href => `
<a id="pgm-home" href="${href}" aria-label="All games" title="All games" style="position:fixed;left:calc(env(safe-area-inset-left) + 10px);bottom:calc(env(safe-area-inset-bottom) + 10px);z-index:30;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(17,26,46,.85);border:1px solid #27324a;color:#cbd5e1;text-decoration:none;font:600 18px/1 -apple-system,system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4)">&#8962;</a>
`;

function copyGame(slug) {
  const dest = path.join(OUT, slug);
  fs.cpSync(path.join(ROOT, slug), dest, { recursive: true });
  for (const junk of PRUNE) fs.rmSync(path.join(dest, junk), { recursive: true, force: true });
  const index = path.join(dest, "index.html");
  if (!fs.existsSync(index)) throw new Error(`${slug}: no index.html`);
  edit(index, s => s.replace(/<\/body>(?![\s\S]*<\/body>)/, homeButton(IOS ? "../index.html" : "../") + "</body>"));
  console.log(`  ${slug}`);
}

function dirSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) total += fs.statSync(path.join(e.parentPath ?? e.path, e.name)).size;
  }
  return total;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(SITE, OUT, { recursive: true });
console.log(`Pocket GM → ${path.relative(ROOT, OUT)}/`);

for (const slug of GAMES) copyGame(slug);

if (IOS) {
  // No service workers on file://, and the menu's links need explicit files.
  fs.rmSync(path.join(OUT, "sw.js"), { force: true });
  // The "put it on your home screen" panel and the browser wording mean nothing
  // inside the app.
  edit(path.join(OUT, "index.html"), s => s
    .replace(/href="(soccer|baseball|hockey)\/"/g, 'href="$1/index.html"')
    .replace(/\s*<section class="panel">[\s\S]*?<\/section>/, "")
    .replace("run entirely in your browser. No account, no install required,", "run entirely on your phone. No account, no internet needed,"));
}

console.log(`Done — ${(dirSize(OUT) / 1e6).toFixed(1)} MB`);
