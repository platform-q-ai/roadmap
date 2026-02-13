/**
 * Seed the production database by POSTing data from seed.sql via REST API.
 *
 * Usage:
 *   BASE_URL=https://roadmap-5vvp.onrender.com API_KEY=rmap_xxx npx tsx scripts/seed-via-api.ts
 *
 * Uses bulk endpoints to minimize request count and avoid rate limiting.
 * Parses seed.sql INSERT statements and creates:
 *   1. Layer nodes  (POST /api/layers — one at a time, no bulk endpoint)
 *   2. Component nodes  (POST /api/bulk/components — up to 100 at a time)
 *   3. Edges  (POST /api/bulk/edges — up to 100 at a time)
 *   4. Node versions  (PUT /api/components/:id/versions/:ver — one at a time)
 *
 * Idempotent: uses upsert-friendly endpoints; safe to re-run.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const API_KEY = process.env.API_KEY ?? '';

const ROOT = join(import.meta.dirname ?? '.', '..');
const seedSql = readFileSync(join(ROOT, 'seed.sql'), 'utf-8');

// ─── Helpers ────────────────────────────────────────────────────────

interface NodeRow {
  id: string;
  name: string;
  type: string;
  layer: string | null;
  color: string | null;
  icon: string | null;
  description: string | null;
  tags: string | null;
  sort_order: number;
}

interface EdgeRow {
  source_id: string;
  target_id: string;
  type: string;
  label: string | null;
}

interface VersionRow {
  node_id: string;
  version: string;
  content: string | null;
  progress: number;
  status: string;
}

const apiHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
};
if (API_KEY) {
  apiHeaders['Authorization'] = `Bearer ${API_KEY}`;
}

let requestCount = 0;
let successCount = 0;
let errorCount = 0;

// Rate limit: 20 writes per 60s window.
const WRITE_DELAY_MS = 3200;
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function api(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  // Throttle write requests to stay under rate limit
  if (method !== 'GET') {
    await sleep(WRITE_DELAY_MS);
  }

  requestCount++;
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: apiHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (res.ok) {
    successCount++;
  } else {
    errorCount++;
  }
  return { status: res.status, data };
}

// ─── SQL Parsing ────────────────────────────────────────────────────

function parseSqlValues(valuesStr: string): string[][] {
  const rows: string[][] = [];
  let i = 0;

  while (i < valuesStr.length) {
    const openParen = valuesStr.indexOf('(', i);
    if (openParen === -1) break;

    const values: string[] = [];
    let pos = openParen + 1;

    while (pos < valuesStr.length) {
      while (pos < valuesStr.length && valuesStr[pos] === ' ') pos++;

      if (valuesStr[pos] === ')') {
        pos++;
        break;
      }

      if (valuesStr[pos] === ',') {
        pos++;
        continue;
      }

      if (valuesStr[pos] === "'") {
        pos++;
        let value = '';
        while (pos < valuesStr.length) {
          if (valuesStr[pos] === "'" && valuesStr[pos + 1] === "'") {
            value += "'";
            pos += 2;
          } else if (valuesStr[pos] === "'") {
            pos++;
            break;
          } else {
            value += valuesStr[pos];
            pos++;
          }
        }
        values.push(value);
      } else if (valuesStr.slice(pos, pos + 4).toUpperCase() === 'NULL') {
        values.push('NULL');
        pos += 4;
      } else {
        let value = '';
        while (pos < valuesStr.length && valuesStr[pos] !== ',' && valuesStr[pos] !== ')') {
          value += valuesStr[pos];
          pos++;
        }
        values.push(value.trim());
      }
    }

    rows.push(values);
    i = pos;
  }

  return rows;
}

function extractInserts(table: string, sql: string): string[][] {
  const allRows: string[][] = [];
  const pattern = new RegExp(
    `INSERT\\s+INTO\\s+${table}\\s*\\([^)]+\\)\\s*VALUES\\s*([\\s\\S]*?)\\s*ON\\s+CONFLICT`,
    'gi'
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) {
    const rows = parseSqlValues(match[1]);
    allRows.push(...rows);
  }
  return allRows;
}

// ─── Parse seed.sql ─────────────────────────────────────────────────

function parseNodes(): NodeRow[] {
  const rows = extractInserts('nodes', seedSql);
  return rows.map(r => ({
    id: r[0],
    name: r[1],
    type: r[2],
    layer: r[3] === 'NULL' ? null : r[3],
    color: r[4] === 'NULL' ? null : r[4],
    icon: r[5] === 'NULL' ? null : r[5],
    description: r[6] === 'NULL' ? null : r[6],
    tags: r[7] === 'NULL' ? null : r[7],
    sort_order: parseInt(r[8], 10),
  }));
}

function parseEdges(): EdgeRow[] {
  const rows = extractInserts('edges', seedSql);
  return rows.map(r => ({
    source_id: r[0],
    target_id: r[1],
    type: r[2],
    label: r[3] === 'NULL' ? null : r[3],
  }));
}

function parseVersions(): VersionRow[] {
  const rows = extractInserts('node_versions', seedSql);
  return rows.map(r => ({
    node_id: r[0],
    version: r[1],
    content: r[2] === 'NULL' ? null : r[2],
    progress: parseInt(r[3], 10),
    status: r[4],
  }));
}

// ─── Build API payloads ─────────────────────────────────────────────

function nodeToPayload(n: NodeRow): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: n.id,
    name: n.name,
    type: n.type,
  };
  if (n.layer) body.layer = n.layer;
  if (n.color) body.color = n.color;
  if (n.icon) body.icon = n.icon;
  if (n.description) body.description = n.description;
  if (n.tags) {
    try {
      body.tags = JSON.parse(n.tags);
    } catch {
      /* skip invalid */
    }
  }
  body.sort_order = n.sort_order;
  return body;
}

// ─── Seed functions ─────────────────────────────────────────────────

async function seedLayers(nodes: NodeRow[]): Promise<void> {
  const layers = nodes.filter(n => n.type === 'layer');
  console.warn(`\nSeeding ${layers.length} layers (one at a time — no bulk endpoint)...`);

  for (const layer of layers) {
    const body = nodeToPayload(layer);
    const { status } = await api('POST', '/api/layers', body);
    if (status === 201) {
      console.warn(`  + ${layer.id}`);
    } else if (status === 409) {
      console.warn(`  = ${layer.id} (exists)`);
    } else {
      console.warn(`  ! ${layer.id} (${status})`);
    }
  }
}

async function seedComponents(nodes: NodeRow[]): Promise<void> {
  const components = nodes.filter(n => n.type !== 'layer');
  console.warn(`\nSeeding ${components.length} components via bulk endpoint...`);

  // Bulk endpoint accepts up to 100 at a time
  for (let i = 0; i < components.length; i += 100) {
    const batch = components.slice(i, i + 100);
    const payload = { components: batch.map(nodeToPayload) };
    const { status, data } = await api('POST', '/api/bulk/components', payload);

    const result = data as Record<string, unknown>;
    if (status === 201) {
      console.warn(`  + batch ${i + 1}-${i + batch.length}: all ${batch.length} created`);
    } else if (status === 207) {
      const created = (result.created as number) ?? 0;
      const errors = (result.errors as unknown[]) ?? [];
      console.warn(
        `  ~ batch ${i + 1}-${i + batch.length}: ${created} created, ${errors.length} failed`
      );
      for (const err of errors) {
        const e = err as Record<string, unknown>;
        console.warn(`    ! ${e.id}: ${e.error}`);
      }
    } else {
      console.warn(`  ! batch ${i + 1}-${i + batch.length} (${status}): ${JSON.stringify(data)}`);
    }
  }
}

async function seedEdges(edges: EdgeRow[]): Promise<void> {
  console.warn(`\nSeeding ${edges.length} edges via bulk endpoint...`);

  for (let i = 0; i < edges.length; i += 100) {
    const batch = edges.slice(i, i + 100);
    const payload = {
      edges: batch.map(e => {
        const body: Record<string, unknown> = {
          source_id: e.source_id,
          target_id: e.target_id,
          type: e.type,
        };
        if (e.label) body.label = e.label;
        return body;
      }),
    };
    const { status, data } = await api('POST', '/api/bulk/edges', payload);

    const result = data as Record<string, unknown>;
    if (status === 201) {
      console.warn(`  + batch ${i + 1}-${i + batch.length}: all ${batch.length} created`);
    } else if (status === 207) {
      const created = (result.created as number) ?? 0;
      const errors = (result.errors as unknown[]) ?? [];
      console.warn(
        `  ~ batch ${i + 1}-${i + batch.length}: ${created} created, ${errors.length} failed`
      );
    } else {
      console.warn(`  ! batch ${i + 1}-${i + batch.length} (${status}): ${JSON.stringify(data)}`);
    }
  }
}

async function seedVersions(versions: VersionRow[]): Promise<void> {
  console.warn(`\nSeeding ${versions.length} versions (one at a time — no bulk endpoint)...`);

  for (const ver of versions) {
    const body: Record<string, unknown> = {
      content: ver.content ?? '',
      progress: ver.progress,
      status: ver.status,
    };

    const path = `/api/components/${encodeURIComponent(ver.node_id)}/versions/${encodeURIComponent(ver.version)}`;
    const { status } = await api('PUT', path, body);
    if (status === 200) {
      console.warn(`  + ${ver.node_id} @ ${ver.version}`);
    } else {
      console.warn(`  ! ${ver.node_id} @ ${ver.version} (${status})`);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.warn(`Seeding ${BASE_URL} from seed.sql`);
  console.warn(`Auth: ${API_KEY ? 'yes' : 'none'}`);

  const health = await api('GET', '/api/health');
  if (health.status !== 200) {
    console.error('Health check failed:', health.data);
    process.exit(1);
  }
  console.warn('Health check: OK');

  const nodes = parseNodes();
  const edges = parseEdges();
  const versions = parseVersions();

  console.warn(`Parsed: ${nodes.length} nodes, ${edges.length} edges, ${versions.length} versions`);

  const totalWrites =
    nodes.filter(n => n.type === 'layer').length + // layers: 1 req each
    Math.ceil(nodes.filter(n => n.type !== 'layer').length / 100) + // components: batched
    Math.ceil(edges.length / 100) + // edges: batched
    versions.length; // versions: 1 req each
  const estimatedMinutes = Math.ceil((totalWrites * WRITE_DELAY_MS) / 60000);
  console.warn(
    `Estimated: ${totalWrites} write requests (~${estimatedMinutes} min with rate limiting)\n`
  );

  await seedLayers(nodes);
  await seedComponents(nodes);
  await seedEdges(edges);
  await seedVersions(versions);

  console.warn(`\n${'─'.repeat(50)}`);
  console.warn(`Done. ${requestCount} requests: ${successCount} succeeded, ${errorCount} failed.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
