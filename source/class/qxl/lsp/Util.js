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
     * @returns {{word: string}}
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
        return { word: "" };
      }

      return { word };
    }
  }
});
