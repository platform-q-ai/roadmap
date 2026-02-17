/** Well-known SPDX identifiers matched against LICENSE file text. */
export const SPDX_PATTERNS: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: 'MIT', pattern: /\bMIT License\b/i },
  { id: 'Apache-2.0', pattern: /\bApache License.*Version 2\.0\b/i },
  { id: 'BSD-2-Clause', pattern: /\bBSD 2-Clause\b/i },
  { id: 'BSD-3-Clause', pattern: /\bBSD 3-Clause\b/i },
  { id: 'ISC', pattern: /\bISC License\b/i },
  { id: 'GPL-3.0', pattern: /\bGNU GENERAL PUBLIC LICENSE.*Version 3\b/i },
  { id: 'GPL-2.0', pattern: /\bGNU GENERAL PUBLIC LICENSE.*Version 2\b/i },
  { id: 'LGPL-3.0', pattern: /\bGNU LESSER GENERAL PUBLIC LICENSE.*Version 3\b/i },
  { id: 'MPL-2.0', pattern: /\bMozilla Public License.*2\.0\b/i },
  { id: 'AGPL-3.0', pattern: /\bGNU AFFERO GENERAL PUBLIC LICENSE.*Version 3\b/i },
  { id: 'Unlicense', pattern: /\bThis is free and unencumbered software\b/i },
];

/** Detect the SPDX license identifier from the full text of a LICENSE file. */
export function detectSpdxId(content: string): string | null {
  for (const { id, pattern } of SPDX_PATTERNS) {
    if (pattern.test(content)) return id;
  }
  return null;
}
