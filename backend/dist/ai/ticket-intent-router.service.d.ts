import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { type TechoTurnRoute, type TurnRouterContext } from './ticket-intent-router.util';
export declare class TicketIntentRouterService {
    private readonly aiService;
    private readonly configService;
    private readonly logger;
    constructor(aiService: AiService, configService: ConfigService);
    private getRouterModel;
    classifyTurn(ctx: TurnRouterContext): Promise<TechoTurnRoute | null>;
}
