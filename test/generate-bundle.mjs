// Generate _md_bundle.js from test fixtures for heartbeat testing
// Usage: node test/generate-bundle.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const fixtures = [
  'test/xss-sample.md',
  'test/summary-demo.md',
  'test/long-document.md',
];

const files = fixtures.map(rel => {
  const fp = path.join(root, rel);
  const content = fs.readFileSync(fp, 'utf-8');
  const stat = fs.statSync(fp);
  const rec = {
    path: rel,
    name: path.basename(rel),
    mtime: stat.mtime.toISOString().slice(0, 16).replace('T', ' '),
    size_bytes: stat.size,
    content,
    summary: null,
  };
  // Load AI summary sidecar if exists
  const sc = fp + '.summary.json';
  if (fs.existsSync(sc)) {
    try {
      const s = JSON.parse(fs.readFileSync(sc, 'utf-8'));
      if (s && (s.tl_dr || s.key_points)) rec.summary = s;
    } catch {}
  }
  return rec;
});

const bundle = {
  _bundle: 'md',
  generated_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
  files,
};

const out = path.join(root, '_md_bundle.js');
fs.writeFileSync(out, 'window.__MD_BUNDLE__ = ' + JSON.stringify(bundle) + ';\n', 'utf-8');
console.log(`[OK] Generated _md_bundle.js with ${files.length} files (${fs.statSync(out).size} bytes)`);
