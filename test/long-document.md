# Markdown Features Showcase

This document demonstrates various markdown features for testing the MD Reader.
It is intentionally long to test scrolling, status bar progress, and back-to-top functionality.

## Table of Contents

- [Headings](#headings)
- [Text Formatting](#text-formatting)
- [Lists](#lists)
- [Tables](#tables)
- [Code Blocks](#code-blocks)
- [Blockquotes](#blockquotes)
- [Links and Images](#links-and-images)
- [Task Lists](#task-lists)
- [Nested Structures](#nested-structures)
- [Edge Cases](#edge-cases)

## Headings

### H3 Heading

#### H4 Heading

##### H5 Heading

###### H6 Heading

## Text Formatting

This paragraph has **bold text**, *italic text*, ***bold italic***, `inline code`, and ~~strikethrough~~.

Here is a paragraph with a footnote[^1] and another one[^2].

[^1]: This is the first footnote.
[^2]: This is the second footnote with more detail.

## Lists

### Unordered List

- First item
- Second item
  - Nested item A
  - Nested item B
    - Deeply nested item
- Third item

### Ordered List

1. First step
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step

### Mixed List

1. Start here
   - Note about the start
   - Another note
2. Continue here
   - Important detail
3. End here

## Tables

### Simple Table

| Name | Type | Description |
|------|------|-------------|
| id | integer | Unique identifier |
| name | string | Display name |
| created_at | datetime | Creation timestamp |
| status | enum | Current state |

### Aligned Table

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left | Center | Right |
| AAA | BBB | CCC |
| Long text here | Medium text | Short |

### Wide Table

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 |
|----------|----------|----------|----------|----------|----------|
| Data 1 | Data 2 | Data 3 | Data 4 | Data 5 | Data 6 |
| More 1 | More 2 | More 3 | More 4 | More 5 | More 6 |

## Code Blocks

### JavaScript

```javascript
class Debounce {
  constructor(delay) {
    this.delay = delay;
    this.timer = null;
  }

  call(fn, ...args) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => fn(...args), this.delay);
  }

  cancel() {
    clearTimeout(this.timer);
    this.timer = null;
  }
}

const debouncer = new Debounce(300);
debouncer.call(() => console.log('Executed after 300ms of silence'));
```

### Python

```python
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class Task:
    id: int
    title: str
    done: bool = False
    tags: List[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []

    def mark_done(self):
        self.done = True
        return self

tasks = [
    Task(1, "Review pull request"),
    Task(2, "Update documentation", tags=["docs"]),
    Task(3, "Fix memory leak", tags=["bug", "urgent"]),
]

for task in tasks:
    print(f"#{task.id} [{('x' if task.done else ' ')}] {task.title} {task.tags}")
```

### Bash

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="${1:-/tmp/backup}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

find . -name "*.md" -print0 | while IFS= read -r -d '' file; do
  dest="$BACKUP_DIR/$(basename "$file")"
  cp "$file" "$dest"
  echo "[OK] $file -> $dest"
done

echo "Backup complete: $(find "$BACKUP_DIR" -type f | wc -l) files"
```

### SQL

```sql
SELECT
    u.username,
    COUNT(o.id) AS order_count,
    SUM(o.total) AS total_spent,
    AVG(o.total) AS avg_order_value
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.created_at >= '2026-01-01'
GROUP BY u.id, u.username
HAVING COUNT(o.id) > 5
ORDER BY total_spent DESC
LIMIT 20;
```

## Blockquotes

> This is a simple blockquote.

> This is a multi-line blockquote.
> It continues on this line.
>
> And has a second paragraph.

> Nested blockquote:
>> This is nested inside.
>>> And this is deeply nested.

> Blockquote with a list:
> - First item
> - Second item
>
> And a code block:
> ```python
> print("hello")
> ```

## Links and Images

Here are some links: [GitHub](https://github.com), [Markdown Guide](https://www.markdownguide.org), and a [relative link](./xss-sample.md).

Image with alt text (external URL, may not load in file:// context):

![Placeholder Image](https://via.placeholder.com/640x360)

## Task Lists

- [x] Set up project structure
- [x] Write initial README
- [x] Implement core features
- [ ] Add unit tests
- [ ] Write documentation
- [ ] Deploy to production

## Nested Structures

### Example: Configuration

Here's a complex nested structure:

1. **Environment Setup**
   - Install Node.js
     - Use nvm for version management
     - Recommended version: 20 LTS
   - Install dependencies
     ```bash
     npm install
     ```
   - Configure environment
     - Copy `.env.example` to `.env`
     - Set `DATABASE_URL`
     - Set `JWT_SECRET`

2. **Development**
   - Start dev server
     ```bash
     npm run dev
     ```
   - Run tests
     - Unit tests: `npm test`
     - E2E tests: `npm run test:e2e`
   - Code quality
     - Lint: `npm run lint`
     - Format: `npm run format`

3. **Deployment**
   - Build
     ```bash
     npm run build
     ```
   - Deploy
     - Staging: `npm run deploy:staging`
     - Production: `npm run deploy:prod`
   - Verify
     - Health check
     - Smoke test

## Edge Cases

### Very Long Line

This is a very long line that should wrap properly without breaking the layout. It contains a lot of text to ensure that the reader handles long paragraphs gracefully. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

### Empty Table Cells

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Data 1   |          | Data 3   |
|          | Data 2   |          |
|          |          |          |

### Mixed Inline Code

You can use `const x = 1` and `let y = 2` and `var z = 3` in the same paragraph. Also `function() { return true; }` should render correctly.

### HTML Entities

Less than: < , Greater than: > , Ampersand: & , Quotes: " ' , Non-breaking space: a b

### Special Characters

Em dash: — , En dash: – , Ellipsis: … , Copyright: © , Trademark: ™ , Arrow: → ← ↑ ↓

## Summary

This document covers:
- All standard markdown elements
- Edge cases for rendering
- Long content for scroll testing
- Nested structures for layout stress testing

If the MD Reader renders all of the above correctly, it passes the regression test.

---

*End of document*
