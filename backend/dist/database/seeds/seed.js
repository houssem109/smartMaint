"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const bcrypt = require("bcrypt");
const user_entity_1 = require("../../users/entities/user.entity");
async function seedDatabase(dataSource) {
    if (!dataSource.isInitialized) {
        await dataSource.initialize();
    }
    const userRepository = dataSource.getRepository(user_entity_1.User);
    const adminExists = await userRepository.findOne({ where: { email: 'admin@smartmaint.com' } });
    if (!adminExists) {
        const adminPassword = await bcrypt.hash('admin123', 10);
        const admin = userRepository.create({
            username: 'admin',
            email: 'admin@smartmaint.com',
            password: adminPassword,
            role: user_entity_1.UserRole.ADMIN,
            fullName: 'System Administrator',
            isActive: true,
        });
        await userRepository.save(admin);
        console.log('✅ Admin user created');
    }
    const techExists = await userRepository.findOne({ where: { email: 'tech@smartmaint.com' } });
    if (!techExists) {
        const techPassword = await bcrypt.hash('tech123', 10);
        const technician = userRepository.create({
            username: 'technician',
            email: 'tech@smartmaint.com',
            password: techPassword,
            role: user_entity_1.UserRole.TECHNICIAN,
            fullName: 'John Technician',
            isActive: true,
        });
        await userRepository.save(technician);
        console.log('✅ Technician user created');
    }
    const workerExists = await userRepository.findOne({ where: { email: 'worker@smartmaint.com' } });
    if (!workerExists) {
        const workerPassword = await bcrypt.hash('worker123', 10);
        const worker = userRepository.create({
            username: 'worker',
            email: 'worker@smartmaint.com',
            password: workerPassword,
            role: user_entity_1.UserRole.WORKER,
            fullName: 'Jane Worker',
            isActive: true,
        });
        await userRepository.save(worker);
        console.log('✅ Worker user created');
    }
}
//# sourceMappingURL=seed.js.map