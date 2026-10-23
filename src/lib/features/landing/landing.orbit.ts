export const orbitView = 640;
export const orbitCenter = orbitView / 2;
export const orbitRadius = 210;
export const nodeRadius = 66;
export const hubRadius = 92;
export const nodePadding = 12;

export const orbitNodeIds = ['mk', 'cpmk', 'cpl', 'cqi'] as const;

export type OrbitNodeId = (typeof orbitNodeIds)[number];

export type OrbitNode = { id: OrbitNodeId; index: number; angle: number; x: number; y: number; leftPercent: number; topPercent: number; sizePercent: number };

export type OrbitArc = {
	from: OrbitNodeId;
	to: OrbitNodeId;
	index: number;
	path: string;
	arrow: { x: number; y: number; rotate: number };
	feedback: boolean;
};

export type OrbitLayout = {
	nodes: OrbitNode[];
	arcs: OrbitArc[];
	fullCircle: string;
	hubSizePercent: number;
	feedbackLabel: { leftPercent: number; topPercent: number };
	gapDegrees: number;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const round = (value: number) => Math.round(value * 100) / 100;
const pointAt = (angle: number, radius: number) => ({ x: orbitCenter + radius * Math.cos(toRadians(angle)), y: orbitCenter + radius * Math.sin(toRadians(angle)) });
const percent = (value: number) => round((value / orbitView) * 100);

export const nodeGapDegrees = round((2 * Math.asin((nodeRadius + nodePadding) / (2 * orbitRadius)) * 180) / Math.PI);

export function buildOrbit(ids: readonly OrbitNodeId[] = orbitNodeIds): OrbitLayout {
	const step = 360 / ids.length;
	const startAngle = -90;
	const nodes: OrbitNode[] = ids.map((id, index) => {
		const angle = startAngle + index * step;
		const point = pointAt(angle, orbitRadius);
		return { id, index, angle, x: round(point.x), y: round(point.y), leftPercent: percent(point.x), topPercent: percent(point.y), sizePercent: percent(nodeRadius * 2) };
	});

	const arcs: OrbitArc[] = nodes.map((node, index) => {
		const from = pointAt(node.angle + nodeGapDegrees, orbitRadius);
		const to = pointAt(node.angle + step - nodeGapDegrees, orbitRadius);
		const middleAngle = node.angle + step / 2;
		const middle = pointAt(middleAngle, orbitRadius);
		return {
			from: node.id,
			to: nodes[(index + 1) % nodes.length].id,
			index,
			path: `M ${round(from.x)} ${round(from.y)} A ${orbitRadius} ${orbitRadius} 0 0 1 ${round(to.x)} ${round(to.y)}`,
			arrow: { x: round(middle.x), y: round(middle.y), rotate: round(middleAngle + 90) },
			feedback: index === nodes.length - 1
		};
	});

	const top = orbitCenter - orbitRadius;
	const bottom = orbitCenter + orbitRadius;
	const feedbackPoint = pointAt(startAngle + (nodes.length - 0.5) * step, orbitRadius - 52);

	return {
		nodes,
		arcs,
		fullCircle: `M ${orbitCenter} ${top} A ${orbitRadius} ${orbitRadius} 0 1 1 ${orbitCenter} ${bottom} A ${orbitRadius} ${orbitRadius} 0 1 1 ${orbitCenter} ${top}`,
		hubSizePercent: percent(hubRadius * 2),
		feedbackLabel: { leftPercent: percent(feedbackPoint.x), topPercent: percent(feedbackPoint.y) },
		gapDegrees: nodeGapDegrees
	};
}
