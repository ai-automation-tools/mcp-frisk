#!/usr/bin/env node
import { homedir } from "node:os";
import { run } from "./main.ts";
import type { Platform } from "./discover.ts";

const platform: Platform = process.platform === "win32" || process.platform === "darwin" ? process.platform : "linux";
const result = run({ argv: process.argv.slice(2), cwd: process.cwd(), home: homedir(), platform, env: process.env });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.code;
