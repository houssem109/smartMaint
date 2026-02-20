import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../users/entities/user.entity';

export async function seedDatabase(dataSource: DataSource) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  const userRepository = dataSource.getRepository(User);

  // Create default admin user
  const adminExists = await userRepository.findOne({ where: { email: 'admin@smartmaint.com' } });
  if (!adminExists) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = userRepository.create({
      username: 'admin',
      email: 'admin@smartmaint.com',
      password: adminPassword,
      role: UserRole.ADMIN,
      fullName: 'System Administrator',
      isActive: true,
    });
    await userRepository.save(admin);
    console.log('✅ Admin user created');
  }

  // Create default technician
  const techExists = await userRepository.findOne({ where: { email: 'tech@smartmaint.com' } });
  if (!techExists) {
    const techPassword = await bcrypt.hash('tech123', 10);
    const technician = userRepository.create({
      username: 'technician',
      email: 'tech@smartmaint.com',
      password: techPassword,
      role: UserRole.TECHNICIAN,
      fullName: 'John Technician',
      isActive: true,
    });
    await userRepository.save(technician);
    console.log('✅ Technician user created');
  }

  // Create default worker
  const workerExists = await userRepository.findOne({ where: { email: 'worker@smartmaint.com' } });
  if (!workerExists) {
    const workerPassword = await bcrypt.hash('worker123', 10);
    const worker = userRepository.create({
      username: 'worker',
      email: 'worker@smartmaint.com',
      password: workerPassword,
      role: UserRole.WORKER,
      fullName: 'Jane Worker',
      isActive: true,
    });
    await userRepository.save(worker);
    console.log('✅ Worker user created');
  }
}
