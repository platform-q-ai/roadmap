/**
 * Shared helper for reading the web view HTML in step definitions and tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

export function readWebView(): string {
  return readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');
}

export interface HtmlWorld {
  html: string;
  [key: string]: unknown;
}

export function getHtml(world: HtmlWorld): string {
  return world.html || readWebView();
}
