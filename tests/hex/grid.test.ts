import { describe, expect, test } from "bun:test";
import { HexGrid } from "../../src/hex/grid.ts";
import type { HexCoord, Tile } from "../../src/types.ts";

function makeTile(q: number, r: number, elevation: number): Tile {
	return {
		coord: { q, r },
		elevation,
		terrain: "slope",
		waterLevel: 0,
		content: { kind: "empty" },
	};
}

function makeSmallGrid(): HexGrid {
	return HexGrid.generate(
		1,
		(coord) => 10 - Math.abs(coord.q) - Math.abs(coord.r),
		() => "slope",
	);
}

describe("HexGrid", () => {
	test("fromTiles creates grid with correct size", () => {
		const tiles = [makeTile(0, 0, 10), makeTile(1, 0, 8), makeTile(0, 1, 7)];
		const grid = HexGrid.fromTiles(tiles, 1);
		expect(grid.size).toBe(3);
	});

	test("getTile returns tile for valid coord", () => {
		const grid = makeSmallGrid();
		const tile = grid.getTile({ q: 0, r: 0 });
		expect(tile).toBeDefined();
		expect(tile?.coord).toEqual({ q: 0, r: 0 });
	});

	test("getTile returns undefined for out-of-bounds coord", () => {
		const grid = makeSmallGrid();
		expect(grid.getTile({ q: 10, r: 10 })).toBeUndefined();
	});

	test("setTile returns new grid with updated tile", () => {
		const grid = makeSmallGrid();
		const original = grid.getTile({ q: 0, r: 0 });
		expect(original).toBeDefined();
		if (original === undefined) return;

		const updated: Tile = { ...original, waterLevel: 50 };
		const newGrid = grid.setTile({ q: 0, r: 0 }, updated);

		// New grid has the update
		expect(newGrid.getTile({ q: 0, r: 0 })?.waterLevel).toBe(50);
		// Original grid is unchanged
		expect(grid.getTile({ q: 0, r: 0 })?.waterLevel).toBe(0);
	});

	test("getNeighborTiles returns existing neighbors", () => {
		const grid = makeSmallGrid();
		const neighbors = grid.getNeighborTiles({ q: 0, r: 0 });
		expect(neighbors.length).toBe(6); // radius-1 grid has 6 neighbors for center
	});

	test("getNeighborTiles returns fewer for edge tiles", () => {
		const grid = makeSmallGrid();
		const neighbors = grid.getNeighborTiles({ q: 1, r: 0 });
		// Edge tile of radius-1 grid has 3 neighbors
		expect(neighbors.length).toBe(3);
	});

	test("getNeighborInDirection returns correct tile", () => {
		const grid = makeSmallGrid();
		const neighbor = grid.getNeighborInDirection({ q: 0, r: 0 }, "e");
		expect(neighbor).toBeDefined();
		expect(neighbor?.coord).toEqual({ q: 1, r: 0 });
	});

	test("getNeighborInDirection returns undefined for missing neighbor", () => {
		const grid = makeSmallGrid();
		const neighbor = grid.getNeighborInDirection({ q: 1, r: 0 }, "e");
		expect(neighbor).toBeUndefined();
	});

	test("getAllTilesSorted returns tiles in elevation descending order", () => {
		const grid = makeSmallGrid();
		const sorted = grid.getAllTilesSorted();
		for (let i = 1; i < sorted.length; i++) {
			const prev = sorted[i - 1];
			const curr = sorted[i];
			if (prev !== undefined && curr !== undefined) {
				expect(prev.elevation).toBeGreaterThanOrEqual(curr.elevation);
			}
		}
	});

	test("generate creates correct number of tiles", () => {
		const grid = HexGrid.generate(
			2,
			() => 5,
			() => "plain",
		);
		expect(grid.size).toBe(19); // 1 + 6 + 12
	});

	test("generate with radius 5 creates 91 tiles", () => {
		const grid = HexGrid.generate(
			5,
			() => 5,
			() => "plain",
		);
		expect(grid.size).toBe(91);
	});

	test("placeStructure and removeStructure work", () => {
		const grid = makeSmallGrid();
		const coord: HexCoord = { q: 0, r: 0 };

		const gridWithStructure = grid.placeStructure(coord, {
			kind: "dam",
			material: "wood",
			cost: 10,
			durability: 100,
			currentDurability: 100,
			blockCapacity: 50,
			blockedEdges: ["e", "se"],
			broken: false,
		});

		const tile = gridWithStructure.getTile(coord);
		expect(tile?.content.kind).toBe("structure");

		const gridWithout = gridWithStructure.removeStructure(coord);
		expect(gridWithout.getTile(coord)?.content.kind).toBe("empty");
	});

	test("placeStructure throws on non-empty tile", () => {
		const grid = makeSmallGrid();
		const coord: HexCoord = { q: 0, r: 0 };

		const gridWithStructure = grid.placeStructure(coord, {
			kind: "absorption_basin",
			cost: 5,
			extraCapacity: 200,
		});

		expect(() =>
			gridWithStructure.placeStructure(coord, {
				kind: "absorption_basin",
				cost: 5,
				extraCapacity: 200,
			}),
		).toThrow();
	});

	test("serialize and deserialize round-trip", () => {
		const grid = makeSmallGrid();
		const serialized = grid.serialize();
		const deserialized = HexGrid.deserialize(serialized);

		expect(deserialized.size).toBe(grid.size);
		expect(deserialized.radius).toBe(grid.radius);

		grid.forEachTile((tile) => {
			const other = deserialized.getTile(tile.coord);
			expect(other).toBeDefined();
			expect(other?.elevation).toBe(tile.elevation);
			expect(other?.terrain).toBe(tile.terrain);
		});
	});

	test("getEffectiveElevation returns base elevation without structures", () => {
		const grid = makeSmallGrid();
		const tile = grid.getTile({ q: 0, r: 0 });
		expect(tile).toBeDefined();
		if (tile === undefined) return;
		expect(grid.getEffectiveElevation(tile, "e")).toBe(tile.elevation);
	});

	test("getEffectiveElevation adds levee boost on blocked edges", () => {
		const grid = makeSmallGrid();
		const coord: HexCoord = { q: 0, r: 0 };

		const gridWithLevee = grid.placeStructure(coord, {
			kind: "levee",
			cost: 15,
			durability: 200,
			currentDurability: 200,
			elevationBoost: 3,
			blockedEdges: ["e", "se"],
			broken: false,
		});

		const tile = gridWithLevee.getTile(coord);
		expect(tile).toBeDefined();
		if (tile === undefined) return;

		// Boosted edge
		expect(gridWithLevee.getEffectiveElevation(tile, "e")).toBe(tile.elevation + 3);
		// Non-boosted edge
		expect(gridWithLevee.getEffectiveElevation(tile, "w")).toBe(tile.elevation);
	});

	test("forEachTile visits all tiles", () => {
		const grid = makeSmallGrid();
		let count = 0;
		grid.forEachTile(() => {
			count++;
		});
		expect(count).toBe(7);
	});
});
