import type { HexCoord, HexDirection, Structure, Tile, TileContent } from "../types.ts";
import { HEX_DIRECTIONS, hexKey, hexNeighbor, hexSpiral } from "./coordinates.ts";

/** Immutable hexagonal grid — all mutations return new grids */
export class HexGrid {
	private readonly tiles: ReadonlyMap<string, Tile>;
	readonly radius: number;

	constructor(tiles: ReadonlyMap<string, Tile>, radius: number) {
		this.tiles = tiles;
		this.radius = radius;
	}

	/** Create a grid from an array of tiles */
	static fromTiles(tiles: readonly Tile[], radius: number): HexGrid {
		const map = new Map<string, Tile>();
		for (const tile of tiles) {
			map.set(hexKey(tile.coord), tile);
		}
		return new HexGrid(map, radius);
	}

	/** Get a tile by coordinate, or undefined if out of bounds */
	getTile(coord: HexCoord): Tile | undefined {
		return this.tiles.get(hexKey(coord));
	}

	/** Return a new grid with the given tile replaced */
	setTile(coord: HexCoord, tile: Tile): HexGrid {
		const newMap = new Map(this.tiles);
		newMap.set(hexKey(coord), tile);
		return new HexGrid(newMap, this.radius);
	}

	/** Get neighboring tiles that exist in the grid */
	getNeighborTiles(coord: HexCoord): readonly Tile[] {
		const neighbors: Tile[] = [];
		for (const dir of HEX_DIRECTIONS) {
			const neighborCoord = hexNeighbor(coord, dir);
			const tile = this.tiles.get(hexKey(neighborCoord));
			if (tile !== undefined) {
				neighbors.push(tile);
			}
		}
		return neighbors;
	}

	/** Get the neighbor tile in a specific direction, if it exists */
	getNeighborInDirection(coord: HexCoord, direction: HexDirection): Tile | undefined {
		const neighborCoord = hexNeighbor(coord, direction);
		return this.tiles.get(hexKey(neighborCoord));
	}

	/** Get effective elevation considering structure modifiers (levees) */
	getEffectiveElevation(tile: Tile, direction: HexDirection): number {
		if (tile.content.kind !== "structure") {
			return tile.elevation;
		}
		const structure = tile.content.structure;
		if (structure.kind === "levee" && !structure.broken) {
			const edges: readonly HexDirection[] = structure.blockedEdges;
			if (edges.includes(direction)) {
				return tile.elevation + structure.elevationBoost;
			}
		}
		return tile.elevation;
	}

	/** Get all tiles as an array, sorted by elevation descending then by coord key */
	getAllTilesSorted(): readonly Tile[] {
		const allTiles = [...this.tiles.values()];
		allTiles.sort((a, b) => {
			if (b.elevation !== a.elevation) {
				return b.elevation - a.elevation;
			}
			const keyA = hexKey(a.coord);
			const keyB = hexKey(b.coord);
			if (keyA < keyB) return -1;
			if (keyA > keyB) return 1;
			return 0;
		});
		return allTiles;
	}

	/** Iterate over all tiles */
	forEachTile(callback: (tile: Tile, key: string) => void): void {
		for (const [key, tile] of this.tiles) {
			callback(tile, key);
		}
	}

	/** Get the number of tiles */
	get size(): number {
		return this.tiles.size;
	}

	/** Get the internal tiles map (read-only) */
	getTilesMap(): ReadonlyMap<string, Tile> {
		return this.tiles;
	}

	/** Create a new grid with a structure placed on a tile */
	placeStructure(coord: HexCoord, structure: Structure): HexGrid {
		const tile = this.getTile(coord);
		if (tile === undefined) {
			throw new Error(`No tile at ${hexKey(coord)}`);
		}
		if (tile.content.kind !== "empty") {
			throw new Error(`Tile at ${hexKey(coord)} is not empty (has ${tile.content.kind})`);
		}
		const newContent: TileContent = { kind: "structure", structure };
		const newTile: Tile = { ...tile, content: newContent };
		return this.setTile(coord, newTile);
	}

	/** Create a new grid with a structure removed from a tile */
	removeStructure(coord: HexCoord): HexGrid {
		const tile = this.getTile(coord);
		if (tile === undefined) {
			throw new Error(`No tile at ${hexKey(coord)}`);
		}
		if (tile.content.kind !== "structure") {
			throw new Error(`Tile at ${hexKey(coord)} has no structure`);
		}
		const emptyContent: TileContent = { kind: "empty" };
		const newTile: Tile = { ...tile, content: emptyContent };
		return this.setTile(coord, newTile);
	}

	/** Serialize the grid to a JSON-compatible object */
	serialize(): SerializedGrid {
		const tiles: SerializedTile[] = [];
		for (const [key, tile] of this.tiles) {
			tiles.push({ key, tile });
		}
		return { radius: this.radius, tiles };
	}

	/** Deserialize a grid from a JSON-compatible object */
	static deserialize(data: SerializedGrid): HexGrid {
		const map = new Map<string, Tile>();
		for (const entry of data.tiles) {
			map.set(entry.key, entry.tile);
		}
		return new HexGrid(map, data.radius);
	}

	/** Generate an empty hex grid with the given radius and elevation function */
	static generate(
		radius: number,
		elevationFn: (coord: HexCoord) => number,
		terrainFn: (coord: HexCoord, elevation: number) => Tile["terrain"],
	): HexGrid {
		const coords = hexSpiral({ q: 0, r: 0 }, radius);
		const tiles: Tile[] = coords.map((coord) => {
			const elevation = elevationFn(coord);
			return {
				coord,
				elevation,
				terrain: terrainFn(coord, elevation),
				waterLevel: 0,
				content: { kind: "empty" },
			};
		});
		return HexGrid.fromTiles(tiles, radius);
	}
}

export interface SerializedTile {
	readonly key: string;
	readonly tile: Tile;
}

export interface SerializedGrid {
	readonly radius: number;
	readonly tiles: readonly SerializedTile[];
}
