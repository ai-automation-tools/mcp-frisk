<h1 align="center">🚧 Gate check: is this already built?</h1>

<p align="center">
  <em>The build plan's first stop rule: if a maintained offline tool already covers the spec's three Musts, mcp-frisk stops. Checked 2026-11-06.</em>
</p>

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/↩-docs_home-6B7280?style=for-the-badge" alt="Back to docs"></a>
</p>

---

The three Musts from the [spec](../product/spec.md):

1. **Frisk a config.** Find the repo and user MCP configs, parse every server, flag shell
   shapes in `command`/`args` (`sh -c`, `bash -c`, `cmd /c`, `powershell -c`, `$VAR`,
   backticks, `;`/`&&`/`|`).
2. **Secrets and report.** Flag plaintext keys in `env`/`args`, never print one in full, JSON
   report, `--fail-on` exit code, no network.
3. **Browser demo.** The same rules on a pasted config, nothing sent off-page.

The bar for "already built": maintained, starts no server, needs no account, makes no
network call. Every link below was read on 2026-11-06, from the project's README or package
page; activity dates come from the GitHub API. For Cisco's scanner the source was read too.

## Summary

| Tool | Last activity | Starts or connects to servers | Account or network | Shell shapes in config | Config secrets | Demo |
|:---|:---|:---|:---|:---|:---|:---|
| loplop-h/mcpguard | 2026-03-31 | `scan` no; `inspect` yes | None (except `--verify`) | Partly | Yes | No |
| peedrolzz/mcpguard | 2026-05-19, one commit | Only with `--connect` | None by default | No | Yes | No |
| kriskimmerle/mcpguard | Archived 2026-02-14 | No | None | Shell command only | Yes | No |
| `mcpguard` on PyPI (aryanjp1) | 2026-02-27, one release | No | Unclear for `check-package` | Shell invocation | Yes | No |
| mcp-cve-lint | 2026-08-08 | No | Not stated | No (checks Python source) | No | No |
| config-guard (`mcp-config-guard`) | 2026-03-08 | No | None | `shell=True`, shell servers | Yes | No |
| Snyk Agent Scan | 2026-11-06 | Yes | Snyk account and remote API | No | Redacts, doesn't flag | No |
| Cisco mcp-scanner | 2026-11-06 | Yes | Keys for two analyzers | No | No | No |

## The tools

### mcpguard: four projects with the same name

- **[loplop-h/mcpguard](https://github.com/loplop-h/mcpguard)** is the closest match. It
  auto-detects Claude Desktop, Claude Code, Cursor, VS Code and Windsurf configs, and says
  "No API keys, no accounts, everything runs locally". Rule MCP01 covers hardcoded keys
  (AWS, OpenAI, GitHub, Anthropic, Stripe) and high-entropy strings. MCP05/MCP08 cover
  "Shell metacharacters" and "pipe/redirect in args". It outputs JSON and SARIF, and `check`
  gives a pass/fail exit code. It doesn't name `sh -c`, `$VAR` or backticks, documents no
  redaction and no severity threshold, has no demo, and is Python. `inspect` connects to
  stdio servers. 8 commits, 2 stars, last commit 2026-03-31: dormant.
- **[peedrolzz/mcpguard](https://github.com/peedrolzz/mcpguard)** runs offline and flags
  hardcoded env secrets, with exit codes and `--fail-on`. It has no shell-injection rule, and
  `--connect` and `fix` reach servers and npm. A single commit on 2026-05-19.
- **[kriskimmerle/mcpguard](https://github.com/kriskimmerle/mcpguard)** is static and flags
  shell commands (MG04) and hardcoded keys. Archived 2026-02-14.
- **[mcpguard on PyPI](https://pypi.org/project/mcpguard/)**
  ([aryanjp1/mcpguard](https://github.com/aryanjp1/mcpguard)) does static analysis with
  shell-invocation and hardcoded-key rules. One release, 0.1.0, on 2026-02-27, and nothing
  since.

### [mcp-cve-lint](https://pypi.org/project/mcp-cve-lint/)

Repo [patchwright/mcp-lint](https://github.com/patchwright/mcp-lint), 0.2.0 on 2026-07-28. It
has two rules, each tied to a CVE. MC001 flags unauthenticated network servers in a config.
MC002 flags a non-literal `command` in Python `StdioServerParameters` calls. It doesn't look
at shell shapes in config `args` and has no secret rule. Different scope.

### [config-guard](https://github.com/KGT24k/config-guard) (PyPI `mcp-config-guard`)

A zero-dependency Python linter that runs "before any MCP server starts. No API keys. No
cloud." It has 20 checks, including secret leakage in args and env, `shell=True`, raw shell
servers and `eval`/`exec` patterns, with JSON and SARIF output. It also ships a hard-coded
malicious-package list, which this spec ruled out for itself. It doesn't name the
metacharacter shapes, documents no redaction and has no demo. One release (2.0.0,
2026-03-02), last commit 2026-03-08: dormant.

### [Snyk Agent Scan](https://github.com/snyk/agent-scan) (formerly Invariant mcp-scan)

Actively maintained (v0.6.11 on 2026-11-06). "Agent Scan starts stdio MCP servers by
executing the commands in the config." It needs a Snyk account (`SNYK_TOKEN`) and sends
"MCP server configurations and signatures, tool names and descriptions" to the Agent Scan
API, with config secrets redacted first. Background scans skip starting servers unless
`--dangerously-run-mcp-servers` is set, but that is a consent gate, not an offline linter, and
the README documents no static mode. One third-party blog post claims there is an offline
subcommand; the official README doesn't back it up.

### [Cisco mcp-scanner](https://github.com/cisco-ai-defense/mcp-scanner)

Actively maintained (4.8.7 on 2026-10-20). With no API keys, the YARA, readiness, prompt
defense and vulnerable-package analyzers still run. They work on the tool descriptions a
*live* server returns, though. In
[`scanner.py`](https://github.com/cisco-ai-defense/mcp-scanner/blob/main/mcpscanner/core/scanner.py),
`scan_mcp_config_file` calls `scan_stdio_server_tools` (launches the command, with the
config's `env` merged in) or `scan_remote_server_tools` (connects) for every server. `static`
mode reads pre-generated tool dumps, not config files. It doesn't check `command`/`args`
shapes or flag secrets in `env`. Its vulnerable-package check calls PyPI/OSV.

### Not checked

[mcplint-sec](https://pypi.org/project/mcplint-sec/), mcp-runtime-audit and
eslint-plugin-mcp-security turned up in passing. The next gate check should look at them.

## What this means

The space is crowded with small offline linters. Three of them (loplop-h/mcpguard,
config-guard, kriskimmerle/mcpguard) cover much of Musts 1 and 2. All three are dormant or
archived. None documents redaction, none runs in a browser, and none emits the Agent Security
Suite inventory format. The two maintained tools both run the servers they scan, and Snyk's
also needs an account and a remote API. That's the opposite of the wedge.

The wedge is real but thin. mcp-frisk's difference is being maintained, never printing a
secret, running the same rules in the browser, and producing the inventory document. "Offline
config linter" alone isn't a difference. The [threat model](../threat-model.md) points the
same way: none of the four named attacks plants a secret, and only one uses a shell wrapper.

**Verdict: no maintained offline tool covers the three Musts. The stop rule doesn't fire, so the build continues.**

---

<p align="center">
  <a href="../README.md">← Docs home</a> ·
  <a href="../threat-model.md">Threat model →</a>
</p>
