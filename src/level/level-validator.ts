import { hexDistance, hexKey } from "../hex/coordinates.ts";
import type { LevelDefinition } from "../types.ts";

const VALID_TERRAINS: readonly string[] = [
	"peak",
	"ridge",
	"slope",
	"valley",
	"plain",
	"basin",
	"cliff",
	"riverbed",
];

const VALID_STRUCTURE_KINDS: readonly string[] = [
	"dam",
	"splitter",
	"drainage_channel",
	"absorption_basin",
	"levee",
];

/** Validate a level definition, returning an array of error messages (empty = valid) */
export function validateLevel(level: LevelDefinition): readonly string[] {
	const errors: string[] = [];

	if (level.gridRadius < 1) {
		errors.push("Grid radius must be at least 1");
	}

	if (level.budget < 0) {
		errors.push("Budget must be non-negative");
	}

	if (level.simulationDuration < 1) {
		errors.push("Simulation duration must be at least 1");
	}

	if (level.parBudget < 0) {
		errors.push("Par budget must be non-negative");
	}

	if (level.parBudget > level.budget) {
		errors.push("Par budget must not exceed budget");
	}

	// Validate tiles
	const tileKeys = new Set<string>();
	let hasSource = false;
	let hasResource = false;

	for (const tile of level.tiles) {
		const key = hexKey(tile.coord);

		// Check for duplicates
		if (tileKeys.has(key)) {
			errors.push(`Duplicate tile at ${key}`);
		}
		tileKeys.add(key);

		// Check tile is within grid radius
		const dist = hexDistance({ q: 0, r: 0 }, tile.coord);
		if (dist > level.gridRadius) {
			errors.push(`Tile at ${key} is outside grid radius (distance ${dist} > ${level.gridRadius})`);
		}

		// Validate terrain
		if (!VALID_TERRAINS.includes(tile.terrain)) {
			errors.push(`Invalid terrain '${tile.terrain}' at ${key}`);
		}

		// Validate elevation
		if (!Number.isFinite(tile.elevation)) {
			errors.push(`Invalid elevation at ${key}`);
		}

		// Track content types
		if (tile.content.kind === "source") {
			hasSource = true;
			if (tile.content.flowRate <= 0) {
				errors.push(`Source at ${key} must have positive flow rate`);
			}
			if (tile.content.duration <= 0) {
				errors.push(`Source at ${key} must have positive duration`);
			}
		}

		if (tile.content.kind === "resource") {
			hasResource = true;
			if (tile.content.damageThreshold <= 0) {
				errors.push(`Resource at ${key} must have positive damage threshold`);
			}
			if (tile.content.value <= 0) {
				errors.push(`Resource at ${key} must have positive value`);
			}
		}
	}

	if (!hasSource) {
		errors.push("Level must have at least one water source");
	}

	if (!hasResource) {
		errors.push("Level must have at least one resource to protect");
	}

	// Validate available structures
	for (const kind of level.availableStructures) {
		if (!VALID_STRUCTURE_KINDS.includes(kind)) {
			errors.push(`Invalid structure kind: ${kind}`);
		}
	}

	return errors;
}
