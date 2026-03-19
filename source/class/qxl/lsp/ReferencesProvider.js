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
 * LSP find-references handler for Qooxdoo classes and members.
 * Searches all JS source files in the workspace for text occurrences.
 */
qx.Class.define("qxl.lsp.ReferencesProvider", {
  extend: qx.core.Object,
  include: [qxl.lsp.MUriHelper],

  members: {
    /**
     * Handles a textDocument/references LSP request.
     *
     * @param {object} params - LSP ReferenceParams
     * @param {string} wsPath - Absolute workspace root path
     * @returns {object[]|null} Array of LSP Location objects or null
     */
    provideReferences(params, wsPath) {
      const fs = require("fs");

      const filePath = this._uriToPath(params.textDocument.uri);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      const { word } = qxl.lsp.Util.getWordAtPosition(lines, params.position);
      process.stdout.write(`[qxl.lsp] provideReferences called for word: ${word}\n`);
      if (!word) {
        return null;
      }

      const jsFiles = this.__collectJsFiles(wsPath);
      const results = [];

      for (const file of jsFiles) {
        let fileContent;
        try {
          fileContent = fs.readFileSync(file, "utf-8");
        } catch (_) {
          continue;
        }
        const fileLines = fileContent.split("\n");
        for (let i = 0; i < fileLines.length; i++) {
          const line = fileLines[i];
          let idx = 0;
          while (true) {
            const pos = line.indexOf(word, idx);
            if (pos === -1) break;
            results.push({
              uri: this._pathToUri(file),
              range: {
                start: { line: i, character: pos },
                end: { line: i, character: pos + word.length }
              }
            });
            idx = pos + word.length;
          }
        }
      }

      process.stdout.write(`[qxl.lsp] provideReferences found ${results.length} references\n`);
      return results;
    },

    /**
     * Recursively collects all .js files under dir, skipping common non-source dirs.
     *
     * @param {string} dir
     * @returns {string[]}
     */
    __collectJsFiles(dir) {
      const fs = require("fs");
      const path = require("path");
      const excluded = new Set(["node_modules", "compiled", "build", ".git"]);
      const results = [];

      const walk = d => {
        let entries;
        try {
          entries = fs.readdirSync(d, { withFileTypes: true });
        } catch (_) {
          return;
        }
        for (const e of entries) {
          if (excluded.has(e.name)) continue;
          const full = path.join(d, e.name);
          if (e.isDirectory()) {
            walk(full);
          } else if (e.name.endsWith(".js")) {
            results.push(full);
          }
        }
      };
      walk(dir);
      return results;
    }
  }
});
