export const dotStageCount = 4;

export type DotFormations = {
	count: number;
	columns: number;
	rows: number;
	stages: [Float32Array, Float32Array, Float32Array, Float32Array];
	seeds: Float32Array;
};

export function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
	};
}

export function dotGridSize(width: number, height: number, spacing = 24): { columns: number; rows: number } {
	const clamp = (value: number) => Math.min(96, Math.max(18, Math.round(value)));
	return { columns: clamp(width / spacing), rows: clamp(height / spacing) };
}

const clusterCenters = (columns: number, rows: number, scale: number) => {
	const centers: [number, number][] = [];
	for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) centers.push([((column + 0.5) / columns - 0.5) * 2 * scale, ((row + 0.5) / rows - 0.5) * 2 * scale]);
	return centers;
};

const ringCenters = (count: number, radius: number) =>
	Array.from({ length: count }, (_, index) => {
		const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
		return [Math.cos(angle) * radius, Math.sin(angle) * radius] as [number, number];
	});

function gaussian(random: () => number): number {
	const u = Math.max(random(), 1e-6);
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * random());
}

export function buildFormations(columns: number, rows: number, seed = 20260101): DotFormations {
	const count = columns * rows;
	const random = seededRandom(seed);
	const grid = new Float32Array(count * 3);
	const clusters = new Float32Array(count * 3);
	const ring = new Float32Array(count * 3);
	const loop = new Float32Array(count * 3);
	const seeds = new Float32Array(count);

	const groupCenters = clusterCenters(4, 3, 0.62);
	const cplCenters = ringCenters(8, 0.62);

	for (let index = 0; index < count; index++) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const o = index * 3;
		seeds[index] = random();

		grid[o] = (column / (columns - 1)) * 2 - 1;
		grid[o + 1] = (row / (rows - 1)) * 2 - 1;
		grid[o + 2] = 0;

		const group = groupCenters[Math.floor(random() * groupCenters.length)];
		clusters[o] = group[0] + gaussian(random) * 0.075;
		clusters[o + 1] = group[1] + gaussian(random) * 0.075;
		clusters[o + 2] = gaussian(random) * 0.04;

		const cpl = cplCenters[Math.floor(random() * cplCenters.length)];
		ring[o] = cpl[0] + gaussian(random) * 0.07;
		ring[o + 1] = cpl[1] + gaussian(random) * 0.07;
		ring[o + 2] = gaussian(random) * 0.05;

		const angle = (index / count) * Math.PI * 2;
		const tube = 0.62 + gaussian(random) * 0.035;
		loop[o] = Math.cos(angle) * tube;
		loop[o + 1] = Math.sin(angle) * tube;
		loop[o + 2] = gaussian(random) * 0.05;
	}

	return { count, columns, rows, stages: [grid, clusters, ring, loop], seeds };
}
