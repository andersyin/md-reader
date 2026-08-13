// Cheap Node-only checks: sanitizer correctness, zero-CDN, first-run copy.
// No browser. Run: node test/sanitize.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'md-reader.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const xssSrc = fs.readFileSync(path.join(__dirname, 'xss-sample.md'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

const start = html.indexOf('function esc(s){');
const end = html.indexOf('/* ── 统计与确定性提炼');
if (start < 0 || end < 0) {
  console.error('Could not extract sanitizer from md-reader.html');
  process.exit(1);
}
const { esc, safeUrl, MD, asList } = vm.runInNewContext(
  '"use strict";\n' + html.slice(start, end) + '\n({esc, safeUrl, MD, asList});'
);

console.log('\n[sanitize] URL allowlist');
const blocked = [
  'javascript:alert(1)',
  'JAVASCRIPT:alert(1)',
  'vbscript:msgbox',
  'data:text/html,alert(1)',
  'data:image/svg+xml,<svg>',
  '\tjavascript:alert(1)',
  'java\tscript:alert(1)',
  '\u200bjavascript:alert(1)',
  'java\u200bscript:alert(1)',
  '\u00a0javascript:alert(1)',
  'javascript&colon;alert(1)',
  'javascript&#58;alert(1)',
  'javascript&#x3a;alert(1)',
  'javascript%3Aalert(1)',
  'java%09script:alert(1)',
  '//evil.example/x',
  'https://x.com" onerror="alert(1)',
];
for (const u of blocked) {
  ok('block ' + JSON.stringify(u), safeUrl(u) === false && safeUrl(esc(u)) === false);
}
const allowed = [
  'https://github.com',
  'http://example.com/a',
  'mailto:a@b.com',
  '#anchor',
  './rel.md',
  '/abs/path.md',
  'file:///tmp/notes.md',
];
for (const u of allowed) {
  ok('allow ' + JSON.stringify(u), safeUrl(u) === true);
}

console.log('\n[sanitize] Markdown render');
const xssHtml = MD.parse(xssSrc).html;
ok('xss-sample: no <script> tags', !/<script[\s>]/i.test(xssHtml));
ok('xss-sample: code-block payload is text', xssHtml.includes('code-block-safe') && !/<script[\s>]/i.test(xssHtml));
ok('xss-sample: GitHub link preserved', /href="https:\/\/github\.com"/i.test(xssHtml));

const attrUrls = [...xssHtml.matchAll(/\s(?:href|src)="([^"]*)"/gi)].map(m => m[1]);
const dangerousAttr = attrUrls.filter(u => !safeUrl(u));
ok('xss-sample: every href/src passes safeUrl', dangerousAttr.length === 0, dangerousAttr.join(', '));

const camouflage = [
  '[x](\u200bjavascript:alert(1))',
  '[x](javascript&colon;alert(1))',
  '[x](javascript&#58;alert(1))',
  '[x](javascript%3Aalert(1))',
  '![x](\u200bjavascript:alert(1))',
  '[x](data:text/html,alert(1))',
  '[x](vbscript:msgbox)',
];
for (const src of camouflage) {
  const out = MD.parse(src).html;
  const urls = [...out.matchAll(/\s(?:href|src)="([^"]*)"/gi)].map(m => m[1]);
  ok('no dangerous attr for ' + JSON.stringify(src), urls.every(u => safeUrl(u)) && !/<script[\s>]/i.test(out), urls.join(', '));
}

const legal = MD.parse('[ok](https://github.com)\n\n![img](https://example.com/a.png)').html;
ok('legal https link emitted', /<a href="https:\/\/github\.com"/i.test(legal));
ok('legal https image emitted', /<img src="https:\/\/example\.com\/a\.png"/i.test(legal));
ok('images set referrerpolicy=no-referrer', /referrerpolicy="no-referrer"/.test(legal));

console.log('\n[sanitize] Sidecar coerce + first-run / policy');
ok('asList(null) is []', JSON.stringify(asList(null)) === '[]');
ok('asList("x") is ["x"]', JSON.stringify(asList('x')) === '["x"]');
ok('asList([1,2]) preserved', JSON.stringify(asList([1, 2])) === '[1,2]');
ok('empty state names open-reader.command', html.includes('open-reader.command') && !html.includes('打开阅读器.command'));
ok('CSP meta present', /http-equiv="Content-Security-Policy"/i.test(html) && html.includes("script-src 'nonce-mdreader'"));
ok('referrer policy is no-referrer', /name="referrer"[^>]*content="no-referrer"/i.test(html) || /content="no-referrer"[^>]*name="referrer"/i.test(html));
ok('no Google Fonts / CDN in reader', !/fonts\.googleapis|cdn\.jsdelivr|unpkg\.com|cdnjs/i.test(html));
ok('script tags carry CSP nonce', /<script nonce="mdreader" src="_md_bundle\.js">/.test(html) && /<script nonce="mdreader">/.test(html));
ok('G-to-bottom is not dead code', /e\.key==='g'\)\{/.test(html) && /e\.key==='G'\)\{/.test(html) && !/e\.key==='g'\|\|e\.key==='G'/.test(html));
const kb = Math.round(html.length / 1024);
ok('reader stays under 100KB', html.length < 100 * 1024, `${kb}KB`);

console.log(`\n========== Sanitize: ${pass} passed / ${fail} failed ==========`);
process.exit(fail > 0 ? 1 : 0);
