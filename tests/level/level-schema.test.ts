import { describe, expect, test } from "bun:test";
import { LevelDefinitionSchema } from "../../src/level/level-schema.ts";

function validTiles(): unknown[] {
	return [
		{
			coord: { q: 0, r: 0 },
			elevation: 20,
			terrain: "peak",
			content: { kind: "source", flowRate: 10, startTick: 0, duration: 5 },
		},
		{
			coord: { q: 1, r: 0 },
			elevation: 5,
			terrain: "slope",
			content: {
				kind: "resource",
				resourceType: "village",
				name: "V",
				damageThreshold: 100,
				value: 50,
			},
		},
	];
}

function validLevel(): Record<string, unknown> {
	return {
		id: "schema-test",
		name: "Schema Test",
		description: "Testing schema validation",
		gridRadius: 1,
		tiles: validTiles(),
		budget: 50,
		availableStructures: ["dam"],
		simulationDuration: 10,
		parBudget: 25,
	};
}

describe("LevelDefinitionSchema", () => {
	test("accepts a well-formed level definition", () => {
		expect(LevelDefinitionSchema.safeParse(validLevel()).success).toBe(true);
	});

	test("rejects empty object", () => {
		expect(LevelDefinitionSchema.safeParse({}).success).toBe(false);
	});

	test("rejects object missing id", () => {
		expect(
			LevelDefinitionSchema.safeParse({
				name: "X",
				description: "X",
				gridRadius: 1,
				tiles: validTiles(),
				budget: 50,
				availableStructures: ["dam"],
				simulationDuration: 10,
				parBudget: 25,
			}).success,
		).toBe(false);
	});

	test("rejects object missing tiles", () => {
		expect(
			LevelDefinitionSchema.safeParse({
				id: "x",
				name: "X",
				description: "X",
				gridRadius: 1,
				budget: 50,
				availableStructures: ["dam"],
				simulationDuration: 10,
				parBudget: 25,
			}).success,
		).toBe(false);
	});

	test("rejects non-string id", () => {
		expect(LevelDefinitionSchema.safeParse({ ...validLevel(), id: 123 }).success).toBe(false);
	});

	test("rejects non-number gridRadius", () => {
		expect(LevelDefinitionSchema.safeParse({ ...validLevel(), gridRadius: "big" }).success).toBe(
			false,
		);
	});

	test("rejects non-array tiles", () => {
		expect(
			LevelDefinitionSchema.safeParse({ ...validLevel(), tiles: "not-an-array" }).success,
		).toBe(false);
	});

	test("rejects unknown terrain type", () => {
		const tiles = validTiles();
		tiles[0] = {
			coord: { q: 0, r: 0 },
			elevation: 20,
			terrain: "swamp",
			content: { kind: "empty" },
		};
		expect(LevelDefinitionSchema.safeParse({ ...validLevel(), tiles }).success).toBe(false);
	});

	test("rejects unknown resource type", () => {
		const tiles = validTiles();
		tiles[1] = {
			coord: { q: 1, r: 0 },
			elevation: 5,
			terrain: "slope",
			content: {
				kind: "resource",
				resourceType: "castle",
				name: "C",
				damageThreshold: 100,
				value: 50,
			},
		};
		expect(LevelDefinitionSchema.safeParse({ ...validLevel(), tiles }).success).toBe(false);
	});

	test("rejects unknown structure kind", () => {
		expect(
			LevelDefinitionSchema.safeParse({
				...validLevel(),
				availableStructures: ["catapult"],
			}).success,
		).toBe(false);
	});

	test("rejects unknown tile content kind", () => {
		const tiles = validTiles();
		tiles[0] = {
			coord: { q: 0, r: 0 },
			elevation: 20,
			terrain: "peak",
			content: { kind: "volcano" },
		};
		expect(LevelDefinitionSchema.safeParse({ ...validLevel(), tiles }).success).toBe(false);
	});

	test("rejects tile missing coord", () => {
		const tiles = [{ elevation: 20, terrain: "peak", content: { kind: "empty" } }];
		expect(LevelDefinitionSchema.safeParse({ ...validLevel(), tiles }).success).toBe(false);
	});

	test("rejects source content missing flowRate", () => {
		const tiles = validTiles();
		tiles[0] = {
			coord: { q: 0, r: 0 },
			elevation: 20,
			terrain: "peak",
			content: { kind: "source", startTick: 0, duration: 5 },
		};
		expect(LevelDefinitionSchema.safeParse({ ...validLevel(), tiles }).success).toBe(false);
	});

	test("rejects resource content missing name", () => {
		const tiles = validTiles();
		tiles[1] = {
			coord: { q: 1, r: 0 },
			elevation: 5,
			terrain: "slope",
			content: {
				kind: "resource",
				resourceType: "village",
				damageThreshold: 100,
				value: 50,
			},
		};
		expect(LevelDefinitionSchema.safeParse({ ...validLevel(), tiles }).success).toBe(false);
	});
});
