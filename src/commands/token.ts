import { resolveToken, api, bearer, saveTokenToNpmrc } from "../registry.js";
import { parseFlags, flagValue, fail } from "../cliutil.js";
import { say, oops } from "../ui.js";

interface TokenInfo {
  id: string;
  label: string;
  scopes: { read: string[]; publish: string[]; admin: string[] };
  deny?: string[];
  revokedAt: string | null;
}

function csv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function runToken(args: string[]): Promise<number> {
  const sub = args[0];
  const { pos, flags } = parseFlags(args.slice(1));

  // `save` takes the token as its argument; it needs no resolved credential.
  if (sub === "save") {
    const raw = pos[0];
    if (!raw) {
      oops("usage: givo token save <token>");
      return 1;
    }
    say(`token saved to ${saveTokenToNpmrc(raw)}`);
    return 0;
  }

  const token = resolveToken(flags["token"]);
  if (!token) {
    oops("token: no token. Use --token <t>, GIVO_TOKEN or ~/.npmrc (needs admin scope).");
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
        oops(`token mint: --${f} needs a value.`);
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
      oops("usage: givo token rm <id>");
      return 1;
    }
    const { status, body } = await api(`/-/tokens/${encodeURIComponent(id)}`, { method: "DELETE", headers: bearer(token) });
    if (status !== 200) return fail(status, body);
    say(`token ${id} revoked`);
    return 0;
  }

  oops("usage: givo token <ls | mint --label L --publish 'a,b' [--admin '*'] [--deny 'x'] | rm <id> | save <token>>");
  return 1;
}
