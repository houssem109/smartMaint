"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TicketIntentRouterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketIntentRouterService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ai_service_1 = require("./ai.service");
const ticket_intent_router_util_1 = require("./ticket-intent-router.util");
let TicketIntentRouterService = TicketIntentRouterService_1 = class TicketIntentRouterService {
    constructor(aiService, configService) {
        this.aiService = aiService;
        this.configService = configService;
        this.logger = new common_1.Logger(TicketIntentRouterService_1.name);
    }
    getRouterModel() {
        return (this.configService.get('OLLAMA_ROUTER_MODEL')?.trim() ||
            this.configService.get('OLLAMA_MODEL')?.trim() ||
            'llama3.1');
    }
    async classifyTurn(ctx) {
        const heuristic = (0, ticket_intent_router_util_1.detectTurnRouteHeuristic)(ctx);
        if (!(0, ticket_intent_router_util_1.isTurnRouterEnabled)()) {
            return heuristic;
        }
        if (heuristic && heuristic.confidence >= 0.95) {
            return heuristic;
        }
        try {
            const prompt = (0, ticket_intent_router_util_1.buildTurnRouterPrompt)(ctx);
            const raw = await this.aiService.chat([
                {
                    role: 'system',
                    content: 'You are a intent classifier for a maintenance chatbot. Output valid JSON only. No prose.',
                },
                { role: 'user', content: prompt },
            ], { model: this.getRouterModel() });
            const llm = (0, ticket_intent_router_util_1.parseTurnRouterJson)(raw);
            const merged = (0, ticket_intent_router_util_1.mergeTurnRoutes)(llm, heuristic);
            if (merged)
                return merged;
        }
        catch (e) {
            this.logger.warn(`Turn router LLM failed, using heuristics: ${e instanceof Error ? e.message : e}`);
        }
        return heuristic;
    }
};
exports.TicketIntentRouterService = TicketIntentRouterService;
exports.TicketIntentRouterService = TicketIntentRouterService = TicketIntentRouterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        config_1.ConfigService])
], TicketIntentRouterService);
//# sourceMappingURL=ticket-intent-router.service.js.map