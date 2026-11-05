# Build plan: MCPFrisk

> Copied from the mcp-frisk business plan (`Analysis/mcp-frisk/build/build-plan.md` in the private pipeline workspace) on 2026-11-05. This copy is the one the roadmap works from.

**Spec:** [spec.md](spec.md) · **Architecture:** [adr-001-typescript-shared-core.md](../decisions/adr-001-typescript-shared-core.md) · **Estimate:** in the private business plan

**MVP = Slices 0 to 3** (three features plus scaffolding). The repo goes public after Slice 3. Everything after is post-release.

## Slice 0 - Gate check and walking skeleton (MVP, 1-2 runs)

- **Delivers:** the two 2026-11-02 checks written up in `docs/`; repo scaffold, CI, an npm package that prints a version, and a Pages site with a blank paste box.
- **De-risks:** whether the project should exist at all; the deploy path.
- **Done when:** the checks are recorded, CI is green, and the Pages site loads from the repo.

## Slice 1 - Frisk a config (MVP feature 1, ~4 runs)

- **Delivers:** discovery and parsing for Claude Code, Claude Desktop, Cursor, VS Code and repo `.mcp.json`; the shell-injection rule set with fixtures and an allow-shape list.
- **De-risks:** the schedule owner and the false-positive risk (every shipped rule needs a passing and failing fixture).
- **Done when:** the spec's discovery and rule ACs pass against fixtures on Windows and Linux CI.

## Slice 2 - Secrets and report (MVP feature 2, ~3 runs)

- **Delivers:** secret detector with redaction, text and JSON output, `--fail-on`, the no-network test.
- **De-risks:** the trust promise (nothing leaves the machine).
- **Done when:** the secrets and report ACs pass and the sockets-blocked test is in CI.

## Slice 3 - Browser demo and release prep (MVP feature 3, ~3 runs)

- **Delivers:** paste-and-frisk page on the same engine, README with a GIF, rule catalog, release notes.
- **De-risks:** discoverability, the reach assumption (demo is the shareable artifact).
- **Done when:** the demo AC passes, the README runs end to end from a clean machine, and Mike approves the release gate. **Public release = MVP.**

## Post-release slices (not MVP)

4. SARIF + GitHub Action. 5. Windsurf, Gemini CLI, Copilot, Continue discovery. 6. `.mcpfrisk.lock` with postinstall diff. 7. Suppressions file. 8. Revisit enforcement shims and the Go binary only if users ask.

## Definition of done

Acceptance criteria pass including empty-config, malformed-JSON and unreadable-file cases; tests in CI concentrated on rules and secret redaction; input treated as hostile (never evaluated, never executed); no secret printed in full; deployed, not merged.

## Cut list (if the estimate runs over)

Could: GIF in README, entropy-only secret findings. Should: Windows path fixtures beyond the two main clients. Must is defended; if Must has to be cut, reopen the spec.

## What we learn, and when we'd stop

The earliest real test is the public release plus one launch post. Stop per the memo: if the Slice 0 checks find a maintained offline tool (2026-11-02), if the MVP is not public by 2027-01-31, or if the repo has under 50 stars and 200 npm downloads 60 days after release.
