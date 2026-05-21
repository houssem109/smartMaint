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
    private readonly openRouterApiKey;
    private readonly openRouterModel;
    private readonly openRouterVisionModel;
    private readonly systemPrompt;
    constructor(configService: ConfigService);
    getSystemPrompt(): string;
    chatPdf(messages: ChatMessage[], opts?: {
        model?: string;
    }): Promise<string>;
    chat(messages: ChatMessage[], opts?: {
        model?: string;
    }): Promise<string>;
    describeImageBase64ForChat(imageBase64: string, userPrompt: string, opts?: {
        model?: string;
    }): Promise<string>;
    describeImageBase64ForPdf(imageBase64: string, userPrompt: string, opts?: {
        model?: string;
    }): Promise<string>;
    describeImageBase64(imageBase64: string, userPrompt: string, opts?: {
        model?: string;
    }): Promise<string>;
    private openRouterChatCompletions;
}
export {};
