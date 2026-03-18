/* ************************************************************************
 *
 *    qxl.lsp - Qooxdoo Language Server Protocol implementation
 *
 *    https://github.com/hkollmann/qxl.lsp
 *
 *    Copyright:
 *      2026 Henner Kollmann
 *
 *    License:
 *      MIT: https://opensource.org/licenses/MIT
 *
 *      This software is provided under the same licensing terms as Qooxdoo,
 *      please see the LICENSE file in the Qooxdoo project's top-level directory
 *      for details.
 *
 *    Authors:
 *      * Henner Kollmann (Henner.Kollmann@gmx.de, @hkollmann)
 *
 * ************************************************************************ */

"use strict";

const path = require("upath");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");

let client;

/**
 * Called by VS Code when the extension activates.
 * Starts the Qooxdoo LSP server as a Node.js child process via IPC.
 *
 * @param {import("vscode").ExtensionContext} context
 */
function activate(context) {
  // Pfad zum kompilierten Server-Einstiegspunkt
  const serverModule = path.join(__dirname, "index.js");

  const serverOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--nolazy", "--inspect=6009"]
      }
    }
  };

  const clientOptions = {
    documentSelector: [
      { scheme: "file", language: "javascript" }
    ]
  };

  client = new LanguageClient(
    "qxl.lsp",
    "Qooxdoo Language Server",
    serverOptions,
    clientOptions
  );

  client.start();
}

/**
 * Called when the extension deactivates.
 */
function deactivate() {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

module.exports = { activate, deactivate };
