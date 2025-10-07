import type { Logger } from "@/utils/logger";
import type { PackConfig } from "./config";

export type PackCache = {
	[file: string]: {
		timestamp: number;
	};
};

export type CompilePackOptions = {
	packConfig: PackConfig;
	log: Logger;
	signal?: AbortSignal;
};

export type CompilePackResult = void;

export const compilePack = async (options: CompilePackOptions): Promise<CompilePackResult> => {
	const { packConfig, log, signal } = options;

	signal?.throwIfAborted();
};
