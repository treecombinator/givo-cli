import { REGISTRY } from "../config.js";
import { api, saveTokenToStore } from "../registry.js";
import { parseFlags, flagValue, fail, isTty, prompt, confirm } from "../cliutil.js";
import { say, warn, oops, bold } from "../ui.js";

/**
 * givo signup <username> — self-service account, verified by email.
 *
 * Interactive (TTY): asks for name and email, the registry emails a 6-digit code, asks for
 * the code, shows the token once, and offers to save it. The scope is exactly @<username>/*
 * (never bare names, never admin) and the username is permanent.
 *
 * Scriptable / agents (no TTY): pass --name and --email to request the code, then re-run
 *   with --code <code> to finish. --save stores the token for @<username> in
 *   ~/.givo/tokens.json (the multi-identity store).
 */
export async function runSignup(args: string[]): Promise<number> {
  const { pos, flags } = parseFlags(args);
  const username = pos[0]?.toLowerCase();
  if (!username) {
    oops("usage: givo signup <username> [--name N] [--email E] [--code C] [--save]");
    return 1;
  }

  const code = flagValue(flags, "code");
  // With --code we skip straight to verification (the code was already emailed).
  if (!code) {
    const requested = await requestCode(username, flags);
    if (typeof requested === "number") return requested;
    if (!isTty()) {
      say(`code sent to ${bold(requested.email)}. Finish with: givo signup ${username} --code <code>`);
      return 0;
    }
    return verify(username, (await prompt(`enter the 6-digit code sent to ${requested.email}: `)).trim(), flags);
  }
  return verify(username, code, flags);
}

/** Phase 1: collect name + email, ask the registry to email a code. */
async function requestCode(
  username: string,
  flags: Record<string, string | true>,
): Promise<number | { email: string }> {
  let name = flagValue(flags, "name");
  let email = flagValue(flags, "email");
  if ((!name || !email) && !isTty()) {
    oops("signup: --name and --email are required when not interactive.");
    return 1;
  }
  if (!name) name = await prompt("your name: ");
  if (!email) email = await prompt("your email: ");

  const { status, body } = await api("/-/givo/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, name, email }),
  });
  if (status !== 202) return fail(status, body);
  return { email: (body as { email: string }).email };
}

/** Phase 2: send the code, show the token, offer to save it. */
async function verify(username: string, code: string, flags: Record<string, string | true>): Promise<number> {
  const { status, body } = await api("/-/givo/signup/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, code }),
  });
  if (status !== 201) return fail(status, body);

  const b = body as { username: string; scope: string; token: string; id: string };
  say(`welcome, ${bold(b.username)}. Your publish scope: ${bold(b.scope)}`);
  warn(`the username is permanent: no renames, and your packages live under ${b.scope} forever.`);
  console.log(`>>> ${b.token}    (copy now; shown only once)`);

  const shouldSave = flags["save"] === true || (isTty() && (await confirm(`save this token for @${b.username}? [Y/n] `)));
  if (shouldSave) {
    say(`token saved for @${b.username} in ${saveTokenToStore(`@${b.username}`, b.token)}`);
  } else {
    say(`save it later: givo token save <token> --scope @${b.username}   (or export GIVO_TOKEN=<token>)`);
  }
  say(`to publish: name the package "@${b.username}/<name>" and add "publishConfig": { "registry": "${REGISTRY}/" }`);
  return 0;
}
