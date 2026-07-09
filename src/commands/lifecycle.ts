import { readPkg } from "../config.js";
import { resolveToken, api, bearer } from "../registry.js";
import { parseFlags, flagValue, fail } from "../cliutil.js";
import { say, oops } from "../ui.js";

/**
 * Version lifecycle: publish puts a DRAFT up (mutable); these commands move it on.
 *   release   <v>            seal it: stamp + advance `latest` (immutable from here on)
 *   unpublish <v>            discard a draft (a release is permanent)
 *   deprecate <v> [message]  soft warning; still installable
 *   tombstone <v> [reason]   kill-switch: tarball becomes a gravestone (410), record stays
 */
const ACTIONS = ["release", "unpublish", "deprecate", "tombstone"] as const;
type Action = (typeof ACTIONS)[number];

export function isLifecycle(cmd: string): cmd is Action {
  return (ACTIONS as readonly string[]).includes(cmd);
}

export async function runLifecycle(action: Action, args: string[]): Promise<number> {
  const { pos, flags } = parseFlags(args);
  const version = pos[0];
  if (!version) {
    const extra = action === "deprecate" ? " [message]" : action === "tombstone" ? " [reason]" : "";
    oops(`usage: givo ${action} <version>${extra} [--pkg <name>] [--token <t>]`);
    return 1;
  }
  const name = flagValue(flags, "pkg") ?? readPkg()?.name;
  if (!name) {
    oops(`${action}: no package (run inside a package directory, or pass --pkg <name>).`);
    return 1;
  }
  const token = resolveToken(flags["token"], name);
  if (!token) {
    oops(`${action}: not logged in for ${name} (run 'givo login', or pass --token / GIVO_TOKEN).`);
    return 1;
  }

  // Free text comes from the remaining positionals (multi-word without quotes) or the flag.
  const text = pos.slice(1).join(" ");
  let query = "";
  if (action === "deprecate") {
    query = `?message=${encodeURIComponent(text || flagValue(flags, "message") || "Deprecated.")}`;
  }
  if (action === "tombstone") {
    query = `?reason=${encodeURIComponent(text || flagValue(flags, "reason") || "unspecified")}`;
  }

  const { status, body } = await api(`/${name}/-/${action}/${encodeURIComponent(version)}${query}`, {
    method: "POST",
    headers: bearer(token),
  });
  if (status !== 200) return fail(status, body);

  const result = body as Record<string, unknown>;
  if (action === "release") say(`released ${name}@${version} (latest: ${result["latest"]}). Sealed; immutable from here on.`);
  if (action === "unpublish") say(`unpublished draft ${name}@${version}.`);
  if (action === "deprecate") say(`deprecated ${name}@${version}: ${result["deprecated"]}`);
  if (action === "tombstone") say(`tombstoned ${name}@${version} (${result["reason"]}). Installs now get 410; the record stays.`);
  return 0;
}
