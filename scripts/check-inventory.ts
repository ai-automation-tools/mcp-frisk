// CI's inventory check: `node scripts/check-inventory.ts <report.json>` validates an
// `mcpfrisk --json` report against the vendored agent inventory schema, and fails unless the
// problem planted in tests/fixtures/ci-home/ (a `bash -c` server holding a fake key) is in it.

import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { Inventory } from "../src/inventory.ts";

const file = process.argv[2];
if (!file) throw new Error("usage: node scripts/check-inventory.ts <report.json>");

const schema = JSON.parse(readFileSync(new URL("../schemas/agent-inventory.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats.default(ajv);
const validate = ajv.compile(schema);
const doc = JSON.parse(readFileSync(file, "utf8")) as Inventory;
if (!validate(doc)) throw new Error(`${file} doesn't validate:\n${JSON.stringify(validate.errors, null, 2)}`);

const server = doc.identities.find((i) => i.id.endsWith("/.claude.json#planted-shell"));
if (!server) throw new Error(`${file} has no identity for the planted-shell server`);
const id = server.id;
if (server.credentials?.length !== 1) throw new Error(`${id} should hold one credential`);
const rules = doc.findings.filter((f) => f.identityId === id).map((f) => f.ruleId);
for (const rule of ["mcp-frisk/shell-wrapper", "mcp-frisk/plaintext-secret"]) {
  if (!rules.includes(rule)) throw new Error(`${id} is missing a ${rule} finding (has ${rules.join(", ") || "none"})`);
}
console.log(`${file}: valid agent inventory v0.1, planted problem found (${rules.join(", ")})`);
