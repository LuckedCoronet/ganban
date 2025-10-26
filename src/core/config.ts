import type { LogLevel } from "@/types";
import type * as esbuild from "esbuild";

export type BuildConfig = {
	/**
	 * Configures the behavior pack.
	 * Leave this undefined if you do not want the behavior pack to be included.
	 */
	behaviorPack?: BehaviorPackConfig;
	/**
	 * Configures the resource pack.
	 * Leave this undefined if you do not want the resource pack to be included.
	 */
	resourcePack?: ResourcePackConfig;
	/** Generate one or more archives out of the compiled packs. */
	archives?: BuildArchiveConfig[];
	/**
	 * Watches for file changes in the background and automatically triggers rebuild if changes are found.
	 * __If you enable this, a promise returned by `build()` will not resolve until it is aborted via AbortSignal.__
	 * @default false
	 */
	watch?: boolean;
	/**
	 * Sets the log level.
	 * @default "info"
	 */
	logLevel?: LogLevel;
};

export type PackConfig = BehaviorPackConfig | ResourcePackConfig;

export type CommonPackConfig = {
	/** Sets the source directory of the pack. */
	srcDir: string;
	/**
	 * Sets the output directory of the pack.
	 *
	 * __A path within your project directory is highly recommended.__
	 * For example, `./build/bp` for behavior pack.
	 */
	outDir: string;
	/**
	 * Copies the compiled pack generated at `outDir` to any location(s).
	 *
	 * You can use this to copy output to somewhere external, like `com.mojang` during development.
	 * In that case, this should be set to something like the example below.
	 *
	 * @example
	 * // Replace {USER} with your actual username.
	 * ["C:/Users/{USER}/AppData/Local/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang/development_behavior_packs/My_Addon_BP"]
	 */
	targetDirs?: string[];
	/**
	 * Sets the custom `manifest.json` content as a plain JavaScript object.
	 * So you can benefit from scripting capabilities.
	 */
	manifest?: Record<string, unknown>;
	/** Use glob patterns to set the files to include in the output. `exclude` takes precedence. */
	include?: string[];
	/** Use glob patterns to set the files to be excluded/ignored from the output. */
	exclude?: string[];
};

export type BehaviorPackConfig = CommonPackConfig & {
	type: "behavior";
	/**
	 * Compiles/bundles behavior pack scripts.
	 * Supports TypeScript too!
	 *
	 * Powered by [esbuild](https://esbuild.github.io/)
	 */
	scripts?: BehaviorPackScriptConfig;
};

export type BehaviorPackScriptConfig = {
	/**
	 * Path to the entry-point/main script, relative to current directory.
	 * Can be TypeScript as well.
	 */
	entry: string;
	/**
	 * Bundles scripts into a single file.
	 * Name of the generated bundle file will be the same as `entry` (but JavaScript).
	 *
	 * **Enable this to easily bundle platform-agnostic npm packages.**
	 *
	 * Recommended packages:
	 * - [gl-matrix](https://www.npmjs.com/package/gl-matrix): Vector calculations.
	 * - [emittery](https://www.npmjs.com/package/emittery): Async event emitter.
	 * - Your own package!
	 *
	 * @default false
	 */
	bundle?: boolean;
	/**
	 * Enables the minification of the bundled script file, reducing the file size.
	 *
	 * __This sometimes break.__
	 *
	 * @default false
	 */
	minify?: boolean;
	/**
	 * Generates source map. Required for debugging TypeScript with the
	 * [Minecraft Bedrock Debugger](https://marketplace.visualstudio.com/items?itemName=mojang-studios.minecraft-debugger)
	 * VSCode extension.
	 *
	 * @default false
	 */
	sourceMap?: boolean;
	/** Specifies the path to the tsconfig file. */
	tsconfig?: string;
	/** Override esbuild options. */
	esbuildOptions?: esbuild.CommonOptions;
};

export type ResourcePackConfig = CommonPackConfig & {
	type: "resource";
	/**
	 * Whether to generate [texture_list.json](https://wiki.bedrock.dev/concepts/textures-list)
	 * that lists all texture files.
	 * @default false
	 */
	generateTextureList?: boolean;
};

export type BuildArchiveConfig = {
	/** Sets the output location of the archive file. */
	outFile: string;
};
