import type { BuildConfig, PackConfig } from "./config";

type PackBuildContext = {
	buildConfig: BuildConfig;
	packConfig: PackConfig;
	signal?: AbortSignal;
};

type PackBuildResult = void;

const buildPack = async (ctx: PackBuildContext): Promise<PackBuildResult> => {
	const { buildConfig, packConfig, signal } = ctx;

	signal?.throwIfAborted();
};

export const build = async (config: BuildConfig, signal?: AbortSignal): Promise<void> => {
	signal?.throwIfAborted();

	if (!config.behaviorPack && !config.resourcePack) {
		throw new Error("Neither behaviorPack nor resourcePack is configured.");
	}

	const packBuildResults: Promise<PackBuildResult>[] = [];

	if (config.behaviorPack) {
		packBuildResults.push(
			buildPack({
				buildConfig: config,
				packConfig: config.behaviorPack,
				signal,
			}),
		);
	}

	if (config.resourcePack) {
		packBuildResults.push(
			buildPack({
				buildConfig: config,
				packConfig: config.resourcePack,
				signal,
			}),
		);
	}

	const settledResults = await Promise.allSettled(packBuildResults);
};
