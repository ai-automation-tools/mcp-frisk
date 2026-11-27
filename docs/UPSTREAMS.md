# Upstreams

Every external service, tool, format and platform mcp-frisk depends on, what the code assumes
about each, and where to check whether that assumption still holds. The biweekly **MCP-Frisk
Upstream Check** routine (`upstream/auto-*` PRs) works from this file. Keep it current by hand
too: a new client config location or key prefix is a new row.

mcp-frisk reads files only. It makes no network call, starts no server and has no runtime
dependencies, so its upstreams are the config formats it parses, the provider key shapes it
matches, the published schema it writes, and the build and hosting platform.

**Last checked** is filled in by the routine, and only with a date it actually read the
source. `—` means never checked.

## Client config formats

| Upstream | What the code assumes | Code | Check at | Last checked |
|:---|:---|:---|:---|:---|
| **Claude Code** | Repo files `.mcp.json`, `.claude/settings.json`, `.claude/settings.local.json`; per-user `~/.claude.json`. Servers sit under `mcpServers`, or `projects.<path>.mcpServers` in `~/.claude.json`. `enableAllProjectMcpServers: true` and a non-empty top-level `enabledMcpjsonServers` start a repo's `.mcp.json` servers with no prompt. Entries use `${NAME}` for client-side variable expansion | `src/discover.ts`, `src/servers.ts`, `src/rules.ts` (`auto-enable`, `shell-variable`) | code.claude.com/docs (MCP and settings pages) | — |
| **Claude Desktop** | Per-user `claude_desktop_config.json` at `%APPDATA%\Claude\` (Windows), `~/Library/Application Support/Claude/` (macOS), `~/.config/Claude/` (Linux), servers under `mcpServers` | `src/discover.ts`, `src/servers.ts` | modelcontextprotocol.io (the "connect to local servers" quickstart) | — |
| **Cursor** | `.cursor/mcp.json` in a repo and `~/.cursor/mcp.json`, servers under `mcpServers` | `src/discover.ts`, `src/servers.ts` | cursor.com/docs (MCP page) | — |
| **VS Code** | `.vscode/mcp.json` in a repo (servers under `servers`), user `mcp.json` and user `settings.json` (servers under `mcp.servers`) at `%APPDATA%\Code\User\`, `~/Library/Application Support/Code/User/`, `~/.config/Code/User/`. `${env:NAME}` is the client-side variable form | `src/discover.ts`, `src/servers.ts`, `src/rules.ts` (`shell-variable`) | code.visualstudio.com/docs/copilot/customization/mcp-servers | — |
| **MCP server entry shape** | A server is an object with a local `command` and `args` (and `env`); remote entries have no `command` and are not linted for shell shapes. Files are JSONC (comments, trailing commas) | `src/servers.ts`, `src/jsonc.ts` | modelcontextprotocol.io/specification (latest) | — |

## Threat sources the rules are built on

| Upstream | What the code assumes | Code | Check at | Last checked |
|:---|:---|:---|:---|:---|
| **TrustFall** (repo-borne `.mcp.json` plus auto-enable settings) | A cloned repo's MCP servers can run with no prompt when `enableAllProjectMcpServers` or `enabledMcpjsonServers` is set; the payload is inline code such as `node -e` | `src/rules.ts` (`auto-enable`, `inline-code`, `project-server`), `docs/threat-model.md` | The primary sources cited in `docs/threat-model.md` | — |
| **CVE-2026-47751, CVE-2026-57860, Miasma worm** | The shell-shape rules and secret rules cover the shapes these describe; `docs/threat-model.md` says which each rule answers | `docs/threat-model.md`, `src/rules.ts` | The advisories cited in `docs/threat-model.md` | — |
| **Provider key prefixes** | Anthropic `sk-ant-`, OpenAI `sk-` and `sk-proj-`, Hugging Face `hf_`, AWS `AKIA`/`ASIA`, GitHub `ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_`/`github_pat_`, Stripe `sk_`/`rk_` with `live` or `test`. Unknown-prefix strings fall back to 20+ characters, mixed case and digits, 4+ bits of entropy per character | `src/secrets.ts` | Each provider's API-key docs (Anthropic, OpenAI, Hugging Face, AWS IAM, GitHub token formats, Stripe API keys) | — |

## Published format

| Upstream | What the code assumes | Code | Check at | Last checked |
|:---|:---|:---|:---|:---|
| **Agent inventory schema v0.1** | `--json` output validates against the vendored `schemas/agent-inventory.schema.json`, which CI compares byte for byte with the published copy. Extras go under `x`; findings use `ruleId` `mcp-frisk/<rule>` | `src/inventory.ts`, `schemas/agent-inventory.schema.json`, `scripts/check-inventory.ts`, `.github/workflows/ci.yml` | https://ai-automation-tools.dev/schemas/agent-inventory/v0.1.json | — |

## Platform and tooling

| Upstream | What the code assumes | Code | Check at | Last checked |
|:---|:---|:---|:---|:---|
| **Node.js** | `engines.node: ">=22.18"` (runs `.ts` files natively, so `scripts/*.ts` and `node --test` need no loader); CI pins 22 | `package.json`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml` | nodejs.org/en/about/previous-releases (EOL dates) | — |
| **TypeScript** | `~6.0` with `erasableSyntaxOnly`; sources import each other with `.ts` extensions | `package.json`, `tsconfig.json`, `tsconfig.build.json` | devblogs.microsoft.com/typescript | — |
| **GitHub Actions** | `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`; Dependabot raises new versions | `.github/workflows/ci.yml`, `.github/workflows/pages.yml` | github.com/actions/checkout/releases ; github.com/actions/setup-node/releases ; github.com/actions/deploy-pages/releases | — |
| **GitHub Pages** | The demo deploys from the `Pages` workflow (`build_type=workflow`); every page path is relative so it works under `/mcp-frisk/` and on the custom domain `mcp-frisk-demo.ai-automation-tools.dev` | `.github/workflows/pages.yml`, `scripts/build-site.ts` | docs.github.com/en/pages | — |

## Dev dependency majors

Majors only: a patch or minor bump is Dependabot's job and never makes this table wrong. The
exact ranges are in `package.json`. *Latest* is the npm registry's on the *Last checked* date.

| Upstream | Major in `package.json` | Latest | Check at | Last checked |
|:---|:---|:---|:---|:---|
| ESLint, @eslint/js | 9, 9 | — | eslint.org/blog | — |
| typescript-eslint | 8 | — | github.com/typescript-eslint/typescript-eslint/releases | — |
| ajv, ajv-formats (schema validation in tests and CI) | 8, 3 | — | github.com/ajv-validator/ajv/releases | — |
| @types/node | 22 | — | npm registry | — |

Flag breaking majors, EOL runtimes, and security advisories only. Routine bumps are
Dependabot's job.
