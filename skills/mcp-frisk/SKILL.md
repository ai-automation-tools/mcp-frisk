---
name: mcp-frisk
description: >-
  Install, run and read mcp-frisk (CLI `mcpfrisk`), an offline linter for MCP config
  files: it finds the `.mcp.json` and per-user configs that Claude Code, Claude Desktop,
  Cursor and VS Code load and flags shell-injection shapes, inline code (`node -e`),
  plaintext API keys, repo-shipped servers and `.claude/settings.json` that auto-starts
  them, without starting a server or touching the network. Use when the user asks to
  "scan / audit / lint / frisk my MCP config", "check this repo's .mcp.json before I open
  it", "are there API keys in my MCP settings", "is this MCP server safe to run", "gate CI
  on MCP config", wants an agent inventory JSON of MCP servers, or needs to read
  mcpfrisk output or exit codes. Source: github.com/ai-automation-tools/mcp-frisk (MIT).
---

# mcp-frisk

Static checks for MCP config files. It reads JSON(C) and nothing else: it never starts,
connects to or probes a server, never runs a command a config names, never spawns a process,
never edits a config, and makes no network call. That makes it safe to run on a repo you
haven't trusted yet, which is the main reason to reach for it.

**Defensive use only.** Run it on machines, repos and config exports the user owns or is
authorized to review. It reports and sets an exit code; it can't stop a client from launching
a server.

## Install

Node 22.18 or newer. **Not on npm yet**, and the repo is private while it incubates, so
installing needs read access to `ai-automation-tools/mcp-frisk`. Build from a clone (the
README's Quick start):

```bash
git clone https://github.com/ai-automation-tools/mcp-frisk.git
cd mcp-frisk
npm ci                               # dev dependencies only; no runtime dependencies
npm run build                        # src/ -> dist/, demo page -> _site/
npm pack                             # writes mcpfrisk-<version>.tgz
npm install -g ./mcpfrisk-<version>.tgz
mcpfrisk --version
```

Without installing: `node dist/cli.js [options] [file ...]` from the built clone. The package
name is `mcpfrisk`; don't suggest `npx mcpfrisk` or `npm install mcpfrisk` until the README
says it's published. If the user can't reach the repo, say so instead of guessing another source.

## Commands and flags

```text
mcpfrisk [options] [file ...]

  file ...              check just these files instead of discovering configs
  --home <dir>          read per-user configs from this home folder instead of yours
  --json                print an agent inventory document (schema v0.1), not text
  --fail-on <severity>  exit 1 if a finding is this severe or worse:
                        critical, high, medium, low or info
  -h, --help            show this help
  -v, --version         print the version
```

That is the whole surface: no subcommands, no config file, no settings of its own.

### What it reads

- **No files given:** discovery. From the current folder: `.mcp.json`, `.claude/settings.json`,
  `.claude/settings.local.json`, `.vscode/mcp.json`, `.cursor/mcp.json` (scope `repo`). Then the
  per-user configs (scope `user`): Claude Code `~/.claude.json`; Claude Desktop
  `claude_desktop_config.json` (`%APPDATA%\Claude\` on Windows, `~/Library/Application Support/Claude/`
  on macOS, `~/.config/Claude/` on Linux); Cursor `~/.cursor/mcp.json`; VS Code `mcp.json` and
  `settings.json` in the Code `User` folder. Missing files are skipped silently.
- **Files given:** only those. A missing one is reported as `unreadable, no such file`.
- **`--home <dir>`** replaces the home folder and also drops the real `%APPDATA%`, so the run sees
  that folder as the whole user profile. Point it at an empty or nonexistent folder to check
  only the repo.
- Files are parsed as JSONC (comments and trailing commas allowed).

Run discovery from the repo root: the repo-scope paths are relative to the current folder.

## Rules

| Rule id | Severity | Fires on |
|:---|:---|:---|
| `mcp-frisk/shell-wrapper` | high (low for `cmd /c npx -y <pkg>`) | `sh/bash/zsh -c`, `cmd /c` or `/k`, `powershell`/`pwsh -c`, `-Command`, `-EncodedCommand` |
| `mcp-frisk/inline-code` | high | `node`/`bun -e/-p/--eval`, `python -c`, `deno eval`, `ruby`/`perl -e`, `php -r` |
| `mcp-frisk/auto-enable` | high | Claude Code settings with `enableAllProjectMcpServers: true` or a non-empty `enabledMcpjsonServers` at the top level |
| `mcp-frisk/command-substitution` | high | A backtick or `$(` in `command` or `args` |
| `mcp-frisk/plaintext-secret` | high | Anthropic, OpenAI, Hugging Face, AWS, GitHub or Stripe key in `env` or an arg |
| `mcp-frisk/shell-variable` | medium | A bare `$NAME` (`${NAME}` and `${env:NAME}` don't fire) |
| `mcp-frisk/shell-operator` | medium | `;`, `&&`, `\|\|` or `\|` in `command` or `args` |
| `mcp-frisk/high-entropy-string` | low | 20+ chars, mixed case and digits, 4+ bits of entropy per char |
| `mcp-frisk/project-server` | info | Any local-command server in a discovered repo config |

`npx -y <pkg>`, `uvx` and `docker run` pass. No rule emits `critical` today, so
`--fail-on critical` never fails. The repo's README has the full rule text.

## Reading the text output

```text
mcpfrisk 0.0.0: checked 10 locations, found 2 configs with 1 server.

.mcp.json (Claude Code, repo): 1 server, 2 findings
  .mcp.json:4  info  mcp-frisk/project-server  project-helper  the repo ships this server: ...
  .mcp.json:5  high  mcp-frisk/inline-code     project-helper  "node -e" runs the next argument as a program, ...

3 findings: 2 high, 1 info.
```

- Header: locations checked (every candidate path), configs found, servers parsed.
- One block per config: `path (client, scope)`. Paths under the current folder are relative,
  paths under home start `~/`.
- Each finding: `file:line  severity  rule-id  server  message`. For `auto-enable` the server
  column is the settings key.
- `no findings: a, b (npx -y <pkg>)` lists clean servers. `unparseable at line N, <reason>` and
  `unreadable, <reason>` are file-level problems, not findings.
- A key is never printed whole: text shows the provider prefix and last four (`sk-ant-…aA1b`).
  Quote it that way; never ask the user for the full value.

## Reading the JSON (`--json`)

An agent inventory document, schema v0.1 (`schemas/agent-inventory.schema.json` in the repo).
Top level: `schemaVersion`, `generatedAt`, `producer`, `identities`, `findings`, `x`.

- **`identities[]`:** one per server. `id` is `mcp:<config path>#<server>` and stable across runs;
  `kind: mcp-server`, `platform: mcp`, `status: unknown` (it never checks whether a server runs).
  `credentials[]` hold a `type`, `location: config-file` and a `fingerprint` (first 12 hex of the
  key's SHA-256), never the key. `tools[]` carry capability tags `execute-shell`,
  `network-egress`, `read-secrets`. `tags` hold `transport:stdio|remote`, `client:<name>`,
  `scope:repo|user`. A settings file with an `auto-enable` finding is its own identity, `kind: other`.
- **`findings[]`:** `id`, `identityId`, `ruleId` (`mcp-frisk/<rule>`), `severity`, `title`,
  `evidence` (the text line), `status: open`.
- **`x`:** what the schema has no field for: `checked` (count) and `files[]`, one per file found,
  with `path`, `status` (`ok`, `unparseable` or `unreadable`), a server count or a `reason` (and
  `line` when unparseable), plus `client` and `scope` for discovered files.

Filter with any JSON tool, for example `mcpfrisk --json | jq '.findings[] | select(.severity=="high")'`.

## Exit codes

| Code | When |
|:---|:---|
| 0 | Ran. Findings or not, unless `--fail-on` tripped |
| 1 | `--fail-on` given and a finding is at or above that severity |
| 2 | Unknown flag or a bad `--fail-on` value (usage goes to stderr) |

An unreadable or unparseable file does **not** change the exit code. In a gate, check
`x.files[].status` in the JSON, or read the text, before calling a run clean.

## Workflows

**Vet a repo before opening it in an agent client.** From its root, ignoring your own configs:

```bash
mcpfrisk --home ./no-such-home --fail-on high
```

Explain each finding in plain words. `project-server` is a notice, not a verdict: read the
command it names. `inline-code` plus `auto-enable` together is the TrustFall shape (a repo
server that runs on open); call that out first.

**Audit this machine's own configs.** Run `mcpfrisk` with no arguments from any folder. For a
`plaintext-secret` finding, tell the user to rotate the key and move it to a reference the client
resolves (`${NAME}` in Claude Code, `${env:NAME}` in VS Code). mcp-frisk won't move it, and
neither should you without being asked.

**Check one file someone sent.** `mcpfrisk path/to/config.json`. Named files never get
`project-server`, since their origin is unknown.

**CI gate.** Build mcp-frisk from source in the job (above), then from the checked-out repo:

```bash
mcpfrisk --home ./no-such-home --fail-on high          # text in the log, exit 1 on high
mcpfrisk --home ./no-such-home --json > mcp-inventory.json   # artifact for later review
```

Use `--fail-on medium` for a stricter gate. Pair it with a check that `x.files[].status` has
no `unparseable` entry if a broken config should fail the build.

**Feed another tool.** The `--json` report is the Agent Security Suite's inventory format; pass
it on as-is and don't add fields outside `x`.

## Traps

- Running discovery from a subfolder misses the repo's `.mcp.json`. `cd` to the root first.
- Without `--home`, discovery also reports the user's own configs, so a "repo" check can show
  findings that aren't from the repo.
- Findings describe what a config would do; mcp-frisk can't confirm a server is malicious, and
  a clean run isn't proof of safety (it doesn't check package names against any list).
- `--fail-on critical` never trips today.
- The text format is for people; parse `--json` in scripts.
- Don't "fix" a finding by running the flagged command to see what it does. Read it.
