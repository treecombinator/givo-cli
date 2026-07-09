import { resolveToken, api, bearer } from "../registry.js";
import { parseFlags, flagValue, fail } from "../cliutil.js";
import { say, oops } from "../ui.js";

/**
 * givo admin — registry-OPERATOR commands (they act on the registry itself and need the
 * admin credential). Deliberately out of the everyday surface: a normal account manages
 * its own login with `givo login | whoami | logout` and never comes here.
 *
 *   givo admin token ls                     every registry token
 *   givo admin token mint --label L --publish 'a,b' [--admin '*'] [--deny 'x']
 *   givo admin token rm <id>                revoke by id
 */

interface TokenInfo {
  id: string;
  label: string;
  scopes: { read: string[]; publish: string[]; admin: string[] };
  deny?: string[];
  revokedAt: string | null;
}

const USAGE = "usage: givo admin token <ls | mint --label L --publish 'a,b' [--admin '*'] [--deny 'x'] | rm <id>>";

function csv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function runAdmin(args: string[]): Promise<number> {
  if (args[0] !== "token") {
    oops(USAGE);
    return 1;
  }
  const sub = args[1];
  const { pos, flags } = parseFlags(args.slice(2));

  const token = resolveToken(flags["token"]);
  if (!token) {
    oops("admin: no credential. Log in with the admin token ('givo login'), or pass --token / GIVO_TOKEN.");
    return 1;
  }

  if (sub === "ls") {
    const { status, body } = await api("/-/tokens", { headers: bearer(token) });
    if (status !== 200) return fail(status, body);
    const list = (body as { tokens?: TokenInfo[] }).tokens ?? [];
    if (list.length === 0) {
      console.log("(no tokens)");
      return 0;
    }
    for (const t of list) {
      const state = t.revokedAt ? "revoked" : "active";
      const deny = t.deny?.length ? ` deny=${JSON.stringify(t.deny)}` : "";
      console.log(
        `${t.id}  ${state.padEnd(8)}  ${t.label}  publish=${JSON.stringify(t.scopes.publish)} admin=${JSON.stringify(t.scopes.admin)}${deny}`,
      );
    }
    return 0;
  }

  if (sub === "mint") {
    // Bare flags (--publish with no value) are a mistake, not an empty scope — fail loud.
    for (const f of ["label", "publish", "admin", "deny"]) {
      if (flags[f] === true) {
        oops(`admin token mint: --${f} needs a value.`);
        return 1;
      }
    }
    const label = flagValue(flags, "label") ?? "unnamed";
    const publish = csv(flagValue(flags, "publish"));
    const admin = csv(flagValue(flags, "admin"));
    const deny = csv(flagValue(flags, "deny"));
    const { status, body } = await api("/-/tokens", {
      method: "POST",
      headers: { ...bearer(token), "content-type": "application/json" },
      body: JSON.stringify({ label, scopes: { publish, admin }, deny }),
    });
    if (status !== 201) return fail(status, body);
    const b = body as { id: string; token: string; scopes: unknown };
    say(`token created: ${b.id}`);
    console.log(`>>> ${b.token}    (copy now; shown only once)`);
    console.log(`scopes: ${JSON.stringify(b.scopes)}${deny.length ? ` deny: ${JSON.stringify(deny)}` : ""}`);
    return 0;
  }

  if (sub === "rm") {
    const id = pos[0];
    if (!id) {
      oops("usage: givo admin token rm <id>");
      return 1;
    }
    const { status, body } = await api(`/-/tokens/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: bearer(token),
    });
    if (status !== 200) return fail(status, body);
    say(`token ${id} revoked`);
    return 0;
  }

  oops(USAGE);
  return 1;
}
