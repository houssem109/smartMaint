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

  // Create or fix superadmin (single person only)
  let superadmin = await userRepository.findOne({ where: { email: 'superadmin@smartmaint.com' } });
  const superadminPlainPassword = 'superadmin123';
  const superadminPassword = await bcrypt.hash(superadminPlainPassword, 10);
  if (!superadmin) {
    superadmin = userRepository.create({
      username: 'superadmin',
      email: 'superadmin@smartmaint.com',
      password: superadminPassword,
      role: UserRole.SUPERADMIN,
      fullName: 'Super Administrator',
      isActive: true,
    });
    await userRepository.save(superadmin);
    console.log('✅ Superadmin user created');
  } else {
    // Always ensure role, name, active, and password are in a known state
    await userRepository.update(superadmin.id, {
      role: UserRole.SUPERADMIN,
      fullName: 'Super Administrator',
      isActive: true,
      password: superadminPassword,
    });
    console.log('✅ Superadmin user updated and password reset');
  }

  // Create or fix default admin user (NORMAL ADMIN, not superadmin)
  let admin = await userRepository.findOne({ where: { email: 'admin@smartmaint.com' } });
  if (!admin) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    admin = userRepository.create({
      username: 'admin',
      email: 'admin@smartmaint.com',
      password: adminPassword,
      role: UserRole.ADMIN,
      fullName: 'System Admin',
      isActive: true,
    });
    await userRepository.save(admin);
    console.log('✅ Admin (normal admin) user created');
  } else if (admin.role !== UserRole.ADMIN) {
    await userRepository.update(admin.id, { role: UserRole.ADMIN, fullName: 'System Admin' });
    console.log('✅ Admin user role fixed to admin');
  }

  // Create or fix default technician
  let technician = await userRepository.findOne({ where: { email: 'tech@smartmaint.com' } });
  if (!technician) {
    const techPassword = await bcrypt.hash('tech123', 10);
    technician = userRepository.create({
      username: 'technician',
      email: 'tech@smartmaint.com',
      password: techPassword,
      role: UserRole.TECHNICIAN,
      fullName: 'John Technician',
      isActive: true,
    });
    await userRepository.save(technician);
    console.log('✅ Technician user created');
  } else if (technician.role !== UserRole.TECHNICIAN) {
    await userRepository.update(technician.id, { role: UserRole.TECHNICIAN, fullName: 'John Technician' });
    console.log('✅ Technician user role fixed to technician');
  }

  // Additional technicians
  const extraTechnicians = [
    {
      email: 'tech2@smartmaint.com',
      username: 'technician2',
      fullName: 'Alice Technician',
    },
    {
      email: 'tech3@smartmaint.com',
      username: 'technician3',
      fullName: 'Bob Technician',
    },
  ];

  for (const extra of extraTechnicians) {
    let existing = await userRepository.findOne({ where: { email: extra.email } });
    if (!existing) {
      const password = await bcrypt.hash('tech123', 10);
      existing = userRepository.create({
        username: extra.username,
        email: extra.email,
        password,
        role: UserRole.TECHNICIAN,
        fullName: extra.fullName,
        isActive: true,
      });
      await userRepository.save(existing);
      console.log(`✅ Extra technician user created: ${extra.email}`);
    }
  }

  // Create or fix default worker
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
  } else if (worker.role !== UserRole.WORKER) {
    await userRepository.update(worker.id, { role: UserRole.WORKER, fullName: 'Jane Worker' });
    console.log('✅ Worker user role fixed to worker');
  }

  // Additional workers
  const extraWorkers = [
    {
      email: 'worker2@smartmaint.com',
      username: 'worker2',
      fullName: 'Mark Worker',
    },
    {
      email: 'worker3@smartmaint.com',
      username: 'worker3',
      fullName: 'Emma Worker',
    },
  ];

  for (const extra of extraWorkers) {
    let existing = await userRepository.findOne({ where: { email: extra.email } });
    if (!existing) {
      const password = await bcrypt.hash('worker123', 10);
      existing = userRepository.create({
        username: extra.username,
        email: extra.email,
        password,
        role: UserRole.WORKER,
        fullName: extra.fullName,
        isActive: true,
      });
      await userRepository.save(existing);
      console.log(`✅ Extra worker user created: ${extra.email}`);
    }
  }

  // Create sample tickets with problems
  const ticketCount = await ticketRepository.count();
  const targetTotal = 50; // aim for ~50 total example tickets

  // Base sample tickets only when there are no tickets yet
  const shouldCreateBaseSamples = ticketCount === 0 && worker;

  if (worker && (shouldCreateBaseSamples || ticketCount < targetTotal)) {
    const sampleTickets: Partial<Ticket>[] = shouldCreateBaseSamples
      ? [
          {
            title: 'BSOD on production PC - Line 2',
            description:
              'Production computer at Line 2 keeps restarting with blue screen error. Error code: DRIVER_IRQL_NOT_LESS_OR_EQUAL. Happens randomly during shift, usually when running the reporting software.',
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
            description:
              'Motor on conveyor belt B3 is making grinding noise and overheating. Belt speed has dropped noticeably. Need to check bearings and lubrication.',
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
            description:
              'Workstation PC-07 stuck on "Windows is updating" for over 2 hours. Cannot access production software. User needs to log in urgently.',
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
            description:
              'Pressure sensor on Machine A giving erratic readings. Quality control flagged inconsistent output. Sensor may need replacement or calibration.',
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
            description:
              'Loud squealing noise from pump P-12. Suspected bearing failure. Pump has been running 24/7 for 8 months without maintenance.',
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
            title: 'Update user role in database',
            description:
              'Need to change user role from worker to technician for user ID 12345. Update the role field in the users table.',
            category: TicketCategory.TASK,
            subcategory: 'change_database_value',
            priority: TicketPriority.MEDIUM,
            status: TicketStatus.OPEN,
            machine: 'Database',
            area: 'Backend System',
            source: TicketSource.WEB,
            createdById: worker.id,
          },
          {
            title: 'Application crash - ERP system',
            description:
              'ERP software crashes when opening the inventory module. Error message: "Access violation at address 0x0045A2B1". Other modules work fine.',
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
            description:
              'Main circuit breaker for Assembly Zone 2 trips every 30-45 minutes. Started after new equipment was installed last week. Possible overload or wiring issue.',
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
            description:
              'Valve V-8 in the cooling system is leaking. Small puddle forming underneath. Valve may need replacement or seal repair.',
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
            title: 'Remove deprecated API endpoint',
            description:
              'Remove the old /api/v1/tickets endpoint. It has been replaced by /api/tickets. Update all references in the codebase.',
            category: TicketCategory.TASK,
            subcategory: 'remove_data',
            priority: TicketPriority.LOW,
            status: TicketStatus.OPEN,
            machine: 'Backend API',
            area: 'Codebase',
            source: TicketSource.WEB,
            createdById: worker.id,
          },
          {
            title: 'Fix ticket status update bug',
            description:
              'Ticket status update is not working correctly when assigned to technician. Need to fix the update logic in tickets.service.ts.',
            category: TicketCategory.TASK,
            subcategory: 'fix_bug',
            priority: TicketPriority.HIGH,
            status: TicketStatus.OPEN,
            machine: 'Backend Service',
            area: 'Tickets Module',
            source: TicketSource.WEB,
            createdById: worker.id,
          },
          {
            title: 'Add email notification feature',
            description:
              'Implement email notifications when tickets are assigned or status changes. Use the existing email service.',
            category: TicketCategory.TASK,
            subcategory: 'add_feature',
            priority: TicketPriority.MEDIUM,
            status: TicketStatus.OPEN,
            machine: 'Notification System',
            area: 'Backend',
            source: TicketSource.WEB,
            createdById: worker.id,
          },
        ]
      : [];

    // Generate additional synthetic tickets to reach ~100 total
    const technicians = await userRepository.find({
      where: { role: UserRole.TECHNICIAN, isActive: true },
    });
    const workers = await userRepository.find({
      where: { role: UserRole.WORKER, isActive: true },
    });

    const statusCycle = [
      TicketStatus.OPEN,
      TicketStatus.IN_REVIEW,
      TicketStatus.IN_PROGRESS,
      TicketStatus.SOLVED,
      TicketStatus.CLOSED,
    ];
    const priorityCycle = [
      TicketPriority.LOW,
      TicketPriority.MEDIUM,
      TicketPriority.HIGH,
      TicketPriority.CRITICAL,
    ];
    const categoryCycle = [
      TicketCategory.SOFTWARE,
      TicketCategory.HARDWARE,
      TicketCategory.MECHANICAL,
      TicketCategory.ELECTRICAL,
      TicketCategory.PLUMBING,
      TicketCategory.TASK,
    ];

    const extraTickets: Partial<Ticket>[] = [];
    // If we already had tickets, top up to targetTotal; otherwise use sample count as baseline
    const currentCount = shouldCreateBaseSamples ? sampleTickets.length : ticketCount;
    const toGenerate = Math.max(0, targetTotal - currentCount);

    for (let i = 0; i < toGenerate; i++) {
      const workerOwner = workers[i % (workers.length || 1)] || worker;
      const technicianAssignee = technicians.length ? technicians[i % technicians.length] : undefined;
      extraTickets.push({
        title: `Auto-generated ticket #${i + 1}`,
        description: 'Synthetic ticket for demo and dashboard statistics.',
        category: categoryCycle[i % categoryCycle.length],
        subcategory: 'auto_seed',
        priority: priorityCycle[i % priorityCycle.length],
        status: statusCycle[i % statusCycle.length],
        machine: `Machine-${(i % 10) + 1}`,
        area: `Area ${(i % 5) + 1}`,
        source: TicketSource.WEB,
        createdById: workerOwner.id,
        assignedToId: technicianAssignee?.id,
      });
    }

    sampleTickets.push(...extraTickets);

    for (const ticket of sampleTickets) {
      await ticketRepository.save(ticketRepository.create(ticket));
    }
    console.log(`✅ ${sampleTickets.length} sample tickets created/added (total target: ${targetTotal})`);
  }
}
