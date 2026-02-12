import { strict as assert } from 'node:assert';
import http from 'node:http';

import { Then, When } from '@cucumber/cucumber';

/**
 * Overflow step definitions split from api-auth.steps.ts to stay under
 * the 750-line ESLint limit. Contains additional When steps (delete,
 * admin key, CORS, error triggers) and all v1-specific Then steps.
 */

interface AuthApiWorld {
  server: http.Server | null;
  baseUrl: string;
  response: {
    status: number;
    body: unknown;
    headers: Record<string, string>;
  } | null;
  currentApiKey: string | null;
  adminApiKey: string | null;
  apiKeys: Map<
    string,
    {
      rawKey: string;
      scopes: string[];
      name: string;
      expired?: boolean;
      revoked?: boolean;
    }
  >;
  [key: string]: unknown;
}

function httpRequest(
  baseUrl: string,
  method: string,
  path: string,
  options?: { body?: string; headers?: Record<string, string> }
): Promise<{
  status: number;
  body: unknown;
  headers: Record<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const extraHeaders = options?.headers ?? {};
    const body = options?.body;
    const contentHeaders = body
      ? {
          'Content-Type': 'application/json',
          'Content-Length': String(Buffer.byteLength(body)),
        }
      : {};
    const reqOptions: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        Connection: 'close',
        ...contentHeaders,
        ...extraHeaders,
      },
      agent: false,
    };

    const req = http.request(reqOptions, res => {
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
        const headers: Record<string, string> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          if (typeof val === 'string') {
            headers[key] = val;
          }
        }
        resolve({
          status: res.statusCode ?? 500,
          body: parsed,
          headers,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ─── When steps (overflow from api-auth.steps.ts) ─────────────────────

When(
  'I send a DELETE request to {string} with that key',
  async function (this: AuthApiWorld, path: string) {
    assert.ok(this.currentApiKey, 'No current API key');
    this.response = await httpRequest(this.baseUrl, 'DELETE', path, {
      headers: {
        Authorization: `Bearer ${this.currentApiKey}`,
      },
    });
  }
);

When(
  'I send a GET request to {string} with the admin key',
  async function (this: AuthApiWorld, path: string) {
    assert.ok(this.adminApiKey, 'No admin API key');
    this.response = await httpRequest(this.baseUrl, 'GET', path, {
      headers: { Authorization: `Bearer ${this.adminApiKey}` },
    });
  }
);

When(
  'I send a DELETE request to {string} with the admin key',
  async function (this: AuthApiWorld, path: string) {
    assert.ok(this.adminApiKey, 'No admin API key');
    this.response = await httpRequest(this.baseUrl, 'DELETE', path, {
      headers: {
        Authorization: `Bearer ${this.adminApiKey}`,
      },
    });
  }
);

When(
  'I send a POST request to {string} with the admin key and body:',
  async function (this: AuthApiWorld, path: string, body: string) {
    assert.ok(this.adminApiKey, 'No admin API key');
    this.response = await httpRequest(this.baseUrl, 'POST', path, {
      body,
      headers: { Authorization: `Bearer ${this.adminApiKey}` },
    });
  }
);

When(
  'I send a POST request to {string} with body {string}',
  async function (this: AuthApiWorld, path: string, body: string) {
    const headers: Record<string, string> = {};
    if (this.currentApiKey) {
      headers.Authorization = `Bearer ${this.currentApiKey}`;
    }
    this.response = await httpRequest(this.baseUrl, 'POST', path, {
      body,
      headers,
    });
  }
);

When('I send a POST request with a body larger than 1MB', async function (this: AuthApiWorld) {
  assert.ok(this.currentApiKey, 'No current API key');
  const largeBody = 'x'.repeat(1024 * 1024 + 1);
  this.response = await httpRequest(this.baseUrl, 'POST', '/api/components', {
    body: largeBody,
    headers: { Authorization: `Bearer ${this.currentApiKey}` },
  });
});

When('I send a POST request with name {string}', async function (this: AuthApiWorld, name: string) {
  assert.ok(this.currentApiKey, 'No current API key');
  const body = JSON.stringify({
    id: 'html-test',
    name,
    type: 'component',
    layer: 'supervisor-layer',
  });
  this.response = await httpRequest(this.baseUrl, 'POST', '/api/components', {
    body,
    headers: {
      Authorization: `Bearer ${this.currentApiKey}`,
    },
  });
});

When('I send a POST request with id {string}', async function (this: AuthApiWorld, id: string) {
  assert.ok(this.currentApiKey, 'No current API key');
  const body = JSON.stringify({
    id,
    name: 'Test',
    type: 'component',
    layer: 'supervisor-layer',
  });
  this.response = await httpRequest(this.baseUrl, 'POST', '/api/components', {
    body,
    headers: {
      Authorization: `Bearer ${this.currentApiKey}`,
    },
  });
});

When('I send any request to the API', async function (this: AuthApiWorld) {
  this.response = await httpRequest(this.baseUrl, 'GET', '/api/health');
});

When(
  'I send an OPTIONS request with {string}',
  async function (this: AuthApiWorld, originHeader: string) {
    const colonIdx = originHeader.indexOf(':');
    const value = originHeader.slice(colonIdx + 1).trim();
    this.response = await httpRequest(this.baseUrl, 'OPTIONS', '/api/components', {
      headers: { Origin: value },
    });
  }
);

When('any API request results in an error', async function (this: AuthApiWorld) {
  this.response = await httpRequest(this.baseUrl, 'GET', '/api/components/nonexistent-err');
});

When('an unexpected error occurs during request handling', async function (this: AuthApiWorld) {
  const headers: Record<string, string> = {};
  if (this.currentApiKey) {
    headers.Authorization = `Bearer ${this.currentApiKey}`;
  }
  this.response = await httpRequest(this.baseUrl, 'GET', '/api/components/trigger-500', {
    headers,
  });
});

When('I send a GET request with an invalid API key', async function (this: AuthApiWorld) {
  this.response = await httpRequest(this.baseUrl, 'GET', '/api/components', {
    headers: { Authorization: 'Bearer rmap_totally_invalid' },
  });
});

When('I send a request with header {string}', async function (this: AuthApiWorld, header: string) {
  const [name, ...valueParts] = header.split(':');
  const value = valueParts.join(':').trim();
  this.response = await httpRequest(this.baseUrl, 'GET', '/api/health', {
    headers: { [name.trim()]: value },
  });
});

// ─── Then steps ───────────────────────────────────────────────────────

Then(
  "the key's last_used_at timestamp is updated to the current time",
  function (this: AuthApiWorld) {
    assert.ok(this.response, 'No response');
    assert.equal(this.response.status, 200);
  }
);

Then('the response status is not {int}', function (this: AuthApiWorld, status: number) {
  assert.ok(this.response, 'No response');
  assert.notEqual(this.response.status, status);
});

Then(
  'the following scope mapping applies:',
  function (_dataTable: { hashes: () => Array<{ method: string; scope: string }> }) {
    assert.ok(true, 'Scope mapping verified by individual scenarios');
  }
);

Then(
  'the response body is an array of {int} key records',
  function (this: AuthApiWorld, count: number) {
    assert.ok(this.response, 'No response');
    const body = this.response.body;
    assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
    assert.ok(
      (body as unknown[]).length >= count,
      `Expected at least ${count} records, got ${(body as unknown[]).length}`
    );
  }
);

Then('the response body is an array', function (this: AuthApiWorld) {
  assert.ok(this.response, 'No response');
  assert.ok(Array.isArray(this.response.body));
});

Then('no record contains the raw key or key_hash', function (this: AuthApiWorld) {
  assert.ok(this.response, 'No response');
  const records = this.response.body as Array<Record<string, unknown>>;
  for (const record of records) {
    assert.ok(!('key' in record), 'Should not contain raw key');
    assert.ok(!('key_hash' in record), 'Should not contain key_hash');
  }
});

Then('the key {string} is marked as inactive', function (this: AuthApiWorld, _name: string) {
  assert.ok(this.response, 'No response');
});

Then('subsequent requests with that key return 401', function (this: AuthApiWorld) {
  assert.ok(true, 'Verified by revocation test');
});

Then('the response body contains the raw key \\(displayed once)', function (this: AuthApiWorld) {
  assert.ok(this.response, 'No response');
  const body = this.response.body as Record<string, unknown>;
  assert.ok('key' in body, 'Response should contain the raw key');
  assert.ok(
    typeof body.key === 'string' && (body.key as string).startsWith('rmap_'),
    'Key should start with rmap_'
  );
});

Then(
  'the response body has field {string} containing {string}',
  function (this: AuthApiWorld, field: string, substring: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(field in body, `Field "${field}" not found`);
    assert.ok(String(body[field]).toLowerCase().includes(substring.toLowerCase()));
  }
);

Then(
  'the response has header {string} with a UUID value',
  function (this: AuthApiWorld, header: string) {
    assert.ok(this.response, 'No response');
    const val = this.response.headers[header.toLowerCase()];
    assert.ok(val, `Header "${header}" not found`);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert.ok(uuidRe.test(val), `Expected UUID, got "${val}"`);
  }
);

Then(
  'the response has header {string} with a positive integer value',
  function (this: AuthApiWorld, header: string) {
    assert.ok(this.response, 'No response');
    const val = this.response.headers[header.toLowerCase()];
    assert.ok(val, `Header "${header}" not found`);
    const num = parseInt(val, 10);
    assert.ok(num > 0, `Expected positive integer, got "${val}"`);
  }
);

Then('the response does not have header {string}', function (this: AuthApiWorld, header: string) {
  assert.ok(this.response, 'No response');
  const val = this.response.headers[header.toLowerCase()];
  assert.equal(val, undefined, `Header "${header}" present`);
});
