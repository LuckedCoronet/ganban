import * as node_path from "node:path";
import * as node_url from "node:url";
import { pipeline } from "node:stream/promises";
import chalk from "chalk";
import fs from "fs-extra";
import JSON5 from "json5";
import chokidar from "chokidar";
import * as esbuild from "esbuild";
import { getMod2jsonCreator, getModuleType, ModuleType } from "./mod2json/internal";
import { fileExists, getShortCurrentTimeString } from "./utils";

const ONE_GB: number = 1 * 1024 * 1024 * 1024;

type PackType = "BP" | "RP";

const getPrefixedLogFunc = (
	packType: PackType,
): ((msg: string, displayTime?: boolean) => string) => {
	return (msg, displayTime = false) => {
		return (displayTime ? `${getShortCurrentTimeString()} ` : "") + `${packType}: ${msg}`;
	};
};

export type CompilePackOpts = {
	readonly packType: PackType;
	readonly srcDir: string;
	readonly targetDir: string;
	readonly ignore?: RegExp[];
	readonly watch?: boolean;
	readonly minify?: boolean;
	readonly tsconfig?: string;
	readonly sourcemap?: boolean;
};

type FileProcess = {
	abort: () => void;
};

/**
 * @throws This function can throw errors.
 */
const processMod2jsonModuleFile = async (
	fullSrcPath: string,
	fullTargetPath: string,
	moduleType: ModuleType,
	minify?: boolean,
): Promise<void> => {
	let mod2jsonCreator;
	try {
		mod2jsonCreator = await getMod2jsonCreator(fullSrcPath, moduleType);
	} catch (err) {
		throw new Error(`Failed to get Mod2json creator. ${err}`);
	}

	const stringify = (obj: any): string => JSON.stringify(obj, null, minify ? undefined : 2);

	if (mod2jsonCreator.type === "single") {
		const object = mod2jsonCreator.create({ minify: minify === true });
		const json = stringify(object);
		const path = fullTargetPath.slice(0, -node_path.extname(fullTargetPath).length);

		await fs.writeFile(path, json, { encoding: "utf-8" });
		return;
	}

	const objects = mod2jsonCreator.create({ minify: minify === true });
	for (let i = 0; i < objects.length; i++) {
		const object = objects[i]!;
		const json = stringify(object);
		let path = fullTargetPath.slice(0, -(node_path.extname(fullTargetPath).length + 5));
		path = `${path}_${i + 1}.json`;

		await fs.writeFile(path, json, { encoding: "utf-8" });
	}
};

/**
 * @throws This function can throw errors.
 */
const processFile = async (
	fullSrcPath: string,
	fullTargetPath: string,
	fileProcessMap?: Map<string, FileProcess>,
	minify?: boolean,
): Promise<void> => {
	const { ext: extname, name: basenameNoExt } = node_path.parse(fullSrcPath);

	const moduleType = getModuleType(fullSrcPath);

	if (moduleType !== "none") {
		await processMod2jsonModuleFile(fullSrcPath, fullTargetPath, moduleType, minify);
		return;
	}

	if ((minify && extname === ".json") || extname === ".json5") {
		const text = await fs.readFile(fullSrcPath, { encoding: "utf-8" });
		const obj = JSON5.parse(text);
		const json = JSON.stringify(obj, null, minify && basenameNoExt !== "manifest" ? undefined : 2);
		const path = extname === ".json5" ? fullTargetPath.slice(0, -1) : fullTargetPath;
		await fs.writeFile(path, json, { encoding: "utf-8" });
		return;
	}

	const controller = new AbortController();
	const { signal } = controller;

	if (fileProcessMap) {
		fileProcessMap.set(fullSrcPath, {
			abort: () => {
				try {
					controller.abort();
				} finally {
					console.log(`Aborted file process of ${fullSrcPath}`);
				}
			},
		});
	}

	const pipelinePromsie = pipeline(
		fs.createReadStream(fullSrcPath),
		fs.createWriteStream(fullTargetPath),
		{ signal },
	);

	pipelinePromsie
		.then(() => {
			if (fileProcessMap) {
				fileProcessMap.delete(fullSrcPath);
			}
		})
		.catch(console.error);
};

const getScriptEntryFile = (dir: string): string | undefined => {
	const testName = (name: string) => {
		const js = node_path.join(dir, `${name}.js`);
		if (fileExists(js)) return js;

		const mjs = node_path.join(dir, `${name}.mjs`);
		if (fileExists(mjs)) return mjs;

		const ts = node_path.join(dir, `${name}.ts`);
		if (fileExists(ts)) return ts;

		const mts = node_path.join(dir, `${name}.mts`);
		if (fileExists(mts)) return mts;

		return undefined;
	};

	const index = testName("index");
	if (index !== undefined) return index;

	const main = testName("main");
	if (main !== undefined) return main;

	const entry = testName("entry");
	if (entry !== undefined) return entry;
};

/**
 * @throws This function can throw errors.
 */
const compilePackInternal = async (opts: CompilePackOpts): Promise<void> => {
	const getPrefixedLogMsg = getPrefixedLogFunc(opts.packType);

	const srcDir = node_path.resolve(opts.srcDir);
	const targetDir = node_path.resolve(opts.targetDir);

	await fs.ensureDir(targetDir);

	let scriptEntryFile: string | undefined = undefined;

	const walkdir = async (dir = srcDir): Promise<void> => {
		const dirContents = await fs.readdir(dir);
		for (const contentName of dirContents) {
			const fullSrcPath = node_path.join(dir, contentName);
			const relativeSrcPath = node_path.relative(srcDir, fullSrcPath);
			const fullTargetPath = node_path.join(targetDir, relativeSrcPath);

			if (relativeSrcPath === "scripts") {
				scriptEntryFile = getScriptEntryFile(fullSrcPath);
				continue; // Bundle scripts later
			}

			if (opts.ignore?.some((pattern) => pattern.test(relativeSrcPath))) continue;

			const stat = await fs.stat(fullSrcPath);

			if (stat.isDirectory()) {
				await fs.mkdir(fullTargetPath);
				await walkdir(fullSrcPath);
				continue;
			}

			if (!stat.isFile()) continue;
			if (stat.size > ONE_GB) throw new Error("File is too big!");

			await processFile(fullSrcPath, fullTargetPath, undefined, opts.minify);
		}
	};

	console.log(getPrefixedLogMsg("Started compiling..."));

	// Initial compilation
	await walkdir();

	console.log(getPrefixedLogMsg("Processed files"));

	// Bundle scripts
	let esbuildCtx: esbuild.BuildContext | undefined = undefined;
	if (typeof scriptEntryFile === "string") {
		const targetScriptsDir = node_path.join(targetDir, "scripts");
		const srcScriptsDir = node_path.dirname(scriptEntryFile);
		const outfile = node_path.join(targetScriptsDir, `${node_path.parse(scriptEntryFile).name}.js`);

		await fs.ensureDir(targetScriptsDir);

		const esbuildOpts: esbuild.BuildOptions = {
			entryPoints: [scriptEntryFile],
			bundle: true,
			minify: opts.minify,
			external: ["@minecraft"],
			platform: "neutral",
			format: "esm",
			target: ["es2023"],
			charset: "utf8",
			write: false, // For custom write plugin below
			outfile,
			allowOverwrite: true,
			tsconfig: opts.tsconfig,
			sourcemap: opts.sourcemap ? "linked" : undefined,
			sourceRoot: opts.sourcemap ? srcScriptsDir : undefined,
			plugins: [],
		};

		const customWritePlugin: esbuild.Plugin = {
			name: "custom-write",
			setup(build) {
				build.onEnd((result) => {
					if (result.outputFiles === undefined) return;
					for (const outputFile of result.outputFiles) {
						if (!outputFile.path.endsWith(".map")) {
							fs.writeFileSync(outputFile.path, outputFile.contents);
							continue;
						}

						const srcScriptsDirUrl = `${node_url.pathToFileURL(srcScriptsDir).toString()}/`;
						const modified = outputFile.text.replaceAll(srcScriptsDirUrl, "");

						fs.writeFileSync(outputFile.path, modified);
					}
				});
			},
		};

		esbuildOpts.plugins!.push(customWritePlugin);

		if (opts.watch) {
			esbuildOpts.plugins!.push({
				name: "rebuild-notify",
				setup(build) {
					build.onEnd((result) => {
						if (result.errors.length > 0) {
							console.error(getPrefixedLogMsg("Failed to bundle scripts", true));
						} else {
							console.log(getPrefixedLogMsg("Bundled scripts", true));
						}
					});
				},
			});

			esbuildCtx = await esbuild.context(esbuildOpts);
		} else {
			await esbuild.build(esbuildOpts);
			console.log(getPrefixedLogMsg(`Bundled scripts`));
		}
	}

	// Watch mode
	if (!opts.watch) return;

	console.log(chalk.cyan(getPrefixedLogMsg("Watching for file changes... (Press CTRL+c to stop)")));

	const getUsefulPaths = (fullSrcPath: string) => {
		const relativeSrcPath = node_path.relative(srcDir, fullSrcPath);
		const fullTargetPath = node_path.join(targetDir, relativeSrcPath);
		return { relativeSrcPath, fullTargetPath };
	};

	const watcher = chokidar.watch(srcDir, {
		ignored: [/.*\/scripts.*/].concat(opts.ignore ?? []),
		ignoreInitial: true,
		persistent: true,
		awaitWriteFinish: {
			pollInterval: 100,
			stabilityThreshold: 400,
		},
	});

	const fileProcessMap = new Map<string, FileProcess>();

	const abortPotentialFileProcessOf = (path: string): boolean => {
		const fileProcess = fileProcessMap.get(path);
		if (!fileProcess) return false;
		fileProcess.abort();
		return true;
	};

	watcher.on("add", (fullSrcPath) => {
		const { relativeSrcPath, fullTargetPath } = getUsefulPaths(fullSrcPath);
		console.log(getPrefixedLogMsg(`Add: ${relativeSrcPath}`, true));
		processFile(fullSrcPath, fullTargetPath, fileProcessMap, opts.minify).catch(console.error);
	});

	watcher.on("change", (fullSrcPath) => {
		const { relativeSrcPath, fullTargetPath } = getUsefulPaths(fullSrcPath);
		if (abortPotentialFileProcessOf(fullSrcPath)) fs.rmSync(fullTargetPath, { force: true });
		console.log(getPrefixedLogMsg(`Change: ${relativeSrcPath}`, true));
		processFile(fullSrcPath, fullTargetPath, fileProcessMap, opts.minify).catch(console.error);
	});

	watcher.on("unlink", (fullSrcPath) => {
		const { relativeSrcPath, fullTargetPath } = getUsefulPaths(fullSrcPath);
		abortPotentialFileProcessOf(fullSrcPath);
		console.log(getPrefixedLogMsg(`Remove: ${relativeSrcPath}`, true));
		fs.rmSync(fullTargetPath, { force: true });
	});

	watcher.on("unlinkDir", (fullSrcPath) => {
		const { relativeSrcPath, fullTargetPath } = getUsefulPaths(fullSrcPath);
		abortPotentialFileProcessOf(fullSrcPath);
		console.log(getPrefixedLogMsg(`Remove Dir: ${relativeSrcPath}`, true));
		fs.rmSync(fullTargetPath, { recursive: true, force: true });
	});

	watcher.on("addDir", (fullSrcPath) => {
		const { relativeSrcPath, fullTargetPath } = getUsefulPaths(fullSrcPath);
		console.log(getPrefixedLogMsg(`Add Dir: ${relativeSrcPath}`, true));
		fs.mkdirSync(fullTargetPath, { recursive: true });
	});

	if (esbuildCtx) {
		await esbuildCtx.watch();
	}

	let finish = false;

	process.once("SIGINT", () => {
		(async () => {
			await watcher.close();
			if (esbuildCtx) {
				await esbuildCtx.cancel();
				await esbuildCtx.dispose();
			}
			finish = true;
			console.log(chalk.green(getPrefixedLogMsg("Stopped watching", true)));
		})();
	});

	// Wait for 'finish' flag to be true
	await new Promise<void>((resolve) => {
		const timer = setInterval(() => {
			if (finish) {
				clearTimeout(timer);
				resolve();
			}
		}, 100);
	});
};

type CompilePackResult =
	| {
			readonly success: true;
			readonly executionTime: number;
	  }
	| {
			readonly success: false;
			readonly error: unknown;
	  };

export const compilePack = async (opts: CompilePackOpts): Promise<CompilePackResult> => {
	if (fs.existsSync(opts.targetDir)) {
		const rmExecTimeStart = performance.now();
		await fs.remove(opts.targetDir);
		const rmExecTimeEnd = performance.now();
		const rmExecTimeString = `${(rmExecTimeEnd - rmExecTimeStart).toFixed(2)}ms`;
		console.log(chalk.gray(`Deleted old ${opts.packType} build in ${rmExecTimeString}`));
	}

	try {
		const executionTimeStart = performance.now();

		await compilePackInternal(opts);

		const executionTimeEnd = performance.now();
		const executionTime = executionTimeEnd - executionTimeStart;

		return {
			success: true,
			executionTime,
		};
	} catch (error) {
		return {
			success: false,
			error,
		};
	}
};
