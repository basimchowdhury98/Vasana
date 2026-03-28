/**
 * Shared test helpers: browser launch, popup dismissal, video navigation.
 */
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = resolve(__dirname, "../..");
const DIST_DIR = resolve(PROJECT_ROOT, "dist");
const SCREENSHOT_DIR = resolve(PROJECT_ROOT, "test/screenshots");
const CHROMIUM_PATH = "/usr/bin/chromium";

mkdirSync(SCREENSHOT_DIR, { recursive: true });

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Launch Chromium with the extension loaded. */
export async function launchBrowser(): Promise<Browser> {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: false,
    args: [
      `--disable-extensions-except=${DIST_DIR}`,
      `--load-extension=${DIST_DIR}`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-infobars",
      `--user-data-dir=/tmp/sudoku-test-${Date.now()}`,
    ],
    defaultViewport: { width: 1280, height: 800 },
  });
  return browser;
}

/** Inject auto-popup-dismisser that handles all known TikTok popups. */
export async function injectPopupDismisser(page: Page): Promise<void> {
  await page.addScriptTag({
    content: `
      (function() {
        if (window.__popupDismisserActive) return;
        window.__popupDismisserActive = true;

        var dismissAll = function() {
          // "Not now" on app-download modals
          var els = document.querySelectorAll("div, button, span, a, p");
          for (var i = 0; i < els.length; i++) {
            var text = els[i].textContent ? els[i].textContent.trim() : "";
            if ((text === "Not now" || text === "Not Now") && els[i].offsetParent !== null) {
              els[i].click(); break;
            }
          }

          // Cookie banner
          var cookie = document.querySelector("tiktok-cookie-banner");
          if (cookie) cookie.remove();

          // Close/X buttons on modals
          var closeBtns = document.querySelectorAll(
            '[class*="CloseWrapper"], [class*="close-icon"], [aria-label="Close"], [aria-label="close"]'
          );
          for (var j = 0; j < closeBtns.length; j++) {
            var rect = closeBtns[j].getBoundingClientRect();
            if (rect.width > 5 && rect.height > 5) closeBtns[j].click();
          }

          // "What would you like to watch" topic modal - hide the overlay
          var topicHeaders = document.querySelectorAll("h2, h3, div, span");
          for (var t = 0; t < topicHeaders.length; t++) {
            var txt = topicHeaders[t].textContent || "";
            if (txt.includes("What would you like to watch")) {
              var el = topicHeaders[t];
              for (var p = 0; p < 10; p++) {
                el = el.parentElement;
                if (!el) break;
                var s = getComputedStyle(el);
                if (s.position === "fixed" && el.offsetWidth > 300 && el.offsetHeight > 300) {
                  el.style.display = "none";
                  break;
                }
              }
              break;
            }
          }

          // Dialog overlays
          var overlays = document.querySelectorAll('[role="dialog"], [class*="Overlay"], [class*="overlay"]');
          for (var oi = 0; oi < overlays.length; oi++) {
            var ox = overlays[oi].querySelector('button, [role="button"], svg');
            if (ox) ox.click();
          }

          // Modal containers
          var modals = document.querySelectorAll('[class*="DivModalContainer"]');
          for (var k = 0; k < modals.length; k++) {
            if (modals[k].children.length > 0) modals[k].style.display = "none";
          }

          // Popup container
          var popup = document.querySelector("#mobile-popup-container");
          if (popup && popup.children.length > 0) popup.style.display = "none";
        };

        dismissAll();
        var observer = new MutationObserver(function() { dismissAll(); });
        observer.observe(document.body, { childList: true, subtree: true });
      })();
    `,
  });
}

/**
 * Navigate to TikTok FYP, wait for load, and dismiss popups.
 * Returns the page ready for testing.
 */
export async function navigateToTikTok(browser: Browser): Promise<Page> {
  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  // Wait for extension to register content scripts
  await sleep(2000);

  await page.goto("https://www.tiktok.com/foryou", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await sleep(3000);

  await injectPopupDismisser(page);
  await sleep(1000);

  return page;
}

/**
 * Scroll the TikTok feed to the next video.
 * Finds the scroll-snap container and scrolls it by one viewport height.
 */
export async function goToNextVideo(page: Page): Promise<void> {
  await page.evaluate(() => {
    var allEls = document.querySelectorAll("*");
    for (var i = 0; i < allEls.length; i++) {
      var style = getComputedStyle(allEls[i]);
      if (style.scrollSnapType && style.scrollSnapType !== "none") {
        var el = allEls[i] as HTMLElement;
        if (el.scrollHeight > el.clientHeight) {
          el.scrollBy({ top: el.clientHeight, behavior: "smooth" });
          return;
        }
      }
    }
    window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
  });
  await sleep(2500);
}

/** Take a screenshot and return the path. */
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const path = resolve(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path });
  console.log(`  Screenshot: ${path}`);
  return path;
}
