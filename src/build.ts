import type { BuildConfig, PackConfig } from "./config";
import { createLogger, type Logger } from "./utils/logger";

type PackBuildContext = {
	buildConfig: BuildConfig;
	packConfig: PackConfig;
	log: Logger;
	signal?: AbortSignal;
};

type PackBuildResult = void;

const buildPack = async (ctx: PackBuildContext): Promise<PackBuildResult> => {
	const { buildConfig, packConfig, log, signal } = ctx;

	signal?.throwIfAborted();
};

export const build = async (config: BuildConfig, signal?: AbortSignal): Promise<void> => {
	signal?.throwIfAborted();

	const minLogLevel = config.logLevel;

	const globalLogger = createLogger({
		minLevel: minLogLevel,
	});

	if (!config.behaviorPack && !config.resourcePack) {
		globalLogger.warn("Neither behaviorPack nor resourcePack is configured.");
		return;
	}

	const packBuildPromises: Promise<PackBuildResult>[] = [];

	if (config.behaviorPack) {
		packBuildPromises.push(
			buildPack({
				buildConfig: config,
				packConfig: config.behaviorPack,
				log: createLogger({
					minLevel: minLogLevel,
					prefix: "behaviorPack",
				}),
				signal,
			}),
		);

		globalLogger.debug("Added behavior pack build promise into the array");
	}

	if (config.resourcePack) {
		packBuildPromises.push(
			buildPack({
				buildConfig: config,
				packConfig: config.resourcePack,
				log: createLogger({
					minLevel: minLogLevel,
					prefix: "resourcePack",
				}),
				signal,
			}),
		);

		globalLogger.debug("Added resource pack build promise into the array");
	}

	const settledResults = await Promise.allSettled(packBuildPromises);

	globalLogger.debug(`All ${packBuildPromises.length} pack build promise(s) has settled`);
};
