import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { REGISTRY } from "./config.js";

const URL_OF = new URL(REGISTRY);
const HOST = URL_OF.host;
// npm keys authTokens by host+path of the registry URL: //registry.givo.dev/npm/:_authToken=
const AUTH_KEYS = [`//${HOST}${URL_OF.pathname}/:_authToken=`, `//${HOST}/:_authToken=`];

/**
 * Token for registry commands: --token > GIVO_TOKEN > ~/.npmrc (this registry's authToken,
 * path-aware like npm itself, host-only accepted as fallback). Mirrors how npm reads
 * .npmrc: comment lines (# or ;) are ignored and `${VAR}` references are expanded.
 */
export function resolveToken(flag?: string | true): string | undefined {
  if (typeof flag === "string" && flag !== "") return flag;
  if (process.env["GIVO_TOKEN"]) return process.env["GIVO_TOKEN"];
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

/**
 * Persist a token as ~/.npmrc's authToken for this registry (path-aware key, the same
 * one npm reads). Replaces a previous token for this registry; leaves everything else.
 */
export function saveTokenToNpmrc(token: string): string {
  const path = join(homedir(), ".npmrc");
  let rc = "";
  try {
    rc = readFileSync(path, "utf8");
  } catch {
    /* no ~/.npmrc yet */
  }
  const kept = rc.split("\n").filter((l) => !AUTH_KEYS.some((k) => l.trim().startsWith(k)));
  while (kept.length && kept[kept.length - 1]?.trim() === "") kept.pop();
  kept.push(`${AUTH_KEYS[0]}${token}`);
  writeFileSync(path, kept.join("\n") + "\n");
  return path;
}
