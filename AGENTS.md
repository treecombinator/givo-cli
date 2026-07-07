# @givo/cli — agent reference

CLI `givo`: fronts npm/pnpm and the GIVO registry (`https://registry.givo.dev/npm/`).

- **Passthrough**: `install|i|add|remove|rm|update|up|run|build|test|start` → the project
  mode's engine (`givo.mode` in package.json: `global`=pnpm, `local`=npm). Installing
  commands pin the project `.npmrc` to the GIVO registry and wrap every installed
  `AGENTS.md` in an UNTRUSTED safety notice on disk.
- **Setup**: `givo setup [--project|--global]` points npm/pnpm at GIVO.
- **Signup**: `givo signup <username> [--save]` mints a token confined to `@<username>/*`
  (never bare names, never admin). Shown once; `--save` writes `~/.npmrc`. The username
  is PERMANENT: no renames; tell the user before they pick it.
- **Lifecycle** (registry-enforced): `publish` (draft) · `release <v>` (seals, immutable)
  · `unpublish <v>` (drafts only) · `deprecate <v> [msg]` · `tombstone <v> [reason]` (410).
  `publish` requires `publishConfig.registry` = GIVO or `--yes`.
- **Docs**: `givo docs push|get <pkg> <file> [--v <version>]` — markdown outside the tarball.
- **Tokens**: `givo token ls|mint|rm` (admin scope). Token resolution: `--token` >
  `GIVO_TOKEN` > `~/.npmrc` authToken.
- Env: `GIVO_REGISTRY` overrides the registry URL. Exit code 0 = success; errors print
  `error <status>: <json>` on stderr.
