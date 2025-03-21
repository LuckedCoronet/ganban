export type CreatePackManifestTemplateOpts = {
	readonly uuid_bpHeader?: string;
	readonly uuid_bpDataModule?: string;
	readonly uuid_bpScriptModule?: string;
	readonly uuid_rpHeader?: string;
	readonly uuid_rpResModule?: string;
};

/**
 * @returns Pack manifest templates of both behavior and resource pack, with random UUID's (can be set in opts)
 */
export const createPackManifestTemplates = (
	opts?: CreatePackManifestTemplateOpts,
): { bpManifest: string; rpManifest: string } => {
	const bpUUIDHeader = opts?.uuid_bpHeader ?? crypto.randomUUID();
	const bpUUIDDataModule = opts?.uuid_bpDataModule ?? crypto.randomUUID();
	const bpUUIDScriptModule = opts?.uuid_bpScriptModule ?? crypto.randomUUID();
	const rpUUIDHeader = opts?.uuid_rpHeader ?? crypto.randomUUID();
	const rpUUIDResModule = opts?.uuid_rpResModule ?? crypto.randomUUID();

	const bpManifest = `{
  "format_version": 2,
  "header": {
    "description": "No description.",
    "name": "Untitled Behavior Pack",
    "uuid": "${bpUUIDHeader}",
    "version": [0, 1, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    {
      "description": "Data module",
      "type": "data",
      "uuid": "${bpUUIDDataModule}",
      "version": [0, 1, 0]
    }

    // {
    //   "description": "Scripts",
    //   "language": "javascript",
    //   "type": "script",
    //   "uuid": "${bpUUIDScriptModule}",
    //   "version": [0, 1, 0],
    //   "entry": "scripts/main.js"
    // }
  ],
  "dependencies": [
    // {
    //   "module_name": "@minecraft/server",
    //   "version": "1.11.0"
    // }

    // {
    //   // Resource pack
    //   "uuid": "${rpUUIDHeader}",
    //   "version": [0, 1, 0]
    // }
  ]
}`;

	const rpManifest = `{
  "format_version": 2,
  "header": {
    "description": "No description.",
    "name": "Untitled Resource Pack",
    "uuid": "${rpUUIDHeader}",
    "version": [0, 1, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    {
      "description": "Resource module",
      "type": "resources",
      "uuid": "${rpUUIDResModule}",
      "version": [0, 1, 0]
    }
  ]
}`;

	return {
		bpManifest,
		rpManifest,
	};
};

export const createTsconfigTemplate = (includeBp = true, includeRp = true): string => {
	const paths =
		!includeBp && !includeRp
			? `"paths": {},`
			: `"paths": {
      ${!includeBp ? "// " : ""}"@bp": ["./src/bp/*"],
      ${!includeRp ? "// " : ""}"@rp": ["./src/rp/*"],
    },`;

	return `{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "rootDir": "./src/",
    ${paths}
    "moduleDetection": "force",
    "skipLibCheck": true,
    "allowJs": true,
    "checkJs": true,

    "strict": true,
    "strictNullChecks": true,

    "module": "Preserve",
    "moduleResolution": "Bundler",
    "noEmit": true,
  },
  "include": ["./src/**/*"]
}`;
};

export type CreateVscodeLaunchJsonTemplateOps = {
	readonly targetBpDirName?: string;
	readonly uuid_bpScriptModule?: string;
};

export const createVscodeLaunchJsonTemplate = (
	opts?: CreateVscodeLaunchJsonTemplateOps,
): string => {
	const targetBpDirName = opts?.targetBpDirName ?? "PACK_NAME";
	const bpScriptModuleUUID = opts?.uuid_bpScriptModule ?? "SCRIPT_MODULE_UUID";
	return `{
  "version": "0.3.0",
  "configurations": [
    // How to get the debugger working
    // 1. Open Extensions menu and search for \`Minecraft Bedrock Debugger\` and install it
    // 2. Run the command mentioned at https://learn.microsoft.com/en-us/minecraft/creator/documents/scriptdevelopertools?view=minecraft-bedrock-stable#step-2-ensure-that-the-minecraft-bedrock-edition-client-can-make-loopback-requests
    // 3. Click \`Debug with Minecraft\` option under VSCode's Run menu or hit F5
    // 4. In Minecraft, enter \`/script debugger connect\` in chat
    // 5. Done!
    {
      "type": "minecraft-js",
      "request": "attach",
      "name": "Debug with Minecraft",
      "mode": "listen",

      "sourceMapRoot": "\${userHome}/AppData/Local/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang/development_behavior_packs/${targetBpDirName}/scripts/",
      "generatedSourceRoot": "\${userHome}/AppData/Local/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang/development_behavior_packs/${targetBpDirName}/scripts/",
      "port": 19144,

      // Must match with the UUID of the "script" module defined in the behavior pack's manifest.json
      "targetModuleUuid": "${bpScriptModuleUUID}"
    },
    {
      "type": "minecraft-js",
      "request": "attach",
      "name": "Debug with Minecraft Preview",
      "mode": "listen",

      "sourceMapRoot": "\${userHome}/AppData/Local/Packages/Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe/LocalState/games/com.mojang/development_behavior_packs/${targetBpDirName}/scripts/",
      "generatedSourceRoot": "\${userHome}/AppData/Local/Packages/Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe/LocalState/games/com.mojang/development_behavior_packs/${targetBpDirName}/scripts/",
      "port": 19144,

      // Must match with the UUID of the "script" module defined in the behavior pack's manifest.json
      "targetModuleUuid": "${bpScriptModuleUUID}"
    }
  ]
}`;
};
