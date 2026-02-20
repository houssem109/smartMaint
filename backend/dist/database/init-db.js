"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
const typeorm_1 = require("typeorm");
const seed_1 = require("./seeds/seed");
async function initDatabase() {
    const dataSource = new typeorm_1.DataSource({
        type: 'postgres',
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        username: process.env.DATABASE_USER || 'smartmaint',
        password: process.env.DATABASE_PASSWORD || 'smartmaint123',
        database: process.env.DATABASE_NAME || 'smartmaint_db',
        entities: ['src/**/*.entity.ts'],
        synchronize: false,
        logging: false,
    });
    try {
        await dataSource.initialize();
        console.log('✅ Database connected');
        await dataSource.runMigrations();
        console.log('✅ Migrations completed');
        await (0, seed_1.seedDatabase)(dataSource);
        console.log('✅ Database seeded');
        await dataSource.destroy();
    }
    catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
}
//# sourceMappingURL=init-db.js.map