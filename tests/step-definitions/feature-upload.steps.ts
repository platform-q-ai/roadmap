import { strict as assert } from 'node:assert';
import http from 'node:http';

import { Given, Then, When } from '@cucumber/cucumber';

import { Feature, Node } from '../../src/domain/index.js';

/* ── World shape ──────────────────────────────────────────────────── */

interface UploadWorld {
  nodes: Node[];
  features: Feature[];
  server: http.Server | null;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  preservedCounts: Map<string, number> | null;
  [key: string]: unknown;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function ensureComponent(world: UploadWorld, id: string): void {
  if (!world.nodes.some(n => n.id === id)) {
    world.nodes.push(new Node({ id, name: id, type: 'component', layer: 'supervisor-layer' }));
  }
}

function buildGherkin(steps: number): string {
  const lines = ['Feature: Auto-generated', '  Scenario: S1'];
  const keywords = ['Given', 'When', 'Then'];
  for (let i = 0; i < steps; i++) {
    lines.push(`    ${keywords[i % 3]} step ${i + 1}`);
  }
  return lines.join('\n');
}

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

/* ── Given ────────────────────────────────────────────────────────── */

Given(
  'component {string} has feature {string} under version {string} with title {string}',
  function (this: UploadWorld, nodeId: string, filename: string, version: string, title: string) {
    ensureComponent(this, nodeId);
    this.features.push(
      new Feature({
        node_id: nodeId,
        version,
        filename,
        title,
        content: `Feature: ${title}\n  Scenario: S\n    Given a step`,
        step_count: 1,
      })
    );
  }
);

Given(
  'component {string} has features under versions {string} and {string}',
  function (this: UploadWorld, nodeId: string, ver1: string, ver2: string) {
    ensureComponent(this, nodeId);
    this.features.push(
      new Feature({
        node_id: nodeId,
        version: ver1,
        filename: `${ver1}-existing.feature`,
        title: `${ver1} Existing`,
        content: `Feature: ${ver1} Existing\n  Scenario: S\n    Given a step`,
        step_count: 1,
      })
    );
    this.features.push(
      new Feature({
        node_id: nodeId,
        version: ver2,
        filename: `${ver2}-existing.feature`,
        title: `${ver2} Existing`,
        content: `Feature: ${ver2} Existing\n  Scenario: S\n    Given a step`,
        step_count: 1,
      })
    );
    // Snapshot counts for later verification
    this.preservedCounts = new Map([
      [ver1, this.features.filter(f => f.node_id === nodeId && f.version === ver1).length],
      [ver2, this.features.filter(f => f.node_id === nodeId && f.version === ver2).length],
    ]);
  }
);

/* ── When ─────────────────────────────────────────────────────────── */

When(
  'I send a PUT request to {string} with Gherkin content',
  async function (this: UploadWorld, path: string) {
    assert.ok(this.baseUrl, 'Server not started');
    const body = 'Feature: Minimal\n  Scenario: S\n    Given a step';
    this.response = await httpPut(this.baseUrl, path, body);
  }
);

When(
  'I upload {string} to {string} under version {string} with {int} steps',
  async function (
    this: UploadWorld,
    filename: string,
    nodeId: string,
    version: string,
    steps: number
  ) {
    assert.ok(this.baseUrl, 'Server not started');
    ensureComponent(this, nodeId);
    const body = buildGherkin(steps);
    const path = `/api/components/${nodeId}/versions/${version}/features/${filename}`;
    this.response = await httpPut(this.baseUrl, path, body);
    assert.equal(
      this.response.status,
      200,
      `Upload failed with ${this.response.status}: ${JSON.stringify(this.response.body)}`
    );
  }
);

When(
  'I upload a new feature under version {string}',
  async function (this: UploadWorld, version: string) {
    assert.ok(this.baseUrl, 'Server not started');
    const nodeId = 'preserve-comp';
    ensureComponent(this, nodeId);
    const body = `Feature: New ${version}\n  Scenario: New\n    Given a new step`;
    const path = `/api/components/${nodeId}/versions/${version}/features/${version}-new.feature`;
    this.response = await httpPut(this.baseUrl, path, body);
    assert.equal(this.response.status, 200, `Upload failed: ${JSON.stringify(this.response.body)}`);
  }
);

/* ── Then ─────────────────────────────────────────────────────────── */

Then(
  'the feature is stored under version {string} regardless of the {string} filename prefix',
  function (this: UploadWorld, expectedVersion: string, _prefix: string) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Record<string, unknown>;
    assert.equal(body.version, expectedVersion);
    // Also verify in the in-memory store
    const stored = this.features.find(
      f =>
        f.filename === String(body.filename) &&
        f.node_id === String(body.node_id) &&
        f.version === expectedVersion
    );
    assert.ok(stored, `Feature not found in store with version ${expectedVersion}`);
  }
);

Then(
  'only one feature with filename {string} exists for {string} version {string}',
  function (this: UploadWorld, filename: string, nodeId: string, version: string) {
    const matching = this.features.filter(
      f => f.node_id === nodeId && f.version === version && f.filename === filename
    );
    assert.equal(matching.length, 1, `Expected 1 feature, found ${matching.length}`);
  }
);

Then(
  '{int} feature records exist for {string} with filename {string}',
  function (this: UploadWorld, expected: number, nodeId: string, filename: string) {
    const matching = this.features.filter(f => f.node_id === nodeId && f.filename === filename);
    assert.equal(matching.length, expected, `Expected ${expected}, found ${matching.length}`);
  }
);

Then(
  'the {string} version has step_count {int}',
  function (this: UploadWorld, version: string, expected: number) {
    const matching = this.features.filter(f => f.version === version);
    assert.ok(matching.length > 0, `No features found for version ${version}`);
    const feat = matching[matching.length - 1];
    assert.equal(
      feat.step_count,
      expected,
      `Expected step_count ${expected}, got ${feat.step_count}`
    );
  }
);

Then(
  'the {string} and {string} features are unchanged',
  function (this: UploadWorld, ver1: string, ver2: string) {
    assert.ok(this.preservedCounts, 'No preserved counts recorded');
    const nodeId = 'preserve-comp';
    for (const ver of [ver1, ver2]) {
      const current = this.features.filter(f => f.node_id === nodeId && f.version === ver).length;
      const original = this.preservedCounts.get(ver) ?? 0;
      assert.equal(current, original, `${ver} features changed: was ${original}, now ${current}`);
    }
  }
);

Then(
  '{string} now has features across {int} versions',
  function (this: UploadWorld, nodeId: string, expectedVersions: number) {
    const versions = new Set(this.features.filter(f => f.node_id === nodeId).map(f => f.version));
    assert.equal(
      versions.size,
      expectedVersions,
      `Expected ${expectedVersions} versions, got ${versions.size}: ${[...versions].join(', ')}`
    );
  }
);
