export function focusableWhenScrollable(node: HTMLElement) {
	const update = () => {
		const scrolls = node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight;
		if (scrolls) node.tabIndex = 0;
		else node.removeAttribute('tabindex');
	};
	const observer = new ResizeObserver(update);
	observer.observe(node);
	for (const child of Array.from(node.children)) observer.observe(child);
	update();
	return {
		destroy() {
			observer.disconnect();
		}
	};
}
