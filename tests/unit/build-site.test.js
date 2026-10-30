import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildSite, analyticsSnippets } from '../../scripts/build-site.js';
import { ROOT } from '../helpers/mcp-client.js';

const OUT = path.join(ROOT, 'tests', '.tmp-site-' + process.pid);
afterAll(() => fs.rmSync(OUT, { recursive: true, force: true }));
const exists = (rel) => fs.existsSync(path.join(OUT, rel));

describe('buildSite', () => {
  it('ships only what the game needs', () => {
    buildSite({ outDir: OUT, env: {} });
    for (const rel of ['index.html', 'src/main.js', 'src/game.js', 'assets/ghosty.png', 'assets/music-menu.wav', '.nojekyll']) {
      expect(exists(rel)).toBe(true);
    }
    for (const rel of ['tests', 'mcp', 'scripts', 'node_modules', '.kiro', 'package.json', 'assets/generated']) {
      expect(exists(rel)).toBe(false);
    }
    const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
    expect(html).toBe(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
  });

  it('injects analytics before </head> only when configured', () => {
    const { analytics } = buildSite({ outDir: OUT, env: { CF_ANALYTICS_TOKEN: 'a1b2c3d4e5f6a7b8c9d0', GOATCOUNTER_CODE: 'flappy-kiro' } });
    expect(analytics).toBe(2);
    const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
    expect(html).toMatch(/cloudflareinsights[\s\S]*goatcounter[\s\S]*<\/head>/);
    expect(html).toContain('"token": "a1b2c3d4e5f6a7b8c9d0"');
    expect(html).toContain('https://flappy-kiro.goatcounter.com/count');
  });

  it('rejects values that could inject markup, before writing anything', () => {
    expect(() => analyticsSnippets({ CF_ANALYTICS_TOKEN: 'x"></script><script>alert(1)' })).toThrow(/CF_ANALYTICS_TOKEN/);
    expect(() => analyticsSnippets({ GOATCOUNTER_CODE: 'evil.com/x' })).toThrow(/GOATCOUNTER_CODE/);
    expect(analyticsSnippets({})).toEqual([]);
  });
});
