import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private usersService;
    private jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    validateUser(email: string, password: string): Promise<any>;
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: any;
            email: any;
            username: any;
            role: any;
            fullName: any;
        };
    }>;
    register(registerDto: RegisterDto): Promise<{
        id: string;
        username: string;
        email: string;
        role: import("../users/entities/user.entity").UserRole;
        factoryId: string;
        fullName: string;
        phoneNumber: string;
        isActive: boolean;
        createdTickets: import("../tickets/entities/ticket.entity").Ticket[];
        assignedTickets: import("../tickets/entities/ticket.entity").Ticket[];
        createdAt: Date;
        updatedAt: Date;
    }>;
}
