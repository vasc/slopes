import { describe, expect, test } from "bun:test";
import { calculateScore, checkParScore, checkWinCondition } from "../../src/scoring/scoring.ts";
import type { LevelDefinition, Resource, SimulationResult } from "../../src/types.ts";

function makeLevel(overrides: Partial<LevelDefinition> = {}): LevelDefinition {
	return {
		id: "test",
		name: "Test",
		description: "Test level",
		gridRadius: 2,
		tiles: [],
		budget: 100,
		availableStructures: ["dam"],
		simulationDuration: 10,
		parBudget: 50,
		...overrides,
	};
}

function makeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
	return {
		ticks: [],
		finalWaterLevels: new Map(),
		resourcesDestroyed: [],
		resourcesSurvived: [],
		allResourcesSurvived: true,
		totalBudgetUsed: 0,
		score: 0,
		...overrides,
	};
}

function makeResource(value: number, destroyed: boolean): Resource {
	return {
		type: "village",
		name: "Test",
		damageThreshold: 100,
		value,
		state: destroyed
			? { status: "destroyed", destroyedAtTick: 5 }
			: { status: "intact", accumulatedDamage: 0 },
	};
}

describe("calculateScore", () => {
	test("scores based on survived resource values", () => {
		const level = makeLevel();
		const result = makeResult({
			resourcesSurvived: [makeResource(50, false), makeResource(30, false)],
			resourcesDestroyed: [],
		});

		const score = calculateScore(result, level);
		expect(score.resourceScore).toBe(80);
		expect(score.allResourcesSurvived).toBe(true);
	});

	test("no budget bonus when resources destroyed", () => {
		const level = makeLevel({ parBudget: 50 });
		const result = makeResult({
			resourcesSurvived: [makeResource(50, false)],
			resourcesDestroyed: [makeResource(30, true)],
			totalBudgetUsed: 20,
		});

		const score = calculateScore(result, level);
		expect(score.budgetBonus).toBe(0);
	});

	test("budget bonus when all survived and under par", () => {
		const level = makeLevel({ parBudget: 50 });
		const result = makeResult({
			resourcesSurvived: [makeResource(100, false)],
			resourcesDestroyed: [],
			totalBudgetUsed: 30,
		});

		const score = calculateScore(result, level);
		// bonus = floor((50 - 30) * 0.5) = floor(10) = 10
		expect(score.budgetBonus).toBe(10);
		expect(score.underPar).toBe(true);
		expect(score.totalScore).toBe(110);
	});

	test("no budget bonus when over par", () => {
		const level = makeLevel({ parBudget: 50 });
		const result = makeResult({
			resourcesSurvived: [makeResource(100, false)],
			resourcesDestroyed: [],
			totalBudgetUsed: 60,
		});

		const score = calculateScore(result, level);
		expect(score.budgetBonus).toBe(0);
		expect(score.underPar).toBe(false);
	});

	test("zero score with no survivors", () => {
		const level = makeLevel();
		const result = makeResult({
			resourcesSurvived: [],
			resourcesDestroyed: [makeResource(50, true)],
		});

		const score = calculateScore(result, level);
		expect(score.resourceScore).toBe(0);
		expect(score.totalScore).toBe(0);
	});
});

describe("checkWinCondition", () => {
	test("win when all resources survived", () => {
		const result = makeResult({ allResourcesSurvived: true });
		expect(checkWinCondition(result)).toBe(true);
	});

	test("lose when any resource destroyed", () => {
		const result = makeResult({ allResourcesSurvived: false });
		expect(checkWinCondition(result)).toBe(false);
	});
});

describe("checkParScore", () => {
	test("par when survived and under budget", () => {
		const level = makeLevel({ parBudget: 50 });
		const result = makeResult({ allResourcesSurvived: true, totalBudgetUsed: 30 });
		expect(checkParScore(result, level)).toBe(true);
	});

	test("no par when over budget", () => {
		const level = makeLevel({ parBudget: 50 });
		const result = makeResult({ allResourcesSurvived: true, totalBudgetUsed: 60 });
		expect(checkParScore(result, level)).toBe(false);
	});

	test("no par when resources destroyed even if under budget", () => {
		const level = makeLevel({ parBudget: 50 });
		const result = makeResult({ allResourcesSurvived: false, totalBudgetUsed: 10 });
		expect(checkParScore(result, level)).toBe(false);
	});
});
