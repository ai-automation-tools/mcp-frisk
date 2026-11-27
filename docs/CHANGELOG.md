<h1 align="center">📋 mcp-frisk Changelog</h1>

<p align="center">
  <em>What changed in mcp-frisk, newest first.</em>
</p>

<p align="center">
  <a href="ROADMAP.md"><img src="https://img.shields.io/badge/plan-ROADMAP-8B5CF6?style=for-the-badge" alt="Roadmap"></a>
  <a href="README.md"><img src="https://img.shields.io/badge/↩-docs-6B7280?style=for-the-badge" alt="Docs home"></a>
</p>

---

Entries that close a roadmap item carry the roadmap phase in italics.

## Unreleased

**Added**
- Live demo at `https://ai-automation-tools.dev/mcp-frisk/`: `.github/workflows/pages.yml` runs `npm run build` on every push to `main`, stamps the commit into `<meta name="build">` and deploys `_site/` to GitHub Pages. The README carries a Live Demo badge. *Public release*
- Agent skill `skills/mcp-frisk/SKILL.md`: how a coding agent in any repo installs `mcpfrisk` (from source until it's on npm), runs it, reads the text and JSON output and exit codes, gates CI on it, and the traps (unreadable files don't change the exit code, `--fail-on critical` never trips, discovery mixes in the user's own configs without `--home`). Every flag and output field was checked against `--help` and real runs.
- CI checks the inventory report end to end. A new `inventory` job confirms the vendored schema is byte-for-byte the published `https://ai-automation-tools.dev/schemas/agent-inventory/v0.1.json`, runs `mcpfrisk --json` on a fixture home with a planted `bash -c` server holding a fake key (`tests/fixtures/ci-home/`), and fails unless `scripts/check-inventory.ts` finds the report valid and both findings in it. *Public release*
- Build stamp: `site/index.html` carries `<meta name="build" content="__BUILD_SHA__">` for the Pages deploy to fill in. *Public release*
- Paste-and-frisk demo page. `site/index.html` runs `src/demo.ts`, which frisks a pasted config with the CLI's own rule and secret modules and shows the CLI's text report, keys redacted; one click loads a sample with one planted problem of each of the nine rules (fake keys), and a checkbox treats the paste as a repo config. `npm run build` now also writes the page and its modules to `_site/` (`scripts/build-site.ts`). A test drives it with `fetch` and `XMLHttpRequest` stubbed to fail. *Slice 3: Browser demo*
- Repo-borne server rules, TrustFall's shape caught three ways. `inline-code` (high) flags an interpreter handed its program as an arg (`node -e`, `python -c`, `deno eval`, `ruby -e`, `php -r` and kin); `project-server` (info) marks every local-command server in a repo config found by discovery; `auto-enable` (high) fires when a repo's `.claude/settings.json` (or `settings.local.json`, both now discovered) sets `enableAllProjectMcpServers` or lists `enabledMcpjsonServers`. In `--json` a settings file with that finding is its own `kind: other` identity. Fixtures for each, plus a TrustFall-shaped repo. Applies Mike's 2026-11-16 answer in `docs/OPEN-QUESTIONS.md`. *Slice 1: Frisk a config*
- Slice 1b is a release gate: Mike's answer put it in Slice 1, so the roadmap's owner question on it is closed. *Public release*
- Secrets and the inventory report. Two new rules: `plaintext-secret` (high) names Anthropic, OpenAI, Hugging Face, AWS, GitHub and Stripe keys in `env` values and args, and `high-entropy-string` (low) flags random-looking strings with no known prefix; text shows a key only as prefix plus last four. `--json` writes an agent inventory document (schema v0.1, vendored to `schemas/agent-inventory.schema.json`): one `mcp-server` identity per server with a stable id, capability tags, credentials by SHA-256 fingerprint only, and `mcp-frisk/<rule>` findings. `--fail-on <severity>` exits 1 when a finding meets it. Tests validate the JSON against the schema, check every output for the planted keys, and run the CLI with sockets, DNS and child processes trapped. A `.gitleaks.toml` allows the planted fixture keys, which all hold `FAKE`. *Slice 2: Secrets and report*
- `mcpfrisk` finds MCP configs in the current repo (`.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`) and the user's home (Claude Code, Claude Desktop, Cursor, VS Code) on Windows, macOS and Linux paths, parses them as JSONC, and flags shell-injection shapes with four rules (`shell-wrapper`, `command-substitution`, `shell-variable`, `shell-operator`) while `npx -y`, `uvx` and `docker run` pass. Each finding names its rule, server, file and line; unparseable files and entries and unreadable files get a reason. CI now runs on Ubuntu and Windows. *Slice 1: Frisk a config*

**Docs**
- ROADMAP: ticked the `SITE_ORG_DEPLOY_KEY` item. The key lives in the `registry-publish` environment (`main` only), not as a plain repo secret.
- README usage matches the packed build: an install line (build and `npm pack` from a clone, then `npm install -g`, until it's on npm), the examples run as `mcpfrisk`, and the Won't list now says plainly that it starts no server and makes no network call. Every command was run against the installed tarball. *Public release*
- README "Responsible use" section: defensive use only, on systems you own or may review; never connects to a server, launches a configured command or changes a config; the demo and fixtures are planted and fictional. `SECURITY.md` links to it. *Public release*
- Roadmap rechecked against the org's 2026-11 requirements: the intro names the roadmap routine instead of its days; new release items for the Pillar A schema-in-CI gate, the build stamp and an owner question on whether the auto-start rules are a gate; the live-demo item stamps the build; Slice 1b (auto-start and inline-code rules) heads the next slices; "Move the agent inventory schema public" became "Link the published schema", since the schema is already published at `ai-automation-tools.dev`.
- Gate check in `docs/reports/2026-gate-check.md`: eight existing MCP scanners compared. No maintained offline tool covers the three Musts, so the build continues. *Slice 0: Gate check*
- Threat model in `docs/threat-model.md`: TrustFall, CVE-2026-47751, CVE-2026-57860 and the Miasma worm checked against primary sources, with the spec's mischaracterizations noted and a scope question opened in `docs/OPEN-QUESTIONS.md`. *Slice 0: Gate check*

## 2026-11-05

**Added**
- Repo scaffold: a TypeScript CLI (`mcpfrisk`) that prints its version, with `npm run build`, `npm test` and `npm run lint` all passing, an MIT licence, and an `.env.example` that says there are no settings.
- CI on push to `main` and on every PR: lint, test and build. *Public release*
- `SECURITY.md` with private reporting through GitHub and what counts as a vulnerability here. *Public release*
- Demo shell in `site/`: the org source bar, a "coming soon" body, and the app icon (a magnifying glass on the shared dark tile) as its favicon. *Public release*

**Docs**
- Root README, the docs hub, this changelog, and a roadmap that puts Slices 0 to 3 of the build plan above the release line.
- The spec and build plan copied from the private business plan into `docs/product/`, with Mike's approval note applied: the JSON report is an agent inventory document. ADR-001 copied into `docs/decisions/`.
- A full-history secret scan came back clean. *Public release*

---

<p align="center">
  <a href="README.md">← Docs home</a> ·
  <a href="ROADMAP.md">Roadmap →</a>
</p>
