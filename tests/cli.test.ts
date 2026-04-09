import { describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { LevelDefinitionSchema } from "../src/level/level-schema.ts";

function run(args: readonly string[]): { stdout: string; stderr: string; exitCode: number } {
	const result = Bun.spawnSync(["bun", "src/cli.ts", ...args], {
		cwd: "/home/user/slopes",
	});
	return {
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
		exitCode: result.exitCode,
	};
}

describe("CLI", () => {
	describe("generate", () => {
		test("generates valid JSON to stdout", () => {
			const { stdout, exitCode } = run(["generate", "-r", "3", "-d", "easy", "-s", "42"]);
			expect(exitCode).toBe(0);
			const parsed = LevelDefinitionSchema.safeParse(JSON.parse(stdout));
			expect(parsed.success).toBe(true);
		});

		test("same seed produces identical output", () => {
			const args = ["generate", "-r", "3", "-d", "medium", "-s", "12345"];
			const { stdout: out1 } = run(args);
			const { stdout: out2 } = run(args);
			expect(out1).toBe(out2);
		});

		test("--output flag writes to file", () => {
			const path = "/tmp/slopes-cli-test-output.json";
			try {
				const { exitCode, stdout } = run([
					"generate",
					"-r",
					"2",
					"-d",
					"easy",
					"-s",
					"1",
					"-o",
					path,
				]);
				expect(exitCode).toBe(0);
				expect(stdout).toContain(path);
				expect(existsSync(path)).toBe(true);
			} finally {
				if (existsSync(path)) unlinkSync(path);
			}
		});

		test("invalid radius exits with error", () => {
			const { exitCode, stderr } = run(["generate", "-r", "0"]);
			expect(exitCode).not.toBe(0);
			expect(stderr).toContain("radius");
		});

		test("invalid difficulty exits with error", () => {
			const { exitCode, stderr } = run(["generate", "-d", "nightmare"]);
			expect(exitCode).not.toBe(0);
			expect(stderr).toContain("difficulty");
		});
	});

	describe("validate", () => {
		test("valid level file prints success", () => {
			const { exitCode, stdout } = run(["validate", "levels/tutorial-01.json"]);
			expect(exitCode).toBe(0);
			expect(stdout.toLowerCase()).toContain("valid");
		});

		test("invalid JSON prints error and exits non-zero", () => {
			const path = "/tmp/slopes-cli-invalid.json";
			try {
				Bun.spawnSync(["bun", "-e", `require("fs").writeFileSync("${path}", "{}")`]);
				const { exitCode } = run(["validate", path]);
				expect(exitCode).not.toBe(0);
			} finally {
				if (existsSync(path)) unlinkSync(path);
			}
		});
	});

	describe("info", () => {
		test("prints level name and grid info", () => {
			const { stdout, exitCode } = run(["info", "levels/tutorial-01.json"]);
			expect(exitCode).toBe(0);
			expect(stdout).toContain("First Rain");
			expect(stdout).toContain("radius");
		});
	});

	describe("simulate", () => {
		test("prints simulation results for valid level", () => {
			const { stdout, exitCode } = run(["simulate", "levels/tutorial-01.json"]);
			expect(exitCode).toBe(0);
			expect(stdout).toContain("Simulation");
			expect(stdout).toContain("Score");
		});
	});
});
