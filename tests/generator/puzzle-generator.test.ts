import { describe, expect, test } from "bun:test";
import { generatePuzzle, isDifficulty } from "../../src/generator/puzzle-generator.ts";
import type { Difficulty } from "../../src/generator/puzzle-generator.ts";
import { loadLevel } from "../../src/level/level-loader.ts";
import { validateLevel } from "../../src/level/level-validator.ts";
import { runSimulation } from "../../src/water/simulation.ts";

describe("isDifficulty", () => {
	test("returns true for valid difficulties", () => {
		expect(isDifficulty("easy")).toBe(true);
		expect(isDifficulty("medium")).toBe(true);
		expect(isDifficulty("hard")).toBe(true);
	});

	test("returns false for invalid values", () => {
		expect(isDifficulty("extreme")).toBe(false);
		expect(isDifficulty("")).toBe(false);
		expect(isDifficulty("Easy")).toBe(false);
	});
});

describe("generatePuzzle", () => {
	test("produces a valid level for each difficulty", () => {
		const difficulties: readonly Difficulty[] = ["easy", "medium", "hard"];
		for (const difficulty of difficulties) {
			const level = generatePuzzle({ radius: 4, difficulty, seed: 42, name: "Test" });
			const errors = validateLevel(level);
			expect(errors).toEqual([]);
		}
	});

	test("deterministic: same seed produces identical output", () => {
		const opts = { radius: 4, difficulty: "medium" as const, seed: 12345, name: "Determinism" };
		const level1 = generatePuzzle(opts);
		const level2 = generatePuzzle(opts);
		expect(JSON.stringify(level1)).toBe(JSON.stringify(level2));
	});

	test("different seeds produce different levels", () => {
		const base = { radius: 4, difficulty: "medium" as const, name: "Diff" };
		const level1 = generatePuzzle({ ...base, seed: 1 });
		const level2 = generatePuzzle({ ...base, seed: 2 });
		expect(JSON.stringify(level1)).not.toBe(JSON.stringify(level2));
	});

	test("respects grid radius", () => {
		for (const radius of [1, 2, 3, 5]) {
			const level = generatePuzzle({ radius, difficulty: "medium", seed: 100, name: "R" });
			expect(level.gridRadius).toBe(radius);
			const expectedTiles = 3 * radius * (radius + 1) + 1;
			expect(level.tiles).toHaveLength(expectedTiles);
		}
	});

	test("sets correct id from name and seed", () => {
		const level = generatePuzzle({
			radius: 3,
			difficulty: "easy",
			seed: 77,
			name: "My Cool Level",
		});
		expect(level.id).toBe("my-cool-level-77");
	});

	test("includes description mentioning difficulty", () => {
		const easy = generatePuzzle({ radius: 3, difficulty: "easy", seed: 1, name: "E" });
		const hard = generatePuzzle({ radius: 3, difficulty: "hard", seed: 1, name: "H" });
		expect(easy.description).toContain("gentle");
		expect(hard.description).toContain("challenging");
	});

	test("easy difficulty has fewer sources and resources than hard", () => {
		const easy = generatePuzzle({ radius: 5, difficulty: "easy", seed: 42, name: "Easy" });
		const hard = generatePuzzle({ radius: 5, difficulty: "hard", seed: 42, name: "Hard" });

		const easySources = easy.tiles.filter((t) => t.content.kind === "source").length;
		const hardSources = hard.tiles.filter((t) => t.content.kind === "source").length;
		const easyResources = easy.tiles.filter((t) => t.content.kind === "resource").length;
		const hardResources = hard.tiles.filter((t) => t.content.kind === "resource").length;

		expect(hardSources).toBeGreaterThanOrEqual(easySources);
		expect(hardResources).toBeGreaterThanOrEqual(easyResources);
	});

	test("budget and par budget are positive", () => {
		const level = generatePuzzle({ radius: 4, difficulty: "medium", seed: 999, name: "B" });
		expect(level.budget).toBeGreaterThan(0);
		expect(level.parBudget).toBeGreaterThan(0);
		expect(level.parBudget).toBeLessThanOrEqual(level.budget);
	});

	test("all tile elevations are positive", () => {
		const level = generatePuzzle({ radius: 5, difficulty: "hard", seed: 555, name: "Elev" });
		for (const tile of level.tiles) {
			expect(tile.elevation).toBeGreaterThanOrEqual(1);
		}
	});

	test("has at least one source and one resource", () => {
		// Even on tiny grids
		for (const radius of [1, 2]) {
			const level = generatePuzzle({
				radius,
				difficulty: "easy",
				seed: 42,
				name: "Tiny",
			});
			const sources = level.tiles.filter((t) => t.content.kind === "source");
			const resources = level.tiles.filter((t) => t.content.kind === "resource");
			expect(sources.length).toBeGreaterThanOrEqual(1);
			expect(resources.length).toBeGreaterThanOrEqual(1);
		}
	});

	test("available structures match difficulty", () => {
		const easy = generatePuzzle({ radius: 3, difficulty: "easy", seed: 1, name: "E" });
		const hard = generatePuzzle({ radius: 3, difficulty: "hard", seed: 1, name: "H" });
		expect(easy.availableStructures).toContain("dam");
		expect(easy.availableStructures).not.toContain("levee");
		expect(hard.availableStructures).toContain("levee");
	});

	test("simulation duration matches difficulty", () => {
		const easy = generatePuzzle({ radius: 3, difficulty: "easy", seed: 1, name: "E" });
		const medium = generatePuzzle({ radius: 3, difficulty: "medium", seed: 1, name: "M" });
		const hard = generatePuzzle({ radius: 3, difficulty: "hard", seed: 1, name: "H" });
		expect(easy.simulationDuration).toBe(12);
		expect(medium.simulationDuration).toBe(16);
		expect(hard.simulationDuration).toBe(20);
	});

	test("generated level can be loaded and simulated end-to-end", () => {
		const level = generatePuzzle({ radius: 4, difficulty: "medium", seed: 42, name: "E2E" });
		const loadResult = loadLevel(level);
		expect(loadResult.success).toBe(true);
		if (!loadResult.success) return;
		const simResult = runSimulation(loadResult.state.tiles, level.simulationDuration, 0);
		expect(simResult.ticks.length).toBe(level.simulationDuration);
	});

	test("hard puzzles with no structures cause resource destruction", () => {
		// A well-designed hard puzzle should be unwinnable without player intervention
		let destroyedCount = 0;
		for (const seed of [1, 42, 99, 200, 500]) {
			const level = generatePuzzle({ radius: 4, difficulty: "hard", seed, name: "H" });
			const loadResult = loadLevel(level);
			if (!loadResult.success) continue;
			const sim = runSimulation(loadResult.state.tiles, level.simulationDuration, 0);
			destroyedCount += sim.resourcesDestroyed.length;
		}
		// Across 5 random hard puzzles, at least some resources should be destroyed
		expect(destroyedCount).toBeGreaterThan(0);
	});

	test("sources are always higher than the resources they threaten", () => {
		const level = generatePuzzle({ radius: 4, difficulty: "hard", seed: 42, name: "Elev" });
		const sources = level.tiles.filter((t) => t.content.kind === "source");
		const resources = level.tiles.filter((t) => t.content.kind === "resource");
		const maxSourceElev = Math.max(...sources.map((s) => s.elevation));
		const minResourceElev = Math.min(...resources.map((r) => r.elevation));
		// Water flows downhill, so sources must be above resources
		expect(maxSourceElev).toBeGreaterThan(minResourceElev);
	});

	test("no tile has both source and resource content", () => {
		const level = generatePuzzle({ radius: 5, difficulty: "hard", seed: 77, name: "NoOverlap" });
		const sourceKeys = new Set(
			level.tiles
				.filter((t) => t.content.kind === "source")
				.map((t) => `${t.coord.q},${t.coord.r}`),
		);
		const resourceKeys = new Set(
			level.tiles
				.filter((t) => t.content.kind === "resource")
				.map((t) => `${t.coord.q},${t.coord.r}`),
		);
		for (const key of sourceKeys) {
			expect(resourceKeys.has(key)).toBe(false);
		}
	});

	test("budget covers at least one of the cheapest available structure", () => {
		// The cheapest structure is mud dam at cost 5
		for (const difficulty of ["easy", "medium", "hard"] as const) {
			const level = generatePuzzle({ radius: 3, difficulty, seed: 42, name: "B" });
			expect(level.budget).toBeGreaterThanOrEqual(5);
		}
	});

	test("no duplicate tile coordinates in generated level", () => {
		const level = generatePuzzle({ radius: 5, difficulty: "hard", seed: 42, name: "Dup" });
		const keys = new Set(level.tiles.map((t) => `${t.coord.q},${t.coord.r}`));
		expect(keys.size).toBe(level.tiles.length);
	});
});
