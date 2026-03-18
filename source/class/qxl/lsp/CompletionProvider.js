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
 * LSP completion handler for Qooxdoo classes and members.
 * Supports member completion after "." and class name prefix completion.
 */
qx.Class.define("qxl.lsp.CompletionProvider", {
  extend: qx.core.Object,
  include: [qxl.lsp.MUriHelper],

  members: {
    /**
     * Handles a textDocument/completion LSP request.
     *
     * @param {object} params - LSP CompletionParams
     * @param {qxl.lsp.MetaDatabase} db
     * @returns {object[]|null} Array of LSP CompletionItem objects or null
     */
    provideCompletion(params, db) {
      const fs = require("fs");
      const { CompletionItemKind } = require("vscode-languageserver/node");

      const filePath = this._uriToPath(params.textDocument.uri);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      const line = lines[params.position.line] ?? "";
      const charBefore = line.slice(0, params.position.character);

      // Case A: after "." — member completion for a known class
      const dotMatch = charBefore.match(/([\w$][\w$.]*)\.$/);
      if (dotMatch) {
        const members = db.getAllMembersForClass(dotMatch[1]);
        if (members.length > 0) {
          return members.map(m => ({
            label: m.name,
            kind:
              m.kind === "member"
                ? CompletionItemKind.Method
                : m.kind === "static"
                ? CompletionItemKind.Function
                : CompletionItemKind.Property,
            detail: `(${m.kind}) from ${m.definedIn}`
          }));
        }
      }

      // Case B: class name prefix completion
      const wordMatch = charBefore.match(/([\w$][\w$.]*)$/);
      if (wordMatch) {
        const prefix = wordMatch[1];
        if (prefix.length < 2) {
          return null;
        }
        const lower = prefix.toLowerCase();
        const matches = db.getClassNames().filter(cn => cn.toLowerCase().startsWith(lower));
        if (matches.length > 0) {
          return matches.map(cn => ({ label: cn, kind: CompletionItemKind.Class }));
        }
      }

      return null;
    }
  }
});
