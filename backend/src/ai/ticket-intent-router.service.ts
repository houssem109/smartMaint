import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import {
  buildTurnRouterPrompt,
  detectTurnRouteHeuristic,
  isTurnRouterEnabled,
  mergeTurnRoutes,
  parseTurnRouterJson,
  type TechoTurnRoute,
  type TurnRouterContext,
} from './ticket-intent-router.util';

@Injectable()
export class TicketIntentRouterService {
  private readonly logger = new Logger(TicketIntentRouterService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {}

  /** Ollama only (Qwen etc.) — never OpenRouter. */
  private getRouterModel(): string {
    return (
      this.configService.get<string>('OLLAMA_ROUTER_MODEL')?.trim() ||
      this.configService.get<string>('OLLAMA_MODEL')?.trim() ||
      'llama3.1'
    );
  }

  async classifyTurn(ctx: TurnRouterContext): Promise<TechoTurnRoute | null> {
    const heuristic = detectTurnRouteHeuristic(ctx);
    if (!isTurnRouterEnabled()) {
      return heuristic;
    }

    if (heuristic && heuristic.confidence >= 0.95) {
      return heuristic;
    }

    try {
      const prompt = buildTurnRouterPrompt(ctx);
      const raw = await this.aiService.chat(
        [
          {
            role: 'system',
            content:
              'You are a intent classifier for a maintenance chatbot. Output valid JSON only. No prose.',
          },
          { role: 'user', content: prompt },
        ],
        { model: this.getRouterModel() },
      );
      const llm = parseTurnRouterJson(raw);
      const merged = mergeTurnRoutes(llm, heuristic);
      if (merged) return merged;
    } catch (e) {
      this.logger.warn(
        `Turn router LLM failed, using heuristics: ${e instanceof Error ? e.message : e}`,
      );
    }

    return heuristic;
  }
}
