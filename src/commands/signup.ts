import { REGISTRY } from "../config.js";
import { api, saveTokenToNpmrc } from "../registry.js";
import { parseFlags, fail } from "../cliutil.js";
import { say, warn, oops, bold } from "../ui.js";

/**
 * givo signup <username> [--save] — self-service account. The registry mints a token
 * whose publish scope is exactly @<username>/* (nothing else, never admin). --save
 * writes the token into ~/.npmrc for this registry.
 */
export async function runSignup(args: string[]): Promise<number> {
  const { pos, flags } = parseFlags(args);
  const username = pos[0];
  if (!username) {
    oops("usage: givo signup <username> [--save]");
    return 1;
  }

  const { status, body } = await api("/-/givo/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: username.toLowerCase() }),
  });
  if (status !== 201) return fail(status, body);

  const b = body as { username: string; scope: string; token: string; id: string };
  say(`welcome, ${bold(b.username)}. Your publish scope: ${bold(b.scope)}`);
  warn(`the username is permanent: no renames, and your packages live under ${b.scope} forever.`);
  console.log(`>>> ${b.token}    (copy now; shown only once)`);
  if (flags["save"] === true) {
    say(`token saved to ${saveTokenToNpmrc(b.token)}`);
  } else {
    say("save it: export GIVO_TOKEN=<token>, or run signup with --save to write ~/.npmrc");
  }
  say(`to publish: name the package "@${b.username}/<name>" and add "publishConfig": { "registry": "${REGISTRY}/" }`);
  return 0;
}
