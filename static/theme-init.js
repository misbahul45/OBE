(function () {
	var stored = null;
	try {
		stored = localStorage.getItem('obe-theme');
	} catch (error) {
		stored = null;
	}
	var dark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	var root = document.documentElement;
	root.classList.toggle('dark', dark);
	root.style.colorScheme = dark ? 'dark' : 'light';
})();
