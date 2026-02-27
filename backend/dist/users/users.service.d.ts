import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
export declare class UsersService {
    private usersRepository;
    private auditLogRepository;
    constructor(usersRepository: Repository<User>, auditLogRepository: Repository<AuditLog>);
    create(createUserDto: Partial<User>): Promise<User>;
    findAll(): Promise<User[]>;
    findOne(id: string): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    update(id: string, updateData: Partial<User>): Promise<User>;
    remove(id: string): Promise<void>;
    findTechnicians(): Promise<User[]>;
    restore(id: string, currentUserRole: UserRole): Promise<User>;
    private logUserAction;
}
