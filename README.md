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
> **Nothing works yet.** This is the scaffold. `mcpfrisk` prints its version and that's all;
> discovery, rules and the demo arrive one roadmap item at a time. The [roadmap](docs/ROADMAP.md)
> says what's next.

## 🎯 What it's for

An MCP config (`.mcp.json` and its siblings in Claude Code, Claude Desktop, Cursor and VS Code)
is two risky things in one file. Its `command` and `args` are code your agent runs, and its `env`
block is where people paste API keys. A repo you clone can ship one, and some clients run it
when you open the folder.

mcp-frisk is a linter for that file. It is planned to:

| Check | What it flags |
|:---|:---|
| **Shell shapes** | `sh -c`, `bash -c`, `cmd /c`, `powershell -c`, unquoted `$VAR`, backticks, and `;`, `&&` or `\|` in args. Plain `npx -y <pkg>`, `uvx` and `docker run` pass. |
| **Plaintext secrets** | Anthropic, OpenAI, Hugging Face, AWS, GitHub and Stripe keys in `env` or args, shown only as prefix plus last four. |
| **Report** | Text, or JSON in the Agent Security Suite's agent inventory format, with a non-zero exit above `--fail-on` so a hook or CI job can gate on it. |

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
npm install          # dev dependencies only; mcp-frisk has no runtime dependencies yet
npm run build        # compiles src/ to dist/
node dist/cli.js     # prints "mcpfrisk 0.0.0" for now
```

## 🗂️ What's in here

| Folder | What's inside |
|:---|:---|
| [**📚 docs/**](docs/README.md) | The roadmap, the changelog, the spec and build plan, and ADR-001. |
| [**🧩 src/**](src/) | The CLI. One TypeScript core that the browser demo will import too. |
| [**🧪 tests/**](tests/) | `node:test` suites, run with `npm test`. |
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
