import type { Resource, SimulationResult, TickResult, Tile } from "../types.ts";
import { computeTick } from "./flow-calculator.ts";

/** Run a complete simulation over the given number of ticks. Pure function. */
export function runSimulation(
	tiles: ReadonlyMap<string, Tile>,
	duration: number,
	budgetUsed: number,
): SimulationResult {
	let currentTiles = new Map(tiles);
	const allTicks: TickResult[] = [];

	for (let tick = 0; tick < duration; tick++) {
		const result = stepSimulation(currentTiles, tick);
		allTicks.push(result.tickResult);
		currentTiles = result.updatedTiles;
	}

	// Collect resource outcomes
	const destroyed: Resource[] = [];
	const survived: Resource[] = [];

	for (const tile of currentTiles.values()) {
		if (tile.content.kind === "resource") {
			const resource = tile.content.resource;
			if (resource.state.status === "destroyed") {
				destroyed.push(resource);
			} else {
				survived.push(resource);
			}
		}
	}

	const allSurvived = destroyed.length === 0;

	// Score: sum of survived resource values, bonus if under budget
	let score = 0;
	for (const r of survived) {
		score += r.value;
	}

	// Final water levels
	const finalWaterLevels = new Map<string, number>();
	for (const [key, tile] of currentTiles) {
		if (tile.waterLevel > 0) {
			finalWaterLevels.set(key, tile.waterLevel);
		}
	}

	return {
		ticks: allTicks,
		finalWaterLevels,
		resourcesDestroyed: destroyed,
		resourcesSurvived: survived,
		allResourcesSurvived: allSurvived,
		totalBudgetUsed: budgetUsed,
		score,
	};
}

/** Step result with updated tile map */
export interface StepResult {
	readonly tickResult: TickResult;
	readonly updatedTiles: Map<string, Tile>;
}

/** Execute a single simulation tick. Pure function. */
export function stepSimulation(tiles: ReadonlyMap<string, Tile>, tick: number): StepResult {
	const computed = computeTick(tiles, tick);

	// Apply updates to create new tile map
	const updatedTiles = new Map<string, Tile>();
	for (const [key, tile] of tiles) {
		const update = computed.tileUpdates.get(key);
		if (update !== undefined) {
			updatedTiles.set(key, {
				...tile,
				waterLevel: update.waterLevel,
				content: update.content,
			});
		} else {
			updatedTiles.set(key, tile);
		}
	}

	// Collect water levels
	const waterLevels = new Map<string, number>();
	for (const [key, tile] of updatedTiles) {
		waterLevels.set(key, tile.waterLevel);
	}

	const tickResult: TickResult = {
		tick,
		waterLevels,
		flows: computed.flows,
		events: computed.events,
	};

	return { tickResult, updatedTiles };
}
