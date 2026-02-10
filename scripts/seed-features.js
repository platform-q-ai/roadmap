#!/usr/bin/env node
// Seed feature files from components/ directories into the database
// Run: node scripts/seed-features.js

import { execSync } from 'child_process';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB = join(__dirname, '..', 'db', 'architecture.db');
const COMPONENTS = join(__dirname, '..', 'components');

function escape(s) {
  return s.replace(/'/g, "''");
}

function run(sql) {
  execSync(`sqlite3 "${DB}" "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
}

// Clear existing features
run("DELETE FROM features;");

const dirs = readdirSync(COMPONENTS, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

let count = 0;

for (const dir of dirs) {
  const featuresDir = join(COMPONENTS, dir, 'features');
  if (!existsSync(featuresDir)) continue;

  const files = readdirSync(featuresDir).filter(f => f.endsWith('.feature'));

  for (const file of files) {
    const content = readFileSync(join(featuresDir, file), 'utf-8');
    const titleMatch = content.match(/^Feature:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : file.replace('.feature', '');

    // Determine version from filename prefix
    let version = 'mvp';
    if (file.startsWith('v1-')) version = 'v1';
    else if (file.startsWith('v2-')) version = 'v2';

    const sql = `INSERT INTO features (node_id, version, filename, title, content) VALUES ('${escape(dir)}', '${version}', '${escape(file)}', '${escape(title)}', '${escape(content)}');`;

    try {
      run(sql);
      count++;
    } catch (e) {
      // node_id might not match dir name, skip silently
      console.warn(`  Skip: ${dir}/${file} (node_id '${dir}' not in nodes table)`);
    }
  }
}

console.log(`Seeded ${count} feature files into database`);
