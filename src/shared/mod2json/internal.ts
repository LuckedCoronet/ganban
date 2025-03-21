import * as node_url from "node:url";
import fs from "fs-extra";
import { isMod2jsonCreator, Mod2jsonCreator } from "./public";
import { tsImport } from "tsx/esm/api";

export type ModuleType = "js" | "mjs" | "ts" | "mts" | "none";

export const getModuleType = (filePath: string): ModuleType => {
	if (filePath.endsWith(".json.js")) return "js";
	else if (filePath.endsWith(".json.mjs")) return "mjs";
	else if (filePath.endsWith(".json.ts")) return "ts";
	else if (filePath.endsWith(".json.mts")) return "mts";
	else return "none";
};

/**
 * @throws This function can throw errors.
 */
const importModule = async (
	filePath: string,
	moduleType: ModuleType,
	tsconfig?: string,
): Promise<unknown> => {
	const jsPath = filePath.endsWith("ts") ? `${filePath.slice(0, -2)}js` : filePath;
	const url = node_url.pathToFileURL(jsPath).toString();

	if (moduleType === "js" || moduleType === "mjs") {
		const stat = await fs.stat(filePath);
		const url2 = `${url}?update=${stat.mtimeMs}`;
		return import(url2);
	}

	if (moduleType === "ts" || moduleType === "mts") {
		return await tsImport(url, {
			parentURL: import.meta.url,
			tsconfig,
		});
	}
};

/**
 * @throws This function can throw errors.
 */
export const getMod2jsonCreator = async (
	filePath: string,
	moduleType: ModuleType,
	tsconfig?: string,
): Promise<Mod2jsonCreator> => {
	if (moduleType === "none") throw new Error(`Module type '${moduleType}' is not allowed.`);

	const module = await importModule(filePath, moduleType, tsconfig);

	if (typeof module !== "object" || module == null)
		throw new Error("Incorrect Mod2json module type");

	if (!("default" in module)) throw new Error("Mod2json module must contain a default export");

	if (!isMod2jsonCreator(module.default))
		throw new Error("Default-exported object is not Mod2json creator object");

	return module.default;
};
