import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { run } from "../src/main.ts";
import { SCHEMA_ID } from "../src/inventory.ts";
import type { Inventory } from "../src/inventory.ts";

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const repo = join(fixtures, "repo");
const rules = join(fixtures, "rules");
const base = { cwd: repo, home: join(fixtures, "homes", "linux"), platform: "linux" as const, env: {}, now: new Date("2026-11-13T00:00:00Z") };

const schema = JSON.parse(readFileSync(new URL("../schemas/agent-inventory.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats.default(ajv);
const validate = ajv.compile(schema);

function inventory(argv: string[], cwd = repo): Inventory {
  const r = run({ ...base, cwd, argv: ["--json", ...argv] });
  assert.equal(r.stderr, "");
  return JSON.parse(r.stdout) as Inventory;
}

function assertValid(doc: unknown): void {
  assert.ok(validate(doc), JSON.stringify(validate.errors, null, 2));
}

const ALL_FIXTURES = readdirSync(fixtures, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".json"))
  .map((e) => relative(repo, join(e.parentPath, e.name)));

test("the vendored schema is the published v0.1", () => {
  assert.equal(schema.$id, SCHEMA_ID);
  assert.equal(schema.properties.schemaVersion.const, "0.1");
});

test("--json over the fixture repo and home validates against the agent inventory schema", () => {
  const doc = inventory([]);
  assertValid(doc);
  assert.equal(doc.schemaVersion, "0.1");
  assert.equal(doc.generatedAt, "2026-11-13T00:00:00.000Z");
  assert.equal(doc.producer.name, "mcp-frisk");
  assert.equal(doc.identities.length, 10);
  assert.equal(doc.x.checked, 8);
  for (const id of doc.identities) {
    assert.equal(id.kind, "mcp-server");
    assert.equal(id.platform, "mcp");
  }
  const helper = doc.identities.find((i) => i.id === "mcp:.mcp.json#build-helper");
  assert.ok(helper);
  assert.deepEqual(helper.tools, [{ name: "build-helper", capabilities: ["execute-shell"] }]);
  assert.deepEqual(helper.tags, ["client:Claude Code", "scope:repo", "transport:stdio"]);
  assert.ok(doc.identities.some((i) => i.id === "mcp:~/.claude.json#/home/fixture/work/app/project-db"));
  assert.deepEqual(
    doc.findings.filter((f) => f.identityId === helper.id).map((f) => [f.id, f.ruleId, f.severity]),
    [
      ["mcp:.mcp.json#build-helper#mcp-frisk/shell-wrapper/1", "mcp-frisk/shell-wrapper", "high"],
      ["mcp:.mcp.json#build-helper#mcp-frisk/shell-operator/1", "mcp-frisk/shell-operator", "medium"],
    ],
  );
  assert.ok(doc.findings.every((f) => f.ruleId.startsWith("mcp-frisk/") && doc.identities.some((i) => i.id === f.identityId)));
});

test("every fixture's report validates, edge cases included", () => {
  assertValid(inventory(ALL_FIXTURES));
  const edge = inventory(["empty.json", "malformed.json", "bad-entries.json", "absent.json"], join(fixtures, "edge"));
  assertValid(edge);
  assert.deepEqual(edge.x.files.map((f) => f.status), ["ok", "unparseable", "ok", "unreadable"]);
});

test("ids are the same from run to run", () => {
  const a = inventory([]);
  const b = inventory([]);
  assert.deepEqual(a, b);
  assert.equal(new Set(a.findings.map((f) => f.id)).size, a.findings.length);
});

test("credentials are listed by a 12-hex fingerprint, with capability tags inferred", () => {
  const doc = inventory([join(rules, "plaintext-secret.fires.json")]);
  assertValid(doc);
  const creds = doc.identities.flatMap((i) => i.credentials);
  assert.equal(creds.length, 7);
  for (const c of creds) assert.match(c.fingerprint, /^[0-9a-f]{12}$/);
  const anthropic = doc.identities.find((i) => i.displayName === "anthropic");
  assert.deepEqual(anthropic?.credentials[0].type, "api-key");
  assert.deepEqual(anthropic?.tools[0].capabilities, ["read-secrets", "network-egress"]);
  assert.equal(doc.identities.find((i) => i.displayName === "github")?.credentials[0].type, "personal-access-token");
  assert.equal(doc.identities.find((i) => i.displayName === "aws")?.credentials[0].type, "access-key");

  const refs = inventory([join(rules, "plaintext-secret.passes.json")]);
  assert.deepEqual(refs.identities.find((i) => i.displayName === "env-references")?.credentials, []);
  assert.deepEqual(refs.identities.find((i) => i.displayName === "env-references")?.tools[0].capabilities, ["read-secrets", "network-egress"]);
});

test("no output ever holds a fixture secret in full", () => {
  const planted = new Set<string>();
  for (const f of ALL_FIXTURES) {
    for (const m of readFileSync(join(repo, f), "utf8").matchAll(/[A-Za-z0-9_-]*FAKE[A-Za-z0-9_-]*/g)) {
      if (m[0].length >= 16) planted.add(m[0]);
    }
  }
  assert.ok(planted.size >= 9, "the fixtures plant at least nine keys");
  const outputs = [
    run({ ...base, argv: [] }),
    run({ ...base, argv: ["--json"] }),
    run({ ...base, argv: ALL_FIXTURES }),
    run({ ...base, argv: ["--json", ...ALL_FIXTURES] }),
    run({ ...base, argv: ["--fail-on", "low", ...ALL_FIXTURES] }),
  ];
  for (const r of outputs) {
    for (const key of planted) {
      assert.ok(!r.stdout.includes(key) && !r.stderr.includes(key), `output holds ${key.slice(0, 8)}…`);
    }
  }
});

test("--fail-on exits 1 when a finding meets the severity, 0 when none does", () => {
  const entropy = join(rules, "high-entropy-string.fires.json");
  assert.equal(run({ ...base, argv: [entropy] }).code, 0);
  assert.equal(run({ ...base, argv: ["--fail-on", "low", entropy] }).code, 1);
  assert.equal(run({ ...base, argv: ["--fail-on", "info", entropy] }).code, 1);
  assert.equal(run({ ...base, argv: ["--fail-on", "medium", entropy] }).code, 0);
  assert.equal(run({ ...base, argv: ["--fail-on", "high", "--json", join(rules, "plaintext-secret.fires.json")] }).code, 1);
  assert.equal(run({ ...base, argv: ["--fail-on", "critical", join(rules, "plaintext-secret.fires.json")] }).code, 0);
  const bad = run({ ...base, argv: ["--fail-on", "severe"] });
  assert.equal(bad.code, 2);
  assert.match(bad.stderr, /--fail-on takes one of critical, high, medium, low, info/);
});
