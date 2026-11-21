// The browser demo, run against a stand-in page with every way to send data stubbed to fail.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTEXT_RULES, RULES } from "../src/rules.ts";
import { SECRET_RULES } from "../src/secrets.ts";
import type { PageElement } from "../src/demo.ts";

const sent: string[] = [];
const blocked = (name: string) => () => {
  sent.push(name);
  throw new Error(`demo test: ${name} is blocked`);
};
globalThis.fetch = blocked("fetch") as unknown as typeof fetch;
Object.assign(globalThis, {
  XMLHttpRequest: blocked("XMLHttpRequest"),
  WebSocket: blocked("WebSocket"),
  EventSource: blocked("EventSource"),
});
Object.defineProperty(globalThis, "navigator", { value: { sendBeacon: blocked("sendBeacon") }, configurable: true });
const { mount, SAMPLE } = await import("../src/demo.ts");

const html = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const ALL_RULES = [...RULES, ...Object.values(CONTEXT_RULES), ...Object.values(SECRET_RULES)].map((r) => `mcp-frisk/${r.id}`);

function page() {
  const listeners = new Map<string, () => void>();
  const els: Record<string, PageElement> = {};
  for (const id of ["config", "project", "sample", "findings"]) {
    els[id] = { value: "", checked: false, textContent: "", addEventListener: (type, fn) => listeners.set(`${id} ${type}`, fn) };
  }
  mount({ getElementById: (id) => els[id] ?? null });
  const fire = (id: string, type: string) => {
    const fn = listeners.get(`${id} ${type}`);
    assert.ok(fn, `no ${type} listener on #${id}`);
    fn();
    return els.findings.textContent ?? "";
  };
  const paste = (text: string) => {
    els.config.value = text;
    return fire("config", "input");
  };
  return { els, fire, paste };
}

test("the page's script mounts the demo module from a relative path", () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const [, attrs, body] = scripts[0];
  assert.match(attrs, /type="module"/);
  assert.equal(body.trim().replace(/\s+/g, " "), 'import { mount } from "./js/demo.js"; mount(document);');
  for (const id of ["config", "project", "sample", "findings"]) assert.match(html, new RegExp(`id="${id}"`));
});

test("the sample plants one problem of each kind and the page reports them all", () => {
  const { els, fire } = page();
  const out = fire("sample", "click");
  assert.equal(els.config.value, SAMPLE);
  assert.equal(els.project.checked, true);
  for (const id of ALL_RULES) assert.ok(out.includes(id), `sample doesn't fire ${id}`);
  assert.deepEqual(sent, []);
});

test("the sample's keys are fake, and the page shows them redacted", () => {
  const keys = [...SAMPLE.matchAll(/[A-Za-z0-9_-]*FAKE[A-Za-z0-9_-]*/g)].map((m) => m[0]);
  assert.equal(keys.length, 2);
  const out = page().fire("sample", "click");
  for (const key of keys) {
    assert.ok(!out.includes(key), "a planted key is printed in full");
    assert.ok(out.includes(`…${key.slice(-4)}`), "a planted key is missing its redacted form");
  }
  assert.ok(out.includes("ghp_…"));
});

test("a pasted config is frisked as it's typed, project rules only when ticked", () => {
  const { fire, paste, els } = page();
  const trustfall = readFileSync(new URL("./fixtures/trustfall/.mcp.json", import.meta.url), "utf8");
  let out = paste(trustfall);
  assert.match(out, /mcp-frisk\/inline-code/);
  assert.doesNotMatch(out, /project-server/);
  els.project.checked = true;
  out = fire("project", "change");
  assert.match(out, /mcp-frisk\/project-server/);
  assert.deepEqual(sent, []);
});

test("bad pastes get a reason, not a crash", () => {
  const { paste } = page();
  assert.match(paste(""), /pasted config: empty file/);
  assert.match(paste('{ "mcpServers": { "a": '), /pasted config: unparseable at line 1/);
  assert.match(paste('{ "mcpServers": { "safe": { "command": "npx", "args": ["-y", "example-mcp"] } } }'), /No findings\./);
  assert.deepEqual(sent, []);
});

test("a missing element fails loudly", () => {
  assert.throws(() => mount({ getElementById: () => null }), /missing #config/);
});
