import type { Logger } from "@/utils/logger";
import type { PackConfig } from "./config";

export type IndividualPackBuildContext = {
	packConfig: PackConfig;
	log: Logger;
	signal?: AbortSignal;
};

export type IndividualPackBuildResult = void;

export const buildIndividualPack = async (
	ctx: IndividualPackBuildContext,
): Promise<IndividualPackBuildResult> => {
	const { packConfig, log, signal } = ctx;

	signal?.throwIfAborted();
};
