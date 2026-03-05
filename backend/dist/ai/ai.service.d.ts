import { ConfigService } from '@nestjs/config';
interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export declare class AiService {
    private readonly configService;
    private readonly logger;
    private readonly ollamaBaseUrl;
    private readonly model;
    private readonly systemPrompt;
    constructor(configService: ConfigService);
    getSystemPrompt(): string;
    chat(messages: ChatMessage[]): Promise<string>;
}
export {};
