import * as node_path from "node:path";
import fs from "fs-extra";
import chalk from "chalk";
import * as prompts from "@inquirer/prompts";
import {
	createPackManifestTemplates,
	createTsconfigTemplate,
	createVscodeLaunchJsonTemplate,
} from "@shared/templates";
import { fileExists } from "@shared/utils";
import { Config } from "@shared/config";

type PackTypesToInclude = {
	readonly bp: boolean;
	readonly rp: boolean;
};

const promptPackTypesToInclude = async (skip = false): Promise<PackTypesToInclude> => {
	if (skip) return { bp: true, rp: true };
	const answer = await prompts.checkbox({
		message: "Select the pack type(s) to include in this project",
		required: true,
		choices: [
			{
				name: "Behavior Pack (BP)",
				value: "bp",
				checked: true,
			},
			{
				name: "Resource Pack (RP)",
				value: "rp",
				checked: true,
			},
		],
	});
	return {
		bp: answer.includes("bp"),
		rp: answer.includes("rp"),
	};
};

type CompiledPackNames = {
	readonly bp?: string;
	readonly rp?: string;
};

const promptForCompiledPackNames = async (
	packTypes: PackTypesToInclude,
	skip = false,
): Promise<CompiledPackNames> => {
	const defaults: CompiledPackNames = { bp: "Untitled_BP", rp: "Untitled_RP" };
	if (skip) return defaults;

	let bpAnswer;
	if (packTypes.bp) {
		bpAnswer = await prompts.input({
			message: "What should the BP directory name be when it is compiled?",
			default: defaults.bp,
		});
	}

	let rpAnswer;
	if (packTypes.rp) {
		rpAnswer = await prompts.input({
			message: "What should the RP directory name be when it is compiled?",
			default: defaults.rp,
		});
	}

	return { bp: bpAnswer, rp: rpAnswer };
};

const promptForTsconfig = async (skip = false): Promise<boolean> => {
	if (skip) return true;
	return await prompts.confirm({
		message: "Select the type of JS/TS config file",
		default: true,
	});
};

const promptForVscodeLaunchJson = async (skip = false): Promise<boolean> => {
	if (skip) return true;
	return await prompts.confirm({
		message: "Create .vscode/launch.json for debugging BP scripts within VS Code?",
	});
};

export type InitProjectOpts = {
	readonly skipPrompts?: boolean;
};

export const initProject = async (opts?: InitProjectOpts): Promise<void> => {
	const packTypesToInclude = await promptPackTypesToInclude(opts?.skipPrompts);
	const compiledPackNames = await promptForCompiledPackNames(packTypesToInclude, opts?.skipPrompts);
	const shouldCreateTsconfig = await promptForTsconfig(opts?.skipPrompts);
	const shouldCreateVscodeLaunchJson = !packTypesToInclude.bp
		? false
		: await promptForVscodeLaunchJson(opts?.skipPrompts);

	const srcDir = node_path.resolve("src");
	const srcBpDir = node_path.join(srcDir, "bp");
	const srcRpDir = node_path.join(srcDir, "rp");

	const bpScriptModuleUuid = crypto.randomUUID();
	const { bpManifest, rpManifest } = createPackManifestTemplates({
		uuid_bpScriptModule: bpScriptModuleUuid,
	});

	if (packTypesToInclude.bp) {
		await fs.ensureDir(srcBpDir);

		const manifestPath = node_path.join(srcBpDir, "manifest.json");

		if (fileExists(manifestPath)) {
			console.log(
				chalk.yellow("Creation of BP manifest.json was skipped because it already exists"),
			);
		} else {
			await fs.writeFile(manifestPath, bpManifest, { encoding: "utf-8" });
			console.log(chalk.green("Created BP manifest.json"));
		}

		if (shouldCreateVscodeLaunchJson) {
			const vscodeDir = node_path.resolve(".vscode");
			await fs.ensureDir(vscodeDir);

			const launchJsonPath = node_path.join(vscodeDir, "launch.json");

			if (fileExists(launchJsonPath)) {
				console.log(
					chalk.yellow("Creation of .vscode/launch.json was skipped because it already exists"),
				);
			} else {
				const launchJsonTemplate = createVscodeLaunchJsonTemplate({
					targetBpDirName: compiledPackNames.bp,
					uuid_bpScriptModule: bpScriptModuleUuid,
				});
				await fs.writeFile(launchJsonPath, launchJsonTemplate, { encoding: "utf-8" });
				console.log(chalk.green("Created .vscode/launch.json"));
			}
		}
	}

	if (packTypesToInclude.rp) {
		await fs.ensureDir(srcRpDir);

		const manifestPath = node_path.join(srcRpDir, "manifest.json");

		if (fileExists(manifestPath)) {
			console.log(
				chalk.yellow("Creation of RP manifest.json was skipped because it already exists"),
			);
		} else {
			await fs.writeFile(manifestPath, rpManifest, { encoding: "utf-8" });
			console.log(chalk.green("Created RP manifest.json"));
		}
	}

	if (shouldCreateTsconfig) {
		const tsconfigPath = node_path.resolve("tsconfig.json");

		if (fileExists(tsconfigPath)) {
			console.log(chalk.yellow("Creation of tsconfig.json was skipped because it already exists"));
		} else {
			const tsconfigTemplate = createTsconfigTemplate(packTypesToInclude.bp, packTypesToInclude.rp);
			await fs.writeFile(tsconfigPath, tsconfigTemplate, { encoding: "utf-8" });
			console.log(chalk.green("Created tsconfig.json"));
		}
	}

	const configPath = node_path.resolve(".ganbanrc.mjs");

	if (fileExists(configPath)) {
		console.log(
			chalk.yellow("Creation of Ganban config file was skipped because it already exists"),
		);
	} else {
		let configTemplate = `/** @type {import('ganban').Config} */
export default {`;

		if (packTypesToInclude.bp)
			configTemplate += `
  bpSrc: "src/bp",
  bpName: "${compiledPackNames.bp}",`;

		if (packTypesToInclude.rp)
			configTemplate += `
  rpSrc: "src/rp",
  rpName: "${compiledPackNames.rp}",`;

		if (shouldCreateTsconfig)
			configTemplate += `
  tsconfig: "tsconfig.json",`;

		configTemplate += `
};`;

		await fs.writeFile(configPath, configTemplate, { encoding: "utf-8" });
		console.log(chalk.cyan.underline("Config file -> .ganbanrc.mjs"));
	}
};
