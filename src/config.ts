import type * as esbuild from "esbuild";

export type BehaviorPackScriptConfig = {
	entry: string;
	bundle?: boolean;
	minify?: boolean;
	sourceMap?: boolean;
	esbuildOptions?: esbuild.CommonOptions;
};

export type BehaviorPackConfig = CommonPackConfig & {
	type: "behaviorPack";
	scripts?: BehaviorPackConfig;
};

export type ResourcePackConfig = CommonPackConfig & {
	type: "resourcePack";
	generateTextureList?: boolean;
};

export type CommonPackConfig = {
	srcDir: string;
	outDir: string;
	manifest?: Record<string, unknown>;
	include?: string[];
	exclude?: string[];
	watch?: boolean;
};

export type PackConfig = BehaviorPackConfig | ResourcePackConfig;

export type BuildConfig = {
	packs?: PackConfig[];
};
