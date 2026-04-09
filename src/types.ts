/** Axial hex coordinates (q = column, r = row) */
export interface HexCoord {
	readonly q: number;
	readonly r: number;
}

/** The 6 hex directions in axial coords (flat-top orientation) */
export type HexDirection = "ne" | "e" | "se" | "sw" | "w" | "nw";

// ── Terrain ──────────────────────────────────────────────────────────

export type TerrainType =
	| "peak"
	| "ridge"
	| "slope"
	| "valley"
	| "plain"
	| "basin"
	| "cliff"
	| "riverbed";

export interface TerrainProperties {
	readonly flowResistance: number;
	readonly waterCapacity: number;
	readonly buildable: boolean;
}

export type TerrainTable = Record<TerrainType, TerrainProperties>;

// ── Tiles ────────────────────────────────────────────────────────────

export type TileContent =
	| { readonly kind: "empty" }
	| { readonly kind: "structure"; readonly structure: Structure }
	| { readonly kind: "resource"; readonly resource: Resource }
	| { readonly kind: "source"; readonly source: WaterSource };

export interface WaterSource {
	readonly flowRate: number;
	readonly startTick: number;
	readonly duration: number;
}

export interface Tile {
	readonly coord: HexCoord;
	readonly elevation: number;
	readonly terrain: TerrainType;
	readonly waterLevel: number;
	readonly content: TileContent;
}

// ── Structures ───────────────────────────────────────────────────────

export type DamMaterial = "mud" | "wood" | "concrete";

export interface DamStructure {
	readonly kind: "dam";
	readonly material: DamMaterial;
	readonly cost: number;
	readonly durability: number;
	readonly currentDurability: number;
	readonly blockCapacity: number;
	readonly blockedEdges: readonly HexDirection[];
	readonly broken: boolean;
}

export interface SplitterStructure {
	readonly kind: "splitter";
	readonly cost: number;
	readonly durability: number;
	readonly currentDurability: number;
	readonly redirectEdges: readonly HexDirection[];
	readonly broken: boolean;
}

export interface DrainageChannelStructure {
	readonly kind: "drainage_channel";
	readonly cost: number;
	readonly channelEdges: readonly HexDirection[];
}

export interface AbsorptionBasinStructure {
	readonly kind: "absorption_basin";
	readonly cost: number;
	readonly extraCapacity: number;
}

export interface LeveeStructure {
	readonly kind: "levee";
	readonly cost: number;
	readonly durability: number;
	readonly currentDurability: number;
	readonly elevationBoost: number;
	readonly blockedEdges: readonly HexDirection[];
	readonly broken: boolean;
}

export type Structure =
	| DamStructure
	| SplitterStructure
	| DrainageChannelStructure
	| AbsorptionBasinStructure
	| LeveeStructure;

export type StructureKind = Structure["kind"];

export interface HexEdge {
	readonly from: HexCoord;
	readonly to: HexCoord;
	readonly direction: HexDirection;
}

export interface EdgeFlowModifier {
	readonly blocked: boolean;
	readonly blockCapacity: number;
	readonly elevationBoost: number;
}

// ── Resources ────────────────────────────────────────────────────────

export type ResourceType = "village" | "bridge" | "train_line" | "farmland" | "road";

export type ResourceState =
	| { readonly status: "intact"; readonly accumulatedDamage: number }
	| { readonly status: "destroyed"; readonly destroyedAtTick: number };

export interface Resource {
	readonly type: ResourceType;
	readonly name: string;
	readonly damageThreshold: number;
	readonly state: ResourceState;
	readonly value: number;
}

// ── Water Flow ───────────────────────────────────────────────────────

export interface FlowEdge {
	readonly from: HexCoord;
	readonly to: HexCoord;
	readonly flowRate: number;
}

export interface WaterState {
	readonly waterLevels: ReadonlyMap<string, number>;
	readonly flows: readonly FlowEdge[];
	readonly totalWaterDelivered: number;
	readonly totalWaterRemaining: number;
}

// ── Level ────────────────────────────────────────────────────────────

export type TileContentDefinition =
	| { readonly kind: "empty" }
	| {
			readonly kind: "resource";
			readonly resourceType: ResourceType;
			readonly name: string;
			readonly damageThreshold: number;
			readonly value: number;
	  }
	| {
			readonly kind: "source";
			readonly flowRate: number;
			readonly startTick: number;
			readonly duration: number;
	  };

export interface TileDefinition {
	readonly coord: HexCoord;
	readonly elevation: number;
	readonly terrain: TerrainType;
	readonly content: TileContentDefinition;
}

export interface LevelDefinition {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly gridRadius: number;
	readonly tiles: readonly TileDefinition[];
	readonly budget: number;
	readonly availableStructures: readonly StructureKind[];
	readonly simulationDuration: number;
	readonly parBudget: number;
}

// ── Events ───────────────────────────────────────────────────────────

export type GameEvent =
	| { readonly type: "water_source_activate"; readonly coord: HexCoord; readonly tick: number }
	| { readonly type: "water_source_deplete"; readonly coord: HexCoord; readonly tick: number }
	| {
			readonly type: "tile_overflow";
			readonly coord: HexCoord;
			readonly tick: number;
			readonly excess: number;
	  }
	| {
			readonly type: "structure_damaged";
			readonly coord: HexCoord;
			readonly tick: number;
			readonly remaining: number;
	  }
	| { readonly type: "structure_broken"; readonly coord: HexCoord; readonly tick: number }
	| {
			readonly type: "resource_damaged";
			readonly coord: HexCoord;
			readonly tick: number;
			readonly damage: number;
	  }
	| {
			readonly type: "resource_destroyed";
			readonly coord: HexCoord;
			readonly tick: number;
			readonly resourceType: ResourceType;
	  };

export interface TickResult {
	readonly tick: number;
	readonly waterLevels: ReadonlyMap<string, number>;
	readonly flows: readonly FlowEdge[];
	readonly events: readonly GameEvent[];
}

export interface SimulationResult {
	readonly ticks: readonly TickResult[];
	readonly finalWaterLevels: ReadonlyMap<string, number>;
	readonly resourcesDestroyed: readonly Resource[];
	readonly resourcesSurvived: readonly Resource[];
	readonly allResourcesSurvived: boolean;
	readonly totalBudgetUsed: number;
	readonly score: number;
}

// ── Game State ───────────────────────────────────────────────────────

export interface GameState {
	readonly level: LevelDefinition;
	readonly tiles: ReadonlyMap<string, Tile>;
	readonly placedStructures: ReadonlyMap<string, Structure>;
	readonly budgetUsed: number;
}
