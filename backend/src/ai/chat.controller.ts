import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { TicketsService } from '../tickets/tickets.service';
import { RagService } from './rag.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, SenderType } from '../tickets/entities/conversation.entity';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ChatHistoryItemDto {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  ticketId?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[];
}

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly aiService: AiService,
    private readonly ticketsService: TicketsService,
    private readonly ragService: RagService,
    private readonly knowledgeService: KnowledgeService,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {}

  @Post('message')
  @ApiOperation({
    summary: 'Send a message to Techo (optionally linked to a ticket)',
  })
  async sendMessage(@Body() body: ChatMessageDto, @Request() req) {
    const { message, ticketId, history } = body;
    const user = req.user;

    if (!message || !message.trim()) {
      return { reply: "Please enter a message so I can help you.", ticketId };
    }

    // If ticketId is provided, ensure the user has access to that ticket
    if (ticketId) {
      await this.ticketsService.findOne(ticketId, user.id, user.role);
    }

    const systemPrompt = this.aiService.getSystemPrompt();

    type ChatRole = 'system' | 'user' | 'assistant';
    interface ChatMessage {
      role: ChatRole;
      content: string;
    }

    const historyMessages: ChatMessage[] =
      history?.map((h) => ({
        role: h.role === 'assistant' ? ('assistant' as ChatRole) : ('user' as ChatRole),
        content: h.content,
      })) ?? [];

    const [ragResults, knowledgeEntries] = await Promise.all([
      this.ragService.searchRelevantChunks(message, 6),
      this.knowledgeService.searchRelevantEntries(message, 3),
    ]);

    const truncate = (s: string, max = 1200) =>
      (s ?? '').length > max ? `${String(s).slice(0, max)}…` : String(s ?? '');

    const ragContext =
      ragResults.length > 0
        ? ragResults
            .slice(0, 6)
            .map((r, i) => `[${i + 1}] ${truncate(r.text, 1500)}`)
            .join('\n\n')
        : null;

    const knowledgeContext =
      knowledgeEntries.length > 0
        ? knowledgeEntries
            .slice(0, 3)
            .map((k, i) => {
              const title = truncate(k.title, 140);
              const problem = truncate(k.problemDescription, 1200);
              const solution = truncate(k.solution, 1600);
              return `[${i + 1}] ${title}\nProblem:\n${problem}\nSolution:\n${solution}`;
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
    ].filter(Boolean) as string[];

    const ragSystemMessage = contextBlocks.length
      ? `Retrieved manual excerpts and/or approved knowledge entries follow. Prefer them over guessing; do not invent machine-specific procedures or specs not supported by this text.\n` +
        `If the question is on-topic (plant equipment, maintenance, simple shop-floor PC basics) but this text does not cover it, you may give only short, common-sense reminders—what a technician might say in one breath—not long improvised diagnostics.\n\n` +
        `${contextBlocks.join('\n\n')}`
      : `No manual excerpts or knowledge entries were retrieved.\n` +
        `If the question is clearly about plant machines, maintenance, or simple shop-floor equipment/PC basics, you may answer very briefly with common sense only—no long improvised answers.\n` +
        `If the user frames the question as home, kitchen, cooking, or other non-plant life topics, or anything not grounded in industrial maintenance, decline in one or two neutral sentences (production equipment and SmartMaint only)—do not answer “anyway.”\n` +
        `If the question mixes plant and home: only address it if retrieved context would apply; otherwise decline.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'system' as ChatRole, content: ragSystemMessage },
      {
        role: 'user',
        content: message,
      },
    ];

    const reply = await this.aiService.chat(messages);

    // Persist conversation for this user (with or without ticket)
    const userEntry = this.conversationRepository.create({
      ticketId: ticketId ?? null,
      message,
      senderType: SenderType.USER,
      senderId: user.id,
    });
    const aiEntry = this.conversationRepository.create({
      ticketId: ticketId ?? null,
      message: reply,
      senderType: SenderType.AI,
      senderId: null,
    });
    await this.conversationRepository.save([userEntry, aiEntry]);

    return { reply, ticketId };
  }

  @Get('history/:ticketId')
  @ApiOperation({ summary: 'Get chat history for a ticket' })
  async history(@Param('ticketId') ticketId: string, @Request() req) {
    const user = req.user;
    // Ensure the user can see this ticket
    await this.ticketsService.findOne(ticketId, user.id, user.role);

    const history = await this.conversationRepository.find({
      where: { ticketId },
      order: { timestamp: 'ASC' },
    });

    return history;
  }

  @Get('my-history')
  @ApiOperation({ summary: 'Get all chat messages for current user (any ticket or general chat)' })
  async myHistory(@Request() req) {
    const user = req.user;
    const history = await this.conversationRepository.find({
      where: { senderId: user.id },
      order: { timestamp: 'DESC' },
      take: 200,
    });
    return history;
  }
}

