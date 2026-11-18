// Read config files and frisk them. Node-only: the file reading lives here, away from the rules.

import { readFileSync, statSync } from "node:fs";
import type { Candidate } from "./discover.ts";
import { friskText } from "./frisk.ts";
import type { FriskResult } from "./frisk.ts";

/** Anything bigger is not a config; refuse it rather than load it. */
export const MAX_CONFIG_BYTES = 10 * 1024 * 1024;

export type FileReport = Candidate & (FriskResult | { status: "unreadable"; reason: string; servers: []; problems: []; findings: []; settings: [] });

export interface FileSystem {
  /** Size in bytes, or undefined when nothing is at the path. Throws on other errors. */
  size(path: string): number | undefined;
  read(path: string): string;
}

export const nodeFs: FileSystem = {
  size(path) {
    try {
      return statSync(path).size;
    } catch (err) {
      if (isMissing(err)) return undefined;
      throw err;
    }
  },
  read(path) {
    return readFileSync(path, "utf8");
  },
};

/**
 * Frisk each candidate that exists. Missing files are left out, unless the user named them;
 * files that exist but can't be read are reported as unreadable with a reason, and files that
 * don't parse as unparseable.
 */
export function scanFiles(candidates: Candidate[], fs: FileSystem = nodeFs): FileReport[] {
  const reports: FileReport[] = [];
  const unreadable = (c: Candidate, reason: string) =>
    reports.push({ ...c, status: "unreadable", reason, servers: [], problems: [], findings: [], settings: [] });
  for (const c of candidates) {
    let text: string;
    try {
      const size = fs.size(c.path);
      if (size === undefined) {
        if (c.scope === "given") unreadable(c, "no such file");
        continue;
      }
      if (size > MAX_CONFIG_BYTES) {
        unreadable(c, `larger than ${MAX_CONFIG_BYTES / 1024 / 1024} MB`);
        continue;
      }
      text = fs.read(c.path);
    } catch (err) {
      if (isMissing(err) && c.scope !== "given") continue;
      unreadable(c, isMissing(err) ? "no such file" : describeError(err));
      continue;
    }
    reports.push({ ...c, ...friskText(text, { project: c.scope === "repo" }) });
  }
  return reports;
}

function isMissing(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

const REASONS: Record<string, string> = {
  EACCES: "permission denied",
  EPERM: "permission denied",
  EISDIR: "it is a folder, not a file",
  EBUSY: "the file is locked by another program",
  ELOOP: "too many symbolic links",
};

/** A short reason from a file error. Never the message, which can repeat the path or content. */
function describeError(err: unknown): string {
  const code = (err as { code?: unknown })?.code;
  if (typeof code === "string") return Object.hasOwn(REASONS, code) ? REASONS[code] : `read failed (${code})`;
  return "read failed";
}
