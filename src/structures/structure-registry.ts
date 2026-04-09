import type {
	AbsorptionBasinStructure,
	DamMaterial,
	DamStructure,
	DrainageChannelStructure,
	HexDirection,
	LeveeStructure,
	SplitterStructure,
	Structure,
	StructureKind,
} from "../types.ts";

/** Cost table for dam materials */
const DAM_COSTS: Record<DamMaterial, number> = {
	mud: 5,
	wood: 10,
	concrete: 25,
};

/** Durability table for dam materials */
const DAM_DURABILITIES: Record<DamMaterial, number> = {
	mud: 50,
	wood: 150,
	concrete: 500,
};

/** Block capacity table for dam materials */
const DAM_BLOCK_CAPACITIES: Record<DamMaterial, number> = {
	mud: 20,
	wood: 40,
	concrete: 80,
};

/** Create a dam structure */
export function createDam(
	material: DamMaterial,
	blockedEdges: readonly HexDirection[],
): DamStructure {
	return {
		kind: "dam",
		material,
		cost: DAM_COSTS[material],
		durability: DAM_DURABILITIES[material],
		currentDurability: DAM_DURABILITIES[material],
		blockCapacity: DAM_BLOCK_CAPACITIES[material],
		blockedEdges,
		broken: false,
	};
}

/** Create a splitter structure */
export function createSplitter(redirectEdges: readonly HexDirection[]): SplitterStructure {
	return {
		kind: "splitter",
		cost: 15,
		durability: 200,
		currentDurability: 200,
		redirectEdges,
		broken: false,
	};
}

/** Create a drainage channel structure */
export function createDrainageChannel(
	channelEdges: readonly HexDirection[],
): DrainageChannelStructure {
	return {
		kind: "drainage_channel",
		cost: 8,
		channelEdges,
	};
}

/** Create an absorption basin structure */
export function createAbsorptionBasin(extraCapacity: number): AbsorptionBasinStructure {
	return {
		kind: "absorption_basin",
		cost: 12,
		extraCapacity,
	};
}

/** Create a levee structure */
export function createLevee(
	blockedEdges: readonly HexDirection[],
	elevationBoost: number,
): LeveeStructure {
	return {
		kind: "levee",
		cost: 20,
		durability: 300,
		currentDurability: 300,
		elevationBoost,
		blockedEdges,
		broken: false,
	};
}

/** Get the cost of a structure */
export function getStructureCost(structure: Structure): number {
	return structure.cost;
}

/** Check if a structure kind is valid */
export function isValidStructureKind(kind: string): kind is StructureKind {
	const validKinds: readonly string[] = [
		"dam",
		"splitter",
		"drainage_channel",
		"absorption_basin",
		"levee",
	];
	return validKinds.includes(kind);
}
