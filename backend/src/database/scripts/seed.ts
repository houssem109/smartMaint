import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { seedDatabase } from '../seeds/seed';

const dataSource = new DataSource({
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

seedDatabase(dataSource)
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
