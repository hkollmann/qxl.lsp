# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install server dependencies (run from repo root)
npm install

# Compile the Qooxdoo server application
npm run compile
# → produces compiled/source/qxl.lsp/index.js

# Package the extension as VSIX
# Runs qx deploy first, then vsce package
npm run package

# Install the VSIX locally
code --install-extension qxl-lsp-client.vsix
```

There are no automated tests.

## Architecture

This is a two-process LSP implementation:

**Server** (`source/class/qxl/lsp/` + `compile.json` + `index.js`)
A Qooxdoo Node.js application compiled with `qx compile`. The entry point `index.js` delegates to `compiled/source/qxl.lsp/index.js`. All four classes must be compiled before the server can run — editing source files requires a recompile.

**Client** (`client/`)
A standard VS Code extension that spawns the server via `TransportKind.ipc`. `client/extension.js` creates a `LanguageClient` pointing at the repo root `index.js`.

### Key design decisions

**Qooxdoo class rules:**
- All source files use `qx.Class.define("qxl.lsp.ClassName", {...})` — no ES modules, no CommonJS exports
- `require()` calls must be **inside method bodies**, never at the top level of a class file — the qooxdoo compiler concatenates files, so top-level requires break the bundle
- `Server.js` extends `qx.application.Basic`; its instance `main()` is called automatically by `qx.core.Init` at boot — do not call it manually

**Meta database instead of source scanning:**
`Project.js` reads the Qooxdoo compiler's pre-built meta database (`compiled/meta/`) rather than parsing source files. The meta path is derived from the workspace's `compile.json` at runtime:
- `compile.json → meta.output` if set, otherwise `{targets[0].outputPath}/../meta`
- This logic mirrors `qooxdoo.v8/source/class/qx/tool/compiler/cli/commands/Compile.js` Z. 1101-1108

**classFilename is relative to metaDir:**
Each class JSON (e.g. `compiled/meta/qx/core/Object.json`) contains a `classFilename` that is a relative path from `metaDir`, not an absolute path. Always resolve with `path.resolve(path.join(metaDir, classData.classFilename))`.

**Line numbers:** The meta database uses 1-based line numbers. LSP expects 0-based. Subtract 1 when returning locations.

### Data flow for Go to Definition

1. VS Code sends `textDocument/definition` to the client
2. Client forwards to server via IPC
3. `Server.onDefinition` → `DefinitionProvider.provideDefinition(params, project)`
4. `DefinitionProvider` reads the current file, calls `Util.getWordAtPosition` to extract `{className, memberName}`
5. `Project.findDefinition(className, memberName)` reads `{metaDir}/{className}.json`, resolves `classFilename`, returns `{file, line}`
6. `DefinitionProvider` converts the file path to a URI and returns an LSP `Location`

### Auto-reload

`Project.load()` sets up a `fs.watch` on `{metaDir}/db.json`. Any change (e.g. after `qx compile`) triggers a debounced (500ms) reload of the meta path calculation.
