import { spawnSync } from "node:child_process";
import type { Mode } from "./config.js";
import { oops } from "./ui.js";

/** The ONE place that knows which engine a mode means and how to run it. */
export type Engine = "npm" | "pnpm";

export const engineFor = (mode: Mode): Engine => (mode === "local" ? "npm" : "pnpm");

/**
 * Run the engine and translate the child result into an exit code.
 * - Windows: npm/pnpm are .cmd shims — they only resolve through a shell.
 * - A child killed by a SIGNAL has status null; that is a FAILURE, never 0
 *   (a SIGKILLed install must not look green in CI).
 */
export function runEngine(engine: Engine, args: string[]): number {
  const r = spawnSync(engine, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.error) {
    oops(`could not run "${engine}". Is it installed?`);
    if (engine === "pnpm") console.error("  hint: run 'corepack enable pnpm' (or install pnpm).");
    return 1;
  }
  if (r.signal) {
    oops(`${engine} was killed by ${r.signal}.`);
    return 1;
  }
  return r.status ?? 1;
}
