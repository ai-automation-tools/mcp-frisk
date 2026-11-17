// Where each client keeps its MCP config. Node-only (it joins paths); the browser never needs it.
//
// Everything comes in as an argument (the repo folder, the home folder, the platform and the
// environment) so tests build fixture homes for Windows, macOS and Linux on any machine.

import { join, resolve } from "node:path";

export type Platform = "win32" | "darwin" | "linux";

export interface Candidate {
  path: string;
  client: string;
  scope: "repo" | "user" | "given";
}

export interface DiscoverOptions {
  /** The repo to check: `.mcp.json`, `.claude/settings*.json`, `.vscode/mcp.json` and `.cursor/mcp.json` are read from here. */
  cwd: string;
  /** The user's home folder. */
  home: string;
  platform: Platform;
  /** Only `APPDATA` (Windows) and `XDG_CONFIG_HOME` (Linux) are read. Pass `{}` to derive both from `home`. */
  env?: Record<string, string | undefined>;
}

/** The per-user application data folder Claude Desktop and VS Code keep their settings in. */
export function appDataDir({ home, platform, env = {} }: Omit<DiscoverOptions, "cwd">): string {
  if (platform === "win32") return env.APPDATA || join(home, "AppData", "Roaming");
  if (platform === "darwin") return join(home, "Library", "Application Support");
  return env.XDG_CONFIG_HOME || join(home, ".config");
}

/** Every path mcp-frisk checks, repo files first. Duplicates (cwd = home) are dropped. */
export function candidatePaths(opts: DiscoverOptions): Candidate[] {
  const { cwd, home } = opts;
  const appData = appDataDir(opts);
  const list: Candidate[] = [
    { path: join(cwd, ".mcp.json"), client: "Claude Code", scope: "repo" },
    // Not MCP configs, but they decide whether `.mcp.json` starts with no prompt (auto-enable).
    { path: join(cwd, ".claude", "settings.json"), client: "Claude Code", scope: "repo" },
    { path: join(cwd, ".claude", "settings.local.json"), client: "Claude Code", scope: "repo" },
    { path: join(cwd, ".vscode", "mcp.json"), client: "VS Code", scope: "repo" },
    { path: join(cwd, ".cursor", "mcp.json"), client: "Cursor", scope: "repo" },
    { path: join(home, ".claude.json"), client: "Claude Code", scope: "user" },
    { path: join(appData, "Claude", "claude_desktop_config.json"), client: "Claude Desktop", scope: "user" },
    { path: join(home, ".cursor", "mcp.json"), client: "Cursor", scope: "user" },
    { path: join(appData, "Code", "User", "mcp.json"), client: "VS Code", scope: "user" },
    { path: join(appData, "Code", "User", "settings.json"), client: "VS Code", scope: "user" },
  ];
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = resolve(c.path);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
