/**
 * LSP go-to-definition handler for Qooxdoo classes and members.
 */
qx.Class.define("qxl.lsp.DefinitionProvider", {
  extend: qx.core.Object,

  members: {
    /**
     * Handles a textDocument/definition LSP request.
     *
     * @param {object} params - LSP DefinitionParams
     * @param {qxl.lsp.Project} project - The loaded project instance
     * @returns {object|null} LSP Location object or null
     */
    provideDefinition(params, project) {
      const fs = require("fs");

      const filePath = this.__uriToPath(params.textDocument.uri);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      const { className, memberName } = qxl.lsp.Util.getWordAtPosition(
        lines,
        params.position
      );

      if (!className) {
        return null;
      }

      const definition = project.findDefinition(className, memberName);
      if (!definition) {
        return null;
      }

      return {
        uri: this.__pathToUri(definition.file),
        range: {
          start: { line: definition.line, character: 0 },
          end: { line: definition.line, character: 0 }
        }
      };
    },

    /**
     * Converts an LSP file URI to a normalized filesystem path.
     *
     * @param {string} uri
     * @returns {string}
     */
    __uriToPath(uri) {
      const upath = require("upath");
      const { fileURLToPath } = require("url");
      return upath.normalize(fileURLToPath(uri));
    },

    /**
     * Converts a filesystem path to an LSP file URI.
     *
     * @param {string} filePath
     * @returns {string}
     */
    __pathToUri(filePath) {
      const upath = require("upath");
      const { pathToFileURL } = require("url");
      return pathToFileURL(upath.normalize(filePath)).toString();
    }
  }
});
