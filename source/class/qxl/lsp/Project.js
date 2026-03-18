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
 * Represents a Qooxdoo workspace.
 * Derives the meta directory from compile.json, delegates all data access
 * to a MetaDatabase instance, and watches db.json for auto-reload.
 */
qx.Class.define("qxl.lsp.Project", {
  extend: qx.core.Object,

  /**
   * @param {string} workspacePath - Absolute path to the workspace root.
   */
  construct(workspacePath) {
    super();
    this.__workspacePath = workspacePath;
    this.__metaDb = new qxl.lsp.MetaDatabase();
    this.__watcher = null;
    this.__reloadTimer = null;
  },

  members: {
    /** @type {string} Absolute path to the workspace root */
    __workspacePath: null,

    /** @type {qxl.lsp.MetaDatabase} Loaded meta database instance */
    __metaDb: null,

    /** @type {import("fs").FSWatcher|null} File system watcher on db.json */
    __watcher: null,

    /** @type {ReturnType<typeof setTimeout>|null} Debounce timer for reload */
    __reloadTimer: null,

    /**
     * @returns {string} Absolute path to the workspace root.
     */
    getWorkspacePath() {
      return this.__workspacePath;
    },

    /**
     * @returns {qxl.lsp.MetaDatabase} The loaded meta database instance.
     */
    getMetaDatabase() {
      return this.__metaDb;
    },

    /**
     * Derives the meta directory from compile.json, loads the MetaDatabase,
     * and sets up a file watcher to reload on changes.
     */
    load() {
      const path = require("upath");
      const fs = require("fs");

      const compileJsonPath = path.join(this.__workspacePath, "compile.json");
      if (!fs.existsSync(compileJsonPath)) {
        return;
      }

      const compileConf = qxl.lsp.Util.readJsonFile(compileJsonPath);
      if (!compileConf.targets || compileConf.targets.length === 0) {
        return;
      }

      // Meta-Pfad-Berechnung analog zu qooxdoo.v8/Compile.js Z. 1101-1108
      const metaDir = compileConf.meta?.output
        ? path.resolve(this.__workspacePath, compileConf.meta.output)
        : path.resolve(this.__workspacePath, compileConf.targets[0].outputPath, "../meta");

      const dbPath = path.join(metaDir, "db.json");
      if (!fs.existsSync(dbPath)) {
        return;
      }

      this.__metaDb.load(metaDir);

      if (this.__watcher) {
        this.__watcher.close();
        this.__watcher = null;
      }
      this.__watcher = fs.watch(dbPath, () => {
        clearTimeout(this.__reloadTimer);
        this.__reloadTimer = setTimeout(() => this.load(), 500);
      });
    }
  }
});
