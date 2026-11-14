import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { friskText } from "../src/frisk.ts";
import { entropy, redact } from "../src/secrets.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/rules/${name}`, import.meta.url), "utf8");

function secretsOf(name: string) {
  const r = friskText(fixture(name));
  assert.equal(r.status, "ok");
  return r.servers.flatMap((s) => s.secrets.map((h) => ({ server: s.server.name, ...h })));
}

test("each provider's key is named and shown as prefix plus last four", () => {
  const hits = secretsOf("plaintext-secret.fires.json");
  assert.deepEqual(
    hits.map((h) => [h.server, h.provider, h.where, h.shown, h.severity]),
    [
      ["anthropic", "Anthropic API key", "env ANTHROPIC_API_KEY", "sk-ant-…aA1b", "high"],
      ["openai", "OpenAI API key", "args[1]", "sk-proj-…cC3d", "high"],
      ["huggingface", "Hugging Face token", "env HF_TOKEN", "hf_…eE5f", "high"],
      ["aws", "AWS access key id", "args[4]", "AKIA…MPLE", "high"],
      ["github", "GitHub token", "env GITHUB_PERSONAL_ACCESS_TOKEN", "ghp_…gG7h", "high"],
      ["github", "GitHub token", "env GITHUB_FINE_GRAINED", "github_pat_…iI9j", "high"],
      ["stripe", "Stripe key", "args[2]", "sk_test_…kK2l", "high"],
    ],
  );
});

test("a key inside a longer arg is cut out on its own, so its fingerprint is of the key", () => {
  const [openai] = secretsOf("plaintext-secret.fires.json").filter((h) => h.server === "openai");
  assert.match(openai.value, /^sk-proj-FAKE/);
  const [arg] = secretsOf("high-entropy-string.fires.json").filter((h) => h.server === "token-arg");
  assert.match(arg.value, /^FAKE/);
});

test("a random-looking string with no known prefix is a low finding, shown as its last four", () => {
  const hits = secretsOf("high-entropy-string.fires.json");
  assert.deepEqual(hits.map((h) => [h.server, h.ruleId, h.severity, h.shown]), [
    ["session", "mcp-frisk/high-entropy-string", "low", "…3gJs"],
    ["token-arg", "mcp-frisk/high-entropy-string", "low", "…Y6hJ"],
  ]);
});

test("a known key is reported once, not again by a looser pattern or the entropy check", () => {
  const r = friskText(fixture("plaintext-secret.fires.json"));
  assert.equal(r.findings.filter((f) => f.ruleId === "mcp-frisk/high-entropy-string").length, 0);
  assert.equal(r.findings.filter((f) => f.ruleId === "mcp-frisk/plaintext-secret").length, 7);
});

test("finding messages carry the redacted form and never the key", () => {
  for (const name of ["plaintext-secret.fires.json", "high-entropy-string.fires.json"]) {
    const r = friskText(fixture(name));
    assert.equal(r.status, "ok");
    for (const s of r.servers) {
      for (const h of s.secrets) {
        const msgs = s.findings.map((f) => f.message);
        assert.ok(msgs.some((m) => m.endsWith(h.shown)), `a message shows ${h.shown}`);
        assert.ok(msgs.every((m) => !m.includes(h.value)));
      }
    }
  }
});

test("redact and entropy", () => {
  assert.equal(redact("sk-FAKEabcdefghijklmnopqrst1a2b", "sk-"), "sk-…1a2b");
  assert.equal(entropy("aaaa"), 0);
  assert.equal(entropy("abcd"), 2);
});
