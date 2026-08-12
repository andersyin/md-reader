// md-reader V1.6 heartbeat test: edit mode + zero-external-network + V1.5 regression
// Usage: node test/heartbeat_v16.mjs [PHASE=C|D|E] (default: all)
// Prerequisites: npm install && node test/generate-bundle.mjs
import pkg from 'playwright-core';
const { chromium } = pkg;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const HTML = 'file://' + path.join(root, 'md-reader.html');
const XSS_FILE = path.join(__dirname, 'xss-sample.md');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};
const WANTED = process.env.PHASE || 'CDE';

const browser = await chromium.launch({ channel: 'chrome', headless: true });

/* ============ Phase C: V1.6 Edit Mode ============ */
if (WANTED.includes('C')) {
console.log('\n[Phase C] V1.6 Lightweight Source Editor');
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
let alerts = [];
page.on('dialog', d => { alerts.push(d.message()); d.dismiss(); });
page.on('request', r => { if (!r.url().startsWith('file://')) console.log('    [network] ' + r.url()); });
const outbound = [];
page.on('request', r => { if (!r.url().startsWith('file://')) outbound.push(r.url()); });
await page.goto(HTML);
await page.waitForTimeout(1500);

// 1. Initial state: toolbar has edit button, edit bar hidden
const init = await page.evaluate(() => ({
  btn: document.querySelector('#btn-edit')?.textContent.trim(),
  barShown: document.querySelector('#editbar')?.classList.contains('show'),
  wrapShown: document.querySelector('#editor-wrap')?.classList.contains('show'),
}));
ok('Initial: edit button present, edit bar hidden', init.btn.includes('编辑') && !init.barShown && !init.wrapShown, `btn=${init.btn}`);

// 2. Enter edit mode: textarea loads current document source
const enter = await page.evaluate(async () => {
  document.querySelector('#btn-edit').click();
  await new Promise(r => setTimeout(r, 200));
  const ta = document.querySelector('#editor');
  return {
    shown: document.querySelector('#editbar').classList.contains('show') && document.querySelector('#editor-wrap').classList.contains('show'),
    bodyEditing: document.body.classList.contains('editing'),
    btnText: document.querySelector('#btn-edit').textContent.trim(),
    taLen: ta ? ta.value.length : -1,
    dirty: document.querySelector('#edit-dirty').textContent.trim(),
    focused: document.activeElement === ta,
  };
});
ok('Enter edit: bar/wrapper shown, button changes to done', enter.shown && enter.bodyEditing && enter.btnText.includes('完成'), enter.btnText);
ok('Editor loads current document source (non-empty)', enter.taLen > 100, `${enter.taLen} chars`);
ok('Dirty flag initial synced + focus on editor', enter.dirty.includes('已同步') && enter.focused);

// 3. Modify content -> dirty flag appears
await page.evaluate(() => {
  const ta = document.querySelector('#editor');
  ta.value = ta.value + '\n\n## Edit new heading (V1.6 test)\n\n- Edit test item A\n- Edit test item B';
  ta.dispatchEvent(new Event('input'));
});
const dirtyAfter = await page.evaluate(() => ({
  text: document.querySelector('#edit-dirty').textContent.trim(),
  cls: document.querySelector('#edit-dirty').classList.contains('dirty'),
}));
ok('After modify: dirty flag shows unsaved changes', dirtyAfter.text.includes('未应用改动') && dirtyAfter.cls, dirtyAfter.text);

// 4. Tab indent: insert 2 spaces at line start
const tabOk = await page.evaluate(() => {
  const ta = document.querySelector('#editor');
  ta.setSelectionRange(0, 0);
  ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  return { v: ta.value.slice(0, 3), sel: ta.selectionStart };
});
ok('Tab indent: inserts 2 spaces and advances cursor', tabOk.v.startsWith('  ') && tabOk.sel === 2, JSON.stringify(tabOk));

// 5. Apply and preview: content re-renders + TOC refreshes
const applyRes = await page.evaluate(async () => {
  document.querySelector('#btn-edit-apply').click();
  await new Promise(r => setTimeout(r, 500));
  const content = document.querySelector('#content, article, .markdown-body, main');
  const toc = [...document.querySelectorAll('#toc a, .toc a, aside a')].map(a => a.textContent.trim());
  return {
    editing: document.body.classList.contains('editing'),
    barShown: document.querySelector('#editbar').classList.contains('show'),
    hasNew: content ? content.innerText.includes('Edit test item A') : false,
    tocHasNew: toc.some(t => t.includes('Edit new heading')),
  };
});
ok('After apply: exits edit mode, edit bar collapses', !applyRes.editing && !applyRes.barShown);
ok('After apply: content re-renders with new content', applyRes.hasNew);
ok('After apply: TOC refreshes with new heading', applyRes.tocHasNew);

// 6. Undo: reverts to original source at edit entry
const undoRes = await page.evaluate(async () => {
  document.querySelector('#btn-edit').click();
  await new Promise(r => setTimeout(r, 200));
  const baseline = document.querySelector('#editor').value;
  const ta = document.querySelector('#editor');
  ta.value = ta.value + '\n- Undo test content';
  ta.dispatchEvent(new Event('input'));
  const dirtyBefore = document.querySelector('#edit-dirty').textContent.includes('未应用改动');
  document.querySelector('#btn-edit-undo').click();
  const dirtyAfterU = document.querySelector('#edit-dirty').textContent.includes('已同步');
  document.querySelector('#btn-edit-apply').click();
  await new Promise(r => setTimeout(r, 400));
  const content = document.querySelector('#content, article, .markdown-body, main');
  return {
    dirtyBefore, dirtyAfterU,
    noUndoText: content ? !content.innerText.includes('Undo test content') : false,
    hasNewTitle: content ? content.innerText.includes('Edit new heading') : false,
  };
});
ok('Undo: dirty flag lights up then resets', undoRes.dirtyBefore && undoRes.dirtyAfterU);
ok('Undo+apply: content excludes undo test content', undoRes.noUndoText);
ok('Undo reverts to entry-point source (preserves prior applied edits)', undoRes.hasNewTitle);

// 7. Download md: download event + correct content + original file not modified (read-only priority)
const mtimeBefore = fs.statSync(XSS_FILE).mtimeMs;
const sizeBefore = fs.statSync(XSS_FILE).size;
const dlPromise = page.waitForEvent('download');
await page.evaluate(() => {
  document.querySelector('#btn-edit').click();
  setTimeout(() => document.querySelector('#btn-edit-download').click(), 200);
});
const dl = await dlPromise;
const dlPath = await dl.path();
const dlName = dl.suggestedFilename();
const dlContent = fs.readFileSync(dlPath, 'utf8');
const mtimeAfter = fs.statSync(XSS_FILE).mtimeMs;
const sizeAfter = fs.statSync(XSS_FILE).size;
ok('Download md: filename ends with .md', /\.md$/i.test(dlName), dlName);
ok('Download content includes current edit state', dlContent.includes('Edit new heading'));
ok('Read-only priority: original file mtime/size unchanged', mtimeBefore === mtimeAfter && sizeBefore === sizeAfter, `${sizeBefore}B -> ${sizeAfter}B`);

// 8. Esc cancel: exit directly when no dirty changes
const escRes = await page.evaluate(async () => {
  document.querySelector('#btn-edit').click();
  await new Promise(r => setTimeout(r, 150));
  document.querySelector('#editor').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 150));
  return {
    editing: document.body.classList.contains('editing'),
  };
});
ok('Esc cancel: exits edit mode when no unsaved changes', !escRes.editing);

// 9. Switch document auto-commits unsaved changes
const switchRes = await page.evaluate(async () => {
  document.querySelector('#btn-edit').click();
  await new Promise(r => setTimeout(r, 150));
  const ta = document.querySelector('#editor');
  ta.value = ta.value + '\n### Auto-commit verification (V1.6)';
  ta.dispatchEvent(new Event('input'));
  const items = [...document.querySelectorAll('#file-list .file-item')];
  items[1].click(); // switch to summary-demo
  await new Promise(r => setTimeout(r, 500));
  const editingAfter = document.body.classList.contains('editing');
  const content2 = document.querySelector('#content, article, .markdown-body, main').innerText;
  items[0].click(); // switch back to xss-sample
  await new Promise(r => setTimeout(r, 500));
  const content1 = document.querySelector('#content, article, .markdown-body, main').innerText;
  return {
    editingAfter,
    switched: content2.includes('摘要注入演示'),
    committed: content1.includes('Auto-commit verification'),
  };
});
ok('Switch document: edit mode auto-exits, target doc renders', switchRes.editingAfter === false && switchRes.switched);
ok('Switch document: unsaved changes auto-committed to memory (visible on switch back)', switchRes.committed);

// 10. Cmd/Ctrl+S triggers download
const dl2Promise = page.waitForEvent('download');
await page.evaluate(() => {
  document.querySelector('#btn-edit').click();
  setTimeout(() => document.querySelector('#editor').dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true })), 150);
});
const dl2 = await dl2Promise;
ok('Cmd/Ctrl+S triggers md download', /\.md$/i.test(dl2.suggestedFilename()), dl2.suggestedFilename());

ok('Phase C: zero alerts throughout', alerts.length === 0, JSON.stringify(alerts));
console.log(`    [outbound requests] ${outbound.length ? outbound.join(', ') : 'none'}`);
await ctx.close();
}

/* ============ Phase D: Edit-injected XSS resistance ============ */
if (WANTED.includes('D')) {
console.log('\n[Phase D] Edit-injected XSS Resistance');
const ctx = await browser.newContext();
const page = await ctx.newPage();
let alerts = [];
page.on('dialog', d => { alerts.push(d.message()); d.dismiss(); });
await page.goto(HTML);
await page.waitForTimeout(1500);

const injRes = await page.evaluate(async () => {
  document.querySelector('#btn-edit').click();
  await new Promise(r => setTimeout(r, 150));
  const ta = document.querySelector('#editor');
  ta.value = `# Edit injection test

<script>alert('edit-xss-1')</script>

<img src=x onerror="alert('edit-xss-2')">

[danger](javascript:alert('edit-xss-3'))

![danger](javascript:alert('edit-xss-4'))

\`\`\`html
<script>alert('edit-code-safe')</script>
\`\`\`

Legal link [GitHub](https://github.com)
`;
  ta.dispatchEvent(new Event('input'));
  document.querySelector('#btn-edit-apply').click();
  await new Promise(r => setTimeout(r, 500));
  const el = document.querySelector('#content, article, .markdown-body, main');
  return {
    scripts: el.querySelectorAll('script').length,
    dangerLinks: [...el.querySelectorAll('a, img')].filter(n => {
      const u = (n.getAttribute('href') || n.getAttribute('src') || '').trim().toLowerCase();
      return u.startsWith('javascript:') || u.startsWith('data:') || u.startsWith('vbscript:');
    }).length,
    codeSafe: el.innerText.includes("alert('edit-code-safe')"),
    legalOk: [...el.querySelectorAll('a')].some(a => a.getAttribute('href') === 'https://github.com'),
  };
});
ok('Edit-injected <script> renders zero script tags', injRes.scripts === 0, `${injRes.scripts} found`);
ok('Edit-injected dangerous protocol links/images all blocked', injRes.dangerLinks === 0);
ok('Code block payload displayed as text, not executed', injRes.codeSafe);
ok('Legal links preserved and clickable after edit', injRes.legalOk);
ok('Phase D: zero alerts throughout', alerts.length === 0, JSON.stringify(alerts));
await ctx.close();
}

/* ============ Phase E: Zero external network + V1.5 regression ============ */
if (WANTED.includes('E')) {
console.log('\n[Phase E] Zero External Network + V1.5 Regression');
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const outbound = [];
page.on('request', r => { if (!r.url().startsWith('file://')) outbound.push(r.url()); });
let alerts = [];
page.on('dialog', d => { alerts.push(d.message()); d.dismiss(); });
await page.goto(HTML);
await page.waitForTimeout(1500);

// 1. Zero external network: no non-file:// requests on page load
ok('Zero network: no external requests on page load', outbound.length === 0, outbound.length ? `${outbound.length} found: ${outbound.join(', ')}` : '');

// 2. Full-text search (V1.5): highlight + counter
const searchRes = await page.evaluate(async () => {
  document.querySelector('#btn-search').click();
  const barShown = document.querySelector('#search-bar').classList.contains('show');
  const input = document.querySelector('#search-input');
  input.value = '验收';
  input.dispatchEvent(new Event('input'));
  await new Promise(r => setTimeout(r, 400));
  const marks = document.querySelectorAll('#content mark.search-hit').length;
  const counter = document.querySelector('#search-count')?.textContent || document.querySelector('.search-counter')?.textContent || '';
  return { barShown, marks, counter };
});
ok('V1.5 search: search bar expands', searchRes.barShown);
ok('V1.5 search: highlights matches + counter', searchRes.marks >= 1 && /\/\s*\d+/.test(searchRes.counter), `${searchRes.marks} highlights, counter=${searchRes.counter}`);

// 3. Export standalone HTML (V1.5)
const dlHtml = page.waitForEvent('download');
await page.evaluate(() => document.querySelector('#btn-html').click());
const htmlDl = await dlHtml;
ok('V1.5 export: downloads .html file', /\.html$/i.test(htmlDl.suggestedFilename()), htmlDl.suggestedFilename());

// 4. Image lightbox (V1.5): edit-inject legal image -> click to enlarge
const lbRes = await page.evaluate(async () => {
  document.querySelector('#btn-edit').click();
  await new Promise(r => setTimeout(r, 150));
  const ta = document.querySelector('#editor');
  ta.value = ta.value + '\n\n![lightbox test](https://example.com/lightbox-test.png)';
  ta.dispatchEvent(new Event('input'));
  document.querySelector('#btn-edit-apply').click();
  await new Promise(r => setTimeout(r, 400));
  const img = [...document.querySelectorAll('#content img')].find(i => (i.getAttribute('src') || '').includes('lightbox-test'));
  if (!img) return { found: false };
  img.click();
  await new Promise(r => setTimeout(r, 200));
  const lb = document.querySelector('#lightbox');
  const shown = lb && lb.classList.contains('show');
  if (shown) { document.querySelector('#lightbox').click(); }
  await new Promise(r => setTimeout(r, 150));
  const closed = !document.querySelector('#lightbox').classList.contains('show');
  return { found: true, shown, closed };
});
ok('V1.5 lightbox: click image to enlarge, click overlay to close', lbRes.found && lbRes.shown && lbRes.closed, lbRes.found ? '' : 'no legal image in bundle');

// 5. Status bar + back-to-top (V1.5): switch to long document and scroll
const barRes = await page.evaluate(async () => {
  const items = [...document.querySelectorAll('#file-list .file-item')];
  items[items.length - 1].click(); // long-document.md
  await new Promise(r => setTimeout(r, 600));
  const sb = document.querySelector('#statusbar, .statusbar');
  const sbExists = !!sb;
  const sbText = sb ? sb.textContent : '';
  const backTop = document.querySelector('#back-top');
  const btExists = !!backTop;
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 300));
  const btShown = backTop && backTop.classList.contains('show');
  const pct = /(\d+(\.\d+)?)\s*%/.test(sbText) ? sbText.match(/(\d+(\.\d+)?)\s*%/)[1] + '%' : 'none';
  return { sbExists, btExists, btShown, pct };
});
ok('V1.5 status bar: exists and shows progress %', barRes.sbExists && barRes.pct !== 'none', barRes.pct);
ok('V1.5 back-to-top: appears after scroll', barRes.btExists && barRes.btShown);

// 6. Final state check
const afterAll = await page.evaluate(() => ({
  editing: document.body.classList.contains('editing'),
}));
ok('Phase E: clean final state (edit mode exited)', !afterAll.editing);
ok('Phase E: zero alerts throughout', alerts.length === 0, JSON.stringify(alerts));
console.log(`    [outbound requests] ${outbound.length ? outbound.join(', ') : 'none'}`);
await ctx.close();
}

await browser.close();
console.log(`\n========== V1.6 Test Results: ${pass} passed / ${fail} failed ==========`);
process.exit(fail > 0 ? 1 : 0);
