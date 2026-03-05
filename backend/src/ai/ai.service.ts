import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ollamaBaseUrl: string;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor(private readonly configService: ConfigService) {
    this.ollamaBaseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
    this.model = this.configService.get<string>('OLLAMA_MODEL') || 'llama3.1';

    let prompt = '';
    try {
      const promptPath = join(__dirname, 'prompts', 'techo-system.prompt.md');
      prompt = readFileSync(promptPath, 'utf8');
    } catch (e) {
      this.logger.warn('Could not load Techo system prompt file, using fallback prompt.');
      prompt =
        'You are Techo, the SmartMaint maintenance assistant. Only answer about maintenance and SmartMaint. Refuse other topics.';
    }
    this.systemPrompt = prompt;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
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
}

