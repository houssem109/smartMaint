"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const init_db_1 = require("../init-db");
(0, init_db_1.initDatabase)()
    .then(() => {
    console.log('✅ Database initialization completed');
    process.exit(0);
})
    .catch((error) => {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
});
//# sourceMappingURL=init.js.map