# qxl.lsp

A Language Server Protocol (LSP) implementation for [Qooxdoo](https://qooxdoo.org/) projects, providing IDE support in Visual Studio Code.

## Features

- **Go to Definition** — Navigate to the definition of any Qooxdoo class, method, static, or property (`Ctrl+Click` / `F12`)
- **Go to Declaration** — Jump to the topmost ancestor definition of an overridden member (`Alt+F12`)
- **Find All References** — Locate every text occurrence of a class or member across all `.js` source files in the workspace (`Shift+F12`)
- **Hover** — Display inline documentation (description, parameters, return type, deprecation notices, property constraints) when hovering over a symbol
- **Completion** — IntelliSense for member names after `.` and class name prefix completion (triggered automatically while typing)
- **Document Symbols** — Populate the VS Code Outline panel and breadcrumbs with the class and its members for the active file
- **Workspace Symbols** — Quick-navigate to any class in the workspace by name (`Ctrl+T`)
- **Auto-reload** — The server watches the compiled meta database (`compiled/meta/db.json`) and reloads automatically when a `qx compile` run finishes
- **Zero source scanning** — Uses the Qooxdoo compiler's meta database instead of parsing source files with regex, giving accurate results for all classes including framework classes

## Architecture

```
qxl.lsp/
├── source/class/qxl/lsp/
│   ├── Server.js                    # LSP server (qx.application.Basic)
│   ├── Project.js                   # Workspace: compile.json → meta dir + fs.watch
│   ├── MetaDatabase.js              # Loads db.json, resolves symbols
│   ├── MUriHelper.js                # Mixin: URI ↔ path conversion
│   ├── Util.js                      # Shared helpers (JSONC parser, word extraction)
│   ├── DefinitionProvider.js        # textDocument/definition + declaration
│   ├── ReferencesProvider.js        # textDocument/references
│   ├── HoverProvider.js             # textDocument/hover
│   ├── CompletionProvider.js        # textDocument/completion
│   ├── DocumentSymbolsProvider.js   # textDocument/documentSymbol
│   └── WorkspaceSymbolsProvider.js  # workspace/symbol
├── extension.js              # VS Code extension (LanguageClient)
├── package.json              # Extension manifest
├── compile.json              # Qooxdoo compiler config (Node target)
├── Manifest.json             # Qooxdoo library manifest
└── index.js                  # Entry point → compiled output
```

The **server** is a Qooxdoo Node.js application compiled with `qx compile`. The **client** (`extension.js`) is a standard VS Code extension that spawns the server via IPC and communicates using the Language Server Protocol.

The server determines the meta database path by reading the workspace's `compile.json`:
- If `meta.output` is set → use that path
- Otherwise → `{targets[0].outputPath}/../meta` (e.g. `compiled/source` → `compiled/meta`)

## Prerequisites

- Node.js 18 or later
- npm
- Visual Studio Code 1.75 or later
- A Qooxdoo project that has been compiled at least once (`compiled/meta/db.json` must exist)

> **Important:** The target Qooxdoo project's `compile.json` must include the `meta` section to enable meta database generation:
> ```json
> "meta": {
>   "typescript": true
> }
> ```
> Without this entry, the compiler will not produce `compiled/meta/` and the LSP server will have no data to work with.

## Local Deployment

### 1. Install server dependencies

```bash
cd qxl.lsp
npm install
```

### 2. Compile the LSP server

The server is a Qooxdoo application and must be compiled before it can run:

```bash
npm run compile
```

This produces `compiled/source/qxl.lsp/index.js`, which `index.js` in the project root delegates to.

### 3. Load the extension in VS Code

Open the repo root in VS Code and press **F5** to launch an Extension Development Host with the extension active.

> **Note:** Every time you change server source files, re-run `npm run compile` in the project root before restarting the extension host.

## Usage

1. Open a Qooxdoo project in VS Code that has been compiled (`compiled/meta/db.json` must exist).
2. Open any `.js` file.
3. Use the following features on any Qooxdoo class name or member:
   - **F12** / `Ctrl+Click` — Go to Definition
   - **Alt+F12** — Go to Declaration (topmost ancestor)
   - **Shift+F12** — Find All References
   - Hover the cursor — inline documentation
   - Type a class name or `.` after an identifier — auto-completion

The server reloads the meta database automatically each time the Qooxdoo compiler finishes a build.

## Debugging

### Debugging the VS Code Extension (client)

1. Open the repo root in VS Code.
2. Go to **Run and Debug** (`Ctrl+Shift+D`).
3. Create a `.vscode/launch.json` with the following content:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/*.js"]
    }
  ]
}
```

4. Press **F5**. A new VS Code window (Extension Development Host) opens with the extension active.
5. Set breakpoints in `extension.js` — they will be hit in the main VS Code window's debugger.

### Debugging the LSP Server

The server runs as a child process spawned by the extension. To attach the Node.js debugger:

1. Add a `debug` server option in `extension.js` (already present):

```js
debug: {
  module: serverModule,
  transport: TransportKind.ipc,
  options: {
    execArgv: ["--nolazy", "--inspect=6009"]
  }
}
```

2. Create or extend `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/*.js"]
    },
    {
      "name": "Attach to LSP Server",
      "type": "node",
      "request": "attach",
      "port": 6009,
      "restart": true,
      "outFiles": ["${workspaceFolder}/compiled/**/*.js"]
    }
  ],
  "compounds": [
    {
      "name": "Extension + Server",
      "configurations": ["Launch Extension", "Attach to LSP Server"]
    }
  ]
}
```

3. Select **Extension + Server** from the Run and Debug dropdown and press **F5**.
4. VS Code launches the extension host and attaches to the server process on port `6009`.
5. Set breakpoints in the **compiled** server files under `compiled/source/` — the source maps allow stepping through the original Qooxdoo class files.

> **Tip:** When the extension is launched via `extensionHost`, VS Code automatically uses the `debug` server options (with `--inspect`). When installed as a production extension, it uses the `run` options (no inspector).

### Viewing LSP logs

Enable LSP tracing in your VS Code workspace settings to see the full request/response traffic:

```json
{
  "qxl.lsp.trace.server": "verbose"
}
```

Open **Output** (`Ctrl+Shift+U`) and select **Qooxdoo Language Server** from the dropdown.

## Packaging and Deploying via VSIX

The VS Code extension can be packaged into a `.vsix` file for distribution and installation without the VS Code Marketplace.

### 1. Build the server

The compiled server output must be included in the package. Run the Qooxdoo compiler from the repo root first:

```bash
# In the repo root
npm run compile
```

### 2. Add compiled output to the package

`.vscodeignore` in the repo root is already configured to exclude only development artifacts while keeping the compiled server output intact:

```
.vscode/**
node_modules/**
**/*.map
```

This ensures `compiled/source/qxl.lsp/**` and `index.js` are included in the package.

### 3. Package the extension

```bash
npm run package
```

This runs `qx deploy` first, then `vsce package`, and creates `qxl-lsp-client.vsix` in the repo root.

> **Note:** `vsce` will warn about missing fields such as `repository`, `icon`, or `categories` in `package.json`. These can be added before packaging for a production release but are not required for local deployment.

### 4. Install the VSIX in VS Code

**Via Command Palette:**

1. Press `Ctrl+Shift+P`
2. Run **Extensions: Install from VSIX...**
3. Select `qxl-lsp-client.vsix`

**Via CLI:**

```bash
code --install-extension qxl-lsp-client.vsix
```

**Via the Extensions view:**

1. Open the Extensions view (`Ctrl+Shift+X`)
2. Click the `...` menu (top right)
3. Choose **Install from VSIX...**
4. Select the file

### 5. Verify the installation

After installing, reload VS Code (`Ctrl+Shift+P` → **Developer: Reload Window**). Open any `.js` file in a compiled Qooxdoo project and check the **Output** panel (`Ctrl+Shift+U`, select **Qooxdoo Language Server**) to confirm the server started successfully.

### Updating

To deploy an updated version:

1. Re-run `npm run compile` in the repo root
2. Bump the `version` in `client/package.json`
3. Re-run `vsce package` and reinstall the `.vsix`

---

## Development Workflow

```bash
# Make changes to source/class/qxl/lsp/*.js
# Then recompile:
npm run compile

# Reload the extension host in VS Code:
# Ctrl+Shift+P → "Developer: Reload Window"
```

## License

MIT — see [LICENSE](LICENSE)
