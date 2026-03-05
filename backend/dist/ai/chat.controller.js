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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const ai_service_1 = require("./ai.service");
const tickets_service_1 = require("../tickets/tickets.service");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const conversation_entity_1 = require("../tickets/entities/conversation.entity");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ChatHistoryItemDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChatHistoryItemDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ChatHistoryItemDto.prototype, "content", void 0);
class ChatMessageDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ChatMessageDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ChatMessageDto.prototype, "ticketId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ChatHistoryItemDto),
    __metadata("design:type", Array)
], ChatMessageDto.prototype, "history", void 0);
let ChatController = class ChatController {
    constructor(aiService, ticketsService, conversationRepository) {
        this.aiService = aiService;
        this.ticketsService = ticketsService;
        this.conversationRepository = conversationRepository;
    }
    async sendMessage(body, req) {
        const { message, ticketId, history } = body;
        const user = req.user;
        if (!message || !message.trim()) {
            return { reply: "Please enter a message so I can help you.", ticketId };
        }
        if (ticketId) {
            await this.ticketsService.findOne(ticketId, user.id, user.role);
        }
        const systemPrompt = this.aiService.getSystemPrompt();
        const historyMessages = history?.map((h) => ({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: h.content,
        })) ?? [];
        const messages = [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            {
                role: 'user',
                content: message,
            },
        ];
        const reply = await this.aiService.chat(messages);
        if (ticketId) {
            const userEntry = this.conversationRepository.create({
                ticketId,
                message,
                senderType: conversation_entity_1.SenderType.USER,
                senderId: user.id,
            });
            const aiEntry = this.conversationRepository.create({
                ticketId,
                message: reply,
                senderType: conversation_entity_1.SenderType.AI,
                senderId: null,
            });
            await this.conversationRepository.save([userEntry, aiEntry]);
        }
        return { reply, ticketId };
    }
    async history(ticketId, req) {
        const user = req.user;
        await this.ticketsService.findOne(ticketId, user.id, user.role);
        const history = await this.conversationRepository.find({
            where: { ticketId },
            order: { timestamp: 'ASC' },
        });
        return history;
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)('message'),
    (0, swagger_1.ApiOperation)({
        summary: 'Send a message to Techo (optionally linked to a ticket)',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ChatMessageDto, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)('history/:ticketId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get chat history for a ticket' }),
    __param(0, (0, common_1.Param)('ticketId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "history", null);
exports.ChatController = ChatController = __decorate([
    (0, swagger_1.ApiTags)('Chat'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('chat'),
    __param(2, (0, typeorm_1.InjectRepository)(conversation_entity_1.Conversation)),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        tickets_service_1.TicketsService,
        typeorm_2.Repository])
], ChatController);
//# sourceMappingURL=chat.controller.js.map