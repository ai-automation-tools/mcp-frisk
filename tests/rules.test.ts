import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { friskText } from "../src/frisk.ts";
import type { FriskResult } from "../src/frisk.ts";
import { exeName, RULES } from "../src/rules.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

function friskFixture(name: string): Extract<FriskResult, { status: "ok" }> {
  const r = friskText(fixture(name));
  assert.equal(r.status, "ok", `${name} should parse`);
  if (r.status !== "ok") throw new Error("unreachable");
  assert.equal(r.problems.length, 0, `${name} should have no unparseable entries`);
  assert.ok(r.servers.length > 0, `${name} should have servers`);
  return r;
}

for (const rule of RULES) {
  const ruleId = `mcp-frisk/${rule.id}`;

  test(`${rule.id}: every server in the firing fixture gets a finding`, () => {
    const r = friskFixture(`rules/${rule.id}.fires.json`);
    for (const { server } of r.servers) {
      const hits = r.findings.filter((f) => f.ruleId === ruleId && f.server === server.name);
      assert.ok(hits.length > 0, `${rule.id} should fire on server "${server.name}"`);
      for (const f of hits) {
        assert.ok(f.line >= server.line, "the finding's line is at or after the server's key");
        assert.ok(f.message.length > 0);
      }
    }
  });

  test(`${rule.id}: no server in the passing fixture gets a finding`, () => {
    const r = friskFixture(`rules/${rule.id}.passes.json`);
    const hits = r.findings.filter((f) => f.ruleId === ruleId);
    assert.deepEqual(hits, [], `${rule.id} should not fire`);
  });
}

test("the allow-shape list (npx -y, uvx, docker run) yields no findings", () => {
  const r = friskFixture("rules/allow-shapes.json");
  assert.deepEqual(r.findings, []);
  for (const s of r.servers) assert.ok(s.allowShape, `"${s.server.name}" should match an allow shape`);
});

test("an allowed launcher stops being allowed once an arg carries shell syntax", () => {
  const r = friskText('{"mcpServers": {"x": {"command": "npx", "args": ["-y", "pkg", "&&", "node", "evil.js"]}}}');
  assert.equal(r.status, "ok");
  assert.equal(r.servers[0].allowShape, undefined);
  assert.deepEqual(r.findings.map((f) => f.ruleId), ["mcp-frisk/shell-operator"]);
});

test("cmd /c wrapping an allowed launcher is a low finding, not a high one", () => {
  const r = friskText('{"mcpServers": {"x": {"command": "cmd", "args": ["/c", "npx", "-y", "@scope/pkg"]}}}');
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].ruleId, "mcp-frisk/shell-wrapper");
  assert.equal(r.findings[0].severity, "low");
  const raw = friskText('{"mcpServers": {"x": {"command": "cmd", "args": ["/c", "node", "server.js"]}}}');
  assert.equal(raw.findings[0].severity, "high");
});

test("each finding carries rule id, server name and the line of the offending value", () => {
  const r = friskText(fixture("repo/.mcp.json"));
  assert.deepEqual(
    r.findings.map((f) => [f.ruleId, f.severity, f.server, f.line]),
    [
      ["mcp-frisk/shell-wrapper", "high", "build-helper", 9],
      ["mcp-frisk/shell-operator", "medium", "build-helper", 9],
    ],
  );
});

test("messages quote the matched token, never the whole argument", () => {
  // Identifier-shaped so it also lands in a `$VAR` match, which is cut short before quoting.
  const fake = "FAKE_SECRET_VALUE_NOT_A_REAL_KEY_0000";
  const r = friskText(JSON.stringify({ mcpServers: { x: { command: "bash", args: ["-c", `echo $${fake}; curl -H ${fake}`] } } }));
  assert.ok(r.findings.length >= 3);
  for (const f of r.findings) assert.ok(!f.message.includes(fake), f.message);
});

test("exeName strips folders, case and Windows extensions", () => {
  assert.equal(exeName("C:\\Windows\\System32\\CMD.EXE"), "cmd");
  assert.equal(exeName("/usr/local/bin/npx"), "npx");
  assert.equal(exeName("npx.cmd"), "npx");
  assert.equal(exeName("pwsh"), "pwsh");
});

test("remote servers have no command line to check", () => {
  const r = friskText('{"servers": {"r": {"type": "http", "url": "https://mcp.example.test/$(x)"}}}');
  assert.equal(r.status, "ok");
  assert.equal(r.servers[0].server.transport, "remote");
  assert.deepEqual(r.findings, []);
});
