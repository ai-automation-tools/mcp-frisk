import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { MAX_CONFIG_BYTES, scanFiles } from "../src/scan.ts";
import type { FileSystem } from "../src/scan.ts";
import type { Candidate } from "../src/discover.ts";

const edge = fileURLToPath(new URL("./fixtures/edge/", import.meta.url));
const at = (name: string, scope: Candidate["scope"] = "repo"): Candidate => ({ path: join(edge, name), client: "Claude Code", scope });

test("an empty file is an empty config, not an error", () => {
  const [r] = scanFiles([at("empty.json")]);
  assert.equal(r.status, "ok");
  assert.ok(r.status === "ok" && r.empty);
  assert.deepEqual(r.servers, []);
});

test("{} is a config with no servers", () => {
  const [r] = scanFiles([at("empty-object.json")]);
  assert.equal(r.status, "ok");
  assert.ok(r.status === "ok" && !r.empty);
  assert.deepEqual(r.servers, []);
});

test("malformed JSON is unparseable, with the line and a reason", () => {
  const [r] = scanFiles([at("malformed.json")]);
  assert.equal(r.status, "unparseable");
  if (r.status !== "unparseable") return;
  assert.equal(r.line, 4);
  assert.match(r.reason, /expected ',' or '}'/);
});

test("a bad entry is reported with a reason while the good ones still parse", () => {
  const [r] = scanFiles([at("bad-entries.json")]);
  assert.equal(r.status, "ok");
  assert.deepEqual(r.servers.map((s) => s.server.name), ["good", "__proto__"]);
  assert.deepEqual(
    r.problems.map((p) => [p.name, p.reason]),
    [
      ["not-an-object", "the entry is a string, not an object"],
      ["numeric-command", "`command` is a number, not a string"],
      ["args-string", "`args` is a string, not an array"],
      ["args-number", "`args[1]` is a number, not a string"],
      ["nothing-to-run", "no `command` or `url`"],
    ],
  );
});

test("an unreadable file is reported with a reason, not thrown", () => {
  // A folder where a config should be: reading it fails on every OS.
  const [dir] = scanFiles([{ path: edge, client: "Cursor", scope: "user" }]);
  assert.equal(dir.status, "unreadable");
  assert.ok(dir.status === "unreadable" && /folder/.test(dir.reason));

  const denied: FileSystem = {
    size: () => 10,
    read: () => {
      throw Object.assign(new Error("EACCES: permission denied, open '/fixture/secret/path'"), { code: "EACCES" });
    },
  };
  const [r] = scanFiles([at("whatever.json")], denied);
  assert.equal(r.status, "unreadable");
  assert.ok(r.status === "unreadable" && r.reason === "permission denied");
});

test("missing files are skipped during discovery but reported when named", () => {
  assert.deepEqual(scanFiles([at("absent.json")]), []);
  const [r] = scanFiles([at("absent.json", "given")]);
  assert.ok(r.status === "unreadable" && r.reason === "no such file");
});

test("a file over the size cap is refused, not loaded", () => {
  let read = false;
  const huge: FileSystem = { size: () => MAX_CONFIG_BYTES + 1, read: () => ((read = true), "{}") };
  const [r] = scanFiles([at("huge.json")], huge);
  assert.equal(r.status, "unreadable");
  assert.equal(read, false);
});
