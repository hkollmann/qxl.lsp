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
 * Utility helpers for the LSP server.
 */
qx.Class.define("qxl.lsp.Util", {
  statics: {
    /**
     * Reads and parses a JSONC file synchronously (supports // and /* comments).
     *
     * @param {string} filePath - Absolute path to the JSON/JSONC file.
     * @returns {object} Parsed JSON object.
     */
    readJsonFile(filePath) {
      const fs = require("fs");
      const content = fs.readFileSync(filePath, "utf-8").trim();
      try {
        return JSON.parse(content);
      } catch (_) {
        // Fall back to JSONC parser for files with comments
        const ast = qx.tool.utils.json.Parser.parseToAst(content);
        return qx.tool.utils.json.Stringify.astToObject(ast);
      }
    },

    /**
     * Extracts the dotted identifier at the given cursor position.
     *
     * @param {string[]} lines - Array of source lines.
     * @param {{line: number, character: number}} position - LSP position (0-based).
     * @returns {{word: string, cursorOffset: number}} word is the full dotted identifier,
     *   cursorOffset is the 0-based character offset of the cursor within that word.
     */
    getWordAtPosition(lines, position) {
      const line = lines[position.line] || "";
      const char = position.character;

      let start = char;
      while (start > 0 && /[\w$.]/.test(line[start - 1])) {
        start--;
      }
      let end = char;
      while (end < line.length && /[\w$.]/.test(line[end])) {
        end++;
      }

      const word = line.slice(start, end);
      if (!word) {
        return { word: "", cursorOffset: 0 };
      }

      return { word, cursorOffset: char - start };
    }
  }
});
