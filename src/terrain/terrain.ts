import type { TerrainProperties, TerrainTable, TerrainType } from "../types.ts";

/** Exhaustive terrain property lookup table */
export const TERRAIN_TABLE: TerrainTable = {
	peak: { flowResistance: 0.9, waterCapacity: 10, buildable: false },
	ridge: { flowResistance: 0.3, waterCapacity: 30, buildable: true },
	slope: { flowResistance: 0.2, waterCapacity: 50, buildable: true },
	valley: { flowResistance: 0.4, waterCapacity: 100, buildable: true },
	plain: { flowResistance: 0.5, waterCapacity: 80, buildable: true },
	basin: { flowResistance: 0.6, waterCapacity: 200, buildable: true },
	cliff: { flowResistance: 0.1, waterCapacity: 20, buildable: false },
	riverbed: { flowResistance: 0.0, waterCapacity: 150, buildable: false },
} as const;

/** Get terrain properties for a terrain type */
export function getTerrainProperties(terrain: TerrainType): TerrainProperties {
	return TERRAIN_TABLE[terrain];
}

/** Check if a terrain type allows building */
export function isBuildable(terrain: TerrainType): boolean {
	return TERRAIN_TABLE[terrain].buildable;
}
