export function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export const syntheticNim = (serial: number, prefix = '990') => `${prefix}${String(serial).padStart(8, '0')}`;

export const syntheticName = (serial: number) => `Mahasiswa Uji ${String(serial).padStart(3, '0')}`;
