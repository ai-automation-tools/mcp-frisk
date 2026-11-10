// Pull MCP server entries out of a parsed config.
//
// Browser-safe: no Node imports (ADR-001). One extractor covers every client mcp-frisk reads:
//   mcpServers                 .mcp.json, ~/.claude.json, Claude Desktop, Cursor
//   projects.<path>.mcpServers ~/.claude.json, servers added per project
//   servers                    VS Code mcp.json (workspace and user)
//   mcp.servers                VS Code user settings.json

import { getEntry } from "./jsonc.ts";
import type { JsonNode } from "./jsonc.ts";

export interface StringAt {
  value: string;
  line: number;
}

export interface EnvVar {
  name: string;
  value: string;
  line: number;
}

export interface ServerEntry {
  name: string;
  /** Set for servers under `projects.<path>` in ~/.claude.json: the project they belong to. */
  scope?: string;
  /** Line of the server's key. */
  line: number;
  transport: "stdio" | "remote";
  command?: StringAt;
  args: StringAt[];
  env: EnvVar[];
}

/** A server entry, or a server block, that couldn't be read as one. */
export interface EntryProblem {
  name: string;
  scope?: string;
  line: number;
  reason: string;
}

export interface Extracted {
  servers: ServerEntry[];
  problems: EntryProblem[];
}

export function extractServers(root: JsonNode | undefined): Extracted {
  const out: Extracted = { servers: [], problems: [] };
  if (root === undefined) return out;
  if (root.type !== "object") {
    out.problems.push({ name: "(top level)", line: root.line, reason: `the top level is ${article(root.type)}, not an object` });
    return out;
  }

  readBlock(out, root, "mcpServers", undefined);
  readBlock(out, root, "servers", undefined);
  const mcp = getEntry(root, "mcp");
  if (mcp?.value.type === "object") readBlock(out, mcp.value, "servers", undefined, "mcp.servers");

  const projects = getEntry(root, "projects");
  if (projects?.value.type === "object") {
    for (const project of projects.value.entries) {
      if (project.value.type === "object") readBlock(out, project.value, "mcpServers", project.key);
    }
  }
  return out;
}

function readBlock(out: Extracted, parent: JsonNode, key: string, scope: string | undefined, label = key): void {
  const block = getEntry(parent, key);
  if (!block) return;
  if (block.value.type !== "object") {
    out.problems.push({ name: `(${label})`, scope, line: block.keyLine, reason: `\`${label}\` is ${article(block.value.type)}, not an object` });
    return;
  }
  for (const entry of block.value.entries) {
    const parsed = readServer(entry.key, scope, entry.keyLine, entry.value);
    if ("reason" in parsed) out.problems.push(parsed);
    else out.servers.push(parsed);
  }
}

function readServer(name: string, scope: string | undefined, line: number, node: JsonNode): ServerEntry | EntryProblem {
  const problem = (reason: string): EntryProblem => ({ name, scope, line, reason });
  if (node.type !== "object") return problem(`the entry is ${article(node.type)}, not an object`);

  const command = getEntry(node, "command");
  const url = getEntry(node, "url") ?? getEntry(node, "serverUrl");
  const args = getEntry(node, "args");
  const env = getEntry(node, "env");

  if (command && command.value.type !== "string") return problem(`\`command\` is ${article(command.value.type)}, not a string`);
  if (!command && !url) return problem("no `command` or `url`");

  const server: ServerEntry = {
    name,
    scope,
    line,
    transport: command ? "stdio" : "remote",
    args: [],
    env: [],
  };
  if (command?.value.type === "string") server.command = { value: command.value.value, line: command.value.line };

  if (args) {
    if (args.value.type !== "array") return problem(`\`args\` is ${article(args.value.type)}, not an array`);
    for (const [i, item] of args.value.items.entries()) {
      if (item.type !== "string") return problem(`\`args[${i}]\` is ${article(item.type)}, not a string`);
      server.args.push({ value: item.value, line: item.line });
    }
  }

  if (env) {
    if (env.value.type !== "object") return problem(`\`env\` is ${article(env.value.type)}, not an object`);
    for (const v of env.value.entries) {
      if (v.value.type === "string") server.env.push({ name: v.key, value: v.value.value, line: v.value.line });
    }
  }
  return server;
}

function article(type: JsonNode["type"]): string {
  return type === "object" || type === "array" ? `an ${type}` : type === "null" ? "null" : `a ${type}`;
}
