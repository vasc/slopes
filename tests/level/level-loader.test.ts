import { describe, expect, test } from "bun:test";
import { loadLevel } from "../../src/level/level-loader.ts";
import type { LevelDefinition } from "../../src/types.ts";
import { runSimulation } from "../../src/water/simulation.ts";

function makeValidLevel(): LevelDefinition {
	return {
		id: "loader-test",
		name: "Loader Test",
		description: "A test level for loader",
		gridRadius: 1,
		tiles: [
			{
				coord: { q: 0, r: 0 },
				elevation: 20,
				terrain: "peak",
				content: { kind: "source", flowRate: 25, startTick: 0, duration: 8 },
			},
			{ coord: { q: 1, r: -1 }, elevation: 10, terrain: "ridge", content: { kind: "empty" } },
			{
				coord: { q: 1, r: 0 },
				elevation: 6,
				terrain: "slope",
				content: {
					kind: "resource",
					resourceType: "village",
					name: "Hamlet",
					damageThreshold: 100,
					value: 50,
				},
			},
			{ coord: { q: 0, r: 1 }, elevation: 8, terrain: "slope", content: { kind: "empty" } },
			{
				coord: { q: -1, r: 1 },
				elevation: 10,
				terrain: "ridge",
				content: { kind: "empty" },
			},
			{
				coord: { q: -1, r: 0 },
				elevation: 12,
				terrain: "ridge",
				content: { kind: "empty" },
			},
			{
				coord: { q: 0, r: -1 },
				elevation: 14,
				terrain: "ridge",
				content: { kind: "empty" },
			},
		],
		budget: 50,
		availableStructures: ["dam"],
		simulationDuration: 10,
		parBudget: 25,
	};
}

describe("loadLevel", () => {
	test("valid level loads successfully", () => {
		const result = loadLevel(makeValidLevel());
		expect(result.success).toBe(true);
	});

	test("invalid level returns errors instead of crashing", () => {
		const invalid: LevelDefinition = { ...makeValidLevel(), gridRadius: 0 };
		const result = loadLevel(invalid);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});

	test("simulation starts clean — no pre-existing water damage", () => {
		const result = loadLevel(makeValidLevel());
		if (!result.success) throw new Error("Load failed");
		for (const tile of result.state.tiles.values()) {
			expect(tile.waterLevel).toBe(0);
			if (tile.content.kind === "resource") {
				expect(tile.content.resource.state.status).toBe("intact");
			}
		}
	});

	test("loaded level can be simulated end-to-end", () => {
		const level = makeValidLevel();
		const result = loadLevel(level);
		if (!result.success) throw new Error("Load failed");
		const sim = runSimulation(result.state.tiles, level.simulationDuration, 0);
		expect(sim.ticks.length).toBe(level.simulationDuration);
	});
});
