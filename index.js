const fs = require("fs");
const preferred = "./lib/qxl.lsp/index.js";
require(fs.existsSync(preferred) ? preferred : "./compiled/source/qxl.lsp/index.js");
