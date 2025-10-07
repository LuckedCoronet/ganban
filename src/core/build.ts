import { createLogger, type Logger } from "@/utils/logger";
import { compilePack, type CompilePackResult, type PackCache } from "./compile-pack";
import type { BuildConfig } from "./config";

type CompileOptions = {
	config: BuildConfig;
	log: Logger;
	behaviorPackCache: PackCache;
	resourcePackCache: PackCache;
	signal?: AbortSignal;
};

type CompileResult = {
	behaviorPack?: PromiseSettledResult<CompilePackResult>;
	resourcePack?: PromiseSettledResult<CompilePackResult>;
};

const compilePacks = async (options: CompileOptions): Promise<CompileResult> => {
	const { config, log, behaviorPackCache, resourcePackCache, signal } = options;

	signal?.throwIfAborted();

	let behaviorPackBuildPromise: Promise<CompilePackResult> | undefined = undefined;
	let resourcePackBuildPromise: Promise<CompilePackResult> | undefined = undefined;

	if (config.behaviorPack) {
		log.debug("Compiling behaviorPack...");

		behaviorPackBuildPromise = compilePack({
			packConfig: config.behaviorPack,
			log: createLogger({
				minLevel: config.logLevel,
				prefix: "behaviorPack",
			}),
			cache: behaviorPackCache,
			signal,
		});
	}

	if (config.resourcePack) {
		log.debug("Compiling resourcePack...");

		resourcePackBuildPromise = compilePack({
			packConfig: config.resourcePack,
			log: createLogger({
				minLevel: config.logLevel,
				prefix: "resourcePack",
			}),
			cache: resourcePackCache,
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

	const runBuild = async (): Promise<CompileResult> => {
		log.info("Build started");

		const startTime = performance.now();

		const result = await compilePacks({
			config,
			log,
			behaviorPackCache,
			resourcePackCache,
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

		return result;
	};

	await runBuild();
};
