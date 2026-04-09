import { describe, expect, test } from "bun:test";
import { hexKey } from "../../src/hex/coordinates.ts";
import type { Tile } from "../../src/types.ts";
import { runSimulation, stepSimulation } from "../../src/water/simulation.ts";

function makeTile(
	q: number,
	r: number,
	elevation: number,
	overrides: Partial<Pick<Tile, "waterLevel" | "content" | "terrain">> = {},
): Tile {
	return {
		coord: { q, r },
		elevation,
		terrain: overrides.terrain ?? "slope",
		waterLevel: overrides.waterLevel ?? 0,
		content: overrides.content ?? { kind: "empty" },
	};
}

function tilesMap(tiles: Tile[]): Map<string, Tile> {
	const map = new Map<string, Tile>();
	for (const tile of tiles) {
		map.set(hexKey(tile.coord), tile);
	}
	return map;
}

describe("stepSimulation", () => {
	test("single step returns updated tiles", () => {
		const tiles = tilesMap([makeTile(0, 0, 10, { waterLevel: 50 }), makeTile(1, 0, 5)]);

		const result = stepSimulation(tiles, 0);
		expect(result.tickResult.tick).toBe(0);
		expect(result.updatedTiles.size).toBe(2);

		const highTile = result.updatedTiles.get("0,0");
		const lowTile = result.updatedTiles.get("1,0");

		expect(highTile).toBeDefined();
		expect(lowTile).toBeDefined();
		if (highTile === undefined || lowTile === undefined) return;

		expect(highTile.waterLevel).toBeLessThan(50);
		expect(lowTile.waterLevel).toBeGreaterThan(0);
	});

	test("preserves tile properties other than water", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, { waterLevel: 50, terrain: "ridge" }),
			makeTile(1, 0, 5),
		]);

		const result = stepSimulation(tiles, 0);
		const tile = result.updatedTiles.get("0,0");
		expect(tile).toBeDefined();
		if (tile === undefined) return;
		expect(tile.terrain).toBe("ridge");
		expect(tile.elevation).toBe(10);
	});
});

describe("runSimulation", () => {
	test("runs for specified duration", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				content: {
					kind: "source",
					source: { flowRate: 20, startTick: 0, duration: 3 },
				},
			}),
			makeTile(1, 0, 5),
		]);

		const result = runSimulation(tiles, 5, 0);
		expect(result.ticks.length).toBe(5);
		expect(result.ticks[0]?.tick).toBe(0);
		expect(result.ticks[4]?.tick).toBe(4);
	});

	test("water accumulates over multiple ticks", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				content: {
					kind: "source",
					source: { flowRate: 20, startTick: 0, duration: 5 },
				},
			}),
			makeTile(1, 0, 5),
		]);

		const result = runSimulation(tiles, 5, 0);
		const lastTick = result.ticks[4];
		expect(lastTick).toBeDefined();
		if (lastTick === undefined) return;

		const neighborWater = lastTick.waterLevels.get("1,0");
		expect(neighborWater).toBeDefined();
		if (neighborWater === undefined) return;
		expect(neighborWater).toBeGreaterThan(0);
	});

	test("tracks destroyed resources", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				content: {
					kind: "source",
					source: { flowRate: 100, startTick: 0, duration: 10 },
				},
			}),
			makeTile(1, 0, 5, {
				content: {
					kind: "resource",
					resource: {
						type: "village",
						name: "Riverside Village",
						damageThreshold: 50,
						value: 100,
						state: { status: "intact", accumulatedDamage: 0 },
					},
				},
			}),
		]);

		const result = runSimulation(tiles, 10, 0);
		expect(result.resourcesDestroyed.length).toBe(1);
		expect(result.allResourcesSurvived).toBe(false);
	});

	test("surviving resources contribute to score", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, { waterLevel: 1 }), // tiny amount of water
			makeTile(1, 0, 5, {
				content: {
					kind: "resource",
					resource: {
						type: "farmland",
						name: "Golden Fields",
						damageThreshold: 10000, // Very sturdy
						value: 75,
						state: { status: "intact", accumulatedDamage: 0 },
					},
				},
			}),
		]);

		const result = runSimulation(tiles, 3, 10);
		expect(result.resourcesSurvived.length).toBe(1);
		expect(result.allResourcesSurvived).toBe(true);
		expect(result.score).toBe(75);
		expect(result.totalBudgetUsed).toBe(10);
	});

	test("deterministic: same input produces same output", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				content: {
					kind: "source",
					source: { flowRate: 30, startTick: 0, duration: 5 },
				},
			}),
			makeTile(1, 0, 7),
			makeTile(0, 1, 5),
			makeTile(-1, 1, 3),
		]);

		const result1 = runSimulation(tiles, 8, 0);
		const result2 = runSimulation(tiles, 8, 0);

		// Same number of ticks
		expect(result1.ticks.length).toBe(result2.ticks.length);

		// Same events in each tick
		for (let i = 0; i < result1.ticks.length; i++) {
			const t1 = result1.ticks[i];
			const t2 = result2.ticks[i];
			if (t1 === undefined || t2 === undefined) continue;
			expect(t1.events.length).toBe(t2.events.length);
			expect(t1.flows.length).toBe(t2.flows.length);
		}

		// Same final water levels
		for (const [key, level] of result1.finalWaterLevels) {
			expect(result2.finalWaterLevels.get(key)).toBe(level);
		}
	});

	test("empty simulation with no water", () => {
		const tiles = tilesMap([makeTile(0, 0, 10), makeTile(1, 0, 5)]);

		const result = runSimulation(tiles, 3, 0);
		expect(result.ticks.length).toBe(3);
		expect(result.score).toBe(0);
		expect(result.allResourcesSurvived).toBe(true);
	});
});
