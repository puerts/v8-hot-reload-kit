setInterval(function(){
	$('body').empty().append(
		$('<span/>').text(text())
	);
}, 100);

function text(){
	return 'current time is ' + new Date().getTime();
}