// Word spaces (src/corpus/space/<name>.json): which corpora get one, and how each is built.
// Shared by scripts/prepare-corpora.mjs and the tests, so they build identical spaces.
//
// geography: the ask feature. Its 74 synthetic country/capital pairs each need their own direction,
// so it keeps 100 dimensions (at 50, only ~46 of 74 "capital of X" questions come out right).
// gutenberg-67-books: the instruction demo ("make no mistakes"). Words like mistakes/error/correct
// rank 2,500-7,000 there, so its space keeps 8,000 words.

const BASE = {window: 4, rows: 2000, cols: 500, dims: 50};

export const SPACES = {
  'geography': {...BASE, dims: 100},
  'gutenberg-67-books': {...BASE, rows: 8000},
};
