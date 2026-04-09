import { describe, expect, test } from "bun:test";
import { TERRAIN_TABLE, isBuildable } from "../../src/terrain/terrain.ts";
import type { TerrainType } from "../../src/types.ts";

const ALL_TERRAIN_TYPES: readonly TerrainType[] = [
	"peak",
	"ridge",
	"slope",
	"valley",
	"plain",
	"basin",
	"cliff",
	"riverbed",
];

describe("terrain domain invariants", () => {
	test("flow resistance is bounded [0, 1] for all terrains", () => {
		for (const terrain of ALL_TERRAIN_TYPES) {
			const props = TERRAIN_TABLE[terrain];
			expect(props.flowResistance).toBeGreaterThanOrEqual(0);
			expect(props.flowResistance).toBeLessThanOrEqual(1);
		}
	});

	test("every terrain can hold some water", () => {
		for (const terrain of ALL_TERRAIN_TYPES) {
			expect(TERRAIN_TABLE[terrain].waterCapacity).toBeGreaterThan(0);
		}
	});

	test("riverbed has zero flow resistance — water moves freely through natural channels", () => {
		expect(TERRAIN_TABLE.riverbed.flowResistance).toBe(0);
	});

	test("peak resists flow more than any other terrain", () => {
		const peakResistance = TERRAIN_TABLE.peak.flowResistance;
		for (const terrain of ALL_TERRAIN_TYPES) {
			expect(peakResistance).toBeGreaterThanOrEqual(TERRAIN_TABLE[terrain].flowResistance);
		}
	});

	test("basin holds more water than any other terrain", () => {
		const basinCapacity = TERRAIN_TABLE.basin.waterCapacity;
		for (const terrain of ALL_TERRAIN_TYPES) {
			expect(basinCapacity).toBeGreaterThanOrEqual(TERRAIN_TABLE[terrain].waterCapacity);
		}
	});

	test("peak holds less water than any other terrain", () => {
		const peakCapacity = TERRAIN_TABLE.peak.waterCapacity;
		for (const terrain of ALL_TERRAIN_TYPES) {
			expect(peakCapacity).toBeLessThanOrEqual(TERRAIN_TABLE[terrain].waterCapacity);
		}
	});
});

describe("isBuildable", () => {
	test("natural obstacles are not buildable: peak, cliff, riverbed", () => {
		expect(isBuildable("peak")).toBe(false);
		expect(isBuildable("cliff")).toBe(false);
		expect(isBuildable("riverbed")).toBe(false);
	});

	test("habitable terrain is buildable: ridge, slope, valley, plain, basin", () => {
		expect(isBuildable("ridge")).toBe(true);
		expect(isBuildable("slope")).toBe(true);
		expect(isBuildable("valley")).toBe(true);
		expect(isBuildable("plain")).toBe(true);
		expect(isBuildable("basin")).toBe(true);
	});
});
