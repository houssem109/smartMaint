import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { EmailService } from '../common/services/email.service';
export declare class UsersController {
    private readonly usersService;
    private readonly emailService;
    constructor(usersService: UsersService, emailService: EmailService);
    create(req: any, createUserDto: CreateUserDto): Promise<import("./entities/user.entity").User>;
    findAll(): Promise<import("./entities/user.entity").User[]>;
    findTechnicians(): Promise<import("./entities/user.entity").User[]>;
    getProfile(req: any): Promise<import("./entities/user.entity").User>;
    updateMe(req: any, body: {
        fullName?: string;
        username?: string;
        phoneNumber?: string;
        password?: string;
    }): Promise<import("./entities/user.entity").User>;
    findOne(id: string): Promise<import("./entities/user.entity").User>;
    update(req: any, id: string, updateData: any): Promise<import("./entities/user.entity").User>;
    remove(req: any, id: string): Promise<void>;
}
