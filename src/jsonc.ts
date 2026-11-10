// A small JSONC parser that keeps the line of every value.
//
// Browser-safe: no Node imports (ADR-001). Config input is hostile, so this never evaluates
// anything, never builds objects keyed by untrusted strings (entries stay in arrays, so a
// `__proto__` key is just a string), and caps nesting depth instead of trusting the stack.

export type JsonNode =
  | { type: "object"; line: number; entries: JsonEntry[] }
  | { type: "array"; line: number; items: JsonNode[] }
  | { type: "string"; line: number; value: string }
  | { type: "number"; line: number; value: number }
  | { type: "boolean"; line: number; value: boolean }
  | { type: "null"; line: number };

export interface JsonEntry {
  key: string;
  keyLine: number;
  value: JsonNode;
}

export type ParseResult =
  | { ok: true; root: JsonNode | undefined }
  | { ok: false; reason: string; line: number };

export const MAX_DEPTH = 256;

class JsoncError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(message);
    this.line = line;
  }
}

/**
 * Parse JSON with comments and trailing commas. An empty or whitespace-only document parses to
 * `root: undefined`. Errors carry a reason and a line, never a slice of the input.
 */
export function parseJsonc(text: string): ParseResult {
  const p = new Parser(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  try {
    p.skip();
    if (p.done()) return { ok: true, root: undefined };
    const root = p.value(0);
    p.skip();
    if (!p.done()) p.fail("unexpected content after the top-level value");
    return { ok: true, root };
  } catch (err) {
    if (err instanceof JsoncError) return { ok: false, reason: err.message, line: err.line };
    throw err;
  }
}

/** Find a key in an object node. The last duplicate wins, as with `JSON.parse`. */
export function getEntry(node: JsonNode | undefined, key: string): JsonEntry | undefined {
  if (node?.type !== "object") return undefined;
  for (let i = node.entries.length - 1; i >= 0; i--) {
    if (node.entries[i].key === key) return node.entries[i];
  }
  return undefined;
}

class Parser {
  private readonly s: string;
  private i = 0;
  private line = 1;

  constructor(s: string) {
    this.s = s;
  }

  done(): boolean {
    return this.i >= this.s.length;
  }

  fail(message: string): never {
    throw new JsoncError(message, this.line);
  }

  private advance(): string {
    const ch = this.s[this.i++];
    if (ch === "\n") this.line++;
    return ch;
  }

  /** Skip whitespace and comments. */
  skip(): void {
    while (this.i < this.s.length) {
      const ch = this.s[this.i];
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
        this.advance();
      } else if (ch === "/" && this.s[this.i + 1] === "/") {
        while (this.i < this.s.length && this.s[this.i] !== "\n") this.i++;
      } else if (ch === "/" && this.s[this.i + 1] === "*") {
        const startLine = this.line;
        this.i += 2;
        while (this.i < this.s.length && !(this.s[this.i] === "*" && this.s[this.i + 1] === "/")) {
          this.advance();
        }
        if (this.i >= this.s.length) throw new JsoncError("unterminated block comment", startLine);
        this.i += 2;
      } else {
        return;
      }
    }
  }

  value(depth: number): JsonNode {
    if (depth > MAX_DEPTH) this.fail(`nesting deeper than ${MAX_DEPTH} levels`);
    this.skip();
    if (this.done()) this.fail("unexpected end of file");
    const ch = this.s[this.i];
    const line = this.line;
    if (ch === "{") return this.object(depth);
    if (ch === "[") return this.array(depth);
    if (ch === '"') return { type: "string", line, value: this.string() };
    if (ch === "-" || (ch >= "0" && ch <= "9")) return { type: "number", line, value: this.number() };
    if (this.s.startsWith("true", this.i)) return this.literal(4, { type: "boolean", line, value: true });
    if (this.s.startsWith("false", this.i)) return this.literal(5, { type: "boolean", line, value: false });
    if (this.s.startsWith("null", this.i)) return this.literal(4, { type: "null", line });
    if (ch === "'") this.fail("single-quoted strings are not JSON");
    return this.fail("unexpected character");
  }

  private literal(length: number, node: JsonNode): JsonNode {
    this.i += length;
    return node;
  }

  private object(depth: number): JsonNode {
    const line = this.line;
    this.advance(); // {
    const entries: JsonEntry[] = [];
    for (;;) {
      this.skip();
      if (this.done()) this.fail("unterminated object");
      if (this.s[this.i] === "}") {
        this.advance();
        return { type: "object", line, entries };
      }
      if (this.s[this.i] !== '"') this.fail("expected a quoted property name");
      const keyLine = this.line;
      const key = this.string();
      this.skip();
      if (this.s[this.i] !== ":") this.fail("expected ':' after a property name");
      this.advance();
      const value = this.value(depth + 1);
      entries.push({ key, keyLine, value });
      this.skip();
      if (this.s[this.i] === ",") {
        this.advance();
      } else if (this.s[this.i] !== "}") {
        this.fail(this.done() ? "unterminated object" : "expected ',' or '}'");
      }
    }
  }

  private array(depth: number): JsonNode {
    const line = this.line;
    this.advance(); // [
    const items: JsonNode[] = [];
    for (;;) {
      this.skip();
      if (this.done()) this.fail("unterminated array");
      if (this.s[this.i] === "]") {
        this.advance();
        return { type: "array", line, items };
      }
      items.push(this.value(depth + 1));
      this.skip();
      if (this.s[this.i] === ",") {
        this.advance();
      } else if (this.s[this.i] !== "]") {
        this.fail(this.done() ? "unterminated array" : "expected ',' or ']'");
      }
    }
  }

  private string(): string {
    const startLine = this.line;
    this.i++; // opening quote
    let out = "";
    for (;;) {
      if (this.i >= this.s.length) throw new JsoncError("unterminated string", startLine);
      const ch = this.s[this.i++];
      if (ch === '"') return out;
      if (ch === "\n") throw new JsoncError("line break inside a string", startLine);
      if (ch !== "\\") {
        out += ch;
        continue;
      }
      const esc = this.s[this.i++];
      switch (esc) {
        case '"': out += '"'; break;
        case "\\": out += "\\"; break;
        case "/": out += "/"; break;
        case "b": out += "\b"; break;
        case "f": out += "\f"; break;
        case "n": out += "\n"; break;
        case "r": out += "\r"; break;
        case "t": out += "\t"; break;
        case "u": {
          const hex = this.s.slice(this.i, this.i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail("bad \\u escape in a string");
          out += String.fromCharCode(parseInt(hex, 16));
          this.i += 4;
          break;
        }
        default:
          this.fail("bad escape in a string");
      }
    }
  }

  private number(): number {
    const re = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    re.lastIndex = this.i;
    const m = re.exec(this.s);
    if (!m) this.fail("bad number");
    this.i += m[0].length;
    return Number(m[0]);
  }
}
