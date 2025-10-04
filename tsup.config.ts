import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts", "src/cli.ts"],
	outDir: "dist",
	bundle: true,
	dts: true,
	clean: true,
	format: "esm",
	platform: "node",
});
