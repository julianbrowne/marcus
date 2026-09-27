// Part-of-speech groups for the word map and corpus profile, in legend order.
// Shared by the app and scripts/profile.js (which maps Universal POS tags to them).

export const POS_GROUPS = {
  noun: ['NOUN'],
  verb: ['VERB', 'AUX'],
  adjective: ['ADJ'],
  adverb: ['ADV'],
  pronoun: ['PRON'],
  name: ['PROPN'],
  'function word': ['DET', 'ADP', 'CCONJ', 'SCONJ', 'PART', 'NUM', 'INTJ', 'SYM', 'X'],
};

// colours are CSS tokens (--pos-noun etc. in index.css) so they follow light/dark mode
export const posColour = (pos) => (pos ? `var(--pos-${pos.replace(' ', '-')})` : 'var(--muted-foreground)');
