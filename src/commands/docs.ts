import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { resolveToken, api, bearer } from "../registry.js";
import { parseFlags, flagValue, fail } from "../cliutil.js";
import { REGISTRY } from "../config.js";
import { say, oops } from "../ui.js";

export async function runDocs(args: string[]): Promise<number> {
  const sub = args[0];
  const { pos, flags } = parseFlags(args.slice(1));
  const pkg = pos[0];
  const file = pos[1];

  if ((sub !== "push" && sub !== "get") || !pkg || !file) {
    oops("usage: givo docs push <pkg> <file> [--v <version>]");
    console.error("       givo docs get  <pkg> <file> [--v <version>]");
    return 1;
  }

  const version = flagValue(flags, "v");
  const name = encodeURIComponent(basename(file));
  const remote = version ? `/${pkg}/${encodeURIComponent(version)}/${name}` : `/${pkg}/${name}`;

  if (sub === "push") {
    const token = resolveToken(flags["token"], pkg);
    if (!token) {
      oops("docs push: no token (you must be able to publish the package).");
      return 1;
    }
    let content: Uint8Array;
    try {
      content = new Uint8Array(readFileSync(file));
    } catch {
      oops(`file not found: ${file}`);
      return 1;
    }
    const { status, body } = await api(remote, { method: "PUT", headers: bearer(token), body: content });
    if (status !== 201) return fail(status, body);
    say(`doc uploaded -> ${REGISTRY}${remote}`);
    return 0;
  }

  const { status, body, text } = await api(remote);
  if (status !== 200) return fail(status, body);
  // Print the raw bytes as received — never re-serialize (a JSON doc must round-trip untouched).
  process.stdout.write(text.endsWith("\n") ? text : text + "\n");
  return 0;
}
