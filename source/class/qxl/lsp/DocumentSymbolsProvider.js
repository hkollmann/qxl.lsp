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
 * LSP document symbols handler for Qooxdoo classes.
 * Populates the VS Code OUTLINE panel and breadcrumbs.
 */
qx.Class.define("qxl.lsp.DocumentSymbolsProvider", {
  extend: qx.core.Object,
  include: [qxl.lsp.MUriHelper],

  members: {
    /**
     * Handles a textDocument/documentSymbol LSP request.
     *
     * @param {object} params - LSP DocumentSymbolParams
     * @param {qxl.lsp.MetaDatabase} db
     * @returns {object[]|null} Array of LSP DocumentSymbol objects or null
     */
    provideDocumentSymbols(params, db) {
      const fs = require("fs");
      const { SymbolKind } = require("vscode-languageserver/node");

      const filePath = this._uriToPath(params.textDocument.uri);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const match = content.match(
        /qx\.(?:Class|Mixin|Interface|Theme)\.define\s*\(\s*["']([^"']+)["']/
      );
      if (!match) {
        return null;
      }

      const className = match[1];
      const classData = db.getClassData(className);
      if (!classData) {
        return null;
      }

      const makeRange = loc => {
        const line = Math.max(0, (loc?.start?.line ?? 1) - 1);
        return {
          start: { line, character: 0 },
          end: { line, character: 0 }
        };
      };

      const classRange = makeRange(classData.location);
      const classSymbol = {
        name: className,
        kind: SymbolKind.Class,
        range: classRange,
        selectionRange: classRange,
        children: []
      };

      for (const [name, data] of Object.entries(classData.members ?? {})) {
        const r = makeRange(data.location);
        classSymbol.children.push({ name, kind: SymbolKind.Method, range: r, selectionRange: r });
      }

      for (const [name, data] of Object.entries(classData.statics ?? {})) {
        const r = makeRange(data.location);
        classSymbol.children.push({ name, kind: SymbolKind.Function, range: r, selectionRange: r });
      }

      for (const [name, data] of Object.entries(classData.properties ?? {})) {
        const r = makeRange(data.location);
        classSymbol.children.push({ name, kind: SymbolKind.Property, range: r, selectionRange: r });
      }

      return [classSymbol];
    }
  }
});
