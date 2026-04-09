# Slopes — Technical Architecture

## Design Principles

1. **Pure functional core** — Simulation is a pure function: input state → output results + event log
2. **Immutable data** — All types use `readonly` modifiers; grid operations return new instances
3. **Discriminated unions** — No optional fields; every state is fully represented
4. **No `any`, no `as` casts** — Enforced by typescript-eslint type-aware rules
5. **Zero runtime dependencies** — Pure TypeScript library
6. **Deterministic simulation** — Same inputs always produce identical outputs

## Module Dependency Graph

```
index.ts (public API barrel)
├── engine/game-engine.ts
│   ├── level/level-loader.ts
│   │   └── level/level-validator.ts
│   ├── structures/structure-manager.ts
│   │   ├── structures/structure-registry.ts
│   │   └── terrain/terrain.ts
│   ├── water/simulation.ts
│   │   └── water/flow-calculator.ts
│   │       └── terrain/terrain.ts
│   └── scoring/scoring.ts
├── generator/puzzle-generator.ts
│   ├── generator/random.ts (seeded PRNG)
│   └── hex/coordinates.ts
├── level/level-schema.ts (Zod 4)
├── hex/grid.ts
│   └── hex/coordinates.ts
├── resources/resource.ts
└── types.ts (shared types, no imports)

cli.ts (CLI entry point — not part of library API)
├── generator/puzzle-generator.ts
├── level/level-schema.ts
├── level/level-loader.ts
├── level/level-validator.ts
├── water/simulation.ts
└── scoring/scoring.ts
```

## Data Flow

```
LevelDefinition → loadLevel() → GameState
GameState + Structure → placeStructure() → GameState
GameState → runSimulation() → SimulationResult
SimulationResult + Level → calculateScore() → ScoreBreakdown
```

## Simulation Pipeline (per tick)

1. **Source injection** — Active sources add water to their tiles
2. **Sort tiles** — By elevation descending, then coordinate key
3. **Flow distribution** — For each tile with water, compute per-edge flow
4. **Overflow check** — Flag tiles exceeding capacity
5. **Structure damage** — Reduce durability of structures under water
6. **Resource damage** — Accumulate damage on resources in contact with water

## Tooling

- **Bun** — Runtime, package manager, test runner
- **TypeScript** — Maximum strictness (noUncheckedIndexedAccess, exactOptionalPropertyTypes, etc.)
- **Biome** — Formatting + structural linting
- **typescript-eslint** — Type-aware rules (ban `as` casts, ban `any` propagation, `noInlineConfig` bans all eslint-disable comments)
- **Zod 4** — Schema validation at JSON boundaries (no untyped `JSON.parse`)
- **Commander** — CLI argument parsing with subcommands
