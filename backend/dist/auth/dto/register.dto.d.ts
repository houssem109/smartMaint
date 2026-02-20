import { UserRole } from '../../users/entities/user.entity';
export declare class RegisterDto {
    username: string;
    email: string;
    password: string;
    fullName?: string;
    role?: UserRole;
}
