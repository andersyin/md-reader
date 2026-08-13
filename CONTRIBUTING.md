# Contributing

Thanks for your interest in improving MD Reader.

## Core principle: zero dependencies

MD Reader is a single HTML file with zero external dependencies. This is the project's core value proposition. All contributions must maintain this principle:

- No CDN links
- No npm packages in the reader itself (package.json is for tests only)
- No external fonts, CSS, or JS
- No network requests at runtime

## Development

```bash
git clone https://github.com/andersyin/md-reader.git
cd md-reader
npm install           # installs playwright-core for testing
node test/sanitize.mjs          # no browser
node test/generate-bundle.mjs   # generate test bundle
node test/heartbeat_v16.mjs     # run 37 Playwright assertions
```

## Guidelines

### HTML/JS changes
- All code goes in `md-reader.html` — single file, no build step
- Escape all user content (markdown is untrusted input)
- Reject `javascript:` / `data:` / `vbscript:` even when camouflaged (ZWSP, HTML entities, percent-encoding)
- Test XSS resistance with `test/xss-sample.md` and `node test/sanitize.mjs`
- Keep file size under 100KB

### Testing
```bash
node test/sanitize.mjs          # regenerates nothing; must stay green
node test/generate-bundle.mjs   # regenerate bundle after fixture changes
node test/heartbeat_v16.mjs     # must pass all 37 assertions
```
Linux CI runs `bash -n` + ShellCheck on `open-reader.command`, then the Node checks above. It cannot exercise Finder double-click.

### Pull requests
- One feature/fix per PR
- Include test results in your PR
- Follow the PR template checklist

## Reporting issues
Use the issue templates. Include:
- Browser name and version
- How you opened the reader (drag-drop / launcher)
- Markdown file size (approximate)
- Screenshots if applicable
