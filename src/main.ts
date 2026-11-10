// The CLI's logic, with every input passed in so tests run it on fixture folders.

import { isAbsolute, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { candidatePaths } from "./discover.ts";
import type { Candidate, Platform } from "./discover.ts";
import { formatText } from "./format.ts";
import { nodeFs, scanFiles } from "./scan.ts";
import type { FileSystem } from "./scan.ts";
import { VERSION } from "./version.ts";

export interface RunContext {
  argv: string[];
  cwd: string;
  home: string;
  platform: Platform;
  env: Record<string, string | undefined>;
  fs?: FileSystem;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export const USAGE = `Usage: mcpfrisk [options] [file ...]

Finds the MCP configs your coding agents load and flags shell-injection shapes.
Reads files only: never starts a server, runs a command or touches the network.

With no files, checks the current folder's .mcp.json, .vscode/mcp.json and
.cursor/mcp.json, then the per-user configs for Claude Code, Claude Desktop,
Cursor and VS Code. With files, checks just those.

Options:
  --home <dir>   read per-user configs from this home folder instead of yours
  -h, --help     show this help
  -v, --version  print the version
`;

export function run(ctx: RunContext): RunResult {
  let values: { home?: string; help?: boolean; version?: boolean };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: ctx.argv,
      allowPositionals: true,
      options: {
        home: { type: "string" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    }));
  } catch (err) {
    return { code: 2, stdout: "", stderr: `mcpfrisk: ${(err as Error).message}\n\n${USAGE}` };
  }
  if (values.help) return { code: 0, stdout: USAGE, stderr: "" };
  if (values.version) return { code: 0, stdout: `mcpfrisk ${VERSION}\n`, stderr: "" };

  // An explicit --home means "this is the whole user profile": don't mix in the real APPDATA.
  const home = values.home !== undefined ? resolve(ctx.cwd, values.home) : ctx.home;
  const env = values.home !== undefined ? {} : ctx.env;

  const candidates: Candidate[] = positionals.length > 0
    ? positionals.map((p) => ({ path: resolve(ctx.cwd, p), client: "", scope: "given" as const }))
    : candidatePaths({ cwd: ctx.cwd, home, platform: ctx.platform, env });

  const reports = scanFiles(candidates, ctx.fs ?? nodeFs);
  const stdout = formatText(reports, {
    version: VERSION,
    checked: candidates.length,
    display: (p) => displayPath(p, ctx.cwd, home),
  });
  return { code: 0, stdout, stderr: "" };
}

/** `.mcp.json` for files under the repo, `~/...` for files under home, else the full path. */
export function displayPath(path: string, cwd: string, home: string): string {
  const inside = (base: string) => {
    const rel = relative(base, path);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel) ? rel : undefined;
  };
  const fromCwd = inside(cwd);
  if (fromCwd !== undefined) return fromCwd.split(sep).join("/");
  const fromHome = inside(home);
  if (fromHome !== undefined) return `~/${fromHome.split(sep).join("/")}`;
  return path;
}
