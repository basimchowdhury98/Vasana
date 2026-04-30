import type { SudokuGrid } from "./types.js";

/**
 * Check if placing `num` at (row, col) is valid per Sudoku rules.
 */
export function isValid(
  grid: SudokuGrid,
  row: number,
  col: number,
  num: number
): boolean {
  // Check row
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === num) return false;
  }

  // Check column
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) return false;
  }

  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }

  return true;
}

/**
 * Find the empty cell with the fewest valid candidates (MRV heuristic).
 * Returns [row, col] or null if no empty cells remain.
 */
function findBestCell(g: SudokuGrid): [number, number] | null {
  let bestRow = -1;
  let bestCol = -1;
  let bestCount = 10;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (g[r][c] === 0) {
        let count = 0;
        for (let n = 1; n <= 9; n++) {
          if (isValid(g, r, c, n)) count++;
        }
        if (count === 0) return [r, c]; // Dead end — fail fast
        if (count < bestCount) {
          bestCount = count;
          bestRow = r;
          bestCol = c;
        }
      }
    }
  }

  return bestRow === -1 ? null : [bestRow, bestCol];
}

/**
 * Solve the given Sudoku grid using backtracking with MRV heuristic.
 * Works on a deep copy. Returns the solved grid or null if unsolvable.
 */
export function solve(grid: SudokuGrid): SudokuGrid | null {
  const g: SudokuGrid = grid.map((row) => [...row]);
  return backtrack(g) ? g : null;
}

function backtrack(g: SudokuGrid): boolean {
  const cell = findBestCell(g);
  if (cell === null) return true; // No empty cells — solved

  const [r, c] = cell;
  for (let num = 1; num <= 9; num++) {
    if (isValid(g, r, c, num)) {
      g[r][c] = num;
      if (backtrack(g)) return true;
      g[r][c] = 0;
    }
  }
  return false;
}
