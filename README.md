<a id="readme-top"></a>

<h1 align="center">🔎 mcp-frisk</h1>

<p align="center">
  <em>Reads every MCP config your coding agents load and flags shell-injection shapes and plaintext keys,<br>without starting a single server or making a network call.</em>
</p>

<p align="center">
  <a href="docs/README.md"><strong>Explore the docs »</strong></a>
</p>

<p align="center">
  <a href="docs/ROADMAP.md">Roadmap</a>
  ·
  <a href="https://github.com/ai-automation-tools/mcp-frisk/issues">Report Bug</a>
  ·
  <a href="https://github.com/ai-automation-tools/mcp-frisk/issues">Request Feature</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-incubating-F59E0B?style=for-the-badge" alt="Status: incubating">
  <a href="docs/ROADMAP.md"><img src="https://img.shields.io/badge/plan-ROADMAP-8B5CF6?style=for-the-badge" alt="Roadmap"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2ea44f?style=for-the-badge" alt="License: MIT"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-22.18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 22.18+">
  <img src="https://img.shields.io/badge/network_calls-zero-6B7280?style=flat-square" alt="Network calls: zero">
</p>

---

> [!WARNING]
> **Not released yet.** The `mcpfrisk` CLI works: it finds MCP configs, flags shell-injection
> shapes and plaintext keys, and writes text or an agent inventory JSON report. The browser demo
> is next. The [roadmap](docs/ROADMAP.md) says what's left before release.

## 🎯 What it's for

An MCP config (`.mcp.json` and its siblings in Claude Code, Claude Desktop, Cursor and VS Code)
is two risky things in one file. Its `command` and `args` are code your agent runs, and its `env`
block is where people paste API keys. A repo you clone can ship one, and some clients run it
when you open the folder.

mcp-frisk is a linter for that file:

| Check | What it flags | Status |
|:---|:---|:---|
| **Shell shapes** | `sh -c`, `bash -c`, `cmd /c`, `powershell -c`, unquoted `$VAR`, backticks and `$(...)`, and `;`, `&&` or `\|` in `command` or `args`. Plain `npx -y <pkg>`, `uvx` and `docker run` pass. | Works |
| **Plaintext secrets** | Anthropic, OpenAI, Hugging Face, AWS, GitHub and Stripe keys in `env` or args, shown only as prefix plus last four, and random-looking strings with no known prefix. | Works |
| **Report** | Text, or JSON in the Agent Security Suite's agent inventory format, with a non-zero exit at `--fail-on` so a hook or CI job can gate on it. | Works |

### Rules

| Rule id | Severity | Fires on |
|:---|:---|:---|
| `mcp-frisk/shell-wrapper` | high | A shell started with its run-this-string flag: `sh`/`bash`/`zsh` `-c` (and `-lc`), `cmd /c` or `/k`, `powershell`/`pwsh` `-c`, `-Command` or `-EncodedCommand`. An `/usr/bin/env` prefix is seen through. `cmd /c npx -y <pkg>`, the usual Windows launcher, is reported as low. |
| `mcp-frisk/command-substitution` | high | A backtick or `$(` anywhere in `command` or `args`. |
| `mcp-frisk/shell-variable` | medium | A bare `$NAME`. The client-side forms `${NAME}` (Claude Code) and `${env:NAME}` (VS Code) don't fire, nor does a single-quoted or escaped `\$NAME`. |
| `mcp-frisk/shell-operator` | medium | `;`, `&&`, `\|\|` or `\|` in `command` or `args`. |
| `mcp-frisk/plaintext-secret` | high | A key in an `env` value or an arg, by its provider's prefix: Anthropic `sk-ant-`, OpenAI `sk-` and `sk-proj-`, Hugging Face `hf_`, AWS `AKIA`/`ASIA`, GitHub `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`, Stripe `sk_`/`rk_` `live`/`test`. A reference like `${env:GITHUB_TOKEN}` doesn't fire. |
| `mcp-frisk/high-entropy-string` | low | A string of 20 or more characters in an `env` value or an arg, mixing upper case, lower case and digits, at 4 or more bits of entropy per character. |

The rules are data in [`src/rules.ts`](src/rules.ts) and [`src/secrets.ts`](src/secrets.ts),
which import nothing from Node so the browser demo can load the same files. Each one has a
fixture that fires it and one that doesn't in [`tests/fixtures/rules/`](tests/fixtures/rules/).
The secret fixtures' keys are planted and fake: each one holds `FAKE`.

A key is never printed in full. Text shows the provider's prefix and the last four characters
(`sk-ant-…aA1b`); JSON holds only a fingerprint, the first 12 hex characters of its SHA-256.

It reads files and nothing else. It never starts or connects to a server, never spawns a
process, and never sends anything off your machine. The browser demo runs the same rule code
in the page.

### What it won't do

- Block a client from launching a server. It reports and sets an exit code.
- Move your keys into a keychain or edit your configs.
- Check servers against a "poisoned marketplace" list. No sourced list exists yet.
- Run as a hosted service, with accounts or telemetry.

## 🚀 Quick start

From a clone, with Node 22.18 or newer:

```bash
npm install          # dev dependencies only; mcp-frisk has no runtime dependencies
npm run build        # compiles src/ to dist/
node dist/cli.js     # frisks this folder's MCP configs and your own
```

With no arguments it checks the current folder's `.mcp.json`, `.vscode/mcp.json` and
`.cursor/mcp.json`, then the per-user configs:

| Client | Windows | macOS | Linux |
|:---|:---|:---|:---|
| Claude Code | `~\.claude.json` | `~/.claude.json` | `~/.claude.json` |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` | `~/Library/Application Support/Claude/claude_desktop_config.json` | `~/.config/Claude/claude_desktop_config.json` |
| Cursor | `~\.cursor\mcp.json` | `~/.cursor/mcp.json` | `~/.cursor/mcp.json` |
| VS Code | `%APPDATA%\Code\User\mcp.json` and `settings.json` | `~/Library/Application Support/Code/User/` (same two) | `~/.config/Code/User/` (same two) |

Files are read as JSONC (comments and trailing commas allowed). A file that doesn't parse, a
server entry that isn't one, and a file that can't be read are each reported with a reason.

```text
mcpfrisk [options] [file ...]

  file ...              check just these files instead of discovering configs
  --home <dir>          read per-user configs from this home folder instead of yours
  --json                print an agent inventory document (schema v0.1), not text
  --fail-on <severity>  exit 1 if a finding is this severe or worse:
                        critical, high, medium, low or info
  -h, --help            show help
  -v, --version         print the version
```

On this repo's fixture `.mcp.json`:

```text
$ node dist/cli.js tests/fixtures/repo/.mcp.json
mcpfrisk 0.0.0: checked 1 location, found 1 config with 2 servers.

tests/fixtures/repo/.mcp.json: 2 servers, 2 findings
  tests/fixtures/repo/.mcp.json:9  high    mcp-frisk/shell-wrapper   build-helper  "bash -c" hands the rest of the command line to a shell to run as code
  tests/fixtures/repo/.mcp.json:9  medium  mcp-frisk/shell-operator  build-helper  shell operator "&&" chains or pipes commands wherever a shell reads this
  no findings: filesystem (npx -y <pkg>)

2 findings: 1 high, 1 medium.
```

On the secret fixture, failing on high:

```text
$ node dist/cli.js --fail-on high tests/fixtures/rules/plaintext-secret.fires.json
mcpfrisk 0.0.0: checked 1 location, found 1 config with 6 servers.

tests/fixtures/rules/plaintext-secret.fires.json: 6 servers, 7 findings
  tests/fixtures/rules/plaintext-secret.fires.json:7   high  mcp-frisk/plaintext-secret  anthropic    Anthropic API key in env ANTHROPIC_API_KEY: sk-ant-…aA1b
  tests/fixtures/rules/plaintext-secret.fires.json:11  high  mcp-frisk/plaintext-secret  openai       OpenAI API key in args[1]: sk-proj-…cC3d
  tests/fixtures/rules/plaintext-secret.fires.json:16  high  mcp-frisk/plaintext-secret  huggingface  Hugging Face token in env HF_TOKEN: hf_…eE5f
  tests/fixtures/rules/plaintext-secret.fires.json:20  high  mcp-frisk/plaintext-secret  aws          AWS access key id in args[4]: AKIA…MPLE
  tests/fixtures/rules/plaintext-secret.fires.json:26  high  mcp-frisk/plaintext-secret  github       GitHub token in env GITHUB_PERSONAL_ACCESS_TOKEN: ghp_…gG7h
  tests/fixtures/rules/plaintext-secret.fires.json:27  high  mcp-frisk/plaintext-secret  github       GitHub token in env GITHUB_FINE_GRAINED: github_pat_…iI9j
  tests/fixtures/rules/plaintext-secret.fires.json:32  high  mcp-frisk/plaintext-secret  stripe       Stripe key in args[2]: sk_test_…kK2l

7 findings: 7 high.
$ echo $?
1
```

The exit code is 1 when `--fail-on` is given and a finding is at or above it, 2 for a bad flag,
and 0 otherwise, findings or not.

### JSON: the agent inventory

`--json` writes an [agent inventory document](schemas/agent-inventory.schema.json), schema
v0.1, the format the Agent Security Suite's tools trade. Each server is one identity:

| Field | What mcp-frisk puts there |
|:---|:---|
| `id` | `mcp:<config path as shown>#<server name>`, with the project folder before the name for `~/.claude.json` project servers. The same on every run. |
| `kind`, `platform`, `status` | `mcp-server`, `mcp`, and `unknown`: mcp-frisk reads the config and never checks whether the server runs. |
| `credentials[]` | One per key found: its type, `location: config-file`, and a `fingerprint` (first 12 hex characters of its SHA-256). Never the key. |
| `tools[]` | One entry named after the server, with capability tags inferred from the config: `execute-shell` (the command is a shell), `network-egress` (a remote server, or `npx`/`uvx`/`docker run`, which fetch the package at start), `read-secrets` (holds a key, or an `env` name like `*_TOKEN` or `*_KEY`). |
| `tags` | `transport:stdio` or `transport:remote`, and for discovered configs `client:<name>` and `scope:repo` or `scope:user`. |

Findings carry `ruleId` `mcp-frisk/<rule>` and the evidence line from the text output. What
the schema has no field for (files checked, unparseable files and entries) goes in `x`.

## 🗂️ What's in here

| Folder | What's inside |
|:---|:---|
| [**📚 docs/**](docs/README.md) | The roadmap, the changelog, the spec and build plan, and ADR-001. |
| [**🧩 src/**](src/) | The CLI. The parser, rules, secret detector and formatter (`jsonc.ts`, `servers.ts`, `rules.ts`, `secrets.ts`, `frisk.ts`, `format.ts`) import nothing from Node, so the browser demo can load them; discovery, file reading and the JSON report (`discover.ts`, `scan.ts`, `inventory.ts`) are Node-only. |
| [**📐 schemas/**](schemas/) | The agent inventory schema v0.1, copied unchanged from its published `$id`. |
| [**🧪 tests/**](tests/) | `node:test` suites, run with `npm test`, and fixture configs: a repo, Windows, macOS and Linux homes, and one firing and one passing file per rule. The report is validated against the schema, every output is checked for the planted keys, and the CLI is run with sockets and child processes trapped. |
| [**🖥️ site/**](site/) | The demo page and its favicon. A "coming soon" shell for now. |

## 🛠️ Development

```bash
npm run lint    # ESLint plus tsc --noEmit
npm test        # node --test
npm run build   # tsc to dist/
```

Agents working this repo read [AGENTS.md](AGENTS.md) first. Security reports go through
[SECURITY.md](SECURITY.md), not public issues.

---

<p align="center">
  Built with <a href="https://www.typescriptlang.org/">TypeScript</a> · <a href="docs/README.md">Docs</a> · <a href="LICENSE">MIT License</a> · part of <a href="https://github.com/ai-automation-tools">ai-automation-tools</a>
</p>
