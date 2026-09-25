
# Marcus

A Markov Chain explorer.

An order-n Markov chain: each next word is sampled from what followed the last *n* words (the "context words" setting, 1-10) in the source text. Small *n* gives novel but rambling text; large *n* gives fluent text that is increasingly copied verbatim from the source (on Pride and Prejudice, ~0% of sentences at n=2, ~70% at n=4, ~98% at n=6), a small-scale version of an LLM's context window and memorisation.

See here: https://julianbrowne.github.io/marcus/

## TLDR

```
npm install
npm run dev     # open the printed URL and click "generate"
npm test        # run tests
npm run build   # static build in dist/
```

## Source Material

Found in `src/corpus` and picked at runtime. Drop any `.txt` file in there to add your own.

Every corpus is cleaned at load time by `src/textprep.js` (one sentence per line, typography normalised, quotes/punctuation/stutters removed). Use the **view** button next to the corpus picker to see the cleaned text.

`proverbs.txt` - a long list of common english proverbs

`tiny-shakespeare.txt` - the classic Shakespeare training set

`trump.txt` - Trump Speeches

`grimm.txt` - Brother's Grimm Fairy Tales

`BattleCreekDec19_2019.txt` - a single raw, unprocessed speech transcript

General-purpose texts for testing clustering (sources and licences in [`src/corpus/SOURCES.md`](src/corpus/SOURCES.md)):

`aesop.txt`, `alice.txt`, `pride-and-prejudice.txt`, `sherlock-holmes.txt` - public domain books from Project Gutenberg

`gutenberg.txt` - ~50 MB: 67 popular public domain books from Project Gutenberg in one file. Recreate or resize with `node scripts/fetch-gutenberg.mjs [count]` (it waits 2s between downloads, per Gutenberg's robot policy)

`tinystories.txt` - ~3 MB of simple-vocabulary children's stories (CDLA-Sharing-1.0)

`wikitext-2.txt` - the WikiText-2 language-modelling benchmark, from Wikipedia (CC BY-SA)

## Deployment

Pushing to `master` runs `.github/workflows/pages.yml`, which tests, builds and publishes `dist/` to GitHub Pages. One-off setup: in the repo's Settings -> Pages, set the source to "GitHub Actions". The build uses relative paths, so the same `dist/` works locally (`npm run preview`) and under `/marcus/` on Pages.

## License

[CC BY-NC 4.0](LICENSE): free to use, modify and share for non-commercial purposes, with credit to [Marcus by Julian Browne](https://github.com/julianbrowne/marcus). The text corpora in `src/corpus` have their own licences; see [SOURCES.md](src/corpus/SOURCES.md).
