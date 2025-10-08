import type { Logger } from "@/utils/logger";
import * as chokidar from "chokidar";
import path from "node:path";
import { shouldInclude } from "./compile-pack";
import type { PackConfig } from "./config";

export const watchPack = async (ctx: {
	pack: PackConfig;
	log: Logger;
	onChangeDetected: () => void | Promise<void>;
	signal?: AbortSignal;
}): Promise<void> => {
	const { pack, log, onChangeDetected, signal } = ctx;

	const srcDir = path.resolve(pack.srcDir);
	const srcDirRelative = path.relative(".", srcDir);

	const watcher = chokidar.watch(srcDir, {
		persistent: true,
		awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
		atomic: 100,
		ignoreInitial: true,
		ignored: (entry) => !shouldInclude(pack, path.resolve(entry)),
	});

	watcher
		.on("ready", () => log.info(`Watching for file changes in ${srcDirRelative}...`))
		.on("error", (error) => log.error(`Error watching ${srcDirRelative}:`, error))
		.on("add", onChangeDetected)
		.on("change", onChangeDetected)
		.on("unlink", onChangeDetected);

	return new Promise<void>((resolve, reject) => {
		if (signal?.aborted) {
			watcher
				.close()
				.then(() => reject(signal.reason))
				.catch(reject);
			return;
		}
		signal?.addEventListener(
			"abort",
			() => {
				watcher
					.close()
					.then(() => {
						log.info(`Stopped watching '${srcDirRelative}'`);
						resolve();
					})
					.catch((error) => {
						log.error(`Error stopping watcher for '${srcDirRelative}':`, error);
						reject(error);
					});
			},
			{ once: true },
		);
	});
};
