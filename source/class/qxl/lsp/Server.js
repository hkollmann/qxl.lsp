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

      let project = null;
      const definitionProvider = new qxl.lsp.DefinitionProvider();
      const referencesProvider = new qxl.lsp.ReferencesProvider();

      connection.onInitialize(params => {
        const workspaceFolders = params.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          const wsUri = workspaceFolders[0].uri;
          const path = require("upath");
          const { fileURLToPath } = require("url");
          const wsPath = path.normalize(fileURLToPath(wsUri));
          process.stdout.write(`[qxl.lsp] Initializing project for workspace folder: ${wsPath}\n`);
          project = new qxl.lsp.Project(wsPath);
          try {
            project.load();
          } catch (e) {
            process.stderr.write(`[qxl.lsp] project.load() failed: ${e.message}\n`);
          }
        }

        return {
          capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            definitionProvider: true,
            declarationProvider: true,
            referencesProvider: true
          }
        };
      });

      connection.onDefinition(params => {
        if (!project) {
          return null;
        }
        try {
          return definitionProvider.provideDefinition(params, project);
        } catch (e) {
          process.stderr.write(`[qxl.lsp] definitionProvider.provideDefinition() failed: ${e.message}\n`);
          return null;
        }
      });

      connection.onDeclaration(params => {
        if (!project) {
          return null;
        }
        try {
          return definitionProvider.provideDeclaration(params, project);
        } catch (e) {
          process.stderr.write(`[qxl.lsp] definitionProvider.provideDeclaration() failed: ${e.message}\n`);
          return null;
        }
      });

      connection.onReferences(params => {
        if (!project) {
          return null;
        }
        try {
          return referencesProvider.provideReferences(params, project);
        } catch (e) {
          process.stderr.write(`[qxl.lsp] referencesProvider.provideReferences() failed: ${e.message}\n`);
          return null;
        }
      });

      documents.listen(connection);
      connection.listen();
    }
  }
});
