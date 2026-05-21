import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getOllamaVisionModel } from './ollama-vision.util';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ollamaBaseUrl: string;
  private readonly model: string;
  private readonly openRouterApiKey: string | null;
  private readonly openRouterModel: string;
  private readonly openRouterVisionModel: string | null;
  private readonly systemPrompt: string;

  constructor(private readonly configService: ConfigService) {
    this.ollamaBaseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
    this.model = this.configService.get<string>('OLLAMA_MODEL') || 'llama3.1';
    this.openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY')?.trim() || null;
    this.openRouterModel =
      this.configService.get<string>('OPENROUTER_MODEL') || 'anthropic/claude-3.5-haiku';
    this.openRouterVisionModel =
      this.configService.get<string>('OPENROUTER_VISION_MODEL')?.trim() || null;

    let prompt = '';
    try {
      const promptPath = join(__dirname, 'prompts', 'techo-system.prompt.md');
      prompt = readFileSync(promptPath, 'utf8');
    } catch (e) {
      this.logger.warn('Could not load Techo system prompt file, using fallback prompt.');
      prompt =
        'You are Techo for factories: machines, plant maintenance, SmartMaint. Prefer retrieved manuals/knowledge. Plant/line questions with no retrieval: very short common sense only. Home/kitchen/personal framing with no matching retrieval: do not answer—brief decline.';
    }
    this.systemPrompt = prompt;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * PDF pipeline chat path:
   * - Uses OpenRouter when OPENROUTER_API_KEY is configured
   * - Falls back to local Ollama when key is absent
   */
  async chatPdf(messages: ChatMessage[], opts?: { model?: string }): Promise<string> {
    if (!this.openRouterApiKey) {
      return this.chat(messages, opts);
    }
    const model = (opts?.model && opts.model.trim()) || this.openRouterModel;
    try {
      return await this.openRouterChatCompletions(
        {
          model,
          messages,
          temperature: 0,
        },
        'PDF chat',
      );
    } catch (error) {
      this.logger.error(`PDF chat failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async chat(messages: ChatMessage[], opts?: { model?: string }): Promise<string> {
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

      const data: any = await response.json();
      // Ollama chat response: { message: { role, content }, ... }
      const content = data?.message?.content;
      if (!content || typeof content !== 'string') {
        this.logger.error('Unexpected AI response format');
        throw new Error('Unexpected AI response format');
      }
      return content;
    } catch (error) {
      this.logger.error(`AI chat failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Ollama vision: `messages[].images` = base64 PNG (no data: URL prefix).
   * Model must support vision (e.g. llava:latest, llama3.2-vision, moondream).
   */
  async describeImageBase64ForChat(
    imageBase64: string,
    userPrompt: string,
    opts?: { model?: string },
  ): Promise<string> {
    const model = (opts?.model && opts.model.trim()) || getOllamaVisionModel();
    const body = {
      model,
      messages: [
        {
          role: 'user' as const,
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

      const data: any = await response.json();
      const content = data?.message?.content;
      if (!content || typeof content !== 'string') {
        this.logger.error('Unexpected vision response format');
        throw new Error('Unexpected vision response format');
      }
      return content.trim();
    } catch (error) {
      this.logger.error(`Vision chat failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * PDF vision path:
   * - Uses OpenRouter vision model when OPENROUTER_API_KEY + OPENROUTER_VISION_MODEL are configured
   * - Falls back to local Ollama vision otherwise
   */
  async describeImageBase64ForPdf(
    imageBase64: string,
    userPrompt: string,
    opts?: { model?: string },
  ): Promise<string> {
    const model = (opts?.model && opts.model.trim()) || this.openRouterVisionModel;
    if (!this.openRouterApiKey || !model) {
      return this.describeImageBase64ForChat(imageBase64, userPrompt, {
        model: opts?.model || getOllamaVisionModel(),
      });
    }
    try {
      const content = await this.openRouterChatCompletions(
        {
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
        },
        'PDF vision',
      );
      return content.trim();
    } catch (error) {
      this.logger.warn(
        `OpenRouter vision failed, falling back to Ollama vision: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.describeImageBase64ForChat(imageBase64, userPrompt, {
        model: opts?.model || getOllamaVisionModel(),
      });
    }
  }

  async describeImageBase64(
    imageBase64: string,
    userPrompt: string,
    opts?: { model?: string },
  ): Promise<string> {
    return this.describeImageBase64ForChat(imageBase64, userPrompt, opts);
  }

  private async openRouterChatCompletions(body: any, scope: string): Promise<string> {
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
        const data: any = await response.json();
        const msg = data?.choices?.[0]?.message?.content;
        if (typeof msg === 'string' && msg.trim().length > 0) return msg;
        if (Array.isArray(msg)) {
          const joined = msg
            .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
            .join('')
            .trim();
          if (joined.length > 0) return joined;
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
      this.logger.warn(
        `OpenRouter ${scope} ${response.status} (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    throw new Error(`OpenRouter ${scope} returned an error after retries: ${lastErr}`);
  }
}

