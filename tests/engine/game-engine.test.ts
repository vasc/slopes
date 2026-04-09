import { describe, expect, test } from "bun:test";
import {
	deserializeState,
	getGameBudget,
	initGame,
	placeGameStructure,
	removeGameStructure,
	runGameSimulation,
	scoreGame,
	serializeState,
} from "../../src/engine/game-engine.ts";
import { hexSpiral } from "../../src/hex/coordinates.ts";
import { createDam } from "../../src/structures/structure-registry.ts";
import type { LevelDefinition, TileDefinition } from "../../src/types.ts";

function makeTestLevel(): LevelDefinition {
	const coords = hexSpiral({ q: 0, r: 0 }, 3);
	const tiles: TileDefinition[] = coords.map((coord) => {
		// Create a slope: elevation decreases from center
		const dist = Math.abs(coord.q) + Math.abs(coord.r) + Math.abs(-coord.q - coord.r);
		const elevation = 20 - dist * 2;

		// Place source at peak, resource at edge
		if (coord.q === 0 && coord.r === 0) {
			return {
				coord,
				elevation: 20,
				terrain: "peak" as const,
				content: {
					kind: "source" as const,
					flowRate: 30,
					startTick: 0,
					duration: 8,
				},
			};
		}

		if (coord.q === 2 && coord.r === 1) {
			return {
				coord,
				elevation: 6,
				terrain: "plain" as const,
				content: {
					kind: "resource" as const,
					resourceType: "village" as const,
					name: "Hillside Village",
					damageThreshold: 200,
					value: 100,
				},
			};
		}

		return {
			coord,
			elevation,
			terrain: "slope" as const,
			content: { kind: "empty" as const },
		};
	});

	return {
		id: "test-integration",
		name: "Integration Test Level",
		description: "A level for integration testing",
		gridRadius: 3,
		tiles,
		budget: 100,
		availableStructures: ["dam", "splitter", "drainage_channel", "absorption_basin", "levee"],
		simulationDuration: 10,
		parBudget: 50,
	};
}

describe("game-engine integration", () => {
	test("initGame loads a valid level", () => {
		const level = makeTestLevel();
		const result = initGame(level);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.state.tiles.size).toBe(37); // radius-3 hex = 37 tiles
		expect(result.state.budgetUsed).toBe(0);
	});

	test("initGame rejects invalid level", () => {
		const level: LevelDefinition = {
			id: "bad",
			name: "Bad",
			description: "No sources",
			gridRadius: 1,
			tiles: [
				{
					coord: { q: 0, r: 0 },
					elevation: 10,
					terrain: "slope",
					content: { kind: "empty" },
				},
			],
			budget: 50,
			availableStructures: ["dam"],
			simulationDuration: 5,
			parBudget: 25,
		};

		const result = initGame(level);
		expect(result.success).toBe(false);
	});

	test("place and remove structures", () => {
		const level = makeTestLevel();
		const loaded = initGame(level);
		expect(loaded.success).toBe(true);
		if (!loaded.success) return;

		// Place a dam
		const dam = createDam("wood", ["e", "se"]);
		const placed = placeGameStructure(loaded.state, { q: 1, r: 0 }, dam);
		expect(placed.success).toBe(true);
		if (!placed.success) return;
		expect(placed.state.budgetUsed).toBe(10);
		expect(getGameBudget(placed.state)).toBe(90);

		// Remove the dam
		const removed = removeGameStructure(placed.state, { q: 1, r: 0 });
		expect(removed.success).toBe(true);
		if (!removed.success) return;
		expect(removed.refund).toBe(5);
	});

	test("run simulation without structures — resource likely damaged", () => {
		const level = makeTestLevel();
		const loaded = initGame(level);
		expect(loaded.success).toBe(true);
		if (!loaded.success) return;

		const result = runGameSimulation(loaded.state);
		expect(result.ticks.length).toBe(10);

		// With no structures, water flows freely — check that events occurred
		const allEvents = result.ticks.flatMap((t) => [...t.events]);
		const sourceActivations = allEvents.filter((e) => e.type === "water_source_activate");
		expect(sourceActivations.length).toBe(1);
	});

	test("scoring works end-to-end", () => {
		const level = makeTestLevel();
		const loaded = initGame(level);
		expect(loaded.success).toBe(true);
		if (!loaded.success) return;

		const result = runGameSimulation(loaded.state);
		const score = scoreGame(result, level);

		expect(score.resourceScore).toBeGreaterThanOrEqual(0);
		expect(score.totalScore).toBeGreaterThanOrEqual(0);
	});

	test("serialize and deserialize round-trip", () => {
		const level = makeTestLevel();
		const loaded = initGame(level);
		expect(loaded.success).toBe(true);
		if (!loaded.success) return;

		// Place a structure
		const dam = createDam("concrete", ["e"]);
		const placed = placeGameStructure(loaded.state, { q: 1, r: 0 }, dam);
		expect(placed.success).toBe(true);
		if (!placed.success) return;

		// Serialize and deserialize (typed round-trip)
		const serialized = serializeState(placed.state);
		// Verify JSON compatibility (doesn't throw)
		JSON.stringify(serialized);
		const restored = deserializeState(serialized);

		expect(restored.budgetUsed).toBe(placed.state.budgetUsed);
		expect(restored.tiles.size).toBe(placed.state.tiles.size);
		expect(restored.placedStructures.size).toBe(1);

		// Run simulation on restored state — should produce same results
		const result1 = runGameSimulation(placed.state);
		const result2 = runGameSimulation(restored);
		expect(result1.ticks.length).toBe(result2.ticks.length);
	});

	test("determinism: same level + structures → same simulation", () => {
		const level = makeTestLevel();
		const loaded = initGame(level);
		expect(loaded.success).toBe(true);
		if (!loaded.success) return;

		const dam = createDam("wood", ["se"]);
		const placed = placeGameStructure(loaded.state, { q: 1, r: 0 }, dam);
		expect(placed.success).toBe(true);
		if (!placed.success) return;

		const result1 = runGameSimulation(placed.state);
		const result2 = runGameSimulation(placed.state);

		// Same events per tick
		for (let i = 0; i < result1.ticks.length; i++) {
			const t1 = result1.ticks[i];
			const t2 = result2.ticks[i];
			if (t1 === undefined || t2 === undefined) continue;
			expect(t1.events.length).toBe(t2.events.length);
			expect(t1.flows.length).toBe(t2.flows.length);
		}

		// Same final water levels
		for (const [key, level1] of result1.finalWaterLevels) {
			expect(result2.finalWaterLevels.get(key)).toBe(level1);
		}
	});
});
