import type { Logger } from "@/utils/logger";
import type { PackConfig } from "./config";

export type PackCache = {
	[file: string]: {
		timestamp: number;
	};
};

export type CompilePackContext = {
	packConfig: PackConfig;
	log: Logger;
	cache: PackCache;
	signal?: AbortSignal;
};

export type CompilePackResult = void;

export const compilePack = async (ctx: CompilePackContext): Promise<CompilePackResult> => {
	const { packConfig, log, signal } = ctx;

	signal?.throwIfAborted();

	log.info("Compiling...");
};
