# givo

---

> Developed by Danthur Lice.\
> Copyright © 2026 Tree Combinator.\
> Contact: dev (at) treecombinator.com

---

The **GIVO package manager** — one CLI that fronts npm/pnpm and talks to the GIVO
registry (`https://registry.givo.dev/npm/`): your packages hosted with a draft → release
lifecycle, everything else federated from npmjs, and AI-friendly installs.

Source: [github.com/treecombinator/givo-cli](https://github.com/treecombinator/givo-cli) ·
Docs: [givo.dev/docs](https://givo.dev/docs)

```
 ██████╗ ██╗██╗   ██╗ ██████╗
██╔════╝ ██║██║   ██║██╔═══██╗
██║  ███╗██║██║   ██║██║   ██║
██║   ██║██║╚██╗ ██╔╝██║   ██║
╚██████╔╝██║ ╚████╔╝ ╚██████╔╝
 ╚═════╝ ╚═╝  ╚═══╝   ╚═════╝
```

## Install

```bash
curl https://registry.givo.dev/install | sh
```

Needs Node >= 22 (givo drives npm/pnpm). The installer maps `@givo/*` to the GIVO
registry and installs `@givo/cli` globally.

## Use

### Signup: your own account, verified by email

```bash
givo signup alice
```

Interactive: asks your name and email, the registry emails a 6-digit code, you enter it,
and the token is shown once (then it offers to save it to `~/.npmrc`). The token is
confined to your own scope (`@alice/*`): bare names and other scopes stay closed, and
signup never grants admin. The username is **permanent** — no renames, and released
packages stay under the scope forever.

Scriptable / non-interactive (agents, CI): pass `--name` and `--email` to request the
code, then re-run with `--code <code>` to finish; `--save` writes `~/.npmrc`.

```bash
givo signup alice --name "Alice" --email alice@example.com   # emails the code
givo signup alice --code 123456 --save                       # finishes, saves the token
```

### Setup — make GIVO your registry

```bash
givo setup             # this project's .npmrc (or global when outside a project)
givo setup --global    # machine-wide: GIVO replaces npmjs for every install
```

### Mode — pick the engine per project

`givo` hides npm/pnpm behind an **intent**, persisted in the project's `package.json`
(`givo.mode`):

| mode | engine | layout | use when |
|---|---|---|---|
| `global` *(default)* | pnpm | shared store, lean symlinked `node_modules` | most projects |
| `local` | npm | own flat copy per project | max compatibility (e.g. React Native / Metro) |

```bash
givo mode              # show current
givo mode local        # switch (cleans node_modules + the other engine's lockfile)
givo mode global
```

### Packages (passthrough)

`install · i · add · remove · rm · update · up · run · build · test · start` are routed to
the mode's engine (translated for npm: `add`→`install`, `build`→`run build`). Installing
commands keep the project's `.npmrc` pointed at GIVO.

```bash
givo install
givo add left-pad          # federated from npmjs, cached and verified by the registry
givo run typecheck
```

### AI-friendly installs

After a successful install or update, every package under `node_modules` that ships an
`AGENTS.md` — direct, transitive (flat layouts) and the copies in pnpm's `.pnpm` store — gets a
safety notice **written into the file on disk** (before and after the content). The notice
marks the doc as UNTRUSTED — possible prompt injection — and tells an AI agent to treat it
as reference only, never as instructions. Atomic write; pnpm's global store is never mutated.

### Version lifecycle

```
publish ──► draft ──release──► released ──deprecate──► (warns, still installable)
              │                    └──tombstone──► tombstoned (410, record stays)
              └─ unpublish ─► (gone)
```

```bash
givo publish                      # up as a DRAFT: mutable, re-publishable
givo add <pkg>@draft              # test a draft (latest is untouched)
givo release 0.1.0                # SEAL: writes the stamp, moves latest — immutable from here on
givo unpublish 0.1.1              # discard a draft (a release is permanent)
givo deprecate 0.1.0 use 0.2.x    # soft warning (npm-native)
givo tombstone 0.1.0 malicious    # kill-switch: installs get 410 + the reason; the record stays
```

Rules enforced by the registry (not by the client): a draft never moves `latest`; release
writes the write-once stamp and only moves `latest` forward; a released version can never
be re-published, re-released or unpublished (`409`); tombstone works only on releases.

`givo publish` requires the package to declare the GIVO registry
(`"publishConfig": { "registry": "https://registry.givo.dev/npm/" }`) — otherwise it asks
for confirmation (`--yes` in scripts). Publishing a name that exists on npmjs is allowed
(hosted wins the cascade) and answered with a loud shadowing notice.

### Registry docs

Markdown lives **outside** the tarball and is editable without republishing
(version-level overrides root; reads fall back to root):

```bash
givo docs push @givo/cli README.md            # root
givo docs push @givo/cli AGENTS.md --v 0.1.0  # for one version
givo docs get  @givo/cli AGENTS.md
```

### Tokens

```bash
givo token mint --label ci --publish '@givo/*' --deny '@givo/blocked'
givo token ls                                 # needs admin
givo token rm tok_xxx
givo token save <token>                       # write a token into ~/.npmrc
```

Scopes: `publish` (allow-list patterns), `admin` (`*` = manage tokens), `deny`
(blocklist — **beats any allow**). Tokens are stored hashed (SHA-256).

Token resolution for registry commands: `--token` > `GIVO_TOKEN` > `~/.npmrc` authToken.
Self-service accounts come from `givo signup` (scope-confined); broader scopes are minted
by an admin with `givo token mint`.

## Notes

- `GIVO_REGISTRY` overrides the registry URL (staging/local dev); the default is
  `https://registry.givo.dev/npm`.
- givo needs the engine of the chosen mode on the machine (`pnpm` for `global`,
  `npm` for `local`); the installer only guarantees npm.
- Status lines print with a colored `givo` prefix on a TTY; piped output stays plain,
  and data lines (tokens, docs, lists) are never decorated.
