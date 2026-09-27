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

// categorical slots 1-7 of the dataviz reference palette, validated for colour-blind separation
export const POS_COLOURS = {
  noun: '#2a78d6',
  verb: '#eb6834',
  adjective: '#1baf7a',
  adverb: '#eda100',
  pronoun: '#e87ba4',
  name: '#008300',
  'function word': '#4a3aa7',
};
