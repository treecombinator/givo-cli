import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { REGISTRY } from "./config.js";

const URL_OF = new URL(REGISTRY);
const HOST = URL_OF.host;
// npm keys authTokens by host+path of the registry URL: //registry.givo.dev/npm/:_authToken=
const AUTH_KEYS = [`//${HOST}${URL_OF.pathname}/:_authToken=`, `//${HOST}/:_authToken=`];

/**
 * The saved-token store — several identities side by side, like ~/.ssh keys:
 * one token per scope ("@user"), plus "*" as the default for everything else.
 */
export const TOKENS_PATH = join(homedir(), ".givo", "tokens.json");

export type TokenStore = Record<string, string>;

/** Missing or malformed file -> empty store (never throws; non-string values dropped). */
export function readTokenStore(): TokenStore {
  try {
    const parsed = JSON.parse(readFileSync(TOKENS_PATH, "utf8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const store: TokenStore = {};
      for (const [k, v] of Object.entries(parsed)) if (typeof v === "string" && v) store[k] = v;
      return store;
    }
  } catch {
    /* no store yet, or unreadable JSON */
  }
  return {};
}

export function saveTokenToStore(key: string, token: string): string {
  const store = readTokenStore();
  store[key] = token;
  writeTokenStore(store);
  return TOKENS_PATH;
}

export function dropTokenFromStore(key: string): boolean {
  const store = readTokenStore();
  if (!(key in store)) return false;
  delete store[key];
  writeTokenStore(store);
  return true;
}

function writeTokenStore(store: TokenStore): void {
  mkdirSync(join(homedir(), ".givo"), { recursive: true, mode: 0o700 });
  writeFileSync(TOKENS_PATH, JSON.stringify(store, null, 2) + "\n", { mode: 0o600 });
  chmodSync(TOKENS_PATH, 0o600); // the mode option only applies on creation
}

/** The store key a package falls under: its scope, or "*" when unscoped. */
export function scopeOf(pkg?: string): string {
  if (!pkg?.startsWith("@")) return "*";
  const cut = pkg.indexOf("/");
  return cut > 0 ? pkg.slice(0, cut) : pkg;
}

/**
 * Token for registry commands: --token > GIVO_TOKEN > the saved store (the package
 * scope's token, else "*") > ~/.npmrc (this registry's authToken, path-aware like npm
 * itself, host-only accepted as fallback). The .npmrc read mirrors npm: comment lines
 * (# or ;) are ignored and `${VAR}` references are expanded.
 */
export function resolveToken(flag?: string | true, pkg?: string): string | undefined {
  if (typeof flag === "string" && flag !== "") return flag;
  if (process.env["GIVO_TOKEN"]) return process.env["GIVO_TOKEN"];
  const store = readTokenStore();
  const saved = (pkg?.startsWith("@") ? store[scopeOf(pkg)] : undefined) ?? store["*"];
  if (saved) return saved;
  let rc = "";
  try {
    rc = readFileSync(join(homedir(), ".npmrc"), "utf8");
  } catch {
    return undefined;
  }
  const lines = rc
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("#") && !l.startsWith(";"));
  const line = AUTH_KEYS.map((key) => lines.find((l) => l.startsWith(key))).find(Boolean);
  const raw = line?.split("_authToken=")[1]?.trim();
  if (!raw) return undefined;
  const expanded = raw.replace(/\$\{([^}]+)\}/g, (_, name: string) => process.env[name] ?? "");
  return expanded || undefined;
}

/**
 * The env-var form of this registry's authToken config key — npm AND pnpm read it, so
 * `givo publish` can hand the engine its credential without touching any .npmrc.
 */
export function engineAuthEnv(token: string): Record<string, string> {
  return { [`npm_config_${AUTH_KEYS[0]!.slice(0, -1)}`]: token };
}

export interface ApiResult {
  status: number;
  /** Parsed JSON when the body is JSON; otherwise the raw text. */
  body: unknown;
  /** The raw body, untouched — use this to print/save documents verbatim. */
  text: string;
}

/** Request against the registry. Network failures become a clean Error (no raw stack). */
export async function api(path: string, init: RequestInit = {}): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch(`${REGISTRY}${path}`, init);
  } catch (e) {
    throw new Error(`could not reach ${HOST} (${(e as Error).message}). Are you online?`);
  }
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON body (e.g. a .md) */
  }
  return { status: res.status, body, text };
}

export const bearer = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` });
