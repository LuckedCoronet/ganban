import { isFileUrl } from "@/utils/url";
import * as esbuild from "esbuild";
import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BehaviorPackScriptConfig } from "./config";

const createCustomWritePlugin = (sourceRoot: string): esbuild.Plugin => {
	const onEnd = async (result: esbuild.BuildResult) => {
		if (!result.outputFiles) return;

		for (const outputFile of result.outputFiles) {
			let finalText: string;

			if (path.extname(outputFile.path) === ".map") {
				// Tweak source map contents to work with the Minecraft script debugger
				const data = JSON.parse(outputFile.text);
				const sources = data.sources as string[];
				data.sources = sources.map((value) => {
					const dir = path.dirname(outputFile.path);
					const absPath = path.resolve(dir, isFileUrl(value) ? fileURLToPath(value) : value);
					const relativePath = path.relative(sourceRoot, absPath);
					return relativePath;
				});

				finalText = JSON.stringify(data, null, 2);
			} else {
				finalText = outputFile.text;
			}

			await fs.ensureDir(path.dirname(outputFile.path));
			await fs.writeFile(outputFile.path, finalText, "utf8");
		}
	};

	return {
		name: "custom-write",
		setup: (build) => {
			build.onEnd(onEnd);
		},
	};
};

const createEsbuildOptions = (
	config: BehaviorPackScriptConfig,
	srcDir: string,
	outDir: string,
): esbuild.BuildOptions => {
	const sourceRoot = path.resolve(srcDir);
	outDir = path.resolve(outDir);

	let esbuildOpts: esbuild.BuildOptions = {
		outdir: outDir,
		tsconfig: config.tsconfig,
		format: "esm",
		write: false,
		plugins: [createCustomWritePlugin(sourceRoot)],

		// Even though Minecraft scripts doesn't run on node, the way package
		// resolution works (in development environment) is still node.
		// "neutral" will throw an error when bundling an external package.
		platform: "node",
	};

	if (config.bundle) {
		esbuildOpts = {
			...esbuildOpts,
			entryPoints: [config.entry],
			bundle: true,
			minify: config.minify,
			external: ["@minecraft"],
		};
	} else {
		const entryPoints = path.relative(".", path.join(sourceRoot, "**", "*")).replaceAll("\\", "/");
		esbuildOpts = {
			...esbuildOpts,
			entryPoints: [entryPoints],
		};
	}

	if (config.sourceMap) {
		esbuildOpts = {
			...esbuildOpts,
			sourcemap: "linked",
			sourceRoot: sourceRoot,
		};
	}

	esbuildOpts = {
		...esbuildOpts,
		...config.esbuildOptions,
	};

	return esbuildOpts;
};

export const bundleScripts = async (
	config: BehaviorPackScriptConfig,
	srcDir: string,
	outDir: string,
	signal?: AbortSignal,
): Promise<esbuild.BuildResult> => {
	signal?.throwIfAborted();
	await fs.ensureDir(outDir);

	const esbuildOptions = createEsbuildOptions(config, srcDir, outDir);
	const result = await esbuild.build(esbuildOptions);

	return result;
};
