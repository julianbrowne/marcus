
# Marcus

Marcus is a Markov Chain explorer.

An order-n Markov chain: each next word is sampled from what followed the last *n* words (the "context words" setting, 1-10) in the source text. Small *n* gives novel but rambling text; large *n* gives fluent text that is increasingly copied verbatim from the source (on Pride and Prejudice, ~0% of sentences at n=2, ~70% at n=4, ~98% at n=6), a small-scale version of an LLM's context window and memorisation.

See here: https://julianbrowne.github.io/marcus/

## TLDR

```
npm install
npm run dev     # open the printed URL and click "generate"
npm run lint    # ESLint (also runs first in npm test)
npm test        # run tests (in test/); also writes an HTML report to public/tests/index.html
npm run build   # static build in dist/
```

## Source Material

Raw source files live in `src/corpus/raw`. Drop any `.txt` file in there to add your own.

At build time (and before `npm run dev` / `npm test`), `scripts/prepare-corpora.mjs` turns each raw file into:

- `src/corpus/clean/<name>.txt`: one clean sentence per line (via `src/textprep.js`), which is what the Markov chain reads
- `src/corpus/profile/<name>.json`: a corpus profile from [wink-nlp](https://github.com/winkjs/wink-nlp) (readability, parts of speech, tone and its arc across the text, common and distinctive words, key sentences, numbers and dates) plus the word map, with each word's part of speech
- `src/corpus/cache/<name>.json`: build-only content-word counts; distinctive words (BM25) compare every corpus with the others, so they're scored in a final pass over these

In the app, **ask** (next to raw, clean and profile) takes a question such as "what is the capital of france", drops stopwords, weights the remaining words by rarity and averages their vectors from a word space built at build time (PPMI over a +/-4 word window, reduced with PCA; `src/corpus/space/<name>.json`). It is offered only for the synthetic `geography` corpus, which is built for it; the other corpora aren't structured for this kind of retrieval. It lists the 10 nearest words by cosine, maps them with the question, and does analogies (paris - france + italy). This is similarity retrieval over word co-occurrence, not how an LLM generates an answer.

**ask > instruction** (select the geography corpus, then ask) shows why "make no mistakes" is not a directive: each word's weight in the averaged vector, the nearest words, and the cosine similarity with a comparison phrase ("make mistakes": 0.959 on the 67 books), with both points on the map. It uses the gutenberg-67-books space, which keeps 8,000 words so that mistakes, error and correct are included. An optional **Instruction** in the sidebar is placed before each generated or navigated sentence; the navigator marks which words are inside the n-word context window and shows that once the instruction slides out, the next-word options are identical with or without it. If the corpus never saw a context, the chain backs off to its longest seen tail.

**The harness** shows that agent actions are ordinary code reacting to predicted words. When the chain emits a word starting with `$` (e.g. `$price-tsco`), a small harness (`src/harness.js`) intercepts it, looks the tool up in a hard-coded registry of fake tools, and fills the `NUM` placeholders that follow with the result, shown apart from the chain's own words in both the generator and the navigator. The fake sell tool is refused unless **allow the sell tool** is ticked; unknown tools fail with an error. With the `share-prices` corpus, low orders often call the wrong ticker (the chain sees only "share price", not the company) and higher orders mostly don't.

In the app, **navigate** (next to graph and table) walks the chain by hand: pick a sentence starter, or type words to start mid-sentence, then pick each next word from those that followed the same context in the corpus, with the context words highlighted, until the sentence ends.

In the app, **analyse** (in the Generated text card) loads wink-nlp on demand and measures the generated text the same way, one column per context length, beside the corpus's own figures.

These folders are generated (and git-ignored); a corpus is only re-prepared when its raw file or the preparation code changes. `npm run corpora -- --force` rebuilds everything. In the app, the corpus **view** menu shows the raw text, the clean text and the profile.

`proverbs.txt` - a long list of common english proverbs

`tiny-shakespeare.txt` - the classic Shakespeare training set

`trump-speeches.txt` - Trump speeches

`grimm.txt` - Brother's Grimm Fairy Tales

`BattleCreekDec19_2019.txt` - a single raw, unprocessed speech transcript

General-purpose texts for testing clustering (sources and licences in [SOURCES.md](SOURCES.md)):

`aesop.txt`, `alice.txt`, `pride-and-prejudice.txt`, `sherlock-holmes.txt` - public domain books from Project Gutenberg

`geography.txt` - **synthetic** (see `scripts/make-geography.mjs`): factual sentences about 74 countries and their capitals, structured so that the ask feature answers every "capital of X" question and analogy. Made up because real text lacks the consistent structure this retrieval method needs

`moby-dick.txt` - *Moby Dick* by Herman Melville, from Project Gutenberg

`gutenberg-67-books.txt` - ~50 MB: 67 popular public domain books from Project Gutenberg in one file (Moby Dick is the first), for trying a really big corpus. Recreate or resize with `node scripts/fetch-gutenberg.mjs [count]` (writes `src/corpus/raw/gutenberg-67-books.txt`; it waits 2s between downloads, per Gutenberg's robot policy)

`share-prices.txt` - **synthetic** (see `scripts/make-share-prices.mjs`): share-price questions followed by tool tokens such as `$price-tsco`, for the harness demo. Made up because no real text pairs questions with tool calls

`tinystories.txt` - ~3 MB of simple-vocabulary children's stories (CDLA-Sharing-1.0)


## Tests

Linting uses ESLint 10 (`eslint.config.js`): the recommended rules plus React Hooks and React Refresh checks. `npm test` lints first, so a lint error fails the tests and blocks a deploy.

Tests live in `test/` and run with [Vitest](https://vitest.dev). Unit tests read fixed copies of their texts from `test/fixtures/`, and the app tests derive the corpus list from `src/corpus/raw` (naming only `proverbs` and `pride-and-prejudice`), so corpora can be edited, added or removed without breaking the tests. Each run writes a self-contained HTML report to `public/tests/index.html` (git-ignored); the build publishes it and the app links to it from the bottom of the sidebar ("Test report"). The deploy workflow runs the tests before building, so the published report is always from the run that produced that deployment.

## Deployment

Pushing to `master` runs `.github/workflows/pages.yml`, which tests, builds and publishes `dist/` to GitHub Pages. One-off setup: in the repo's Settings -> Pages, set the source to "GitHub Actions". The build uses relative paths, so the same `dist/` works locally (`npm run preview`) and under `/marcus/` on Pages.

## License

[CC BY-NC 4.0](LICENSE): free to use, modify and share for non-commercial purposes, with credit to [Marcus by Julian Browne](https://github.com/julianbrowne/marcus). Everything else Marcus uses (text corpora, packages, design, font, icons and references) keeps its own licence and is credited in [SOURCES.md](SOURCES.md).
