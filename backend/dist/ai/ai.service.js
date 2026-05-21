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
const ollama_vision_util_1 = require("./ollama-vision.util");
let AiService = AiService_1 = class AiService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(AiService_1.name);
        this.ollamaBaseUrl =
            this.configService.get('OLLAMA_BASE_URL') || 'http://localhost:11434';
        this.model = this.configService.get('OLLAMA_MODEL') || 'llama3.1';
        this.openRouterApiKey = this.configService.get('OPENROUTER_API_KEY')?.trim() || null;
        this.openRouterModel =
            this.configService.get('OPENROUTER_MODEL') || 'anthropic/claude-3.5-haiku';
        this.openRouterVisionModel =
            this.configService.get('OPENROUTER_VISION_MODEL')?.trim() || null;
        let prompt = '';
        try {
            const promptPath = (0, path_1.join)(__dirname, 'prompts', 'techo-system.prompt.md');
            prompt = (0, fs_1.readFileSync)(promptPath, 'utf8');
        }
        catch (e) {
            this.logger.warn('Could not load Techo system prompt file, using fallback prompt.');
            prompt =
                'You are Techo for factories: machines, plant maintenance, SmartMaint. Prefer retrieved manuals/knowledge. Plant/line questions with no retrieval: very short common sense only. Home/kitchen/personal framing with no matching retrieval: do not answer—brief decline.';
        }
        this.systemPrompt = prompt;
    }
    getSystemPrompt() {
        return this.systemPrompt;
    }
    async chatPdf(messages, opts) {
        if (!this.openRouterApiKey) {
            return this.chat(messages, opts);
        }
        const model = (opts?.model && opts.model.trim()) || this.openRouterModel;
        try {
            return await this.openRouterChatCompletions({
                model,
                messages,
                temperature: 0,
            }, 'PDF chat');
        }
        catch (error) {
            this.logger.error(`PDF chat failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    async chat(messages, opts) {
        const model = (opts?.model && opts.model.trim()) || this.model;
        const body = {
            model,
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
    async describeImageBase64ForChat(imageBase64, userPrompt, opts) {
        const model = (opts?.model && opts.model.trim()) || (0, ollama_vision_util_1.getOllamaVisionModel)();
        const body = {
            model,
            messages: [
                {
                    role: 'user',
                    content: userPrompt,
                    images: [imageBase64],
                },
            ],
            stream: false,
        };
        try {
            const response = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const text = await response.text();
                this.logger.error(`Ollama vision error: ${response.status} ${text}`);
                throw new Error(`Vision model request failed (${response.status})`);
            }
            const data = await response.json();
            const content = data?.message?.content;
            if (!content || typeof content !== 'string') {
                this.logger.error('Unexpected vision response format');
                throw new Error('Unexpected vision response format');
            }
            return content.trim();
        }
        catch (error) {
            this.logger.error(`Vision chat failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    async describeImageBase64ForPdf(imageBase64, userPrompt, opts) {
        const model = (opts?.model && opts.model.trim()) || this.openRouterVisionModel;
        if (!this.openRouterApiKey || !model) {
            return this.describeImageBase64ForChat(imageBase64, userPrompt, {
                model: opts?.model || (0, ollama_vision_util_1.getOllamaVisionModel)(),
            });
        }
        try {
            const content = await this.openRouterChatCompletions({
                model,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: userPrompt },
                            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
                        ],
                    },
                ],
                temperature: 0,
            }, 'PDF vision');
            return content.trim();
        }
        catch (error) {
            this.logger.warn(`OpenRouter vision failed, falling back to Ollama vision: ${error instanceof Error ? error.message : String(error)}`);
            return this.describeImageBase64ForChat(imageBase64, userPrompt, {
                model: opts?.model || (0, ollama_vision_util_1.getOllamaVisionModel)(),
            });
        }
    }
    async describeImageBase64(imageBase64, userPrompt, opts) {
        return this.describeImageBase64ForChat(imageBase64, userPrompt, opts);
    }
    async openRouterChatCompletions(body, scope) {
        if (!this.openRouterApiKey) {
            throw new Error('OpenRouter API key is missing');
        }
        const maxAttempts = 4;
        let lastErr = '';
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.openRouterApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            if (response.ok) {
                const data = await response.json();
                const msg = data?.choices?.[0]?.message?.content;
                if (typeof msg === 'string' && msg.trim().length > 0)
                    return msg;
                if (Array.isArray(msg)) {
                    const joined = msg
                        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
                        .join('')
                        .trim();
                    if (joined.length > 0)
                        return joined;
                }
                throw new Error(`Unexpected OpenRouter ${scope} response format`);
            }
            const text = await response.text().catch(() => '');
            lastErr = `${response.status} ${text}`;
            const retryable = response.status === 429 || response.status === 408 || response.status >= 500;
            if (!retryable || attempt === maxAttempts) {
                this.logger.error(`OpenRouter ${scope} error: ${lastErr}`);
                throw new Error(`OpenRouter ${scope} returned an error`);
            }
            const headerWaitSec = Number(response.headers.get('retry-after') ?? 0);
            const headerWaitMs = Number.isFinite(headerWaitSec) && headerWaitSec > 0 ? headerWaitSec * 1000 : 0;
            const backoffMs = headerWaitMs > 0 ? headerWaitMs : Math.min(8000, 500 * 2 ** (attempt - 1));
            const jitterMs = Math.floor(Math.random() * 250);
            const waitMs = backoffMs + jitterMs;
            this.logger.warn(`OpenRouter ${scope} ${response.status} (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
        throw new Error(`OpenRouter ${scope} returned an error after retries: ${lastErr}`);
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map