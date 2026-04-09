import type { HexCoord, HexDirection } from "../types.ts";

/** Direction offsets in axial coordinates (flat-top hex orientation) */
const DIRECTION_OFFSETS: Record<HexDirection, HexCoord> = {
	ne: { q: 1, r: -1 },
	e: { q: 1, r: 0 },
	se: { q: 0, r: 1 },
	sw: { q: -1, r: 1 },
	w: { q: -1, r: 0 },
	nw: { q: 0, r: -1 },
} as const;

/** Canonical processing order for hex directions */
export const HEX_DIRECTIONS: readonly HexDirection[] = ["ne", "e", "se", "sw", "w", "nw"] as const;

/** Serialize a HexCoord to a string key for use in Maps */
export function hexKey(coord: HexCoord): string {
	return `${coord.q},${coord.r}`;
}

/** Deserialize a string key back to a HexCoord */
export function hexFromKey(key: string): HexCoord {
	const parts = key.split(",");
	const qStr = parts[0];
	const rStr = parts[1];
	if (qStr === undefined || rStr === undefined) {
		throw new Error(`Invalid hex key: ${key}`);
	}
	const q = Number.parseInt(qStr, 10);
	const r = Number.parseInt(rStr, 10);
	if (Number.isNaN(q) || Number.isNaN(r)) {
		throw new Error(`Invalid hex key: ${key}`);
	}
	return { q, r };
}

/** Get the neighbor of a hex in the given direction */
export function hexNeighbor(coord: HexCoord, direction: HexDirection): HexCoord {
	const offset = DIRECTION_OFFSETS[direction];
	return { q: coord.q + offset.q, r: coord.r + offset.r };
}

/** Get all 6 neighbors of a hex */
export function hexNeighbors(coord: HexCoord): readonly HexCoord[] {
	return HEX_DIRECTIONS.map((dir) => hexNeighbor(coord, dir));
}

/** Calculate the hex distance between two coordinates (cube distance formula) */
export function hexDistance(a: HexCoord, b: HexCoord): number {
	const dq = a.q - b.q;
	const dr = a.r - b.r;
	const ds = -dq - dr;
	return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

/**
 * Ring walk directions: starting from SW*radius, walk E→NE→NW→W→SW→SE
 * to trace the hexagonal ring counterclockwise.
 */
const RING_WALK_DIRECTIONS: readonly HexDirection[] = ["e", "ne", "nw", "w", "sw", "se"];

/** Get all coordinates at exactly the given distance from center */
export function hexRing(center: HexCoord, radius: number): readonly HexCoord[] {
	if (radius === 0) {
		return [center];
	}

	const results: HexCoord[] = [];
	// Start at center + SW * radius
	let current: HexCoord = { q: center.q - radius, r: center.r + radius };

	// Walk around the ring in 6 segments
	for (const dir of RING_WALK_DIRECTIONS) {
		for (let step = 0; step < radius; step++) {
			results.push(current);
			current = hexNeighbor(current, dir);
		}
	}

	return results;
}

/** Get all coordinates within the given radius (inclusive), spiraling outward */
export function hexSpiral(center: HexCoord, radius: number): readonly HexCoord[] {
	const results: HexCoord[] = [center];
	for (let r = 1; r <= radius; r++) {
		for (const coord of hexRing(center, r)) {
			results.push(coord);
		}
	}
	return results;
}

/** Get the opposite direction */
export function oppositeDirection(dir: HexDirection): HexDirection {
	const opposites: Record<HexDirection, HexDirection> = {
		ne: "sw",
		e: "w",
		se: "nw",
		sw: "ne",
		w: "e",
		nw: "se",
	};
	return opposites[dir];
}
