import { HEX_DIRECTIONS, hexKey, hexNeighbor, oppositeDirection } from "../hex/coordinates.ts";
import { TERRAIN_TABLE } from "../terrain/terrain.ts";
import type {
	DamStructure,
	FlowEdge,
	GameEvent,
	HexCoord,
	HexDirection,
	LeveeStructure,
	SplitterStructure,
	Structure,
	Tile,
	TileContent,
} from "../types.ts";

/** Damage rate per liter of water per tick on resources */
const DAMAGE_RATE_PER_TICK = 1;

/** Mutable tile state used during a single tick computation */
interface MutableTileState {
	waterLevel: number;
	content: TileContent;
}

/** Result of computing a single tick */
export interface TickComputeResult {
	readonly tileUpdates: ReadonlyMap<string, MutableTileState>;
	readonly flows: readonly FlowEdge[];
	readonly events: readonly GameEvent[];
}

/** Compute a single simulation tick. Pure function — reads grid + water levels, returns updates. */
export function computeTick(tiles: ReadonlyMap<string, Tile>, tick: number): TickComputeResult {
	// Build mutable working copies of tile state
	const state = new Map<string, MutableTileState>();
	for (const [key, tile] of tiles) {
		state.set(key, { waterLevel: tile.waterLevel, content: tile.content });
	}

	const flows: FlowEdge[] = [];
	const events: GameEvent[] = [];

	// Step 1: Activate water sources
	for (const tile of tiles.values()) {
		if (tile.content.kind === "source") {
			const source = tile.content.source;
			if (tick >= source.startTick && tick < source.startTick + source.duration) {
				const tileState = state.get(hexKey(tile.coord));
				if (tileState !== undefined) {
					tileState.waterLevel += source.flowRate;
				}
				if (tick === source.startTick) {
					events.push({ type: "water_source_activate", coord: tile.coord, tick });
				}
			}
			if (tick === source.startTick + source.duration) {
				events.push({ type: "water_source_deplete", coord: tile.coord, tick });
			}
		}
	}

	// Step 2: Sort tiles by elevation descending for deterministic processing
	const sortedTiles = [...tiles.values()].sort((a, b) => {
		if (b.elevation !== a.elevation) return b.elevation - a.elevation;
		const keyA = hexKey(a.coord);
		const keyB = hexKey(b.coord);
		if (keyA < keyB) return -1;
		if (keyA > keyB) return 1;
		return 0;
	});

	// Step 3: Distribute water flow edge-by-edge
	for (const tile of sortedTiles) {
		const tileKey = hexKey(tile.coord);
		const tileState = state.get(tileKey);
		if (tileState === undefined || tileState.waterLevel <= 0) continue;

		const tileStructure = getStructure(tileState.content);

		// If tile has a splitter, restrict to redirect edges only
		const allowedDirections =
			tileStructure !== undefined && tileStructure.kind === "splitter" && !tileStructure.broken
				? tileStructure.redirectEdges
				: HEX_DIRECTIONS;

		// Compute per-edge weights
		interface EdgeCandidate {
			direction: HexDirection;
			neighborCoord: HexCoord;
			neighborKey: string;
			weight: number;
			damStructure: Structure | undefined;
		}

		const candidates: EdgeCandidate[] = [];
		let totalWeight = 0;

		for (const dir of allowedDirections) {
			const neighborCoord = hexNeighbor(tile.coord, dir);
			const neighborKey = hexKey(neighborCoord);
			const neighborTile = tiles.get(neighborKey);
			if (neighborTile === undefined) continue;

			const neighborState = state.get(neighborKey);
			if (neighborState === undefined) continue;

			// Effective elevations considering edge-level structure modifiers
			const myEffective = getEffectiveElevationForEdge(tile, tileState.content, dir);
			const neighborEffective = getEffectiveElevationForEdge(
				neighborTile,
				neighborState.content,
				oppositeDirection(dir),
			);

			const edgeDiff = myEffective - neighborEffective;
			if (edgeDiff <= 0) continue;

			// Check if this edge is blocked by a dam/levee on the current tile
			const damOnEdge = getEdgeBlockingStructure(tileState.content, dir);

			// Check if neighbor side also has a blocking structure
			const neighborDam = getEdgeBlockingStructure(neighborState.content, oppositeDirection(dir));

			// Use the blocking structure from either side (prefer the one with higher block capacity)
			let edgeDamStructure: Structure | undefined;
			if (damOnEdge !== undefined && neighborDam !== undefined) {
				edgeDamStructure =
					getBlockCapacity(damOnEdge) >= getBlockCapacity(neighborDam) ? damOnEdge : neighborDam;
			} else {
				edgeDamStructure = damOnEdge ?? neighborDam;
			}

			// Flow resistance — drainage channels reduce to 0 on their edges
			let flowResistance = TERRAIN_TABLE[neighborTile.terrain].flowResistance;
			if (hasDrainageChannelOnEdge(tileState.content, dir)) {
				flowResistance = 0;
			}

			const weight = edgeDiff * (1 - flowResistance);
			if (weight <= 0) continue;

			candidates.push({
				direction: dir,
				neighborCoord,
				neighborKey,
				weight,
				damStructure: edgeDamStructure,
			});
			totalWeight += weight;
		}

		if (candidates.length === 0 || totalWeight <= 0) continue;

		// Distribute water proportional to weights
		const availableWater = tileState.waterLevel;

		for (const candidate of candidates) {
			const proposedFlow = availableWater * (candidate.weight / totalWeight);

			let actualFlow: number;

			if (candidate.damStructure !== undefined && !isStructureBroken(candidate.damStructure)) {
				const maxBlock = getBlockCapacity(candidate.damStructure);
				const blocked = Math.min(proposedFlow, maxBlock);
				actualFlow = proposedFlow - blocked;

				// Damage the blocking structure
				const damResult = damageStructure(candidate.damStructure, proposedFlow);
				if (damResult.broken) {
					// Find which tile owns this structure and update it
					updateBrokenStructure(state, tile.coord, candidate.neighborCoord, events, tick);
					actualFlow = proposedFlow; // Broken — all flow passes through
				}
			} else {
				actualFlow = proposedFlow;
			}

			if (actualFlow > 0) {
				const neighborState = state.get(candidate.neighborKey);
				if (neighborState !== undefined) {
					neighborState.waterLevel += actualFlow;
				}
				tileState.waterLevel -= actualFlow;

				flows.push({
					from: tile.coord,
					to: candidate.neighborCoord,
					flowRate: actualFlow,
				});
			}
		}
	}

	// Step 4: Check overflow and emit events
	for (const [key, tile] of tiles) {
		const tileState = state.get(key);
		if (tileState === undefined) continue;

		const capacity = getTileCapacity(tile, tileState.content);
		if (tileState.waterLevel > capacity) {
			const excess = tileState.waterLevel - capacity;
			events.push({ type: "tile_overflow", coord: tile.coord, tick, excess });
		}
	}

	// Step 5: Apply structure damage from sustained water contact
	for (const [, tile] of tiles) {
		const tileState = state.get(hexKey(tile.coord));
		if (tileState === undefined) continue;

		if (tileState.content.kind === "structure" && tileState.waterLevel > 0) {
			const structure = tileState.content.structure;
			if (hasDurability(structure) && !isStructureBroken(structure)) {
				const damageResult = damageStructure(structure, tileState.waterLevel);
				if (damageResult.broken) {
					tileState.content = {
						kind: "structure",
						structure: damageResult.structure,
					};
					events.push({ type: "structure_broken", coord: tile.coord, tick });
				} else {
					tileState.content = {
						kind: "structure",
						structure: damageResult.structure,
					};
					events.push({
						type: "structure_damaged",
						coord: tile.coord,
						tick,
						remaining: damageResult.remaining,
					});
				}
			}
		}
	}

	// Step 6: Resource damage
	for (const [, tile] of tiles) {
		const tileState = state.get(hexKey(tile.coord));
		if (tileState === undefined) continue;

		if (tileState.content.kind === "resource" && tileState.waterLevel > 0) {
			const resource = tileState.content.resource;
			if (resource.state.status === "intact") {
				const damage = tileState.waterLevel * DAMAGE_RATE_PER_TICK;
				const newDamage = resource.state.accumulatedDamage + damage;

				events.push({
					type: "resource_damaged",
					coord: tile.coord,
					tick,
					damage,
				});

				if (newDamage >= resource.damageThreshold) {
					tileState.content = {
						kind: "resource",
						resource: {
							...resource,
							state: { status: "destroyed", destroyedAtTick: tick },
						},
					};
					events.push({
						type: "resource_destroyed",
						coord: tile.coord,
						tick,
						resourceType: resource.type,
					});
				} else {
					tileState.content = {
						kind: "resource",
						resource: {
							...resource,
							state: { status: "intact", accumulatedDamage: newDamage },
						},
					};
				}
			}
		}
	}

	return { tileUpdates: state, flows, events };
}

// ── Helper functions ──────────────────────────────────────────────────

/** Check if a direction is in a readonly array of HexDirection */
function edgesInclude(edges: readonly HexDirection[], direction: HexDirection): boolean {
	return edges.some((e) => e === direction);
}

function getStructure(content: TileContent): Structure | undefined {
	if (content.kind === "structure") return content.structure;
	return undefined;
}

function getEffectiveElevationForEdge(
	tile: Tile,
	content: TileContent,
	direction: HexDirection,
): number {
	if (content.kind !== "structure") return tile.elevation;
	const structure = content.structure;
	if (structure.kind === "levee" && !structure.broken) {
		if (edgesInclude(structure.blockedEdges, direction)) {
			return tile.elevation + structure.elevationBoost;
		}
	}
	return tile.elevation;
}

function getEdgeBlockingStructure(
	content: TileContent,
	direction: HexDirection,
): Structure | undefined {
	if (content.kind !== "structure") return undefined;
	const structure = content.structure;
	if (structure.kind === "dam" && !structure.broken) {
		if (edgesInclude(structure.blockedEdges, direction)) {
			return structure;
		}
	}
	if (structure.kind === "levee" && !structure.broken) {
		if (edgesInclude(structure.blockedEdges, direction)) {
			return structure;
		}
	}
	return undefined;
}

function getBlockCapacity(structure: Structure): number {
	if (structure.kind === "dam") return structure.blockCapacity;
	if (structure.kind === "levee") return structure.elevationBoost * 10;
	return 0;
}

function isStructureBroken(structure: Structure): boolean {
	switch (structure.kind) {
		case "dam":
		case "splitter":
		case "levee":
			return structure.broken;
		case "drainage_channel":
		case "absorption_basin":
			return false;
	}
}

/** Type guard for structures that have durability */
type DurableStructure = DamStructure | SplitterStructure | LeveeStructure;

function hasDurability(structure: Structure): structure is DurableStructure {
	return structure.kind === "dam" || structure.kind === "splitter" || structure.kind === "levee";
}

interface DamageResult {
	readonly structure: Structure;
	readonly broken: boolean;
	readonly remaining: number;
}

/** Damage a durable structure, returning updated structure without type assertions */
function damageStructure(structure: Structure, waterForce: number): DamageResult {
	if (!hasDurability(structure)) {
		return { structure, broken: false, remaining: 0 };
	}
	const remaining = structure.currentDurability - waterForce;
	if (remaining <= 0) {
		return {
			structure: makeBrokenStructure(structure),
			broken: true,
			remaining: 0,
		};
	}
	return {
		structure: makeDamagedStructure(structure, remaining),
		broken: false,
		remaining,
	};
}

/** Create a broken copy of a durable structure — exhaustive per-kind handling, no casts */
function makeBrokenStructure(structure: DurableStructure): Structure {
	switch (structure.kind) {
		case "dam":
			return { ...structure, currentDurability: 0, broken: true };
		case "splitter":
			return { ...structure, currentDurability: 0, broken: true };
		case "levee":
			return { ...structure, currentDurability: 0, broken: true };
	}
}

/** Create a damaged copy of a durable structure — exhaustive per-kind handling, no casts */
function makeDamagedStructure(structure: DurableStructure, newDurability: number): Structure {
	switch (structure.kind) {
		case "dam":
			return { ...structure, currentDurability: newDurability };
		case "splitter":
			return { ...structure, currentDurability: newDurability };
		case "levee":
			return { ...structure, currentDurability: newDurability };
	}
}

function hasDrainageChannelOnEdge(content: TileContent, direction: HexDirection): boolean {
	if (content.kind !== "structure") return false;
	const structure = content.structure;
	if (structure.kind === "drainage_channel") {
		return edgesInclude(structure.channelEdges, direction);
	}
	return false;
}

function getTileCapacity(tile: Tile, content: TileContent): number {
	let capacity = TERRAIN_TABLE[tile.terrain].waterCapacity;
	if (content.kind === "structure" && content.structure.kind === "absorption_basin") {
		capacity += content.structure.extraCapacity;
	}
	return capacity;
}

function updateBrokenStructure(
	state: Map<string, MutableTileState>,
	tileCoord: HexCoord,
	neighborCoord: HexCoord,
	events: GameEvent[],
	tick: number,
): void {
	for (const coord of [tileCoord, neighborCoord]) {
		const key = hexKey(coord);
		const tileState = state.get(key);
		if (tileState === undefined) continue;
		if (tileState.content.kind === "structure") {
			const structure = tileState.content.structure;
			if (hasDurability(structure) && !isStructureBroken(structure)) {
				const damaged = damageStructure(structure, structure.currentDurability + 1);
				tileState.content = { kind: "structure", structure: damaged.structure };
				events.push({ type: "structure_broken", coord, tick });
			}
		}
	}
}
