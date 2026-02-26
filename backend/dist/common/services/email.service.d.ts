import { ConfigService } from '@nestjs/config';
export declare class EmailService {
    private configService;
    private transporter;
    private readonly logger;
    constructor(configService: ConfigService);
    sendWelcomeEmail(email: string, password: string, fullName: string, username: string): Promise<void>;
}
