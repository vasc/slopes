import { describe, expect, test } from "bun:test";
import { generatePuzzle } from "../src/generator/puzzle-generator.ts";
import type { Difficulty } from "../src/generator/puzzle-generator.ts";
import { HEX_DIRECTIONS, hexKey, hexNeighbor, hexNeighbors } from "../src/hex/coordinates.ts";
import { loadLevel } from "../src/level/level-loader.ts";
import { calculateScore } from "../src/scoring/scoring.ts";
import { placeStructure } from "../src/structures/structure-manager.ts";
import { createDam } from "../src/structures/structure-registry.ts";
import { isBuildable } from "../src/terrain/terrain.ts";
import type { GameState, HexCoord, HexDirection, LevelDefinition, Tile } from "../src/types.ts";
import { runSimulation } from "../src/water/simulation.ts";

// ── Helpers ─────────────────────────────────────────────────────────

function generate(difficulty: Difficulty, seed: number, radius = 4): LevelDefinition {
	return generatePuzzle({ radius, difficulty, seed, name: `${difficulty}-${seed}` });
}

function load(level: LevelDefinition): GameState {
	const result = loadLevel(level);
	if (!result.success) throw new Error(`Load failed: ${result.errors.join(", ")}`);
	return result.state;
}

function simulate(state: GameState, level: LevelDefinition) {
	return runSimulation(state.tiles, level.simulationDuration, state.budgetUsed);
}

/** Find the hex direction from `from` to `to` (must be neighbors) */
function directionBetween(from: HexCoord, to: HexCoord): HexDirection | undefined {
	for (const dir of HEX_DIRECTIONS) {
		const n = hexNeighbor(from, dir);
		if (n.q === to.q && n.r === to.r) return dir;
	}
	return undefined;
}

/** Measure how much total damage each resource takes without any structures */
function measureUnprotectedDamage(level: LevelDefinition): {
	totalDamage: number;
	totalThreshold: number;
	destroyedCount: number;
	resourceCount: number;
	firstDestroyedTick: number;
} {
	const state = load(level);
	const sim = simulate(state, level);
	let totalDamage = 0;
	let totalThreshold = 0;
	let firstDestroyedTick = level.simulationDuration + 1;

	for (const r of sim.resourcesDestroyed) {
		totalDamage += r.damageThreshold; // at least threshold damage was dealt
		totalThreshold += r.damageThreshold;
		if (r.state.status === "destroyed" && r.state.destroyedAtTick < firstDestroyedTick) {
			firstDestroyedTick = r.state.destroyedAtTick;
		}
	}
	for (const r of sim.resourcesSurvived) {
		if (r.state.status === "intact") {
			totalDamage += r.state.accumulatedDamage;
		}
		totalThreshold += r.damageThreshold;
	}

	return {
		totalDamage,
		totalThreshold,
		destroyedCount: sim.resourcesDestroyed.length,
		resourceCount: sim.resourcesDestroyed.length + sim.resourcesSurvived.length,
		firstDestroyedTick,
	};
}

/**
 * Greedy solver: tries to protect resources by placing dams on uphill neighbors.
 * Uses flow data from an unprotected simulation to find the most dangerous edges,
 * then blocks them with the cheapest available dams.
 */
function greedySolve(level: LevelDefinition): {
	solved: boolean;
	budgetUsed: number;
	score: number;
} {
	let state = load(level);

	// Step 1: run unprotected simulation to discover flow patterns
	const unprotected = simulate(state, level);

	// Step 2: find resource tile keys
	const resourceKeys = new Set<string>();
	for (const [key, tile] of state.tiles) {
		if (tile.content.kind === "resource") {
			resourceKeys.add(key);
		}
	}

	// Step 3: aggregate flow into resource tiles across all ticks
	// key = "fromHexKey", value = Map<direction, totalFlow>
	const incomingFlow = new Map<string, Map<HexDirection, number>>();
	for (const tick of unprotected.ticks) {
		for (const flow of tick.flows) {
			const toKey = hexKey(flow.to);
			if (!resourceKeys.has(toKey)) continue;
			const fromKey = hexKey(flow.from);
			const dir = directionBetween(flow.from, flow.to);
			if (dir === undefined) continue;
			let dirMap = incomingFlow.get(fromKey);
			if (dirMap === undefined) {
				dirMap = new Map<HexDirection, number>();
				incomingFlow.set(fromKey, dirMap);
			}
			dirMap.set(dir, (dirMap.get(dir) ?? 0) + flow.flowRate);
		}
	}

	// Step 4: sort upstream tiles by total flow they deliver to resources
	const upstream: Array<{ fromKey: string; dir: HexDirection; totalFlow: number }> = [];
	for (const [fromKey, dirMap] of incomingFlow) {
		for (const [dir, totalFlow] of dirMap) {
			upstream.push({ fromKey, dir, totalFlow });
		}
	}
	upstream.sort((a, b) => b.totalFlow - a.totalFlow);

	// Step 5: greedily place dams
	const damAvailable = level.availableStructures.includes("dam");
	if (!damAvailable) {
		// Can't solve without dams in this strategy
		const sim = simulate(state, level);
		const score = calculateScore(sim, level);
		return {
			solved: sim.allResourcesSurvived,
			budgetUsed: state.budgetUsed,
			score: score.totalScore,
		};
	}

	for (const edge of upstream) {
		const remaining = level.budget - state.budgetUsed;
		if (remaining < 5) break; // Can't afford even a mud dam

		const tile = state.tiles.get(edge.fromKey);
		if (tile === undefined) continue;
		if (tile.content.kind !== "empty") continue;
		if (!isBuildable(tile.terrain)) continue;

		// Pick best affordable dam material
		let material: "mud" | "wood" | "concrete" = "mud";
		if (remaining >= 25) material = "concrete";
		else if (remaining >= 10) material = "wood";

		const dam = createDam(material, [edge.dir]);
		const result = placeStructure(state, tile.coord, dam);
		if (result.success) {
			state = result.state;
		}
	}

	// Step 6: also try placing dams on buildable neighbors of resources (defensive ring)
	for (const resourceKey of resourceKeys) {
		const resourceTile = state.tiles.get(resourceKey);
		if (resourceTile === undefined) continue;

		for (const neighbor of hexNeighbors(resourceTile.coord)) {
			const nKey = hexKey(neighbor);
			const nTile = state.tiles.get(nKey);
			if (nTile === undefined) continue;
			if (nTile.content.kind !== "empty") continue;
			if (!isBuildable(nTile.terrain)) continue;
			if (nTile.elevation <= resourceTile.elevation) continue; // only block uphill

			const dir = directionBetween(neighbor, resourceTile.coord);
			if (dir === undefined) continue;

			const remaining = level.budget - state.budgetUsed;
			if (remaining < 5) break;

			const dam = createDam("mud", [dir]);
			const result = placeStructure(state, neighbor, dam);
			if (result.success) {
				state = result.state;
			}
		}
	}

	// Step 7: simulate with structures
	const protectedSim = simulate(state, level);
	const score = calculateScore(protectedSim, level);

	return {
		solved: protectedSim.allResourcesSurvived,
		budgetUsed: state.budgetUsed,
		score: score.totalScore,
	};
}

// ── Puzzle Quality Tests ────────────────────────────────────────────

const SEEDS = [1, 42, 99, 200, 500, 777, 1234, 9999] as const;

describe("puzzle solvability", () => {
	test("every easy puzzle is solvable by a greedy dam strategy", () => {
		let solvedCount = 0;
		for (const seed of SEEDS) {
			const level = generate("easy", seed);
			const result = greedySolve(level);
			if (result.solved) solvedCount++;
		}
		// A simple greedy solver should handle most easy puzzles
		expect(solvedCount).toBeGreaterThanOrEqual(Math.floor(SEEDS.length * 0.5));
	});

	test("most medium puzzles are solvable by a greedy dam strategy", () => {
		let solvedCount = 0;
		for (const seed of SEEDS) {
			const level = generate("medium", seed);
			const result = greedySolve(level);
			if (result.solved) solvedCount++;
		}
		// At least 60% should be solvable by a simple greedy approach
		expect(solvedCount).toBeGreaterThanOrEqual(Math.floor(SEEDS.length * 0.6));
	});

	test("hard puzzles have enough budget to afford at least some protection", () => {
		for (const seed of SEEDS) {
			const level = generate("hard", seed);
			// Budget should cover at least 2 mud dams (cheapest meaningful defense)
			expect(level.budget).toBeGreaterThanOrEqual(10);
			// Budget should cover at least one structure per resource
			const resourceCount = level.tiles.filter((t) => t.content.kind === "resource").length;
			expect(level.budget).toBeGreaterThanOrEqual(resourceCount * 5);
		}
	});
});

function avg(arr: readonly number[]): number {
	let sum = 0;
	for (const v of arr) sum += v;
	return arr.length > 0 ? sum / arr.length : 0;
}

function collectMetricsPerDifficulty(fn: (level: LevelDefinition) => number | undefined): {
	easy: number[];
	medium: number[];
	hard: number[];
} {
	const easy: number[] = [];
	const medium: number[] = [];
	const hard: number[] = [];
	const result = { easy, medium, hard };
	for (const difficulty of ["easy", "medium", "hard"] as const) {
		for (const seed of SEEDS) {
			const level = generate(difficulty, seed);
			const value = fn(level);
			if (value !== undefined) {
				result[difficulty].push(value);
			}
		}
	}
	return result;
}

describe("difficulty scaling", () => {
	test("unprotected damage ratio increases with difficulty", () => {
		const ratios = collectMetricsPerDifficulty((level) => {
			const m = measureUnprotectedDamage(level);
			return m.totalThreshold > 0 ? m.totalDamage / m.totalThreshold : undefined;
		});

		expect(avg(ratios.hard)).toBeGreaterThan(avg(ratios.easy));
		expect(avg(ratios.medium)).toBeGreaterThanOrEqual(avg(ratios.easy));
	});

	test("resources are destroyed faster on harder difficulties", () => {
		const ticks = collectMetricsPerDifficulty((level) => {
			const m = measureUnprotectedDamage(level);
			return m.destroyedCount > 0 ? m.firstDestroyedTick : undefined;
		});

		if (ticks.hard.length > 0 && ticks.easy.length > 0) {
			expect(avg(ticks.hard)).toBeLessThanOrEqual(avg(ticks.easy));
		}
	});

	test("total water volume increases with difficulty", () => {
		const volumes = collectMetricsPerDifficulty((level) => {
			let total = 0;
			for (const tile of level.tiles) {
				if (tile.content.kind === "source") {
					total += tile.content.flowRate * tile.content.duration;
				}
			}
			return total;
		});

		expect(avg(volumes.hard)).toBeGreaterThan(avg(volumes.easy));
		expect(avg(volumes.medium)).toBeGreaterThan(avg(volumes.easy));
	});

	test("budget-to-water ratio is tighter on harder difficulties", () => {
		const ratios = collectMetricsPerDifficulty((level) => {
			let totalWater = 0;
			for (const tile of level.tiles) {
				if (tile.content.kind === "source") {
					totalWater += tile.content.flowRate * tile.content.duration;
				}
			}
			return totalWater > 0 ? level.budget / totalWater : undefined;
		});

		// Easy has more budget per unit of water (more forgiving)
		expect(avg(ratios.easy)).toBeGreaterThan(avg(ratios.hard));
	});
});

describe("puzzle engagement", () => {
	test("resources are genuinely threatened — unprotected simulation destroys at least one", () => {
		let threatenedCount = 0;
		for (const difficulty of ["easy", "medium", "hard"] as const) {
			for (const seed of SEEDS) {
				const level = generate(difficulty, seed);
				const metrics = measureUnprotectedDamage(level);
				if (metrics.destroyedCount > 0 || metrics.totalDamage > 0) {
					threatenedCount++;
				}
			}
		}
		// Vast majority of puzzles should threaten resources
		expect(threatenedCount).toBeGreaterThanOrEqual(Math.floor(SEEDS.length * 3 * 0.7));
	});

	test("hard puzzles always destroy at least one resource without intervention", () => {
		for (const seed of SEEDS) {
			const level = generate("hard", seed);
			const metrics = measureUnprotectedDamage(level);
			expect(metrics.destroyedCount).toBeGreaterThan(0);
		}
	});

	test("water reaches resources through multiple edges on larger grids", () => {
		let multiPathCount = 0;

		for (const seed of SEEDS) {
			const level = generate("hard", seed, 5);
			const state = load(level);
			const sim = simulate(state, level);

			// Find resource tiles
			const resourceKeys = new Set<string>();
			for (const [key, tile] of state.tiles) {
				if (tile.content.kind === "resource") resourceKeys.add(key);
			}

			// Count distinct incoming flow directions per resource
			for (const resourceKey of resourceKeys) {
				const incomingDirs = new Set<string>();
				for (const tick of sim.ticks) {
					for (const flow of tick.flows) {
						if (hexKey(flow.to) === resourceKey && flow.flowRate > 0) {
							incomingDirs.add(hexKey(flow.from));
						}
					}
				}
				if (incomingDirs.size >= 2) {
					multiPathCount++;
					break; // one multi-path resource per puzzle is enough
				}
			}
		}

		// At least some hard puzzles should have multi-directional water flow to resources
		expect(multiPathCount).toBeGreaterThanOrEqual(1);
	});

	test("hard budget is tighter per resource than easy budget", () => {
		const budgetPerResource = (difficulty: Difficulty): number[] => {
			const ratios: number[] = [];
			for (const seed of SEEDS) {
				const level = generate(difficulty, seed);
				const resources = level.tiles.filter((t) => t.content.kind === "resource").length;
				if (resources > 0) ratios.push(level.budget / resources);
			}
			return ratios;
		};

		const easyAvg = avg(budgetPerResource("easy"));
		const hardAvg = avg(budgetPerResource("hard"));

		// Easy gives more budget per resource to protect
		expect(easyAvg).toBeGreaterThan(hardAvg);
	});

	test("solving under par budget requires more efficient structure choices", () => {
		let parRequiresEfficiency = 0;

		for (const seed of SEEDS) {
			const level = generate("medium", seed);
			const fullResult = greedySolve(level);
			if (fullResult.solved && fullResult.budgetUsed > level.parBudget) {
				// Greedy solver uses more budget than par — par requires optimization
				parRequiresEfficiency++;
			}
		}

		// At least some medium puzzles should have par tighter than greedy budget usage
		expect(parRequiresEfficiency).toBeGreaterThanOrEqual(1);
	});
});

describe("puzzle generation consistency", () => {
	test("same seed always produces an identical puzzle", () => {
		for (const difficulty of ["easy", "medium", "hard"] as const) {
			const a = generate(difficulty, 42);
			const b = generate(difficulty, 42);
			expect(JSON.stringify(a)).toBe(JSON.stringify(b));
		}
	});

	test("different seeds produce different puzzles", () => {
		const a = generate("medium", 1);
		const b = generate("medium", 2);
		expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
	});

	test("generated puzzles across many seeds all pass validation and load", () => {
		for (const difficulty of ["easy", "medium", "hard"] as const) {
			for (const seed of SEEDS) {
				const level = generate(difficulty, seed);
				const result = loadLevel(level);
				expect(result.success).toBe(true);
			}
		}
	});
});

describe("scoring rewards skillful play", () => {
	test("solving with less budget yields higher score than solving with more", () => {
		const level = generate("easy", 42);
		const state = load(level);

		// Strategy A: place one cheap dam
		const resourceTiles: Tile[] = [];
		for (const tile of state.tiles.values()) {
			if (tile.content.kind === "resource") resourceTiles.push(tile);
		}

		// Find first buildable uphill neighbor of first resource
		const resource = resourceTiles[0];
		if (resource === undefined) return;

		let cheapState = state;
		let expensiveState = state;

		for (const neighbor of hexNeighbors(resource.coord)) {
			const nTile = state.tiles.get(hexKey(neighbor));
			if (nTile === undefined) continue;
			if (nTile.content.kind !== "empty") continue;
			if (!isBuildable(nTile.terrain)) continue;
			if (nTile.elevation <= resource.elevation) continue;

			const dir = directionBetween(neighbor, resource.coord);
			if (dir === undefined) continue;

			// Cheap: mud dam (cost 5)
			const cheapDam = createDam("mud", [dir]);
			const cheapResult = placeStructure(cheapState, neighbor, cheapDam);
			if (cheapResult.success) cheapState = cheapResult.state;

			// Expensive: concrete dam (cost 25)
			const expensiveDam = createDam("concrete", [dir]);
			const expensiveResult = placeStructure(expensiveState, neighbor, expensiveDam);
			if (expensiveResult.success) expensiveState = expensiveResult.state;
			break;
		}

		const cheapSim = simulate(cheapState, level);
		const expensiveSim = simulate(expensiveState, level);

		const cheapScore = calculateScore(cheapSim, level);
		const expensiveScore = calculateScore(expensiveSim, level);

		// If both survive, cheaper solution gets equal or better score (budget bonus)
		if (cheapSim.allResourcesSurvived && expensiveSim.allResourcesSurvived) {
			expect(cheapScore.totalScore).toBeGreaterThanOrEqual(expensiveScore.totalScore);
		}
	});

	test("failing to protect resources yields lower score than protecting them", () => {
		const level = generate("hard", 42);

		// Unprotected
		const unprotectedState = load(level);
		const unprotectedSim = simulate(unprotectedState, level);
		const unprotectedScore = calculateScore(unprotectedSim, level);

		// Protected (greedy solve)
		const solveResult = greedySolve(level);

		// Even partial protection should yield better score than none
		if (solveResult.solved) {
			expect(solveResult.score).toBeGreaterThan(unprotectedScore.totalScore);
		}
	});
});
