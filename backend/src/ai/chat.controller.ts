import {
  BadRequestException,
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
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
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

  /** Optional base64 image (raw or `data:image/...;base64,...`). JPEG/PNG/WebP. Max ~4.5 MiB decoded. */
  @IsOptional()
  @IsString()
  @MaxLength(6_500_000)
  imageBase64?: string;

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
    summary:
      'Send a message to Techo (optional ticketId, history, imageBase64 for 10 field photo in chat)',
    description:
      'Returns { reply, ticketId, sources } where sources lists RAG pdf_chunk and knowledge_entry captions used for this turn (12).',
  })
  async sendMessage(@Body() body: ChatMessageDto, @Request() req) {
    const { message, ticketId, history, imageBase64 } = body;
    const user = req.user;

    if (!message || !message.trim()) {
      return { reply: "Please enter a message so I can help you.", ticketId, sources: [] };
    }

    const visionOn = String(process.env.ENABLE_CHAT_IMAGE_VISION ?? 'true').toLowerCase() !== 'false';
    let userMessageContent = message.trim();
    if (imageBase64?.trim() && visionOn) {
      const normalized = this.normalizeChatImageBase64(imageBase64);
      const visionPrompt =
        'A technician sent this photo from the plant floor or machine area. ' +
        'Describe what you see in plain text: equipment, labels, fault codes, damage, wiring, fluids, safety issues. ' +
        'If unreadable, say so briefly.';
      try {
        const visual = await this.aiService.describeImageBase64ForPdf(normalized, visionPrompt);
        userMessageContent =
          `[User attached a photo]\nVisual description (for the assistant):\n${visual}\n\nUser message:\n${message.trim()}`;
      } catch {
        userMessageContent =
          `[User attached a photo — automatic description failed]\n\nUser message:\n${message.trim()}`;
      }
    } else if (imageBase64?.trim() && !visionOn) {
      userMessageContent =
        `[User attached a photo — image vision is disabled on the server]\n\nUser message:\n${message.trim()}`;
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
            .map((r, i) => {
              const cap = r.sourceCaption ? `${r.sourceCaption}\n` : '';
              return `[${i + 1}] ${cap}${truncate(r.text, 1500)}`;
            })
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
              const ph = (k as { photoPath?: string | null }).photoPath?.trim();
              const photoNote = ph ? `Field photo (reference path): ${ph}` : null;
              const parts = [`[${i + 1}] ${title}`, `Problem:\n${problem}`, `Solution:\n${solution}`];
              if (photoNote) parts.push(photoNote);
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
        content: userMessageContent,
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

    const sources = [
      ...ragResults.map((r) => ({
        kind: 'pdf_chunk' as const,
        caption: r.sourceCaption || 'PDF excerpt',
        score: r.score,
        documentId: r.documentId,
        chunkIndex: r.chunkIndex,
      })),
      ...knowledgeEntries.map((k) => ({
        kind: 'knowledge_entry' as const,
        caption: k.title || 'Knowledge entry',
        knowledgeEntryId: k.id,
      })),
    ];

    return { reply, ticketId, sources };
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

  /** Strip data-URL wrapper and enforce decoded size (JPEG/PNG/WebP magic). */
  private normalizeChatImageBase64(raw: string): string {
    const trimmed = raw.trim();
    const dataUrl = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(trimmed);
    const b64 = (dataUrl ? dataUrl[2] : trimmed).replace(/\s/g, '');
    let buf: Buffer;
    try {
      buf = Buffer.from(b64, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 image');
    }
    const max = Math.floor(4.5 * 1024 * 1024);
    if (!buf.length || buf.length > max) {
      throw new BadRequestException(`Image must decode to at most ${max} bytes`);
    }
    const sig = buf.subarray(0, 12);
    const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
    const isJpeg = sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
    const isWebp = sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50;
    if (!isPng && !isJpeg && !isWebp) {
      throw new BadRequestException('Only JPEG, PNG, or WebP images are allowed');
    }
    return b64;
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

