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
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs_1 = require("fs");
const path_1 = require("path");
let AiService = AiService_1 = class AiService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(AiService_1.name);
        this.ollamaBaseUrl =
            this.configService.get('OLLAMA_BASE_URL') || 'http://localhost:11434';
        this.model = this.configService.get('OLLAMA_MODEL') || 'llama3.1';
        let prompt = '';
        try {
            const promptPath = (0, path_1.join)(__dirname, 'prompts', 'techo-system.prompt.md');
            prompt = (0, fs_1.readFileSync)(promptPath, 'utf8');
        }
        catch (e) {
            this.logger.warn('Could not load Techo system prompt file, using fallback prompt.');
            prompt =
                'You are Techo, the SmartMaint maintenance assistant. Only answer about maintenance and SmartMaint. Refuse other topics.';
        }
        this.systemPrompt = prompt;
    }
    getSystemPrompt() {
        return this.systemPrompt;
    }
    async chat(messages) {
        const body = {
            model: this.model,
            messages,
            stream: false,
        };
        try {
            const response = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const text = await response.text();
                this.logger.error(`Ollama error: ${response.status} ${text}`);
                throw new Error('AI service returned an error');
            }
            const data = await response.json();
            const content = data?.message?.content;
            if (!content || typeof content !== 'string') {
                this.logger.error('Unexpected AI response format');
                throw new Error('Unexpected AI response format');
            }
            return content;
        }
        catch (error) {
            this.logger.error(`AI chat failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map