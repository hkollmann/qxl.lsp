/**
 * Qooxdoo meta database: loads db.json and individual class JSONs,
 * provides all symbol lookup methods used by LSP providers.
 */
qx.Class.define("qxl.lsp.MetaDatabase", {
  extend: qx.core.Object,

  construct() {
    super();
    this.__metaDir = null;
    this.__db = null;
    this.__classCache = {};
  },

  members: {
    /** @type {string|null} */
    __metaDir: null,

    /** @type {object|null} Parsed db.json: { libraries, classnames[] } */
    __db: null,

    /** @type {Object<string, object>} Lazy cache of individual class JSON files */
    __classCache: null,

    /**
     * Loads db.json from the given meta directory and resets the class cache.
     * Called by Project whenever the meta directory is (re-)calculated.
     *
     * @param {string} metaDir - Absolute path to the meta directory.
     */
    load(metaDir) {
      const path = require("upath");
      const fs = require("fs");

      this.__metaDir = metaDir;
      this.__classCache = {};

      const dbPath = path.join(metaDir, "db.json");
      this.__db = fs.existsSync(dbPath)
        ? qxl.lsp.Util.readJsonFile(dbPath)
        : null;
    },

    /**
     * @returns {string[]} All known class names.
     */
    getClassNames() {
      return this.__db?.classnames ?? [];
    },

    /**
     * Returns the parsed class JSON for a class name (lazy-loaded, cached).
     *
     * @param {string} className
     * @returns {object|null}
     */
    getClassData(className) {
      return this.__loadClass(className);
    },

    /**
     * Returns the absolute source file path for a class.
     *
     * @param {string} className
     * @returns {string|null}
     */
    resolveClassFile(className) {
      const path = require("upath");
      const classData = this.__loadClass(className);
      if (!classData) {
        return null;
      }
      return path.resolve(path.join(this.__metaDir, classData.classFilename));
    },

    /**
     * Splits a dotted word into className and memberName by longest-prefix match
     * against db.classnames.
     *
     * @param {string} word - e.g. "qx.core.Object.clone"
     * @returns {{className: string, memberName: string|null}}
     */
    resolveWord(word) {
      if (!this.__db) {
        return { className: word, memberName: null };
      }
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
     * Finds the definition location for a dotted word.
     *
     * @param {string} word
     * @returns {{file: string, line: number}|null} 0-based line number.
     */
    findDefinition(word) {
      const path = require("upath");
      if (!this.__db) {
        return null;
      }

      const { className, memberName } = this.resolveWord(word);
      const classData = this.__loadClass(className);
      if (!classData) {
        return null;
      }

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

      return { file: absFile, line: loc.line - 1 };
    },

    /**
     * Finds the original (topmost ancestor) definition location for a member.
     *
     * @param {string} word
     * @returns {{file: string, line: number}|null}
     */
    findSourceDefinition(word) {
      const path = require("upath");
      if (!this.__db) {
        return null;
      }

      const { className, memberName } = this.resolveWord(word);
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
     * Returns symbol information for a dotted word, walking the superClass chain
     * to find where the member is actually defined.
     *
     * @param {string} word
     * @returns {{className: string, memberName: string|null, kind: string, definedIn: string}|null}
     */
    getSymbolInfo(word) {
      if (!this.__db) {
        return null;
      }

      const { className, memberName } = this.resolveWord(word);

      if (!memberName) {
        return { className, memberName: null, kind: "class", definedIn: className };
      }

      let current = className;
      const visited = new Set();
      while (current && !visited.has(current)) {
        visited.add(current);
        const classData = this.__loadClass(current);
        if (!classData) {
          break;
        }
        if (classData.members?.[memberName]) {
          return { className, memberName, kind: "member", definedIn: current };
        }
        if (classData.statics?.[memberName]) {
          return { className, memberName, kind: "static", definedIn: current };
        }
        if (classData.properties?.[memberName]) {
          return { className, memberName, kind: "property", definedIn: current };
        }
        current = classData.superClass ?? null;
      }

      return { className, memberName, kind: "unknown", definedIn: className };
    },

    /**
     * Collects all members, statics, and properties for a class including inherited ones.
     * Subclass members overwrite ancestor members with the same name.
     *
     * @param {string} className
     * @returns {{name: string, kind: string, definedIn: string}[]}
     */
    getAllMembersForClass(className) {
      if (!this.__db) {
        return [];
      }

      const chain = [];
      let current = className;
      const visited = new Set();
      while (current && !visited.has(current)) {
        visited.add(current);
        chain.push(current);
        const classData = this.__loadClass(current);
        if (!classData) {
          break;
        }
        current = classData.superClass ?? null;
      }

      const allMembers = new Map();
      for (let i = chain.length - 1; i >= 0; i--) {
        const cls = chain[i];
        const classData = this.__loadClass(cls);
        if (!classData) {
          continue;
        }
        for (const name of Object.keys(classData.members ?? {})) {
          allMembers.set(name, { name, kind: "member", definedIn: cls });
        }
        for (const name of Object.keys(classData.statics ?? {})) {
          allMembers.set(name, { name, kind: "static", definedIn: cls });
        }
        for (const name of Object.keys(classData.properties ?? {})) {
          allMembers.set(name, { name, kind: "property", definedIn: cls });
        }
      }

      return Array.from(allMembers.values());
    },

    /**
     * Returns the parsed class JSON for a class name.
     * Reads from disk on first access, then serves from cache.
     *
     * @param {string} className
     * @returns {object|null}
     */
    __loadClass(className) {
      if (className in this.__classCache) {
        return this.__classCache[className];
      }

      if (!this.__db?.classnames.includes(className)) {
        return (this.__classCache[className] = null);
      }

      const path = require("upath");
      const fs = require("fs");

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
