# Slopes — Level Format

## Schema

Levels are defined as JSON files conforming to the `LevelDefinition` type.

```typescript
interface LevelDefinition {
  id: string;
  name: string;
  description: string;
  gridRadius: number;              // hex grid radius (e.g., 3 = 37 tiles)
  tiles: TileDefinition[];
  budget: number;                  // total spending limit
  availableStructures: StructureKind[];  // which structures the player can use
  simulationDuration: number;      // total ticks
  parBudget: number;               // budget target for level-2 scoring
}
```

## Tile Definition

Each tile specifies its position, elevation, terrain, and content:

```typescript
interface TileDefinition {
  coord: { q: number; r: number };  // axial hex coordinates
  elevation: number;                 // meters, drives flow direction
  terrain: TerrainType;              // "peak" | "ridge" | "slope" | "valley" | "plain" | "basin" | "cliff" | "riverbed"
  content: TileContentDefinition;
}
```

## Tile Content

Content is a discriminated union:

```typescript
// Empty tile (player can build here if terrain is buildable)
{ "kind": "empty" }

// Water source (emits water during simulation)
{ "kind": "source", "flowRate": 25, "startTick": 0, "duration": 8 }

// Resource to protect (player loses if destroyed)
{ "kind": "resource", "resourceType": "village", "name": "Hillside Village", "damageThreshold": 150, "value": 100 }
```

## Grid Layout

Hex grids use axial coordinates (q, r) with flat-top orientation. The center tile is always (0, 0). A grid with radius R contains `3R² + 3R + 1` tiles:

| Radius | Tiles |
| ------ | ----- |
| 1      | 7     |
| 2      | 19    |
| 3      | 37    |
| 4      | 61    |
| 5      | 91    |

## Validation Rules

The level validator checks:
- Grid radius ≥ 1
- Budget ≥ 0
- Simulation duration ≥ 1
- Par budget ≤ budget
- No duplicate tile coordinates
- All tiles within grid radius
- Valid terrain types
- At least one water source
- At least one resource
- Sources have positive flow rate and duration
- Resources have positive damage threshold and value

## Example

See `levels/tutorial-01.json` for a complete example.
