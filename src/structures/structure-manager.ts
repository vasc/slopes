import { hexKey } from "../hex/coordinates.ts";
import { isBuildable } from "../terrain/terrain.ts";
import type { GameState, HexCoord, Structure } from "../types.ts";
import { getStructureCost } from "./structure-registry.ts";

/** Result of a structure placement attempt */
export type PlaceResult =
	| { readonly success: true; readonly state: GameState }
	| { readonly success: false; readonly reason: string };

/** Result of a structure removal */
export type RemoveResult =
	| { readonly success: true; readonly state: GameState; readonly refund: number }
	| { readonly success: false; readonly reason: string };

/** Attempt to place a structure on the grid */
export function placeStructure(
	state: GameState,
	coord: HexCoord,
	structure: Structure,
): PlaceResult {
	const key = hexKey(coord);
	const tile = state.tiles.get(key);

	if (tile === undefined) {
		return { success: false, reason: `No tile at ${key}` };
	}

	if (tile.content.kind !== "empty") {
		return { success: false, reason: `Tile at ${key} is not empty` };
	}

	if (!isBuildable(tile.terrain)) {
		return { success: false, reason: `Terrain '${tile.terrain}' is not buildable` };
	}

	if (!state.level.availableStructures.includes(structure.kind)) {
		return { success: false, reason: `Structure '${structure.kind}' not available in this level` };
	}

	const cost = getStructureCost(structure);
	const remainingBudget = state.level.budget - state.budgetUsed;
	if (cost > remainingBudget) {
		return {
			success: false,
			reason: `Insufficient budget: need ${cost}, have ${remainingBudget}`,
		};
	}

	const newTiles = new Map(state.tiles);
	newTiles.set(key, { ...tile, content: { kind: "structure", structure } });

	const newPlaced = new Map(state.placedStructures);
	newPlaced.set(key, structure);

	return {
		success: true,
		state: {
			...state,
			tiles: newTiles,
			placedStructures: newPlaced,
			budgetUsed: state.budgetUsed + cost,
		},
	};
}

/** Remove a structure from the grid, refunding half the cost */
export function removeStructure(state: GameState, coord: HexCoord): RemoveResult {
	const key = hexKey(coord);
	const tile = state.tiles.get(key);

	if (tile === undefined) {
		return { success: false, reason: `No tile at ${key}` };
	}

	if (tile.content.kind !== "structure") {
		return { success: false, reason: `No structure at ${key}` };
	}

	const refund = Math.floor(tile.content.structure.cost / 2);

	const newTiles = new Map(state.tiles);
	newTiles.set(key, { ...tile, content: { kind: "empty" } });

	const newPlaced = new Map(state.placedStructures);
	newPlaced.delete(key);

	return {
		success: true,
		state: {
			...state,
			tiles: newTiles,
			placedStructures: newPlaced,
			budgetUsed: state.budgetUsed - refund,
		},
		refund,
	};
}

/** Get remaining budget */
export function getRemainingBudget(state: GameState): number {
	return state.level.budget - state.budgetUsed;
}

/** Get all placed structures as entries */
export function getPlacedStructures(state: GameState): readonly (readonly [string, Structure])[] {
	return [...state.placedStructures.entries()];
}
