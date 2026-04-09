# Slopes — Game Design Document

## Concept

Slopes is a budgeted interdiction puzzle played on a hexagonal grid representing a mountain slope. Water flows downhill from sources, and the player must place structures to redirect or block it before it reaches and destroys valuable resources (villages, bridges, train lines).

## Objective

- **Level 1 (Win):** All resources survive the simulation
- **Level 2 (Par):** All resources survive AND total structure cost ≤ par budget

## Gameplay Loop

1. **Inspect:** Study the level — water sources, terrain elevations, resource locations
2. **Plan:** Decide where to place structures within budget
3. **Build:** Place structures (dams, splitters, channels, basins, levees)
4. **Simulate:** Watch water flow and see if your defenses hold
5. **Iterate:** Adjust placements and retry for a better score

## Terrain Types

| Terrain  | Flow Resistance | Water Capacity | Buildable |
| -------- | --------------- | -------------- | --------- |
| Peak     | 0.9             | 10 L           | No        |
| Ridge    | 0.3             | 30 L           | Yes       |
| Slope    | 0.2             | 50 L           | Yes       |
| Valley   | 0.4             | 100 L          | Yes       |
| Plain    | 0.5             | 80 L           | Yes       |
| Basin    | 0.6             | 200 L          | Yes       |
| Cliff    | 0.1             | 20 L           | No        |
| Riverbed | 0.0             | 150 L          | No        |

## Structure Types

### Dam
Blocks water flow on specified hex edges. Available in three materials:
- **Mud:** Cheap (5), low durability (50), blocks 20 L/s
- **Wood:** Medium (10), moderate durability (150), blocks 40 L/s
- **Concrete:** Expensive (25), high durability (500), blocks 80 L/s

### Splitter
Redirects water to only the specified edges. Cost: 15.

### Drainage Channel
Reduces flow resistance to 0 on specified edges, creating fast-flow paths. Cost: 8.

### Absorption Basin
Increases tile water capacity. Cost: 12.

### Levee
Boosts effective elevation on specified edges, making water "think" the terrain is higher. Cost: 20. Has durability.

## Scoring

- **Resource Score:** Sum of survived resource values
- **Budget Bonus:** If all survived AND under par: `floor((par - used) × 0.5)`
- **Total:** Resource Score + Budget Bonus

## Water Mechanics

Water flows from high to low elevation, distributed proportionally across downhill edges. Structures modify per-edge flow: dams block, splitters redirect, channels reduce resistance, levees boost apparent elevation. Structures with durability degrade under sustained water pressure and can break.
