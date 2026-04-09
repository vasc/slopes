# Slopes — API Reference

All exports are available from the package root: `@slopes/engine`.

## Game Engine

### `initGame(definition: LevelDefinition): LoadResult`
Initialize a game from a level definition. Returns `{ success: true, state }` or `{ success: false, errors }`.

### `placeGameStructure(state: GameState, coord: HexCoord, structure: Structure): PlaceResult`
Place a structure on the grid. Returns `{ success: true, state }` or `{ success: false, reason }`.

### `removeGameStructure(state: GameState, coord: HexCoord): RemoveResult`
Remove a structure, refunding half its cost. Returns `{ success: true, state, refund }` or `{ success: false, reason }`.

### `getGameBudget(state: GameState): number`
Get remaining budget.

### `runGameSimulation(state: GameState): SimulationResult`
Run the full simulation. Returns complete results with per-tick data, event log, and resource outcomes.

### `stepGameSimulation(state: GameState, tick: number): StepResult`
Run a single simulation tick. Returns `{ tickResult, updatedTiles }`.

### `scoreGame(result: SimulationResult, level: LevelDefinition): ScoreBreakdown`
Calculate detailed score breakdown.

### `serializeState(state: GameState): SerializedGameState`
Serialize game state for storage/transmission.

### `deserializeState(data: SerializedGameState): GameState`
Restore game state from serialized form.

## Structure Factories

### `createDam(material: DamMaterial, blockedEdges: HexDirection[]): DamStructure`
### `createSplitter(redirectEdges: HexDirection[]): SplitterStructure`
### `createDrainageChannel(channelEdges: HexDirection[]): DrainageChannelStructure`
### `createAbsorptionBasin(extraCapacity: number): AbsorptionBasinStructure`
### `createLevee(blockedEdges: HexDirection[], elevationBoost: number): LeveeStructure`

## Hex Math

### `hexKey(coord: HexCoord): string`
Serialize coordinates to a Map key (`"q,r"`).

### `hexFromKey(key: string): HexCoord`
Deserialize a key back to coordinates.

### `hexNeighbor(coord: HexCoord, direction: HexDirection): HexCoord`
Get the neighbor in a given direction.

### `hexNeighbors(coord: HexCoord): HexCoord[]`
Get all 6 neighbors.

### `hexDistance(a: HexCoord, b: HexCoord): number`
Calculate hex distance between two coordinates.

### `hexRing(center: HexCoord, radius: number): HexCoord[]`
Get all coordinates at exactly the given distance.

### `hexSpiral(center: HexCoord, radius: number): HexCoord[]`
Get all coordinates within the given radius.

### `oppositeDirection(dir: HexDirection): HexDirection`
Get the opposite hex direction.

## Scoring

### `calculateScore(result: SimulationResult, level: LevelDefinition): ScoreBreakdown`
Returns `{ resourceScore, budgetBonus, totalScore, allResourcesSurvived, underPar }`.

### `checkWinCondition(result: SimulationResult): boolean`
Did all resources survive?

### `checkParScore(result: SimulationResult, level: LevelDefinition): boolean`
All survived AND under par budget?

## Level Loading

### `loadLevel(definition: LevelDefinition): LoadResult`
Parse and validate a level definition into a `GameState`.

### `validateLevel(definition: LevelDefinition): string[]`
Validate a level definition, returning error messages (empty = valid).

## HexGrid Class

### `HexGrid.fromTiles(tiles: Tile[], radius: number): HexGrid`
### `HexGrid.generate(radius, elevationFn, terrainFn): HexGrid`
### `grid.getTile(coord): Tile | undefined`
### `grid.setTile(coord, tile): HexGrid` (returns new grid)
### `grid.placeStructure(coord, structure): HexGrid`
### `grid.removeStructure(coord): HexGrid`
### `grid.getNeighborTiles(coord): Tile[]`
### `grid.getNeighborInDirection(coord, direction): Tile | undefined`
### `grid.getEffectiveElevation(tile, direction): number`
### `grid.getAllTilesSorted(): Tile[]`
### `grid.serialize(): SerializedGrid`
### `HexGrid.deserialize(data): HexGrid`

## Puzzle Generator

### `generatePuzzle(options: GeneratorOptions): LevelDefinition`
Generate a random puzzle level. Options:
- `radius` — grid radius (1-8)
- `difficulty` — `"easy" | "medium" | "hard"`
- `seed` — integer seed for deterministic generation
- `name` — level name

### `isDifficulty(value: string): value is Difficulty`
Type guard for the `Difficulty` union.

### `createRng(seed: number): Rng`
Create a seeded PRNG (Mulberry32 algorithm). Returns an `Rng` with:
- `next(): number` — float in [0, 1)
- `nextInt(min, max): number` — integer in [min, max]
- `nextFloat(min, max): number` — float in [min, max)
- `pick(items): T` — random element from non-empty array
- `shuffle(items): T[]` — shuffled copy (Fisher-Yates)

## Level Schema (Zod)

### `LevelDefinitionSchema`
Zod 4 schema for validating level JSON at system boundaries. Use `LevelDefinitionSchema.safeParse(data)` to validate untrusted input without `any`.
