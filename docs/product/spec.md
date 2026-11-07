# Spec: MCPFrisk MVP

> Copied from the mcp-frisk business plan (`Analysis/mcp-frisk/build/spec.md` in the private pipeline workspace) on 2026-11-05, with Mike's approval notes applied. This copy is the one the roadmap works from.

**Decision it serves:** the plan's decision memo (private) · **Status:** draft
**The bet being tested:** enough developers will run, share or star a zero-execution MCP config linter that reach clears ~13,300 viewers in a year.

## Users & jobs

- **Dev who clones unfamiliar repos** `[assum]`: "before I open this in an agent, tell me if its MCP config will run something odd or leaks a key."
- **Maintainer who commits `.mcp.json`** `[assum]`: "stop me publishing a token."
- No user interviews exist. Both jobs are hypotheses; the Miasma worm is the only observed behaviour behind the first `[fact, C]`.

## Threat model (verify before freezing; leads are grade D)

Repo-borne configs executed by the client on open (TrustFall class), shell wrappers and interpolation in `command`/`args`, and plaintext secrets in `env`. Not in scope: tool poisoning, prompt injection, runtime behaviour of servers.

## In scope (MVP: three features)

### Must (MVP feature 1) Frisk a config
- **Discover and parse** - As a developer, I want `mcpfrisk` to find MCP configs in the current repo and the user's home, so that I do not hunt for them.
  - AC: Given fixture directories for Claude Code, Claude Desktop, Cursor, VS Code and a repo `.mcp.json`, When run, Then each file is found on its OS-specific path and every server entry is parsed, or reported as unparseable with a reason.
- **Shell-injection rules** - As a developer, I want risky `command`/`args` shapes flagged, so that I can see what a config would run.
  - AC: Given `sh -c`, `bash -c`, `cmd /c`, `powershell -c`, unquoted `$VAR`, backticks, and `;`/`&&`/`|` in args, When linted, Then each yields a finding with rule id, server name, file and line; a curated allow-shape list (`npx -y <pkg>`, `uvx`, `docker run`) yields none.

### Must (MVP feature 2) Secrets and report
- **Secret detector** - As a maintainer, I want plaintext keys in `env` and args flagged and redacted, so that I do not publish them.
  - AC: Given fixtures with Anthropic, OpenAI, Hugging Face, AWS, GitHub and Stripe keys, When scanned, Then each is flagged by pattern, shown only as `sk-…last4`, and a high-entropy string with no known prefix is a low-severity finding.
- **Report and exit code** - As a CI user, I want text and JSON output and a non-zero exit on high findings, so that a hook can gate on it.
  - AC: Given findings above `--fail-on`, When run, Then exit code is 1; JSON validates against the Agent Security Suite's agent inventory schema v0.1 (see Mike's approval notes below); no network call is made (tested by running with sockets blocked).

### Must (MVP feature 3) Browser demo
- **Paste-and-frisk page** - As a visitor, I want to paste a config and see findings, so that I can try it without installing.
  - AC: Given the GitHub Pages site, When a config is pasted, Then findings render using the same rule code as the CLI, with nothing sent off-page (verified by a test that stubs `fetch` to fail).

### Should / Could (post-MVP)
SARIF output; GitHub Action; more clients (Windsurf, Gemini CLI, Copilot, Continue); `.mcpfrisk.lock` and package postinstall diff; rule suppressions file.

## Explicitly out of scope (Won't, this version)

- **Refusing a client's launch** - cannot be done from outside; exit codes only.
- **Keychain migration** - writes secrets and edits configs; risk without demand evidence.
- **Poisoned-marketplace and SANDWORM signature list** - no sourced roster exists; revisit with a primary source.
- **Single Go binary** - the shared TypeScript core serves the CLI and the demo (ADR-001).
- **Cloud tier, accounts, telemetry** - no payment evidence; also contradicts the no-network promise.
- **Starting or connecting to any server** - this is the wedge; never.

## Non-functional requirements

- Zero network, zero child processes: asserted in tests `[assum]`.
- Lint of a 200-server config under 1 s on a laptop `[assum]`.
- Node 20+ for the CLI; demo works in current Chrome, Firefox, Safari with no build-time secrets `[assum]`.
- Findings never print a full secret.

## Open questions

- Do mcpguard / mcp-cve-lint / Snyk's skip-servers mode already cover this? Owner: first roadmap item, by 2026-11-02. **Answered 2026-11-06:** no maintained offline tool covers the three Musts; see [the gate check](../reports/2026-gate-check.md).
- Are TrustFall, CVE-2026-47751, CVE-2026-57860 correctly characterised? Fetch primaries before writing rule docs. **Answered 2026-11-06:** not all of them; see [the threat model](../threat-model.md). The scope question it raised is in [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md).

## Mike's approval notes

From the `Plan approval: mcp-frisk` issue (#12 in the private pipeline repo, closed as Completed 2026-11-05). Binding on this spec and the roadmap.

- **Emit the shared agent inventory format.** The JSON report is an `agent-inventory.json` document (schema v0.1, `Docs/Agent-Security-Suite/agent-inventory.schema.json` in the org docs; a copy is vendored into this repo with the report item). Each MCP server becomes an identity (`kind: mcp-server`, `platform: mcp`, a stable `id` such as `mcp:<config file>#<server name>`). Its `tools[]` is filled with capability tags (`execute-shell`, `network-egress`, `read-secrets`, ...) inferred from the config, and its `credentials[]` lists every secret found, **by fingerprint only** (first 12 hex of SHA-256), never the value. Findings use `ruleId` `mcp-frisk/<rule>`. This is what makes mcp-frisk the discovery step for the rest of the suite (GhostGrant, Scope Drift Trimmer).
- Re-scored 7/10 under the org charter (Pillar A: agent security, identity and compliance), up from 6.
