export type MarkBinding = {
	role: 'button';
	tabindex: 0;
	onpointerenter: () => void;
	onpointerleave: () => void;
	onfocus: () => void;
	onblur: () => void;
	onclick: () => void;
	onkeydown: (event: KeyboardEvent) => void;
};

export function markBinding<K>(set: (key: K | null) => void, key: K): MarkBinding {
	const select = () => set(key);
	return {
		role: 'button',
		tabindex: 0,
		onpointerenter: select,
		onpointerleave: () => set(null),
		onfocus: select,
		onblur: () => set(null),
		onclick: select,
		onkeydown: (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			select();
		}
	};
}
