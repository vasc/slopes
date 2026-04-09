# Slopes — Water Flow Algorithm

## Overview

The water simulation uses a discrete tick-based, edge-aware flow model on a hexagonal grid. Each tick, water flows from higher tiles to lower tiles through the 6 hex edges, modified by structures placed on those edges.

## Algorithm (per tick)

```
FOR each tick t = 0 to simulationDuration - 1:

  1. ACTIVATE SOURCES
     For each tile with a water source:
       If startTick ≤ t < startTick + duration:
         tile.waterLevel += source.flowRate
         (emit 'water_source_activate' on first activation tick)
       If t == startTick + duration:
         (emit 'water_source_deplete')

  2. SORT tiles by elevation descending, then by coordinate key
     (Ensures deterministic top-down processing)

  3. DISTRIBUTE FLOW
     For each tile with waterLevel > 0 (processed top-down):

       a. Determine allowed directions:
          - If tile has a splitter: only splitter.redirectEdges
          - Otherwise: all 6 HEX_DIRECTIONS

       b. For each allowed direction:
          - Get neighbor tile (skip if none / map edge)
          - Compute effective elevation:
            myEffective = tile.elevation + levee boost on this edge
            neighborEffective = neighbor.elevation + levee boost on opposite edge
          - edgeDiff = myEffective - neighborEffective
          - Skip if edgeDiff ≤ 0 (not downhill)

       c. For each valid downhill edge, compute weight:
          flowResistance = terrain resistance of neighbor tile
          (If drainage channel covers this edge: flowResistance = 0)
          weight = edgeDiff × (1 - flowResistance)

       d. totalWeight = sum of all edge weights

       e. For each edge, distribute water proportionally:
          proposedFlow = availableWater × (weight / totalWeight)

          If edge has a dam/levee (not broken):
            blocked = min(proposedFlow, structure.blockCapacity)
            actualFlow = proposedFlow - blocked
            Apply durability damage to structure
            If structure breaks: actualFlow = proposedFlow
          Else:
            actualFlow = proposedFlow

          neighbor.waterLevel += actualFlow
          tile.waterLevel -= actualFlow

  4. CHECK OVERFLOW
     For each tile: if waterLevel > capacity (+ absorption basin bonus):
       emit 'tile_overflow' event

  5. STRUCTURE DAMAGE
     For tiles with structures in contact with water:
       Reduce currentDurability by waterLevel
       If durability ≤ 0: mark broken, emit 'structure_broken'

  6. RESOURCE DAMAGE
     For tiles with intact resources in contact with water:
       damage = waterLevel × DAMAGE_RATE_PER_TICK
       accumulatedDamage += damage
       If accumulatedDamage ≥ damageThreshold:
         Mark destroyed, emit 'resource_destroyed'
```

## Determinism Guarantees

- Tiles processed in consistent order (elevation desc, then coordinate key)
- Edge processing in canonical direction order: NE, E, SE, SW, W, NW
- Proportional distribution ensures order-independent flow splitting
- No randomness; identical inputs → identical outputs

## Edge-Aware Structure Interactions

### Dams
Block flow on specified edges. Water hitting a blocked edge is absorbed (up to blockCapacity), the rest overflows. The dam takes durability damage proportional to total water force.

### Levees
Boost effective elevation on specified edges. This makes the edge appear "higher" to the flow algorithm, preventing water from crossing. Unlike dams, levees don't absorb water — they redirect it.

### Splitters
Restrict flow to only specified edges. Water that would normally spread to all downhill edges is forced through the splitter's redirect edges only.

### Drainage Channels
Reduce flow resistance to 0 on specified edges, creating fast-flow paths that attract more water (higher weight in proportional distribution).
