import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { createApp } from '../../src/adapters/api/index.js';
import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../../src/domain/index.js';

interface RenderWorld {
  renderServer: http.Server | null;
  renderBaseUrl: string;
  renderResponse: {
    status: number;
    body: unknown;
    headers: http.IncomingHttpHeaders;
  } | null;
  [key: string]: unknown;
}

function buildStubRepos() {
  const nodeRepo: INodeRepository = {
    findAll: async () => [],
    findById: async () => null,
    findByType: async () => [],
    findByLayer: async () => [],
    exists: async () => false,
    save: async () => {},
    delete: async () => {},
  };
  const edgeRepo: IEdgeRepository = {
    findAll: async () => [],
    findBySource: async () => [],
    findByTarget: async () => [],
    findByType: async () => [],
    findRelationships: async () => [],
    save: async () => {},
    delete: async () => {},
  };
  const versionRepo: IVersionRepository = {
    findAll: async () => [],
    findByNode: async () => [],
    findByNodeAndVersion: async () => null,
    save: async () => {},

    deleteByNode: async () => {},
  };
  const featureRepo: IFeatureRepository = {
    findAll: async () => [],
    findByNode: async () => [],
    findByNodeAndVersion: async () => [],
    save: async () => {},
    deleteAll: async () => {},
    deleteByNode: async () => {},
    deleteByNodeAndFilename: async () => false,
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

async function renderHttpGet(
  baseUrl: string,
  path: string
): Promise<{ status: number; body: unknown; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { Connection: 'close' },
        agent: false,
      },
      res => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode ?? 500, body: parsed, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function startRenderServer(world: RenderWorld): Promise<void> {
  const webDir = join(process.cwd(), 'web');
  const repos = buildStubRepos();
  const app = createApp(repos, { staticDir: webDir });
  await new Promise<void>(resolve => {
    const server = app.listen(0, () => {
      const addr = server.address();
      assert.ok(addr, 'Server failed to bind to a port');
      if (typeof addr === 'object') {
        world.renderBaseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
    world.renderServer = server;
  });
}

// ─── Given ────────────────────────────────────────────────────────────

Given('the API server is running with static file serving', async function (this: RenderWorld) {
  await startRenderServer(this);
});

Given(
  'the API server is running with static file serving on a dynamic port',
  async function (this: RenderWorld) {
    await startRenderServer(this);
  }
);

// ─── When ─────────────────────────────────────────────────────────────

When('I request the path {string}', async function (this: RenderWorld, path: string) {
  assert.ok(this.renderBaseUrl, 'Render server not started');
  this.renderResponse = await renderHttpGet(this.renderBaseUrl, path);
});

// ─── Then ─────────────────────────────────────────────────────────────

Then('the render response status is {int}', function (this: RenderWorld, expected: number) {
  assert.ok(this.renderResponse, 'No render response captured');
  assert.equal(
    this.renderResponse.status,
    expected,
    `Expected status ${expected}, got ${this.renderResponse.status}`
  );
});

Then(
  'the render response content type contains {string}',
  function (this: RenderWorld, expected: string) {
    assert.ok(this.renderResponse, 'No render response captured');
    const ct = this.renderResponse.headers['content-type'] ?? '';
    assert.ok(ct.includes(expected), `Expected content-type to contain "${expected}", got "${ct}"`);
  }
);

Then(
  'the render response body has field {string} with value {string}',
  function (this: RenderWorld, field: string, value: string) {
    assert.ok(this.renderResponse, 'No render response captured');
    const body = this.renderResponse.body as Record<string, unknown>;
    assert.ok(field in body, `Field "${field}" not found in response body`);
    assert.equal(String(body[field]), value, `Expected "${field}" = "${value}"`);
  }
);

Then('the render.yaml specifies a web service', function () {
  const content = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');
  assert.ok(content.includes('type: web'), 'render.yaml must specify type: web');
});

Then('the package.json has a {string} script', function (scriptName: string) {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
  assert.ok(
    pkg.scripts && pkg.scripts[scriptName],
    `package.json must have a "${scriptName}" script`
  );
});

Then('the start script runs the compiled server', function () {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
  const start = pkg.scripts?.start ?? '';
  assert.ok(
    start.includes('node') && start.includes('dist'),
    `start script must run compiled server from dist/ (got: "${start}")`
  );
});

Then('the render response includes CORS headers', function (this: RenderWorld) {
  assert.ok(this.renderResponse, 'No render response captured');
  const cors = this.renderResponse.headers['access-control-allow-origin'];
  assert.ok(cors, 'Response must include Access-Control-Allow-Origin header');
  assert.equal(cors, '*', `Expected CORS origin "*", got "${cors}"`);
});

// ─── After (cleanup) ────────────────────────────────────────────────

After(async function (this: RenderWorld) {
  if (this.renderServer) {
    const s = this.renderServer;
    this.renderServer = null;
    await new Promise<void>(resolve => {
      s.close(() => resolve());
      s.closeAllConnections();
    });
  }
});
