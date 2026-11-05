# ADR-001: One TypeScript core shared by the CLI and the browser demo

**Status:** proposed · **Reversibility:** two-way (rules live as data; the engine is small)
**Serves:** [spec.md](../product/spec.md)

## Context

The card wants a single static Go binary. The plan needs a client-side demo on GitHub Pages and agent-friendly weekly increments. A Go core would need a WASM build for the demo, a second toolchain, and a separate path for the web page.

## Options considered

1. **TypeScript core, Node CLI via `npx`, same module bundled for the browser** - cost: build time ~0; recurring $0 (npm, GitHub Pages free `[assum]`).
2. **Go core, WASM for the demo** - single static binary for hardened images, but two toolchains and a heavier demo build · cost: ~2 extra runs `[assum]`.
3. **Python CLI** - fits Cisco's ecosystem, no browser path.

## Decision

Option 1. The deciding fact is that the demo and the CLI must run identical rule code (the spec asserts it), and one language does that without WASM.

## Exit cost

Low. Rules and fixtures are JSON/YAML data with expected findings; porting the ~1,000-line engine to Go is a few runs `[assum]`. Do it only if users ask for the static binary.

## Cost envelope

$0/month at launch and at the 4,500-install viral case `[assum]`: npm and GitHub Pages have no per-install cost.

## Consequences

Needs Node 20+ for the CLI, which the card's "no runtime" hardened-image use case does not get. First bottleneck: parsing JSONC and YAML-style configs consistently across clients, which is why discovery owns the schedule variance.
