// Builds the static site for GitHub Pages into _site/ (or outDir): only what the game needs.
// Optional analytics are injected from environment variables at build time, never committed:
//   CF_ANALYTICS_TOKEN  Cloudflare Web Analytics beacon token
//   GOATCOUNTER_CODE    GoatCounter site code (https://<code>.goatcounter.com)
// Run with: npm run build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHIPPED = ['index.html', 'src', 'assets', 'LICENCE.md'];
const SKIP = new Set(['assets/generated']); // MCP output, not part of the game

export function analyticsSnippets(env) {
  const out = [];
  const cf = env.CF_ANALYTICS_TOKEN;
  if (cf) {
    if (!/^[A-Za-z0-9]{16,64}$/.test(cf)) throw new Error('CF_ANALYTICS_TOKEN must be 16-64 letters or digits');
    out.push(`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${cf}"}'></script>`);
  }
  const gc = env.GOATCOUNTER_CODE;
  if (gc) {
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(gc)) throw new Error('GOATCOUNTER_CODE must be lowercase letters, digits and -');
    out.push(`<script data-goatcounter="https://${gc}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`);
  }
  return out;
}

function copy(rel, outDir) {
  if (SKIP.has(rel)) return;
  const src = path.join(ROOT, rel);
  const dst = path.join(outDir, rel);
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (!name.startsWith('.')) copy(path.join(rel, name), outDir);
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}

export function buildSite({ outDir = path.join(ROOT, '_site'), env = process.env } = {}) {
  const snippets = analyticsSnippets(env); // validate before touching the output folder
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const rel of SHIPPED) copy(rel, outDir);
  if (snippets.length) {
    const file = path.join(outDir, 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('</head>')) throw new Error('index.html has no </head>');
    fs.writeFileSync(file, html.replace('</head>', '  ' + snippets.join('\n  ') + '\n</head>'));
  }
  fs.writeFileSync(path.join(outDir, '.nojekyll'), ''); // serve files as-is, no Jekyll processing
  return { outDir, analytics: snippets.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { outDir, analytics } = buildSite();
  console.log(`Built ${path.relative(ROOT, outDir)}/ (${analytics ? analytics + ' analytics snippet(s)' : 'no analytics'})`);
}
