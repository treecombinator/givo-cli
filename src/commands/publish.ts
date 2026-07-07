import { createInterface } from "node:readline/promises";
import { readMode, readPkg, REGISTRY } from "../config.js";
import { engineFor, runEngine } from "../engine.js";
import { say, oops } from "../ui.js";

const normalize = (url: string) => url.replace(/\/+$/, "");

/** Publish to the GIVO registry, delegating to the mode's engine (npm | pnpm). Lands as a DRAFT. */
export async function runPublish(args: string[]): Promise<number> {
  const pkg = readPkg();
  if (!pkg?.name || !pkg.version) {
    oops("publish: no package here (package.json with name + version required).");
    return 1;
  }

  // Guard: any name can be hosted on GIVO, but the intent must be explicit — either the
  // package declares the GIVO registry in publishConfig, or the publisher confirms. Habitual
  // `givo publish` on a package meant for npmjs must not silently create a GIVO trunk.
  const declared = pkg.publishConfig?.registry;
  const configured = typeof declared === "string" && normalize(declared) === REGISTRY;
  const forced = args.includes("--yes");
  const engineArgs = args.filter((a) => a !== "--yes");
  if (!configured && !forced) {
    oops(`publish: "${pkg.name}" does not declare the GIVO registry in publishConfig.`);
    console.error(`  This publishes to ${REGISTRY}/ as a DRAFT (GIVO lifecycle), NOT to npmjs.`);
    console.error(`  Make it permanent in package.json:  "publishConfig": { "registry": "${REGISTRY}/" }`);
    if (!(await confirm(`Publish "${pkg.name}@${pkg.version}" to GIVO anyway? [y/N] `))) {
      oops("publish: aborted (declare publishConfig, confirm, or pass --yes).");
      return 1;
    }
  }

  const mode = readMode();
  const engine = engineFor(mode);
  // pnpm pre-checks the packument and refuses an existing version CLIENT-side, which would block
  // re-publishing a draft. Immutability is enforced by the REGISTRY (released -> 409), so the
  // client check is redundant — disable it.
  const finalArgs = engine === "pnpm" && !engineArgs.includes("--force") ? [...engineArgs, "--force"] : engineArgs;
  // Direct the upload to the GIVO registry with an explicit flag (no stray .npmrc in the package
  // dir); the auth token still resolves from ~/.npmrc (or the project's) by registry URL.
  const status = runEngine(engine, ["publish", "--registry", `${REGISTRY}/`, ...finalArgs]);

  if (status === 0) {
    console.log("");
    say(`${pkg.name}@${pkg.version} is up as a DRAFT: mutable, republishable, installable via "${pkg.name}@draft".`);
    say(`run 'givo release ${pkg.version}' to seal it and move "latest".`);
  }
  return status;
}

/** TTY: ask. Non-interactive (CI, agents): never assume yes. */
async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}
