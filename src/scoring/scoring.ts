import type { LevelDefinition, SimulationResult } from "../types.ts";

/** Score breakdown returned by calculateScore */
export interface ScoreBreakdown {
	readonly resourceScore: number;
	readonly budgetBonus: number;
	readonly totalScore: number;
	readonly allResourcesSurvived: boolean;
	readonly underPar: boolean;
}

/** Calculate the final score for a simulation result */
export function calculateScore(result: SimulationResult, level: LevelDefinition): ScoreBreakdown {
	// Base score: sum of survived resource values
	let resourceScore = 0;
	for (const r of result.resourcesSurvived) {
		resourceScore += r.value;
	}

	// Budget bonus: if all resources survived and budget is under par
	const allSurvived = result.resourcesDestroyed.length === 0;
	const underPar = result.totalBudgetUsed <= level.parBudget;
	const budgetBonus =
		allSurvived && underPar ? Math.floor((level.parBudget - result.totalBudgetUsed) * 0.5) : 0;

	return {
		resourceScore,
		budgetBonus,
		totalScore: resourceScore + budgetBonus,
		allResourcesSurvived: allSurvived,
		underPar,
	};
}

/** Check if all resources survived (win condition level 1) */
export function checkWinCondition(result: SimulationResult): boolean {
	return result.allResourcesSurvived;
}

/** Check if budget is under par (win condition level 2) */
export function checkParScore(result: SimulationResult, level: LevelDefinition): boolean {
	return result.allResourcesSurvived && result.totalBudgetUsed <= level.parBudget;
}
