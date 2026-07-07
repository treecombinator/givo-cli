import { readMode, ensureNpmrc, ensureWorkspace } from "../config.js";
import { engineFor, runEngine } from "../engine.js";
import { annotateAgentDocs } from "../agents-notice.js";

const PASSTHROUGH = new Set([
  "install", "i", "add", "remove", "rm", "update", "up", "run", "build", "test", "start",
]);
// Commands that (re)write node_modules — they need the registry config beforehand and the
// AGENTS.md annotation afterwards. `update` is here on purpose: it unpacks NEW package versions,
// which would otherwise land with their AGENTS.md unwrapped.
const INSTALLING = new Set(["install", "i", "add", "update", "up"]);

export function isPassthrough(cmd: string): boolean {
  return PASSTHROUGH.has(cmd);
}

/**
 * Translate to npm's dialect. pnpm forwards script flags natively; npm swallows them as
 * its own config unless separated with `--` (e.g. `givo test --coverage`).
 */
function argsForNpm(cmd: string, args: string[]): string[] {
  if (cmd === "add") return ["install", ...args];
  if (cmd === "build" || cmd === "test" || cmd === "start") {
    return args.length ? ["run", cmd, "--", ...args] : ["run", cmd];
  }
  if (cmd === "run") {
    const [script, ...rest] = args;
    if (!script) return ["run"];
    return rest.length ? ["run", script, "--", ...rest] : ["run", script];
  }
  return [cmd, ...args];
}

export function runPassthrough(cmd: string, args: string[]): number {
  const mode = readMode();
  const engine = engineFor(mode);

  // Only mutating commands need the registry config; `run`/`test`/etc. must not touch the tree.
  if (INSTALLING.has(cmd)) {
    ensureNpmrc(mode);
    ensureWorkspace(mode);
  }

  const finalArgs = engine === "npm" ? argsForNpm(cmd, args) : [cmd, ...args];
  const status = runEngine(engine, finalArgs);

  // AI-friendly: after a successful install/update, wrap AGENTS.md docs with the safety notice on disk.
  if (status === 0 && INSTALLING.has(cmd)) annotateAgentDocs(process.cwd());
  return status;
}
