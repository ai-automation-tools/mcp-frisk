import { test } from "node:test";
import assert from "node:assert/strict";
import { getEntry, MAX_DEPTH, parseJsonc } from "../src/jsonc.ts";
import type { JsonNode } from "../src/jsonc.ts";

function root(text: string): JsonNode | undefined {
  const r = parseJsonc(text);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  return r.root;
}

test("parses plain JSON the way JSON.parse reads it", () => {
  const node = root('{"a": [1, -2.5e3, true, false, null, "x\\n\\u0041"]}');
  const a = getEntry(node, "a")?.value;
  assert.equal(a?.type, "array");
  if (a?.type !== "array") return;
  assert.deepEqual(
    a.items.map((i) => ("value" in i ? i.value : null)),
    [1, -2500, true, false, null, "x\nA"],
  );
});

test("accepts line comments, block comments and trailing commas", () => {
  const node = root('// head\n{ /* a */ "a": 1, // tail\n "b": [1, 2,], }\n');
  assert.equal(getEntry(node, "a")?.value.type, "number");
  const b = getEntry(node, "b")?.value;
  assert.equal(b?.type === "array" ? b.items.length : -1, 2);
});

test("records the line of every key and value, CRLF included", () => {
  const node = root('{\r\n  "a": 1,\r\n\r\n  "b":\r\n    "x"\r\n}');
  assert.equal(getEntry(node, "a")?.keyLine, 2);
  assert.equal(getEntry(node, "b")?.keyLine, 4);
  assert.equal(getEntry(node, "b")?.value.line, 5);
});

test("an empty or whitespace-only document has no root", () => {
  assert.deepEqual(parseJsonc(""), { ok: true, root: undefined });
  assert.deepEqual(parseJsonc("  \n// nothing\n"), { ok: true, root: undefined });
});

test("skips a byte-order mark", () => {
  assert.equal(root('﻿{"a": 1}')?.type, "object");
});

test("the last duplicate key wins, and __proto__ is just a key", () => {
  const node = root('{"a": 1, "a": 2, "__proto__": {"polluted": true}}');
  const a = getEntry(node, "a")?.value;
  assert.equal(a?.type === "number" ? a.value : 0, 2);
  assert.equal(getEntry(node, "__proto__")?.value.type, "object");
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("reports malformed input with a line and a reason, never the content", () => {
  const cases: [string, number, RegExp][] = [
    ['{\n  "a": 1\n  "b": 2\n}', 3, /expected ',' or '}'/],
    ['{"a": [1, 2', 1, /unterminated array/],
    ['{\n"a": "secret-ish value', 2, /unterminated string/],
    ["{'a': 1}", 1, /quoted property name/],
    ['{"a": 1} extra', 1, /after the top-level value/],
    ["/* open", 1, /unterminated block comment/],
    ['{"a": tru}', 1, /unexpected character/],
    ['{"a": "\\q"}', 1, /bad escape/],
  ];
  for (const [text, line, reason] of cases) {
    const r = parseJsonc(text);
    assert.equal(r.ok, false, text);
    if (r.ok) continue;
    assert.equal(r.line, line, text);
    assert.match(r.reason, reason, text);
    assert.ok(!r.reason.includes("secret-ish"), "reason must not echo input");
  }
});

test("caps nesting depth instead of overflowing the stack", () => {
  const deep = "[".repeat(MAX_DEPTH + 10) + "]".repeat(MAX_DEPTH + 10);
  const r = parseJsonc(deep);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /nesting deeper/);
  assert.ok(parseJsonc("[".repeat(100) + "]".repeat(100)).ok);
});
