import { AiService } from './ai.service';
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    health(): {
        status: string;
        model: string;
        baseUrl: string;
    };
}
