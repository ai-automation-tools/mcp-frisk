<h1 align="center">🗺️ Roadmap</h1>

<p align="center">
  <em>From an empty CLI to a public mcp-frisk that frisks a pasted config on a live demo, in the order it has to happen.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/now-slice_2:_secrets_and_report-F59E0B?style=for-the-badge" alt="Now: Slice 2, secrets and report">
  <img src="https://img.shields.io/badge/stage-incubating-2ea44f?style=for-the-badge" alt="Stage: incubating">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-docs_home-6B7280?style=for-the-badge" alt="Back to docs"></a>
</p>

---

The MCP-Frisk Weekly Roadmap routine works this file top to bottom every Monday, Wednesday
and Friday: it takes the first open item that isn't `🔒 Needs owner` (or up to six `small`
ones), builds it, ticks it and opens a `roadmap/auto-<date>` PR. **Every item above
`## After public release` is a release gate.** mcp-frisk goes public when all of them are
ticked and Mike says so. Ticking an item adds its line to the [changelog](CHANGELOG.md) and
updates any doc it made stale, in the same commit.

Markers: `- [ ]` open, `- [-]` claimed by a run in progress, `- [x]` done, `- [!]` blocked
(the reason follows on the line). `small` marks docs or config a run can batch, up to six
per PR (untagged means a feature, one per run); `🔒 Needs owner` marks one only Mike can do.

The slices come from [product/build-plan.md](product/build-plan.md), which marks Slices 0 to 3
as the MVP. Slice 0's scaffold shipped with the repo, so what's left of it is the gate check.
Slices 1 to 3 are the three features above the line, and deploying Slice 3's page is the
live-demo item in the release phase. Every slice is tested against fixture configs this repo
owns; no item needs a real key, a running MCP server or network access.

## 🧭 Slice 0: Gate check

- [x] `small` **Is this already built?** Write `docs/reports/2026-gate-check.md`: does mcpguard, mcp-cve-lint, or Snyk agent-scan in a mode that skips starting servers already lint MCP configs offline with no account? Does Cisco's mcp-scanner do anything useful with no API keys? Link each repo or doc, say when it was checked, and end with a one-line verdict. If a maintained offline tool already covers the spec's three Musts, add a `🔒 Needs owner` item under this one asking whether to stop (the build plan's first stop rule) and build nothing else until Mike answers. Link the report from `docs/README.md`. — done 2026-11-06: [reports/2026-gate-check.md](reports/2026-gate-check.md), verdict: no maintained offline tool covers the three Musts, so the stop rule doesn't fire
- [x] `small` **Threat model primaries.** Fetch the primary sources for TrustFall, CVE-2026-47751, CVE-2026-57860 and the Miasma worm, and write `docs/threat-model.md`: what each one is, whether it's a repo-borne or local config attack, and which planned rule (shell shape, secret, or none) would catch it. Anything that turns out to be mischaracterized in the spec gets a line saying so. Link it from `docs/README.md`. — done 2026-11-06: [threat-model.md](threat-model.md). All four checked against primaries; TrustFall, CVE-2026-47751 and Miasma are mischaracterized, and only CVE-2026-57860's PoC trips a planned rule. Scope question in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)

## 🔎 Slice 1: Frisk a config

- [x] **Discover, parse and lint for shell injection** (MVP feature 1). `mcpfrisk` finds MCP configs in the current repo (`.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`) and the user's home (Claude Code, Claude Desktop, Cursor, VS Code) on Windows, macOS and Linux paths, taking the home directory as an argument so tests use fixture homes. Every server entry is parsed, JSONC included, or reported as unparseable with a reason; an empty config, malformed JSON and an unreadable file each have a fixture. Shell-injection rules flag `sh -c`, `bash -c`, `cmd /c`, `powershell -c`, unquoted `$VAR`, backticks, and `;`, `&&` or `|` in args, each finding carrying rule id, server name, file and line; the allow-shape list (`npx -y <pkg>`, `uvx`, `docker run`) yields none. Every rule has a passing and a failing fixture. Rules live as data (ADR-001), in one module with no Node imports so the browser can load it. CI runs on `ubuntu-latest` and `windows-latest`. — done 2026-11-09: JSONC parser `src/jsonc.ts`, extractor `src/servers.ts`, four rules as data in `src/rules.ts` (shell-wrapper, command-substitution, shell-variable, shell-operator) plus the allow-shape list, discovery `src/discover.ts` for repo and Windows/macOS/Linux homes, `src/scan.ts` for unreadable and oversize files; fixtures in `tests/fixtures/`, CI on both OSes. Built to the spec as written; the auto-start question in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) is still open

## 🔐 Slice 2: Secrets and report

- [ ] **Secrets, redaction and the inventory report** (MVP feature 2). Plaintext keys in `env` and `args` are flagged by pattern for Anthropic, OpenAI, Hugging Face, AWS, GitHub and Stripe, shown only as prefix plus last four (`sk-…a1b2`); a high-entropy string with no known prefix is a low-severity finding. Output is text by default and `--json` writes an agent inventory document (schema v0.1, vendored to `schemas/agent-inventory.schema.json`): one identity per server (`kind: mcp-server`, `platform: mcp`, stable `id`), `tools[]` with capability tags inferred from the config, `credentials[]` by fingerprint only (first 12 hex of SHA-256), findings with `ruleId` `mcp-frisk/<rule>`. A test validates the output against the schema, and a test greps every output for the fixture secrets and fails on a full match. `--fail-on <severity>` exits 1 when a finding meets it. A test runs the CLI with `net` and `child_process` stubbed to throw and proves no socket or process is opened.

## 🖥️ Slice 3: Browser demo

- [ ] **Paste-and-frisk page** (MVP feature 3). `site/index.html` gets a paste box that runs the same rule and secret modules as the CLI (bundled or imported as ES modules from the build, no copy of the rules) and renders the findings with redaction. A sample config with one planted problem of each kind loads with one click, all keys obviously fake. A test loads the page's script with `fetch` and `XMLHttpRequest` stubbed to fail and proves frisking still works and nothing is sent. `npm run build` writes the page to `_site/`.

## 🚦 Public release

- [x] `small` **CI.** `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm test` and `npm run build` on push to `main` and on every PR, with `permissions: contents: read`. — done 2026-11-05: shipped with the scaffold
- [x] `small` **Security.** `SECURITY.md` says how to report a vulnerability and what counts as one. — done 2026-11-05: shipped with the scaffold
- [x] `small` **Demo shell.** `site/index.html` with the org source bar across the top and a "coming soon" body, and `site/favicon.svg`, the app icon in the shared dark-tile format. — done 2026-11-05: shipped with the scaffold
- [x] `small` **Secret scan.** `gitleaks git . --log-opts=--all` comes back clean on the full history. — done 2026-11-05: clean on the scaffold commit
- [ ] `small` **README usage matches the code.** Install line, every command and flag, a sample run on a fixture config with its real output, and the spec's Won't list stated plainly (no launch blocking, no server starts, no network, no cloud tier). Each command run against the packed build (`npm pack`, installed in a scratch folder) and behaving as written.
- [ ] `small` **Responsible use.** A README section saying the tool is defensive only: run it on systems and exports you own or are authorized to review; what it never does (no connection to any MCP server, no launch of a configured command, no change to the config it reads); and that the demo uses planted, fictional fixtures only. `SECURITY.md` links to it. (Pillar A release gate, org charter 2026-11-05.)
- [ ] **Live demo at `https://ai-automation-tools.dev/mcp-frisk/`.** An `actions/deploy-pages` workflow builds and publishes `_site/` from `main` (enable Pages for the repo with `gh api` in the same PR), until the publish step moves it to `https://mcp-frisk-demo.ai-automation-tools.dev/`. The page shows the MVP working: paste or load the sample config, see its findings. It keeps the source bar and app-icon favicon from the shell, holds no real personal data or real keys, and makes no network call. The README hero's Live Demo badge points at it.

## After public release

Nothing below blocks go-live.

## 🧩 Next slices

- [ ] **Slice 4: SARIF and a GitHub Action.** `--sarif` output that GitHub code scanning accepts, and a composite Action that runs mcp-frisk on a repo's MCP configs and uploads it. Tested in this repo's own CI.
- [ ] **Slice 5: more clients.** Discovery for Windsurf, Gemini CLI, GitHub Copilot and Continue, each with fixture homes on Windows and Linux paths.
- [ ] **Slice 6: `.mcpfrisk.lock`.** Record each server's package and version; a later run reports what changed, including a new postinstall script.
- [ ] **Slice 7: suppressions file.** `.mcpfrisk-ignore` with a rule id, a server and a required reason; suppressed findings still show in JSON with `status: accepted-risk`.
- [ ] **Slice 8: revisit enforcement shims and a Go binary**, only if at least three outside users ask for either in issues.
- [ ] **Move the agent inventory schema public.** When mcp-frisk is the suite's first public project to emit it, publish the schema from this repo (or a small `agent-inventory-schema` repo) and point the org docs' Agent Security Suite page at it.

### 📣 Publish and promote

- [ ] `small` `CONTRIBUTING.md` saying how to run the tests and add a rule with its passing and failing fixtures.
- [ ] `npm publish --dry-run` is clean, then tag v0.1 and publish to npm as `mcpfrisk`. 🔒 Needs owner
- [ ] Launch post built on the demo ("paste your `.mcp.json`, see what it would run"), sent where agent-security practitioners read. 🔒 Needs owner
- [ ] Custom subdomain `mcp-frisk-demo.ai-automation-tools.dev`. 🔒 Needs owner
- [ ] 60 days after the repo goes public, run the build plan's stop test: under 50 stars and 200 npm downloads means stop post-release work and park it. 🔒 Needs owner

### 💰 Revenue

None planned. The spec rules out a cloud tier, accounts and telemetry; revisit only if users
ask for a hosted feature.

---

<p align="center">
  <a href="README.md">← Docs home</a> ·
  <a href="CHANGELOG.md">Changelog →</a>
</p>
