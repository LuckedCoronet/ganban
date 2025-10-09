# ganban

ganban allows for smoother Minecraft Bedrock add-on development than the traditional approach where packs are scattered across separate development_behavior_packs and/or development_resource_packs folders.

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

1. Create a folder somewhere, which will be your project folder.

2. Open a terminal window in the created folder, and run the following command:

```bash
# Adds ganban as a local development dependency of your project
npm install --save-dev ganban
```

## Configuration Examples

Actually, there is no fixed concept of a "configuration file." **As long as you can call the build function from ganban package, any JavaScript/TypeScript file will do (it can be from anywhere).**

However, most of the examples below assume that you create a file named `ganban.mjs` in the root of your project.

### Example #1 - Super basic (not very practical)

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

### Example #2 - Practical and intended approach

[What are environment variables](https://www.reddit.com/r/linux4noobs/comments/1ger3jc/what_is_environment_variable_what_do_they_do_why/)

```javascript
// ganban.mjs
import { build, getRequiredEnv, getRequiredEnvWithFallback } from "ganban";

build({
  behaviorPack: {
    type: "behavior",
    srcDir: "src/bp",
    outDir: getRequiredEnv("BP_OUTDIR"),
  },
  resourcePack: {
    type: "resource",
    srcDir: "src/rp",
    outDir: getRequiredEnv("RP_OUTDIR"),
  },
  watch: Boolean(getRequiredEnvWithFallback("WATCH", "")),
});
```
