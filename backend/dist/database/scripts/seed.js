"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const seed_1 = require("../seeds/seed");
const dataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    username: process.env.DATABASE_USER || 'smartmaint',
    password: process.env.DATABASE_PASSWORD || 'smartmaint123',
    database: process.env.DATABASE_NAME || 'smartmaint_db',
    entities: ['src/**/*.entity.ts'],
    synchronize: false,
    logging: true,
});
(0, seed_1.seedDatabase)(dataSource)
    .then(async () => {
    await dataSource.destroy();
    console.log('✅ Database seeded successfully');
    process.exit(0);
})
    .catch(async (error) => {
    console.error('❌ Seeding failed:', error);
    await dataSource.destroy();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map