import type { Logger } from "@/utils/logger";
import { testInclusion } from "@/utils/matching";
import fs from "fs-extra";
import { glob } from "glob";
import JSON5 from "json5";
import path from "node:path";
import type { PackConfig } from "./config";
import { bundleScripts } from "./bundle-scripts";

export type PackCache = {
	[file: string]: {
		timestamp: number;
	};
};

export type CompilePackContext = {
	packConfig: PackConfig;
	log: Logger;
	cache: PackCache;
	isInitialCompile: boolean;
	signal?: AbortSignal;
};

export type CompilePackResult = {
	newCache: PackCache;
};

type FileChange = {
	type: "add" | "change" | "remove";
	filePath: string;
};

const SCRIPT_FILE_EXTENSIONS = new Set<string>([".js", ".cjs", ".mjs", ".ts", ".cts", ".mts"]);
const TEXTURE_LIST_PATH = "textures/texture_list.json";
const TEXTURES_DIR_PREFIX = "textures/";

export const shouldInclude = (pack: PackConfig, srcPath: string): boolean => {
	const srcDir = path.resolve(pack.srcDir);
	const exclude = pack.exclude ?? [];
	return testInclusion(srcPath, srcDir, pack.include, exclude);
};

const getIncludedFiles = async (ctx: CompilePackContext): Promise<string[]> => {
	const { packConfig, log, signal } = ctx;
	const srcDir = path.resolve(packConfig.srcDir);

	signal?.throwIfAborted();

	const queue = [srcDir];
	const files: string[] = [];

	while (queue.length > 0) {
		signal?.throwIfAborted();
		const dir = queue.shift()!;

		try {
			const entries = await fs.readdir(dir);
			const promises = entries.map(async (entry) => {
				const fullPath = path.join(dir, entry);
				if (!shouldInclude(packConfig, fullPath)) return;

				const stats = await fs.stat(fullPath);
				if (stats.isDirectory()) {
					queue.push(fullPath);
				} else if (stats.isFile()) {
					files.push(fullPath);
				}
			});
			await Promise.all(promises);
		} catch (error) {
			log.error(`Error reading directory ${dir}:`, error);
		}
	}

	return files;
};

const detectFileChanges = async (
	ctx: CompilePackContext,
): Promise<{ changes: FileChange[]; newCache: PackCache }> => {
	const { cache, log, signal } = ctx;

	signal?.throwIfAborted();

	const files = await getIncludedFiles(ctx);
	const newCache: PackCache = {};
	const changes: FileChange[] = [];
	const currentFiles = new Set<string>();

	for (const filePath of files) {
		signal?.throwIfAborted();
		try {
			const stats = await fs.stat(filePath);
			currentFiles.add(filePath);
			const currentTimestamp = stats.mtimeMs;
			const cachedEntry = cache[filePath];

			if (!cachedEntry) {
				changes.push({ type: "add", filePath });
			} else if (cachedEntry.timestamp !== currentTimestamp) {
				changes.push({ type: "change", filePath });
			}
			newCache[filePath] = { timestamp: currentTimestamp };
		} catch (error) {
			log.error(`Error processing file ${filePath}:`, error);
		}
	}

	for (const filePath in cache) {
		if (!currentFiles.has(filePath)) {
			changes.push({ type: "remove", filePath });
		}
	}

	return { changes, newCache };
};

const shouldConvertFileToJson = (filePath: string): boolean => {
	const ext = path.extname(filePath);
	return ext === ".jsonc" || ext === ".json5";
};

const getDestPath = (ctx: CompilePackContext, srcPath: string): string => {
	const srcDir = path.resolve(ctx.packConfig.srcDir);
	const outDir = path.resolve(ctx.packConfig.outDir);
	const parsedSrcPath = path.parse(srcPath);

	if (shouldConvertFileToJson(srcPath)) {
		parsedSrcPath.base = `${parsedSrcPath.name}.json`;
	}

	const relativePath = path.relative(srcDir, path.format(parsedSrcPath));
	return path.join(outDir, relativePath);
};

const applyFileChange = async (ctx: CompilePackContext, change: FileChange): Promise<void> => {
	if (SCRIPT_FILE_EXTENSIONS.has(change.filePath)) {
		throw new Error("Script file changes cannot be applied in this function!");
	}

	const destPath = getDestPath(ctx, change.filePath);

	if (change.type === "remove") {
		if (await fs.pathExists(destPath)) {
			await fs.rm(destPath);
			const destDir = path.dirname(destPath);
			if ((await fs.readdir(destDir)).length === 0) {
				await fs.rm(destDir, { recursive: true, force: true });
			}
		}
		return;
	}

	// Handle 'add' and 'change'

	const srcContent = await fs.readFile(change.filePath);
	let destContent: Buffer | string = srcContent;

	// Convert JSON5/JSONC to plain JSON
	if (shouldConvertFileToJson(change.filePath)) {
		destContent = JSON.stringify(JSON5.parse(srcContent.toString("utf8")), null, 2);
	}

	await fs.outputFile(destPath, destContent);
};

const bundleScriptsIfNeeded = async (
	pack: PackConfig,
	srcDir: string,
	outDir: string,
	shouldBundle: boolean,
	signal?: AbortSignal,
): Promise<void> => {
	if (!shouldBundle || pack.type !== "behavior" || !pack.scripts) return;
	const scriptsOutDir = path.join(outDir, "scripts");
	await fs.rm(scriptsOutDir, { recursive: true, force: true });
	await bundleScripts(pack.scripts, path.join(srcDir, "scripts"), scriptsOutDir, signal);
};

const generateTextureListIfNeeded = async (
	pack: PackConfig,
	outDir: string,
	textureChangesDetected: boolean,
): Promise<void> => {
	if (!textureChangesDetected || pack.type !== "resource" || !pack.generateTextureList) return;

	const textureDir = path.join(outDir, TEXTURES_DIR_PREFIX);
	const textureFiles = await glob("**/*.png", { cwd: textureDir });
	const textureList = textureFiles.map(
		(file) => `${TEXTURES_DIR_PREFIX}${file.replaceAll("\\", "/").replace(/\.[^/.]+$/, "")}`,
	);
	const json = JSON.stringify(textureList, null, 2);

	await fs.outputFile(path.join(outDir, TEXTURE_LIST_PATH), json, "utf8");
};

const writeManifestFileIfNeeded = async (pack: PackConfig): Promise<void> => {
	const filePath = path.resolve(path.join(pack.outDir, "manifest.json"));
	const json = JSON.stringify(pack.manifest, null, 2);
	await fs.outputFile(filePath, json, "utf8");
};

export const compilePack = async (ctx: CompilePackContext): Promise<CompilePackResult> => {
	const { packConfig, log, signal } = ctx;
	const srcDir = path.resolve(packConfig.srcDir);
	const outDir = path.resolve(packConfig.outDir);

	signal?.throwIfAborted();

	log.info("Compiling...");

	const { changes, newCache } = await detectFileChanges(ctx);
	if (changes.length === 0) {
		log.info("No changes were detected");
		return { newCache };
	}

	let shouldBundleScripts = false;
	let textureChangesDetected = false;

	const fileProcessingPromises: Promise<void>[] = [];

	for (const change of changes) {
		signal?.throwIfAborted();
		const relativePath = path.relative(srcDir, change.filePath).replaceAll("\\", "/");

		if (
			packConfig.type === "behavior" &&
			packConfig.scripts &&
			SCRIPT_FILE_EXTENSIONS.has(path.extname(change.filePath))
		) {
			shouldBundleScripts = true;
			continue; // Let the bundler handle script files
		}

		if (relativePath.startsWith(TEXTURES_DIR_PREFIX) && path.extname(change.filePath) === ".png") {
			textureChangesDetected = true;
		}

		fileProcessingPromises.push(applyFileChange(ctx, change));
	}

	await Promise.all(fileProcessingPromises);

	await Promise.all([
		bundleScriptsIfNeeded(packConfig, srcDir, outDir, shouldBundleScripts, signal),
		generateTextureListIfNeeded(packConfig, outDir, textureChangesDetected),
		writeManifestFileIfNeeded(packConfig),
	]);

	return { newCache };
};
