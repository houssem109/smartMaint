import { UserRole } from '../entities/user.entity';
export declare class CreateUserDto {
    username: string;
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    phoneNumber?: string;
}
