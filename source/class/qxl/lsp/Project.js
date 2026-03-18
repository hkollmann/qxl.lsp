/**
 * Manages the Qooxdoo meta database for a workspace.
 * Reads the compiled meta database instead of scanning source files.
 * Watches db.json for changes and reloads automatically.
 */

const path = require("upath");
      const fs = require("fs");

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
     * @returns {string} Absolute path to the workspace root.
     */
    getWorkspacePath() {
      return this.__workspacePath;
    },

    /**
     * Determines the meta directory from compile.json, loads db.json into memory,
     * and sets up a file watcher to reload on changes.
     */
    load() {

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
     * Finds the definition location for a dotted word (e.g. "qx.core.Object.clone").
     * Determines the class/member split by matching prefixes against db.classnames.
     *
     * @param {string} word - Full dotted identifier from the source.
     * @returns {{file: string, line: number}|null} File path and 0-based line number, or null.
     */
    findDefinition(word) {

      if (!this.__db) {
        return null;
      }

      const { className, memberName } = this.__resolveWord(word);
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
     * Finds the original (topmost ancestor) definition location for a member
     * by walking up the superClass chain.
     *
     * @param {string} word - Full dotted identifier from the source.
     * @returns {{file: string, line: number}|null}
     */
    findSourceDefinition(word) {
      if (!this.__db) {
        return null;
      }

      const { className, memberName } = this.__resolveWord(word);
      let result = null;
      let current = className;
      const visited = new Set();

      while (current && !visited.has(current)) {
        visited.add(current);
        const classData = this.__loadClass(current);
        if (!classData) {
          break;
        }

        let loc = null;
        if (memberName) {
          loc =
            classData.members?.[memberName]?.location?.start ??
            classData.statics?.[memberName]?.location?.start ??
            classData.properties?.[memberName]?.location?.start ??
            null;
        }
        loc = loc ?? (!memberName ? classData.location?.start ?? null : null);

        if (loc) {
          const absFile = path.resolve(path.join(this.__metaDir, classData.classFilename));
          result = { file: absFile, line: loc.line - 1 };
        }

        current = classData.superClass ?? null;
      }

      return result;
    },

    /**
     * Splits a dotted word into className and memberName by matching the longest
     * prefix found in db.classnames.
     *
     * @param {string} word - Full dotted identifier (e.g. "qx.core.Object.clone").
     * @returns {{className: string, memberName: string|null}}
     */
    __resolveWord(word) {
      const parts = word.split(".");
      for (let i = parts.length; i >= 1; i--) {
        const candidate = parts.slice(0, i).join(".");
        if (this.__db.classnames.includes(candidate)) {
          const memberName = i < parts.length ? parts[i] : null;
          return { className: candidate, memberName };
        }
      }
      return { className: word, memberName: null };
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
