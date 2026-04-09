import { describe, expect, test } from "bun:test";
import {
	applyDamage,
	createResource,
	isIntact,
	totalResourceValue,
} from "../../src/resources/resource.ts";

describe("applyDamage", () => {
	test("damage below threshold accumulates without destroying", () => {
		const r = createResource("village", "V", 100, 50);
		const damaged = applyDamage(r, 30, 1);
		expect(damaged.state.status).toBe("intact");
		if (damaged.state.status === "intact") {
			expect(damaged.state.accumulatedDamage).toBe(30);
		}
	});

	test("damage reaching threshold exactly destroys the resource", () => {
		const r = createResource("village", "V", 100, 50);
		const destroyed = applyDamage(r, 100, 5);
		expect(destroyed.state.status).toBe("destroyed");
	});

	test("damage exceeding threshold destroys the resource", () => {
		const r = createResource("village", "V", 100, 50);
		const destroyed = applyDamage(r, 150, 5);
		expect(destroyed.state.status).toBe("destroyed");
	});

	test("destroyed resource records the tick it was destroyed", () => {
		const r = createResource("village", "V", 100, 50);
		const destroyed = applyDamage(r, 100, 7);
		expect(destroyed.state.status).toBe("destroyed");
		if (destroyed.state.status === "destroyed") {
			expect(destroyed.state.destroyedAtTick).toBe(7);
		}
	});

	test("applying damage to an already-destroyed resource is idempotent", () => {
		const r = createResource("village", "V", 100, 50);
		const destroyed = applyDamage(r, 100, 3);
		const again = applyDamage(destroyed, 50, 5);
		expect(again.state.status).toBe("destroyed");
		if (again.state.status === "destroyed") {
			// Should retain the original destruction tick
			expect(again.state.destroyedAtTick).toBe(3);
		}
		// Should be the exact same reference — no mutation
		expect(again).toBe(destroyed);
	});

	test("incremental damage across multiple ticks accumulates", () => {
		const r = createResource("bridge", "B", 100, 30);
		const tick1 = applyDamage(r, 40, 1);
		const tick2 = applyDamage(tick1, 40, 2);
		expect(tick2.state.status).toBe("intact");
		if (tick2.state.status === "intact") {
			expect(tick2.state.accumulatedDamage).toBe(80);
		}
		const tick3 = applyDamage(tick2, 40, 3);
		expect(tick3.state.status).toBe("destroyed");
	});

	test("zero damage does not change accumulated damage", () => {
		const r = createResource("village", "V", 100, 50);
		const result = applyDamage(r, 0, 1);
		expect(result.state.status).toBe("intact");
		if (result.state.status === "intact") {
			expect(result.state.accumulatedDamage).toBe(0);
		}
	});
});

describe("isIntact", () => {
	test("returns true for a newly created resource", () => {
		expect(isIntact(createResource("village", "V", 100, 50))).toBe(true);
	});

	test("returns true for a damaged but surviving resource", () => {
		const damaged = applyDamage(createResource("village", "V", 100, 50), 50, 1);
		expect(isIntact(damaged)).toBe(true);
	});

	test("returns false for a destroyed resource", () => {
		const destroyed = applyDamage(createResource("village", "V", 100, 50), 100, 1);
		expect(isIntact(destroyed)).toBe(false);
	});
});

describe("totalResourceValue", () => {
	test("empty array has total value 0", () => {
		expect(totalResourceValue([])).toBe(0);
	});

	test("single resource returns its value", () => {
		const r = createResource("village", "V", 100, 75);
		expect(totalResourceValue([r])).toBe(75);
	});

	test("sums values of multiple resources regardless of state", () => {
		const intact = createResource("village", "V", 100, 50);
		const destroyed = applyDamage(createResource("bridge", "B", 10, 30), 10, 1);
		expect(totalResourceValue([intact, destroyed])).toBe(80);
	});
});
