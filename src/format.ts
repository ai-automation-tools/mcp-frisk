// Text output. Browser-safe: no Node imports.
//
// Server names, project paths and parse reasons come from a hostile file, so every string from
// the config passes through `clean()`: control and bidi characters are shown as escapes, never
// sent to the terminal raw.

import { SEVERITIES } from "./rules.ts";
import type { Severity } from "./rules.ts";
import type { FileReport } from "./scan.ts";

export interface FormatOptions {
  version: string;
  /** How many paths were checked, found or not. */
  checked: number;
  /** Turn an absolute path into what the user sees (`.mcp.json`, `~/.cursor/mcp.json`). */
  display: (path: string) => string;
}

export function formatText(reports: FileReport[], opts: FormatOptions): string {
  const out: string[] = [];
  const servers = reports.reduce((n, r) => n + r.servers.length + r.problems.length, 0);
  out.push(`mcpfrisk ${opts.version}: checked ${opts.checked} ${plural(opts.checked, "location")}, found ${reports.length} ${plural(reports.length, "config")} with ${servers} ${plural(servers, "server")}.`);

  const counts = new Map<Severity, number>();
  for (const r of reports) {
    const file = clean(opts.display(r.path));
    out.push("");
    const where = r.scope === "given" ? file : `${file} (${r.client}, ${r.scope})`;
    if (r.status === "unreadable") {
      out.push(`${where}: unreadable, ${r.reason}`);
      continue;
    }
    if (r.status === "unparseable") {
      out.push(`${where}: unparseable at line ${r.line}, ${clean(r.reason)}`);
      continue;
    }
    if (r.empty || (r.servers.length === 0 && r.problems.length === 0)) {
      out.push(`${where}: ${r.empty ? "empty file" : "no MCP servers"}`);
      continue;
    }
    const n = r.servers.length + r.problems.length;
    out.push(`${where}: ${n} ${plural(n, "server")}, ${r.findings.length} ${plural(r.findings.length, "finding")}`);

    const rows: { line: number; cells: string[] }[] = [];
    for (const f of r.findings) {
      counts.set(f.severity, (counts.get(f.severity) ?? 0) + 1);
      rows.push({ line: f.line, cells: [`${file}:${f.line}`, f.severity, f.ruleId, label(f.server, f.scope), clean(f.message)] });
    }
    for (const p of r.problems) {
      rows.push({ line: p.line, cells: [`${file}:${p.line}`, "error", "unparseable entry", label(p.name, p.scope), clean(p.reason)] });
    }
    rows.sort((a, b) => a.line - b.line);
    out.push(...table(rows.map((row) => row.cells)).map((l) => `  ${l}`));

    const flagged = new Set(r.findings.map((f) => `${f.scope ?? ""}\u0000${f.server}`));
    const quiet = r.servers
      .filter((s) => !flagged.has(`${s.server.scope ?? ""}\u0000${s.server.name}`))
      .map((s) => {
        const why = s.allowShape ?? (s.server.transport === "remote" ? "remote" : undefined);
        return why ? `${label(s.server.name, s.server.scope)} (${why})` : label(s.server.name, s.server.scope);
      });
    if (quiet.length > 0) out.push(`  no findings: ${quiet.join(", ")}`);
  }

  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const bySeverity = SEVERITIES.filter((s) => counts.has(s)).map((s) => `${counts.get(s)} ${s}`);
  out.push("");
  out.push(total === 0 ? "No findings." : `${total} ${plural(total, "finding")}: ${bySeverity.join(", ")}.`);
  return out.join("\n") + "\n";
}

function label(name: string, scope: string | undefined): string {
  return scope === undefined ? clean(name) : `${clean(name)} [project ${clean(scope)}]`;
}

function table(rows: string[][]): string[] {
  const widths: number[] = [];
  for (const row of rows) row.forEach((cell, i) => (widths[i] = Math.max(widths[i] ?? 0, cell.length)));
  return rows.map((row) => row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i]))).join("  "));
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

/** Escape control and bidi-override characters so a hostile name can't rewrite the terminal. */
export function clean(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    out += isUnsafe(c) ? `\\u${c.toString(16).padStart(4, "0")}` : ch;
  }
  return out;
}

function isUnsafe(c: number): boolean {
  return c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x200e || c === 0x200f ||
    (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
}
