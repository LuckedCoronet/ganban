import { createLogger, type Logger } from "@/utils/logger";
import { compilePack, type CompilePackResult, type PackCache } from "./compile-pack";
import type { BuildConfig } from "./config";

type CompileContext = {
	config: BuildConfig;
	log: Logger;
	behaviorPackCache: PackCache;
	resourcePackCache: PackCache;
	isInitialCompile: boolean;
	signal?: AbortSignal;
};

type CompileResult = {
	behaviorPack?: PromiseSettledResult<CompilePackResult | undefined>;
	resourcePack?: PromiseSettledResult<CompilePackResult | undefined>;
};

const compilePacks = async (ctx: CompileContext): Promise<CompileResult> => {
	const { config, behaviorPackCache, resourcePackCache, isInitialCompile, signal } = ctx;

	signal?.throwIfAborted();

	let behaviorPackBuildPromise: Promise<CompilePackResult> | undefined = undefined;
	let resourcePackBuildPromise: Promise<CompilePackResult> | undefined = undefined;

	if (config.behaviorPack) {
		behaviorPackBuildPromise = compilePack({
			packConfig: config.behaviorPack,
			log: createLogger({
				minLevel: config.logLevel,
				prefix: "behaviorPack",
			}),
			cache: behaviorPackCache,
			isInitialCompile,
			signal,
		});
	}

	if (config.resourcePack) {
		resourcePackBuildPromise = compilePack({
			packConfig: config.resourcePack,
			log: createLogger({
				minLevel: config.logLevel,
				prefix: "resourcePack",
			}),
			cache: resourcePackCache,
			isInitialCompile,
			signal,
		});
	}

	const results = await Promise.allSettled([behaviorPackBuildPromise, resourcePackBuildPromise]);

	return {
		behaviorPack: results[0],
		resourcePack: results[1],
	};
};

export const build = async (config: BuildConfig, signal?: AbortSignal): Promise<void> => {
	signal?.throwIfAborted();

	const minLogLevel = config.logLevel;

	const log = createLogger({
		minLevel: minLogLevel,
	});

	if (!config.behaviorPack && !config.resourcePack) {
		throw new Error("Neither behaviorPack nor resourcePack is configured.");
	}

	const behaviorPackCache: PackCache = {};
	const resourcePackCache: PackCache = {};

	const runBuild = async (isInitialCompile = true): Promise<void> => {
		try {
			log.info("Build started");

			const startTime = performance.now();

			const result = await compilePacks({
				config,
				log,
				behaviorPackCache,
				resourcePackCache,
				isInitialCompile,
				signal,
			});

			const endTime = performance.now();
			const totalTimeStr = (endTime - startTime).toFixed(2);

			log.info(`Build finished in ${totalTimeStr}ms`);

			if (result.behaviorPack?.status === "rejected") {
				log.error(`There was an error compiling behaviorPack: ${result.behaviorPack.reason}`);
			}

			if (result.resourcePack?.status === "rejected") {
				log.error(`There was an error compiling resourcePack: ${result.resourcePack.reason}`);
			}
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				log.warn("Build aborted");
			} else {
				throw error;
			}
		}
	};

	await runBuild();
};
