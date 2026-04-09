# Slopes

A hexagonal grid water puzzle game engine. Players place structures (dams, splitters, channels, basins, levees) to redirect water flow and protect resources from destruction.

## Quick Start

```bash
bun install
bun test         # run 218 tests
bun run check    # biome + eslint + tsc
bun run cli      # CLI tool
```

## CLI

Generate, validate, and simulate puzzles from the command line:

```bash
# Generate a random puzzle
bun run cli -- generate -r 4 -d medium -s 42 -n "Mountain Pass"
bun run cli -- generate -r 3 -d hard -s 99 -o levels/hard-99.json

# Validate a level file
bun run cli -- validate levels/tutorial-01.json

# Run simulation (no structures — shows what happens unprotected)
bun run cli -- simulate levels/tutorial-01.json

# Show level info
bun run cli -- info levels/tutorial-01.json
```

### Difficulty Levels

| Difficulty | Sources | Resources | Flow Rate | Budget | Structures |
| ---------- | ------- | --------- | --------- | ------ | ---------- |
| Easy       | 1       | 1-2       | 25-40     | 2x     | dam, basin |
| Medium     | 1-2     | 2-3       | 35-55     | 1.5x   | + splitter, drainage |
| Hard       | 2-3     | 3-5       | 50-80     | 1x     | + levee |

## Library API

```typescript
import {
  initGame,
  placeGameStructure,
  runGameSimulation,
  scoreGame,
  createDam,
  generatePuzzle,
} from "@slopes/engine";

// Generate a puzzle
const level = generatePuzzle({ radius: 4, difficulty: "medium", seed: 42, name: "My Level" });

// Load and play
const result = initGame(level);
if (!result.success) throw new Error(result.errors.join(", "));

// Place structures
const dam = createDam("wood", ["e", "se"]);
const placed = placeGameStructure(result.state, { q: 1, r: 0 }, dam);
if (!placed.success) throw new Error(placed.reason);

// Run simulation
const sim = runGameSimulation(placed.state);
const score = scoreGame(sim, level);

console.log(`Score: ${score.totalScore}`);
console.log(`All survived: ${score.allResourcesSurvived}`);
console.log(`Under par: ${score.underPar}`);
```

## Architecture

Pure TypeScript library. The simulation is a pure function — same inputs always produce identical outputs. All types use `readonly` modifiers and discriminated unions (no `any`, no `as` casts, no optional fields). JSON boundaries validated with Zod 4.

See [docs/](docs/) for detailed documentation:
- [Game Design](docs/game-design.md) — gameplay, terrain, structures, scoring
- [Architecture](docs/architecture.md) — module structure, data flow, tooling
- [Water Flow Algorithm](docs/water-flow-algorithm.md) — simulation deep-dive
- [Level Format](docs/level-format.md) — JSON schema and validation rules
- [API Reference](docs/api-reference.md) — all public exports

## Project Structure

```
src/
  index.ts              # public API barrel export
  cli.ts                # CLI entry point (commander)
  types.ts              # all shared types
  hex/                  # hex coordinate math & grid
  terrain/              # terrain properties
  structures/           # structure registry & placement
  resources/            # resource damage tracking
  water/                # flow calculator & simulation
  level/                # level loading, validation & Zod schema
  scoring/              # score calculation
  engine/               # top-level game engine
  generator/            # puzzle generator & seeded PRNG
levels/                 # example levels
tests/                  # 218 tests (bun:test)
docs/                   # documentation
```
