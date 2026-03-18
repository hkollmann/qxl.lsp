/**
 * Mixin providing URI ↔ filesystem path conversion helpers.
 */
qx.Mixin.define("qxl.lsp.MUriHelper", {
  members: {
    /**
     * @param {string} uri
     * @returns {string}
     */
    _uriToPath(uri) {
      const upath = require("upath");
      const { fileURLToPath } = require("url");
      return upath.normalize(fileURLToPath(uri));
    },

    /**
     * @param {string} filePath
     * @returns {string}
     */
    _pathToUri(filePath) {
      const upath = require("upath");
      const { pathToFileURL } = require("url");
      return pathToFileURL(upath.normalize(filePath)).toString();
    }
  }
});
