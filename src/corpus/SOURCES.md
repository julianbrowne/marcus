# Corpus sources

Raw files are kept as downloaded (apart from trimming) and cleaned at load time by `src/textprep.js`.

| File | Source | Licence |
|---|---|---|
| `aesop.txt` | *Three Hundred Aesop's Fables*, tr. George Fyler Townsend — [Project Gutenberg #21](https://www.gutenberg.org/ebooks/21) | Public domain (US) |
| `gutenberg.txt` | 67 books from the Project Gutenberg "Top 100 EBooks last 30 days" list (September 2026), downloaded by `scripts/fetch-gutenberg.mjs`, which lists each book | Public domain (US and UK: every author/translator died by 1955) |
| `alice.txt` | *Alice's Adventures in Wonderland*, Lewis Carroll — [Project Gutenberg #11](https://www.gutenberg.org/ebooks/11) | Public domain (US) |
| `pride-and-prejudice.txt` | *Pride and Prejudice*, Jane Austen — [Project Gutenberg #1342](https://www.gutenberg.org/ebooks/1342) | Public domain (US) |
| `sherlock-holmes.txt` | *The Adventures of Sherlock Holmes*, Arthur Conan Doyle — [Project Gutenberg #1661](https://www.gutenberg.org/ebooks/1661) | Public domain (US) |
| `tinystories.txt` | First ~3 MB (3,934 whole stories) of `TinyStoriesV2-GPT4-valid.txt` from [TinyStories](https://huggingface.co/datasets/roneneldan/TinyStories), Eldan & Li, 2023 | [CDLA-Sharing-1.0](https://cdla.dev/sharing-1-0/) |
| `wikitext-2.txt` | `wiki.train.raw` from [WikiText-2 (raw)](https://huggingface.co/datasets/Salesforce/wikitext), Merity et al., 2016, text from Wikipedia | [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/) |

Gutenberg files still carry the Project Gutenberg licence header/footer, so they are redistributed under it;
`stripGutenberg()` removes it and every Project Gutenberg reference before the text is used.
