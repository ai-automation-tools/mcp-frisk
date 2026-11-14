// Plaintext secrets in a server's `env` values and `args`, found by provider pattern or by entropy.
//
// Browser-safe: no Node imports (ADR-001). A hit carries the raw value so the JSON report can
// fingerprint it; everything meant for a person uses `shown`, the prefix plus the last four.

import type { Finding, Severity } from "./rules.ts";
import type { ServerEntry } from "./servers.ts";

/** The agent inventory schema's credential types this module can name. */
export type CredentialType = "api-key" | "access-key" | "personal-access-token" | "other";

export interface SecretPattern {
  provider: string;
  type: CredentialType;
  /** Regex source. Group 1 is the prefix shown before the "…"; the whole match is the secret. */
  pattern: string;
}

export interface SecretRule {
  id: string;
  severity: Severity;
  title: string;
}

export const SECRET_RULES = {
  known: { id: "plaintext-secret", severity: "high", title: "Plaintext API key in env or args" },
  entropy: { id: "high-entropy-string", severity: "low", title: "High-entropy string in env or args, possibly a secret" },
} as const satisfies Record<string, SecretRule>;

// A key must not be glued to a longer word on its left (`xsk-...` is not an OpenAI key).
const EDGE = "(?<![A-Za-z0-9_])";

/** Checked in order; the first pattern that claims a stretch of text wins it. */
export const SECRET_PATTERNS: SecretPattern[] = [
  { provider: "Anthropic API key", type: "api-key", pattern: `${EDGE}(sk-ant-)[A-Za-z0-9_-]{20,}` },
  { provider: "OpenAI API key", type: "api-key", pattern: `${EDGE}(sk-(?!ant-)(?:proj-|svcacct-|admin-)?)[A-Za-z0-9_-]{20,}` },
  { provider: "Hugging Face token", type: "api-key", pattern: `${EDGE}(hf_)[A-Za-z0-9]{30,}` },
  { provider: "AWS access key id", type: "access-key", pattern: `${EDGE}(AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9])` },
  { provider: "GitHub token", type: "personal-access-token", pattern: `${EDGE}(gh[pousr]_|github_pat_)[A-Za-z0-9_]{22,}` },
  { provider: "Stripe key", type: "api-key", pattern: `${EDGE}((?:sk|rk)_(?:live|test)_)[A-Za-z0-9]{16,}` },
];

/** A token this long, with upper case, lower case and digits, at or above this many bits per character. */
export const ENTROPY = { minLength: 20, minBits: 4 };
const TOKEN = /[A-Za-z0-9+/_-]+=*/g;

export interface SecretHit {
  ruleId: string;
  severity: Severity;
  title: string;
  /** "Anthropic API key", or undefined for an entropy hit. */
  provider?: string;
  type: CredentialType;
  /** Where in the entry: `env NAME` or `args[2]`. */
  where: string;
  line: number;
  /** The secret itself. Never print it: use `shown`. */
  value: string;
  /** Prefix plus last four: `sk-ant-…a1b2`. */
  shown: string;
}

export function findSecrets(server: ServerEntry): SecretHit[] {
  const hits: SecretHit[] = [];
  const places = [
    ...server.env.map((v) => ({ where: `env ${v.name}`, text: v.value, line: v.line })),
    ...server.args.map((a, i) => ({ where: `args[${i}]`, text: a.value, line: a.line })),
  ];
  for (const { where, text, line } of places) {
    let rest = text;
    for (const p of SECRET_PATTERNS) {
      for (const m of rest.matchAll(new RegExp(p.pattern, "g"))) {
        const rule = SECRET_RULES.known;
        hits.push({ ruleId: `mcp-frisk/${rule.id}`, severity: rule.severity, title: rule.title, provider: p.provider, type: p.type, where, line, value: m[0], shown: redact(m[0], m[1]) });
      }
      // Blank out what this pattern claimed so a later pattern or the entropy check can't report it again.
      rest = rest.replace(new RegExp(p.pattern, "g"), (s) => " ".repeat(s.length));
    }
    for (const m of rest.matchAll(TOKEN)) {
      if (!looksRandom(m[0])) continue;
      const rule = SECRET_RULES.entropy;
      hits.push({ ruleId: `mcp-frisk/${rule.id}`, severity: rule.severity, title: rule.title, type: "other", where, line, value: m[0], shown: redact(m[0], "") });
    }
  }
  return hits;
}

/** One finding per hit. The message holds the redacted form only. */
export function secretFindings(server: ServerEntry, hits: SecretHit[]): Finding[] {
  return hits.map((h) => ({
    ruleId: h.ruleId,
    severity: h.severity,
    title: h.title,
    server: server.name,
    scope: server.scope,
    line: h.line,
    message: h.provider
      ? `${h.provider} in ${h.where}: ${h.shown}`
      : `random-looking ${h.value.length}-character string in ${h.where}: ${h.shown}`,
  }));
}

/** `sk-ant-…a1b2`: the known prefix (or nothing), an ellipsis, the last four characters. */
export function redact(secret: string, prefix: string): string {
  return `${prefix}…${secret.slice(-4)}`;
}

/** Shannon entropy in bits per character. */
export function entropy(s: string): number {
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const n of counts.values()) bits -= (n / s.length) * Math.log2(n / s.length);
  return bits;
}

function looksRandom(token: string): boolean {
  return token.length >= ENTROPY.minLength && /[a-z]/.test(token) && /[A-Z]/.test(token) && /[0-9]/.test(token) &&
    entropy(token) >= ENTROPY.minBits;
}
