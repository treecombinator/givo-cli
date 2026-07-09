#!/usr/bin/env node
import { runMode } from "./commands/mode.js";
import { isPassthrough, runPassthrough } from "./commands/passthrough.js";
import { runLogin, runWhoami, runLogout } from "./commands/account.js";
import { runAdmin } from "./commands/admin.js";
import { runDocs } from "./commands/docs.js";
import { runPublish } from "./commands/publish.js";
import { runSetup } from "./commands/setup.js";
import { runSignup } from "./commands/signup.js";
import { isLifecycle, runLifecycle } from "./commands/lifecycle.js";
import { help } from "./help.js";
import { version } from "./meta.js";
import { warn, oops } from "./ui.js";
import { REGISTRY } from "./config.js";

async function main(): Promise<number> {
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === "--version" || cmd === "-v") {
    console.log(version());
    return 0;
  }
  // A redirected registry changes where installs come from and where tokens go.
  // Loud on every command so an accidental or malicious override cannot hide.
  if (process.env["GIVO_REGISTRY"] && cmd) {
    warn(`registry override active: ${REGISTRY}/ (GIVO_REGISTRY is set)`);
  }
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
    return 0;
  }
  if (cmd === "setup") return runSetup(args);
  if (cmd === "signup") return runSignup(args);
  if (cmd === "login") return runLogin(args);
  if (cmd === "whoami") return runWhoami(args);
  if (cmd === "logout") return runLogout(args);
  if (cmd === "admin") return runAdmin(args);
  if (cmd === "mode") return runMode(args);
  if (cmd === "token") {
    // The old mixed command. Point each half at its new home instead of guessing.
    oops("'givo token' split up: your login is 'givo login | whoami | logout'; registry-operator commands are 'givo admin token <ls|mint|rm>'.");
    return 1;
  }
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
