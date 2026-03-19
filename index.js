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

const fs = require("fs");
const preferred = __dirname + "/lib/qxl.lsp/index.js";
let target = fs.existsSync(preferred) ? preferred : __dirname + "/compiled/source/qxl.lsp/index.js";
process.stdout.write(`[qxl.lsp] Starting server using ${target}\n`);
require(target);
