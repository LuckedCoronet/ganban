> [!IMPORTANT]
> **ganban is now deprecated!**
> Please use [@mcbe-toolbox-lc/builder](https://github.com/mcbe-toolbox-lc/builder) instead.

# ganban

ganban allows for smoother Minecraft Bedrock add-on development than the traditional approach where packs are scattered across separate development_behavior_packs and/or development_resource_packs folders.

"ganban" (岩盤) means "bedrock" in Japanese 🪨

## Introduction

The dispersed locations of packs can require multiple code editor windows to be opened for a single add-on, and implementing a version control system (like Git) can be difficult. :worried:

With ganban, you can work with each pack inside a single "project folder".
<ins>But you don't want to have to copy and paste your packs into folders like development_behavior_packs every time?
Don't worry, ganban automates that part (with added bonuses).</ins>

With ganban, you can create a project folder structure like this:

```
.
├── ganban.mjs (ganban config file)
└── packs/
    ├── bp/
    │   └── ... behavior pack files ...
    └── rp/
        └── ... resource pack files...
```

This has several benefits:

- Easier navigation between packs.
- Easily integrate development tools into your add-on.
- Makes source control (with Git) possible.
- Allows you to keep your source files outside of com.mojang.

Now comes the most exciting part: <ins>ganban will "compile" your add-on and output each pack to a location you specify (e.g., in com.mojang).</ins>

During that process, ganban can:

- Sync files (copies source files to destination).
- Convert [JSON5](https://json5.org/) files into plain JSON on the fly.
- Optionally compile/bundle behavior pack script (powered by [esbuild](https://esbuild.github.io/)).
  - Easily integrate TypeScript (but you don't have to).
  - It can bundle external packages. For example, you can install and use [glMatrix](https://glmatrix.net/) for Vector calculations, or create your own utility library and use it, etc.
- Optionally generate `texture_list.json` in resource pack.
- Optionally generates zip, mcpack, or mcaddon archive.

There's even a "watch mode" that will recompile in real time when it detects changes in either pack folder!

## Prerequisites

Make sure you have these tools installed on your system.

- Node.js (v22 or newer)

## Installation

1. Create a folder somewhere, which will be your project folder. 📂

2. Open a terminal window in the created folder, and run the following command:

```bash
# Adds ganban as a local development dependency of your project
npm install --save-dev ganban
```

## Configuration Examples

Actually, there is no fixed concept of a "configuration file." **As long as you can call ganban's `build'()` function, any JavaScript/TypeScript file will do (it can be from anywhere).**

However, most of the examples below assume that you create a file named `ganban.mjs` in the root of your project.

<details>
  <summary>Example #1 - Basics (not very practical)</summary>

This is just an example to give you an idea of how the configuration works, but it's not enough to actually put it into real use.

```javascript
// ganban.mjs
import { build } from "ganban";

build({
  behaviorPack: {
    type: "behavior",
    srcDir: "src/bp",
    outDir: "out/bp",
  },
  resourcePack: {
    type: "resource",
    srcDir: "src/rp",
    outDir: "out/rp",
  },
});
```

You can see it defines both the behavior pack and the resource pack.
In this example, src/bp is output to out/bp and src/rp is output to out/rp.

To run ganban with this configuration:

```bash
node ganban.mjs
```

</details>

<details>
  <summary>Example #2 - Advanced and practical</summary>

This one is actually pratical and I've writtem something like this in my own add-ons.

What may seem complicated is just a pack manifest definition.
(Yes, you can define manfiests flexibly)

```javascript
import {
  build,
  getRequiredEnv,
  getRequiredEnvWithFallback,
  getMinecraftPackageVersions,
  parseVersionString,
} from "ganban";
import packageConfig from "./package.json" with { type: "json" };

const isDevBuild = Boolean(getRequiredEnvWithFallback("DEV", ""));
const addonVersionArray = parseVersionString(getRequiredEnvWithFallback("ADDON_VERSION", "0.0.1"));
const addonVersionForHumans = "v" + addonVersionArray.join(".");

// Some variables shared between pack manifests
const minEngineVersion = [1, 21, 111];
const behaviorPackUuid = "8c28c9a8-c721-4e7f-b8ba-346486003e9d";
const resourcePackUuid = "fb30e68f-435a-4b5b-b41e-32b4ada45798";

// Used in "dependencies" section of behavior pack manifest
const minecraftPackageVersions = getMinecraftPackageVersions(packageConfig);

const behaviorPackManifest = {
  format_version: 2,
  header: {
    description: isDevBuild ? "Dev build description." : "Release build description.",
    name: isDevBuild ? `My Addon BP - DEV` : `My Addon BP - ${addonVersionForHumans}`,
    uuid: behaviorPackUuid,
    version: addonVersionArray,
    min_engine_version: minEngineVersion,
  },
  modules: [
    {
      type: "data",
      uuid: "0bdbbaa9-1231-442f-8f4e-7ad379f05a53",
      version: addonVersionArray,
    },
    {
      language: "javascript",
      type: "script",
      uuid: "5c779582-0ed1-4cb2-af47-1b4ff5c87eeb",
      version: addonVersionArray,
      entry: "scripts/main.js",
    },
  ],
  dependencies: [
    {
      // Resource pack dependency
      uuid: resourcePackUuid,
      version: addonVersionArray,
    },
    {
      module_name: "@minecraft/server",
      version: minecraftPackageVersions["@minecraft/server"],
    },
    {
      module_name: "@minecraft/server-ui",
      version: minecraftPackageVersions["@minecraft/server-ui"],
    },
  ],
};

const resourcePackManifest = {
  format_version: 2,
  header: {
    description: isDevBuild ? "Dev build description." : "Release build description.",
    name: isDevBuild ? `My Addon RP - DEV` : `My Addon RP - ${addonVersionForHumans}`,
    uuid: resourcePackUuid,
    version: addonVersionArray,
    min_engine_version: minEngineVersion,
  },
  modules: [
    {
      type: "resources",
      uuid: "424680fc-84c5-4d0e-a2f5-e3f49eb94006",
      version: addonVersionArray,
    },
  ],
};

/** @type {import("ganban").BuildConfig} */
const buildConfig = {
  behaviorPack: {
    type: "behavior",
    srcDir: "src/bp",
    outDir: isDevBuild ? getRequiredEnv("DEV_BP_OUTDIR") : `dist/${addonVersionForHumans}/bp`,
    manifest: behaviorPackManifest,
    scripts: {
      entry: "src/bp/scripts/main.js",
      bundle: true, // Combine multiple scripts into a single file
      minify: !isDevBuild, // Minimize script file size for release builds
      sourceMap: isDevBuild, // Source maps are really useful when debugging scripts
    },
  },
  resourcePack: {
    type: "resource",
    srcDir: "src/rp",
    outDir: isDevBuild ? getRequiredEnv("DEV_RP_OUTDIR") : `dist/${addonVersionForHumans}/rp`,
    manifest: resourcePackManifest,
    generateTextureList: true,
  },
  watch: Boolean(getRequiredEnvWithFallback("WATCH", "")),
};

// Create archive for release builds
if (!isDevBuild) {
  buildConfig.archives = [
    {
      outFile: `dist/${addonVersionForHumans}/${addonVersionForHumans}.mcaddon`,
    },
    {
      outFile: `dist/${addonVersionForHumans}/${addonVersionForHumans}.zip`,
    },
  ];
}

await build(buildConfig);
```

This one uses environment variables extensively:

- `DEV`: Enables dev build.
- `DEV_BP_OUTDIR`: Sets behavior pack output location when `DEV=true`.
- `DEV_RP_OUTDIR`: Sets resource pack output location when `DEV=true`.
- `ADDON_VERSION`: Sets addon version. For example, `ADDON_VERSION=0.1.0` will set your release build version to v0.1.0.
- `WATCH`: Enables watch mode (detect changes and recompile in real time)

ganban's `getRequiredEnv()` and `getRequiredEnvWithFallback()` are nice helper functions for this case.

Let's set environment variables and run ganban.

First, install the `dotenv-cli` package:

```bash
npm install --save-dev dotenv-cli
```

Second, create a file named `.env` at project root, and paste this text (replace `{User}` with your username):

```env
# Specify pack output locations for dev build
DEV_BP_OUTDIR="C:\Users\{USER}\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\My_Addon_BP"
DEV_RP_OUTDIR="C:\Users\{USER}\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_resource_packs\My_Addon_RP"
```

Third, run ganban:

```bash
npx dotenv -v DEV=true -v WATCH=true -- node ganban.mjs
```

It loaded environment variables from the `.env` file,
supplied additional environment variables (`DEV` and `WATCH`),
and ran `ganban.mjs` using node.

`WATCH=true` means ganban will be watching for file changes (to recompile in real time). You can press Ctrl+c to stop it.

Open Minecraft Bedrock (not Preview) and the compiled packs should be available. ✔️

Let's create a release build:

```bash
npx dotenv -v ADDON_VERSION=0.6.9 -- node ganban.mjs
```

Release build v0.6.9 should be generated inside the dist/ folder.

</details>

## Additional Resources

- Add-on development
  - [MS Docs](https://learn.microsoft.com/en-us/minecraft/creator/?view=minecraft-bedrock-stable)
  - [bedrock.dev](https://bedrock.dev/)
  - [Bedrock Wiki](https://wiki.bedrock.dev/)
- Other
  - [tsx](https://tsx.is/) (This lets you run TypeScript very easily!)
  - [My Minecraft projects](https://github.com/orgs/lc-studios-mc/repositories)
