import { loadLevel } from "../level/level-loader.ts";
import type { LoadResult } from "../level/level-loader.ts";
import { calculateScore } from "../scoring/scoring.ts";
import type { ScoreBreakdown } from "../scoring/scoring.ts";
import {
	getRemainingBudget,
	placeStructure as placeStructureInternal,
	removeStructure as removeStructureInternal,
} from "../structures/structure-manager.ts";
import type { PlaceResult, RemoveResult } from "../structures/structure-manager.ts";
import type {
	GameState,
	HexCoord,
	LevelDefinition,
	SimulationResult,
	Structure,
	Tile,
} from "../types.ts";
import { runSimulation, stepSimulation } from "../water/simulation.ts";
import type { StepResult } from "../water/simulation.ts";

/** Initialize a game from a level definition */
export function initGame(definition: LevelDefinition): LoadResult {
	return loadLevel(definition);
}

/** Place a structure on the grid */
export function placeGameStructure(
	state: GameState,
	coord: HexCoord,
	structure: Structure,
): PlaceResult {
	return placeStructureInternal(state, coord, structure);
}

/** Remove a structure from the grid */
export function removeGameStructure(state: GameState, coord: HexCoord): RemoveResult {
	return removeStructureInternal(state, coord);
}

/** Get remaining budget for current state */
export function getGameBudget(state: GameState): number {
	return getRemainingBudget(state);
}

/** Run the full simulation and return results with scoring */
export function runGameSimulation(state: GameState): SimulationResult {
	const result = runSimulation(state.tiles, state.level.simulationDuration, state.budgetUsed);
	return result;
}

/** Run a single simulation step */
export function stepGameSimulation(state: GameState, tick: number): StepResult {
	return stepSimulation(state.tiles, tick);
}

/** Calculate score breakdown for a simulation result */
export function scoreGame(result: SimulationResult, level: LevelDefinition): ScoreBreakdown {
	return calculateScore(result, level);
}

/** Serialize game state to a JSON-compatible object */
export function serializeState(state: GameState): SerializedGameState {
	const tilesArray: SerializedTileEntry[] = [];
	for (const [key, tile] of state.tiles) {
		tilesArray.push({ key, tile });
	}

	const structuresArray: SerializedStructureEntry[] = [];
	for (const [key, structure] of state.placedStructures) {
		structuresArray.push({ key, structure });
	}

	return {
		level: state.level,
		tiles: tilesArray,
		placedStructures: structuresArray,
		budgetUsed: state.budgetUsed,
	};
}

/** Deserialize game state from a JSON-compatible object */
export function deserializeState(data: SerializedGameState): GameState {
	const tiles = new Map<string, Tile>();
	for (const entry of data.tiles) {
		tiles.set(entry.key, entry.tile);
	}

	const placedStructures = new Map<string, Structure>();
	for (const entry of data.placedStructures) {
		placedStructures.set(entry.key, entry.structure);
	}

	return {
		level: data.level,
		tiles,
		placedStructures,
		budgetUsed: data.budgetUsed,
	};
}

// ── Serialization types ──────────────────────────────────────────────

export interface SerializedTileEntry {
	readonly key: string;
	readonly tile: Tile;
}

export interface SerializedStructureEntry {
	readonly key: string;
	readonly structure: Structure;
}

export interface SerializedGameState {
	readonly level: LevelDefinition;
	readonly tiles: readonly SerializedTileEntry[];
	readonly placedStructures: readonly SerializedStructureEntry[];
	readonly budgetUsed: number;
}
