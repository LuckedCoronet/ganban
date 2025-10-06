import type { Logger } from "@/utils/logger";
import type { BuildConfig, PackConfig } from "./config";

export type PackBuildContext = {
	buildConfig: BuildConfig;
	packConfig: PackConfig;
	log: Logger;
	signal?: AbortSignal;
};

export type PackBuildResult = void;

export const buildPack = async (ctx: PackBuildContext): Promise<PackBuildResult> => {
	const { buildConfig, packConfig, log, signal } = ctx;

	signal?.throwIfAborted();
};
