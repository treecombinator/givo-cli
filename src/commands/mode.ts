import { readPkg, readMode, writeMode, ensureNpmrc, ensureWorkspace, cleanInstall, type Mode } from "../config.js";
import { say, oops } from "../ui.js";

export function runMode(args: string[]): number {
  const want = args[0];

  if (!want) {
    console.log(`current mode: ${readMode()}`);
    return 0;
  }

  if (want !== "local" && want !== "global") {
    oops(`mode: use "local" or "global" (got "${want}")`);
    return 1;
  }

  // Fail loud outside a project — never fabricate a package.json or clean a non-project dir
  // (same stance as `npm pkg set` / pnpm's ERR_PNPM_NO_PKG_MANIFEST).
  if (!readPkg()) {
    oops("mode: no package.json here; not a project.");
    return 1;
  }

  const mode: Mode = want;
  writeMode(mode);
  ensureNpmrc(mode);
  ensureWorkspace(mode);
  cleanInstall(mode);

  say(`project mode -> ${mode}  (engine: ${mode === "global" ? "pnpm" : "npm"})`);
  console.log("  cleaned node_modules + the other engine's lockfile.");
  console.log("  run 'givo install' to reinstall with the new engine.");
  return 0;
}
