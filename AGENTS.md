# AGENTS.md

Standing orders for the agent that works this repo, usually the MCP-Frisk Weekly Roadmap
routine (Monday, Wednesday and Friday).

## What mcp-frisk is

An offline linter for MCP config files. `mcpfrisk` finds the configs coding agents load (a
repo's `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, and the per-user files for Claude
Code, Claude Desktop, Cursor and VS Code), parses every server entry, and flags two things:
`command`/`args` shaped like shell injection, and plaintext API keys in `env` or `args`. It
prints findings as text, or as JSON in the Agent Security Suite's agent inventory format, and
exits non-zero above `--fail-on`. A static browser demo on GitHub Pages runs the same rule code
on a pasted config.

The wedge against the existing scanners: it never starts a server, never needs an account,
and never touches the network.

**The JSON report is an agent inventory document (Mike's approval note, binding).** Schema
v0.1, vendored into `schemas/agent-inventory.schema.json` by the report item. One identity per
MCP server (`kind: mcp-server`, `platform: mcp`, an `id` that is stable across runs), `tools[]`
with capability tags, `credentials[]` by fingerprint only (first 12 hex of SHA-256), findings
with `ruleId` `mcp-frisk/<rule>`. Never add a field the schema doesn't allow; put extras in `x`.

Full spec: `docs/product/spec.md`. Slice order: `docs/product/build-plan.md`. Work queue:
`docs/ROADMAP.md`.

## Stack

- TypeScript 6.0, ESM (`"type": "module"`), Node 22.18 or newer. **npm**, not pnpm or yarn.
  TypeScript is pinned to `~6.0` because `typescript-eslint` doesn't support 7.x yet.
- Sources import each other with `.ts` extensions (`import { VERSION } from "./version.ts"`).
  Node strips types at runtime and `tsc` rewrites the extensions on build
  (`rewriteRelativeImportExtensions`). `erasableSyntaxOnly` is on: no enums, no namespaces,
  no parameter properties.
- Tests: `node:test` and `node:assert/strict`, files in `tests/*.test.ts`. No Jest, no Vitest.
- Lint: ESLint 9 flat config with `typescript-eslint` recommended, plus `tsc --noEmit`.
- `src/cli.ts` is the bin entry and stays thin. Logic goes in modules that take their inputs as
  arguments (the home directory, the platform, file contents) so tests run on fixtures without
  touching the real home folder.
- The rule and secret modules must not import Node built-ins: the browser demo in `site/`
  imports them too (ADR-001). File reading and path discovery live in separate Node-only
  modules (`discover.ts`, `scan.ts`, `main.ts`). The browser-safe set is listed in
  `BROWSER_SAFE` in `tests/cli.test.ts`, which fails if one of them imports anything else at
  runtime; add a new browser-safe module there.
- Settings live in `.env` at the repo root, names in `.env.example`; the real environment
  wins. There are none today, and the product's promise (no network, no keys) means there
  should rarely be one. If one is ever needed, load it with Node's `util.parseEnv`. Never
  tell anyone to set a Windows user environment variable.

## Verify

Run all three from the repo root. All three must pass before a PR opens.

```
npm run lint
npm test
npm run build
```

## Architecture decisions that are already made

- **ADR-001: one TypeScript core** (`docs/decisions/adr-001-typescript-shared-core.md`). The
  CLI and the demo run identical rule code. Don't add a second language or a WASM build.
- **Zero execution.** Never start, connect to or probe an MCP server. Never spawn a child
  process. Never `eval` or `new Function` anything from a config. Config input is hostile.
- **Zero network.** The CLI and the demo make no network calls. A test proves it for each.

## Won't (this version)

Carried from the spec. If a roadmap item seems to need one of these, stop and flag it.

- **Refusing a client's launch.** It can't be done from outside; exit codes only.
- **Keychain migration.** mcp-frisk never writes secrets or edits a config.
- **Poisoned-marketplace or SANDWORM signature lists.** No sourced roster exists.
- **A single Go binary.** The shared TypeScript core serves the CLI and the demo.
- **A cloud tier, accounts or telemetry.**
- **Starting or connecting to any server.** Never. This is the product.

## Standards

- **Never print a secret in full.** Text output shows prefix plus last four (`sk-…a1b2`); JSON
  holds a fingerprint. That covers error messages, debug output and test snapshots too.
- Every rule ships with a fixture that fires it and one that doesn't. Every edge case the
  build plan names is a test: empty config, malformed JSON, unreadable file.
- No new runtime dependency without a line in the PR body saying why. A JSONC parser is a
  reasonable one; most other things are a few lines of code.
- This repo goes public at graduation. Never commit `.env*`, real tokens, real personal data,
  or local paths like `C:\Users\...` or `D:\...`. Key-shaped fixtures must be obviously fake
  (`sk-ant-FAKE...`, `ghp_FAKE...`) and must not pass a real provider's checksum.
- Commit messages: plain imperative sentences ("Add the secret detector"), no Conventional
  Commit prefixes.

## What "done" means for a roadmap item

1. The item's own text is true of the code, checked by running it.
2. `npm run lint`, `npm test` and `npm run build` pass, and new behaviour has a test.
3. Anything the change made untrue is fixed: `README.md`, `docs/`, this file.
4. `docs/CHANGELOG.md` has a line for it, tagged with the roadmap phase in italics, in the
   same commit that flips the box to `- [x]` with a dated note.
5. It's on a `roadmap/auto-<date>` branch with a PR into `main`. Never push to `main`.
