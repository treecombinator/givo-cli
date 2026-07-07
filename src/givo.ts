#!/usr/bin/env node
import { runMode } from "./commands/mode.js";
import { isPassthrough, runPassthrough } from "./commands/passthrough.js";
import { runToken } from "./commands/token.js";
import { runDocs } from "./commands/docs.js";
import { runPublish } from "./commands/publish.js";
import { runSetup } from "./commands/setup.js";
import { runSignup } from "./commands/signup.js";
import { isLifecycle, runLifecycle } from "./commands/lifecycle.js";
import { help } from "./help.js";
import { version } from "./meta.js";
import { oops } from "./ui.js";

async function main(): Promise<number> {
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === "--version" || cmd === "-v") {
    console.log(version());
    return 0;
  }
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
    return 0;
  }
  if (cmd === "setup") return runSetup(args);
  if (cmd === "signup") return runSignup(args);
  if (cmd === "mode") return runMode(args);
  if (cmd === "token") return runToken(args);
  if (cmd === "docs") return runDocs(args);
  if (cmd === "publish") return runPublish(args);
  if (isLifecycle(cmd)) return runLifecycle(cmd, args);
  if (isPassthrough(cmd)) return runPassthrough(cmd, args);

  oops(`unknown command "${cmd}". See 'givo help'.`);
  return 1;
}

// process.exitCode (NOT process.exit) so pending stdout flushes — exit() truncates piped output.
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    oops(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
