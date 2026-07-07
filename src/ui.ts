/**
 * Terminal identity. Status lines carry a colored "givo" prefix; DATA lines stay raw
 * (token values, docs content, list rows), so output remains pipe- and script-friendly.
 * All color is gated on the target stream being a TTY.
 */

const escape = (code: string, s: string, tty: boolean): string => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const outTty = (): boolean => process.stdout.isTTY === true;
const errTty = (): boolean => process.stderr.isTTY === true;

export const green = (s: string): string => escape("32", s, outTty());
export const bold = (s: string): string => escape("1", s, outTty());
export const dim = (s: string): string => escape("2", s, outTty());

/** Status line (stdout): something happened. */
export function say(msg: string): void {
  console.log(`${escape("32", "givo", outTty())} ${msg}`);
}

/** Attention line (stderr): worth reading, not fatal. */
export function warn(msg: string): void {
  console.error(`${escape("33", "givo", errTty())} ${msg}`);
}

/** Failure line (stderr). */
export function oops(msg: string): void {
  console.error(`${escape("31", "givo", errTty())} ${msg}`);
}
