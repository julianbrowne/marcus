
function Markov(corpus) { 

    this.corpus = corpus;
    // console.log(this.corpus);

    this.chain = {};
    this.startWords = {};
    this.endWords = {};

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

        const lines = this.corpus.split('\n');

        for(let i=0; i<lines.length; i++) { 

            const line = lines[i];

            if(line.length===0) { 
                continue;
            }

            const words = line.split(/\s+/);

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
                const nextWord = words[j+1];

                if(nextWord !== undefined) { 
                    this.addWordToChain(thisWord, nextWord);
                }

            }
        }
    };

    this.buildChain();
    // console.log(this.startWords);
    // console.log(this.endWords);
    console.log(this.chain);

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
            s = s.charAt(0).toUpperCase() + s.slice(1);
            paragraph += s;
            paragraph += ". ";
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
            word = randomWordFromList(nextWordOptions);
            sentence.push(word);
            if(sentence.length > this.minWordsInSentence && this.endWords.hasOwnProperty(word)) { 
                break;
            }
        }

        return sentence.join(' ');

    };

};

export {Markov};
