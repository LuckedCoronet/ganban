import * as esbuild from "esbuild";
import chalk from "chalk";

const getCurrentTimeToPrint = () => {
	const currentTime = new Date();

	const hours = currentTime.getHours().toString().padStart(2, "0");
	const minutes = currentTime.getMinutes().toString().padStart(2, "0");
	const seconds = currentTime.getSeconds().toString().padStart(2, "0");
	const milliseconds = currentTime.getMilliseconds().toString().padStart(3, "0");

	return `[${hours}:${minutes}:${seconds}:${milliseconds}]`;
};

const main = async () => {
	const bundleCliCtx = await esbuild.context({
		entryPoints: ["src/cli/index.ts"],
		bundle: true,
		allowOverwrite: true,
		platform: "node",
		target: "node16",
		format: "esm",
		outfile: "dist/cli.js",
		banner: { js: "#!/usr/bin/env node" },

		plugins: [
			{
				name: "rebuild-notify",
				setup(build) {
					build.onEnd((result) => {
						const time = getCurrentTimeToPrint();
						if (result.errors.length > 0) {
							console.error(chalk.red(time + " Failed to bundle CLI"));
						} else {
							console.log(time + " Bundled CLI");
						}
					});
				},
			},
		],
	});

	const bundleLibCtx = await esbuild.context({
		entryPoints: ["src/lib/index.ts"],
		bundle: true,
		allowOverwrite: true,
		platform: "node",
		target: "node16",
		format: "esm",
		outfile: "dist/lib.js",

		plugins: [
			{
				name: "rebuild-notify",
				setup(build) {
					build.onEnd((result) => {
						const time = getCurrentTimeToPrint();
						if (result.errors.length > 0) {
							console.error(chalk.red(time + " Failed to bundle Lib"));
						} else {
							console.log(time + " Bundled Lib");
						}
					});
				},
			},
		],
	});

	console.log(chalk.cyan("Watching... (Press CTRL+c to stop)"));
	console.log(chalk.yellow("WARN: Declaration files will not be generated in watch mode"));

	bundleCliCtx.watch();
	bundleLibCtx.watch();

	process.on("SIGINT", () => {
		bundleCliCtx.cancel();
		bundleCliCtx.dispose();
		bundleLibCtx.cancel();
		bundleLibCtx.dispose();
		console.log(chalk.greenBright("Stopped"));
	});
};

main().catch((error) => console.error(error));
