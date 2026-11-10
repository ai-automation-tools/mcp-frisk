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
- `mcpfrisk` finds MCP configs in the current repo (`.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`) and the user's home (Claude Code, Claude Desktop, Cursor, VS Code) on Windows, macOS and Linux paths, parses them as JSONC, and flags shell-injection shapes with four rules (`shell-wrapper`, `command-substitution`, `shell-variable`, `shell-operator`) while `npx -y`, `uvx` and `docker run` pass. Each finding names its rule, server, file and line; unparseable files and entries and unreadable files get a reason. CI now runs on Ubuntu and Windows. *Slice 1: Frisk a config*

**Docs**
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
