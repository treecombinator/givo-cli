import { readFileSync, writeFileSync, existsSync, rmSync, globSync } from "node:fs";
import { join } from "node:path";
import { warn } from "./ui.js";

export type Mode = "local" | "global";

/**
 * The GIVO registry — the /npm path is part of the registry URL (ecosystem axis).
 * GIVO_REGISTRY overrides it (staging, local dev, the E2E suite); normalized without
 * the trailing slash so paths compose as `${REGISTRY}/...`.
 */
export const REGISTRY = (process.env["GIVO_REGISTRY"] ?? "https://registry.givo.dev/npm").replace(/\/+$/, "");

const NPMRC = join(process.cwd(), ".npmrc");
const PNPM_WS = join(process.cwd(), "pnpm-workspace.yaml");

export interface PkgJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[];
  publishConfig?: { registry?: string };
  givo?: { mode?: Mode };
  [k: string]: unknown;
}

/**
 * The single package.json reader (every command goes through here).
 * Missing file -> null, silently. Malformed file -> null with a one-line warning
 * (commands keep working on defaults instead of dying with a raw SyntaxError).
 */
export function readPkg(cwd = process.cwd()): PkgJson | null {
  try {
    return JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as PkgJson;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      warn(`could not parse package.json (${(e as Error).message}); using defaults.`);
    }
    return null;
  }
}

/** Project mode. Default: global (shared store). */
export function readMode(): Mode {
  const m = readPkg()?.givo?.mode;
  return m === "local" || m === "global" ? m : "global";
}

/** Persist the mode, preserving the file's indentation style and trailing newline. */
export function writeMode(mode: Mode): void {
  const pkgPath = join(process.cwd(), "package.json");
  const raw = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as PkgJson;
  pkg.givo = { ...(pkg.givo ?? {}), mode };
  const indent = /^([ \t]+)"/m.exec(raw)?.[1] ?? "  ";
  writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + (raw.endsWith("\n") ? "\n" : ""));
}

/**
 * .npmrc: keep OUR keys current (registry -> GIVO, the whole point of the wrapper;
 * link-workspace-packages in global mode) and leave every other line alone. Idempotent:
 * only writes when something changed, so read-only commands never dirty the tree.
 */
export function ensureNpmrc(mode: Mode): void {
  const existing = existsSync(NPMRC) ? readFileSync(NPMRC, "utf8") : "";
  const ours = ["registry=", "link-workspace-packages="];
  const kept = existing.split("\n").filter((l) => !ours.some((p) => l.startsWith(p)));
  while (kept.length && kept[kept.length - 1]?.trim() === "") kept.pop();
  kept.push(`registry=${REGISTRY}/`);
  if (mode === "global") kept.push("link-workspace-packages=true");
  const next = kept.join("\n") + "\n";
  if (next !== existing) writeFileSync(NPMRC, next);
}

function workspaceYaml(ws: string[]): string {
  return "packages:\n" + ws.map((p) => `  - "${p}"`).join("\n") + "\n";
}

/**
 * Monorepo in global mode: pnpm needs pnpm-workspace.yaml (it does not read package.json
 * "workspaces"). We CREATE it when missing and never touch an existing one — users keep
 * pnpm config there (catalog:, overrides, onlyBuiltDependencies...). Switching to local
 * removes the file only if it is byte-for-byte the one we generated (we own it).
 */
export function ensureWorkspace(mode: Mode): void {
  const ws = readPkg()?.workspaces;
  if (!ws || ws.length === 0) return; // not a monorepo root
  const generated = workspaceYaml(ws);
  if (mode === "global") {
    if (!existsSync(PNPM_WS)) writeFileSync(PNPM_WS, generated);
  } else if (existsSync(PNPM_WS) && readFileSync(PNPM_WS, "utf8") === generated) {
    rmSync(PNPM_WS);
  }
}

/**
 * Switching engines = reinstall: remove node_modules (root AND each workspace package —
 * pnpm leaves per-package symlink dirs that would dangle) plus the OTHER engine's lockfile.
 */
export function cleanInstall(mode: Mode): void {
  rmSync(join(process.cwd(), "node_modules"), { recursive: true, force: true });
  const foreignLock = mode === "global" ? "package-lock.json" : "pnpm-lock.yaml";
  rmSync(join(process.cwd(), foreignLock), { force: true });
  for (const pattern of readPkg()?.workspaces ?? []) {
    try {
      for (const dir of globSync(pattern)) {
        rmSync(join(process.cwd(), dir, "node_modules"), { recursive: true, force: true });
      }
    } catch {
      /* glob unavailable or bad pattern — root cleanup already done */
    }
  }
}
