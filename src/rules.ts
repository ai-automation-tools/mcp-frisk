// The shell-injection rules, as data, and the engine that applies them to one server entry.
//
// Browser-safe: no Node imports (ADR-001). The CLI and the demo both load this module.
// Messages quote only the matched token (a shell name, a flag, an operator, a variable name cut
// to a safe length), never a whole argument, so a key sitting in an arg is never echoed.

import type { ServerEntry, StringAt } from "./servers.ts";

/** The agent inventory schema's severity scale. */
export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Finding {
  /** `mcp-frisk/<rule>`. */
  ruleId: string;
  severity: Severity;
  server: string;
  scope?: string;
  line: number;
  message: string;
}

/** A shell launched with its "run this string" flag, e.g. `bash -c`, `cmd /c`. */
export interface ShellFamily {
  /** Executable names, lower case, without `.exe`. */
  names: string[];
  /** Regex source for the flag that makes the shell run its argument as code. Case-insensitive. */
  flag: string;
  /** Regex source for the arg after which the shell's own flags end. Case-insensitive. */
  stopAt: string;
  /** When the wrapped command is a known launcher shape, report at this severity instead. */
  wrappingAllowShape?: { severity: Severity; note: string };
}

export interface ShellWrapperRule {
  kind: "shell-wrapper";
  id: string;
  severity: Severity;
  title: string;
  families: ShellFamily[];
}

/** A regex run over `command` and every arg. `{match}` in the message is the matched text. */
export interface PatternRule {
  kind: "pattern";
  id: string;
  severity: Severity;
  title: string;
  pattern: string;
  message: string;
  /** Skip args wrapped whole in single quotes, where a POSIX shell wouldn't expand anything. */
  skipSingleQuoted?: boolean;
}

export type Rule = ShellWrapperRule | PatternRule;

/** A launcher that runs a package without a shell. A server in one of these shapes gets no finding. */
export interface AllowShape {
  id: string;
  label: string;
  /** Executable names, lower case, without `.exe` or `.cmd`. */
  commands: string[];
  /** If set, the first arg must be one of these. */
  firstArg?: string[];
}

/** Every arg of an allowed shape must look like this: flags, package names, paths, `KEY=value`. */
export const PLAIN_TOKEN = /^[A-Za-z0-9@%+=:,./\\_~^-]*$/;

export const ALLOW_SHAPES: AllowShape[] = [
  { id: "npx", label: "npx -y <pkg>", commands: ["npx"], firstArg: ["-y", "--yes"] },
  { id: "uvx", label: "uvx <pkg>", commands: ["uvx"] },
  { id: "docker-run", label: "docker run", commands: ["docker"], firstArg: ["run"] },
];

export const RULES: Rule[] = [
  {
    kind: "shell-wrapper",
    id: "shell-wrapper",
    severity: "high",
    title: "Server starts a shell that runs a string as code",
    families: [
      {
        names: ["sh", "bash", "zsh", "dash", "ksh", "ash", "fish"],
        flag: "^-[a-z]*c[a-z]*$",
        stopAt: "^[^-]",
      },
      {
        names: ["cmd"],
        flag: "^/[ck]$",
        stopAt: "^[^/]",
        wrappingAllowShape: {
          severity: "low",
          note: "the usual Windows way to start npx, but cmd.exe still parses every argument",
        },
      },
      {
        names: ["powershell", "pwsh"],
        flag: "^-(c|command|e|ec|enc|encodedcommand)$",
        stopAt: "^-(f|file)$",
      },
    ],
  },
  {
    kind: "pattern",
    id: "command-substitution",
    severity: "high",
    title: "Command substitution in command or args",
    pattern: "`|\\$\\(",
    message: "command substitution ({match}) runs another command wherever a shell reads this",
  },
  {
    kind: "pattern",
    id: "shell-variable",
    severity: "medium",
    title: "Unquoted shell variable in command or args",
    pattern: "(?<![\\\\$])\\$[A-Za-z_][A-Za-z0-9_]*",
    message: "unquoted shell variable {match} is expanded by whatever shell reads it",
    skipSingleQuoted: true,
  },
  {
    kind: "pattern",
    id: "shell-operator",
    severity: "medium",
    title: "Shell operator in command or args",
    pattern: "&&|\\|\\||;|\\|",
    message: "shell operator {match} chains or pipes commands wherever a shell reads this",
  },
];

/** Lower-case basename without a Windows executable extension: `C:\x\Cmd.EXE` -> `cmd`. */
export function exeName(command: string): string {
  const base = command.split(/[\\/]/).pop() ?? command;
  return base.toLowerCase().replace(/\.(exe|cmd|bat|com)$/, "");
}

/**
 * The command line as the client would launch it: `command` (split on spaces, in case someone
 * wrote `"bash -c"` there) then `args`, with an `env` prefix (`/usr/bin/env FOO=1 bash`) removed.
 */
export function argv(server: ServerEntry): StringAt[] {
  if (!server.command) return [];
  const { value, line } = server.command;
  const head = value.trim().includes(" ") && !/^[A-Za-z]:\\/.test(value.trim()) && !value.trim().startsWith("/")
    ? value.trim().split(/\s+/).map((v) => ({ value: v, line }))
    : [{ value, line }];
  const all = [...head, ...server.args];
  while (all.length > 1 && exeName(all[0].value) === "env") {
    all.shift();
    while (all.length > 1 && (all[0].value.startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(all[0].value))) all.shift();
  }
  return all;
}

/** The allow shape a command line matches, if any. */
export function matchAllowShape(line: StringAt[]): AllowShape | undefined {
  if (line.length === 0) return undefined;
  const exe = exeName(line[0].value);
  const rest = line.slice(1);
  if (!rest.every((a) => PLAIN_TOKEN.test(a.value))) return undefined;
  return ALLOW_SHAPES.find(
    (s) => s.commands.includes(exe) && (!s.firstArg || (rest.length > 0 && s.firstArg.includes(rest[0].value))),
  );
}

export interface LintResult {
  findings: Finding[];
  /** Set when the server is in a known launcher shape and so has no findings. */
  allowShape?: AllowShape;
}

export function lintServer(server: ServerEntry, rules: Rule[] = RULES): LintResult {
  if (server.transport !== "stdio" || !server.command) return { findings: [] };
  const line = argv(server);
  const allowShape = matchAllowShape(line);
  if (allowShape) return { findings: [], allowShape };

  const findings: Finding[] = [];
  const add = (rule: Rule, severity: Severity, at: number, message: string) =>
    findings.push({ ruleId: `mcp-frisk/${rule.id}`, severity, server: server.name, scope: server.scope, line: at, message });

  for (const rule of rules) {
    if (rule.kind === "shell-wrapper") {
      const hit = shellWrapper(rule, line);
      if (hit) add(rule, hit.severity, hit.line, hit.message);
      continue;
    }
    const re = new RegExp(rule.pattern, "g");
    for (const token of line) {
      if (rule.skipSingleQuoted && /^'.*'$/s.test(token.value)) continue;
      const seen = new Set<string>();
      for (const m of token.value.matchAll(re)) {
        const shown = quote(m[0]);
        if (seen.has(shown)) continue;
        seen.add(shown);
        add(rule, rule.severity, token.line, rule.message.replace("{match}", shown));
      }
    }
  }
  return { findings };
}

function shellWrapper(rule: ShellWrapperRule, line: StringAt[]): { severity: Severity; line: number; message: string } | undefined {
  const exe = exeName(line[0].value);
  const family = rule.families.find((f) => f.names.includes(exe));
  if (!family) return undefined;
  const flag = new RegExp(family.flag, "i");
  const stop = new RegExp(family.stopAt, "i");
  for (let i = 1; i < line.length; i++) {
    const arg = line[i].value;
    if (flag.test(arg)) {
      const shape = family.wrappingAllowShape ? matchAllowShape(line.slice(i + 1)) : undefined;
      const base = `"${exe} ${arg.toLowerCase()}" hands the rest of the command line to a shell to run as code`;
      if (shape && family.wrappingAllowShape) {
        return { severity: family.wrappingAllowShape.severity, line: line[i].line, message: `${base}; wrapping ${shape.label} is ${family.wrappingAllowShape.note}` };
      }
      return { severity: rule.severity, line: line[i].line, message: base };
    }
    if (stop.test(arg)) return undefined;
  }
  return undefined;
}

/** Quote a matched token for a message, cut short so a key-shaped variable name is never whole. */
function quote(token: string): string {
  const cut = token.length > 20 ? `${token.slice(0, 16)}…` : token;
  return `"${cut}"`;
}
