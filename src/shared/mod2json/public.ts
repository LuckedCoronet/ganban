import { z } from "zod";

const MOD2JSON_CONTEXT_SCHEMA = z
	.object({
		minify: z.boolean().readonly(),
	})
	.strict();

const MOD2JSON_SINGLE_CREATOR_SCHEMA = z
	.object({
		type: z.literal("single").readonly(),
		create: z.function().args(MOD2JSON_CONTEXT_SCHEMA).returns(z.record(z.any())).readonly(),
	})
	.strict();

const MOD2JSON_MULTIPLE_CREATOR_SCHEMA = z
	.object({
		type: z.literal("multiple").readonly(),
		create: z
			.function()
			.args(MOD2JSON_CONTEXT_SCHEMA)
			.returns(z.array(z.record(z.any())))
			.readonly(),
	})
	.strict();

const MOD2JSON_CREATOR_SCHEMA = z.discriminatedUnion("type", [
	MOD2JSON_SINGLE_CREATOR_SCHEMA,
	MOD2JSON_MULTIPLE_CREATOR_SCHEMA,
]);

export type Mod2jsonContext = z.infer<typeof MOD2JSON_CONTEXT_SCHEMA>;

export type Mod2jsonSingleCreator = z.infer<typeof MOD2JSON_SINGLE_CREATOR_SCHEMA>;

export type Mod2jsonMultipleCreator = z.infer<typeof MOD2JSON_MULTIPLE_CREATOR_SCHEMA>;

export type Mod2jsonCreator = z.infer<typeof MOD2JSON_CREATOR_SCHEMA>;

export const isMod2jsonCreator = (object: unknown): object is Mod2jsonCreator => {
	return (
		MOD2JSON_SINGLE_CREATOR_SCHEMA.safeParse(object).success ||
		MOD2JSON_MULTIPLE_CREATOR_SCHEMA.safeParse(object).success
	);
};

export const mod2jsonSingle = (fn: (ctx: Mod2jsonContext) => object): Mod2jsonSingleCreator => ({
	type: "single",
	create: (ctx: Mod2jsonContext) => fn(ctx),
});

export const mod2jsonMultiple = (
	amount: number,
	fn: (index: number, ctx: Mod2jsonContext) => object,
): Mod2jsonMultipleCreator => ({
	type: "multiple",
	create: (ctx: Mod2jsonContext) => Array.from({ length: amount }, (_, idx) => fn(idx, ctx)),
});
