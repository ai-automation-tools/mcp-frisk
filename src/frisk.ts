// Frisk one config's text: parse it, pull out the servers, run the rules.
//
// Browser-safe: no Node imports (ADR-001). The CLI calls this once per file it reads; the demo
// will call it on a pasted config.

import { parseJsonc } from "./jsonc.ts";
import { lintServer, RULES } from "./rules.ts";
import type { Finding, Rule } from "./rules.ts";
import { extractServers } from "./servers.ts";
import type { EntryProblem, ServerEntry } from "./servers.ts";

export interface ServerReport {
  server: ServerEntry;
  /** Label of the known launcher shape the server matches, if any. */
  allowShape?: string;
}

export type FriskResult =
  | { status: "ok"; empty: boolean; servers: ServerReport[]; problems: EntryProblem[]; findings: Finding[] }
  | { status: "unparseable"; reason: string; line: number; servers: []; problems: []; findings: [] };

export function friskText(text: string, rules: Rule[] = RULES): FriskResult {
  const parsed = parseJsonc(text);
  if (!parsed.ok) {
    return { status: "unparseable", reason: parsed.reason, line: parsed.line, servers: [], problems: [], findings: [] };
  }
  const { servers, problems } = extractServers(parsed.root);
  const reports: ServerReport[] = [];
  const findings: Finding[] = [];
  for (const server of servers) {
    const result = lintServer(server, rules);
    reports.push({ server, allowShape: result.allowShape?.label });
    findings.push(...result.findings);
  }
  findings.sort((a, b) => a.line - b.line);
  return { status: "ok", empty: parsed.root === undefined, servers: reports, problems, findings };
}
