// The browser demo's page script: frisk a pasted config with the modules the CLI runs.
//
// Browser-safe: no Node imports (ADR-001). `npm run build` copies the compiled module and the
// modules it imports to `_site/js/`, and `site/index.html` calls `mount(document)`. Output goes
// into `textContent` only, so a hostile config can't inject markup into the page.

import { formatText } from "./format.ts";
import { friskText } from "./frisk.ts";
import { VERSION } from "./version.ts";

/** One planted problem of each kind mcp-frisk flags. Every key is fake and says FAKE. */
export const SAMPLE = `{
  // A planted sample: every key below is fake. One problem of each kind mcp-frisk flags.
  // This setting belongs in a repo's .claude/settings.json; it's flagged in either file.
  "enableAllProjectMcpServers": true,
  "mcpServers": {
    "build-helper": { "command": "bash", "args": ["-c", "npm run mcp-server"] },
    "project-helper": { "command": "node", "args": ["-e", "import('./tools/helper.mjs')"] },
    "notes": { "command": "uvx", "args": ["example-notes-mcp", "--root=$(pwd)"] },
    "files": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "$HOME/projects"] },
    "logs": { "command": "docker", "args": ["run", "-i", "--rm", "example/logs-mcp", "&&", "echo", "started"] },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_FAKE0demo0token0for0mcpfrisk0dD4e" }
    },
    "session": {
      "command": "uvx",
      "args": ["example-session-mcp"],
      "env": { "SESSION_SECRET": "FAKEn7Wq2Lx9Rv4Kt8Zb3Hc6Jm5Pd" }
    },
    "docs": { "url": "https://example.com/mcp" }
  }
}
`;

/** The CLI's text report for one pasted config. `project`: treat it as a repo's own `.mcp.json`. */
export function friskPaste(text: string, project: boolean): string {
  const result = friskText(text, { project });
  return formatText([{ path: "pasted config", client: "pasted", scope: "given", ...result }], {
    version: VERSION,
    checked: 1,
    display: (path) => path,
  });
}

/** The parts of a DOM element the page uses. */
export interface PageElement {
  value: string;
  checked: boolean;
  textContent: string | null;
  addEventListener(type: string, listener: () => void): void;
}

/** Wire the page: `#config` textarea, `#project` checkbox, `#sample` button, `#findings` output. */
export function mount(doc: { getElementById(id: string): PageElement | null }): void {
  const get = (id: string): PageElement => {
    const el = doc.getElementById(id);
    if (!el) throw new Error(`demo page is missing #${id}`);
    return el;
  };
  const config = get("config");
  const project = get("project");
  const findings = get("findings");
  const frisk = () => {
    findings.textContent = friskPaste(config.value, project.checked);
  };
  config.addEventListener("input", frisk);
  project.addEventListener("change", frisk);
  get("sample").addEventListener("click", () => {
    config.value = SAMPLE;
    project.checked = true;
    frisk();
  });
}
