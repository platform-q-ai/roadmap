import { strict as assert } from 'node:assert';
import http from 'node:http';

import { Then, When } from '@cucumber/cucumber';

/* ── World shape ──────────────────────────────────────────────────── */

interface ValidationWorld {
  server: http.Server | null;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

async function httpPut(
  baseUrl: string,
  path: string,
  body: string
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        method: 'PUT',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(body),
          Connection: 'close',
        },
        agent: false,
      },
      res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          const hdrs: Record<string, string> = {};
          for (const [key, val] of Object.entries(res.headers)) {
            if (typeof val === 'string') {
              hdrs[key] = val;
            }
          }
          resolve({ status: res.statusCode ?? 500, body: parsed, headers: hdrs });
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* ── When ─────────────────────────────────────────────────────────── */

When(
  'I send a PUT request to {string} with empty body',
  async function (this: ValidationWorld, path: string) {
    assert.ok(this.baseUrl, 'Server not started');
    this.response = await httpPut(this.baseUrl, path, '');
  }
);

When(
  'I send a PUT request to {string} with Gherkin containing a syntax error at line {int}',
  async function (this: ValidationWorld, path: string, errorLine: number) {
    assert.ok(this.baseUrl, 'Server not started');
    // Build Gherkin with a valid header but a syntax error at the specified line.
    // Lines 1-4 are valid, line 5 (errorLine) has an invalid keyword.
    const lines: string[] = [];
    for (let i = 1; i <= Math.max(errorLine + 1, 6); i++) {
      if (i === 1) {
        lines.push('Feature: Broken Gherkin');
      } else if (i === 2) {
        lines.push('  Scenario: Has an error');
      } else if (i === errorLine) {
        lines.push('    !!!INVALID GHERKIN SYNTAX!!!');
      } else {
        lines.push(`    Given step at line ${i}`);
      }
    }
    const body = lines.join('\n');
    this.response = await httpPut(this.baseUrl, path, body);
  }
);

/* ── Then ─────────────────────────────────────────────────────────── */

Then(
  'the response body has field {string} containing line number information',
  function (this: ValidationWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(field in body, `Field "${field}" not found in response body`);
    const value = String(body[field]);
    // Check that the error message references a line number (e.g. "line 5", "Line 5", "line:5")
    const lineNumberPattern = /line\s*[:\s]?\s*\d+/i;
    assert.ok(
      lineNumberPattern.test(value),
      `Expected field "${field}" to contain line number information, got: "${value}"`
    );
  }
);
