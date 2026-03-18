/**
 * LSP hover handler for Qooxdoo classes and members.
 */
qx.Class.define("qxl.lsp.HoverProvider", {
  extend: qx.core.Object,
  include: [qxl.lsp.MUriHelper],

  members: {
    /**
     * Handles a textDocument/hover LSP request.
     *
     * @param {object} params - LSP HoverParams
     * @param {qxl.lsp.MetaDatabase} db
     * @returns {object|null} LSP Hover object or null
     */
    provideHover(params, db) {
      const fs = require("fs");

      const filePath = this._uriToPath(params.textDocument.uri);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      const { word, cursorOffset } = qxl.lsp.Util.getWordAtPosition(lines, params.position);
      if (!word) {
        return null;
      }

      // Truncate to the dot-segment the cursor is actually on.
      // E.g. cursor on "Logger" in "qx.log.Logger.setLevel" → use "qx.log.Logger"
      const hoverWord = this.__wordUpToCursor(word, cursorOffset);

      const info = db.getSymbolInfo(hoverWord);
      if (!info || info.kind === "unknown") {
        return null;
      }

      const parts = [];

      if (!info.memberName) {
        // Class hover
        parts.push(`**class** \`${info.className}\``);
        const classData = db.getClassData(info.className);
        if (classData) {
          if (classData.superClass) {
            parts.push(`Extends: \`${classData.superClass}\``);
          }
          const desc = this.__extractDescription(classData.jsdoc);
          if (desc) {
            parts.push("---", desc);
          }
        }
      } else {
        // Member / static / property hover
        const classData = db.getClassData(info.definedIn);
        const memberData =
          classData?.members?.[info.memberName] ??
          classData?.statics?.[info.memberName] ??
          classData?.properties?.[info.memberName] ??
          null;

        // Build signature line for functions
        if (memberData?.type === "function") {
          const sig = this.__buildSignature(info.memberName, memberData);
          parts.push(sig);
        } else {
          parts.push(`**${info.kind}** \`${info.memberName}\``);
        }

        if (info.definedIn !== info.className) {
          parts.push(`Inherited from: \`${info.definedIn}\``);
        }

        if (memberData?.overriddenFrom) {
          parts.push(`Overrides: \`${memberData.overriddenFrom}\``);
        }

        if (memberData) {
          const jsdoc = memberData.jsdoc;

          const deprecated = jsdoc?.["@deprecated"]?.[0];
          if (deprecated) {
            parts.push(`\n> ⚠️ **Deprecated** ${this.__stripHtml(deprecated.body ?? "")}`);
          }

          const desc = this.__extractDescription(jsdoc);
          if (desc) {
            parts.push("---", desc);
          }

          // @param lines
          const paramDefs = jsdoc?.["@param"] ?? [];
          if (paramDefs.length > 0) {
            const paramLines = paramDefs.map(p => {
              const type = p.type ? `\`${p.type}\`` : "";
              const optional = p.optional ? "*(optional)*" : "";
              const def = p.defaultValue ? `= \`${p.defaultValue}\`` : "";
              const desc2 = p.description ? ` — ${p.description}` : "";
              return `- **${p.paramName}** ${[type, optional, def].filter(Boolean).join(" ")}${desc2}`;
            });
            parts.push("**Parameters:**\n" + paramLines.join("\n"));
          }

          // @return
          const ret = jsdoc?.["@return"]?.[0];
          if (ret) {
            const type = ret.type ? `\`${ret.type}\`` : "";
            const desc2 = ret.description ? ` — ${ret.description}` : "";
            parts.push(`**Returns:** ${type}${desc2}`);
          }

          // Property: check/init/nullable
          if (info.kind === "property" && memberData.json) {
            const j = memberData.json;
            const details = [];
            if (j.check) details.push(`check: \`${j.check}\``);
            if (j.init !== undefined) details.push(`init: \`${JSON.stringify(j.init)}\``);
            if (j.nullable) details.push("nullable");
            if (details.length > 0) {
              parts.push(details.join(", "));
            }
          }
        }
      }

      return { contents: { kind: "markdown", value: parts.join("\n\n") } };
    },

    /**
     * Builds a function signature string, e.g.:
     * ```typescript
     * setLevel(level: Integer): void
     * ```
     *
     * @param {string} name
     * @param {object} memberData
     * @returns {string}
     */
    __buildSignature(name, memberData) {
      const jsdoc = memberData?.jsdoc;
      const paramDefs = jsdoc?.["@param"] ?? [];
      const retDef = jsdoc?.["@return"]?.[0];

      const paramStr = paramDefs
        .map(p => {
          const type = p.type ? `: ${p.type}` : "";
          const opt = p.optional ? "?" : "";
          return `${p.paramName}${opt}${type}`;
        })
        .join(", ");

      const retStr = retDef?.type ? `: ${retDef.type}` : "";
      return `\`\`\`typescript\n${name}(${paramStr})${retStr}\n\`\`\``;
    },

    /**
     * Extracts the plain-text description from a jsdoc object.
     *
     * @param {object|null|undefined} jsdoc
     * @returns {string}
     */
    __extractDescription(jsdoc) {
      const body = jsdoc?.["@description"]?.[0]?.body ?? "";
      return this.__stripHtml(body).trim();
    },

    /**
     * Strips HTML tags and decodes basic entities.
     *
     * @param {string} html
     * @returns {string}
     */
    __stripHtml(html) {
      return html
        .replace(/<p>/gi, "")
        .replace(/<\/p>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .trim();
    },

    /**
     * Returns the dotted word truncated up to the segment where the cursor is positioned.
     * E.g. word="qx.log.Logger.setLevel", cursorOffset=7 (on "Logger") → "qx.log.Logger"
     *
     * @param {string} word
     * @param {number} cursorOffset
     * @returns {string}
     */
    __wordUpToCursor(word, cursorOffset) {
      const segments = word.split(".");
      let pos = 0;
      for (let i = 0; i < segments.length; i++) {
        pos += segments[i].length;
        if (pos > cursorOffset) {
          return segments.slice(0, i + 1).join(".");
        }
        pos++; // for the "."
      }
      return word;
    }
  }
});
