import {
	HEX_DIRECTIONS,
	hexDistance,
	hexFromKey,
	hexKey,
	hexNeighbors,
	hexSpiral,
} from "../hex/coordinates.ts";
import type {
	HexCoord,
	HexDirection,
	LevelDefinition,
	ResourceType,
	StructureKind,
	TerrainType,
	TileContentDefinition,
	TileDefinition,
} from "../types.ts";
import { createRng } from "./random.ts";
import type { Rng } from "./random.ts";

// ── Public types ────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard";

export interface GeneratorOptions {
	readonly radius: number;
	readonly difficulty: Difficulty;
	readonly seed: number;
	readonly name: string;
}

/** Type guard for Difficulty */
export function isDifficulty(value: string): value is Difficulty {
	return value === "easy" || value === "medium" || value === "hard";
}

// ── Difficulty parameters ───────────────────────────────────────────

interface DifficultyParams {
	readonly sourceCount: readonly [number, number];
	readonly resourceCount: readonly [number, number];
	readonly flowRate: readonly [number, number];
	readonly sourceDuration: readonly [number, number];
	readonly simulationDuration: number;
	readonly budgetMultiplier: number;
	readonly parBudgetRatio: number;
	readonly availableStructures: readonly StructureKind[];
	readonly resourceTypes: readonly ResourceType[];
	readonly elevationSlope: number;
	readonly noiseAmplitude: number;
	readonly damageThreshold: readonly [number, number];
	readonly resourceValue: readonly [number, number];
}

const DIFFICULTY_PARAMS: Record<Difficulty, DifficultyParams> = {
	easy: {
		sourceCount: [1, 1],
		resourceCount: [1, 2],
		flowRate: [25, 40],
		sourceDuration: [8, 12],
		simulationDuration: 12,
		budgetMultiplier: 2.0,
		parBudgetRatio: 0.6,
		availableStructures: ["dam", "absorption_basin"],
		resourceTypes: ["village", "farmland"],
		elevationSlope: 4,
		noiseAmplitude: 1,
		damageThreshold: [80, 150],
		resourceValue: [50, 100],
	},
	medium: {
		sourceCount: [1, 2],
		resourceCount: [2, 3],
		flowRate: [35, 55],
		sourceDuration: [10, 16],
		simulationDuration: 16,
		budgetMultiplier: 1.5,
		parBudgetRatio: 0.5,
		availableStructures: ["dam", "splitter", "absorption_basin", "drainage_channel"],
		resourceTypes: ["village", "bridge", "farmland", "road"],
		elevationSlope: 5,
		noiseAmplitude: 2,
		damageThreshold: [60, 120],
		resourceValue: [50, 150],
	},
	hard: {
		sourceCount: [2, 3],
		resourceCount: [3, 5],
		flowRate: [50, 80],
		sourceDuration: [12, 20],
		simulationDuration: 20,
		budgetMultiplier: 1.0,
		parBudgetRatio: 0.4,
		availableStructures: ["dam", "splitter", "drainage_channel", "absorption_basin", "levee"],
		resourceTypes: ["village", "bridge", "train_line", "farmland", "road"],
		elevationSlope: 6,
		noiseAmplitude: 2,
		damageThreshold: [40, 80],
		resourceValue: [75, 200],
	},
};

// ── Resource name pools ─────────────────────────────────────────────

const RESOURCE_NAMES: Record<ResourceType, readonly string[]> = {
	village: [
		"Mountain Village",
		"Hillside Hamlet",
		"Valley Settlement",
		"River Town",
		"Highland Camp",
		"Slope Haven",
		"Crest Village",
		"Basin Town",
	],
	bridge: [
		"Stone Bridge",
		"River Crossing",
		"Timber Bridge",
		"Valley Bridge",
		"Mountain Arch",
		"Iron Span",
	],
	train_line: [
		"Mountain Railway",
		"Valley Express",
		"Highland Rail",
		"Pass Rail Line",
		"Summit Track",
	],
	farmland: [
		"Terraced Fields",
		"Valley Farm",
		"Highland Pasture",
		"River Meadow",
		"Hillside Orchard",
		"Slope Vineyard",
	],
	road: [
		"Mountain Road",
		"Valley Highway",
		"Ridge Path",
		"Pass Road",
		"Cliff Trail",
		"Summit Route",
	],
};

// ── Direction vectors for gradient computation ──────────────────────

const DIRECTION_VECTORS: Record<HexDirection, readonly [number, number]> = {
	ne: [1, -1],
	e: [1, 0],
	se: [0, 1],
	sw: [-1, 1],
	w: [-1, 0],
	nw: [0, -1],
};

// ── Main generator ──────────────────────────────────────────────────

/** Generate a random puzzle level from the given options */
export function generatePuzzle(options: GeneratorOptions): LevelDefinition {
	const rng = createRng(options.seed);
	const params = DIFFICULTY_PARAMS[options.difficulty];
	const center: HexCoord = { q: 0, r: 0 };

	// 1. Generate hex coordinates
	const coords = hexSpiral(center, options.radius);

	// 2. Pick gradient direction and compute elevations
	const peakDirection = rng.pick(HEX_DIRECTIONS);
	const elevations = computeElevations(coords, peakDirection, params, rng);

	// 3. Sort coords by elevation (highest first) for percentile-based placement
	const sortedCoords = [...coords].sort((a, b) => {
		const elevA = elevations.get(hexKey(a)) ?? 0;
		const elevB = elevations.get(hexKey(b)) ?? 0;
		return elevB - elevA;
	});

	// 4. Pick source positions (high elevation)
	const sourceCount = rng.nextInt(params.sourceCount[0], params.sourceCount[1]);
	const sourceKeys = pickSourcePositions(sortedCoords, sourceCount, rng);

	// 5. Find tiles reachable by downhill flow from sources
	const reachable = findReachableTiles(sourceKeys, elevations, coords);

	// 6. Find local minima where water accumulates (flow can't go further downhill)
	const minima = findLocalMinima(coords, elevations);

	// 7. Pick resource positions — prefer reachable local minima (water pools there)
	const resourceCount = rng.nextInt(params.resourceCount[0], params.resourceCount[1]);
	const resourceKeys = pickResourcePositions(
		sortedCoords,
		resourceCount,
		sourceKeys,
		reachable,
		minima,
		rng,
	);

	// 8. Assign terrain types based on elevation percentile
	const terrains = assignTerrains(coords, elevations);

	// 8. Build tile definitions
	const tiles = buildTileDefinitions(
		coords,
		elevations,
		terrains,
		sourceKeys,
		resourceKeys,
		params,
		rng,
	);

	// 9. Calculate budget
	const budget = computeBudget(tiles, resourceKeys.size, params);
	const parBudget = Math.max(5, Math.round(budget * params.parBudgetRatio));

	// 10. Build the level
	const id = generateId(options.name, options.seed);
	const description = generateDescription(options, sourceKeys.size, resourceKeys.size);

	return {
		id,
		name: options.name,
		description,
		gridRadius: options.radius,
		tiles,
		budget,
		availableStructures: [...params.availableStructures],
		simulationDuration: params.simulationDuration,
		parBudget,
	};
}

// ── Internal helpers ────────────────────────────────────────────────

function computeElevations(
	coords: readonly HexCoord[],
	peakDirection: HexDirection,
	params: DifficultyParams,
	rng: Rng,
): ReadonlyMap<string, number> {
	const [dq, dr] = DIRECTION_VECTORS[peakDirection];
	const baseElevation = 15;
	const elevations = new Map<string, number>();

	for (const coord of coords) {
		const alignment = coord.q * dq + coord.r * dr;
		const noise = rng.nextFloat(-params.noiseAmplitude, params.noiseAmplitude);
		const elevation = Math.max(
			1,
			Math.round(baseElevation + alignment * params.elevationSlope + noise),
		);
		elevations.set(hexKey(coord), elevation);
	}

	return elevations;
}

function pickSourcePositions(
	sortedByElevation: readonly HexCoord[],
	count: number,
	rng: Rng,
): ReadonlySet<string> {
	const sources = new Set<string>();
	const candidateCount = Math.max(1, Math.floor(sortedByElevation.length * 0.2));
	const candidates = sortedByElevation.slice(0, candidateCount);
	const shuffled = rng.shuffle(candidates);

	// First pass: with spacing constraint (distance >= 2)
	for (const coord of shuffled) {
		if (sources.size >= count) break;
		if (!hasMinDistance(coord, sources, 2)) continue;
		sources.add(hexKey(coord));
	}

	// Fallback: relax spacing if we didn't get enough
	if (sources.size < count) {
		for (const coord of shuffled) {
			if (sources.size >= count) break;
			const key = hexKey(coord);
			if (!sources.has(key)) {
				sources.add(key);
			}
		}
	}

	return sources;
}

function findReachableTiles(
	sourceKeys: ReadonlySet<string>,
	elevations: ReadonlyMap<string, number>,
	coords: readonly HexCoord[],
): ReadonlySet<string> {
	const coordMap = new Map<string, HexCoord>();
	for (const c of coords) {
		coordMap.set(hexKey(c), c);
	}

	const reachable = new Set<string>();
	const queue: string[] = [];

	for (const key of sourceKeys) {
		reachable.add(key);
		queue.push(key);
	}

	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) break;
		const currentCoord = coordMap.get(current);
		if (currentCoord === undefined) continue;
		const currentElev = elevations.get(current) ?? 0;

		for (const neighbor of hexNeighbors(currentCoord)) {
			const neighborKey = hexKey(neighbor);
			if (reachable.has(neighborKey)) continue;
			const neighborElev = elevations.get(neighborKey);
			if (neighborElev === undefined) continue;
			if (neighborElev < currentElev) {
				reachable.add(neighborKey);
				queue.push(neighborKey);
			}
		}
	}

	return reachable;
}

/** Find tiles that are local minima — no in-grid neighbor has lower elevation.
 *  Water accumulates at these tiles since the flow calculator moves all water downhill. */
function findLocalMinima(
	coords: readonly HexCoord[],
	elevations: ReadonlyMap<string, number>,
): ReadonlySet<string> {
	const gridKeys = new Set<string>();
	for (const c of coords) {
		gridKeys.add(hexKey(c));
	}

	const minima = new Set<string>();
	for (const coord of coords) {
		const key = hexKey(coord);
		const elev = elevations.get(key) ?? 0;
		let isMinimum = true;
		for (const neighbor of hexNeighbors(coord)) {
			const nKey = hexKey(neighbor);
			if (!gridKeys.has(nKey)) continue;
			const nElev = elevations.get(nKey);
			if (nElev !== undefined && nElev < elev) {
				isMinimum = false;
				break;
			}
		}
		if (isMinimum) {
			minima.add(key);
		}
	}
	return minima;
}

function pickResourcePositions(
	sortedByElevation: readonly HexCoord[],
	count: number,
	sourceKeys: ReadonlySet<string>,
	reachable: ReadonlySet<string>,
	minima: ReadonlySet<string>,
	rng: Rng,
): ReadonlySet<string> {
	const resources = new Set<string>();

	// Priority 1: reachable local minima — water actually pools here
	const minimaCoords = sortedByElevation.filter((c) => {
		const key = hexKey(c);
		return minima.has(key) && reachable.has(key) && !sourceKeys.has(key);
	});
	const shuffledMinima = rng.shuffle(minimaCoords);

	for (const coord of shuffledMinima) {
		if (resources.size >= count) break;
		if (hasMinDistance(coord, resources, 2)) {
			resources.add(hexKey(coord));
		}
	}

	// Relax spacing on minima
	if (resources.size < count) {
		for (const coord of shuffledMinima) {
			if (resources.size >= count) break;
			const key = hexKey(coord);
			if (!resources.has(key)) {
				resources.add(key);
			}
		}
	}

	// Priority 2: tiles adjacent to minima (near-minima, water overflows here)
	if (resources.size < count) {
		const nearMinima = sortedByElevation.filter((c) => {
			const key = hexKey(c);
			if (resources.has(key) || sourceKeys.has(key) || !reachable.has(key)) return false;
			return minDistanceToSet(c, minima) <= 1;
		});
		for (const coord of rng.shuffle(nearMinima)) {
			if (resources.size >= count) break;
			const key = hexKey(coord);
			if (!resources.has(key)) {
				resources.add(key);
			}
		}
	}

	// Last resort: any reachable tile
	if (resources.size < count) {
		const fallback = sortedByElevation.filter((c) => {
			const key = hexKey(c);
			return reachable.has(key) && !sourceKeys.has(key) && !resources.has(key);
		});
		for (const coord of rng.shuffle(fallback)) {
			if (resources.size >= count) break;
			resources.add(hexKey(coord));
		}
	}

	return resources;
}

function minDistanceToSet(coord: HexCoord, keys: ReadonlySet<string>): number {
	let min = Number.POSITIVE_INFINITY;
	for (const key of keys) {
		const other = hexFromKey(key);
		const dist = hexDistance(coord, other);
		if (dist < min) min = dist;
	}
	return min;
}

function hasMinDistance(coord: HexCoord, keys: ReadonlySet<string>, minDist: number): boolean {
	for (const key of keys) {
		if (hexDistance(coord, hexFromKey(key)) < minDist) {
			return false;
		}
	}
	return true;
}

function assignTerrains(
	coords: readonly HexCoord[],
	elevations: ReadonlyMap<string, number>,
): ReadonlyMap<string, TerrainType> {
	let minElev = Number.POSITIVE_INFINITY;
	let maxElev = Number.NEGATIVE_INFINITY;

	for (const coord of coords) {
		const elev = elevations.get(hexKey(coord)) ?? 0;
		if (elev < minElev) minElev = elev;
		if (elev > maxElev) maxElev = elev;
	}

	const terrains = new Map<string, TerrainType>();
	const range = maxElev - minElev;

	for (const coord of coords) {
		const key = hexKey(coord);
		const elev = elevations.get(key) ?? 0;
		const normalized = range > 0 ? (elev - minElev) / range : 0.5;
		terrains.set(key, terrainFromNormalized(normalized));
	}

	return terrains;
}

function terrainFromNormalized(normalized: number): TerrainType {
	if (normalized > 0.85) return "peak";
	if (normalized > 0.7) return "ridge";
	if (normalized > 0.45) return "slope";
	if (normalized > 0.3) return "valley";
	if (normalized > 0.15) return "plain";
	if (normalized > 0.05) return "basin";
	return "riverbed";
}

function buildTileDefinitions(
	coords: readonly HexCoord[],
	elevations: ReadonlyMap<string, number>,
	terrains: ReadonlyMap<string, TerrainType>,
	sourceKeys: ReadonlySet<string>,
	resourceKeys: ReadonlySet<string>,
	params: DifficultyParams,
	rng: Rng,
): readonly TileDefinition[] {
	const tiles: TileDefinition[] = [];
	const usedNames = new Set<string>();

	for (const coord of coords) {
		const key = hexKey(coord);
		const elevation = elevations.get(key) ?? 0;
		const terrain = terrains.get(key) ?? "slope";

		let content: TileContentDefinition;

		if (sourceKeys.has(key)) {
			content = {
				kind: "source",
				flowRate: rng.nextInt(params.flowRate[0], params.flowRate[1]),
				startTick: 0,
				duration: rng.nextInt(params.sourceDuration[0], params.sourceDuration[1]),
			};
		} else if (resourceKeys.has(key)) {
			const resourceType = rng.pick(params.resourceTypes);
			const name = pickResourceName(resourceType, usedNames, rng);
			usedNames.add(name);
			content = {
				kind: "resource",
				resourceType,
				name,
				damageThreshold: rng.nextInt(params.damageThreshold[0], params.damageThreshold[1]),
				value: rng.nextInt(params.resourceValue[0], params.resourceValue[1]),
			};
		} else {
			content = { kind: "empty" };
		}

		tiles.push({ coord, elevation, terrain, content });
	}

	return tiles;
}

function pickResourceName(
	resourceType: ResourceType,
	usedNames: ReadonlySet<string>,
	rng: Rng,
): string {
	const names = RESOURCE_NAMES[resourceType];
	const shuffled = rng.shuffle(names);
	for (const name of shuffled) {
		if (!usedNames.has(name)) {
			return name;
		}
	}
	// Fallback: append a number to avoid duplicates
	const baseName = rng.pick(names);
	return `${baseName} ${rng.nextInt(2, 99)}`;
}

function computeBudget(
	tiles: readonly TileDefinition[],
	resourceCount: number,
	params: DifficultyParams,
): number {
	let totalWater = 0;
	for (const tile of tiles) {
		if (tile.content.kind === "source") {
			totalWater += tile.content.flowRate * tile.content.duration;
		}
	}
	const basePerResource = 15;
	const waterFactor = Math.ceil(totalWater / 100);
	const raw = (resourceCount * basePerResource + waterFactor * 5) * params.budgetMultiplier;
	return Math.max(15, Math.round(raw));
}

function generateId(name: string, seed: number): string {
	return `${name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")}-${seed}`;
}

function generateDescription(
	options: GeneratorOptions,
	sourceCount: number,
	resourceCount: number,
): string {
	const difficultyText =
		options.difficulty === "easy"
			? "A gentle"
			: options.difficulty === "medium"
				? "A moderate"
				: "A challenging";
	const sourcePlural = sourceCount === 1 ? "source" : "sources";
	const resourcePlural = resourceCount === 1 ? "resource" : "resources";
	return `${difficultyText} puzzle on a radius-${options.radius} grid with ${sourceCount} water ${sourcePlural} and ${resourceCount} ${resourcePlural} to protect.`;
}
