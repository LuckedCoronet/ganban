import { createLogger, type Logger } from "@/utils/logger";
import { compilePack, type CompilePackResult } from "./compile-pack";
import type { BuildConfig } from "./config";

type CompileOptions = {
	config: BuildConfig;
	log: Logger;
	signal?: AbortSignal;
};

type CompileResult = {
	behaviorPack?: PromiseSettledResult<CompilePackResult>;
	resourcePack?: PromiseSettledResult<CompilePackResult>;
};

const compile = async (options: CompileOptions): Promise<CompileResult> => {
	const { config, log, signal } = options;

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

	const callBuildPacks = async (): Promise<CompileResult> => {
		log.info("Build started");

		const startTime = performance.now();

		const result = await compile({ config, log, signal });

		const endTime = performance.now();
		const totalTimeStr = (endTime - startTime).toFixed(2);

		log.info(`Build finished in ${totalTimeStr}ms`);

		if (result.behaviorPack?.status === "rejected") {
			log.error(`There was an error building behaviorPack: ${result.behaviorPack.reason}`);
		}

		if (result.resourcePack?.status === "rejected") {
			log.error(`There was an error building resourcePack: ${result.resourcePack.reason}`);
		}

		return result;
	};

	await callBuildPacks();
};
