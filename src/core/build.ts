import type { LogLevel } from "@/types";
import { createLogger, type Logger } from "@/utils/logger";
import { buildIndividualPack, type IndividualPackBuildResult } from "./build-pack";
import type { BuildConfig } from "./config";

type BuildPacksContext = {
	config: BuildConfig;
	log: Logger;
	minLogLevel?: LogLevel;
	signal?: AbortSignal;
};

type BuildPacksResult = {
	behaviorPack?: PromiseSettledResult<IndividualPackBuildResult>;
	resourcePack?: PromiseSettledResult<IndividualPackBuildResult>;
};

const buildPacks = async (ctx: BuildPacksContext): Promise<BuildPacksResult> => {
	const { config, log, minLogLevel, signal } = ctx;

	signal?.throwIfAborted();

	let behaviorPackBuildPromise: Promise<IndividualPackBuildResult> | undefined = undefined;
	let resourcePackBuildPromise: Promise<IndividualPackBuildResult> | undefined = undefined;

	if (config.behaviorPack) {
		log.debug("Building behaviorPack...");

		behaviorPackBuildPromise = buildIndividualPack({
			packConfig: config.behaviorPack,
			log: createLogger({
				minLevel: minLogLevel,
				prefix: "behaviorPack",
			}),
			signal,
		});
	}

	if (config.resourcePack) {
		log.debug("Building resourcePack...");

		resourcePackBuildPromise = buildIndividualPack({
			packConfig: config.resourcePack,
			log: createLogger({
				minLevel: minLogLevel,
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
		log.warn("Neither behaviorPack nor resourcePack is configured.");
		return;
	}

	const callBuildPacks = async (): Promise<BuildPacksResult> => {
		log.debug("Building pack(s)...");

		const result = await buildPacks({
			config,
			log,
			minLogLevel,
			signal,
		});

		log.debug("Finished building pack(s)");

		return result;
	};

	await callBuildPacks();
};
