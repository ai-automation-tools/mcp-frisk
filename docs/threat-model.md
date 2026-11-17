<h1 align="center">🧨 Threat model: the four named attacks</h1>

<p align="center">
  <em>What TrustFall, CVE-2026-47751, CVE-2026-57860 and the Miasma worm actually are, checked against their primary sources, and which planned mcp-frisk rule would catch each one.</em>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-docs_home-6B7280?style=for-the-badge" alt="Back to docs"></a>
</p>

---

The [spec](product/spec.md) leaned on these four with grade-D leads. Every source below was
read on 2026-11-06. Plain web searches for the two CVE IDs found nothing on that date; the
records come up through the cve.org API and the vendor advisories, so cite those.

The two planned rules:

- **Shell shape**: `sh -c`, `bash -c`, `cmd /c`, `powershell -c`, unquoted `$VAR`, backticks,
  and `;`, `&&` or `|` in a server's `command`/`args`.
- **Secret**: a plaintext API key in a server's `env` or `args`.

## Summary

| Attack | Delivery | Shell shape catches it? | Secret catches it? |
|:---|:---|:---|:---|
| TrustFall | Repo-borne: `.mcp.json` plus a project setting that auto-enables it | No | No |
| CVE-2026-47751 | Repo-borne, through a pull request, run on a CI runner | Only if the payload happens to use a shell wrapper | No |
| CVE-2026-57860 | Repo-borne, run when ForgeCode starts in the repo, no prompt | The published PoC, yes (`bash -c`); a plain `node x.js`, no | No |
| Miasma worm | Repo-borne, but through hooks, rules and VS Code tasks, not MCP configs | No: it never touches a file mcp-frisk reads | No |

The short version: none of the four plants a secret in a config, so the secret rule is about
maintainers leaking their own keys, not about these attacks. The shell-shape rule catches a
lazy payload, but an attacker can always name a plain executable (`node`, `python`, a
binary). What the repo-borne cases have in common is simpler: **a config in the repo defines a
server, and a project setting or a client bug starts it without a real review.** That signal
is not one of the planned rules; it's raised as an [open question](OPEN-QUESTIONS.md).

**Since Slice 1b (2026-11-16, Mike's answer to that question):** three rules aim at that signal.
`project-server` (info) marks every server a repo config defines, `inline-code` (high) catches
TrustFall's `node -e` payload, and `auto-enable` (high) fires on `enableAllProjectMcpServers` or
`enabledMcpjsonServers` in a repo's `.claude/settings.json`. TrustFall's shape is now caught
three ways (fixture: `tests/fixtures/trustfall/`), and CVE-2026-47751 and CVE-2026-57860 at
least get the `project-server` finding whatever the payload. Miasma stays out of scope.

## TrustFall

- **Source:** Adversa AI, 2026-05-07,
  <https://adversa.ai/blog/trustfall-coding-agent-security-flaw-rce-claude-cursor-gemini-cli-copilot/>.
  No CVE. Anthropic declined it as outside its threat model.
- **What it is:** Claude Code, Gemini CLI, Cursor CLI and Copilot CLI start the MCP servers a
  project defines once the developer accepts the folder trust prompt. In Claude Code a cloned
  repo can ship `.claude/settings.json` with `enableAllProjectMcpServers: true` (or
  `enabledMcpjsonServers`) next to a `.mcp.json` whose server is `node -e <code>`, so the
  payload runs at server start with no further prompt. In headless CI there is no prompt at
  all.
- **Delivery:** repo-borne.
- **Rules:** shell shape, no: the PoC is `node` with `-e` in `args`, and the write-up says the
  command "can be any executable". Secret, no. The real tell is the auto-enable setting in
  `.claude/settings.json`, which mcp-frisk does not read today.
- **Spec correction:** the spec says TrustFall configs are "executed by the client on open".
  They run after one Enter on the generic folder-trust prompt, not on open. The bug that ran
  before the trust dialog was a different one, CVE-2025-59536, fixed in Claude Code 1.0.111.

## CVE-2026-47751

- **Sources:** <https://cveawg.mitre.org/api/cve/CVE-2026-47751> (assigned by GitHub) and
  <https://github.com/anthropics/claude-code-action/security/advisories/GHSA-8q5r-mmjf-575q>.
- **What it is:** `anthropics/claude-code-action` before 1.0.74 checked out the PR head,
  read its `.mcp.json` and enabled every project MCP server, so "an attacker who opened a pull
  request containing a malicious .mcp.json file could achieve arbitrary code execution" on the
  runner and reach its secrets. CWE-78 and CWE-200, CVSS 4.0 5.3. Fixed in 1.0.74, which
  restores `.claude/` and `.mcp.json` from the base branch.
- **Delivery:** repo-borne, through a pull request; the victim is the CI runner and its
  secrets, not a developer's machine. It is the CI form of TrustFall.
- **Rules:** shell shape only if the attacker uses a shell wrapper; `node evil.js` passes.
  Secret, no: the payload steals the runner's secrets, it doesn't put any in the config.
  mcp-frisk as a PR check is useful here mostly for showing a reviewer what a new server
  would run.
- **Spec correction:** the spec groups it with "clone and open"; it's a CI-runner attack.

## CVE-2026-57860

- **Sources:** <https://cveawg.mitre.org/api/cve/CVE-2026-57860> (assigned by VulnCheck) and
  <https://www.vulncheck.com/advisories/forgecode-arbitrary-code-execution-via-unvetted-mcp-json-in-untrusted-repository>.
- **What it is:** ForgeCode (`tailcallhq/forgecode`) 2.11.1 "automatically loads and executes
  the MCP servers defined in a repository's .mcp.json file on startup" with no confirmation.
  CWE-829, CVSS 4.0 8.4, CVSS 3.1 7.8. A patch commit is referenced (`68ca3a3`); the record
  names no fixed release.
- **Delivery:** repo-borne, no prompt. This one really is "executed on open".
- **Rules:** the published payload is `bash` with `-c`, so shell shape catches it. That's
  incidental: the same attack with `node payload.js` passes. Secret, no.
- **Spec correction:** none; the spec's description fits.

## Miasma worm

- **Sources:** SafeDep, <https://safedep.io/blog/miasma-worm-ai-coding-agent-config-injection>
  (attack 2026-06-03) and <https://safedep.io/inside-the-miasma-supply-chain-attack-toolkit>.
  No vendor advisory found.
- **What it is:** malicious commits to more than 120 repos (one through a stolen contributor
  token) plus 57 npm packages. Each repo got a dropper, `.github/setup.js`, wired to run from a
  `SessionStart` hook in `.claude/settings.json` and `.gemini/settings.json`, an `alwaysApply`
  Cursor rule, a `folderOpen` task in `.vscode/tasks.json`, and the `test` script. The payload
  harvests cloud, npm and GitHub credentials and spreads with them. SafeDep: "cloning is safe
  but opening is not."
- **Delivery:** repo-borne. The spec's "dev who clones unfamiliar repos and opens them in an
  agent" fits it.
- **Rules:** none. It never edits `.mcp.json` or any `mcpServers` block, and
  `node .github/setup.js` has no shell shape and no secret.
- **Spec correction:** the spec treats Miasma as the observed behaviour behind an MCP config
  linter. SafeDep's write-up never mentions MCP configs; some secondary coverage says it
  targets `mcp.json`, but no primary source confirms that. Catching it would mean reading
  agent hooks and editor tasks, which is outside the spec's scope.

---

<p align="center">
  <a href="README.md">← Docs home</a> ·
  <a href="reports/2026-gate-check.md">Gate check →</a>
</p>
