import * as node_path from "node:path";
import { z } from "zod";
import { cosmiconfig, CosmiconfigResult } from "cosmiconfig";
import chalk from "chalk";
import { CompilePackOpts } from "./compiler";
import { getDevPackDirs } from "./utils";

const CONFIG_SCHEMA = z
	.object({
		bpSrc: z.optional(z.string()),
		bpTarget: z.optional(z.string()),
		bpName: z.optional(z.string()),

		rpSrc: z.optional(z.string()),
		rpTarget: z.optional(z.string()),
		rpName: z.optional(z.string()),

		beta: z.optional(z.boolean()),
		ignore: z.optional(z.instanceof(RegExp)),
		tsconfig: z.optional(z.string()),
		sourcemap: z.optional(z.boolean()),
		minify: z.optional(z.boolean()),
		watch: z.optional(z.boolean()),
	})
	.strict()
	.refine(
		(args) => {
			const { bpSrc, rpSrc } = args;
			return !(bpSrc === undefined && rpSrc === undefined);
		},
		{ message: "At least one of bpSrc or rpSrc must be specified" },
	)
	.refine(
		(args) => {
			const { bpSrc, bpName } = args;
			if (bpSrc !== undefined && bpName === undefined) return false;
			return true;
		},
		{ message: "bpName must be specified when bpSrc is specified", path: ["bpName"] },
	)
	.refine(
		(args) => {
			const { rpSrc, rpName } = args;
			if (rpSrc !== undefined && rpName === undefined) return false;
			return true;
		},
		{ message: "rpName must be specified when rpSrc is specified", path: ["rpName"] },
	);

export type Config = z.infer<typeof CONFIG_SCHEMA>;

export const isConfigValid = (config: unknown, logError = true): config is Config => {
	const parseResult = CONFIG_SCHEMA.safeParse(config);
	if (parseResult.success) return true;
	if (logError) console.error(chalk.red(`Invalid options: ${parseResult.error}`));
	return false;
};

export const createCompilePackOptsFromConfig = (config: Config): CompilePackOpts[] => {
	const optsArray: CompilePackOpts[] = [];

	const { devBehaviorPacks, devResourcePacks } = getDevPackDirs(config.beta);

	const tsconfig = config.tsconfig == undefined ? undefined : node_path.resolve(config.tsconfig);

	const ignore = config.ignore == undefined ? [] : [config.ignore];

	if (config.bpSrc !== undefined) {
		const targetParentDir =
			config.bpTarget !== undefined ? node_path.resolve(config.bpTarget) : devBehaviorPacks;
		const targetDir = node_path.join(targetParentDir, config.bpName!);
		const opts: CompilePackOpts = {
			packType: "BP",
			srcDir: node_path.resolve(config.bpSrc),
			targetDir,
			ignore,
			sourcemap: config.sourcemap,
			minify: config.minify,
			watch: config.watch,
			tsconfig,
		};
		optsArray.push(opts);
	}

	if (config.rpSrc !== undefined) {
		const targetParentDir =
			config.rpTarget !== undefined ? node_path.resolve(config.rpTarget) : devResourcePacks;
		const targetDir = node_path.join(targetParentDir, config.rpName!);
		const opts: CompilePackOpts = {
			packType: "RP",
			srcDir: node_path.resolve(config.rpSrc),
			targetDir,
			ignore,
			sourcemap: config.sourcemap,
			minify: config.minify,
			watch: config.watch,
			tsconfig,
		};
		optsArray.push(opts);
	}

	return optsArray;
};

const MODULE_NAME = "ganban";
const EXPLORER = cosmiconfig(MODULE_NAME, {
	searchPlaces: [
		"package.json",
		`.${MODULE_NAME}rc`,
		`.${MODULE_NAME}rc.json`,
		`.${MODULE_NAME}rc.yaml`,
		`.${MODULE_NAME}rc.yml`,
		`.${MODULE_NAME}rc.js`,
		`.${MODULE_NAME}rc.mjs`,
		`.${MODULE_NAME}rc.cjs`,
		`${MODULE_NAME}.config.js`,
		`${MODULE_NAME}.config.mjs`,
		`${MODULE_NAME}.config.cjs`,
	],
});

export const searchConfig = async (
	customPath?: string,
): Promise<NonNullable<CosmiconfigResult> | undefined> => {
	let searchResult;
	try {
		searchResult =
			typeof customPath === "string" ? await EXPLORER.load(customPath) : await EXPLORER.search();
	} catch {
		return;
	}

	if (!searchResult) return;
	if (searchResult.isEmpty) return;

	return searchResult;
};
