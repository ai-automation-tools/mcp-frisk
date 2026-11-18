// Slice 1b: a project config's servers, project settings that start them unasked, and the
// TrustFall shape end to end. The inline-code rule is covered by the rule loop in rules.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { friskText } from "../src/frisk.ts";
import { run } from "../src/main.ts";

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const fixture = (name: string) => readFileSync(join(fixtures, name), "utf8");
const ids = (r: ReturnType<typeof friskText>, ruleId: string) => r.findings.filter((f) => f.ruleId === ruleId);

test("project-server: every stdio server in a project config gets an info finding", () => {
  const r = friskText(fixture("rules/project-server.fires.json"), { project: true });
  const hits = ids(r, "mcp-frisk/project-server");
  assert.deepEqual(hits.map((f) => [f.server, f.severity]), [["packaged", "info"], ["local-script", "info"], ["binary", "info"]]);
  assert.match(hits[1].message, /runs "node" on this machine/);
});

test("project-server: no finding for a user config, or for remote servers", () => {
  assert.deepEqual(ids(friskText(fixture("rules/project-server.fires.json")), "mcp-frisk/project-server"), []);
  const remote = friskText(fixture("rules/project-server.passes.json"), { project: true });
  assert.equal(remote.servers.length, 2);
  assert.deepEqual(ids(remote, "mcp-frisk/project-server"), []);
});

test("auto-enable: enableAllProjectMcpServers and enabledMcpjsonServers are high findings", () => {
  const r = friskText(fixture("rules/auto-enable.fires.json"));
  assert.equal(r.status, "ok");
  assert.deepEqual(r.settings, r.findings);
  assert.deepEqual(
    r.findings.map((f) => [f.ruleId, f.severity, f.server, f.line]),
    [
      ["mcp-frisk/auto-enable", "high", "enableAllProjectMcpServers", 3],
      ["mcp-frisk/auto-enable", "high", "enabledMcpjsonServers", 4],
    ],
  );
  assert.match(r.findings[1].message, /starts 2 servers .*: "notes", "build-helper"$/);
});

test("auto-enable: off, empty, or only under projects.<path> (the user's own approvals) is no finding", () => {
  const r = friskText(fixture("rules/auto-enable.passes.json"));
  assert.equal(r.status, "ok");
  assert.deepEqual(r.findings, []);
});

test("auto-enable: a long server list is cut short and names are never quoted whole", () => {
  const names = ["a", "b", "c", "d", "e", "f", "g", "FAKE_NAME_THAT_IS_RATHER_LONG"];
  const r = friskText(JSON.stringify({ enabledMcpjsonServers: names }));
  assert.match(r.findings[0].message, /starts 8 servers .*"e" and 3 more$/);
  const long = friskText(JSON.stringify({ enabledMcpjsonServers: ["FAKE_NAME_THAT_IS_RATHER_LONG"] }));
  assert.ok(!long.findings[0].message.includes("FAKE_NAME_THAT_IS_RATHER_LONG"));
});

test("TrustFall's shape (a node -e server plus enableAllProjectMcpServers) is caught three ways", () => {
  const base = { cwd: join(fixtures, "trustfall"), home: join(fixtures, "no-such-home"), platform: "linux" as const, env: {} };
  const text = run({ ...base, argv: ["--fail-on", "high"] });
  assert.equal(text.code, 1);
  assert.match(text.stdout, /\.mcp\.json:4 +info +mcp-frisk\/project-server +project-helper/);
  assert.match(text.stdout, /\.mcp\.json:5 +high +mcp-frisk\/inline-code +project-helper +"node -e"/);
  assert.match(text.stdout, /\.claude\/settings\.json:2 +high +mcp-frisk\/auto-enable +enableAllProjectMcpServers/);
  assert.match(text.stdout, /\.claude\/settings\.json \(Claude Code, repo\): 0 servers, 1 finding/);

  const doc = JSON.parse(run({ ...base, argv: ["--json"] }).stdout);
  const settings = doc.identities.find((i: { id: string }) => i.id === "mcp:.claude/settings.json");
  assert.deepEqual(settings, {
    id: "mcp:.claude/settings.json",
    kind: "other",
    platform: "mcp",
    displayName: ".claude/settings.json (project settings)",
    status: "unknown",
    credentials: [],
    tools: [],
    tags: ["client:Claude Code", "scope:repo", "settings"],
  });
  assert.deepEqual(
    doc.findings.map((f: { identityId: string; ruleId: string }) => [f.identityId, f.ruleId]),
    [
      ["mcp:.mcp.json#project-helper", "mcp-frisk/project-server"],
      ["mcp:.mcp.json#project-helper", "mcp-frisk/inline-code"],
      ["mcp:.claude/settings.json", "mcp-frisk/auto-enable"],
    ],
  );
});
