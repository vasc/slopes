import { describe, expect, test } from "bun:test";
import {
	HEX_DIRECTIONS,
	hexDistance,
	hexFromKey,
	hexKey,
	hexNeighbor,
	hexNeighbors,
	hexRing,
	hexSpiral,
	oppositeDirection,
} from "../../src/hex/coordinates.ts";

describe("hexKey / hexFromKey", () => {
	test("round-trips coordinates", () => {
		const coord = { q: 3, r: -2 };
		const key = hexKey(coord);
		expect(key).toBe("3,-2");
		const back = hexFromKey(key);
		expect(back).toEqual(coord);
	});

	test("handles origin", () => {
		expect(hexKey({ q: 0, r: 0 })).toBe("0,0");
		expect(hexFromKey("0,0")).toEqual({ q: 0, r: 0 });
	});

	test("throws on invalid key", () => {
		expect(() => hexFromKey("invalid")).toThrow();
		expect(() => hexFromKey("a,b")).toThrow();
	});
});

describe("hexNeighbor", () => {
	test("returns correct neighbors for origin", () => {
		const origin = { q: 0, r: 0 };
		expect(hexNeighbor(origin, "ne")).toEqual({ q: 1, r: -1 });
		expect(hexNeighbor(origin, "e")).toEqual({ q: 1, r: 0 });
		expect(hexNeighbor(origin, "se")).toEqual({ q: 0, r: 1 });
		expect(hexNeighbor(origin, "sw")).toEqual({ q: -1, r: 1 });
		expect(hexNeighbor(origin, "w")).toEqual({ q: -1, r: 0 });
		expect(hexNeighbor(origin, "nw")).toEqual({ q: 0, r: -1 });
	});

	test("works from non-origin", () => {
		const coord = { q: 2, r: -1 };
		expect(hexNeighbor(coord, "e")).toEqual({ q: 3, r: -1 });
		expect(hexNeighbor(coord, "sw")).toEqual({ q: 1, r: 0 });
	});
});

describe("hexNeighbors", () => {
	test("returns 6 neighbors", () => {
		const neighbors = hexNeighbors({ q: 0, r: 0 });
		expect(neighbors).toHaveLength(6);
	});

	test("all neighbors are distance 1 from center", () => {
		const center = { q: 3, r: -2 };
		const neighbors = hexNeighbors(center);
		for (const n of neighbors) {
			expect(hexDistance(center, n)).toBe(1);
		}
	});
});

describe("hexDistance", () => {
	test("distance to self is 0", () => {
		expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
	});

	test("distance to neighbor is 1", () => {
		expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
	});

	test("distance across grid", () => {
		expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -3 })).toBe(3);
		expect(hexDistance({ q: -2, r: 2 }, { q: 2, r: -2 })).toBe(4);
	});

	test("is symmetric", () => {
		const a = { q: 1, r: -3 };
		const b = { q: -2, r: 4 };
		expect(hexDistance(a, b)).toBe(hexDistance(b, a));
	});
});

describe("hexRing", () => {
	test("ring of radius 0 is just the center", () => {
		const ring = hexRing({ q: 0, r: 0 }, 0);
		expect(ring).toEqual([{ q: 0, r: 0 }]);
	});

	test("ring of radius 1 has 6 tiles", () => {
		const ring = hexRing({ q: 0, r: 0 }, 1);
		expect(ring).toHaveLength(6);
		for (const coord of ring) {
			expect(hexDistance({ q: 0, r: 0 }, coord)).toBe(1);
		}
	});

	test("ring of radius 2 has 12 tiles", () => {
		const ring = hexRing({ q: 0, r: 0 }, 2);
		expect(ring).toHaveLength(12);
		for (const coord of ring) {
			expect(hexDistance({ q: 0, r: 0 }, coord)).toBe(2);
		}
	});

	test("ring of radius 3 has 18 tiles", () => {
		const ring = hexRing({ q: 0, r: 0 }, 3);
		expect(ring).toHaveLength(18);
	});
});

describe("hexSpiral", () => {
	test("spiral of radius 0 is just center", () => {
		const spiral = hexSpiral({ q: 0, r: 0 }, 0);
		expect(spiral).toEqual([{ q: 0, r: 0 }]);
	});

	test("spiral of radius 1 has 7 tiles (1 + 6)", () => {
		const spiral = hexSpiral({ q: 0, r: 0 }, 1);
		expect(spiral).toHaveLength(7);
	});

	test("spiral of radius 2 has 19 tiles (1 + 6 + 12)", () => {
		const spiral = hexSpiral({ q: 0, r: 0 }, 2);
		expect(spiral).toHaveLength(19);
	});

	test("spiral of radius 5 has 91 tiles", () => {
		const spiral = hexSpiral({ q: 0, r: 0 }, 5);
		expect(spiral).toHaveLength(91);
	});

	test("first element is center", () => {
		const center = { q: 3, r: -1 };
		const spiral = hexSpiral(center, 2);
		expect(spiral[0]).toEqual(center);
	});

	test("no duplicates", () => {
		const spiral = hexSpiral({ q: 0, r: 0 }, 3);
		const keys = new Set(spiral.map((c) => hexKey(c)));
		expect(keys.size).toBe(spiral.length);
	});
});

describe("oppositeDirection", () => {
	test("all opposites are correct", () => {
		expect(oppositeDirection("ne")).toBe("sw");
		expect(oppositeDirection("e")).toBe("w");
		expect(oppositeDirection("se")).toBe("nw");
		expect(oppositeDirection("sw")).toBe("ne");
		expect(oppositeDirection("w")).toBe("e");
		expect(oppositeDirection("nw")).toBe("se");
	});

	test("opposite of opposite is self", () => {
		for (const dir of HEX_DIRECTIONS) {
			expect(oppositeDirection(oppositeDirection(dir))).toBe(dir);
		}
	});
});
