import { readPkg, readMode, ensureNpmrc, REGISTRY } from "../config.js";
import { runEngine } from "../engine.js";
import { parseFlags } from "../cliutil.js";
import { say, oops } from "../ui.js";

/**
 * The command that makes GIVO the registry — the actual "replace npmjs" switch.
 *   --project  this project's .npmrc (what passthrough installs also keep current)
 *   --global   machine-wide (~/.npmrc via npm config; pnpm reads it too)
 * No flag: project when inside one, global otherwise.
 */
export function runSetup(args: string[]): number {
  const { flags } = parseFlags(args);
  const wantGlobal = flags["global"] === true;
  const wantProject = flags["project"] === true;
  if (wantGlobal && wantProject) {
    oops("setup: pick ONE of --global or --project.");
    return 1;
  }

  const target = wantGlobal ? "global" : wantProject ? "project" : readPkg() ? "project" : "global";

  if (target === "project") {
    if (!readPkg()) {
      oops("setup: no package.json here; not a project. Use --global for machine-wide.");
      return 1;
    }
    ensureNpmrc(readMode());
    say(`project registry -> ${REGISTRY}/  (.npmrc)`);
    console.log("  your packages come hosted from GIVO; everything else is federated from npmjs.");
    return 0;
  }

  // --no-workspaces: stay robust inside a monorepo, where npm otherwise refuses
  // global/config commands with ENOWORKSPACES.
  const status = runEngine("npm", ["config", "set", "registry", `${REGISTRY}/`, "--location=user", "--no-workspaces"]);
  if (status === 0) {
    say(`global registry -> ${REGISTRY}/  (~/.npmrc)`);
    console.log("  GIVO now fronts npmjs for every install on this machine.");
    console.log("  undo: npm config delete registry --location=user");
  }
  return status;
}
