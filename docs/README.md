<a id="docs-top"></a>

<h1 align="center">📚 mcp-frisk Documentation</h1>

<p align="center">
  <em>What mcp-frisk is meant to do, the order it gets built in, and what has shipped so far.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/audience-builders-8B5CF6?style=for-the-badge" alt="Audience: builders">
  <a href="ROADMAP.md"><img src="https://img.shields.io/badge/plan-ROADMAP-2ea44f?style=for-the-badge" alt="Roadmap"></a>
  <a href="../README.md"><img src="https://img.shields.io/badge/↩-repository_root-6B7280?style=for-the-badge" alt="Repository root"></a>
</p>

---

## 🗺️ Planning

| Document | What's inside |
|:---|:---|
| [**🗺️ ROADMAP.md**](ROADMAP.md) | The release gates in build order, and what waits until after the repo goes public. |
| [**📋 CHANGELOG.md**](CHANGELOG.md) | Every change, newest first. Roadmap items show up here the run they're ticked. |
| [**❓ OPEN-QUESTIONS.md**](OPEN-QUESTIONS.md) | Decisions waiting on the owner. |

## 📦 Product and decisions

| Section | What's inside |
|:---|:---|
| [**📦 product/**](product/README.md) | The spec with its Won't list, and the build plan that marks Slices 0 to 3 as the MVP. |
| [**🧨 threat-model.md**](threat-model.md) | The four named attacks, checked against primary sources, and which rule catches each, Slice 1b's included. |
| [**🚧 Gate check**](reports/2026-gate-check.md) | Whether an existing tool already does this (no maintained offline one does), checked 2026-11-06. |
| [**⚖️ ADR-001**](decisions/adr-001-typescript-shared-core.md) | Why one TypeScript core serves both the CLI and the browser demo, instead of a Go binary. |

<p align="right">(<a href="#docs-top">back to top</a>)</p>

---

<p align="center">
  <a href="../README.md">← Repository home</a> ·
  <a href="ROADMAP.md">Next: Roadmap →</a>
</p>
