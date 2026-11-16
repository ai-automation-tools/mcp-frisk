# Open questions

## Open

## Answered

### Should mcp-frisk flag project configs that auto-start servers (read `.claude/settings.json`), not just shell shapes?
- Asked: 2026-11-06 by mcp-frisk-roadmap
- Context: The [threat model](threat-model.md) found the planned shell-shape rule misses every real repo-borne attack. TrustFall's PoC is `node -e <code>`, and both CVE-2026-47751 and CVE-2026-57860 work just as well with `node payload.js`. Their common thread is a repo `.mcp.json` that defines a server, plus either `enableAllProjectMcpServers`/`enabledMcpjsonServers` in `.claude/settings.json` or a client that starts project servers on its own. Options: (a) keep the spec as written; (b) add to Slice 1 an info-level "project config defines an executable server" finding, a rule for inline-code args (`node -e`, `python -c`), and a high-severity finding when `.claude/settings.json` auto-enables project servers; (c) also read agent hooks and `.vscode/tasks.json` `folderOpen` tasks to catch Miasma. Recommendation: (b). It stays inside "lint the config an agent loads" and catches TrustFall and CVE-2026-47751 in the configs this repo can own as fixtures. (c) turns mcp-frisk into a general repo-trust scanner, a bigger product.
- Answer: (b) Add the info-level "project config defines an executable server" finding to Slice 1, plus the inline-code args rule (`node -e`, `python -c`), and the high-severity finding when `.claude/settings.json` auto-enables project servers. Not (c). (Mike, 2026-11-16)
