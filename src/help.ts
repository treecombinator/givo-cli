import { readMode, REGISTRY } from "./config.js";
import { version } from "./meta.js";

const WORDMARK = [
  " ██████╗ ██╗██╗   ██╗ ██████╗ ",
  "██╔════╝ ██║██║   ██║██╔═══██╗",
  "██║  ███╗██║██║   ██║██║   ██║",
  "██║   ██║██║╚██╗ ██╔╝██║   ██║",
  "╚██████╔╝██║ ╚████╔╝ ╚██████╔╝",
  " ╚═════╝ ╚═╝  ╚═══╝   ╚═════╝ ",
].join("\n");

/** Pretty header. Colors only on a TTY so pipes/redirects stay clean. */
function header(): string {
  const tty = process.stdout.isTTY;
  const green = tty ? "\x1b[32m" : "";
  const dim = tty ? "\x1b[2m" : "";
  const reset = tty ? "\x1b[0m" : "";
  return `${green}${WORDMARK}${reset}\n${dim}v${version()}  -  The GIVO package manager  -  npm + pnpm + the GIVO registry${reset}`;
}

export function help(): void {
  console.log(`
${header()}

usage: givo <command> [args]

setup (point npm/pnpm at the GIVO registry):
  givo setup                 this project's .npmrc (or global when outside a project)
  givo setup --global        machine-wide (~/.npmrc): GIVO replaces npmjs everywhere

mode (picks the underlying engine, per project):
  givo mode                  show current mode (now: ${readMode()})
  givo mode global           shared store (pnpm): dedup, lean node_modules
  givo mode local            own copy (npm): max compatibility (e.g. React Native)

packages (passthrough to the mode's engine):
  givo install | add <pkg> | remove <pkg> | run <script> | build

GIVO registry:
  givo signup <username>                     create your account (name + email + code): scope @<username>/*, permanent
  givo publish [args]                       publish a DRAFT to ${REGISTRY}/
  givo release <version>                    seal a draft: stamp it + move "latest" (immutable)
  givo unpublish <version>                  discard a draft (a release is permanent)
  givo deprecate <version> [message]        soft warning; still installable
  givo tombstone <version> [reason]         kill-switch: installs get 410, record stays
  givo docs push <pkg> <file> [--v V]       upload README/AGENTS.md (root, or version V)
  givo docs get  <pkg> <file> [--v V]       read a doc (version falls back to root)

account (this computer):
  givo login [token]                        sign in: the CLI asks the registry who the token is
                                            and files it under your scope (no arg = hidden prompt;
                                            scripts: --with-token < file, or --scope @u offline)
  givo whoami [--json]                      saved identities + which one publishes THIS folder
  givo logout [@user | default | --all]     remove a saved identity (local only; token stays valid)

credential for registry commands: --token <t> > GIVO_TOKEN > your login for the package's scope > ~/.npmrc
admin (registry operator only): givo admin token <ls | mint | rm>
registry: ${REGISTRY}/   (your packages hosted + everything else federated from npmjs)
`);
}
