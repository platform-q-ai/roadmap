#!/usr/bin/env node
// Export architecture.db → web/data.json
// Run: node scripts/export.js

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB = join(__dirname, '..', 'db', 'architecture.db');
const OUT = join(__dirname, '..', 'web', 'data.json');

function query(sql) {
  const raw = execSync(`sqlite3 -json "${DB}" "${sql.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return raw.trim() ? JSON.parse(raw) : [];
}

const nodes = query('SELECT * FROM nodes ORDER BY sort_order');
const edges = query('SELECT * FROM edges ORDER BY id');
const versions = query('SELECT * FROM node_versions ORDER BY node_id, version');
const features = query('SELECT * FROM features ORDER BY node_id, version, filename');

// Group versions and features by node
const versionsByNode = {};
for (const v of versions) {
  if (!versionsByNode[v.node_id]) versionsByNode[v.node_id] = {};
  versionsByNode[v.node_id][v.version] = {
    content: v.content,
    progress: v.progress,
    status: v.status,
    updated_at: v.updated_at,
  };
}

const featuresByNode = {};
for (const f of features) {
  const key = `${f.node_id}:${f.version}`;
  if (!featuresByNode[key]) featuresByNode[key] = [];
  featuresByNode[key].push({
    filename: f.filename,
    title: f.title,
    content: f.content,
  });
}

// Build enriched nodes
const enrichedNodes = nodes.map((n) => ({
  ...n,
  versions: versionsByNode[n.id] || {},
  features: {},
  ...(['mvp', 'v1', 'v2'].reduce((acc, v) => {
    const key = `${n.id}:${v}`;
    if (featuresByNode[key]) acc.features[v] = featuresByNode[key];
    return acc;
  }, { features: {} })),
}));

// Build layer groups for rendering
const layers = nodes.filter((n) => n.type === 'layer');
const layerGroups = layers.map((layer) => ({
  ...layer,
  children: enrichedNodes.filter((n) => n.layer === layer.id && n.type !== 'layer'),
  versions: versionsByNode[layer.id] || {},
}));

// Relationship edges (excluding CONTAINS)
const relationships = edges.filter((e) => e.type !== 'CONTAINS');

const data = {
  generated_at: new Date().toISOString(),
  layers: layerGroups,
  nodes: enrichedNodes,
  edges: relationships,
  stats: {
    total_nodes: nodes.length,
    total_edges: edges.length,
    total_versions: versions.length,
    total_features: features.length,
  },
};

writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log(`Exported to ${OUT}`);
console.log(`  ${data.stats.total_nodes} nodes, ${data.stats.total_edges} edges, ${data.stats.total_versions} versions, ${data.stats.total_features} features`);
