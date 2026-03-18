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
    },

    /**
     * Resolves a JavaScript expression to a Qooxdoo class name using regex heuristics.
     * Handles the most common patterns without requiring an AST parser.
     *
     * Supported:
     *   - Direct class name:    `qx.ui.core.Widget`      → `qx.ui.core.Widget`
     *   - this:                 `this`                   → class from qx.Class.define in source
     *   - Constructor:          `new qx.ui.form.Button()` → `qx.ui.form.Button`
     *   - Method call chain:    `this.getLayout()`       → @return type of getLayout
     *
     * @param {string} expr - Expression to resolve (trimmed).
     * @param {string} sourceText - Full source text of the current file.
     * @param {qxl.lsp.MetaDatabase} db
     * @param {number} depth - Recursion guard (max 3).
     * @returns {string|null} Resolved class name or null.
     */
    resolveType(expr, sourceText, db, depth = 0) {
      expr = expr.trim();
      if (!expr || depth > 3) return null;

      // Direct class name
      if (db.getClassData(expr)) return expr;

      // "this" → extract class from qx.Class.define in current file
      if (expr === "this") {
        const m = sourceText.match(/qx\.Class\.define\s*\(\s*["']([\w.]+)["']/);
        return m ? m[1] : null;
      }

      // new ClassName(...) → ClassName
      const newMatch = expr.match(/^new\s+([\w.]+)\s*(?:\([\s\S]*\))?$/);
      if (newMatch) return newMatch[1];

      // expr.method() → resolve type of expr, then look up @return of method
      const callMatch = expr.match(/^([\s\S]+)\.([\w$]+)\s*\(\s*\)$/);
      if (callMatch) {
        const baseType = qxl.lsp.Util.resolveType(callMatch[1], sourceText, db, depth + 1);
        if (!baseType) return null;
        const info = db.getSymbolInfo(`${baseType}.${callMatch[2]}`);
        if (!info || !info.memberName) return null;
        const classData = db.getClassData(info.definedIn);
        if (!classData) return null;
        const memberData =
          classData.members?.[info.memberName] ??
          classData.statics?.[info.memberName] ??
          null;
        return memberData?.jsdoc?.["@return"]?.[0]?.type ?? null;
      }

      return null;
    }
  }
});
