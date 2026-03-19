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
      process.stdout.write(`[qxl.lsp] provideDefinition called for file: ${filePath}\n`);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      const { word } = qxl.lsp.Util.getWordAtPosition(lines, params.position);
      process.stdout.write(`[qxl.lsp] provideDefinition extracted word: ${word}\n`);
      if (!word) {
        return null;
      }

      let definition = db.findDefinition(word);

      // Fallback: resolve local variable/property prefix, then look up member
      if (!definition) {
        const lastDot = word.lastIndexOf(".");
        if (lastDot > 0) {
          const prefix = word.slice(0, lastDot);
          const memberName = word.slice(lastDot + 1);
          const resolvedClass = qxl.lsp.Util.resolveType(prefix, content, db);
          if (resolvedClass) {
            definition = db.findDefinition(`${resolvedClass}.${memberName}`);
          }
        }
      }

      // Fallback: local variable declaration in current file
      if (!definition && /^[\w$]+$/.test(word)) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const varRe = new RegExp(`(?:const|let|var)\\s+${escaped}\\b`);
        for (let l = params.position.line; l >= 0; l--) {
          if (varRe.test(lines[l])) {
            definition = { file: filePath, line: l };
            break;
          }
        }
      }

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
      process.stdout.write(`[qxl.lsp] provideDeclaration called for file: ${filePath}\n`);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      const { word } = qxl.lsp.Util.getWordAtPosition(lines, params.position);
      process.stdout.write(`[qxl.lsp] provideDeclaration extracted word: ${word}\n`);
      if (!word) {
        return null;
      }

      let definition = db.findSourceDefinition(word);

      // Fallback: resolve local variable/property prefix, then look up member
      if (!definition) {
        const lastDot = word.lastIndexOf(".");
        if (lastDot > 0) {
          const prefix = word.slice(0, lastDot);
          const memberName = word.slice(lastDot + 1);
          const resolvedClass = qxl.lsp.Util.resolveType(prefix, content, db);
          if (resolvedClass) {
            definition = db.findSourceDefinition(`${resolvedClass}.${memberName}`);
          }
        }
      }

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
