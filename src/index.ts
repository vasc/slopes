// ── Types ────────────────────────────────────────────────────────────
export type {
	HexCoord,
	HexDirection,
	TerrainType,
	TerrainProperties,
	TerrainTable,
	TileContent,
	WaterSource,
	Tile,
	DamMaterial,
	DamStructure,
	SplitterStructure,
	DrainageChannelStructure,
	AbsorptionBasinStructure,
	LeveeStructure,
	Structure,
	StructureKind,
	HexEdge,
	EdgeFlowModifier,
	ResourceType,
	ResourceState,
	Resource,
	FlowEdge,
	WaterState,
	TileContentDefinition,
	TileDefinition,
	LevelDefinition,
	GameEvent,
	TickResult,
	SimulationResult,
	GameState,
} from "./types.ts";

// ── Hex Coordinates ──────────────────────────────────────────────────
export {
	HEX_DIRECTIONS,
	hexKey,
	hexFromKey,
	hexNeighbor,
	hexNeighbors,
	hexDistance,
	hexRing,
	hexSpiral,
	oppositeDirection,
} from "./hex/coordinates.ts";

// ── Hex Grid ─────────────────────────────────────────────────────────
export { HexGrid } from "./hex/grid.ts";
export type { SerializedGrid, SerializedTile } from "./hex/grid.ts";

// ── Terrain ──────────────────────────────────────────────────────────
export { TERRAIN_TABLE, getTerrainProperties, isBuildable } from "./terrain/terrain.ts";

// ── Structures ───────────────────────────────────────────────────────
export {
	createDam,
	createSplitter,
	createDrainageChannel,
	createAbsorptionBasin,
	createLevee,
	getStructureCost,
	isValidStructureKind,
} from "./structures/structure-registry.ts";

export {
	placeStructure,
	removeStructure,
	getRemainingBudget,
	getPlacedStructures,
} from "./structures/structure-manager.ts";
export type { PlaceResult, RemoveResult } from "./structures/structure-manager.ts";

// ── Resources ────────────────────────────────────────────────────────
export {
	createResource,
	applyDamage,
	isIntact,
	totalResourceValue,
} from "./resources/resource.ts";

// ── Water Simulation ─────────────────────────────────────────────────
export { computeTick } from "./water/flow-calculator.ts";
export type { TickComputeResult } from "./water/flow-calculator.ts";

export { runSimulation, stepSimulation } from "./water/simulation.ts";
export type { StepResult } from "./water/simulation.ts";

// ── Level ────────────────────────────────────────────────────────────
export { loadLevel } from "./level/level-loader.ts";
export type { LoadResult } from "./level/level-loader.ts";

export { validateLevel } from "./level/level-validator.ts";

export { LevelDefinitionSchema } from "./level/level-schema.ts";

// ── Scoring ──────────────────────────────────────────────────────────
export { calculateScore, checkWinCondition, checkParScore } from "./scoring/scoring.ts";
export type { ScoreBreakdown } from "./scoring/scoring.ts";

// ── Game Engine ──────────────────────────────────────────────────────
export {
	initGame,
	placeGameStructure,
	removeGameStructure,
	getGameBudget,
	runGameSimulation,
	stepGameSimulation,
	scoreGame,
	serializeState,
	deserializeState,
} from "./engine/game-engine.ts";
export type {
	SerializedGameState,
	SerializedTileEntry,
	SerializedStructureEntry,
} from "./engine/game-engine.ts";

// ── Generator ───────────────────────────────────────────────────────
export { generatePuzzle, isDifficulty } from "./generator/puzzle-generator.ts";
export type { Difficulty, GeneratorOptions } from "./generator/puzzle-generator.ts";

export { createRng } from "./generator/random.ts";
export type { Rng } from "./generator/random.ts";
