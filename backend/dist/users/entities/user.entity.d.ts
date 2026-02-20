import { Ticket } from '../../tickets/entities/ticket.entity';
export declare enum UserRole {
    WORKER = "worker",
    TECHNICIAN = "technician",
    ADMIN = "admin"
}
export declare class User {
    id: string;
    username: string;
    email: string;
    password: string;
    role: UserRole;
    factoryId: string;
    fullName: string;
    phoneNumber: string;
    isActive: boolean;
    createdTickets: Ticket[];
    assignedTickets: Ticket[];
    createdAt: Date;
    updatedAt: Date;
}
