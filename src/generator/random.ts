/** Seeded pseudo-random number generator */
export interface Rng {
	/** Returns a float in [0, 1) */
	next(): number;
	/** Returns an integer in [min, max] (inclusive) */
	nextInt(min: number, max: number): number;
	/** Returns a float in [min, max) */
	nextFloat(min: number, max: number): number;
	/** Pick a random element from a non-empty array. Throws if empty. */
	pick<T>(items: readonly T[]): T;
	/** Return a shuffled copy of the array (Fisher-Yates) */
	shuffle<T>(items: readonly T[]): T[];
}

/** Create a seeded PRNG using the Mulberry32 algorithm */
export function createRng(seed: number): Rng {
	let state = seed | 0;

	function next(): number {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	function nextInt(min: number, max: number): number {
		return Math.floor(next() * (max - min + 1)) + min;
	}

	function nextFloat(min: number, max: number): number {
		return next() * (max - min) + min;
	}

	function pick<T>(items: readonly T[]): T {
		if (items.length === 0) {
			throw new Error("Cannot pick from empty array");
		}
		const index = Math.floor(next() * items.length);
		const result = items[index];
		if (result === undefined) {
			throw new Error("Unreachable: valid index returned undefined");
		}
		return result;
	}

	function shuffle<T>(items: readonly T[]): T[] {
		const result = [...items];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(next() * (i + 1));
			const a = result[i];
			const b = result[j];
			if (a === undefined || b === undefined) {
				continue;
			}
			result[i] = b;
			result[j] = a;
		}
		return result;
	}

	return { next, nextInt, nextFloat, pick, shuffle };
}
