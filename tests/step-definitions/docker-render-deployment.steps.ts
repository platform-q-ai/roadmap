import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Then } from '@cucumber/cucumber';

// ─── Render Blueprint (Docker runtime) ──────────────────────────────

Then('the render.yaml specifies the Docker runtime', function () {
  const content = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');
  assert.ok(
    content.includes('runtime: docker'),
    `render.yaml must specify runtime: docker (got: ${content})`
  );
});

Then('the render.yaml does not specify a Node.js runtime', function () {
  const content = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');
  assert.ok(
    !content.includes('runtime: node'),
    'render.yaml must not specify runtime: node (should be runtime: docker)'
  );
});

// ─── Dockerfile ─────────────────────────────────────────────────────

Then('the Dockerfile has a FROM instruction with a Node.js image', function () {
  const content = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.match(
    content,
    /^FROM\s+node:/m,
    'Dockerfile must have a FROM instruction referencing a node: image'
  );
});

Then('the Dockerfile installs sqlite3 via apt-get', function () {
  const content = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.ok(
    content.includes('apt-get') && content.includes('sqlite3'),
    'Dockerfile must install sqlite3 via apt-get'
  );
});

Then('the Dockerfile copies package manifest files', function () {
  const content = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.ok(
    content.includes('COPY package'),
    'Dockerfile must COPY package manifest files (package.json / package-lock.json)'
  );
});

Then('the Dockerfile runs npm ci', function () {
  const content = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.ok(content.includes('npm ci'), 'Dockerfile must run npm ci for deterministic installs');
});

Then('the Dockerfile copies the application source', function () {
  const content = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.ok(
    content.includes('COPY . .') || content.includes('COPY ./'),
    'Dockerfile must copy application source into the image'
  );
});

Then('the Dockerfile runs the build command', function () {
  const content = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.ok(content.includes('npm run build'), 'Dockerfile must run npm run build');
});

Then('the Dockerfile exposes port 3000', function () {
  const content = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.ok(content.includes('EXPOSE 3000'), 'Dockerfile must expose port 3000');
});

Then('the Dockerfile has a CMD or ENTRYPOINT for npm start', function () {
  const content = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  const hasCmd = content.includes('CMD') && content.includes('npm') && content.includes('start');
  const hasEntrypoint =
    content.includes('ENTRYPOINT') && content.includes('npm') && content.includes('start');
  assert.ok(
    hasCmd || hasEntrypoint,
    'Dockerfile must have a CMD or ENTRYPOINT that runs npm start'
  );
});

// ─── .dockerignore ──────────────────────────────────────────────────

Then('the .dockerignore excludes {string}', function (pattern: string) {
  const dockerignorePath = join(process.cwd(), '.dockerignore');
  assert.ok(existsSync(dockerignorePath), '.dockerignore must exist in project root');
  const content = readFileSync(dockerignorePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim());
  assert.ok(
    lines.includes(pattern),
    `.dockerignore must contain a line excluding "${pattern}" (contents: ${content})`
  );
});
