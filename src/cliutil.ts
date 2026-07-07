/**
 * Tiny flag parser. Supports `--key value`, `--key=value`, bare `--flag` (=> true),
 * and `--` (everything after it is positional). A flag's value is a string;
 * a bare flag is the boolean `true` — so a literal value "true" stays representable.
 */
export function parseFlags(args: string[]): { pos: string[]; flags: Record<string, string | true> } {
  const pos: string[] = [];
  const flags: Record<string, string | true> = {};
  let onlyPositional = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === undefined) continue;
    if (onlyPositional || !a.startsWith("--")) {
      pos.push(a);
      continue;
    }
    if (a === "--") {
      onlyPositional = true;
      continue;
    }
    const eq = a.indexOf("=");
    if (eq !== -1) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[a.slice(2)] = next;
      i++;
    } else {
      flags[a.slice(2)] = true;
    }
  }
  return { pos, flags };
}

/** The string value of a flag, or undefined when absent or passed bare (no value). */
export function flagValue(flags: Record<string, string | true>, name: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" && v !== "" ? v : undefined;
}

import { oops } from "./ui.js";

export function fail(status: number, body: unknown): number {
  const msg = typeof body === "string" ? body : JSON.stringify(body);
  oops(`error ${status}: ${msg}`);
  return 1;
}
