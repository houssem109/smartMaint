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
const rag_service_1 = require("./rag.service");
const knowledge_service_1 = require("../knowledge/knowledge.service");
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
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(6_500_000),
    __metadata("design:type", String)
], ChatMessageDto.prototype, "imageBase64", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ChatHistoryItemDto),
    __metadata("design:type", Array)
], ChatMessageDto.prototype, "history", void 0);
let ChatController = class ChatController {
    constructor(aiService, ticketsService, ragService, knowledgeService, conversationRepository) {
        this.aiService = aiService;
        this.ticketsService = ticketsService;
        this.ragService = ragService;
        this.knowledgeService = knowledgeService;
        this.conversationRepository = conversationRepository;
    }
    async sendMessage(body, req) {
        const { message, ticketId, history, imageBase64 } = body;
        const user = req.user;
        if (!message || !message.trim()) {
            return { reply: "Please enter a message so I can help you.", ticketId, sources: [] };
        }
        const visionOn = String(process.env.ENABLE_CHAT_IMAGE_VISION ?? 'true').toLowerCase() !== 'false';
        let userMessageContent = message.trim();
        if (imageBase64?.trim() && visionOn) {
            const normalized = this.normalizeChatImageBase64(imageBase64);
            const visionPrompt = 'A technician sent this photo from the plant floor or machine area. ' +
                'Describe what you see in plain text: equipment, labels, fault codes, damage, wiring, fluids, safety issues. ' +
                'If unreadable, say so briefly.';
            try {
                const visual = await this.aiService.describeImageBase64ForPdf(normalized, visionPrompt);
                userMessageContent =
                    `[User attached a photo]\nVisual description (for the assistant):\n${visual}\n\nUser message:\n${message.trim()}`;
            }
            catch {
                userMessageContent =
                    `[User attached a photo — automatic description failed]\n\nUser message:\n${message.trim()}`;
            }
        }
        else if (imageBase64?.trim() && !visionOn) {
            userMessageContent =
                `[User attached a photo — image vision is disabled on the server]\n\nUser message:\n${message.trim()}`;
        }
        if (ticketId) {
            await this.ticketsService.findOne(ticketId, user.id, user.role);
        }
        const systemPrompt = this.aiService.getSystemPrompt();
        const historyMessages = history?.map((h) => ({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: h.content,
        })) ?? [];
        const [ragResults, knowledgeEntries] = await Promise.all([
            this.ragService.searchRelevantChunks(message, 6),
            this.knowledgeService.searchRelevantEntries(message, 3),
        ]);
        const truncate = (s, max = 1200) => (s ?? '').length > max ? `${String(s).slice(0, max)}…` : String(s ?? '');
        const ragContext = ragResults.length > 0
            ? ragResults
                .slice(0, 6)
                .map((r, i) => {
                const cap = r.sourceCaption ? `${r.sourceCaption}\n` : '';
                return `[${i + 1}] ${cap}${truncate(r.text, 1500)}`;
            })
                .join('\n\n')
            : null;
        const knowledgeContext = knowledgeEntries.length > 0
            ? knowledgeEntries
                .slice(0, 3)
                .map((k, i) => {
                const title = truncate(k.title, 140);
                const problem = truncate(k.problemDescription, 1200);
                const solution = truncate(k.solution, 1600);
                const ph = k.photoPath?.trim();
                const photoNote = ph ? `Field photo (reference path): ${ph}` : null;
                const parts = [`[${i + 1}] ${title}`, `Problem:\n${problem}`, `Solution:\n${solution}`];
                if (photoNote)
                    parts.push(photoNote);
                return parts.join('\n');
            })
                .join('\n\n')
            : null;
        const contextBlocks = [
            ragContext
                ? `Manual excerpts:\n${ragContext}`
                : null,
            knowledgeContext
                ? `Approved knowledge entries:\n${knowledgeContext}`
                : null,
        ].filter(Boolean);
        const ragSystemMessage = contextBlocks.length
            ? `Retrieved manual excerpts and/or approved knowledge entries follow. Prefer them over guessing; do not invent machine-specific procedures or specs not supported by this text.\n` +
                `If the question is on-topic (plant equipment, maintenance, simple shop-floor PC basics) but this text does not cover it, you may give only short, common-sense reminders—what a technician might say in one breath—not long improvised diagnostics.\n\n` +
                `${contextBlocks.join('\n\n')}`
            : `No manual excerpts or knowledge entries were retrieved.\n` +
                `If the question is clearly about plant machines, maintenance, or simple shop-floor equipment/PC basics, you may answer very briefly with common sense only—no long improvised answers.\n` +
                `If the user frames the question as home, kitchen, cooking, or other non-plant life topics, or anything not grounded in industrial maintenance, decline in one or two neutral sentences (production equipment and SmartMaint only)—do not answer “anyway.”\n` +
                `If the question mixes plant and home: only address it if retrieved context would apply; otherwise decline.`;
        const messages = [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'system', content: ragSystemMessage },
            {
                role: 'user',
                content: userMessageContent,
            },
        ];
        const reply = await this.aiService.chat(messages);
        const userEntry = this.conversationRepository.create({
            ticketId: ticketId ?? null,
            message,
            senderType: conversation_entity_1.SenderType.USER,
            senderId: user.id,
        });
        const aiEntry = this.conversationRepository.create({
            ticketId: ticketId ?? null,
            message: reply,
            senderType: conversation_entity_1.SenderType.AI,
            senderId: null,
        });
        await this.conversationRepository.save([userEntry, aiEntry]);
        const sources = [
            ...ragResults.map((r) => ({
                kind: 'pdf_chunk',
                caption: r.sourceCaption || 'PDF excerpt',
                score: r.score,
                documentId: r.documentId,
                chunkIndex: r.chunkIndex,
            })),
            ...knowledgeEntries.map((k) => ({
                kind: 'knowledge_entry',
                caption: k.title || 'Knowledge entry',
                knowledgeEntryId: k.id,
            })),
        ];
        return { reply, ticketId, sources };
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
    normalizeChatImageBase64(raw) {
        const trimmed = raw.trim();
        const dataUrl = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(trimmed);
        const b64 = (dataUrl ? dataUrl[2] : trimmed).replace(/\s/g, '');
        let buf;
        try {
            buf = Buffer.from(b64, 'base64');
        }
        catch {
            throw new common_1.BadRequestException('Invalid base64 image');
        }
        const max = Math.floor(4.5 * 1024 * 1024);
        if (!buf.length || buf.length > max) {
            throw new common_1.BadRequestException(`Image must decode to at most ${max} bytes`);
        }
        const sig = buf.subarray(0, 12);
        const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
        const isJpeg = sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
        const isWebp = sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50;
        if (!isPng && !isJpeg && !isWebp) {
            throw new common_1.BadRequestException('Only JPEG, PNG, or WebP images are allowed');
        }
        return b64;
    }
    async myHistory(req) {
        const user = req.user;
        const history = await this.conversationRepository.find({
            where: { senderId: user.id },
            order: { timestamp: 'DESC' },
            take: 200,
        });
        return history;
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)('message'),
    (0, swagger_1.ApiOperation)({
        summary: 'Send a message to Techo (optional ticketId, history, imageBase64 for 10 field photo in chat)',
        description: 'Returns { reply, ticketId, sources } where sources lists RAG pdf_chunk and knowledge_entry captions used for this turn (12).',
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
__decorate([
    (0, common_1.Get)('my-history'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all chat messages for current user (any ticket or general chat)' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "myHistory", null);
exports.ChatController = ChatController = __decorate([
    (0, swagger_1.ApiTags)('Chat'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('chat'),
    __param(4, (0, typeorm_1.InjectRepository)(conversation_entity_1.Conversation)),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        tickets_service_1.TicketsService,
        rag_service_1.RagService,
        knowledge_service_1.KnowledgeService,
        typeorm_2.Repository])
], ChatController);
//# sourceMappingURL=chat.controller.js.map