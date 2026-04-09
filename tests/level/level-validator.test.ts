import { describe, expect, test } from "bun:test";
import { validateLevel } from "../../src/level/level-validator.ts";
import type { LevelDefinition, TileDefinition } from "../../src/types.ts";

function makeValidLevel(): LevelDefinition {
	return {
		id: "test-level",
		name: "Test Level",
		description: "A test level",
		gridRadius: 1,
		tiles: [
			{
				coord: { q: 0, r: 0 },
				elevation: 20,
				terrain: "peak",
				content: { kind: "source", flowRate: 10, startTick: 0, duration: 5 },
			},
			{ coord: { q: 1, r: -1 }, elevation: 10, terrain: "ridge", content: { kind: "empty" } },
			{
				coord: { q: 1, r: 0 },
				elevation: 8,
				terrain: "slope",
				content: {
					kind: "resource",
					resourceType: "village",
					name: "Test Village",
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
		availableStructures: ["dam", "absorption_basin"],
		simulationDuration: 10,
		parBudget: 25,
	};
}

function withTiles(level: LevelDefinition, tiles: readonly TileDefinition[]): LevelDefinition {
	return { ...level, tiles };
}

describe("validateLevel", () => {
	describe("structural constraints", () => {
		test("valid level returns empty error array", () => {
			expect(validateLevel(makeValidLevel())).toEqual([]);
		});

		test("gridRadius less than 1 is invalid", () => {
			const level = { ...makeValidLevel(), gridRadius: 0 };
			const errors = validateLevel(level);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors.some((e) => e.toLowerCase().includes("radius"))).toBe(true);
		});

		test("negative budget is invalid", () => {
			const level = { ...makeValidLevel(), budget: -1 };
			const errors = validateLevel(level);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors.some((e) => e.toLowerCase().includes("budget"))).toBe(true);
		});

		test("simulationDuration less than 1 is invalid", () => {
			const level = { ...makeValidLevel(), simulationDuration: 0 };
			const errors = validateLevel(level);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors.some((e) => e.toLowerCase().includes("duration"))).toBe(true);
		});

		test("negative parBudget is invalid", () => {
			const level = { ...makeValidLevel(), parBudget: -5 };
			const errors = validateLevel(level);
			expect(errors.length).toBeGreaterThan(0);
		});

		test("parBudget exceeding budget is invalid", () => {
			const level = { ...makeValidLevel(), budget: 50, parBudget: 60 };
			const errors = validateLevel(level);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors.some((e) => e.toLowerCase().includes("par"))).toBe(true);
		});

		test("parBudget equal to budget is valid", () => {
			const level = { ...makeValidLevel(), budget: 50, parBudget: 50 };
			expect(validateLevel(level)).toEqual([]);
		});
	});

	describe("tile constraints", () => {
		test("duplicate tile coordinates detected", () => {
			const base = makeValidLevel();
			const firstTile = base.tiles[0];
			if (firstTile === undefined) throw new Error("Missing tile");
			// Add a duplicate of the first tile
			const tiles = [...base.tiles, firstTile];
			const errors = validateLevel(withTiles(base, tiles));
			expect(errors.some((e) => e.toLowerCase().includes("duplicate"))).toBe(true);
		});

		test("tile outside grid radius detected", () => {
			const base = makeValidLevel(); // radius 1
			const tiles: readonly TileDefinition[] = [
				...base.tiles,
				{
					coord: { q: 5, r: 5 },
					elevation: 5,
					terrain: "slope",
					content: { kind: "empty" },
				},
			];
			const errors = validateLevel(withTiles(base, tiles));
			expect(errors.some((e) => e.toLowerCase().includes("outside"))).toBe(true);
		});

		test("non-finite elevation detected", () => {
			const base = makeValidLevel();
			const tiles = base.tiles.map((t, i) => (i === 1 ? { ...t, elevation: Number.NaN } : t));
			const errors = validateLevel(withTiles(base, tiles));
			expect(errors.some((e) => e.toLowerCase().includes("elevation"))).toBe(true);
		});
	});

	describe("content constraints", () => {
		test("level without any water source is invalid", () => {
			const base = makeValidLevel();
			// Replace source tile with empty
			const tiles = base.tiles.map((t) =>
				t.content.kind === "source" ? { ...t, content: { kind: "empty" as const } } : t,
			);
			const errors = validateLevel(withTiles(base, tiles));
			expect(errors.some((e) => e.toLowerCase().includes("source"))).toBe(true);
		});

		test("level without any resource is invalid", () => {
			const base = makeValidLevel();
			// Replace resource tile with empty
			const tiles = base.tiles.map((t) =>
				t.content.kind === "resource" ? { ...t, content: { kind: "empty" as const } } : t,
			);
			const errors = validateLevel(withTiles(base, tiles));
			expect(errors.some((e) => e.toLowerCase().includes("resource"))).toBe(true);
		});

		test("source with zero flow rate is invalid", () => {
			const base = makeValidLevel();
			const tiles = base.tiles.map((t) =>
				t.content.kind === "source" ? { ...t, content: { ...t.content, flowRate: 0 } } : t,
			);
			const errors = validateLevel(withTiles(base, tiles));
			expect(errors.some((e) => e.toLowerCase().includes("flow"))).toBe(true);
		});

		test("source with zero duration is invalid", () => {
			const base = makeValidLevel();
			const tiles = base.tiles.map((t) =>
				t.content.kind === "source" ? { ...t, content: { ...t.content, duration: 0 } } : t,
			);
			const errors = validateLevel(withTiles(base, tiles));
			expect(errors.some((e) => e.toLowerCase().includes("duration"))).toBe(true);
		});

		test("resource with zero damage threshold is invalid", () => {
			const base = makeValidLevel();
			const tiles = base.tiles.map((t) =>
				t.content.kind === "resource" ? { ...t, content: { ...t.content, damageThreshold: 0 } } : t,
			);
			const errors = validateLevel(withTiles(base, tiles));
			expect(errors.some((e) => e.toLowerCase().includes("threshold"))).toBe(true);
		});

		test("resource with zero value is invalid", () => {
			const base = makeValidLevel();
			const tiles = base.tiles.map((t) =>
				t.content.kind === "resource" ? { ...t, content: { ...t.content, value: 0 } } : t,
			);
			const errors = validateLevel(withTiles(base, tiles));
			expect(errors.some((e) => e.toLowerCase().includes("value"))).toBe(true);
		});
	});
});
