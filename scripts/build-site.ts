// Write the demo to `_site/`: the static files in `site/`, plus `dist/demo.js` and every module it
// imports, compiled by tsc. Run by `npm run build` after tsc. Following demo.js's imports (rather
// than copying all of dist/) keeps the Node-only modules off the page; one that tried to come
// along would import a bare specifier, and this fails the build.

import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";

const root = new URL("../", import.meta.url);
const out = new URL("_site/", root);
rmSync(out, { recursive: true, force: true });
cpSync(new URL("site/", root), out, { recursive: true });
mkdirSync(new URL("js/", out));

const queue = ["demo.js"];
for (const file of queue) {
  const text = readFileSync(new URL(`dist/${file}`, root), "utf8");
  for (const [, spec] of text.matchAll(/^\s*(?:import|export)\s[^;]*?\sfrom\s+"([^"]+)"/gm)) {
    if (!spec.startsWith("./")) throw new Error(`dist/${file} imports ${spec}, which the browser can't load`);
    if (!queue.includes(spec.slice(2))) queue.push(spec.slice(2));
  }
  cpSync(new URL(`dist/${file}`, root), new URL(`js/${file}`, out));
}
console.log(`_site/: site/ plus ${queue.length} modules (${queue.join(", ")})`);
