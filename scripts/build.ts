import { exec } from "node:child_process";
import * as util from "node:util";
import * as esbuild from "esbuild";
import fs from "fs-extra";
import chalk from "chalk";

const execPromise = util.promisify(exec);

const main = async () => {
	const executionTimeStart = performance.now();

	if (fs.existsSync("dist")) {
		try {
			await fs.rm("dist", { recursive: true });
			console.log(chalk.green("Removed old build"));
		} catch (error) {
			console.log(chalk.red(`Failed to remove old build. ${error}`));
			throw error;
		}
	}

	try {
		await esbuild.build({
			entryPoints: ["src/cli/index.ts"],
			bundle: true,
			allowOverwrite: true,
			platform: "node",
			target: "node16",
			format: "esm",
			packages: "external",
			outfile: "dist/cli.js",
			banner: { js: "#!/usr/bin/env node" },
		});
		console.log(chalk.green("Bundled CLI"));
	} catch (error) {
		console.log(chalk.red(`Failed to bundke CLI. ${error}`));
		throw error;
	}

	try {
		await esbuild.build({
			entryPoints: ["src/lib/index.ts"],
			bundle: true,
			allowOverwrite: true,
			platform: "node",
			target: "node16",
			format: "esm",
			packages: "external",
			outfile: "dist/lib.js",
		});
		console.log(chalk.green("Bundled Lib"));
	} catch (error) {
		console.log(chalk.red(`Failed to bundke Lib. ${error}`));
		throw error;
	}

	try {
		await execPromise(`pnpm dlx dts-bundle-generator -o dist/lib.d.ts src/lib/index.ts`);
		console.log(chalk.green("Generated declaration file"));
	} catch (error) {
		console.log(chalk.red(`Failed to generate declaration file. ${error}`));
		throw error;
	}

	const executionTimeEnd = performance.now();
	const executionTime = executionTimeEnd - executionTimeStart;

	console.log(chalk.greenBright(`Build finished in ${executionTime.toFixed(2)} ms`));
};

main().catch((error) => console.error(chalk.red(error)));
