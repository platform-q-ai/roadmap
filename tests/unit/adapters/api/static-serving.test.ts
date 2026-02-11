import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApp } from '@adapters/api/index.js';
import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '@domain/index.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// ─── Test helpers ────────────────────────────────────────────────────

function buildEmptyRepos() {
  const nodeRepo: INodeRepository = {
    findAll: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    findByType: vi.fn(async () => []),
    findByLayer: vi.fn(async () => []),
    exists: vi.fn(async () => false),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  };
  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn(async () => []),
    findBySource: vi.fn(async () => []),
    findByTarget: vi.fn(async () => []),
    findByType: vi.fn(async () => []),
    findRelationships: vi.fn(async () => []),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  };
  const versionRepo: IVersionRepository = {
    findAll: vi.fn(async () => []),
    findByNode: vi.fn(async () => []),
    findByNodeAndVersion: vi.fn(async () => null),
    save: vi.fn(async () => {}),
    updateProgress: vi.fn(async () => {}),
    deleteByNode: vi.fn(async () => {}),
  };
  const featureRepo: IFeatureRepository = {
    findAll: vi.fn(async () => []),
    findByNode: vi.fn(async () => []),
    findByNodeAndVersion: vi.fn(async () => []),
    save: vi.fn(async () => {}),
    deleteAll: vi.fn(async () => {}),
    deleteByNode: vi.fn(async () => {}),
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

async function request(
  server: http.Server,
  method: string,
  path: string
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const req = http.request({ method, hostname: '127.0.0.1', port, path }, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 500, body: data, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function withServer(
  repos: ReturnType<typeof buildEmptyRepos>,
  staticDir: string,
  fn: (server: http.Server) => Promise<void>
) {
  const app = createApp(repos, { staticDir });
  const server = app.listen(0);
  try {
    await fn(server);
  } finally {
    server.close();
  }
}

// ─── Setup temp web directory ────────────────────────────────────────

const tempDir = join(tmpdir(), `roadmap-static-test-${Date.now()}`);

beforeAll(() => {
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, 'index.html'), '<!DOCTYPE html><html><body>Test</body></html>');
  writeFileSync(join(tempDir, 'data.json'), JSON.stringify({ test: true }));
  mkdirSync(join(tempDir, 'css'), { recursive: true });
  writeFileSync(join(tempDir, 'css', 'style.css'), 'body { color: red; }');
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ─── Tests ──────────────────────────────────────────────────────────

describe('Static File Serving', () => {
  describe('createApp with staticDir option', () => {
    it('accepts a staticDir option alongside deps', () => {
      const repos = buildEmptyRepos();
      const app = createApp(repos, { staticDir: tempDir });
      expect(app).toBeInstanceOf(http.Server);
      app.close();
    });
  });

  describe('serving static files', () => {
    it('serves index.html at root path /', async () => {
      const repos = buildEmptyRepos();
      await withServer(repos, tempDir, async server => {
        const res = await request(server, 'GET', '/');
        expect(res.status).toBe(200);
        expect(res.body).toContain('<!DOCTYPE html>');
        expect(res.headers['content-type']).toContain('text/html');
      });
    });

    it('serves data.json with correct content type', async () => {
      const repos = buildEmptyRepos();
      await withServer(repos, tempDir, async server => {
        const res = await request(server, 'GET', '/data.json');
        expect(res.status).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ test: true });
        expect(res.headers['content-type']).toContain('application/json');
      });
    });

    it('serves nested static files', async () => {
      const repos = buildEmptyRepos();
      await withServer(repos, tempDir, async server => {
        const res = await request(server, 'GET', '/css/style.css');
        expect(res.status).toBe(200);
        expect(res.body).toContain('body { color: red; }');
        expect(res.headers['content-type']).toContain('text/css');
      });
    });
  });

  describe('API routes take priority over static files', () => {
    it('serves /api/health as JSON even when static dir exists', async () => {
      const repos = buildEmptyRepos();
      await withServer(repos, tempDir, async server => {
        const res = await request(server, 'GET', '/api/health');
        expect(res.status).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
      });
    });
  });

  describe('security', () => {
    it('returns 404 for path traversal attempts', async () => {
      const repos = buildEmptyRepos();
      await withServer(repos, tempDir, async server => {
        const res = await request(server, 'GET', '/../package.json');
        expect(res.status).toBe(404);
      });
    });

    it('returns 404 for double-dot traversal in middle of path', async () => {
      const repos = buildEmptyRepos();
      await withServer(repos, tempDir, async server => {
        const res = await request(server, 'GET', '/css/../../../package.json');
        expect(res.status).toBe(404);
      });
    });
  });

  describe('missing files', () => {
    it('returns 404 for nonexistent static files', async () => {
      const repos = buildEmptyRepos();
      await withServer(repos, tempDir, async server => {
        const res = await request(server, 'GET', '/nonexistent.xyz');
        expect(res.status).toBe(404);
      });
    });
  });

  describe('CORS headers on static files', () => {
    it('includes Access-Control-Allow-Origin header on static responses', async () => {
      const repos = buildEmptyRepos();
      await withServer(repos, tempDir, async server => {
        const res = await request(server, 'GET', '/data.json');
        expect(res.headers['access-control-allow-origin']).toBe('*');
      });
    });
  });

  describe('without staticDir', () => {
    it('createApp still works with only deps (backward compatible)', () => {
      const repos = buildEmptyRepos();
      const app = createApp(repos);
      expect(app).toBeInstanceOf(http.Server);
      app.close();
    });
  });
});

describe('Render Configuration Files', () => {
  it('render.yaml exists in project root', () => {
    const renderPath = join(process.cwd(), 'render.yaml');
    expect(existsSync(renderPath)).toBe(true);
  });

  it('render.yaml specifies a web service type', () => {
    const content = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');
    expect(content).toContain('type: web');
  });

  it('render.yaml specifies a build command', () => {
    const content = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');
    expect(content.includes('buildCommand:') || content.includes('build_command:')).toBe(true);
  });

  it('render.yaml specifies a start command', () => {
    const content = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');
    expect(content.includes('startCommand:') || content.includes('start_command:')).toBe(true);
  });

  it('render.yaml specifies Node.js environment', () => {
    const content = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');
    expect(content.includes('node') || content.includes('Node')).toBe(true);
  });

  it('package.json has a start script', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    expect(pkg.scripts?.start).toBeDefined();
  });

  it('start script runs compiled server from dist/', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    const start = pkg.scripts?.start ?? '';
    expect(start).toContain('node');
    expect(start).toContain('dist');
  });
});
