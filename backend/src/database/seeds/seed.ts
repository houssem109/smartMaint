import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../users/entities/user.entity';
import {
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketSource,
} from '../../tickets/entities/ticket.entity';

export async function seedDatabase(dataSource: DataSource) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  const userRepository = dataSource.getRepository(User);
  const ticketRepository = dataSource.getRepository(Ticket);

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
  let worker = await userRepository.findOne({ where: { email: 'worker@smartmaint.com' } });
  if (!worker) {
    const workerPassword = await bcrypt.hash('worker123', 10);
    worker = userRepository.create({
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

  const technician = await userRepository.findOne({ where: { email: 'tech@smartmaint.com' } });

  // Create sample tickets with problems
  const ticketCount = await ticketRepository.count();
  if (ticketCount === 0 && worker) {
    const sampleTickets: Partial<Ticket>[] = [
      {
        title: 'BSOD on production PC - Line 2',
        description: 'Production computer at Line 2 keeps restarting with blue screen error. Error code: DRIVER_IRQL_NOT_LESS_OR_EQUAL. Happens randomly during shift, usually when running the reporting software.',
        category: TicketCategory.SOFTWARE,
        subcategory: 'bsod',
        priority: TicketPriority.HIGH,
        status: TicketStatus.OPEN,
        machine: 'Production PC #2',
        area: 'Production Line 2',
        source: TicketSource.WEB,
        createdById: worker.id,
        assignedToId: technician?.id,
      },
      {
        title: 'Conveyor belt motor overheating',
        description: 'Motor on conveyor belt B3 is making grinding noise and overheating. Belt speed has dropped noticeably. Need to check bearings and lubrication.',
        category: TicketCategory.HARDWARE,
        subcategory: 'motor',
        priority: TicketPriority.CRITICAL,
        status: TicketStatus.OPEN,
        machine: 'Conveyor Belt B3',
        area: 'Warehouse - Packaging Zone',
        source: TicketSource.WEB,
        createdById: worker.id,
        assignedToId: technician?.id,
      },
      {
        title: 'Windows Update blocking workstation',
        description: 'Workstation PC-07 stuck on "Windows is updating" for over 2 hours. Cannot access production software. User needs to log in urgently.',
        category: TicketCategory.SOFTWARE,
        subcategory: 'windows_update',
        priority: TicketPriority.HIGH,
        status: TicketStatus.OPEN,
        machine: 'PC-07',
        area: 'Production Line 1',
        source: TicketSource.WEB,
        createdById: worker.id,
      },
      {
        title: 'Pressure sensor faulty on Machine A',
        description: 'Pressure sensor on Machine A giving erratic readings. Quality control flagged inconsistent output. Sensor may need replacement or calibration.',
        category: TicketCategory.HARDWARE,
        subcategory: 'sensor',
        priority: TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        machine: 'Machine A',
        area: 'Production Line 1',
        source: TicketSource.WEB,
        createdById: worker.id,
      },
      {
        title: 'Bearing failure - Pump P-12',
        description: 'Loud squealing noise from pump P-12. Suspected bearing failure. Pump has been running 24/7 for 8 months without maintenance.',
        category: TicketCategory.MECHANICAL,
        subcategory: 'bearing',
        priority: TicketPriority.HIGH,
        status: TicketStatus.OPEN,
        machine: 'Pump P-12',
        area: 'Cooling System - Basement',
        source: TicketSource.WEB,
        createdById: worker.id,
      },
      {
        title: 'Scheduled preventive maintenance - Line 3',
        description: 'Quarterly preventive maintenance due for all equipment on Line 3. Includes lubrication, belt inspection, and electrical checks.',
        category: TicketCategory.TASK,
        subcategory: 'preventive_maintenance',
        priority: TicketPriority.LOW,
        status: TicketStatus.OPEN,
        machine: 'Line 3 Equipment',
        area: 'Production Line 3',
        source: TicketSource.WEB,
        createdById: worker.id,
      },
      {
        title: 'Application crash - ERP system',
        description: 'ERP software crashes when opening the inventory module. Error message: "Access violation at address 0x0045A2B1". Other modules work fine.',
        category: TicketCategory.SOFTWARE,
        subcategory: 'app_error',
        priority: TicketPriority.HIGH,
        status: TicketStatus.IN_REVIEW,
        machine: 'N/A',
        area: 'Office - Multiple users',
        source: TicketSource.WEB,
        createdById: worker.id,
        assignedToId: technician?.id,
      },
      {
        title: 'Circuit breaker tripping repeatedly',
        description: 'Main circuit breaker for Assembly Zone 2 trips every 30-45 minutes. Started after new equipment was installed last week. Possible overload or wiring issue.',
        category: TicketCategory.ELECTRICAL,
        subcategory: 'circuit_breaker',
        priority: TicketPriority.CRITICAL,
        status: TicketStatus.OPEN,
        machine: 'Main Panel - Zone 2',
        area: 'Assembly Zone 2',
        source: TicketSource.WEB,
        createdById: worker.id,
      },
      {
        title: 'Water leak - Valve V-8',
        description: 'Valve V-8 in the cooling system is leaking. Small puddle forming underneath. Valve may need replacement or seal repair.',
        category: TicketCategory.PLUMBING,
        subcategory: 'valve',
        priority: TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        machine: 'Valve V-8',
        area: 'Cooling System - Basement',
        source: TicketSource.WEB,
        createdById: worker.id,
      },
      {
        title: 'Monthly inspection - Safety equipment',
        description: 'Monthly inspection of fire extinguishers, emergency exits, and first aid stations. Due by end of week.',
        category: TicketCategory.TASK,
        subcategory: 'inspection',
        priority: TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        machine: 'N/A',
        area: 'All floors',
        source: TicketSource.WEB,
        createdById: worker.id,
      },
    ];

    for (const ticket of sampleTickets) {
      await ticketRepository.save(ticketRepository.create(ticket));
    }
    console.log(`✅ ${sampleTickets.length} sample tickets created`);
  }
}
