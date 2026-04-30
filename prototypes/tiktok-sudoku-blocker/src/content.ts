// TikTok Sudoku Blocker - Content Script
import { generatePuzzle } from "./sudoku/generator.js";
import type { SudokuGrid } from "./sudoku/types.js";

// Type declaration for chrome extension APIs (available at runtime in extension context)
declare const chrome: {
  storage?: {
    local: {
      get(keys: string[], callback: (result: Record<string, unknown>) => void): void;
      set(items: Record<string, unknown>): void;
    };
  };
};

// ============================================================
// Constants
// ============================================================
const SWIPE_THRESHOLD = 1;
const STORAGE_KEY = "sudoku_blocker_swipe_count";

// ============================================================
// DOM sentinel — tests verify this attribute from the main world
// ============================================================
document.documentElement.setAttribute("data-sudoku-blocker", "true");
console.log("[TikTok Sudoku Blocker] Content script loaded.");

// ============================================================
// State
// ============================================================
let swipeCount = 0;
let overlayActive = false;
let selectedCell: HTMLElement | null = null;
let currentPuzzleGrid: SudokuGrid | null = null;
let currentSolution: SudokuGrid | null = null;
let feedContainer: HTMLElement | null = null;
let feedOverflowBackup = "";
let lockedScrollTop = 0;
let scrollLockHandler: (() => void) | null = null;
let interactionBlocker: ((e: Event) => void) | null = null;

// ============================================================
// Storage helpers (chrome.storage.local)
// ============================================================
function loadSwipeCount(): Promise<number> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get([STORAGE_KEY], (result: Record<string, unknown>) => {
          resolve((result[STORAGE_KEY] as number) ?? 0);
        });
      } else {
        resolve(0);
      }
    } catch {
      resolve(0);
    }
  });
}

function saveSwipeCount(count: number): void {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: count });
    }
  } catch {
    // Ignore — might not be in extension context
  }
}

// ============================================================
// Create root container + swipe counter
// ============================================================
function createRootContainer(): HTMLElement {
  const root = document.createElement("div");
  root.id = "sudoku-blocker-root";
  root.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:999999;";
  document.body.appendChild(root);
  return root;
}

function createSwipeCounter(root: HTMLElement): HTMLElement {
  const counter = document.createElement("div");
  counter.setAttribute("data-testid", "swipe-counter");
  counter.style.cssText =
    "position:fixed;top:8px;right:8px;background:rgba(0,0,0,0.7);color:#fff;" +
    "padding:4px 10px;border-radius:12px;font-size:12px;z-index:999998;" +
    "font-family:sans-serif;pointer-events:none;";
  counter.textContent = `Swipes: ${swipeCount}`;
  root.appendChild(counter);
  return counter;
}

function updateCounterDisplay(counter: HTMLElement): void {
  counter.textContent = `Swipes: ${swipeCount}`;
}

// ============================================================
// Scroll blocking
// ============================================================
function blockScrolling(): void {
  feedContainer = findFeedContainer();
  if (feedContainer) {
    feedOverflowBackup = feedContainer.style.overflow;
    feedContainer.style.overflow = "hidden";
    // Lock scroll position by resetting on every scroll event
    lockedScrollTop = feedContainer.scrollTop;
    const container = feedContainer;
    scrollLockHandler = () => {
      container.scrollTop = lockedScrollTop;
    };
    container.addEventListener("scroll", scrollLockHandler);
  }
  document.body.style.overflow = "hidden";
}

function unblockScrolling(): void {
  if (feedContainer) {
    feedContainer.style.overflow = feedOverflowBackup;
    if (scrollLockHandler) {
      feedContainer.removeEventListener("scroll", scrollLockHandler);
      scrollLockHandler = null;
    }
  }
  document.body.style.overflow = "";
}

// ============================================================
// Video pause/resume
// ============================================================
function pauseAllVideos(): void {
  document.querySelectorAll("video").forEach((v) => {
    try { v.pause(); } catch { /* ignore */ }
  });
}

function resumeCurrentVideo(): void {
  // Resume the most visible video (first one that's in the viewport)
  const videos = document.querySelectorAll("video");
  for (const v of videos) {
    const rect = v.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0 && rect.width > 0) {
      try { v.play(); } catch { /* ignore */ }
      break;
    }
  }
}

// ============================================================
// Block all page interaction behind the overlay
// ============================================================
function blockPageInteraction(): void {
  interactionBlocker = (e: Event) => {
    const overlay = document.getElementById("sudoku-blocker-overlay");
    if (!overlay) return;
    const target = e.target as Node;
    // Allow events inside the overlay, block everything else
    if (!overlay.contains(target)) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  const opts: AddEventListenerOptions = { capture: true };
  for (const evt of ["click", "mousedown", "mouseup", "touchstart", "touchend", "keydown", "keyup"]) {
    document.addEventListener(evt, interactionBlocker, opts);
  }
}

function unblockPageInteraction(): void {
  if (interactionBlocker) {
    const opts: AddEventListenerOptions = { capture: true };
    for (const evt of ["click", "mousedown", "mouseup", "touchstart", "touchend", "keydown", "keyup"]) {
      document.removeEventListener(evt, interactionBlocker, opts);
    }
    interactionBlocker = null;
  }
}

// ============================================================
// Find the scroll-snap feed container
// ============================================================
function findFeedContainer(): HTMLElement | null {
  const allEls = document.querySelectorAll("*");
  for (let i = 0; i < allEls.length; i++) {
    const el = allEls[i] as HTMLElement;
    const style = getComputedStyle(el);
    if (style.scrollSnapType && style.scrollSnapType !== "none") {
      if (el.scrollHeight > el.clientHeight) {
        return el;
      }
    }
  }
  return null;
}

// ============================================================
// Sudoku Overlay Rendering
// ============================================================
function showSudokuOverlay(root: HTMLElement): void {
  overlayActive = true;
  blockScrolling();
  pauseAllVideos();
  blockPageInteraction();

  const { puzzle, solution } = generatePuzzle();
  currentPuzzleGrid = puzzle.map((row) => [...row]);
  currentSolution = solution;

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "sudoku-blocker-overlay";
  overlay.setAttribute("data-solution", JSON.stringify(solution));
  overlay.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1000000;" +
    "background:rgba(0,0,0,0.95);display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;font-family:sans-serif;color:#fff;";

  // Title
  const title = document.createElement("div");
  title.textContent = "Complete the Sudoku to continue";
  title.style.cssText = "font-size:18px;margin-bottom:12px;font-weight:bold;";
  overlay.appendChild(title);

  // Board
  const board = document.createElement("div");
  board.style.cssText =
    "display:grid;grid-template-columns:repeat(9,1fr);gap:1px;" +
    "width:min(90vw,360px);height:min(90vw,360px);background:#555;border:2px solid #fff;";
  overlay.appendChild(board);

  // Render 81 cells
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement("div");
      cell.setAttribute("data-testid", "sudoku-cell");
      cell.setAttribute("data-row", String(r));
      cell.setAttribute("data-col", String(c));

      const val = puzzle[r][c];
      const isGiven = val !== 0;
      cell.setAttribute("data-given", String(isGiven));

      cell.style.cssText =
        "display:flex;align-items:center;justify-content:center;" +
        "font-size:16px;font-weight:bold;cursor:pointer;user-select:none;" +
        `background:${isGiven ? "#2a2a2a" : "#1a1a1a"};color:${isGiven ? "#fff" : "#4fc3f7"};` +
        // Thicker borders for 3x3 box boundaries
        `border-right:${(c + 1) % 3 === 0 && c < 8 ? "2px solid #fff" : "none"};` +
        `border-bottom:${(r + 1) % 3 === 0 && r < 8 ? "2px solid #fff" : "none"};`;

      cell.textContent = isGiven ? String(val) : "";

      if (!isGiven) {
        cell.addEventListener("click", () => {
          // Deselect previous
          if (selectedCell) {
            selectedCell.style.outline = "none";
          }
          selectedCell = cell;
          cell.style.outline = "2px solid #4fc3f7";
        });
      }

      board.appendChild(cell);
    }
  }

  // Number pad
  const numpad = document.createElement("div");
  numpad.style.cssText =
    "display:flex;gap:6px;margin-top:16px;flex-wrap:wrap;justify-content:center;";
  overlay.appendChild(numpad);

  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement("button");
    btn.setAttribute("data-testid", "numpad-btn");
    btn.setAttribute("data-value", String(n));
    btn.textContent = String(n);
    btn.style.cssText =
      "width:36px;height:36px;font-size:16px;font-weight:bold;border:none;" +
      "border-radius:6px;background:#333;color:#fff;cursor:pointer;";

    btn.addEventListener("click", () => {
      if (selectedCell && selectedCell.getAttribute("data-given") === "false") {
        const row = parseInt(selectedCell.getAttribute("data-row") || "0");
        const col = parseInt(selectedCell.getAttribute("data-col") || "0");
        currentPuzzleGrid![row][col] = n;
        selectedCell.textContent = String(n);
        selectedCell.style.outline = "none";
        selectedCell = null;
      }
    });

    numpad.appendChild(btn);
  }

  // Clear button
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "X";
  clearBtn.style.cssText =
    "width:36px;height:36px;font-size:16px;font-weight:bold;border:none;" +
    "border-radius:6px;background:#700;color:#fff;cursor:pointer;";
  clearBtn.addEventListener("click", () => {
    if (selectedCell && selectedCell.getAttribute("data-given") === "false") {
      const row = parseInt(selectedCell.getAttribute("data-row") || "0");
      const col = parseInt(selectedCell.getAttribute("data-col") || "0");
      currentPuzzleGrid![row][col] = 0;
      selectedCell.textContent = "";
      selectedCell.style.outline = "none";
      selectedCell = null;
    }
  });
  numpad.appendChild(clearBtn);

  // Check solution button
  const checkBtn = document.createElement("button");
  checkBtn.setAttribute("data-testid", "check-solution-btn");
  checkBtn.textContent = "Check Solution";
  checkBtn.style.cssText =
    "margin-top:16px;padding:10px 24px;font-size:16px;font-weight:bold;" +
    "border:none;border-radius:8px;background:#4caf50;color:#fff;cursor:pointer;";

  checkBtn.addEventListener("click", () => {
    if (!currentPuzzleGrid || !currentSolution) return;

    // Compare current grid to solution
    let correct = true;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentPuzzleGrid[r][c] !== currentSolution[r][c]) {
          correct = false;
          break;
        }
      }
      if (!correct) break;
    }

    if (correct) {
      // Puzzle completed — remove overlay, unblock, reset count
      overlay.remove();
      overlayActive = false;
      unblockScrolling();
      unblockPageInteraction();
      resumeCurrentVideo();
      swipeCount = 0;
      saveSwipeCount(0);
      updateCounterDisplay(counterEl);
      selectedCell = null;
      currentPuzzleGrid = null;
      currentSolution = null;
    } else {
      // Flash the board border red briefly
      board.style.border = "2px solid #f44336";
      setTimeout(() => {
        board.style.border = "2px solid #fff";
      }, 600);
    }
  });
  overlay.appendChild(checkBtn);

  root.appendChild(overlay);
}

// ============================================================
// Video transition detection
// ============================================================
let counterEl: HTMLElement;

function setupScrollDetection(): void {
  const container = findFeedContainer();
  if (!container) {
    // Retry — TikTok may still be loading
    setTimeout(setupScrollDetection, 1000);
    return;
  }

  let lastScrollTop = container.scrollTop;
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  container.addEventListener(
    "scroll",
    () => {
      if (overlayActive) return;

      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const currentScrollTop = container.scrollTop;
        const delta = Math.abs(currentScrollTop - lastScrollTop);
        const threshold = container.clientHeight * 0.5;

        if (delta >= threshold) {
          lastScrollTop = currentScrollTop;
          swipeCount++;
          saveSwipeCount(swipeCount);
          updateCounterDisplay(counterEl);

          if (swipeCount >= SWIPE_THRESHOLD) {
            const root = document.getElementById("sudoku-blocker-root");
            if (root) {
              showSudokuOverlay(root);
            }
          }
        }
      }, 150);
    },
    { passive: true }
  );
}

// ============================================================
// Bootstrap
// ============================================================
async function init(): Promise<void> {
  // Wait for body to be available
  if (!document.body) {
    await new Promise<void>((resolve) => {
      document.addEventListener("DOMContentLoaded", () => resolve());
    });
  }

  // Load persisted swipe count
  swipeCount = await loadSwipeCount();

  // Create root container + counter
  const root = createRootContainer();
  counterEl = createSwipeCounter(root);

  // If swipe count >= threshold (e.g. user refreshed while overlay was active),
  // immediately show a fresh puzzle so they can't bypass by refreshing.
  if (swipeCount >= SWIPE_THRESHOLD) {
    // Small delay to let TikTok render first
    setTimeout(() => showSudokuOverlay(root), 2000);
  }

  // Start detecting video transitions
  // Wait a bit for TikTok to render its feed
  setTimeout(setupScrollDetection, 2000);
}

init();
