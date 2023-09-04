
function console(text) { 
	const para = $("<p>").text(text);
	$("#console").append(para);
};

export {console};
