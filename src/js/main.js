
/* eslint-disable no-unused-vars */
import "../scss/style.scss";
import * as bootstrap from "bootstrap";
import "../css/style.css";
/* eslint-enable no-unused-vars */

import * as dom from "./dom";

import txt from "../txt/grimm.txt";
// import txt from "../txt/proverbs.txt";
// import txt from "../txt/tiny-shakespeare.txt";
// import txt from "../txt/trump.txt";

import {Markov} from "./Markov";

$(function() { 

	const marcus = new Markov(txt);

	marcus.setMinWords(10);
	marcus.setMinSentences(5);

	$("#generate").on("click", function() { 
		const text = marcus.generate();
		dom.console(text);
	});

});
