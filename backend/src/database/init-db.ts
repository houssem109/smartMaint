import { DataSource } from 'typeorm';
import { seedDatabase } from './seeds/seed';

export async function initDatabase() {
  const dataSource = new DataSource({
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

    // Run migrations
    await dataSource.runMigrations();
    console.log('✅ Migrations completed');

    // Seed database
    await seedDatabase(dataSource);
    console.log('✅ Database seeded');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}
