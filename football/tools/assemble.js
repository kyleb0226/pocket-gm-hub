#!/usr/bin/env node
// Builds index.html from tools/template.html + src/*.js (in filename order).
// The game ships as one file like the other Pocket GM games; src/ is only how it's edited.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const src = fs.readdirSync(path.join(ROOT, "src")).filter(f => /\.jsx?$/.test(f)).sort().map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(ROOT, "src", f), "utf8")).join("\n");
if (src.includes("</script>")) throw new Error("src contains a literal </script>");
const out = fs.readFileSync(path.join(__dirname, "template.html"), "utf8").replace("/*__APP__*/", () => src);
fs.writeFileSync(path.join(ROOT, "index.html"), out);
console.log(`index.html — ${(out.length / 1024).toFixed(0)} KB from ${fs.readdirSync(path.join(ROOT, "src")).length} source files`);
