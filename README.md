<div align="center">

<img src="./media/logo.webp" width="600" height="auto" alt="Ganban Logo"/>

<hr/>

:rock: A simple Minecraft Bedrock addon compiler that does little more than copy folders :rock:

<hr/>

</div>

## :star2: Introduction

**Ganban** *- means bedrock in Japanese -* is a simple Minecraft Bedrock addon compiler.

### Features

- Single project folder configuration (optional)
- Compile pack(s) into .../com.mojang/development_..._packs (or custom location)
- Bundle scripts using [esbuild](https://esbuild.github.io/)
- Watch mode for rapid iteration
- **Amazing:** JS/TS to define entities and blocks etc. (read [Mod2json](#mod2json) for details)

## :inbox_tray: Installation

First, make sure you are on Windows 10/11 and have [Node.js](https://nodejs.org/en) installed on your PC.

Second, open terminal and use npm to install Ganban to your project directory:

```bash
cd your-project-directory
npm i --save-dev ganban
```

You can also install it globally:

```bash
npm i --global ganban
```

## :keyboard: Usage

### CLI

TODO: Add CLI usage examples

## :monocle_face: Features explained

### Mod2json

Mod2json (stands for *Module-to-JSON*) is a feature in Ganban that lets you <ins>use JS/TS to define entities, blocks, and more things that are typically written in static JSON</ins>.

When Ganban encounters a file that ends with `.json.[m]js` (or `.json.[m]ts`) during compilation,
it will:

1. Dynamically import the module using [import()](https://nodejs.org/docs/latest-v18.x/api/esm.html?form=MG0AV3#import-expressions) for JS files and [tsx.tsImport()](https://tsx.is/dev-api/ts-import) for TS files.
2. Get its default-export object. (It must be created using a special function from Ganban API)
3. Turn the object into an ordinary JSON using `JSON.stringify`.
4. Write the file(s) into target location without the JS/TS extension.

Let's say, in your pack, there are two TypeScript files:

```js
// One - shared.mts
export const helloWorld = "Hello World!";

// Two - example.json.mts
import { mod2json } from "ganban";
import { helloWorld } from "./shared.mts";

export default mod2json.single(() => ({
  example_object: {
    message: helloWorld,
  },
  scripting_power: {
    random_uuid: crypto.randomUUID(),
    random_number: Math.random() * 100,
  },
}));
```

In this case, `example.json.mts` will be converted to:

```jsonc
// Result - example.json
{
  "example_object": {
    "message": "Hello World!"
  },
  "scripting_power": {
    "random_uuid": "5f0a4f21-ff8c-4bc8-884d-8fa2b4c12dc1",
    "random_number": 52.32497737718178
  }
}
```

**You can do anything inside a module**, as long as it uses `mod2json.single()` or `mod2json.multiple()`.

*Free yourself from JSON restrictions.* :wine_glass::moyai:

... However, it's not all perfect. Tools like Blockbench expect normal JSON in certain files.

If you wanna use Mod2json in such files, you have to take that pain.

## License

Licensed under [MIT](./LICENSE.txt).

## Other Information

Logo is created using Minecraft Title plugin in Blockbench.
