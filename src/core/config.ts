import type { LogLevel } from "@/types";
import type * as esbuild from "esbuild";

export type BuildConfig = {
	behaviorPack?: BehaviorPackConfig;
	resourcePack?: ResourcePackConfig;
	archives?: BuildArchiveConfig[];
	watch?: boolean;
	logLevel?: LogLevel;
};

export type PackConfig = BehaviorPackConfig | ResourcePackConfig;

export type CommonPackConfig = {
	srcDir: string;
	outDir: string;
	manifest?: Record<string, unknown>;
	include?: string[];
	exclude?: string[];
};

export type BehaviorPackConfig = CommonPackConfig & {
	type: "behavior";
	scripts?: BehaviorPackScriptConfig;
};

export type BehaviorPackScriptConfig = {
	entry: string;
	bundle?: boolean;
	minify?: boolean;
	sourceMap?: boolean;
	tsconfig?: string;
	esbuildOptions?: esbuild.CommonOptions;
};

export type ResourcePackConfig = CommonPackConfig & {
	type: "resource";
	generateTextureList?: boolean;
};

export type BuildArchiveConfig = {
	outFile: string;
};
