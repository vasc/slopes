import { z } from "zod";

const HexCoordSchema = z.object({
	q: z.number(),
	r: z.number(),
});

const TerrainTypeSchema = z.enum([
	"peak",
	"ridge",
	"slope",
	"valley",
	"plain",
	"basin",
	"cliff",
	"riverbed",
]);

const StructureKindSchema = z.enum([
	"dam",
	"splitter",
	"drainage_channel",
	"absorption_basin",
	"levee",
]);

const ResourceTypeSchema = z.enum(["village", "bridge", "train_line", "farmland", "road"]);

const EmptyContentSchema = z.object({ kind: z.literal("empty") });

const SourceContentSchema = z.object({
	kind: z.literal("source"),
	flowRate: z.number(),
	startTick: z.number(),
	duration: z.number(),
});

const ResourceContentSchema = z.object({
	kind: z.literal("resource"),
	resourceType: ResourceTypeSchema,
	name: z.string(),
	damageThreshold: z.number(),
	value: z.number(),
});

const TileContentDefinitionSchema = z.discriminatedUnion("kind", [
	EmptyContentSchema,
	SourceContentSchema,
	ResourceContentSchema,
]);

const TileDefinitionSchema = z.object({
	coord: HexCoordSchema,
	elevation: z.number(),
	terrain: TerrainTypeSchema,
	content: TileContentDefinitionSchema,
});

/** Zod schema for LevelDefinition — validates shape and types at the JSON boundary */
export const LevelDefinitionSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	gridRadius: z.number(),
	tiles: z.array(TileDefinitionSchema),
	budget: z.number(),
	availableStructures: z.array(StructureKindSchema),
	simulationDuration: z.number(),
	parBudget: z.number(),
});
