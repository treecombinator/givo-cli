import { readPkg } from "../config.js";
import {
  api,
  bearer,
  readTokenStore,
  saveTokenToStore,
  dropTokenFromStore,
  scopeOf,
  TOKENS_PATH,
} from "../registry.js";
import { parseFlags, flagValue, fail, isTty, promptHidden, readStdin } from "../cliutil.js";
import { say, warn, oops } from "../ui.js";

/**
 * The account trio — login / whoami / logout. All LOCAL: they manage the identities
 * saved on this computer (~/.givo/tokens.json, one token per scope, "*" = default).
 * The registry is only consulted by login, to ask WHO a pasted token is — the user
 * never has to know or type which scope a token belongs to.
 */

const DEFAULT_KEY = "*";
/** Users never face the raw "*" — it reads as "(default)" everywhere. */
const label = (key: string) => (key === DEFAULT_KEY ? "(default)" : key);
const mask = (token: string) => `${token.slice(0, 10)}…`;

interface WhoamiBody {
  kind: "root" | "token";
  username?: string;
  scopes?: { publish?: string[]; admin?: string[] };
}

/**
 * givo login [token] — sign in on this computer.
 * Token sources: argument > stdin (--with-token) > hidden interactive prompt.
 * The identity comes from the registry (whoami); --scope @user is the offline
 * escape hatch that skips the round-trip.
 */
export async function runLogin(args: string[]): Promise<number> {
  const { pos, flags } = parseFlags(args);
  let token = pos[0];
  if (!token && flags["with-token"] === true) token = (await readStdin()).trim();
  if (!token) {
    if (!isTty()) {
      oops("login: no token. Pass it as the argument, or pipe it: givo login --with-token < token.txt");
      return 1;
    }
    token = await promptHidden("Paste your token (shown once at signup; input hidden): ");
  }
  if (!token) {
    oops("login: no token given.");
    return 1;
  }
  if (pos[0] && isTty()) warn("a token typed as an argument lands in shell history — next time, run bare 'givo login'.");

  const scopeFlag = flagValue(flags, "scope");
  let key: string;
  if (scopeFlag) {
    if (!scopeFlag.startsWith("@") || scopeFlag.includes("/")) {
      oops('login: --scope must look like "@user".');
      return 1;
    }
    key = scopeFlag;
  } else {
    const { status, body } = await api("/-/givo/whoami", { headers: bearer(token) });
    if (status === 401) {
      oops("login: the registry rejected this token (invalid or revoked).");
      return 1;
    }
    if (status !== 200) return fail(status, body);
    key = keyFor(body as WhoamiBody);
  }

  saveTokenToStore(key, token);
  if (key === DEFAULT_KEY) {
    say(`logged in with a registry-wide credential — saved as the default identity (${TOKENS_PATH}).`);
  } else {
    say(`logged in as ${key.slice(1)} — this computer now publishes ${key}/* automatically.`);
  }
  return 0;
}

/** Which store slot a registry identity belongs in. */
function keyFor(who: WhoamiBody): string {
  // Root / full admin credentials are not tied to one scope — they are the default.
  if (who.kind === "root" || who.scopes?.admin?.includes("*")) return DEFAULT_KEY;
  if (who.username) return `@${who.username}`;
  // A plain minted token (e.g. CI): when every publish pattern lives in ONE scope, use it.
  const scopes = new Set((who.scopes?.publish ?? []).filter((p) => p.startsWith("@")).map((p) => scopeOf(p)));
  return scopes.size === 1 ? [...scopes][0]! : DEFAULT_KEY;
}

/** givo whoami [--json] — saved identities, and which one publishes THIS folder. */
export function runWhoami(args: string[]): number {
  const { flags } = parseFlags(args);
  const store = readTokenStore();
  const keys = Object.keys(store).sort();
  const pkg = readPkg()?.name;
  const uses = pkg ? (store[scopeOf(pkg)] ? scopeOf(pkg) : store[DEFAULT_KEY] ? DEFAULT_KEY : undefined) : undefined;

  if (flags["json"] === true) {
    console.log(
      JSON.stringify({
        identities: keys.map((k) => ({ scope: k, default: k === DEFAULT_KEY, token: mask(store[k]!) })),
        ...(pkg ? { package: pkg, publishesWith: uses ?? null } : {}),
      }),
    );
    return 0;
  }

  if (keys.length === 0) {
    console.log("not logged in — run 'givo login' (get a token with 'givo signup <username>').");
    return 0;
  }
  for (const k of keys) console.log(`${label(k).padEnd(20)} ${mask(store[k]!)}`);
  if (pkg) {
    console.log(
      uses
        ? `this folder: ${pkg} -> publishes with ${label(uses)}`
        : `this folder: ${pkg} -> no matching identity (--token, GIVO_TOKEN or ~/.npmrc would be needed)`,
    );
  }
  return 0;
}

/**
 * givo logout [@user | default | --all] — remove a saved identity from THIS computer.
 * Local only: the token itself stays valid on the registry ('givo login' signs back in).
 */
export function runLogout(args: string[]): number {
  const { pos, flags } = parseFlags(args);
  const store = readTokenStore();
  const keys = Object.keys(store).sort();
  if (keys.length === 0) {
    say("nothing to log out — no identities saved on this computer.");
    return 0;
  }

  if (flags["all"] === true) {
    for (const k of keys) dropTokenFromStore(k);
    say(`removed ${keys.length === 1 ? "the saved identity" : `all ${keys.length} identities`} from this computer. Tokens stay valid — 'givo login' signs back in.`);
    return 0;
  }

  // No argument: unambiguous only when a single identity exists. Never guess, never prompt.
  const raw = pos[0] ?? (keys.length === 1 ? keys[0]! : undefined);
  if (!raw) {
    oops(`logout: several identities are saved — pick one (${keys.map(label).join(", ")}) or pass --all.`);
    return 1;
  }
  const key = raw === "default" || raw === DEFAULT_KEY || raw === "(default)" ? DEFAULT_KEY : raw;
  if (!dropTokenFromStore(key)) {
    oops(`logout: nothing saved for ${label(key)}. Saved: ${keys.map(label).join(", ")}.`);
    return 1;
  }
  say(`removed ${label(key)} from this computer. The token stays valid — 'givo login' signs back in.`);
  return 0;
}
