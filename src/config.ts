import type * as esbuild from "esbuild";

export type BuildConfig = {
	behaviorPack?: BehaviorPackConfig;
	resourcePack?: ResourcePackConfig;
	createArchive?: BuildArchiveConfig;
	watch?: boolean;
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
	generateTextureList?: boolean;
};

export type BuildArchiveConfig = {
	outFile: string;
	compressionLevel: number;
};
