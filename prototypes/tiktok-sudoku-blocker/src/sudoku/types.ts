/** A 9x9 Sudoku grid. 0 means empty cell. */
export type SudokuGrid = number[][];

/** Represents a single cell in the puzzle */
export interface Cell {
  row: number;
  col: number;
  value: number;
  isGiven: boolean;
}

/** A complete puzzle with both the puzzle and its solution */
export interface SudokuPuzzle {
  puzzle: SudokuGrid;
  solution: SudokuGrid;
}
