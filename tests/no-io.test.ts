// The CLI runs with every socket, DNS and process API trapped (tests/helpers/no-io.ts) and must
// still frisk the fixtures, in text and JSON, without tripping one. This test spawns `node`
// itself to get a clean process; mcp-frisk's own code never does (see tests/cli.test.ts).

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const helper = new URL("./helpers/no-io.ts", import.meta.url).href;
const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));

function node(args: string[]) {
  return spawnSync(process.execPath, ["--import", helper, ...args], { cwd: join(fixtures, "repo"), encoding: "utf8" });
}

test("the trap works: a socket or a child process under it is reported", () => {
  const r = node(["--input-type=module", "-e", "import net from 'node:net'; import cp from 'node:child_process'; try { net.connect(80) } catch {} try { cp.spawnSync('x') } catch {} try { await fetch('http://x.test') } catch {}"]);
  assert.match(r.stderr, /NO-IO VIOLATION: net\.connect, child_process\.spawnSync, fetch/);
});

test("the CLI frisks fixtures in text and JSON with sockets and processes blocked", () => {
  const home = join(fixtures, "homes", "linux");
  const runs = [
    node([cli, "--home", home]),
    node([cli, "--json", "--home", home]),
    node([cli, "--fail-on", "high", join(fixtures, "rules", "plaintext-secret.fires.json")]),
  ];
  for (const r of runs) {
    assert.doesNotMatch(r.stderr, /NO-IO VIOLATION/);
    assert.equal(r.error, undefined);
  }
  assert.equal(runs[0].status, 0);
  assert.match(runs[0].stdout, /mcp-frisk\/shell-wrapper/);
  assert.equal(JSON.parse(runs[1].stdout).schemaVersion, "0.1");
  assert.equal(runs[2].status, 1);
  assert.match(runs[2].stdout, /sk-ant-…aA1b/);
});
