// The `--json` report: an agent inventory document, schema v0.1
// (`schemas/agent-inventory.schema.json`, published at the `$id` below).
//
// Node-only: credential fingerprints use `node:crypto`. One identity per server, its id built
// from the displayed config path and the server name so it stays the same from run to run.
// Secrets appear only as a fingerprint here, never as a value or even the redacted form.

import { createHash } from "node:crypto";
import type { FileReport } from "./scan.ts";
import type { ServerReport } from "./frisk.ts";
import { argv, exeName, RULES } from "./rules.ts";
import type { Finding, Severity } from "./rules.ts";
import type { CredentialType } from "./secrets.ts";

export const SCHEMA_ID = "https://ai-automation-tools.dev/schemas/agent-inventory/v0.1.json";

type Capability = "read-secrets" | "network-egress" | "execute-shell";

export interface Inventory {
  schemaVersion: "0.1";
  generatedAt: string;
  producer: { name: string; version: string; url: string };
  identities: {
    id: string;
    /** `other` only for a settings file that auto-starts servers (`auto-enable`). */
    kind: "mcp-server" | "other";
    platform: "mcp";
    displayName: string;
    status: "unknown";
    credentials: { id: string; type: CredentialType; fingerprint: string; location: "config-file" }[];
    tools: { name: string; capabilities: Capability[] }[];
    tags: string[];
  }[];
  findings: { id: string; identityId: string; ruleId: string; severity: Severity; title: string; evidence: string; status: "open" }[];
  x: { checked: number; files: Record<string, unknown>[] };
}

export interface InventoryOptions {
  version: string;
  now: Date;
  /** How many paths were checked, found or not. */
  checked: number;
  /** Turn an absolute path into what the user sees, as in the text output. */
  display: (path: string) => string;
}

const SHELLS = new Set(RULES.flatMap((r) => (r.id === "shell-wrapper" && r.kind === "code-flag" ? r.families.flatMap((f) => f.names) : [])));
const SECRET_NAME = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH/i;

export function buildInventory(reports: FileReport[], opts: InventoryOptions): Inventory {
  const inv: Inventory = {
    schemaVersion: "0.1",
    generatedAt: opts.now.toISOString(),
    producer: { name: "mcp-frisk", version: opts.version, url: "https://github.com/ai-automation-tools/mcp-frisk" },
    identities: [],
    findings: [],
    x: { checked: opts.checked, files: [] },
  };
  for (const r of reports) {
    const file = opts.display(r.path);
    inv.x.files.push({
      path: file,
      ...(r.scope === "given" ? {} : { client: r.client, scope: r.scope }),
      status: r.status,
      ...(r.status === "ok" ? { servers: r.servers.length } : { reason: r.reason }),
      ...(r.status === "unparseable" ? { line: r.line } : {}),
      ...(r.problems.length > 0 ? { problems: r.problems } : {}),
    });
    for (const s of r.servers) addServer(inv, file, r, s);
    if (r.settings.length > 0) addSettings(inv, file, r);
  }
  return inv;
}

/** A settings file that auto-starts servers holds no server itself, so it is its own identity. */
function addSettings(inv: Inventory, file: string, r: FileReport): void {
  const id = `mcp:${file}`;
  inv.identities.push({
    id,
    kind: "other",
    platform: "mcp",
    displayName: `${file} (project settings)`,
    status: "unknown",
    credentials: [],
    tools: [],
    tags: [...scopeTags(r), "settings"],
  });
  addFindings(inv, file, id, r.settings);
}

function scopeTags(r: FileReport): string[] {
  return r.scope === "given" ? [] : [`client:${r.client}`, `scope:${r.scope}`];
}

function addFindings(inv: Inventory, file: string, id: string, findings: Finding[]): void {
  const seen = new Map<string, number>();
  for (const f of findings) {
    const n = (seen.get(f.ruleId) ?? 0) + 1;
    seen.set(f.ruleId, n);
    inv.findings.push({
      id: `${id}#${f.ruleId}/${n}`,
      identityId: id,
      ruleId: f.ruleId,
      severity: f.severity,
      title: f.title,
      evidence: `${file}:${f.line}: ${f.message}`,
      status: "open",
    });
  }
}

function addServer(inv: Inventory, file: string, r: FileReport, s: ServerReport): void {
  const { server } = s;
  const id = `mcp:${file}#${server.scope === undefined ? "" : `${server.scope}/`}${server.name}`;
  const capabilities: Capability[] = [];
  // Holds a key in the config, or is handed one by name (`GITHUB_TOKEN: "${env:GITHUB_TOKEN}"`).
  if (s.secrets.length > 0 || server.env.some((v) => SECRET_NAME.test(v.name))) capabilities.push("read-secrets");
  // Remote, or launched by npx, uvx or docker run, which fetch the package at start.
  if (server.transport === "remote" || s.allowShape) capabilities.push("network-egress");
  if (server.command && SHELLS.has(exeName(argv(server)[0]?.value ?? ""))) capabilities.push("execute-shell");

  inv.identities.push({
    id,
    kind: "mcp-server",
    platform: "mcp",
    displayName: server.name,
    status: "unknown",
    credentials: s.secrets.map((h) => ({
      id: `${id}#${h.where.replace(" ", ".")}`,
      type: h.type,
      fingerprint: fingerprint(h.value),
      location: "config-file",
    })),
    tools: [{ name: server.name, capabilities }],
    tags: [...scopeTags(r), `transport:${server.transport}`],
  });
  addFindings(inv, file, id, s.findings);
}

/** First 12 hex characters of the SHA-256 of the secret: the schema's fingerprint. */
export function fingerprint(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 12);
}
