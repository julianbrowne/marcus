# Sources

Everything Marcus uses that it didn't write: text corpora, packages, design, fonts, icons and
references. Marcus itself is [CC BY-NC 4.0](LICENSE); what's listed here keeps its own licence.

## Text corpora

Files in `src/corpus/raw/` are kept as downloaded (apart from trimming) and cleaned at build time by
`scripts/prepare-corpora.mjs` into `src/corpus/clean/`.

| File | Source | Licence |
|---|---|---|
| `aesop.txt` | *Three Hundred Aesop's Fables*, tr. George Fyler Townsend, [Project Gutenberg #21](https://www.gutenberg.org/ebooks/21) | Public domain (US) |
| `alice.txt` | *Alice's Adventures in Wonderland*, Lewis Carroll, [Project Gutenberg #11](https://www.gutenberg.org/ebooks/11) | Public domain (US) |
| `geography.txt` | **Synthetic**, written by `scripts/make-geography.mjs` (deterministic): short factual sentences about 74 real countries, their capitals and demonyms (single-word names only), structured so that similarity retrieval over word co-occurrence answers "what is the capital of X" and "city − country + country" analogies for every pair. Synthetic because real text doesn't give each fact the consistent structure this method needs | Part of this project (CC BY-NC 4.0) |
| `gutenberg-67-books.txt` | 67 books from the Project Gutenberg "Top 100 EBooks last 30 days" list (September 2026), downloaded by `scripts/fetch-gutenberg.mjs`, which lists each book | Public domain (US and UK: every author/translator died by 1955) |
| `moby-dick.txt` | *Moby Dick; Or, The Whale*, Herman Melville, [Project Gutenberg #2701](https://www.gutenberg.org/ebooks/2701) | Public domain (US) |
| `pride-and-prejudice.txt` | *Pride and Prejudice*, Jane Austen, [Project Gutenberg #1342](https://www.gutenberg.org/ebooks/1342) | Public domain (US) |
| `share-prices.txt` | **Synthetic**, written by `scripts/make-share-prices.mjs` (seeded, reproducible): 480 agent transcripts, one per line, in the format the harness (`src/harness.js`) uses: a tool list, a share-price question about one of 8 FTSE companies, a `tool_use` call, a `tool_result` and the answer. Each company's prices are a random walk ending at the fake api's price. Synthetic because no public text has tool-use transcripts like this. Prices are fake | Part of this project (CC BY-NC 4.0) |
| `sherlock-holmes.txt` | *The Adventures of Sherlock Holmes*, Arthur Conan Doyle, [Project Gutenberg #1661](https://www.gutenberg.org/ebooks/1661) | Public domain (US) |
| `tinystories.txt` | First ~3 MB (3,934 whole stories) of `TinyStoriesV2-GPT4-valid.txt` from [TinyStories](https://huggingface.co/datasets/roneneldan/TinyStories), Eldan & Li, 2023 | [CDLA-Sharing-1.0](https://cdla.dev/sharing-1-0/) |

Gutenberg files still carry the Project Gutenberg licence header/footer, so they are redistributed
under it; `stripGutenberg()` removes it and every Project Gutenberg reference before the text is used.

The unit-test fixtures in `test/fixtures/` are copies of some of these texts (see its README).

## Packages

Shipped in the app:

| Package | Used for | Licence |
|---|---|---|
| [react](https://react.dev), [react-dom](https://react.dev) | the user interface | MIT |
| [lucide-react](https://lucide.dev) | icons in the interface | ISC |
| [@fontsource-variable/geist](https://fontsource.org/fonts/geist) | the Geist font, bundled (no font server) | OFL-1.1 |
| [wink-nlp](https://winkjs.org) and [wink-eng-lite-web-model](https://winkjs.org) | corpus profiles at build time; analysing generated text in the browser (loaded only on "analyse") | MIT |

Build, test and lint only (not shipped):

| Package | Used for | Licence |
|---|---|---|
| [vite](https://vite.dev), [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | building and serving | MIT |
| [vitest](https://vitest.dev), [@vitest/ui](https://vitest.dev/guide/ui) | tests and the HTML test report | MIT |
| [@testing-library/react](https://github.com/testing-library/react-testing-library), [jsdom](https://github.com/jsdom/jsdom) | testing the app without a browser | MIT |
| [eslint](https://eslint.org), [@eslint/js](https://eslint.org), [eslint-plugin-react-hooks](https://react.dev), [eslint-plugin-react-refresh](https://github.com/ArnaudBarre/eslint-plugin-react-refresh), [globals](https://github.com/sindresorhus/globals) | linting | MIT |

## Design, font and icons

| What | Source | Licence |
|---|---|---|
| Colour tokens and component styles (`src/index.css`) | [shadcn/ui](https://ui.shadcn.com) "neutral" theme, rewritten as plain CSS. Copyright (c) 2023 shadcn | MIT |
| Font | [Geist](https://vercel.com/font) by Vercel, via Fontsource | SIL Open Font License 1.1 |
| Interface icons | [lucide](https://lucide.dev) | ISC |
| Favicon (`public/assets/images/icons8-chain-50.png`) | <a target="_blank" href="https://icons8.com/icon/yYT2bg6jaBu2/chain">Chain</a> icon by <a target="_blank" href="https://icons8.com">Icons8</a> | Icons8 free licence: a visible link to icons8.com, given in the app's sidebar footer |

## References

- Zhou et al., 2023, *Instruction-Following Evaluation for Large Language Models* (IFEval), [arXiv:2311.07911](https://arxiv.org/abs/2311.07911): cited in the app's instruction captions.
- Project Gutenberg's [permissions](https://www.gutenberg.org/policy/permission.html), [licence](https://www.gutenberg.org/policy/license.html) and [robot access policy](https://www.gutenberg.org/policy/robot_access.html), which `scripts/fetch-gutenberg.mjs` follows.
