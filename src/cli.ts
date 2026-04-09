#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import { generatePuzzle, isDifficulty } from "./generator/puzzle-generator.ts";
import { loadLevel } from "./level/level-loader.ts";
import { LevelDefinitionSchema } from "./level/level-schema.ts";
import { validateLevel } from "./level/level-validator.ts";
import { calculateScore } from "./scoring/scoring.ts";
import type { LevelDefinition, TileDefinition } from "./types.ts";
import { runSimulation } from "./water/simulation.ts";

// ── JSON boundary (Zod-validated) ───────────────────────────────────

function loadLevelFile(filePath: string): LevelDefinition {
	const content = readFileSync(filePath, "utf-8");
	const result = LevelDefinitionSchema.safeParse(JSON.parse(content));
	if (!result.success) {
		console.error("Invalid level file:");
		for (const issue of result.error.issues) {
			const path = issue.path.join(".");
			console.error(`  ${path}: ${issue.message}`);
		}
		process.exit(1);
	}
	return result.data;
}

// ── Formatting helpers ──────────────────────────────────────────────

function formatCoord(coord: { readonly q: number; readonly r: number }): string {
	return `(${coord.q},${coord.r})`;
}

function tileCount(radius: number): number {
	return 3 * radius * (radius + 1) + 1;
}

// ── CLI setup ───────────────────────────────────────────────────────

const program = new Command();

program
	.name("slopes")
	.description("Slopes puzzle toolkit — generate, validate, and simulate hex water puzzles")
	.version("0.1.0");

// ── generate ────────────────────────────────────────────────────────

program
	.command("generate")
	.description("Generate a random puzzle level")
	.requiredOption("-r, --radius <number>", "Grid radius (1-8)", "4")
	.requiredOption("-d, --difficulty <level>", "Difficulty: easy, medium, hard", "medium")
	.option("-s, --seed <number>", "Random seed for reproducibility")
	.option("-n, --name <string>", "Level name")
	.option("-o, --output <path>", "Output file path (stdout if omitted)")
	.action(
		(options: {
			radius: string;
			difficulty: string;
			seed: string | undefined;
			name: string | undefined;
			output: string | undefined;
		}) => {
			const radius = Number.parseInt(options.radius, 10);
			if (Number.isNaN(radius) || radius < 1 || radius > 8) {
				console.error("Error: radius must be an integer between 1 and 8");
				process.exit(1);
			}

			if (!isDifficulty(options.difficulty)) {
				console.error("Error: difficulty must be easy, medium, or hard");
				process.exit(1);
			}

			const seed = options.seed !== undefined ? Number.parseInt(options.seed, 10) : Date.now();
			if (Number.isNaN(seed)) {
				console.error("Error: seed must be an integer");
				process.exit(1);
			}

			const name = options.name ?? `Puzzle ${seed}`;

			const level = generatePuzzle({
				radius,
				difficulty: options.difficulty,
				seed,
				name,
			});
			const json = JSON.stringify(level, null, 2);

			if (options.output !== undefined) {
				writeFileSync(options.output, `${json}\n`);
				console.log(`Level written to ${options.output}`);
			} else {
				console.log(json);
			}
		},
	);

// ── validate ────────────────────────────────────────────────────────

program
	.command("validate")
	.description("Validate a level JSON file")
	.argument("<file>", "Path to level JSON file")
	.action((file: string) => {
		const level = loadLevelFile(file);
		const errors = validateLevel(level);
		if (errors.length === 0) {
			console.log("Level is valid");
		} else {
			console.error("Validation errors:");
			for (const error of errors) {
				console.error(`  - ${error}`);
			}
			process.exit(1);
		}
	});

// ── simulate ────────────────────────────────────────────────────────

program
	.command("simulate")
	.description("Run simulation on a level with no structures placed")
	.argument("<file>", "Path to level JSON file")
	.action((file: string) => {
		const level = loadLevelFile(file);
		const loadResult = loadLevel(level);
		if (!loadResult.success) {
			console.error("Failed to load level:");
			for (const err of loadResult.errors) {
				console.error(`  - ${err}`);
			}
			process.exit(1);
		}

		const result = runSimulation(loadResult.state.tiles, level.simulationDuration, 0);
		const score = calculateScore(result, level);

		console.log(`Simulation: ${level.name}`);
		console.log("─".repeat(40));
		console.log(`Grid: radius ${level.gridRadius} (${tileCount(level.gridRadius)} tiles)`);
		console.log(`Duration: ${level.simulationDuration} ticks`);
		console.log("Budget used: 0 (no structures placed)");
		console.log();

		if (result.resourcesDestroyed.length > 0) {
			console.log(`Resources destroyed: ${result.resourcesDestroyed.length}`);
			for (const r of result.resourcesDestroyed) {
				const tick = r.state.status === "destroyed" ? ` (tick ${r.state.destroyedAtTick})` : "";
				console.log(`  - ${r.name} [${r.type}]${tick}`);
			}
		}

		if (result.resourcesSurvived.length > 0) {
			console.log(`Resources survived: ${result.resourcesSurvived.length}`);
			for (const r of result.resourcesSurvived) {
				console.log(`  - ${r.name} [${r.type}]`);
			}
		}

		console.log();
		console.log(
			`Score: ${score.totalScore} (resources: ${score.resourceScore}, budget bonus: ${score.budgetBonus})`,
		);
		console.log(
			`Win: ${score.allResourcesSurvived ? "YES" : "NO"}${!score.allResourcesSurvived ? ` (${result.resourcesDestroyed.length} destroyed)` : ""}`,
		);
	});

// ── info ────────────────────────────────────────────────────────────

program
	.command("info")
	.description("Display information about a level file")
	.argument("<file>", "Path to level JSON file")
	.action((file: string) => {
		const level = loadLevelFile(file);

		console.log(`Level: ${level.name}`);
		console.log("─".repeat(40));
		console.log(`ID: ${level.id}`);
		console.log(`Grid radius: ${level.gridRadius} (${tileCount(level.gridRadius)} tiles)`);
		console.log(`Description: ${level.description}`);
		console.log();

		const sources: TileDefinition[] = [];
		const resources: TileDefinition[] = [];
		for (const tile of level.tiles) {
			if (tile.content.kind === "source") {
				sources.push(tile);
			} else if (tile.content.kind === "resource") {
				resources.push(tile);
			}
		}

		console.log(`Water sources: ${sources.length}`);
		for (const s of sources) {
			if (s.content.kind === "source") {
				console.log(
					`  ${formatCoord(s.coord)} flow: ${s.content.flowRate} L/tick, ticks ${s.content.startTick}-${s.content.startTick + s.content.duration}`,
				);
			}
		}
		console.log();

		console.log(`Resources: ${resources.length}`);
		for (const r of resources) {
			if (r.content.kind === "resource") {
				console.log(
					`  ${formatCoord(r.coord)} ${r.content.resourceType} "${r.content.name}" (threshold: ${r.content.damageThreshold}, value: ${r.content.value})`,
				);
			}
		}
		console.log();

		console.log(`Budget: ${level.budget} (par: ${level.parBudget})`);
		console.log(`Available structures: ${level.availableStructures.join(", ")}`);
		console.log(`Simulation duration: ${level.simulationDuration} ticks`);
	});

// ── Run ─────────────────────────────────────────────────────────────

program.parse();
