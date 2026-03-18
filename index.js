const fs = require("fs");
const preferred = "./lib/qxl.lsp/index.js";
process.stdout.write(`[qxl.lsp] Starting server using ${preferred}\n`);
require(fs.existsSync(preferred) ? preferred : "./compiled/source/qxl.lsp/index.js");
