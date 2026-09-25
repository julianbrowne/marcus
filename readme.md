
# Marcus

Simple example of markov chain generation

See here: https://julianbrowne.github.io/marcus/test/

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
