import { describe, expect, test } from "bun:test";
import { hexKey } from "../../src/hex/coordinates.ts";
import { HexGrid } from "../../src/hex/grid.ts";
import {
	getRemainingBudget,
	placeStructure,
	removeStructure,
} from "../../src/structures/structure-manager.ts";
import {
	createAbsorptionBasin,
	createDam,
	createDrainageChannel,
	createLevee,
	createSplitter,
	getStructureCost,
} from "../../src/structures/structure-registry.ts";
import type { GameState, LevelDefinition } from "../../src/types.ts";

function makeTestLevel(): LevelDefinition {
	return {
		id: "test-01",
		name: "Test Level",
		description: "A test level",
		gridRadius: 2,
		tiles: [],
		budget: 100,
		availableStructures: ["dam", "splitter", "drainage_channel", "absorption_basin", "levee"],
		simulationDuration: 10,
		parBudget: 50,
	};
}

function makeTestState(): GameState {
	const grid = HexGrid.generate(
		2,
		(coord) => 10 - Math.abs(coord.q) - Math.abs(coord.r),
		() => "slope",
	);
	const level = makeTestLevel();
	return {
		level,
		tiles: grid.getTilesMap(),
		placedStructures: new Map(),
		budgetUsed: 0,
	};
}

describe("structure-registry", () => {
	test("createDam creates correct structure", () => {
		const dam = createDam("wood", ["e", "se"]);
		expect(dam.kind).toBe("dam");
		expect(dam.material).toBe("wood");
		expect(dam.cost).toBe(10);
		expect(dam.durability).toBe(150);
		expect(dam.currentDurability).toBe(150);
		expect(dam.blockCapacity).toBe(40);
		expect(dam.blockedEdges).toEqual(["e", "se"]);
		expect(dam.broken).toBe(false);
	});

	test("createDam with different materials", () => {
		expect(createDam("mud", ["e"]).cost).toBe(5);
		expect(createDam("concrete", ["e"]).cost).toBe(25);
		expect(createDam("concrete", ["e"]).durability).toBe(500);
	});

	test("createSplitter creates correct structure", () => {
		const splitter = createSplitter(["sw", "w"]);
		expect(splitter.kind).toBe("splitter");
		expect(splitter.cost).toBe(15);
		expect(splitter.redirectEdges).toEqual(["sw", "w"]);
	});

	test("createDrainageChannel creates correct structure", () => {
		const channel = createDrainageChannel(["se"]);
		expect(channel.kind).toBe("drainage_channel");
		expect(channel.cost).toBe(8);
	});

	test("createAbsorptionBasin creates correct structure", () => {
		const basin = createAbsorptionBasin(200);
		expect(basin.kind).toBe("absorption_basin");
		expect(basin.extraCapacity).toBe(200);
	});

	test("createLevee creates correct structure", () => {
		const levee = createLevee(["e", "ne"], 3);
		expect(levee.kind).toBe("levee");
		expect(levee.elevationBoost).toBe(3);
		expect(levee.blockedEdges).toEqual(["e", "ne"]);
	});

	test("getStructureCost returns correct cost", () => {
		expect(getStructureCost(createDam("wood", ["e"]))).toBe(10);
		expect(getStructureCost(createSplitter(["e"]))).toBe(15);
		expect(getStructureCost(createAbsorptionBasin(100))).toBe(12);
	});
});

describe("structure-manager", () => {
	test("placeStructure succeeds on empty buildable tile", () => {
		const state = makeTestState();
		const dam = createDam("wood", ["e"]);
		const result = placeStructure(state, { q: 0, r: 0 }, dam);

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.state.budgetUsed).toBe(10);
		const tile = result.state.tiles.get(hexKey({ q: 0, r: 0 }));
		expect(tile?.content.kind).toBe("structure");
	});

	test("placeStructure fails on non-existent tile", () => {
		const state = makeTestState();
		const dam = createDam("wood", ["e"]);
		const result = placeStructure(state, { q: 99, r: 99 }, dam);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.reason).toContain("No tile");
	});

	test("placeStructure fails on occupied tile", () => {
		const state = makeTestState();
		const dam = createDam("wood", ["e"]);
		const result1 = placeStructure(state, { q: 0, r: 0 }, dam);
		expect(result1.success).toBe(true);
		if (!result1.success) return;

		const result2 = placeStructure(result1.state, { q: 0, r: 0 }, dam);
		expect(result2.success).toBe(false);
	});

	test("placeStructure fails with insufficient budget", () => {
		let state = makeTestState();
		// Use up most of the budget
		for (let i = 0; i < 4; i++) {
			const dam = createDam("concrete", ["e"]); // costs 25 each
			const coords = [
				{ q: 0, r: 0 },
				{ q: 1, r: 0 },
				{ q: 0, r: 1 },
				{ q: -1, r: 1 },
			];
			const coord = coords[i];
			if (coord === undefined) continue;
			const result = placeStructure(state, coord, dam);
			if (result.success) {
				state = result.state;
			}
		}
		// Budget should be 0 now (4 * 25 = 100)
		expect(getRemainingBudget(state)).toBe(0);

		const result = placeStructure(state, { q: -1, r: 0 }, createDam("mud", ["e"]));
		expect(result.success).toBe(false);
	});

	test("removeStructure refunds half cost", () => {
		const state = makeTestState();
		const dam = createDam("wood", ["e"]); // cost 10
		const placed = placeStructure(state, { q: 0, r: 0 }, dam);
		expect(placed.success).toBe(true);
		if (!placed.success) return;

		const removed = removeStructure(placed.state, { q: 0, r: 0 });
		expect(removed.success).toBe(true);
		if (!removed.success) return;
		expect(removed.refund).toBe(5); // half of 10
		expect(removed.state.budgetUsed).toBe(5); // 10 - 5
	});

	test("removeStructure fails on empty tile", () => {
		const state = makeTestState();
		const result = removeStructure(state, { q: 0, r: 0 });
		expect(result.success).toBe(false);
	});

	test("getRemainingBudget returns correct value", () => {
		const state = makeTestState();
		expect(getRemainingBudget(state)).toBe(100);

		const dam = createDam("wood", ["e"]);
		const result = placeStructure(state, { q: 0, r: 0 }, dam);
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(getRemainingBudget(result.state)).toBe(90);
	});

	test("placeStructure fails for unavailable structure kind", () => {
		const state: GameState = {
			...makeTestState(),
			level: { ...makeTestLevel(), availableStructures: ["dam"] },
		};
		const splitter = createSplitter(["e"]);
		const result = placeStructure(state, { q: 0, r: 0 }, splitter);
		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.reason).toContain("not available");
	});
});
