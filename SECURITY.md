# Security Policy

mcp-frisk reads MCP config files, which often hold API keys in plain text. It is built to
read them without running anything, sending anything or printing a key in full, so we take
reports about it seriously.

## Reporting a vulnerability

**Please don't open a public issue for a security vulnerability.**

Report it privately through GitHub:

1. Go to the repository's **Security** tab, then **Report a vulnerability** (GitHub Private
   Vulnerability Reporting).
2. Describe the issue, its impact, and the steps to reproduce it. A proof of concept helps.

We aim to acknowledge a report within a few days and keep you posted while we fix it.
Please give us reasonable time to ship a fix before you disclose it.

## Scope

mcp-frisk is a defensive tool: run it only on systems and config exports you own or are
authorized to review. The README's [Responsible use](README.md#responsible-use) section says
what it never does.

mcp-frisk runs entirely on your machine, or entirely in your browser tab for the demo.
There's no hosted service, no account and no telemetry. The surfaces that matter most:

- **A secret reaching output.** Findings show a key as its prefix and last four characters
  (`sk-…a1b2`) and the JSON report holds a fingerprint only. A full secret in any output,
  log line, error message or report is a bug.
- **Execution.** mcp-frisk never starts an MCP server, never spawns a child process and
  never evaluates config content. A config that makes it run something is in scope.
- **Network.** The CLI and the demo page make no network calls. A code path that does,
  including the demo sending a pasted config anywhere, is in scope.
- **Hostile input.** A malformed or oversized config must produce a finding or an error,
  not a crash that leaks file contents or a hang.

### Not vulnerabilities (by design)

- A clean result doesn't mean a config is safe. mcp-frisk checks the shapes it has rules
  for; it doesn't judge what a server does once it runs.
- Missing a rule for a pattern is a feature request, not a vulnerability. Open an issue.

## Supported versions

mcp-frisk is pre-1.0. Fixes land on the latest `main`.

## Test fixtures

Every key-shaped string in this repo's tests, examples and demo is fake on purpose (for
example `sk-ant-FAKE...`, `ghp_FAKE...`). Never commit a real token, a `.env` file or a local
path. A full-history secret scan (`gitleaks git . --log-opts=--all`) came back clean on
2026-11-05.
