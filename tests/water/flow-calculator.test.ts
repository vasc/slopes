import { describe, expect, test } from "bun:test";
import { hexKey } from "../../src/hex/coordinates.ts";
import type { Tile } from "../../src/types.ts";
import { computeTick } from "../../src/water/flow-calculator.ts";

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

describe("computeTick", () => {
	test("water flows downhill", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, { waterLevel: 100 }),
			makeTile(1, 0, 5), // east neighbor, lower
		]);

		const result = computeTick(tiles, 0);

		// Water should have flowed to the lower tile
		const highState = result.tileUpdates.get("0,0");
		const lowState = result.tileUpdates.get("1,0");

		expect(highState).toBeDefined();
		expect(lowState).toBeDefined();
		if (highState === undefined || lowState === undefined) return;

		expect(highState.waterLevel).toBeLessThan(100);
		expect(lowState.waterLevel).toBeGreaterThan(0);
	});

	test("water does not flow uphill", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 5, { waterLevel: 50 }),
			makeTile(1, 0, 10), // east neighbor, higher
		]);

		const result = computeTick(tiles, 0);
		const lowState = result.tileUpdates.get("0,0");
		const highState = result.tileUpdates.get("1,0");

		expect(lowState).toBeDefined();
		expect(highState).toBeDefined();
		if (lowState === undefined || highState === undefined) return;

		// Water stays — can't flow uphill and no other neighbors
		expect(lowState.waterLevel).toBe(50);
		expect(highState.waterLevel).toBe(0);
	});

	test("water distributes proportionally to multiple downhill neighbors", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, { waterLevel: 100 }),
			makeTile(1, 0, 5), // e, diff=5
			makeTile(0, 1, 3), // se, diff=7
		]);

		const result = computeTick(tiles, 0);

		// Check flow edges from origin — both E and SE should receive flow
		const flowsFromOrigin = result.flows.filter((f) => f.from.q === 0 && f.from.r === 0);
		expect(flowsFromOrigin.length).toBe(2);

		const eFlow = flowsFromOrigin.find((f) => f.to.q === 1 && f.to.r === 0);
		const seFlow = flowsFromOrigin.find((f) => f.to.q === 0 && f.to.r === 1);

		expect(eFlow).toBeDefined();
		expect(seFlow).toBeDefined();
		if (eFlow === undefined || seFlow === undefined) return;

		// Both receive water from origin
		expect(eFlow.flowRate).toBeGreaterThan(0);
		expect(seFlow.flowRate).toBeGreaterThan(0);

		// SE should get more (bigger elevation diff → higher weight)
		expect(seFlow.flowRate).toBeGreaterThan(eFlow.flowRate);
	});

	test("water source activates and injects water", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				content: {
					kind: "source",
					source: { flowRate: 50, startTick: 0, duration: 5 },
				},
			}),
			makeTile(1, 0, 5),
		]);

		const result = computeTick(tiles, 0);

		// Should have activation event
		const activateEvents = result.events.filter((e) => e.type === "water_source_activate");
		expect(activateEvents.length).toBe(1);

		// Water should have been injected and flowed
		const sourceState = result.tileUpdates.get("0,0");
		const neighborState = result.tileUpdates.get("1,0");
		expect(sourceState).toBeDefined();
		expect(neighborState).toBeDefined();
		if (neighborState === undefined) return;
		expect(neighborState.waterLevel).toBeGreaterThan(0);
	});

	test("water source depletes after duration", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				content: {
					kind: "source",
					source: { flowRate: 50, startTick: 0, duration: 3 },
				},
			}),
		]);

		const result = computeTick(tiles, 3); // tick == startTick + duration
		const depleteEvents = result.events.filter((e) => e.type === "water_source_deplete");
		expect(depleteEvents.length).toBe(1);
	});

	test("dam blocks flow on specified edges", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				waterLevel: 100,
				content: {
					kind: "structure",
					structure: {
						kind: "dam",
						material: "concrete",
						cost: 25,
						durability: 500,
						currentDurability: 500,
						blockCapacity: 100, // Can block all 100 units
						blockedEdges: ["e"],
						broken: false,
					},
				},
			}),
			makeTile(1, 0, 5), // east neighbor
		]);

		const result = computeTick(tiles, 0);
		const eastState = result.tileUpdates.get("1,0");

		expect(eastState).toBeDefined();
		if (eastState === undefined) return;

		// Dam should block flow to the east
		expect(eastState.waterLevel).toBe(0);
	});

	test("splitter redirects water to specified edges", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				waterLevel: 100,
				content: {
					kind: "structure",
					structure: {
						kind: "splitter",
						cost: 15,
						durability: 200,
						currentDurability: 200,
						redirectEdges: ["se"], // Only allow SE
						broken: false,
					},
				},
			}),
			makeTile(1, 0, 5), // east
			makeTile(0, 1, 5), // southeast
		]);

		const result = computeTick(tiles, 0);
		const eastState = result.tileUpdates.get("1,0");
		const seState = result.tileUpdates.get("0,1");

		expect(eastState).toBeDefined();
		expect(seState).toBeDefined();
		if (eastState === undefined || seState === undefined) return;

		// Only SE should receive water
		expect(eastState.waterLevel).toBe(0);
		expect(seState.waterLevel).toBeGreaterThan(0);
	});

	test("resource takes damage from water", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 5, {
				waterLevel: 30,
				content: {
					kind: "resource",
					resource: {
						type: "village",
						name: "Test Village",
						damageThreshold: 100,
						value: 50,
						state: { status: "intact", accumulatedDamage: 0 },
					},
				},
			}),
		]);

		const result = computeTick(tiles, 0);
		const damageEvents = result.events.filter((e) => e.type === "resource_damaged");
		expect(damageEvents.length).toBe(1);

		const tileState = result.tileUpdates.get("0,0");
		expect(tileState).toBeDefined();
		if (tileState === undefined) return;
		if (tileState.content.kind === "resource") {
			if (tileState.content.resource.state.status === "intact") {
				expect(tileState.content.resource.state.accumulatedDamage).toBe(30);
			}
		}
	});

	test("resource gets destroyed when damage exceeds threshold", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 5, {
				waterLevel: 60,
				content: {
					kind: "resource",
					resource: {
						type: "bridge",
						name: "Test Bridge",
						damageThreshold: 50,
						value: 30,
						state: { status: "intact", accumulatedDamage: 0 },
					},
				},
			}),
		]);

		const result = computeTick(tiles, 5);
		const destroyEvents = result.events.filter((e) => e.type === "resource_destroyed");
		expect(destroyEvents.length).toBe(1);

		const tileState = result.tileUpdates.get("0,0");
		expect(tileState).toBeDefined();
		if (tileState === undefined) return;
		if (tileState.content.kind === "resource") {
			expect(tileState.content.resource.state.status).toBe("destroyed");
		}
	});

	test("no flow when tile has no water", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10), // empty, no water
			makeTile(1, 0, 5),
		]);

		const result = computeTick(tiles, 0);
		expect(result.flows.length).toBe(0);
	});

	test("absorption basin increases tile capacity", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 5, {
				waterLevel: 200, // Over normal slope capacity of 50
				content: {
					kind: "structure",
					structure: {
						kind: "absorption_basin",
						cost: 12,
						extraCapacity: 200,
					},
				},
			}),
		]);

		const result = computeTick(tiles, 0);
		// With basin: capacity = 50 + 200 = 250, water = 200, no overflow
		const overflowEvents = result.events.filter((e) => e.type === "tile_overflow");
		expect(overflowEvents.length).toBe(0);
	});

	test("tile overflows when water exceeds capacity", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 5, { waterLevel: 100 }), // slope capacity = 50
		]);

		const result = computeTick(tiles, 0);
		const overflowEvents = result.events.filter((e) => e.type === "tile_overflow");
		expect(overflowEvents.length).toBe(1);
	});

	test("water conservation — total water is preserved across a tick", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 20, { waterLevel: 100 }),
			makeTile(1, 0, 10), // e
			makeTile(0, 1, 12), // se
			makeTile(-1, 1, 15), // sw
		]);

		const result = computeTick(tiles, 0);
		let totalAfter = 0;
		for (const state of result.tileUpdates.values()) {
			totalAfter += state.waterLevel;
		}
		// All 100 liters should still exist somewhere
		expect(Math.round(totalAfter * 1000) / 1000).toBe(100);
	});

	test("steeper gradient produces proportionally more flow", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 20, { waterLevel: 100 }),
			makeTile(1, 0, 10), // e: diff=10
			makeTile(0, 1, 15), // se: diff=5
		]);

		const result = computeTick(tiles, 0);
		const eFlow = result.flows.find((f) => f.to.q === 1 && f.to.r === 0);
		const seFlow = result.flows.find((f) => f.to.q === 0 && f.to.r === 1);

		expect(eFlow).toBeDefined();
		expect(seFlow).toBeDefined();
		if (eFlow === undefined || seFlow === undefined) return;

		// Steeper drop (10 > 5) should receive more water
		expect(eFlow.flowRate).toBeGreaterThan(seFlow.flowRate);
	});

	test("broken dam does not block any flow", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				waterLevel: 100,
				content: {
					kind: "structure",
					structure: {
						kind: "dam",
						material: "concrete",
						cost: 25,
						durability: 500,
						currentDurability: 0,
						blockCapacity: 100,
						blockedEdges: ["e"],
						broken: true,
					},
				},
			}),
			makeTile(1, 0, 5),
		]);

		const result = computeTick(tiles, 0);
		const eastState = result.tileUpdates.get("1,0");
		expect(eastState).toBeDefined();
		if (eastState === undefined) return;
		// Broken dam should not block — water flows through
		expect(eastState.waterLevel).toBeGreaterThan(0);
	});

	test("drainage channel makes water flow through low-resistance path", () => {
		// Two downhill neighbors: one normal slope, one with drainage channel
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				waterLevel: 100,
				content: {
					kind: "structure",
					structure: {
						kind: "drainage_channel",
						cost: 8,
						channelEdges: ["se"], // drainage toward SE
					},
				},
			}),
			makeTile(1, 0, 5, { terrain: "slope" }), // e: slope resistance 0.2
			makeTile(0, 1, 5, { terrain: "slope" }), // se: slope resistance, but drainage → 0
		]);

		const result = computeTick(tiles, 0);
		const eFlow = result.flows.find((f) => f.to.q === 1 && f.to.r === 0);
		const seFlow = result.flows.find((f) => f.to.q === 0 && f.to.r === 1);

		expect(eFlow).toBeDefined();
		expect(seFlow).toBeDefined();
		if (eFlow === undefined || seFlow === undefined) return;

		// SE has drainage channel (resistance=0) vs E with slope resistance (0.2)
		// SE should receive more flow
		expect(seFlow.flowRate).toBeGreaterThan(eFlow.flowRate);
	});

	test("multiple sources inject independently in the same tick", () => {
		const tiles = tilesMap([
			makeTile(0, 0, 10, {
				content: {
					kind: "source",
					source: { flowRate: 30, startTick: 0, duration: 5 },
				},
			}),
			makeTile(1, -1, 10, {
				content: {
					kind: "source",
					source: { flowRate: 20, startTick: 0, duration: 5 },
				},
			}),
			makeTile(1, 0, 5), // downhill from both
		]);

		const result = computeTick(tiles, 0);
		const activations = result.events.filter((e) => e.type === "water_source_activate");
		// Both sources should activate
		expect(activations.length).toBe(2);
	});
});
