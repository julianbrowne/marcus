
function Markov(corpus) { 

    this.corpus = corpus;

    this.chain = {};
    this.startWords = {};
    this.endWords = {};

    this.ngramSize = 1;
    this.minWordsInSentence = 8;
    this.minSentences = 5;

    /**
     * Add this-word/next-word link to chain, either by 
     * adding it as another link to an existing this-word
     * entry or by adding this-word and the link to next-word
    **/

    this.addWordToChain = function(word, next) { 
        if(this.chain.hasOwnProperty(word)) { 
            this.chain[word].push(next);
        }
        else { 
            this.chain[word] = [next];
        }
    };

    this.buildChain = function() { 

        // split corpus on newline or end of sentence ('.')
        const lines = this.corpus.split(/(?<=\.)|\r?\n/);

        for(let i=0; i<lines.length; i++) { 

            const line = lines[i];

            if(line.length===0) { 
                continue;
            }

            const words = line.trim().split(/\s+/);

            if(words.length === 0) { 
                continue;
            }

            const firstWord = words[0];
            const lastWord = words[words.length - 1];

            if(!this.startWords.hasOwnProperty(firstWord)) { 
                this.startWords[firstWord] = true;
            }

            if(!this.endWords.hasOwnProperty(lastWord)) { 
                this.endWords[lastWord] = true;
            }

            for(let j=0; j<words.length; j++) { 

                const thisWord = words[j];

                const nextWordOrWords = words.slice(j+1, j+1+this.ngramSize).join(' ');

                if(nextWordOrWords !== undefined) { 
                    this.addWordToChain(thisWord, nextWordOrWords);
                }

            }
        };

    };

    /**
     * Pick a random element from an array or object
    **/

    function randomWordFromList(objectOrArray) { 

        let options = [];

        if(objectOrArray.constructor === Object) { 
            options = Object.keys(objectOrArray);
        }
        else { 
            options = objectOrArray;
        }
        
        const randomPosition = Math.floor(options.length * Math.random());

        return options[randomPosition];
    };

    this.setNgrams = function(n) { 
        this.ngramSize = n;
    };

    this.setMinWords = function(n) { 
        this.minWordsInSentence = n;
    };

    this.setMinSentences = function(n) { 
        this.minSentences = n;
    };

    /**
     * Generate a number of sentences
    **/

    this.generate = function() { 

        let paragraph = "";

        for(let i=0; i<this.minSentences; i++) { 
            let s = this.sentence();
            if(s!=="") { 
                s = s.charAt(0).toUpperCase() + s.slice(1);
                paragraph += s.trim();
                paragraph += ". ";
            };
        };

        return paragraph;

    };

    /**
     * Generate a single sentences
    **/

    this.sentence = function() { 

        let word = randomWordFromList(this.startWords);

        const sentence = [word];

        while(this.chain.hasOwnProperty(word)) { 

            const nextWordOptions = this.chain[word];

            const wordOrWords = randomWordFromList(nextWordOptions);

            const wordOrWordsList = wordOrWords.split(' ');

            for(let w=0; w<wordOrWordsList.length; w++) { 
                sentence.push(wordOrWordsList[w]);
            };

            const lastWordinSegment = wordOrWordsList[wordOrWordsList.length - 1];

            word = lastWordinSegment;

            if(sentence.length > this.minWordsInSentence && this.endWords.hasOwnProperty(word)) { 
                break;
            }
        }

        return sentence.join(' ');

    };

};

export {Markov};
