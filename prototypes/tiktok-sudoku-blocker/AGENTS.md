# TikTok Sudoku Blocker - Agent Context

## What This Is

A Chrome extension (Manifest V3) that runs on tiktok.com. After every 1 video transition (swipe/scroll), it injects a fullscreen Sudoku puzzle overlay. The user must complete the puzzle before they can continue scrolling. Swipe count persists across sessions via `chrome.storage.local`. Designed for personal use on Orion browser (iOS) to promote mindful scrolling.

## Current State

**Test harness is complete. No features are implemented yet.** All source files are stubs that throw `"Not implemented"`. The test suite is designed to fail for the right reasons until features are built.

- Unit tests: 14/14 fail (`Error: Not implemented`)
- Integration tests: 1/10 pass (TikTok FYP loads), 9/10 fail (no features)

## Project Structure

```
tiktok-sudoku-blocker/
├── manifest.json              # MV3 manifest (source of truth, copied to dist/ on build)
├── build.mjs                  # esbuild bundler: src/content.ts -> dist/content.js
├── package.json               # deps: esbuild, puppeteer-core, tsx, typescript
├── tsconfig.json              # ES2022, strict, bundler resolution
├── .gitignore                 # node_modules/, dist/, test/screenshots/
├── src/
│   ├── content.ts             # Content script entry (STUB - just sets DOM sentinel)
│   └── sudoku/
│       ├── types.ts           # SudokuGrid, Cell, SudokuPuzzle types
│       ├── solver.ts          # isValid(), solve() (STUBS)
│       └── generator.ts       # generatePuzzle() (STUB)
├── test/
│   ├── unit/
│   │   └── sudoku.test.ts     # 14 tests for solver + generator logic
│   └── integration/
│       ├── helpers.ts         # Browser launch, popup dismissal, video navigation
│       └── extension.test.ts  # 10 tests against real tiktok.com
└── dist/                      # Build output (loaded by Chromium as unpacked extension)
    ├── content.js
    ├── content.js.map
    └── manifest.json
```

## Commands

```bash
npm run build              # Bundle src/content.ts -> dist/ via esbuild
npm run test:unit          # Node test runner: 14 Sudoku logic tests
npm run test:integration   # Puppeteer: 10 tests against real tiktok.com
npm test                   # build + unit + integration
```

## Key Design Decisions

### Swipe Threshold = 1
Puzzle appears after just 1 video transition. This was initially 5 but reduced for faster testing and more aggressive blocking.

### Desktop Mode for Testing
TikTok's mobile web uses Swiper.js with only 2 pre-loaded slides. Programmatic navigation (Swiper API, touch events) only advances once before getting stuck. Desktop FYP uses a `scroll-snap` container (`DivColumnListContainer`) where `scrollBy()` works reliably and TikTok lazy-loads more content as you scroll. Desktop mode also better matches Orion browser's behavior.

### Content Script Detection
Puppeteer's `page.evaluate()` runs in the page's main world, not the extension's isolated world. So `chrome.runtime` is always undefined and `console.log` from content scripts is invisible to `page.on("console")`. We use a DOM sentinel instead: the content script sets `document.documentElement.setAttribute("data-sudoku-blocker", "true")` which is visible from both worlds since the DOM is shared.

### Popup Dismissal
TikTok shows multiple popups for non-logged-in users. The test harness injects a `MutationObserver` via `page.addScriptTag()` (not `page.evaluate()` - tsx transpilation adds `__name` references that break inside evaluate). This observer auto-dismisses:
- "Get the full app experience" (click "Not now")
- Cookie banner (`<tiktok-cookie-banner>` - removed from DOM)
- "What would you like to watch" topic modal (hide the fixed overlay)
- Modal containers (`DivModalContainer`)
- Dialog overlays (`role="dialog"`)
- TikTok Shop notifications

### Extension Loading
Chromium must run non-headless (`headless: false`) for extensions to load. The system has a live Wayland display (`:1`) that Chromium renders to. A 2-second delay between `browser.launch()` and `page.goto()` ensures the extension registers its content scripts before navigation.

### No Framework for Extension Code
The content script uses vanilla TypeScript + DOM manipulation (not Angular). Extensions run in a constrained content script context where a framework would add unnecessary weight. esbuild bundles everything into a single IIFE.

## TikTok DOM Facts (Desktop FYP)

- URL: `https://www.tiktok.com/foryou`
- Root: `<div id="app" data-csr="1">`
- React SPA with Emotion CSS (hashed class names like `css-xxxx`)
- Feed container: `DivColumnListContainer` with `scroll-snap-type: y mandatory`
- Video items: `<article>` elements with class `ArticleItemContainer`, each `100vh` tall
- Key `data-e2e` attributes: `recommend-list-item-container`, `feed-video`, `video-desc`, `video-author-avatar`, `like-count`, `comment-count`, `share-count`, `video-music`
- Navigation arrows visible on right side (up/down buttons)
- TikTok lazy-loads more articles as you scroll near the end (scrollHeight grows from ~4800 to ~14400+)
- No Swiper.js on desktop (unlike mobile)

## What Needs to Be Built

All source stubs need implementation. The content script (`src/content.ts`) needs to be expanded into the full feature. Here's the contract defined by the tests:

### DOM Elements the Tests Expect

| Selector | Purpose |
|---|---|
| `data-sudoku-blocker="true"` on `<html>` | Content script sentinel (already implemented) |
| `#sudoku-blocker-root` | Root container created by content script |
| `[data-testid='swipe-counter']` | Shows current swipe count (text includes the number) |
| `#sudoku-blocker-overlay` | Fullscreen overlay containing the puzzle |
| `[data-testid='sudoku-cell']` | 81 cells, each with `data-row`, `data-col`, `data-given` attributes |
| `[data-testid='numpad-btn']` | At least 9 buttons (1-9), each with `data-value` attribute |
| `[data-testid='check-solution-btn']` | Button to validate the completed puzzle |
| `data-solution` attribute on `#sudoku-blocker-overlay` | JSON-encoded 9x9 solution grid (for test access) |

### Sudoku Logic (src/sudoku/)

- `isValid(grid, row, col, num)`: Check row, column, and 3x3 box constraints
- `solve(grid)`: Backtracking solver, returns solved grid or null
- `generatePuzzle()`: Generate easy puzzle with 30-35 empty cells, returns `{ puzzle, solution }`

### Content Script Behavior

1. Wait for TikTok app to mount
2. Create `#sudoku-blocker-root` container
3. Load persisted swipe count from `chrome.storage.local`
4. Detect video transitions (observe the scroll-snap container's scroll position)
5. After 1 transition: generate puzzle, show `#sudoku-blocker-overlay`, block scrolling
6. Render 9x9 Sudoku board with number pad (1-9) for input
7. On correct completion: hide overlay, unblock scrolling, reset count to 0
8. Persist count to `chrome.storage.local` on every change

### Scroll Blocking

When the overlay is active, the feed container's scroll must be prevented. The integration test verifies this by checking that `scrollTop` doesn't change when `goToNextVideo()` is called while the overlay is visible.

## Environment

- Chromium 145 at `/usr/bin/chromium` (Arch Linux ARM)
- Node.js v25.8.2
- Wayland display `:1`
- puppeteer-core v24 (uses system Chromium, no bundled browser)
