# @givo/cli — agent reference

CLI `givo`: fronts npm/pnpm and the GIVO registry (`https://registry.givo.dev/npm/`).

- **Passthrough**: `install|i|add|remove|rm|update|up|run|build|test|start` → the project
  mode's engine (`givo.mode` in package.json: `global`=pnpm, `local`=npm). Installing
  commands pin the project `.npmrc` to the GIVO registry and wrap every installed
  `AGENTS.md` in an UNTRUSTED safety notice on disk.
- **Setup**: `givo setup [--project|--global]` points npm/pnpm at GIVO.
- **Signup**: `givo signup <username>` — email-verified. Interactive: prompts name +
  email, the registry emails a 6-digit code, then verify shows the token once. Non-TTY:
  `--name --email` requests the code, `--code <code>` finishes (`--save` writes
  `~/.npmrc`). Token confined to `@<username>/*`, never admin. The username is PERMANENT:
  no renames; confirm the user chose it deliberately before signing up on their behalf.
- **Lifecycle** (registry-enforced): `publish` (draft) · `release <v>` (seals, immutable)
  · `unpublish <v>` (drafts only) · `deprecate <v> [msg]` · `tombstone <v> [reason]` (410).
  `publish` requires `publishConfig.registry` = GIVO or `--yes`.
- **Docs**: `givo docs push|get <pkg> <file> [--v <version>]` — markdown outside the
  tarball. The registry SERVES prose docs wrapped in the untrusted-content notice (same
  as installed AGENTS.md), so `docs get` output is already marked; JSON round-trips.
- **Tokens**: `givo token ls|mint|rm` (admin scope). Token resolution: `--token` >
  `GIVO_TOKEN` > `~/.npmrc` authToken.
- Env: `GIVO_REGISTRY` overrides the registry URL. Exit code 0 = success; errors print
  `error <status>: <json>` on stderr.
