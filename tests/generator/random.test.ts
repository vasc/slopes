import { describe, expect, test } from "bun:test";
import { createRng } from "../../src/generator/random.ts";

describe("createRng", () => {
	test("produces deterministic sequence from same seed", () => {
		const rng1 = createRng(42);
		const rng2 = createRng(42);
		const seq1 = [rng1.next(), rng1.next(), rng1.next()];
		const seq2 = [rng2.next(), rng2.next(), rng2.next()];
		expect(seq1).toEqual(seq2);
	});

	test("different seeds produce different sequences", () => {
		const rng1 = createRng(1);
		const rng2 = createRng(2);
		const val1 = rng1.next();
		const val2 = rng2.next();
		expect(val1).not.toBe(val2);
	});

	test("next() returns values in [0, 1)", () => {
		const rng = createRng(123);
		for (let i = 0; i < 1000; i++) {
			const val = rng.next();
			expect(val).toBeGreaterThanOrEqual(0);
			expect(val).toBeLessThan(1);
		}
	});

	test("nextInt() returns values in [min, max]", () => {
		const rng = createRng(456);
		const seen = new Set<number>();
		for (let i = 0; i < 1000; i++) {
			const val = rng.nextInt(3, 7);
			expect(val).toBeGreaterThanOrEqual(3);
			expect(val).toBeLessThanOrEqual(7);
			expect(Number.isInteger(val)).toBe(true);
			seen.add(val);
		}
		// Should hit all values 3..7 in 1000 tries
		expect(seen.size).toBe(5);
	});

	test("nextFloat() returns values in [min, max)", () => {
		const rng = createRng(789);
		for (let i = 0; i < 1000; i++) {
			const val = rng.nextFloat(2.5, 5.5);
			expect(val).toBeGreaterThanOrEqual(2.5);
			expect(val).toBeLessThan(5.5);
		}
	});

	test("pick() returns an element from the array", () => {
		const rng = createRng(101);
		const items = ["a", "b", "c"] as const;
		const seen = new Set<string>();
		for (let i = 0; i < 100; i++) {
			const picked = rng.pick(items);
			expect(items).toContain(picked);
			seen.add(picked);
		}
		// Should pick all 3 items at some point
		expect(seen.size).toBe(3);
	});

	test("pick() throws on empty array", () => {
		const rng = createRng(102);
		expect(() => rng.pick([])).toThrow("Cannot pick from empty array");
	});

	test("shuffle() returns a permutation of the input", () => {
		const rng = createRng(201);
		const items = [1, 2, 3, 4, 5];
		const shuffled = rng.shuffle(items);
		expect(shuffled).toHaveLength(5);
		expect(shuffled.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
	});

	test("shuffle() does not mutate the original", () => {
		const rng = createRng(202);
		const items = [1, 2, 3, 4, 5];
		const copy = [...items];
		rng.shuffle(items);
		expect(items).toEqual(copy);
	});

	test("shuffle() is deterministic from same seed", () => {
		const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const rng1 = createRng(303);
		const rng2 = createRng(303);
		expect(rng1.shuffle(items)).toEqual(rng2.shuffle(items));
	});
});
