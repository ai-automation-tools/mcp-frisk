import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { displayPath, run } from "../src/main.ts";
import { clean } from "../src/format.ts";
import { VERSION } from "../src/version.ts";

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const repo = join(fixtures, "repo");
const src = fileURLToPath(new URL("../src/", import.meta.url));

const base = { cwd: repo, home: join(fixtures, "homes", "linux"), platform: "linux" as const, env: {} };

test("a run over the fixture repo and home lists findings as file:line, severity, rule, server", () => {
  const r = run({ ...base, argv: [] });
  assert.equal(r.code, 0);
  assert.equal(r.stderr, "");
  assert.match(r.stdout, /^mcpfrisk \d+\.\d+\.\d+: checked 10 locations, found 7 configs with 10 servers\./);
  assert.match(r.stdout, /\.mcp\.json:9 +high +mcp-frisk\/shell-wrapper +build-helper +"bash -c"/);
  assert.match(r.stdout, /\.cursor\/mcp\.json:3 +medium +mcp-frisk\/shell-variable +notes +unquoted shell variable "\$HOME"/);
  assert.match(r.stdout, /~\/\.claude\.json:9 +high +mcp-frisk\/shell-wrapper +project-db \[project \/home\/fixture\/work\/app\]/);
  assert.match(r.stdout, /~\/\.config\/Claude\/claude_desktop_config\.json \(Claude Desktop, user\): 1 server, 0 findings/);
  assert.match(r.stdout, /\.mcp\.json:4 +info +mcp-frisk\/project-server +filesystem +the repo ships this server: the client runs "npx"/);
  assert.match(r.stdout, /no findings: docs-search \(remote\)\n/);
  assert.match(r.stdout, /no findings: user-memory \(npx -y <pkg>\)/);
  assert.match(r.stdout, /\n10 findings: 3 high, 3 medium, 4 info\.\n$/);
});

test("named files replace discovery, and edge cases print a reason", () => {
  const r = run({ ...base, cwd: join(fixtures, "edge"), argv: ["empty.json", "malformed.json", "absent.json"] });
  assert.equal(r.code, 0);
  assert.match(r.stdout, /checked 3 locations/);
  assert.match(r.stdout, /\nempty\.json: empty file\n/);
  assert.match(r.stdout, /\nmalformed\.json: unparseable at line 4, expected ',' or '}'\n/);
  assert.match(r.stdout, /\nabsent\.json: unreadable, no such file\n/);
  assert.match(r.stdout, /No findings\.\n$/);
});

test("--home overrides the home folder and ignores APPDATA from the real environment", () => {
  const r = run({ ...base, platform: "win32", env: { APPDATA: join(fixtures, "nowhere") }, argv: ["--home", join(fixtures, "homes", "win32")] });
  assert.match(r.stdout, /AppData\/Roaming\/Claude\/claude_desktop_config\.json \(Claude Desktop, user\)/);
  assert.match(r.stdout, /low +mcp-frisk\/shell-wrapper +win-desktop/);
  assert.match(r.stdout, /high +mcp-frisk\/shell-wrapper +win-vscode +"powershell -command"/);
});

test("--help, --version and a bad flag", () => {
  assert.match(run({ ...base, argv: ["--help"] }).stdout, /^Usage: mcpfrisk/);
  assert.equal(run({ ...base, argv: ["-v"] }).stdout, `mcpfrisk ${VERSION}\n`);
  const bad = run({ ...base, argv: ["--nope"] });
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /Usage: mcpfrisk/);
});

test("hostile names can't send control characters to the terminal", () => {
  const hostile = JSON.stringify({
    mcpServers: {
      "evil\u001b[2J‮name": { command: "sh", args: ["-c", "x"] },
      "\u0007bell": { command: "node", args: [5] },
    },
  });
  const fs = { size: () => hostile.length, read: () => hostile };
  const r = run({ ...base, fs, argv: ["hostile.json"] });
  const raw = [...r.stdout].filter((ch) => {
    const c = ch.charCodeAt(0);
    return (c < 0x20 && ch !== "\n") || c === 0x7f || c === 0x202e;
  });
  assert.deepEqual(raw, []);
  assert.match(r.stdout, /evil\\u001b\[2J\\u202ename/);
  assert.match(r.stdout, /\\u0007bell/);
  assert.equal(clean("a\u001b[31mb‮c"), "a\\u001b[31mb\\u202ec");
});

test("displayPath shows repo files relative and home files under ~", () => {
  assert.equal(displayPath(join(repo, ".vscode", "mcp.json"), repo, fixtures), ".vscode/mcp.json");
  assert.equal(displayPath(join(fixtures, "homes", "x.json"), repo, fixtures), "~/homes/x.json");
});

// ADR-001: the demo imports these, so they may not import Node built-ins, at runtime or at all.
const BROWSER_SAFE = ["jsonc.ts", "servers.ts", "rules.ts", "secrets.ts", "frisk.ts", "format.ts"];

test("rule, parser and format modules import nothing but each other", () => {
  for (const file of BROWSER_SAFE) {
    const text = readFileSync(join(src, file), "utf8");
    for (const m of text.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gm)) {
      const [, typeOnly, spec] = m;
      if (typeOnly) continue;
      assert.ok(BROWSER_SAFE.includes(spec.replace(/^\.\//, "")), `${file} imports ${spec} at runtime`);
    }
    assert.ok(!/["']node:|\brequire\(|\bprocess\./.test(text.replace(/^\s*import\s+type[^;]*;/gm, "")), `${file} touches Node`);
  }
});

test("no source file can run a process, open a socket or evaluate config text", () => {
  for (const file of readdirSync(src).filter((f) => f.endsWith(".ts"))) {
    const text = readFileSync(join(src, file), "utf8");
    for (const banned of [/child_process/, /node:net\b/, /node:http/, /node:https/, /\bfetch\(/, /\beval\(/, /new Function\b/, /node:vm/, /node:worker_threads/]) {
      assert.ok(!banned.test(text), `${file} matches ${banned}`);
    }
  }
});
