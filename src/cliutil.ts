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

export const isTty = (): boolean => process.stdin.isTTY === true;

/** Ask a free-text question on a TTY (prompts to stderr, so stdout stays clean). */
export async function prompt(question: string): Promise<string> {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** Yes/no on a TTY. `defaultYes` decides an empty answer. */
export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const answer = (await prompt(question)).toLowerCase();
  if (answer === "") return defaultYes;
  return answer === "y" || answer === "yes";
}
