import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";
import { appDataDir, candidatePaths } from "../src/discover.ts";
import type { Platform } from "../src/discover.ts";
import { scanFiles } from "../src/scan.ts";

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const repo = join(fixtures, "repo");
const emptyRepo = join(fixtures, "edge");

/** Candidate paths relative to their base, with forward slashes, for comparing across OSes. */
function rel(base: string, path: string): string {
  return relative(base, path).split(sep).join("/");
}

test("repo configs: .mcp.json, .vscode/mcp.json and .cursor/mcp.json", () => {
  const list = candidatePaths({ cwd: repo, home: join(fixtures, "homes", "linux"), platform: "linux", env: {} });
  assert.deepEqual(
    list.filter((c) => c.scope === "repo").map((c) => [rel(repo, c.path), c.client]),
    [
      [".mcp.json", "Claude Code"],
      [".vscode/mcp.json", "VS Code"],
      [".cursor/mcp.json", "Cursor"],
    ],
  );
});

const USER_PATHS: Record<Platform, [string, string][]> = {
  linux: [
    [".claude.json", "Claude Code"],
    [".config/Claude/claude_desktop_config.json", "Claude Desktop"],
    [".cursor/mcp.json", "Cursor"],
    [".config/Code/User/mcp.json", "VS Code"],
    [".config/Code/User/settings.json", "VS Code"],
  ],
  darwin: [
    [".claude.json", "Claude Code"],
    ["Library/Application Support/Claude/claude_desktop_config.json", "Claude Desktop"],
    [".cursor/mcp.json", "Cursor"],
    ["Library/Application Support/Code/User/mcp.json", "VS Code"],
    ["Library/Application Support/Code/User/settings.json", "VS Code"],
  ],
  win32: [
    [".claude.json", "Claude Code"],
    ["AppData/Roaming/Claude/claude_desktop_config.json", "Claude Desktop"],
    [".cursor/mcp.json", "Cursor"],
    ["AppData/Roaming/Code/User/mcp.json", "VS Code"],
    ["AppData/Roaming/Code/User/settings.json", "VS Code"],
  ],
};

for (const platform of ["linux", "darwin", "win32"] as const) {
  const home = join(fixtures, "homes", platform);

  test(`${platform}: per-user paths for Claude Code, Claude Desktop, Cursor and VS Code`, () => {
    const list = candidatePaths({ cwd: emptyRepo, home, platform, env: {} });
    assert.deepEqual(
      list.filter((c) => c.scope === "user").map((c) => [rel(home, c.path), c.client]),
      USER_PATHS[platform],
    );
  });

  test(`${platform}: a fixture home is found and every server in it is parsed`, () => {
    const reports = scanFiles(candidatePaths({ cwd: emptyRepo, home, platform, env: {} }));
    assert.ok(reports.length >= 3, `expected at least three configs in the ${platform} home`);
    for (const r of reports) {
      assert.equal(r.status, "ok", `${r.path} should parse`);
      assert.equal(r.problems.length, 0);
      assert.ok(r.servers.length > 0, `${r.path} should hold a server`);
    }
    const clients = new Set(reports.map((r) => r.client));
    for (const c of ["Claude Code", "Claude Desktop", "Cursor", "VS Code"]) {
      assert.ok(clients.has(c), `${platform} home should yield a ${c} config`);
    }
  });
}

test("APPDATA and XDG_CONFIG_HOME override the home-derived folders", () => {
  assert.equal(appDataDir({ home: "h", platform: "win32", env: { APPDATA: "roaming" } }), "roaming");
  assert.equal(appDataDir({ home: "h", platform: "linux", env: { XDG_CONFIG_HOME: "xdg" } }), "xdg");
  assert.equal(appDataDir({ home: "h", platform: "darwin", env: { APPDATA: "ignored" } }), join("h", "Library", "Application Support"));
});

test("a repo that is also the home folder is not checked twice", () => {
  const home = join(fixtures, "homes", "linux");
  const list = candidatePaths({ cwd: home, home, platform: "linux", env: {} });
  const cursor = list.filter((c) => rel(home, c.path) === ".cursor/mcp.json");
  assert.equal(cursor.length, 1);
});

test("the repo fixture: three configs, JSONC and a remote server included", () => {
  const reports = scanFiles(candidatePaths({ cwd: repo, home: join(fixtures, "no-such-home"), platform: "linux", env: {} }));
  assert.deepEqual(
    reports.map((r) => [rel(repo, r.path), r.status, r.servers.map((s) => s.server.name)]),
    [
      [".mcp.json", "ok", ["filesystem", "build-helper"]],
      [".vscode/mcp.json", "ok", ["docs-search", "fetch"]],
      [".cursor/mcp.json", "ok", ["notes"]],
    ],
  );
});

test("servers under projects.<path> in ~/.claude.json keep their project", () => {
  const home = join(fixtures, "homes", "linux");
  const [claude] = scanFiles(candidatePaths({ cwd: emptyRepo, home, platform: "linux", env: {} }));
  assert.equal(rel(home, claude.path), ".claude.json");
  assert.deepEqual(
    claude.servers.map((s) => [s.server.name, s.server.scope]),
    [
      ["user-memory", undefined],
      ["project-db", "/home/fixture/work/app"],
    ],
  );
  assert.ok(claude.findings.some((f) => f.server === "project-db" && f.scope === "/home/fixture/work/app"));
});
