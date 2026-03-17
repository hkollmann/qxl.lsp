/**
 * Manages the Qooxdoo meta database for a workspace.
 * Reads the compiled meta database instead of scanning source files.
 * Watches db.json for changes and reloads automatically.
 */
qx.Class.define("qxl.lsp.Project", {
  extend: qx.core.Object,

  /**
   * @param {string} workspacePath - Absolute path to the workspace root.
   */
  construct(workspacePath) {
    super();
    this.__workspacePath = workspacePath;
    this.__metaDir = null;
    this.__watcher = null;
    this.__reloadTimer = null;
    this.__db = null;
    this.__classCache = {};
  },

  members: {
    __workspacePath: null,
    __metaDir: null,
    __watcher: null,
    __reloadTimer: null,

    /** @type {object|null} Parsed db.json: { libraries, classnames[] } */
    __db: null,

    /** @type {Object<string, object>} Lazy cache of individual class JSON files */
    __classCache: null,

    /**
     * Determines the meta directory from compile.json, loads db.json into memory,
     * and sets up a file watcher to reload on changes.
     */
    load() {
      const path = require("path");
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
      this.__metaDir = compileConf.meta?.output
        ? path.resolve(this.__workspacePath, compileConf.meta.output)
        : path.resolve(this.__workspacePath, compileConf.targets[0].outputPath, "../meta");

      const dbPath = path.join(this.__metaDir, "db.json");
      if (!fs.existsSync(dbPath)) {
        return;
      }

      this.__db = qxl.lsp.Util.readJsonFile(dbPath);
      this.__classCache = {};

      if (this.__watcher) {
        this.__watcher.close();
        this.__watcher = null;
      }
      this.__watcher = fs.watch(dbPath, () => {
        clearTimeout(this.__reloadTimer);
        this.__reloadTimer = setTimeout(() => this.load(), 500);
      });
    },

    /**
     * Finds the definition location for a class name and optional member.
     *
     * @param {string} className - Fully-qualified qooxdoo class name (e.g. "qx.core.Object").
     * @param {string|null} memberName - Member/method/property name, or null for the class itself.
     * @returns {{file: string, line: number}|null} File path and 0-based line number, or null.
     */
    findDefinition(className, memberName) {
      const path = require("path");

      if (!this.__db) {
        return null;
      }

      const classData = this.__loadClass(className);
      if (!classData) {
        return null;
      }

      // classFilename ist relativ zu metaDir → absolut auflösen (analog MetaDatabase.js Z. 72-73)
      const absFile = path.resolve(path.join(this.__metaDir, classData.classFilename));

      let loc = null;
      if (memberName) {
        loc =
          classData.members?.[memberName]?.location?.start ??
          classData.statics?.[memberName]?.location?.start ??
          classData.properties?.[memberName]?.location?.start ??
          null;
      }
      loc = loc ?? classData.location?.start ?? null;

      if (!loc) {
        return null;
      }

      // Meta-DB ist 1-basiert, LSP erwartet 0-basiert
      return { file: absFile, line: loc.line - 1 };
    },

    /**
     * Returns the parsed class JSON for the given class name.
     * Reads from disk on first access, then serves from cache.
     * Returns null if the class is unknown or its JSON file is missing.
     *
     * @param {string} className
     * @returns {object|null}
     */
    __loadClass(className) {
      if (className in this.__classCache) {
        return this.__classCache[className];
      }

      const path = require("path");
      const fs = require("fs");

      if (!this.__db.classnames.includes(className)) {
        return (this.__classCache[className] = null);
      }

      const classJsonPath = path.join(
        this.__metaDir,
        className.replace(/\./g, "/") + ".json"
      );

      const classData = fs.existsSync(classJsonPath)
        ? qxl.lsp.Util.readJsonFile(classJsonPath)
        : null;

      return (this.__classCache[className] = classData);
    }
  }
});
