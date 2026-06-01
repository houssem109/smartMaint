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
import { CreateTicketDto } from '../tickets/dto/create-ticket.dto';
import {
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketSource,
  TicketStatus,
} from '../tickets/entities/ticket.entity';
import { UserRole } from '../users/entities/user.entity';
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

  @IsOptional()
  allowTicketCreation?: boolean;
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
    const allowTicketCreation = body.allowTicketCreation !== false;
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

    // Resolve ticket context from explicit ticketId or UUID mentioned in message
    let linkedTicket: Ticket | null = null;
    let effectiveTicketId: string | undefined = ticketId;
    if (ticketId) {
      linkedTicket = await this.ticketsService.findOne(ticketId, user.id, user.role);
    } else {
      const ticketIdFromMessage = this.extractTicketIdFromMessage(message);
      if (ticketIdFromMessage) {
        linkedTicket = await this.ticketsService.findOne(ticketIdFromMessage, user.id, user.role);
        effectiveTicketId = linkedTicket.id;
      }
    }

    if (allowTicketCreation) {
      const ticketCreation = await this.maybeHandleTicketCreationFlow({
        user,
        message,
        history,
      });
      if (ticketCreation) {
        await this.persistConversation(
          user.id,
          effectiveTicketId ?? ticketCreation.ticketId ?? null,
          message,
          ticketCreation.reply,
        );
        return {
          reply: ticketCreation.reply,
          ticketId: ticketCreation.ticketId ?? effectiveTicketId,
          sources: [],
        };
      }
    }

    const listIntentReply = await this.maybeHandleTicketListQuestion({
      user,
      message,
    });
    if (listIntentReply) {
      await this.persistConversation(user.id, effectiveTicketId ?? null, message, listIntentReply);
      return {
        reply: listIntentReply,
        ticketId: effectiveTicketId,
        sources: [],
      };
    }

    const statusIntentReply = await this.maybeHandleTicketStatusQuestion({
      user,
      message,
      linkedTicket,
      history,
    });
    if (statusIntentReply) {
      await this.persistConversation(user.id, effectiveTicketId ?? null, message, statusIntentReply);
      return {
        reply: statusIntentReply,
        ticketId: effectiveTicketId,
        sources: [],
      };
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

    const retrievalQuery = linkedTicket
      ? `${message}\n\nTicket title: ${linkedTicket.title}\nTicket description: ${linkedTicket.description}`
      : message;

    const [ragResults, knowledgeEntries] = await Promise.all([
      this.ragService.searchRelevantChunks(retrievalQuery, 6),
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
      linkedTicket ? `Current ticket context:\n${this.buildTicketContext(linkedTicket)}` : null,
      ragContext
        ? `Manual excerpts:\n${ragContext}`
        : null,
      knowledgeContext
        ? `Approved knowledge entries:\n${knowledgeContext}`
        : null,
    ].filter(Boolean) as string[];

    const userContextMessage =
      `Current logged-in user context:\n` +
      `- email: ${user?.email ?? 'unknown'}\n` +
      `- role: ${user?.role ?? 'unknown'}\n` +
      `Address the user naturally when useful (for example by name if known).`;

    const ragSystemMessage = contextBlocks.length
      ? `Retrieved manual excerpts and/or approved knowledge entries follow. Prefer them over guessing; do not invent machine-specific procedures or specs not supported by this text.\n` +
        `If the question is on-topic (plant equipment, maintenance, simple shop-floor PC basics) but this text does not fully cover it, you may provide concise practical guidance from general industrial best practices. Briefly mark when guidance is general and not from a manual.\n\n` +
        `${contextBlocks.join('\n\n')}`
      : `No manual excerpts or knowledge entries were retrieved.\n` +
        `If the question is clearly about plant machines, maintenance, or simple shop-floor equipment/PC basics, you may answer with concise practical best-practice guidance.\n` +
        `If the user frames the question as home, kitchen, cooking, or other non-plant life topics, or anything not grounded in industrial maintenance, decline in one or two neutral sentences (production equipment and SmartMaint only)—do not answer “anyway.”\n` +
        `If the question mixes plant and home: only address it if retrieved context would apply; otherwise decline.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: userContextMessage },
      ...historyMessages,
      { role: 'system' as ChatRole, content: ragSystemMessage },
      {
        role: 'user',
        content: userMessageContent,
      },
    ];

    const reply = await this.aiService.chat(messages);

    await this.persistConversation(user.id, effectiveTicketId ?? null, message, reply);

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

    return { reply, ticketId: effectiveTicketId, sources };
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

  private async persistConversation(
    userId: string,
    ticketId: string | null,
    userMessage: string,
    aiReply: string,
  ): Promise<void> {
    const userEntry = this.conversationRepository.create({
      ticketId: ticketId ?? null,
      message: userMessage,
      senderType: SenderType.USER,
      senderId: userId,
    });
    const aiEntry = this.conversationRepository.create({
      ticketId: ticketId ?? null,
      message: aiReply,
      senderType: SenderType.AI,
      senderId: null,
    });
    await this.conversationRepository.save([userEntry, aiEntry]);
  }

  private extractTicketIdFromMessage(message: string): string | undefined {
    const m = message.match(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    );
    return m?.[0];
  }

  private buildTicketContext(ticket: Ticket): string {
    const lines = [
      `Ticket ID: ${ticket.id}`,
      `Title: ${ticket.title}`,
      `Description: ${ticket.description}`,
      `Status: ${ticket.status}`,
      `Priority: ${ticket.priority}`,
      `Category: ${ticket.category}`,
      ticket.subcategory ? `Subcategory: ${ticket.subcategory}` : null,
      ticket.machine ? `Machine: ${ticket.machine}` : null,
      ticket.area ? `Area: ${ticket.area}` : null,
      ticket.assignedToId ? `Assigned technician id: ${ticket.assignedToId}` : 'Assigned technician id: none',
    ].filter(Boolean) as string[];
    return lines.join('\n');
  }

  private async maybeHandleTicketCreationFlow(params: {
    user: { id: string; email?: string; role?: string };
    message: string;
    history?: ChatHistoryItemDto[];
  }): Promise<{ reply: string; ticketId?: string } | null> {
    const { user, message, history } = params;
    const lower = message.toLowerCase();
    const triggerWords = [
      'create ticket',
      'open ticket',
      'new ticket',
      'submit ticket',
      'raise ticket',
      'make ticket',
      'report incident',
      'problem report',
      'create an issue',
      'creer ticket',
      'créer ticket',
      'ouvrir ticket',
    ];
    const maybeTicketFlow =
      triggerWords.some((w) => lower.includes(w)) ||
      (history ?? []).some((h) =>
        /ticket\s+(details|title|description|priority|category)|before i create/i.test(h.content),
      );
    if (!maybeTicketFlow) return null;

    const recentHistory = (history ?? []).slice(-10);
    const convo = recentHistory
      .map((h) => `${h.role.toUpperCase()}: ${h.content}`)
      .concat(`USER: ${message}`)
      .join('\n');

    const extractionPrompt =
      `You extract ticket-creation intent and fields from a chat.\n` +
      `Return JSON only (no markdown) with this exact schema:\n` +
      `{"intent":"create_ticket"|"other","canCreateNow":boolean,"missingFields":string[],"followUpQuestion":string,"ticket":{"title":string,"description":string,"category":"software"|"hardware"|"electrical"|"mechanical"|"it"|"plumbing"|"task"|"other","priority":"low"|"medium"|"high"|"critical","subcategory":string,"machine":string,"area":string}}\n` +
      `Rules:\n` +
      `- canCreateNow=true only if title and description are both sufficiently clear.\n` +
      `- If user asks to create/open a ticket but details are missing, intent must be create_ticket and provide one concise followUpQuestion.\n` +
      `- Keep missingFields among: title, description, category, priority, machine, area, subcategory.\n` +
      `- If not creating ticket now, set intent="other".\n` +
      `Conversation:\n${convo}`;

    let parsed: any = null;
    try {
      const raw = await this.aiService.chatPdf([{ role: 'user', content: extractionPrompt }], {
        model: process.env.OPENROUTER_MODEL || undefined,
      });
      parsed = this.safeParseJson(raw);
    } catch {
      parsed = null;
    }

    if (!parsed || parsed.intent !== 'create_ticket') return null;

    const draft = (parsed.ticket ?? {}) as Partial<CreateTicketDto>;
    const title = typeof draft.title === 'string' ? draft.title.trim() : '';
    const description = typeof draft.description === 'string' ? draft.description.trim() : '';

    if (!parsed.canCreateNow || !title || !description) {
      const question =
        typeof parsed.followUpQuestion === 'string' && parsed.followUpQuestion.trim().length > 0
          ? parsed.followUpQuestion.trim()
          : 'I can create the ticket for you. What title and detailed problem description should I use?';
      const name = this.getFriendlyUserName(user.email);
      return {
        reply: `${name ? `${name}, ` : ''}Before I create the ticket: ${question}`,
      };
    }

    const category = this.normalizeTicketCategory(draft.category);
    const priority = this.normalizeTicketPriority(draft.priority);
    const createDto: CreateTicketDto = {
      title,
      description,
      category,
      priority,
      source: TicketSource.WEB,
      subcategory: typeof draft.subcategory === 'string' ? draft.subcategory.trim() || undefined : undefined,
      machine: typeof draft.machine === 'string' ? draft.machine.trim() || undefined : undefined,
      area: typeof draft.area === 'string' ? draft.area.trim() || undefined : undefined,
    };

    const created = await this.ticketsService.create(createDto, user.id);
    const name = this.getFriendlyUserName(user.email);
    return {
      reply:
        `${name ? `${name}, ` : ''}I created ticket "${created.title}" successfully.\n` +
        `Ticket ID: ${created.id}\n` +
        `Priority: ${created.priority}\n` +
        `Category: ${created.category}`,
      ticketId: created.id,
    };
  }

  private async maybeHandleTicketStatusQuestion(params: {
    user: { id: string; email?: string; role?: string };
    message: string;
    linkedTicket: Ticket | null;
    history?: ChatHistoryItemDto[];
  }): Promise<string | null> {
    const { user, message, linkedTicket, history } = params;
    if (!this.isTicketStatusQuestion(message)) return null;

    if (linkedTicket) {
      return this.renderTicketStatusReply(linkedTicket);
    }

    const title = this.extractTicketTitleCandidate(message, history);
    if (!title) {
      return 'I can check that for you. Please share the ticket title (or ticket ID) you want me to verify.';
    }

    const rows = await this.ticketsService.findByTitleForRole(
      user.id,
      user.role as UserRole,
      title,
      3,
    );
    if (rows.length === 0) {
      return `I could not find a ticket with title "${title}" in your accessible tickets.`;
    }
    if (rows.length === 1) {
      return this.renderTicketStatusReply(rows[0]);
    }

    const lines = rows.map(
      (t) => `- ${t.title} (${t.id.slice(0, 8)}...) -> ${t.status}`,
    );
    return `I found multiple matching tickets:\n${lines.join('\n')}\nTell me the ticket ID and I will check one exactly.`;
  }

  private async maybeHandleTicketListQuestion(params: {
    user: { id: string; email?: string; role?: string };
    message: string;
  }): Promise<string | null> {
    const { user, message } = params;
    const lower = (message ?? '').toLowerCase();
    const asksList =
      /(show|list|display|give|see)\b/.test(lower) &&
      /(ticket|tickets)\b/.test(lower);
    const asksCount =
      /(count|how many|combien)\b/.test(lower) &&
      /(ticket|tickets)\b/.test(lower);
    const asksMine = /\bmy\b/.test(lower) || /\bmes\b/.test(lower);
    const status = this.extractTicketStatusFromMessage(lower);
    const priority = this.extractTicketPriorityFromMessage(lower);

    if ((!asksList && !asksCount) || !status) return null;

    const rows = await this.ticketsService.findAll(user.id, user.role as UserRole, {
      status,
      ...(priority ? { priority } : {}),
    });
    const filtered = asksMine
      ? rows.filter((t) => t.createdById === user.id || t.assignedToId === user.id)
      : rows;

    if (filtered.length === 0) {
      const scope = asksMine ? 'your' : 'matching';
      const priorityPart = priority ? `${priority} priority ` : '';
      return `I could not find ${scope} ${priorityPart}${status} tickets.`;
    }

    if (asksCount) {
      const scope = asksMine ? 'your' : 'matching';
      const priorityPart = priority ? `${priority} priority ` : '';
      return `You have ${filtered.length} ${scope} ${priorityPart}${status} ticket(s).`;
    }

    const shown = filtered.slice(0, 8);
    const lines = shown.map(
      (t) => `- ${t.title} (${t.id.slice(0, 8)}...) | ${t.status} | ${t.priority}`,
    );
    const scope = asksMine ? 'your' : 'the';
    const priorityPart = priority ? `${priority} priority ` : '';
    const more = filtered.length > shown.length ? `\nAnd ${filtered.length - shown.length} more.` : '';
    return `I found ${filtered.length} ${scope} ${priorityPart}${status} ticket(s):\n${lines.join('\n')}${more}`;
  }

  private extractTicketStatusFromMessage(lowerMessage: string): TicketStatus | null {
    if (/\bopen\b|\bouvert\b/.test(lowerMessage)) return TicketStatus.OPEN;
    if (/\bclosed\b|\bclose\b|\bferme\b|\bfermé\b/.test(lowerMessage)) return TicketStatus.CLOSED;
    if (/\bsolved\b|\br[eé]solu\b/.test(lowerMessage)) return TicketStatus.SOLVED;
    if (/\bin progress\b|\ben cours\b/.test(lowerMessage)) return TicketStatus.IN_PROGRESS;
    if (/\bin review\b|\ben revue\b/.test(lowerMessage)) return TicketStatus.IN_REVIEW;
    return null;
  }

  private extractTicketPriorityFromMessage(lowerMessage: string): TicketPriority | null {
    if (/\bcritical\b|\bcritique\b/.test(lowerMessage)) return TicketPriority.CRITICAL;
    if (/\bhigh\b|\bhaute\b|\belev[ée]\b/.test(lowerMessage)) return TicketPriority.HIGH;
    if (/\bmedium\b|\bmoyenne\b/.test(lowerMessage)) return TicketPriority.MEDIUM;
    if (/\blow\b|\bbasse\b/.test(lowerMessage)) return TicketPriority.LOW;
    return null;
  }

  private isTicketStatusQuestion(message: string): boolean {
    const m = (message ?? '').toLowerCase();
    return (
      (m.includes('ticket') && (m.includes('open') || m.includes('status') || m.includes('closed'))) ||
      /is\s+.*ticket.*open|ticket.*open\s+or\s+not|ticket.*status/i.test(message) ||
      /ticket.*ouvert|statut.*ticket/i.test(message)
    );
  }

  private extractTicketTitleCandidate(message: string, history?: ChatHistoryItemDto[]): string | null {
    const tryExtract = (text: string): string | null => {
      if (!text) return null;
      const patterns = [
        /ticket\s+with\s+title\s+["']?(.+?)["']?$/i,
        /ticket\s+(?:named|called)\s+["']?(.+?)["']?$/i,
        /title\s*[:=]\s*["']?(.+?)["']?$/i,
        /ticket\s+title\s+["']?(.+?)["']?$/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m?.[1]?.trim()) return m[1].trim();
      }
      const bare = text.trim();
      // Accept bare title if user sends only a short plain line
      if (
        bare.length >= 5 &&
        bare.length <= 180 &&
        !/[?]/.test(bare) &&
        !/\b(open|closed|status|show|list|count|create|ticket id)\b/i.test(bare)
      ) {
        return bare.replace(/^["']|["']$/g, '').trim();
      }
      return null;
    };

    const fromCurrent = tryExtract(message);
    if (fromCurrent) return fromCurrent;

    const canUseHistoryTitle =
      /\b(it|this ticket|that ticket|ce ticket|cet ticket)\b/i.test(message) ||
      /\b(open or not|status\??)\b/i.test(message);
    if (!canUseHistoryTitle) {
      return null;
    }

    const hist = (history ?? []).filter((h) => h.role === 'user').slice().reverse();
    for (const h of hist) {
      const t = tryExtract(h.content);
      if (t) return t;
    }
    return null;
  }

  private renderTicketStatusReply(ticket: Ticket): string {
    const assigned = ticket.assignedTo?.fullName || ticket.assignedToId || 'Unassigned';
    return (
      `Yes — I found the ticket "${ticket.title}".\n` +
      `Status: ${ticket.status}\n` +
      `Priority: ${ticket.priority}\n` +
      `Assigned to: ${assigned}`
    );
  }

  private safeParseJson(raw: string): any | null {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced?.[1]) {
        try {
          return JSON.parse(fenced[1].trim());
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private normalizeTicketCategory(value: unknown): TicketCategory {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const allowed = Object.values(TicketCategory);
    return (allowed.includes(v as TicketCategory) ? v : TicketCategory.OTHER) as TicketCategory;
  }

  private normalizeTicketPriority(value: unknown): TicketPriority {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const allowed = Object.values(TicketPriority);
    return (allowed.includes(v as TicketPriority) ? v : TicketPriority.MEDIUM) as TicketPriority;
  }

  private getFriendlyUserName(email?: string): string {
    if (!email) return '';
    const local = email.split('@')[0] || '';
    if (!local) return '';
    return local
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
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

