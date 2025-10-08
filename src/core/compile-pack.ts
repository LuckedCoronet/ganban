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
	ctx: CompilePackContext,
	shouldBundle: boolean,
): Promise<void> => {
	const { packConfig, log, signal } = ctx;

	if (!shouldBundle || packConfig.type !== "behavior" || !packConfig.scripts) return;

	log.debug("Script change(s) were detected. Bundling scripts using esbuild...");

	const srcDir = path.resolve(packConfig.srcDir);
	const outDir = path.resolve(packConfig.outDir);
	const scriptsOutDir = path.join(outDir, "scripts");

	await fs.rm(scriptsOutDir, { recursive: true, force: true });

	const result = await bundleScripts(
		packConfig.scripts,
		path.join(srcDir, "scripts"),
		scriptsOutDir,
		signal,
	);

	log.debug(`Bundled scripts. Errors: ${result.errors}`);
};

const generateTextureListIfNeeded = async (
	ctx: CompilePackContext,
	shouldGenerateTextureList: boolean,
): Promise<void> => {
	const { packConfig, log } = ctx;

	if (
		!shouldGenerateTextureList ||
		packConfig.type !== "resource" ||
		!packConfig.generateTextureList
	)
		return;

	log.debug("Texture change(s) were detected. Generating texture list...");

	const srcDir = path.resolve(packConfig.srcDir);
	const outDir = path.resolve(packConfig.outDir);

	if (await fs.pathExists(path.join(srcDir, TEXTURE_LIST_PATH))) {
		log.warn(
			"Texture list file generation is enabled but the file already exists in source directory. It will be overwritten.",
		);
	}

	const textureDir = path.join(outDir, TEXTURES_DIR_PREFIX);
	const textureFiles: string[] = await glob("**/*.png", { cwd: textureDir });
	const textureList: string[] = textureFiles.map(
		(file) => `${TEXTURES_DIR_PREFIX}${file.replaceAll("\\", "/").replace(/\.[^/.]+$/, "")}`,
	);
	const json = JSON.stringify(textureList, null, 2);

	await fs.outputFile(path.join(outDir, TEXTURE_LIST_PATH), json, "utf8");

	log.debug(
		`Generated texture list. ${textureList.length} elements currently exist in the texture list.`,
	);
};

const writeManifestFileIfNeeded = async (ctx: CompilePackContext): Promise<void> => {
	const { packConfig, log } = ctx;

	if (!packConfig.manifest) return;

	const srcDir = path.resolve(packConfig.srcDir);
	const outDir = path.resolve(packConfig.outDir);

	if (await fs.pathExists(path.join(srcDir, "manifest.json"))) {
		log.warn(
			"Pack manifest object is defined in config but a raw manifest.json exists in source directory. It will be overwritten.",
		);
	}

	const filePath = path.resolve(path.join(outDir, "manifest.json"));
	const json = JSON.stringify(packConfig.manifest, null, 2);

	await fs.outputFile(filePath, json, "utf8");

	log.debug("Written manifest.");
};

export const compilePack = async (ctx: CompilePackContext): Promise<CompilePackResult> => {
	const { packConfig, log, signal } = ctx;
	const srcDir = path.resolve(packConfig.srcDir);
	const outDir = path.resolve(packConfig.outDir);

	signal?.throwIfAborted();

	if (ctx.isInitialCompile && (await fs.pathExists(outDir))) {
		await fs.rm(outDir, { recursive: true });
		log.info("Removed existing build");
	}

	log.info("Compiling...");

	const { changes, newCache } = await detectFileChanges(ctx);

	if (changes.length === 0) {
		log.info("No changes were detected");
		return { newCache };
	}

	let shouldBundleScripts = false;
	let shouldGenerateTextureList = false;

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
			shouldGenerateTextureList = true;
		}

		fileProcessingPromises.push(applyFileChange(ctx, change));
	}

	await Promise.all(fileProcessingPromises);

	await Promise.all([
		bundleScriptsIfNeeded(ctx, shouldBundleScripts),
		generateTextureListIfNeeded(ctx, shouldGenerateTextureList),
		writeManifestFileIfNeeded(ctx),
	]);

	log.info("Compiled!");

	return { newCache };
};
