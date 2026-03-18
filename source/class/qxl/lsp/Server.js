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

/**
 * Main LSP Server application class.
 * Extends qx.application.Basic for Node.js — main() is called automatically
 * by qx.core.Init after the qooxdoo boot sequence.
 *
 */
qx.Class.define("qxl.lsp.Server", {
  extend: qx.application.Basic,

  members: {
    /**
     * Application entry point, called by qx.core.Init after boot.
     * All require() calls are inside this method body — never at module top-level
     * in qooxdoo source files.
     */
    async main() {
      // qooxdoo-Log-Output unterdrücken, damit stdout nicht mit LSP-Nachrichten kollidiert
      qx.log.Logger.setLevel("error");

      const {
        createConnection,
        ProposedFeatures,
        TextDocuments,
        TextDocumentSyncKind
      } = require("vscode-languageserver/node");

      const { TextDocument } = require("vscode-languageserver-textdocument");

      const connection = createConnection(ProposedFeatures.all);
      const documents = new TextDocuments(TextDocument);

      let db = null;
      let wsPath = null;

      const definitionProvider = new qxl.lsp.DefinitionProvider();
      const referencesProvider = new qxl.lsp.ReferencesProvider();
      const hoverProvider = new qxl.lsp.HoverProvider();
      const documentSymbolsProvider = new qxl.lsp.DocumentSymbolsProvider();
      const completionProvider = new qxl.lsp.CompletionProvider();
      const workspaceSymbolsProvider = new qxl.lsp.WorkspaceSymbolsProvider();

      connection.onInitialize(params => {
        const workspaceFolders = params.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          const wsUri = workspaceFolders[0].uri;
          const path = require("upath");
          const { fileURLToPath } = require("url");
          wsPath = path.normalize(fileURLToPath(wsUri));
          process.stdout.write(`[qxl.lsp] Initializing project for workspace folder: ${wsPath}\n`);
          const project = new qxl.lsp.Project(wsPath);
          try {
            project.load();
            db = project.getMetaDatabase();
          } catch (e) {
            process.stderr.write(`[qxl.lsp] project.load() failed: ${e.message}\n`);
          }
        }

        return {
          capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            definitionProvider: true,
            declarationProvider: true,
            referencesProvider: true,
            hoverProvider: true,
            documentSymbolProvider: true,
            completionProvider: { triggerCharacters: ["."] },
            workspaceSymbolProvider: true
          }
        };
      });

      connection.onDefinition(params => {
        if (!db) return null;
        try {
          return definitionProvider.provideDefinition(params, db);
        } catch (e) {
          process.stderr.write(`[qxl.lsp] definitionProvider.provideDefinition() failed: ${e.message}\n`);
          return null;
        }
      });

      connection.onDeclaration(params => {
        if (!db) return null;
        try {
          return definitionProvider.provideDeclaration(params, db);
        } catch (e) {
          process.stderr.write(`[qxl.lsp] definitionProvider.provideDeclaration() failed: ${e.message}\n`);
          return null;
        }
      });

      connection.onReferences(params => {
        if (!wsPath) return null;
        try {
          return referencesProvider.provideReferences(params, wsPath);
        } catch (e) {
          process.stderr.write(`[qxl.lsp] referencesProvider.provideReferences() failed: ${e.message}\n`);
          return null;
        }
      });

      connection.onHover(params => {
        if (!db) return null;
        try {
          return hoverProvider.provideHover(params, db);
        } catch (e) {
          process.stderr.write(`[qxl.lsp] hoverProvider.provideHover() failed: ${e.message}\n`);
          return null;
        }
      });

      connection.onDocumentSymbol(params => {
        if (!db) return null;
        try {
          return documentSymbolsProvider.provideDocumentSymbols(params, db);
        } catch (e) {
          process.stderr.write(`[qxl.lsp] documentSymbolsProvider.provideDocumentSymbols() failed: ${e.message}\n`);
          return null;
        }
      });

      connection.onCompletion(params => {
        if (!db) return null;
        try {
          return completionProvider.provideCompletion(params, db);
        } catch (e) {
          process.stderr.write(`[qxl.lsp] completionProvider.provideCompletion() failed: ${e.message}\n`);
          return null;
        }
      });

      connection.onWorkspaceSymbol(params => {
        if (!db) return null;
        try {
          return workspaceSymbolsProvider.provideWorkspaceSymbols(params, db);
        } catch (e) {
          process.stderr.write(`[qxl.lsp] workspaceSymbolsProvider.provideWorkspaceSymbols() failed: ${e.message}\n`);
          return null;
        }
      });

      documents.listen(connection);
      connection.listen();
    }
  }
});
