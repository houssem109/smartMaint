import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check AI service health' })
  health() {
    // For now just return configuration info; a real healthcheck to Ollama can be added later.
    return {
      status: 'ok',
      model: process.env.OLLAMA_MODEL || 'llama3.1',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    };
  }
}

