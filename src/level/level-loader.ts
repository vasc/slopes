import { hexKey } from "../hex/coordinates.ts";
import type {
	GameState,
	LevelDefinition,
	Tile,
	TileContentDefinition,
	TileDefinition,
} from "../types.ts";
import { validateLevel } from "./level-validator.ts";

/** Result of loading a level */
export type LoadResult =
	| { readonly success: true; readonly state: GameState }
	| { readonly success: false; readonly errors: readonly string[] };

/** Load a level definition into a GameState */
export function loadLevel(definition: LevelDefinition): LoadResult {
	const errors = validateLevel(definition);
	if (errors.length > 0) {
		return { success: false, errors };
	}

	const tiles = new Map<string, Tile>();

	for (const tileDef of definition.tiles) {
		const key = hexKey(tileDef.coord);
		const tile = tileFromDefinition(tileDef);
		tiles.set(key, tile);
	}

	return {
		success: true,
		state: {
			level: definition,
			tiles,
			placedStructures: new Map(),
			budgetUsed: 0,
		},
	};
}

/** Convert a TileDefinition into a runtime Tile */
function tileFromDefinition(def: TileDefinition): Tile {
	return {
		coord: def.coord,
		elevation: def.elevation,
		terrain: def.terrain,
		waterLevel: 0,
		content: contentFromDefinition(def.content),
	};
}

/** Convert a TileContentDefinition into a runtime TileContent */
function contentFromDefinition(def: TileContentDefinition): Tile["content"] {
	switch (def.kind) {
		case "empty":
			return { kind: "empty" };
		case "resource":
			return {
				kind: "resource",
				resource: {
					type: def.resourceType,
					name: def.name,
					damageThreshold: def.damageThreshold,
					value: def.value,
					state: { status: "intact", accumulatedDamage: 0 },
				},
			};
		case "source":
			return {
				kind: "source",
				source: {
					flowRate: def.flowRate,
					startTick: def.startTick,
					duration: def.duration,
				},
			};
	}
}
