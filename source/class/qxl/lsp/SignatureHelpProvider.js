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
 * LSP signature help handler — shows method parameter hints when typing `(` or `,`.
 */
qx.Class.define("qxl.lsp.SignatureHelpProvider", {
  extend: qx.core.Object,
  include: [qxl.lsp.MUriHelper],

  members: {
    /**
     * Handles a textDocument/signatureHelp LSP request.
     *
     * @param {object} params - LSP SignatureHelpParams
     * @param {qxl.lsp.MetaDatabase} db
     * @returns {object|null} LSP SignatureHelp object or null
     */
    provideSignatureHelp(params, db) {
      const fs = require("fs");

      const filePath = this._uriToPath(params.textDocument.uri);
      if (!fs.existsSync(filePath)) return null;

      const text = fs.readFileSync(filePath, "utf-8");

      // Convert LSP position (line, character) to flat character offset
      const lines = text.split("\n");
      let offset = 0;
      for (let i = 0; i < params.position.line; i++) {
        offset += lines[i].length + 1; // +1 for \n
      }
      offset += params.position.character;

      // Find the innermost unmatched opening `(` before the cursor
      const openPos = this._findOpeningBracket(text, offset);
      if (openPos < 0) return null;

      // Count top-level commas between `(` and cursor → active parameter index
      const activeParameter = this._countActiveParameter(text, openPos, offset);

      // Extract the dotted method expression directly before `(`
      const methodExpr = this._extractMethodExpression(text, openPos);
      if (!methodExpr) return null;

      // Resolve via MetaDatabase (walks superClass chain automatically)
      const info = db.getSymbolInfo(methodExpr);
      if (!info || !info.memberName) return null;

      const classData = db.getClassData(info.definedIn);
      if (!classData) return null;

      const memberData =
        classData?.members?.[info.memberName] ??
        classData?.statics?.[info.memberName] ??
        null;

      if (!memberData || memberData.type !== "function") return null;

      const paramDefs = memberData.jsdoc?.["@param"] ?? [];
      if (paramDefs.length === 0) return null;

      const parameters = paramDefs.map(p => ({
        label: `${p.paramName}${p.optional ? "?" : ""}: ${p.type ?? "any"}`,
        documentation: p.description ?? undefined
      }));

      const paramStr = paramDefs
        .map(p => `${p.paramName}${p.optional ? "?" : ""}: ${p.type ?? "any"}`)
        .join(", ");
      const retDef = memberData.jsdoc?.["@return"]?.[0];
      const retStr = retDef?.type ? `: ${retDef.type}` : "";
      const signatureLabel = `${info.memberName}(${paramStr})${retStr}`;

      const descBody = memberData.jsdoc?.["@description"]?.[0]?.body;

      return {
        signatures: [
          {
            label: signatureLabel,
            documentation: descBody ? { kind: "markdown", value: descBody } : undefined,
            parameters
          }
        ],
        activeSignature: 0,
        activeParameter: Math.min(activeParameter, parameters.length - 1)
      };
    },

    /**
     * Searches backwards from `pos` for the nearest unmatched `(`.
     * Skips over matched `()` pairs to handle nested calls correctly.
     *
     * @param {string} text
     * @param {number} pos - cursor offset (exclusive)
     * @returns {number} offset of the opening `(`, or -1 if not found
     */
    _findOpeningBracket(text, pos) {
      let depth = 0;
      for (let i = pos - 1; i >= 0; i--) {
        const c = text[i];
        if (c === ")") {
          depth++;
        } else if (c === "(") {
          if (depth === 0) return i;
          depth--;
        }
      }
      return -1;
    },

    /**
     * Counts the number of top-level commas between `openPos` and `cursorPos`.
     * Commas inside nested `()`, `[]`, `{}` are ignored.
     *
     * @param {string} text
     * @param {number} openPos - offset of the opening `(`
     * @param {number} cursorPos
     * @returns {number} 0-based parameter index
     */
    _countActiveParameter(text, openPos, cursorPos) {
      let count = 0;
      let depth = 0;
      for (let i = openPos + 1; i < cursorPos; i++) {
        const c = text[i];
        if (c === "(" || c === "[" || c === "{") {
          depth++;
        } else if (c === ")" || c === "]" || c === "}") {
          depth--;
        } else if (c === "," && depth === 0) {
          count++;
        }
      }
      return count;
    },

    /**
     * Extracts the dotted identifier (e.g. `this.add` or `qx.log.Logger.setLevel`)
     * that appears directly before position `pos`, skipping any leading whitespace.
     *
     * @param {string} text
     * @param {number} pos - offset of the `(`
     * @returns {string|null}
     */
    _extractMethodExpression(text, pos) {
      let end = pos;
      while (end > 0 && /\s/.test(text[end - 1])) end--;
      let start = end;
      while (start > 0 && /[\w$.]/.test(text[start - 1])) start--;
      if (start === end) return null;
      return text.slice(start, end) || null;
    }
  }
});
