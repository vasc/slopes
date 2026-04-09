import { describe, expect, test } from "bun:test";
import { generatePuzzle, isDifficulty } from "../../src/generator/puzzle-generator.ts";
import type { Difficulty } from "../../src/generator/puzzle-generator.ts";
import { validateLevel } from "../../src/level/level-validator.ts";

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
});
