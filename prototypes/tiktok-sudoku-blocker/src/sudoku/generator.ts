import type { SudokuGrid, SudokuPuzzle } from "./types.js";
import { solve } from "./solver.js";

/**
 * Shuffle an array in place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Fill the three diagonal 3x3 boxes with random valid numbers.
 * These boxes don't overlap in rows or columns, so they can be
 * filled independently with any permutation of 1-9.
 */
function fillDiagonalBoxes(grid: SudokuGrid): void {
  for (let box = 0; box < 3; box++) {
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let idx = 0;
    const start = box * 3;
    for (let r = start; r < start + 3; r++) {
      for (let c = start; c < start + 3; c++) {
        grid[r][c] = nums[idx++];
      }
    }
  }
}

/**
 * Generate a complete valid Sudoku grid.
 * Fills diagonal boxes randomly then solves the remaining cells.
 */
function generateCompleteGrid(): SudokuGrid {
  const grid: SudokuGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillDiagonalBoxes(grid);
  const solved = solve(grid);
  // solve() always succeeds here because diagonal boxes are independent
  return solved!;
}

/**
 * Generate a very easy Sudoku puzzle with 20-25 empty cells.
 * With 56-61 givens, most cells can be deduced by simple elimination
 * and the puzzle should be solvable in well under a minute.
 * Returns both the puzzle grid and its unique solution.
 */
export function generatePuzzle(): SudokuPuzzle {
  const solution = generateCompleteGrid();
  const puzzle: SudokuGrid = solution.map((row) => [...row]);

  // Determine how many cells to remove (20-25 for very easy)
  const toRemove = 20 + Math.floor(Math.random() * 6); // 20..25

  // Collect all 81 cell positions, shuffle, and remove the first `toRemove`
  const positions: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push([r, c]);
    }
  }
  shuffle(positions);

  for (let i = 0; i < toRemove; i++) {
    const [r, c] = positions[i];
    puzzle[r][c] = 0;
  }

  return { puzzle, solution };
}
