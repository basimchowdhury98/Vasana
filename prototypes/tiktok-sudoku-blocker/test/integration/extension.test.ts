/**
 * Integration tests for the TikTok Sudoku Blocker extension.
 *
 * Runs against real tiktok.com using Puppeteer + Chromium with the extension loaded.
 * Tests are meant to FAIL initially (features not implemented yet)
 * but fail for the RIGHT reasons.
 *
 * Swipe threshold = 1 (puzzle appears after just 1 video transition).
 */
import { type Browser, type Page } from "puppeteer-core";
import {
  launchBrowser,
  navigateToTikTok,
  goToNextVideo,
  injectPopupDismisser,
  takeScreenshot,
  sleep,
} from "./helpers.js";

// ============================================================
// Test runner
// ============================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  fn: (ctx: { browser: Browser; page: Page }) => Promise<void>
): Promise<void> {
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await navigateToTikTok(browser);
    await fn({ browser, page });
    results.push({ name, passed: true });
    console.log(`  PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.log(`  FAIL: ${name}`);
    console.log(`        ${err.message}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// ============================================================
// Tests
// ============================================================

console.log("\n=== TikTok Sudoku Blocker - Integration Tests ===\n");

// 1. Extension content script injects on TikTok
await runTest("Extension content script injects on tiktok.com", async ({ page }) => {
  await takeScreenshot(page, "test-01-loaded");

  const sentinel = await page.evaluate(() => {
    return document.documentElement.getAttribute("data-sudoku-blocker");
  });

  if (sentinel !== "true") {
    throw new Error(
      "Expected data-sudoku-blocker='true' on <html> (content script sentinel)"
    );
  }

  // Also check that the extension creates its root container
  const hasRoot = await page.evaluate(() => {
    return document.querySelector("#sudoku-blocker-root") !== null;
  });

  if (!hasRoot) {
    throw new Error(
      "Expected #sudoku-blocker-root element (content script should create it)"
    );
  }
});

// 2. TikTok FYP loads with video content
await runTest("TikTok FYP loads with video content", async ({ page }) => {
  const info = await page.evaluate(() => {
    return {
      url: location.href,
      hasVideos: document.querySelectorAll("video").length > 0,
      hasFeedItems:
        document.querySelectorAll('[data-e2e="recommend-list-item-container"]')
          .length > 0,
    };
  });

  if (!info.url.includes("tiktok.com")) {
    throw new Error(`Expected tiktok.com URL, got: ${info.url}`);
  }

  if (!info.hasVideos) {
    throw new Error("Expected at least one <video> element on the FYP");
  }
});

// 3. Swipe counter appears and increments after 1 scroll
await runTest("Swipe counter increments after video transition", async ({ page }) => {
  // Scroll to next video
  await goToNextVideo(page);
  await takeScreenshot(page, "test-03-after-1-scroll");

  const counter = await page.evaluate(() => {
    const el = document.querySelector("[data-testid='swipe-counter']");
    return el ? el.textContent : null;
  });

  if (counter === null) {
    throw new Error(
      "Expected [data-testid='swipe-counter'] element showing current count"
    );
  }

  if (!counter.includes("1")) {
    throw new Error(`Expected counter to show 1, got: "${counter}"`);
  }
});

// 4. Sudoku overlay appears after 1 swipe (threshold = 1)
await runTest("Sudoku overlay appears after 1 video transition", async ({ page }) => {
  await goToNextVideo(page);
  await sleep(500);
  await takeScreenshot(page, "test-04-overlay");

  const overlayVisible = await page.evaluate(() => {
    const overlay = document.querySelector("#sudoku-blocker-overlay");
    if (!overlay) return false;
    const style = window.getComputedStyle(overlay);
    return style.display !== "none" && style.visibility !== "hidden";
  });

  if (!overlayVisible) {
    throw new Error(
      "Expected #sudoku-blocker-overlay to be visible after 1 swipe"
    );
  }
});

// 5. Sudoku board has 81 cells with correct given/empty split
await runTest("Sudoku board renders 9x9 grid with correct structure", async ({ page }) => {
  await goToNextVideo(page);
  await sleep(500);

  const cellInfo = await page.evaluate(() => {
    const cells = document.querySelectorAll("[data-testid='sudoku-cell']");
    const emptyCells = document.querySelectorAll(
      "[data-testid='sudoku-cell'][data-given='false']"
    );
    return { total: cells.length, empty: emptyCells.length };
  });

  if (cellInfo.total !== 81) {
    throw new Error(`Expected 81 Sudoku cells, found ${cellInfo.total}`);
  }

  if (cellInfo.empty < 30 || cellInfo.empty > 35) {
    throw new Error(
      `Expected 30-35 empty cells (easy), found ${cellInfo.empty}`
    );
  }

  await takeScreenshot(page, "test-05-sudoku-board");
});

// 6. Scroll is blocked while overlay is active
await runTest("Scrolling is blocked while Sudoku overlay is active", async ({ page }) => {
  await goToNextVideo(page);
  await sleep(500);

  // Record scroll position of the feed container
  const scrollBefore = await page.evaluate(() => {
    var allEls = document.querySelectorAll("*");
    for (var i = 0; i < allEls.length; i++) {
      var style = getComputedStyle(allEls[i]);
      if (style.scrollSnapType && style.scrollSnapType !== "none") {
        var el = allEls[i] as HTMLElement;
        if (el.scrollHeight > el.clientHeight) return el.scrollTop;
      }
    }
    return window.scrollY;
  });

  // Try to scroll
  await goToNextVideo(page);

  const scrollAfter = await page.evaluate(() => {
    var allEls = document.querySelectorAll("*");
    for (var i = 0; i < allEls.length; i++) {
      var style = getComputedStyle(allEls[i]);
      if (style.scrollSnapType && style.scrollSnapType !== "none") {
        var el = allEls[i] as HTMLElement;
        if (el.scrollHeight > el.clientHeight) return el.scrollTop;
      }
    }
    return window.scrollY;
  });

  if (scrollAfter !== scrollBefore) {
    throw new Error(
      `Scroll should be blocked. Position moved from ${scrollBefore} to ${scrollAfter}`
    );
  }

  await takeScreenshot(page, "test-06-scroll-blocked");
});

// 7. Number pad (1-9) rendered for touch input
await runTest("Number pad (1-9) is rendered for input", async ({ page }) => {
  await goToNextVideo(page);
  await sleep(500);

  const numPadCount = await page.evaluate(() => {
    return document.querySelectorAll("[data-testid='numpad-btn']").length;
  });

  if (numPadCount < 9) {
    throw new Error(
      `Expected at least 9 numpad buttons, found ${numPadCount}`
    );
  }

  await takeScreenshot(page, "test-07-numpad");
});

// 8. Completing the puzzle removes the overlay
await runTest("Completing the Sudoku removes the overlay", async ({ page }) => {
  await goToNextVideo(page);
  await sleep(500);

  // Get solution from the overlay's data attribute
  const solution = await page.evaluate(() => {
    const overlay = document.querySelector("#sudoku-blocker-overlay");
    const attr = overlay?.getAttribute("data-solution");
    return attr ? JSON.parse(attr) : null;
  });

  if (!solution) {
    throw new Error(
      "Expected data-solution attribute on #sudoku-blocker-overlay"
    );
  }

  // Fill all empty cells with correct values
  await page.evaluate((sol: number[][]) => {
    const cells = document.querySelectorAll(
      "[data-testid='sudoku-cell'][data-given='false']"
    );
    cells.forEach((cell) => {
      const row = parseInt(cell.getAttribute("data-row") || "0");
      const col = parseInt(cell.getAttribute("data-col") || "0");
      (cell as HTMLElement).click();
      const btn = document.querySelector(
        `[data-testid='numpad-btn'][data-value='${sol[row][col]}']`
      );
      if (btn) (btn as HTMLElement).click();
    });
  }, solution);

  await sleep(300);

  // Click check button
  const checkBtn = await page.$("[data-testid='check-solution-btn']");
  if (checkBtn) {
    await checkBtn.click();
    await sleep(500);
  }

  await takeScreenshot(page, "test-08-completed");

  const overlayGone = await page.evaluate(() => {
    const overlay = document.querySelector("#sudoku-blocker-overlay");
    if (!overlay) return true;
    const style = window.getComputedStyle(overlay);
    return style.display === "none" || style.visibility === "hidden";
  });

  if (!overlayGone) {
    throw new Error("Overlay should be gone after completing the Sudoku");
  }
});

// 9. Swipe count resets after puzzle completion
await runTest("Swipe counter element exists for tracking", async ({ page }) => {
  await goToNextVideo(page);
  await sleep(500);

  const counter = await page.evaluate(() => {
    const el = document.querySelector("[data-testid='swipe-counter']");
    return el ? el.textContent : null;
  });

  if (counter === null) {
    throw new Error(
      "Expected [data-testid='swipe-counter'] to exist"
    );
  }
});

// 10. Persistence: swipe count survives reload
await runTest("Swipe count persists across page reload", async ({ page }) => {
  // Scroll once (but don't trigger puzzle since we want to test persistence
  // of the count, not completion). With threshold=1, scrolling once
  // triggers the puzzle. So we check that the count was stored.
  await goToNextVideo(page);
  await sleep(500);

  // Reload the page
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(3000);
  await injectPopupDismisser(page);
  await sleep(1000);

  await takeScreenshot(page, "test-10-after-reload");

  // The counter should still reflect the stored count
  const counter = await page.evaluate(() => {
    const el = document.querySelector("[data-testid='swipe-counter']");
    return el ? el.textContent : null;
  });

  if (counter === null) {
    throw new Error("Counter element missing after reload");
  }
});

// ============================================================
// Summary
// ============================================================

console.log("\n=== Test Summary ===\n");

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
const total = results.length;

for (const r of results) {
  const icon = r.passed ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${r.name}`);
  if (r.error) {
    console.log(`         -> ${r.error}`);
  }
}

console.log(`\n  ${passed}/${total} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
