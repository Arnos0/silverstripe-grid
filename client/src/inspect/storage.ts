/**
 * localStorage key for the inspect-mode enabled flag.
 *
 * Persisted as the literal strings `'true'` or `'false'` so a plain
 * string-equality check is enough to hydrate and no JSON parsing is
 * needed. Any other value (including absent) resolves to `false`.
 */
export const STORAGE_KEY = 'grid:inspect-mode';

export function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // localStorage access can throw in locked-down browsers (e.g. third-party
    // cookie blocking). Degrade to disabled — inspect mode is a progressive
    // enhancement, never a hard requirement.
    return false;
  }
}

export function writeEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // QuotaExceededError / SecurityError — silently ignore.
  }
}
