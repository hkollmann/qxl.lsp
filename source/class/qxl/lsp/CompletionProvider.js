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

      // Helper: build CompletionItems from a member list
      const membersToItems = members =>
        members.map(m => ({
          label: m.name,
          kind:
            m.kind === "member"
              ? CompletionItemKind.Method
              : m.kind === "static"
              ? CompletionItemKind.Function
              : CompletionItemKind.Property,
          detail: `(${m.kind}) from ${m.definedIn}`
        }));

      // Helper: resolve expression to members via TypeResolver
      const resolveToMembers = expr => {
        const typeName = qxl.lsp.Util.resolveType(expr, content, db);
        if (!typeName) return null;
        const members = db.getAllMembersForClass(typeName);
        return members.length > 0 ? membersToItems(members) : null;
      };

      // Case A: after "." — member completion
      if (charBefore.endsWith(".")) {
        const dotPos = charBefore.length - 1;

        // A1: plain dotted identifier: qx.log.Logger. or this.
        const dotMatch = charBefore.match(/([\w$][\w$.]*)\.$/);
        if (dotMatch) {
          const direct = db.getAllMembersForClass(dotMatch[1]);
          if (direct.length > 0) return membersToItems(direct);
          const resolved = resolveToMembers(dotMatch[1]);
          if (resolved) return resolved;
        }

        // A2: call chain ending in ".": word.method(args). or new ClassName(args).
        const callDotMatch = charBefore.match(/([\w$][\w$.]*\([^()]*\))\.$/);
        if (callDotMatch) {
          const resolved = resolveToMembers(callDotMatch[1]);
          if (resolved) return resolved;
        }

        const newDotMatch = charBefore.match(/\b(new\s+[\w.]+\s*\([^()]*\))\.$/);
        if (newDotMatch) {
          const resolved = resolveToMembers(newDotMatch[1]);
          if (resolved) return resolved;
        }

        // A3: bracket-matching fallback for complex chains like this.getA().getB()._field.
        const complexExpr = qxl.lsp.Util.getExpressionBeforeDot(charBefore, dotPos);
        if (complexExpr && complexExpr !== dotMatch?.[1]) {
          const resolved = resolveToMembers(complexExpr);
          if (resolved) return resolved;
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
