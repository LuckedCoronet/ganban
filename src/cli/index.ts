import { Command } from "commander";
import chalk from "chalk";
import { compilePack } from "@shared/compiler";
import { createCompilePackOptsFromConfig, isConfigValid, searchConfig } from "@shared/config";

const program = new Command("program");

program.description("A Minecraft Bedrock Addon Compiler that does little more than copy folders");

program
	.option("-c, --config <path>", "path to ganban configuration file")
	.option("--bpSrc <path>", "source location of the behavior pack")
	.option("--bpTarget <path>", "directory to contain the compiled behavior pack")
	.option("--bpName <string>", "name of the compiled behavior pack")
	.option("--rpSrc <path>", "source location of the resource pack")
	.option("--rpTarget <path>", "directory to contain the compiled resource pack")
	.option("--rpName <string>", "name of the compiled resource pack")
	.option("-b, --beta", "change the default pack target locations to Minecraft Preview ones")
	.option("-t, --tsconfig <path>", "path to tsconfig file")
	.option("-i, --ignore <regex>", "regex pattern to exclude from compilation", (v) => RegExp(v))
	.option("-s, --sourcemap", "generate sourcemap for debugging scripts")
	.option("-m, --minify", "minify/optimize files where possible")
	.option("-w, --watch", "watch for file changes and automatically update the build on the fly");

program
	.parseAsync(process.argv)
	.then(async (cmd) => {
		const opts = cmd.opts();

		const configSearchResult = await searchConfig(opts.config);
		delete opts.config;

		const config = Object.assign(configSearchResult?.config ?? {}, opts);

		if (!isConfigValid(config, true)) return;

		const compilePackOptsArray = createCompilePackOptsFromConfig(config);

		for (const opts of compilePackOptsArray) {
			const execTimeStart = performance.now();
			compilePack(opts).then((result) => {
				const execTimeEnd = performance.now();
				const execTimeString = `${(execTimeEnd - execTimeStart).toFixed(2)}ms`;

				if (result.success && !config.watch) {
					console.log(chalk.green(`Compiled ${opts.packType} successfully in ${execTimeString}`));
				} else if (!result.success) {
					console.error(
						chalk.red(`Compilation of ${opts.packType} took ${execTimeString} to fail`),
					);
					console.error(result.error);
				}
			});
		}
	})
	.catch((error) => console.error(chalk.red(error)));
