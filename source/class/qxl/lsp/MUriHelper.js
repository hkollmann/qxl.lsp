/**
 * Mixin providing URI ↔ filesystem path conversion helpers.
 */
qx.Mixin.define("qxl.lsp.MUriHelper", {
  members: {
    /**
     * Converts a file URI to a normalized filesystem path.
     *
     * @param {string} uri - A file URI (e.g. `file:///C:/project/src/Foo.js`)
     * @returns {string} Normalized absolute filesystem path
     */
    _uriToPath(uri) {
      const upath = require("upath");
      const { fileURLToPath } = require("url");
      return upath.normalize(fileURLToPath(uri));
    },

    /**
     * Converts a filesystem path to a file URI.
     *
     * @param {string} filePath - Absolute filesystem path
     * @returns {string} Corresponding file URI (e.g. `file:///C:/project/src/Foo.js`)
     */
    _pathToUri(filePath) {
      const upath = require("upath");
      const { pathToFileURL } = require("url");
      return pathToFileURL(upath.normalize(filePath)).toString();
    }
  }
});
