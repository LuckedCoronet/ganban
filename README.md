# ganban

A simple Minecraft Bedrock add-on compiler.

[Installation](#installation)

## About

By default, when developing add-ons, you place the pack folder directly in development_behavior_packs and/or development_resource_packs in com.mojang and work there.
While it's possible to develop that way, and most people do, there's a better way.

A better approach is to work in one centralized "project folder" away from the com.mojang folder, and have some tool automate the build process.

In fact, this idea itself is not old and has already been successfully implemented in well-known tools.
However, I found that existing tools for achieving this were complex and often forced specific workflows.

I created **ganban**, an npm package that you can simply add as a dev dependency to your project.

I created it so that smooth add-on development can be achieved by simply writing a little configuration and the code that calls the ganban build function in one JavaScript file.

You may want to do scripting in the configuration file (e.g., change the build destination depending on the date).
As such, ganban does not have a command line interface (in order to be flexible) and is meant to be called only from JavaScript files, like this:

```javascript
import { build } from "ganban";

build({
  /* ... Configuration ... */
});
```

### What can ganban do

- Realization of a "project folder" to hold each pack.
  - Easier navigation between packs.
  - Easier source control (Git).
  - Isolated from com.mojang.
- Output (compile) each pack to a user-specified "destination" folder(s). During compilation, ganban can do:
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
