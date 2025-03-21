import * as node_path from "node:path";
import * as node_os from "node:os";
import fs from "fs-extra";

export const fileExists = (path: string): boolean =>
	fs.existsSync(path) && fs.statSync(path).isFile();

export const dirExists = (path: string): boolean =>
	fs.existsSync(path) && fs.statSync(path).isDirectory();

export const getShortCurrentTimeString = (): string => {
	const currentTime = new Date();

	const hours = currentTime.getHours().toString().padStart(2, "0");
	const minutes = currentTime.getMinutes().toString().padStart(2, "0");
	const seconds = currentTime.getSeconds().toString().padStart(2, "0");
	const milliseconds = currentTime.getMilliseconds().toString().padStart(3, "0");

	return `[${hours}:${minutes}:${seconds}:${milliseconds}]`;
};

export const getComMojangDir = (beta?: boolean) =>
	node_path.join(
		node_os.homedir(),
		"AppData/Local/Packages",
		beta === true
			? "Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe"
			: "Microsoft.MinecraftUWP_8wekyb3d8bbwe",
		"LocalState/games/com.mojang",
	);

export const getDevPackDirs = (
	beta?: boolean,
): { devBehaviorPacks: string; devResourcePacks: string } => {
	const comMojang = getComMojangDir(beta);
	return {
		devBehaviorPacks: node_path.join(comMojang, "development_behavior_packs"),
		devResourcePacks: node_path.join(comMojang, "development_resource_packs"),
	};
};
