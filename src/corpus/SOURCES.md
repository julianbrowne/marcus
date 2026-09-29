# Corpus sources

Files in `raw/` are kept as downloaded (apart from trimming) and cleaned at build time by `scripts/prepare-corpora.mjs` into `clean/`.

| File | Source | Licence |
|---|---|---|
| `aesop.txt` | *Three Hundred Aesop's Fables*, tr. George Fyler Townsend — [Project Gutenberg #21](https://www.gutenberg.org/ebooks/21) | Public domain (US) |
| `geography.txt` | Wikipedia articles for every sovereign state (from [List of sovereign states](https://en.wikipedia.org/wiki/List_of_sovereign_states)) and its capital (from [List of national capitals](https://en.wikipedia.org/wiki/List_of_national_capitals)), 407 in all, each cut to its lead and first whole sections (≤10,000 characters); fetched September 2026 via the MediaWiki API by `scripts/fetch-wikipedia.mjs`. Text by Wikipedia contributors; each article's authors are listed in its history at `https://en.wikipedia.org/wiki/<title>?action=history` | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); modified (truncated) |
| `gutenberg-67-books.txt` | 67 books from the Project Gutenberg "Top 100 EBooks last 30 days" list (September 2026), downloaded by `scripts/fetch-gutenberg.mjs`, which lists each book | Public domain (US and UK: every author/translator died by 1955) |
| `alice.txt` | *Alice's Adventures in Wonderland*, Lewis Carroll — [Project Gutenberg #11](https://www.gutenberg.org/ebooks/11) | Public domain (US) |
| `moby-dick.txt` | *Moby Dick; Or, The Whale*, Herman Melville — [Project Gutenberg #2701](https://www.gutenberg.org/ebooks/2701) | Public domain (US) |
| `pride-and-prejudice.txt` | *Pride and Prejudice*, Jane Austen — [Project Gutenberg #1342](https://www.gutenberg.org/ebooks/1342) | Public domain (US) |
| `share-prices.txt` | **Synthetic**, written by `scripts/make-share-prices.mjs` (seeded, reproducible): 344 share-price questions and sell requests for 8 FTSE companies, each followed by a tool token (`$price-tsco`, `$sell-bp`) and a `NUM` placeholder, with 24 deliberately wrong-ticker lines. Synthetic because no real text pairs questions with tool calls; it exists only to demonstrate the harness. Prices are fake | Part of this project (CC BY-NC 4.0) |
| `sherlock-holmes.txt` | *The Adventures of Sherlock Holmes*, Arthur Conan Doyle — [Project Gutenberg #1661](https://www.gutenberg.org/ebooks/1661) | Public domain (US) |
| `tinystories.txt` | First ~3 MB (3,934 whole stories) of `TinyStoriesV2-GPT4-valid.txt` from [TinyStories](https://huggingface.co/datasets/roneneldan/TinyStories), Eldan & Li, 2023 | [CDLA-Sharing-1.0](https://cdla.dev/sharing-1-0/) |
| `wikitext-2.txt` | `wiki.train.raw` from [WikiText-2 (raw)](https://huggingface.co/datasets/Salesforce/wikitext), Merity et al., 2016, text from Wikipedia | [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/) |

Gutenberg files still carry the Project Gutenberg licence header/footer, so they are redistributed under it;
`stripGutenberg()` removes it and every Project Gutenberg reference before the text is used.
