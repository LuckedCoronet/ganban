# ganban

A simple Minecraft Bedrock add-on compiler.

<details>
  <summary>What?</summary>

By default, when developing add-ons, you place the pack folder directly in development_behavior_packs and/or development_resource_packs in com.mojang and work there.
While it's possible to develop that way, and most people do, there's a better way.

A better approach is to work in one centralized "project folder" away from the com.mojang folder, and have some tool automate the build process.

In fact, this idea itself is not old and has already been successfully implemented in well-known tools.
However, I found that existing tools for achieving this were complex and often forced specific workflows.

I created **ganban**, an npm package that you can simply add as a dev dependency to your project.

I created it so that smooth add-on development can be achieved by writing a little configuration and the code that calls the ganban's `build({})` function in one JavaScript file.

</details>

## What can ganban do

- Realization of a "project folder" to hold each pack.
  - Easier navigation between packs.
  - Easier source control (Git).
  - Isolated from com.mojang.
- Output (compile) each pack to a user-specified "destination" folders. During compilation, ganban can do:
  - Simple file synchronization (copies source files to destination).
  - [JSON5](https://json5.org/)-to-JSON conversion: automatically converts JSON5 files into plain JSON.
  - Behavior pack script compilation (powered by [esbuild](https://esbuild.github.io/)).
  - Resource pack `texture_list.json` file generation.
- Archive file generation.
  - Takes the compiled folder(s) and generates a mcpack/mcaddon file.

## Prerequisites

Make sure you have these tools installed on your system.

- Node.js (v22 or newer)

## Installation

Make sure you read the [prerequisites](#prerequisites).

1. Create a folder somewhere, which will be your project folder.

2. Open a terminal window in the created folder, and run the following command:

```bash
# Adds ganban as a local development dependency of your project
npm install --save-dev ganban
```

## Configuration

> [!NOTE]
> It's difficult to cover all possible configurations, so please use the autocomplete feature (LSP) of your code editor (Ctrl+Space in Visual Studio Code), to see the available options.

### Example #1 - Basic behavior pack and resource pack

Create a new file named something like `ganban.mjs` somewhere inside your project folder. Any name or path is fine as long as you can write JavaScript in the file.

```javascript
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
