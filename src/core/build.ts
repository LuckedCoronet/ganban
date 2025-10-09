import { debounce } from "@/utils/debounce";
import { createLogger, type Logger } from "@/utils/logger";
import { compilePack, type CompilePackResult, type PackCache } from "./compile-pack";
import type { BuildConfig } from "./config";
import { watchPack } from "./pack-watcher";
import { createArchive, type ArchiveSourceDirectory } from "./archive-generation";
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

	const runBuild = async (isInitialCompile = true): Promise<void> => {
		try {
			signal?.throwIfAborted();

			log.info("Build started");

			const startTime = performance.now();

			const result = await compilePacks({
				config,
				log,
				behaviorPackCache,
				resourcePackCache,
				isInitialCompile,
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

	const runBuildDebounced = debounce(
		async () => {
			log.info(`File change(s) detected. Recompiling...`);
			await runBuild();
		},
		100,
		signal,
	);
	const onChangeDetected = runBuildDebounced;

	const watchPromises: Promise<void>[] = [];
	if (config.behaviorPack)
		watchPromises.push(watchPack({ pack: config.behaviorPack, log, onChangeDetected, signal }));
	if (config.resourcePack)
		watchPromises.push(watchPack({ pack: config.resourcePack, log, onChangeDetected, signal }));

	log.debug(`Waiting for ${watchPromises.length} watchers to be closed/aborted...`);

	await Promise.all(watchPromises);
};
