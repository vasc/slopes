# Slopes

A hexagonal grid water puzzle game engine. Players place structures (dams, splitters, channels, basins, levees) to redirect water flow and protect resources from destruction.

## Quick Start

```bash
bun install
bun test         # run tests
bun run build    # compile to dist/
bun run check    # biome + eslint + tsc
```

## Usage

```typescript
import {
  initGame,
  placeGameStructure,
  runGameSimulation,
  scoreGame,
  createDam,
} from "@slopes/engine";

// Load a level
const result = initGame(levelDefinition);
if (!result.success) throw new Error(result.errors.join(", "));

// Place structures
const dam = createDam("wood", ["e", "se"]);
const placed = placeGameStructure(result.state, { q: 1, r: 0 }, dam);
if (!placed.success) throw new Error(placed.reason);

// Run simulation
const sim = runGameSimulation(placed.state);
const score = scoreGame(sim, levelDefinition);

console.log(`Score: ${score.totalScore}`);
console.log(`All survived: ${score.allResourcesSurvived}`);
console.log(`Under par: ${score.underPar}`);
```

## Architecture

Pure TypeScript library with zero runtime dependencies. The simulation is a pure function — same inputs always produce identical outputs. All types use `readonly` modifiers and discriminated unions (no `any`, no `as` casts, no optional fields).

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
  types.ts              # all shared types
  hex/                  # hex coordinate math & grid
  terrain/              # terrain properties
  structures/           # structure registry & placement
  resources/            # resource damage tracking
  water/                # flow calculator & simulation
  level/                # level loading & validation
  scoring/              # score calculation
  engine/               # top-level game engine
levels/                 # example levels
tests/                  # test suite (bun:test)
docs/                   # documentation
```
