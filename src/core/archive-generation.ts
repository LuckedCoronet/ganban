import fs from "fs-extra";
import path from "node:path";
import { promises as fsPromises } from "node:fs";
import archiver from "archiver";
import type { Logger } from "@/utils/logger";

/** Defines the information for a directory to be added to the archive. */
export type ArchiveSourceDirectory = {
	/** The physical path of the directory to add. */
	path: string;
	/** The name of the directory within the ZIP archive. */
	name: string;
};

/** Defines options for the archive creation, including an AbortSignal. */
export type CreateArchiveOptions = {
	logger?: Logger;
	signal?: AbortSignal;
};

/**
 * Asynchronously creates a ZIP archive from multiple source directories.
 * The operation can be cancelled via an AbortSignal.
 *
 * @param sourceDirs An array of objects defining the source directories to add.
 * @param outputPath The path where the generated ZIP file will be saved.
 * @param options Options including a logger and an AbortSignal.
 * @returns A promise that resolves when the operation is complete.
 */
export async function createArchive(
	sourceDirs: ArchiveSourceDirectory[],
	outputPath: string,
	options: CreateArchiveOptions = {},
): Promise<void> {
	const { logger, signal } = options;

	signal?.throwIfAborted();

	// Asynchronously ensure the output directory exists.
	const outputDir = path.dirname(outputPath);
	await fsPromises.mkdir(outputDir, { recursive: true });

	const output = fs.createWriteStream(outputPath);
	const archive = archiver("zip", {
		zlib: { level: 9 }, // Set compression level.
	});

	return new Promise((resolve, reject) => {
		// Centralized cleanup function.
		const cleanup = () => {
			signal?.removeEventListener("abort", abortHandler);
		};

		// Abort handler to destroy the archive stream on cancellation.
		const abortHandler = () => {
			archive.destroy(new Error("Operation was aborted."));
		};

		// Centralized error handler.
		const errorHandler = (err: Error) => {
			cleanup();
			reject(err);
		};

		signal?.addEventListener("abort", abortHandler, { once: true });

		// Handle successful completion.
		output.on("close", () => {
			logger?.info(
				`Generated an archive: ${path.basename(path.resolve(outputPath))} (${archive.pointer()} total bytes)`,
			);
			cleanup();
			resolve();
		});

		// Handle errors from the writable stream (e.g., disk full).
		output.on("error", errorHandler);

		// Handle non-fatal warnings from the archiver.
		archive.on("warning", (err) => {
			// Log missing file warnings but treat other warnings as fatal errors.
			if (err.code === "ENOENT") {
				logger?.warn(`Archive generation warning: ${err.message}`);
			} else {
				errorHandler(err);
			}
		});

		// Handle fatal errors from the archiver.
		archive.on("error", errorHandler);

		archive.pipe(output);

		// Add each specified directory to the archive.
		for (const dir of sourceDirs) {
			archive.directory(dir.path, dir.name);
		}

		// Finalize the archive, signaling that no more files will be added.
		archive.finalize();
	});
}
