/**
 * LSP workspace symbols handler for Qooxdoo classes.
 * Powers Ctrl+T quick navigation across the whole workspace.
 */
qx.Class.define("qxl.lsp.WorkspaceSymbolsProvider", {
  extend: qx.core.Object,
  include: [qxl.lsp.MUriHelper],

  members: {
    /**
     * Handles a workspace/symbol LSP request.
     *
     * @param {object} params - LSP WorkspaceSymbolParams
     * @param {qxl.lsp.MetaDatabase} db
     * @returns {object[]} Array of LSP SymbolInformation objects
     */
    provideWorkspaceSymbols(params, db) {
      const { SymbolKind } = require("vscode-languageserver/node");

      const query = (params.query ?? "").toLowerCase();
      const classNames = db.getClassNames();

      const matches = query
        ? classNames.filter(cn => cn.toLowerCase().includes(query))
        : classNames;

      const emptyRange = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 }
      };

      return matches.slice(0, 500).map(className => {
        let location = { uri: "", range: emptyRange };

        // Only resolve file/line when filtering by query to avoid loading all class files
        if (query) {
          const absFile = db.resolveClassFile(className);
          if (absFile) {
            const classData = db.getClassData(className);
            const line = Math.max(0, (classData?.location?.start?.line ?? 1) - 1);
            location = {
              uri: this._pathToUri(absFile),
              range: {
                start: { line, character: 0 },
                end: { line, character: 0 }
              }
            };
          }
        }

        return { name: className, kind: SymbolKind.Class, location };
      });
    }
  }
});
