import { AiService } from '../ai/ai.service';
import { OrderErrorCode } from './order-errors';
import { OrderDataService } from './order-data.service';
import { OrderRuleEngineService } from './order-rule-engine.service';
export interface OrderChatHistoryItem {
    role: 'user' | 'assistant';
    content: string;
}
export interface OrderTechoReply {
    reply: string;
    mode: 'order_data' | 'order_wizard' | 'order_wizard_complete' | 'order_facts';
    orderNumber?: string;
    detectedError?: OrderErrorCode;
}
export declare class OrderTechoService {
    private readonly data;
    private readonly rules;
    private readonly ai;
    private readonly logger;
    private readonly wizardByUser;
    private readonly orderContextByUser;
    private readonly explainPrompt;
    private readonly fallbackPrompt;
    constructor(data: OrderDataService, rules: OrderRuleEngineService, ai: AiService);
    handleMessage(userId: string, message: string, history?: OrderChatHistoryItem[], threadId?: string): Promise<OrderTechoReply | null>;
    private contextKey;
    private setOrderContext;
    private getOrderContext;
    private resolveOrderNumber;
    private extractOrderFromHistory;
    private isOrderFollowUp;
    private needsFullDiagnosis;
    private answerOrderFacts;
    private inferFactField;
    private handleMode1;
    private detectReplyLanguage;
    private wizardQuestion;
    private buildMode1Context;
    private explainWithLlm;
    private fallbackExplain;
    private advanceWizard;
    private handleMode2Complete;
    private heuristicMode2;
    extractOrderNumber(message: string): string | null;
    private loadPrompt;
}
