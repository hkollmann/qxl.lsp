/**
 * LSP go-to-definition handler for Qooxdoo classes and members.
 */
const fs = require("fs");

qx.Class.define("qxl.lsp.DefinitionProvider", {
  extend: qx.core.Object,
  include: [qxl.lsp.MUriHelper],

  members: {
    /**
     * Handles a textDocument/definition LSP request.
     *
     * @param {object} params - LSP DefinitionParams
     * @param {qxl.lsp.MetaDatabase} db
     * @returns {object|null} LSP Location object or null
     */
    provideDefinition(params, db) {
      const filePath = this._uriToPath(params.textDocument.uri);
      process.stdout.write(`[qxl.lsp.provideDefinition] called for file: ${filePath}\n`);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      const { word } = qxl.lsp.Util.getWordAtPosition(lines, params.position);
      process.stdout.write(`[qxl.lsp.provideDefinition] Extracted word: ${word}\n`);
      if (!word) {
        return null;
      }

      const definition = db.findDefinition(word);
      if (!definition) {
        return null;
      }

      return {
        uri: this._pathToUri(definition.file),
        range: {
          start: { line: definition.line, character: 0 },
          end: { line: definition.line, character: 0 }
        }
      };
    },

    /**
     * Handles a textDocument/declaration LSP request.
     * Walks the superClass chain to find the topmost (original) definition.
     *
     * @param {object} params - LSP DeclarationParams
     * @param {qxl.lsp.MetaDatabase} db
     * @returns {object|null} LSP Location object or null
     */
    provideDeclaration(params, db) {
      const filePath = this._uriToPath(params.textDocument.uri);
      process.stdout.write(`[qxl.lsp.provideDeclaration] called for file: ${filePath}\n`);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      const { word } = qxl.lsp.Util.getWordAtPosition(lines, params.position);
      process.stdout.write(`[qxl.lsp.provideDeclaration] Extracted word: ${word}\n`);
      if (!word) {
        return null;
      }

      const definition = db.findSourceDefinition(word);
      if (!definition) {
        return null;
      }

      return {
        uri: this._pathToUri(definition.file),
        range: {
          start: { line: definition.line, character: 0 },
          end: { line: definition.line, character: 0 }
        }
      };
    }
  }
});
