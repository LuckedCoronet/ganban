import { exec } from "node:child_process";
import * as util from "node:util";
import * as esbuild from "esbuild";
import fs from "fs-extra";
import ora from "ora";
import chalk from "chalk";

const execPromise = util.promisify(exec);

const main = async () => {
	const executionTimeStart = performance.now();

	if (fs.existsSync("dist")) {
		const spinnerRmDist = ora("Remove existing build").start();
		try {
			await fs.rm("dist", { recursive: true });
			spinnerRmDist.succeed();
		} catch (error) {
			spinnerRmDist.fail();
			throw error;
		}
	}

	const spinnerBundleCli = ora("Bundle CLI").start();
	try {
		await esbuild.build({
			entryPoints: ["src/cli/index.ts"],
			bundle: true,
			allowOverwrite: true,
			platform: "node",
			target: "node16",
			format: "esm",
			outfile: "dist/cli.js",
			banner: { js: "#!/usr/bin/env node" },
		});
		spinnerBundleCli.succeed();
	} catch (error) {
		spinnerBundleCli.fail();
		throw error;
	}

	const spinnerBundleLib = ora("Bundle Lib").start();
	try {
		await esbuild.build({
			entryPoints: ["src/lib/index.ts"],
			bundle: true,
			allowOverwrite: true,
			platform: "node",
			target: "node16",
			format: "esm",
			outfile: "dist/lib.js",
		});
		spinnerBundleLib.succeed();
	} catch (error) {
		spinnerBundleLib.fail();
		throw error;
	}

	const spinnerGenerateDts = ora("Generate d.ts").start();
	try {
		await execPromise(`npx dts-bundle-generator -o dist/lib.d.ts src/lib/index.ts`);
		spinnerGenerateDts.succeed();
	} catch (error) {
		spinnerGenerateDts.fail();
		throw error;
	}

	const executionTimeEnd = performance.now();
	const executionTime = executionTimeEnd - executionTimeStart;

	console.log(chalk.greenBright(`Build finished in ${executionTime.toFixed(2)} ms`));
};

main().catch((error) => console.error(chalk.red(error)));
