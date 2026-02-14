import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const html = readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');

describe('Simplify web UI — remove architecture tab', () => {
  it('should NOT have an Architecture tab button', () => {
    expect(html).not.toMatch(/<button[^>]*>Architecture<\/button>/i);
  });

  it('should NOT have a tab-architecture content div', () => {
    expect(html).not.toContain('id="tab-architecture"');
  });

  it('should NOT have a render() function targeting the architecture element', () => {
    const hasArchRender =
      html.includes("getElementById('architecture')") && /function\s+render\s*\(/.test(html);
    expect(hasArchRender).toBe(false);
  });

  it('should NOT have a switchTab function', () => {
    expect(html).not.toMatch(/function\s+switchTab\s*\(/);
  });

  it('should NOT have a tabs container div', () => {
    expect(html).not.toMatch(/<div[^>]*class="tabs"[^>]*>/);
  });

  it('should NOT have tab-btn CSS class definitions used for tab switching', () => {
    // The tabs container with tab buttons should be gone
    expect(html).not.toMatch(/onclick="switchTab\(/);
  });
});

describe('Simplify web UI — progression content visibility', () => {
  it('should have the progression-container directly visible (no tab activation needed)', () => {
    expect(html).toContain('progression-container');
    expect(html).not.toContain("switchTab('progression')");
  });

  it('should NOT wrap progression content in a tab-content div that is hidden by default', () => {
    // Either no tab-content wrapper, or it is always active
    const hasHiddenTabWrapper = /id="tab-progression"[^>]*class="tab-content"[^"]*"/.test(html);
    if (hasHiddenTabWrapper) {
      // If wrapped, it must always have active class
      expect(html).toMatch(/id="tab-progression"[^>]*class="tab-content active"/);
    }
  });
});

describe('Simplify web UI — remove stats bar', () => {
  it('should NOT have a stats-bar element', () => {
    expect(html).not.toContain('id="stats-bar"');
  });

  it('should NOT have a renderStats function', () => {
    expect(html).not.toMatch(/function\s+renderStats\s*\(/);
  });

  it('should NOT have stats-bar CSS styles', () => {
    expect(html).not.toMatch(/\.stats-bar\s*\{/);
  });
});

describe('Simplify web UI — remove header badges', () => {
  it('should NOT have a tags-row div', () => {
    expect(html).not.toContain('tags-row');
  });

  it('should NOT have a Living Documentation badge', () => {
    expect(html).not.toMatch(/<div[^>]*class="badge"[^>]*>Living Documentation<\/div>/i);
  });

  it('should NOT have .badge CSS class for the header badge', () => {
    // The badge class used for "Living Documentation" badge should be gone
    // Note: progress-badge is a different class and should remain
    expect(html).not.toMatch(/\.badge\s*\{/);
  });
});

describe('Simplify web UI — update header version', () => {
  it('should display v0.3 in the header', () => {
    expect(html).toContain('v0.3');
  });

  it('should NOT display v3.2 in the header', () => {
    expect(html).not.toContain('v3.2');
  });
});
