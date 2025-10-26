import { debounce } from "@/utils/debounce";
import { createLogger, type Logger } from "@/utils/logger";
import { compilePack, type CompilePackResult, type PackCache } from "./compile-pack";
import type { BuildConfig } from "../config";
import { watchPack } from "../pack-watcher";
import { createArchive, type ArchiveSourceDirectory } from "../archive-generation";
import path from "node:path";

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
	const { config, behaviorPackCache, resourcePackCache, isInitialCompile, log, signal } = ctx;

	signal?.throwIfAborted();

	const archiveSourceDirs: ArchiveSourceDirectory[] = [];

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

		archiveSourceDirs.push({
			name: "behavior_pack",
			path: path.resolve(config.behaviorPack.outDir),
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

		archiveSourceDirs.push({
			name: "resource_pack",
			path: path.resolve(config.resourcePack.outDir),
		});
	}

	const results = await Promise.allSettled([behaviorPackBuildPromise, resourcePackBuildPromise]);

	if (config.archives) {
		log.debug("Generating archive(s)...");

		for (const archiveOptions of config.archives) {
			await createArchive(archiveSourceDirs, archiveOptions.outFile, {
				logger: log,
				signal,
			});
		}
	}

	return {
		behaviorPack: results[0],
		resourcePack: results[1],
	};
};

const buildInternal = async (config: BuildConfig, signal?: AbortSignal): Promise<void> => {
	signal?.throwIfAborted();

	const minLogLevel = config.logLevel;

	const log = createLogger({
		minLevel: minLogLevel,
	});

	if (!config.behaviorPack && !config.resourcePack) {
		throw new Error("Neither behaviorPack nor resourcePack is configured.");
	}

	let behaviorPackCache: PackCache = {};
	let resourcePackCache: PackCache = {};

	const runBuild = async (isInitialCompile = true, subSignal = signal): Promise<void> => {
		try {
			subSignal?.throwIfAborted();

			log.info("Build started");

			const startTime = performance.now();

			const result = await compilePacks({
				config,
				log,
				behaviorPackCache,
				resourcePackCache,
				isInitialCompile,
				signal: subSignal,
			});

			const endTime = performance.now();
			const totalTimeStr = (endTime - startTime).toFixed(2);

			log.info(`Build finished in ${totalTimeStr}ms`);

			if (result.behaviorPack?.status === "rejected") {
				log.error(`There was an error compiling behaviorPack: ${result.behaviorPack.reason}`);
			} else if (result.behaviorPack?.status === "fulfilled") {
				behaviorPackCache = result.behaviorPack.value?.newCache ?? {};
			}

			if (result.resourcePack?.status === "rejected") {
				log.error(`There was an error compiling resourcePack: ${result.resourcePack.reason}`);
			} else if (result.resourcePack?.status === "fulfilled") {
				behaviorPackCache = result.resourcePack.value?.newCache ?? {};
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

	if (!config.watch) return;

	signal?.throwIfAborted();

	let rebuildController: AbortController | undefined = undefined;

	const rebuild = async () => {
		log.info(`File change(s) detected. Rebuilding...`);

		if (rebuildController && !rebuildController.signal.aborted) {
			log.warn("Previous build is still in progress! Aborting...");

			const ctrl = rebuildController;
			rebuildController = undefined;
			ctrl.abort();
		}

		rebuildController = new AbortController();

		// Make sure to abort rebuild when the main abort signal is triggered
		const onMainSignalAbort = () => {
			rebuildController?.abort();
		};
		signal?.addEventListener("abort", onMainSignalAbort, { once: true });

		try {
			await runBuild(false, rebuildController.signal);
		} finally {
			signal?.removeEventListener("abort", onMainSignalAbort);
			rebuildController = undefined;

			log.info("Rebuild finished. Watching for further changes...");
		}
	};

	const incrementalBuildDebounced = debounce(rebuild, 100, signal);

	const watchPromises: Promise<void>[] = [];
	if (config.behaviorPack) {
		watchPromises.push(
			watchPack({
				pack: config.behaviorPack,
				log,
				onChangeDetected: incrementalBuildDebounced,
				signal,
			}),
		);
	}

	if (config.resourcePack) {
		watchPromises.push(
			watchPack({
				pack: config.resourcePack,
				log,
				onChangeDetected: incrementalBuildDebounced,
				signal,
			}),
		);
	}

	log.debug(`Waiting for ${watchPromises.length} watchers to be closed...`);

	await Promise.all(watchPromises);
};

export const build = async (config: BuildConfig, signal?: AbortSignal): Promise<void> => {
	const internalController = new AbortController();

	const abortBuild = () => {
		internalController.abort();
	};

	signal?.addEventListener("abort", abortBuild, { once: true });
	process.once("SIGINT", abortBuild);

	try {
		await buildInternal(config, internalController.signal);
	} finally {
		signal?.removeEventListener("abort", abortBuild);
		process.off("SIGINT", abortBuild);
	}
};
