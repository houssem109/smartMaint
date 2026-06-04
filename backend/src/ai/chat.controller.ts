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
import {
  buildConversationMemorySummary,
  getChatHistoryMaxTurns,
  mergeChatHistories,
  trimHistoryForModel,
} from './chat-memory.util';
import { OrderTechoService } from '../order-techo/order-techo.service';
import { TicketsService } from '../tickets/tickets.service';
import { RagService } from './rag.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import {
  acceptsEnhancement,
  analyzeTicketCreationIntent,
  buildTicketSummary,
  detectWizardLang,
  buildTestTicketDraft,
  extractTitleFromProblemReport,
  findCreatedTicketInHistory,
  getWizardStepFromHistory,
  isWizardSupersededByCreatedTicket,
  inferCategoryFromText,
  inferPriorityFromText,
  isAwaitingWizardUserInput,
  isBareTicketTrigger,
  isConfirmCreate,
  isTicketWizardActiveInHistory,
  isTicketWizardTrigger,
  isTestTicketRequest,
  isTriggerOnlyPhrase,
  isWizardCancel,
  parseDraftFromSummaryHistory,
  parseMachineAndArea,
  parseStructuredTicketInput,
  sanitizeTicketTitle,
  shouldStartTicketWizard,
  tagWizardReply,
  TicketIntentResult,
  TicketWizardStep,
  TicketWizardSession,
  wantsTicketImprovement,
  wizardAckTitleAskDescription,
  wizardAskAcceptEnhancement,
  wizardAskLocation,
  wizardAskTitle,
  wizardCancelled,
  wizardCreatedReply,
  wizardEnhancementIntro,
  wizardInvalidDescription,
  wizardInvalidLocation,
  wizardInvalidTitle,
  wizardRemindConfirm,
  wizardStartFromProblemReport,
} from './ticket-wizard.util';
import {
  extractTicketInquiryAspect,
  findRecentTicketSearchTermFromHistory,
  extractTicketSearchQuery,
  formatMultipleTicketsReply,
  formatNeedQueryReply,
  formatNoTicketReply,
  formatTicketInquiryReply,
  hasRecentTicketInquiryContext,
  isAwaitingTicketLookupQuery,
  isTicketInquiryFollowUp,
  isTicketInquiryIntent,
  shouldProcessTicketInquiry,
  stripInquiryMarker,
  tagInquiryReply,
} from './ticket-inquiry.util';
import {
  buildActionCancelledReply,
  buildActionConfirmPrompt,
  buildActionErrorReply,
  buildActionSuccessReply,
  buildNoTicketForActionReply,
  isActionCancellation,
  isActionConfirmation,
  isAwaitingTicketActionConfirm,
  isTicketActionIntent,
  parseActionKeyFromHistory,
  parseTicketActionIntent,
  PendingTicketAction,
  shouldProcessTicketAction,
  tagActionConfirmReply,
  stripActionMarker,
} from './ticket-action.util';
import {
  appendMissionDonePrompt,
  buildEndConversationConfirm,
  buildFarewellReply,
  buildMissionContinuesReply,
  isAwaitingMissionDoneConfirm,
  isConversationEndUserMessage,
  isMissionCompleteConfirmation,
  isMissionCompleteDeclined,
  isUserRequestingConversationEnd,
  shouldProcessConversationWrap,
  stripWrapMarker,
  tagWrapReply,
} from './conversation-wrap.util';
import { TicketIntentRouterService } from './ticket-intent-router.service';
import {
  buildRouterClarifyReply,
  routeImpliesTicketAction,
  routeImpliesTicketCreate,
  routeImpliesTicketLookup,
  routeImpliesWizardContinue,
  shouldClarifyInsteadOfLoop,
  type TechoTurnRoute,
} from './ticket-intent-router.util';
import {
  deriveThreadTitleHeuristic,
  isGenericThreadTitle,
  sanitizeThreadTitle,
} from './thread-title.util';
import { suggestThreadTitle } from './thread-title.service';

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

  /** Techo UI conversation tab id — enables server-side history + per-thread order memory. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  threadId?: string;

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
  /** Step-by-step ticket wizard state (per user + thread). */
  private readonly ticketWizardByKey = new Map<
    string,
    { session: TicketWizardSession; updatedAt: number }
  >();

  /** Last ticket the user looked up in chat (follow-ups: "is it open?"). */
  private readonly ticketInquiryContextByKey = new Map<
    string,
    { ticketId: string; title: string; updatedAt: number }
  >();

  /** Pending close/update/delete awaiting user confirmation. */
  private readonly ticketActionByKey = new Map<
    string,
    { action: PendingTicketAction; updatedAt: number }
  >();

  constructor(
    private readonly aiService: AiService,
    private readonly ticketIntentRouter: TicketIntentRouterService,
    private readonly orderTechoService: OrderTechoService,
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
    const { message, ticketId, history, imageBase64, threadId } = body;
    const allowTicketCreation = body.allowTicketCreation !== false;
    const user = req.user;

    if (!message || !message.trim()) {
      return { reply: "Please enter a message so I can help you.", ticketId, sources: [] };
    }

    const clientHistory =
      history?.map((h) => ({
        role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: h.content,
      })) ?? [];
    const serverHistory = threadId
      ? await this.loadThreadHistory(user.id, threadId, getChatHistoryMaxTurns())
      : [];
    const mergedHistory = trimHistoryForModel(mergeChatHistories(clientHistory, serverHistory));

    const ticketWizardKey = this.ticketDraftKey(user.id, threadId);
    const ticketInquiryKey = this.ticketInquiryKey(user.id, threadId);
    const hasCachedInquiry = this.ticketInquiryContextByKey.has(ticketInquiryKey);
    const hasPendingAction = this.ticketActionByKey.has(ticketInquiryKey);
    const cachedTicket = this.ticketInquiryContextByKey.get(ticketInquiryKey);
    const pendingActionEntry = this.ticketActionByKey.get(ticketInquiryKey);
    const wizardEntry = this.ticketWizardByKey.get(ticketWizardKey);

    const turnRoute = await this.ticketIntentRouter.classifyTurn({
      message: message.trim(),
      history: mergedHistory,
      lastTicket: cachedTicket
        ? { id: cachedTicket.ticketId, title: cachedTicket.title }
        : null,
      pendingActionKind: pendingActionEntry?.action.kind ?? null,
      wizardStep:
        wizardEntry?.session.step ?? getWizardStepFromHistory(mergedHistory) ?? null,
      hasCachedTicket: hasCachedInquiry,
    });

    const wizardInProgress =
      !isWizardSupersededByCreatedTicket(mergedHistory) &&
      (this.ticketWizardByKey.has(ticketWizardKey) ||
        isTicketWizardActiveInHistory(mergedHistory) ||
        isAwaitingWizardUserInput(mergedHistory) ||
        routeImpliesWizardContinue(turnRoute));

    const userHistoryText = mergedHistory
      .filter((h) => h.role === 'user')
      .map((h) => h.content ?? '')
      .join('\n');
    const wrapLang = detectWizardLang(message.trim(), userHistoryText);
    const wrapName = this.getFriendlyUserName(user.email);

    // Mission done → farewell + archive thread (before ticket yes/confirm handlers).
    const wrapReply = this.maybeHandleConversationWrap({
      message: message.trim(),
      history: mergedHistory,
      lang: wrapLang,
      name: wrapName,
    });
    if (wrapReply) {
      if (wrapReply.archiveThread) {
        this.ticketInquiryContextByKey.delete(ticketInquiryKey);
        this.ticketActionByKey.delete(ticketInquiryKey);
        this.ticketWizardByKey.delete(ticketWizardKey);
      }
      await this.persistConversation(
        user.id,
        ticketId ?? null,
        message.trim(),
        wrapReply.persistReply ?? wrapReply.reply,
        threadId,
      );
      return {
        reply: wrapReply.reply,
        ticketId,
        sources: [],
        archiveThread: wrapReply.archiveThread,
      };
    }

    // Close / update / delete with confirmation (before lookup loop).
    const earlyAction = await this.maybeHandleTicketAction({
      user,
      message: message.trim(),
      history: mergedHistory,
      threadId,
      turnRoute,
      forceProcess: routeImpliesTicketAction(turnRoute),
    });
    if (earlyAction) {
      this.ticketWizardByKey.delete(ticketWizardKey);
      await this.persistConversation(
        user.id,
        earlyAction.ticketId ?? ticketId ?? null,
        message.trim(),
        earlyAction.persistReply ?? earlyAction.reply,
        threadId,
      );
      return {
        reply: earlyAction.reply,
        ticketId: earlyAction.ticketId ?? ticketId,
        sources: [],
        ticketUpdated: earlyAction.ticketUpdated,
        archiveThread: earlyAction.archiveThread,
      };
    }
    if (
      routeImpliesTicketAction(turnRoute) &&
      cachedTicket &&
      shouldClarifyInsteadOfLoop(turnRoute)
    ) {
      const clarify = buildRouterClarifyReply(turnRoute, wrapLang, cachedTicket);
      await this.persistConversation(user.id, cachedTicket.ticketId, message.trim(), clarify, threadId);
      return { reply: clarify, ticketId: cachedTicket.ticketId, sources: [] };
    }

    // Ticket creation wizard takes priority over lookup when already in progress.
    if (allowTicketCreation && wizardInProgress) {
      const ticketCreation = await this.maybeHandleTicketCreationFlow({
        user,
        message: message.trim(),
        history: mergedHistory,
        threadId,
        turnRoute,
      });
      if (ticketCreation) {
        await this.persistConversation(
          user.id,
          ticketCreation.ticketId ?? ticketId ?? null,
          message.trim(),
          ticketCreation.persistReply ?? ticketCreation.reply,
          threadId,
        );
        return {
          reply: ticketCreation.reply,
          ticketId: ticketCreation.ticketId ?? ticketId,
          sources: [],
          ticketCreated: Boolean(ticketCreation.ticketId),
          ticketWizard: Boolean(ticketCreation.wizardStep),
        };
      }
    }

    if (
      isTicketActionIntent(message.trim()) ||
      routeImpliesTicketAction(turnRoute)
    ) {
      const postWizardAction = await this.maybeHandleTicketAction({
        user,
        message: message.trim(),
        history: mergedHistory,
        threadId,
        turnRoute,
        forceProcess: true,
      });
      if (postWizardAction) {
        this.ticketWizardByKey.delete(ticketWizardKey);
        await this.persistConversation(
          user.id,
          postWizardAction.ticketId ?? ticketId ?? null,
          message.trim(),
          postWizardAction.persistReply ?? postWizardAction.reply,
          threadId,
        );
        return {
          reply: postWizardAction.reply,
          ticketId: postWizardAction.ticketId ?? ticketId,
          sources: [],
          ticketUpdated: postWizardAction.ticketUpdated,
          archiveThread: postWizardAction.archiveThread,
        };
      }
    }

    // Ticket lookup (existing tickets) before create wizard — avoids "HMI frozen" starting a new ticket.
    const earlyInquiry = await this.maybeHandleTicketInquiry({
      user,
      message: message.trim(),
      linkedTicket: null,
      history: mergedHistory,
      threadId,
      turnRoute,
      forceProcess:
        routeImpliesTicketLookup(turnRoute) &&
        !wizardInProgress &&
        !routeImpliesWizardContinue(turnRoute),
    });
    if (earlyInquiry) {
      this.ticketWizardByKey.delete(ticketWizardKey);
      await this.persistConversation(
        user.id,
        earlyInquiry.ticketId ?? ticketId ?? null,
        message.trim(),
        earlyInquiry.persistReply ?? earlyInquiry.reply,
        threadId,
      );
      return {
        reply: earlyInquiry.reply,
        ticketId: earlyInquiry.ticketId ?? ticketId,
        sources: [],
      };
    }

    // Ticket wizard before order mode so "yes create it" is not swallowed by order heuristics.
    if (
      allowTicketCreation &&
      this.shouldEnterTicketCreationFlow(
        message.trim(),
        mergedHistory,
        ticketWizardKey,
        hasCachedInquiry,
        turnRoute,
      )
    ) {
      // Context-aware: explicit ticket request, problem report, or wizard already in progress.
      const ticketCreation = await this.maybeHandleTicketCreationFlow({
        user,
        message: message.trim(),
        history: mergedHistory,
        threadId,
        turnRoute,
      });
      if (ticketCreation) {
        await this.persistConversation(
          user.id,
          ticketCreation.ticketId ?? ticketId ?? null,
          message.trim(),
          ticketCreation.persistReply ?? ticketCreation.reply,
          threadId,
        );
        return {
          reply: ticketCreation.reply,
          ticketId: ticketCreation.ticketId ?? ticketId,
          sources: [],
          ticketCreated: Boolean(ticketCreation.ticketId),
          ticketWizard: Boolean(ticketCreation.wizardStep),
        };
      }
      // Never fall through to generic LLM when user wants a ticket or reports a problem.
      if (shouldStartTicketWizard(message.trim(), mergedHistory)) {
        const userHistoryText = mergedHistory
          .filter((h) => h.role === 'user')
          .map((h) => h.content)
          .join('\n');
        const lang = detectWizardLang(message.trim(), userHistoryText);
        const name = this.getFriendlyUserName(user.email);
        const reply = wizardAskTitle(name, lang);
        const persistReply = tagWizardReply('await_title', reply);
        const session: TicketWizardSession = { step: 'await_title', draft: {}, lang };
        this.ticketWizardByKey.set(ticketWizardKey, { session, updatedAt: Date.now() });
        await this.persistConversation(user.id, ticketId ?? null, message.trim(), persistReply, threadId);
        return { reply, ticketId, sources: [], ticketWizard: true };
      }
    }

    const orderTechoReply = await this.orderTechoService.handleMessage(
      user.id,
      message.trim(),
      mergedHistory,
      threadId,
    );
    if (orderTechoReply) {
      await this.persistConversation(
        user.id,
        ticketId ?? null,
        message.trim(),
        orderTechoReply.reply,
        threadId,
      );
      return {
        reply: orderTechoReply.reply,
        ticketId,
        sources: [],
        orderMode: orderTechoReply.mode,
        orderNumber: orderTechoReply.orderNumber,
        detectedError: orderTechoReply.detectedError,
      };
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

    const listIntentReply = await this.maybeHandleTicketListQuestion({
      user,
      message,
    });
    if (listIntentReply) {
      await this.persistConversation(user.id, effectiveTicketId ?? null, message, listIntentReply, threadId);
      return {
        reply: listIntentReply,
        ticketId: effectiveTicketId,
        sources: [],
      };
    }

    const inquiryReply = await this.maybeHandleTicketInquiry({
      user,
      message: message.trim(),
      linkedTicket,
      history: mergedHistory,
      threadId,
    });
    if (inquiryReply) {
      this.ticketWizardByKey.delete(ticketWizardKey);
      await this.persistConversation(
        user.id,
        inquiryReply.ticketId ?? effectiveTicketId ?? null,
        message.trim(),
        inquiryReply.persistReply ?? inquiryReply.reply,
        threadId,
      );
      return {
        reply: inquiryReply.reply,
        ticketId: inquiryReply.ticketId ?? effectiveTicketId,
        sources: [],
      };
    }

    const systemPrompt = this.aiService.getSystemPrompt();

    type ChatRole = 'system' | 'user' | 'assistant';
    interface ChatMessage {
      role: ChatRole;
      content: string;
    }

    const historyMessages: ChatMessage[] = mergedHistory.map((h) => ({
      role: h.role === 'assistant' ? ('assistant' as ChatRole) : ('user' as ChatRole),
      content: h.content,
    }));

    const memorySummary = buildConversationMemorySummary(mergedHistory);

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
      ...(memorySummary ? [{ role: 'system' as ChatRole, content: memorySummary }] : []),
      ...historyMessages,
      { role: 'system' as ChatRole, content: ragSystemMessage },
      {
        role: 'user',
        content: userMessageContent,
      },
    ];

    const reply = await this.aiService.chat(messages);

    await this.persistConversation(user.id, effectiveTicketId ?? null, message, reply, threadId);

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
    threadId?: string,
  ): Promise<void> {
    const tid = threadId?.trim() || null;
    const userEntry = this.conversationRepository.create({
      ticketId: ticketId ?? null,
      threadId: tid,
      message: userMessage,
      senderType: SenderType.USER,
      senderId: userId,
    });
    const aiEntry = this.conversationRepository.create({
      ticketId: ticketId ?? null,
      threadId: tid,
      message: aiReply,
      senderType: SenderType.AI,
      senderId: null,
    });
    await this.conversationRepository.save([userEntry, aiEntry]);
  }

  private async loadThreadHistory(
    userId: string,
    threadId: string,
    limit: number,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const tid = threadId.trim();
    if (!tid) return [];

    const owned = await this.conversationRepository.exist({
      where: { threadId: tid, senderId: userId, senderType: SenderType.USER },
    });
    if (!owned) return [];

    const rows = await this.conversationRepository.find({
      where: { threadId: tid },
      order: { timestamp: 'ASC' },
      take: Math.min(500, limit * 2),
    });

    const turns = rows
      .map((r) => ({
        role: r.senderType === SenderType.AI ? ('assistant' as const) : ('user' as const),
        content: String(r.message ?? ''),
      }))
      .filter((t) => t.content.trim().length > 0);

    return trimHistoryForModel(turns, limit);
  }

  @Get('thread/:threadId/history')
  @ApiOperation({ summary: 'Load persisted Techo messages for a conversation thread' })
  async threadHistory(@Param('threadId') threadId: string, @Request() req) {
    const turns = await this.loadThreadHistory(req.user.id, threadId, getChatHistoryMaxTurns());
    return { threadId, turns };
  }

  @Get('threads')
  @ApiOperation({ summary: 'List Techo conversation threads for the current user' })
  async listThreads(@Request() req) {
    const userId = req.user.id;

    const rows = await this.conversationRepository
      .createQueryBuilder('c')
      .select('c.threadId', 'threadId')
      .addSelect('MIN(c.timestamp)', 'startedAt')
      .addSelect('MAX(c.timestamp)', 'lastMessageAt')
      .addSelect('COUNT(*)', 'messageCount')
      .where('c.senderId = :userId', { userId })
      .andWhere('c.threadId IS NOT NULL')
      .andWhere("c.threadId <> ''")
      .groupBy('c.threadId')
      .orderBy('MAX(c.timestamp)', 'DESC')
      .limit(100)
      .getRawMany<{
        threadId: string;
        startedAt: Date;
        lastMessageAt: Date;
        messageCount: string;
      }>();

    const threadIds = rows.map((r) => r.threadId).filter(Boolean);
    const titleByThread = new Map<string, string>();

    if (threadIds.length > 0) {
      const msgRows = await this.conversationRepository.find({
        where: { threadId: In(threadIds) },
        order: { timestamp: 'ASC' },
        take: 500,
      });

      const turnsByThread = new Map<string, { role: 'user' | 'assistant'; content: string }[]>();
      for (const row of msgRows) {
        const tid = row.threadId?.trim();
        if (!tid) continue;
        const list = turnsByThread.get(tid) ?? [];
        if (list.length >= 14) continue;
        list.push({
          role: row.senderType === SenderType.AI ? 'assistant' : 'user',
          content: String(row.message ?? ''),
        });
        turnsByThread.set(tid, list);
      }

      for (const tid of threadIds) {
        const turns = turnsByThread.get(tid) ?? [];
        const derived = deriveThreadTitleHeuristic(turns);
        if (derived && !isGenericThreadTitle(derived)) {
          titleByThread.set(tid, derived);
        }
      }
    }

    const threads = rows.map((r) => ({
      threadId: r.threadId,
      title: titleByThread.get(r.threadId) || 'New chat',
      lastMessageAt: new Date(r.lastMessageAt).toISOString(),
      messageCount: Number(r.messageCount) || 0,
    }));

    return { threads };
  }

  @Post('thread/:threadId/suggest-title')
  @ApiOperation({ summary: 'Suggest a short title for a Techo conversation thread' })
  async suggestThreadTitle(@Param('threadId') threadId: string, @Request() req) {
    const turns = await this.loadThreadHistory(req.user.id, threadId, 20);
    const title = await suggestThreadTitle(
      (messages) => this.aiService.chat(messages),
      turns,
    );
    return { threadId, title: title ? sanitizeThreadTitle(title) : null };
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

  private ticketDraftKey(userId: string, threadId?: string): string {
    const tid = threadId?.trim();
    return tid ? `${userId}:${tid}` : userId;
  }

  private wizardReply(
    step: TicketWizardStep,
    text: string,
    extra?: { ticketId?: string },
  ): { reply: string; persistReply: string; wizardStep: TicketWizardStep; ticketId?: string } {
    return {
      reply: text,
      persistReply: tagWizardReply(step, text),
      wizardStep: step,
      ticketId: extra?.ticketId,
    };
  }

  private isTicketCreationConfirmation(message: string, inProgress = false): boolean {
    const t = message.trim().toLowerCase();
    if (
      inProgress &&
      /^(yes|yeah|yep|ye|ok|okay|sure|oui|confirm|confirmed|go ahead|proceed|do it|create it|yes create|créer|valider)/i.test(
        t,
      )
    ) {
      return true;
    }
    return (
      /\b(yes|yeah|yep|ye|ok|okay|sure|confirm|confirmed|go ahead|proceed|do it|create it|please create|oui)\b/.test(
        t,
      ) && /\b(create|ticket|créer|confirme|valider)\b/.test(t)
    );
  }

  private userAskedForTicketInHistory(history?: ChatHistoryItemDto[]): boolean {
    return (history ?? []).some(
      (h) =>
        h.role === 'user' &&
        /create.*ticket|créer.*ticket|open ticket|new ticket|report.*(incident|problem)|signaler|make.*ticket|faire un ticket/i.test(
          h.content ?? '',
        ),
    );
  }

  private isTicketDraftInProgress(history?: ChatHistoryItemDto[]): boolean {
    return isTicketWizardActiveInHistory(history);
  }

  private shouldEnterTicketCreationFlow(
    message: string,
    history?: ChatHistoryItemDto[],
    wizardKey?: string,
    hasCachedInquiry?: boolean,
    turnRoute?: TechoTurnRoute | null,
  ): boolean {
    if (routeImpliesWizardContinue(turnRoute ?? null)) return true;
    if (routeImpliesTicketCreate(turnRoute ?? null)) return true;
    if (isTicketWizardActiveInHistory(history) || isAwaitingWizardUserInput(history)) return true;
    if (shouldProcessTicketInquiry(message, history, hasCachedInquiry)) return false;
    if (isAwaitingMissionDoneConfirm(history)) return false;
    if (isAwaitingTicketLookupQuery(history)) return false;
    if (hasRecentTicketInquiryContext(history) && !isBareTicketTrigger(message) && !isTicketWizardTrigger(message)) {
      return false;
    }
    if (wizardKey && this.ticketWizardByKey.has(wizardKey)) return true;
    if (shouldStartTicketWizard(message, history)) return true;
    if (isConfirmCreate(message) && this.isTicketDraftInProgress(history)) return true;
    if (wantsTicketImprovement(message) && this.isTicketDraftInProgress(history)) return true;
    if (acceptsEnhancement(message) && this.isTicketDraftInProgress(history)) return true;
    if (this.isTicketDraftInProgress(history)) return true;
    return false;
  }

  private shouldUseLlmTicketIntent(message: string): boolean {
    if (String(process.env.TICKET_INTENT_LLM ?? 'true').toLowerCase() === 'false') return false;
    return (
      message.trim().length >= 15 &&
      /\b(problem|issue|broken|machine|line|help|ticket|panne|arrêt|stopped|not work|hmi|fault|alarm)\b/i.test(
        message,
      )
    );
  }

  private async detectTicketIntentWithLlm(
    message: string,
    history: ChatHistoryItemDto[] | undefined,
  ): Promise<TicketIntentResult | null> {
    const recent = (history ?? [])
      .slice(-8)
      .map((h) => `${h.role}: ${h.content}`)
      .join('\n');
    const prompt =
      `Classify the latest user message in a factory maintenance chat.\n` +
      `Should the app start a TICKET CREATION wizard (user reports equipment/plant trouble or wants a ticket logged)?\n` +
      `Reply JSON only: {"start_ticket_wizard":boolean,"entry":"explicit"|"problem_report"|"none"}\n` +
      `Rules:\n` +
      `- true: create/open ticket, report incident, machine down, not working, production stopped, log this issue.\n` +
      `- false: general how-to, manuals, order numbers only, off-topic.\n` +
      `Chat:\n${recent}\n\nLatest user message: ${message}`;
    try {
      const raw = await this.aiService.chat([{ role: 'user', content: prompt }]);
      const parsed = this.safeParseJson(raw);
      if (parsed?.start_ticket_wizard === true) {
        const entry = parsed.entry === 'problem_report' ? 'problem_report' : 'explicit_ticket';
        return {
          kind: entry,
          suggestedTitle: extractTitleFromProblemReport(message),
          confidence: 'medium',
        };
      }
    } catch {
      /* use heuristics only */
    }
    return null;
  }

  private async resolveTicketCreationIntent(
    message: string,
    history?: ChatHistoryItemDto[],
    turnRoute?: TechoTurnRoute | null,
  ): Promise<TicketIntentResult> {
    if (routeImpliesTicketCreate(turnRoute ?? null)) {
      const problemLike =
        message.trim().length >= 20 &&
        /\b(problem|issue|broken|down|stopped|panne|arrêt|fault|alarm|hmi|machine|not work)/i.test(
          message,
        );
      return {
        kind: problemLike ? 'problem_report' : 'explicit_ticket',
        suggestedTitle: extractTitleFromProblemReport(message),
        confidence: 'medium',
      };
    }

    let intent = analyzeTicketCreationIntent(message, history);
    if (intent.kind === 'none' && this.shouldUseLlmTicketIntent(message) && !turnRoute) {
      const llm = await this.detectTicketIntentWithLlm(message, history);
      if (llm) intent = llm;
    }
    return intent;
  }

  private beginWizardFromIntent(
    intent: TicketIntentResult,
    msg: string,
    name: string | undefined,
    lang: 'en' | 'fr',
  ): {
    session: TicketWizardSession;
    reply?: { reply: string; persistReply: string; wizardStep: TicketWizardStep };
  } | null {
    if (intent.kind === 'none' || intent.kind === 'wizard_continue') return null;

    const session: TicketWizardSession = {
      step: 'await_title',
      draft: {},
      lang,
      entryKind: intent.kind === 'problem_report' ? 'problem_report' : 'explicit_ticket',
    };

    if (intent.kind === 'problem_report') {
      const structured = parseStructuredTicketInput(msg);
      const suggested = intent.suggestedTitle
        ? sanitizeTicketTitle(intent.suggestedTitle)
        : undefined;

      if (structured.title || suggested) {
        session.draft.title = structured.title || suggested;
        if (structured.description) session.draft.description = structured.description;
        else if (msg.length >= 35) session.draft.description = msg;
        if (structured.machine) session.draft.machine = structured.machine;
        if (structured.area) session.draft.area = structured.area;

        if (session.draft.description && (session.draft.machine || session.draft.area)) {
          session.step = 'await_confirm';
          this.enrichWizardDraft(session.draft);
          return {
            session,
            reply: this.wizardReply('await_confirm', buildTicketSummary(session.draft, lang)),
          };
        }
        if (session.draft.description) {
          session.step = 'await_location';
          return {
            session,
            reply: this.wizardReply('await_location', wizardAskLocation(lang)),
          };
        }
        session.step = 'await_description';
        return {
          session,
          reply: this.wizardReply(
            'await_description',
            wizardAckTitleAskDescription(name, session.draft.title!, lang),
          ),
        };
      }

      return {
        session,
        reply: this.wizardReply('await_title', wizardStartFromProblemReport(name, lang, msg)),
      };
    }

    if (isBareTicketTrigger(msg) || isTriggerOnlyPhrase(msg)) {
      return { session, reply: this.wizardReply('await_title', wizardAskTitle(name, lang)) };
    }
    return { session };
  }

  private mergeTicketDraft(
    existing: Partial<CreateTicketDto> | undefined,
    next: Partial<CreateTicketDto>,
  ): Partial<CreateTicketDto> {
    return {
      ...existing,
      ...Object.fromEntries(
        Object.entries(next).filter(([, v]) => typeof v === 'string' && v.trim().length > 0),
      ),
    } as Partial<CreateTicketDto>;
  }

  private extractTicketFieldsHeuristic(
    history: ChatHistoryItemDto[] | undefined,
    message: string,
  ): Partial<CreateTicketDto> {
    const blob = [
      ...(history ?? []).filter((h) => h.role === 'user').map((h) => h.content),
      message,
    ].join('\n');
    const title =
      blob.match(/(?:title|titre)\s*:\s*(.+)/i)?.[1]?.trim() ||
      blob.match(/(?:title|titre)\s+is\s+(.+)/i)?.[1]?.trim();
    const description =
      blob.match(/(?:description|détails|details)\s*:\s*([\s\S]+?)(?=\n(?:priority|priorité|machine|area|category|$))/i)?.[1]?.trim() ||
      blob.match(/(?:description|détails|details)\s*:\s*(.+)/i)?.[1]?.trim();
    const machine = blob.match(/(?:machine)\s*:\s*(.+)/i)?.[1]?.trim();
    const area = blob.match(/(?:area|zone)\s*:\s*(.+)/i)?.[1]?.trim();
    const priority = blob.match(/(?:priority|priorité)\s*:\s*(\w+)/i)?.[1]?.trim();
    const category = blob.match(/(?:category|catégorie)\s*:\s*(\w+)/i)?.[1]?.trim();
    return {
      title: title || undefined,
      description: description || undefined,
      machine,
      area,
      priority: priority as TicketPriority | undefined,
      category: category as TicketCategory | undefined,
    };
  }

  /** Build title/description from natural chat (not only "Title:" labels). */
  private extractConversationalTicketFields(
    history: ChatHistoryItemDto[] | undefined,
    message: string,
  ): Partial<CreateTicketDto> {
    const heuristic = this.extractTicketFieldsHeuristic(history, message);
    if (heuristic.title?.trim() && heuristic.description?.trim()) return heuristic;

    const shortConfirm =
      /^(yes|yeah|yep|ye|ok|okay|sure|oui|confirm|confirmed|go ahead|proceed|do it|create it|yes create|créer|valider)\b/i;
    const userMsgs = [
      ...(history ?? []).filter((h) => h.role === 'user').map((h) => String(h.content ?? '').trim()),
      message.trim(),
    ].filter((m) => m.length > 0 && !shortConfirm.test(m));

    const createIdx = userMsgs.findIndex((m) =>
      /create.*ticket|créer.*ticket|open ticket|new ticket|report.*(incident|problem)|signaler|make.*ticket/i.test(
        m,
      ),
    );
    let detailMsgs = createIdx >= 0 ? userMsgs.slice(createIdx + 1) : userMsgs;
    if (detailMsgs.length === 0 && createIdx >= 0) {
      const stripped = userMsgs[createIdx]
        .replace(/^(please\s+)?(create|open|make|créer)\s+(a\s+)?(un\s+)?ticket\s*(for|about|pour)?\s*/i, '')
        .trim();
      if (stripped.length >= 8) detailMsgs = [stripped];
    }

    const assistantBlob = (history ?? [])
      .filter((h) => h.role === 'assistant')
      .map((h) => h.content ?? '')
      .join('\n');
    const fromAssistant = {
      title:
        assistantBlob.match(/(?:title|titre)\s*[:=]\s*["']?([^"'\n]+)/i)?.[1]?.trim() ||
        assistantBlob.match(/\*\*title\*\*\s*[:=]?\s*(.+)/i)?.[1]?.trim(),
      description:
        assistantBlob.match(/(?:description|summary|détails)\s*[:=]\s*["']?([\s\S]+?)(?=\n(?:priority|machine|\*\*|$))/i)?.[1]?.trim() ||
        assistantBlob.match(/\*\*description\*\*\s*[:=]?\s*([\s\S]+?)(?=\n\*\*|$)/i)?.[1]?.trim(),
    };

    const blob = detailMsgs.join('\n').trim();
    if (blob.length < 8) {
      return {
        ...heuristic,
        title: heuristic.title || fromAssistant.title,
        description: heuristic.description || fromAssistant.description,
      };
    }

    const lines = blob.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const title =
      heuristic.title ||
      fromAssistant.title ||
      (lines[0]!.length > 100 ? `${lines[0]!.slice(0, 97)}...` : lines[0]);
    const description =
      heuristic.description || fromAssistant.description || (lines.length > 1 ? lines.slice(1).join('\n') : blob);
    return { ...heuristic, title, description, machine: heuristic.machine, area: heuristic.area };
  }

  private async createTicketFromDraft(
    user: { id: string; email?: string },
    draft: Partial<CreateTicketDto>,
  ): Promise<{ reply: string; ticketId: string }> {
    const title = String(draft.title ?? '').trim();
    const description = String(draft.description ?? '').trim();
    const createDto: CreateTicketDto = {
      title,
      description,
      category: this.normalizeTicketCategory(draft.category),
      priority: this.normalizeTicketPriority(draft.priority),
      source: TicketSource.WEB,
      subcategory:
        typeof draft.subcategory === 'string' ? draft.subcategory.trim() || undefined : undefined,
      machine: typeof draft.machine === 'string' ? draft.machine.trim() || undefined : undefined,
      area: typeof draft.area === 'string' ? draft.area.trim() || undefined : undefined,
    };
    const created = await this.ticketsService.create(createDto, user.id);
    const name = this.getFriendlyUserName(user.email);
    return {
      ticketId: created.id,
      reply:
        `${name ? `${name}, ` : ''}I created ticket "${created.title}" successfully.\n` +
        `Ticket ID: ${created.id}\n` +
        `Priority: ${created.priority}\n` +
        `Category: ${created.category}`,
    };
  }

  private enrichWizardDraft(draft: Partial<CreateTicketDto>): void {
    const title = String(draft.title ?? '');
    const description = String(draft.description ?? '');
    if (!draft.category) draft.category = inferCategoryFromText(title, description);
    if (!draft.priority) draft.priority = inferPriorityFromText(title, description);
  }

  private async suggestTicketEnhancement(session: TicketWizardSession): Promise<string> {
    const { draft, lang } = session;
    const prompt =
      lang === 'fr'
        ? `Tu aides un technicien à améliorer la description d'un ticket maintenance.\n` +
          `Titre: ${draft.title}\nDescription: ${draft.description}\nMachine: ${draft.machine ?? '—'}\nZone: ${draft.area ?? '—'}\n` +
          `Propose 2 à 4 points courts OU un paragraphe amélioré (max 100 mots) pour que le technicien comprenne vite. Pas de JSON.`
        : `You help a maintenance technician improve a ticket description.\n` +
          `Title: ${draft.title}\nDescription: ${draft.description}\nMachine: ${draft.machine ?? '—'}\nArea: ${draft.area ?? '—'}\n` +
          `Give 2-4 short bullet points OR one improved paragraph (max 100 words) so the assigned technician understands quickly. Plain text only.`;
    try {
      const text = await this.aiService.chat([{ role: 'user', content: prompt }]);
      return text.trim().slice(0, 1200);
    } catch {
      return lang === 'fr'
        ? '- Heure exacte du début du problème\n- Symptômes visibles sur l’écran ou la machine\n- Impact production (ligne arrêtée, débit, etc.)'
        : '- Exact time the issue started\n- What you see on the screen or machine\n- Production impact (line stopped, rate, etc.)';
    }
  }

  private recoverWizardSessionFromHistory(
    history: ChatHistoryItemDto[] | undefined,
    message: string,
    lang: 'en' | 'fr',
  ): TicketWizardSession | null {
    if (isWizardSupersededByCreatedTicket(history)) return null;
    if (isTicketActionIntent(message)) return null;
    const assistantText = (history ?? [])
      .filter((h) => h.role === 'assistant')
      .map((h) => h.content ?? '')
      .join('\n');
    const title =
      assistantText.match(/(?:Titre|Title)\s*:\s*(.+)/i)?.[1]?.trim() ||
      parseStructuredTicketInput(message).title;
    const description =
      assistantText.match(/(?:Description)\s*:\s*([\s\S]+?)(?=\n(?:Machine|Area|Zone|Catégorie|Category)|━)/i)?.[1]?.trim();
    const machine = assistantText.match(/(?:Machine)\s*:\s*(.+)/i)?.[1]?.trim();
    const area =
      assistantText.match(/(?:Zone|Area)\s*:\s*(.+)/i)?.[1]?.trim() ||
      assistantText.match(/(?:Area)\s*:\s*(.+)/i)?.[1]?.trim();

    if (assistantText.includes('Ticket summary') || assistantText.includes('Récapitulatif')) {
      return {
        step: 'await_confirm',
        draft: {
          title: title ? sanitizeTicketTitle(title) : undefined,
          description,
          machine: machine && machine !== '—' ? machine : undefined,
          area: area && area !== '—' ? area : undefined,
        },
        lang,
      };
    }
    if (/tell me more|donnez plus de détails|what else should maintenance know/i.test(assistantText)) {
      return { step: 'await_description', draft: { title: title ? sanitizeTicketTitle(title) : undefined }, lang };
    }
    if (/in a few words, what(?:'|')?s going on|en quelques mots/i.test(assistantText)) {
      return { step: 'await_title', draft: {}, lang };
    }
    if (/which machine|quelle machine/i.test(assistantText)) {
      return {
        step: 'await_location',
        draft: { title: title ? sanitizeTicketTitle(title) : undefined, description },
        lang,
      };
    }
    return null;
  }

  private async finalizeWizardTicket(
    user: { id: string; email?: string; role?: string },
    session: TicketWizardSession,
    wizardKey: string,
    threadId?: string,
  ): Promise<{ reply: string; ticketId?: string; persistReply?: string }> {
    const name = this.getFriendlyUserName(user.email);
    this.enrichWizardDraft(session.draft);
    try {
      const created = await this.createTicketFromDraft(user, session.draft);
      this.ticketWizardByKey.delete(wizardKey);
      const ticket = await this.ticketsService.findOne(
        created.ticketId,
        user.id,
        user.role as UserRole,
      );
      const inquiryKey = this.ticketInquiryKey(user.id, threadId);
      this.ticketInquiryContextByKey.set(inquiryKey, {
        ticketId: ticket.id,
        title: ticket.title,
        updatedAt: Date.now(),
      });
      return {
        ticketId: created.ticketId,
        ...this.attachMissionDoneIfTaskComplete(
          wizardCreatedReply(
            name,
            {
              id: ticket.id,
              title: ticket.title,
              priority: String(ticket.priority),
              category: String(ticket.category),
            },
            session.lang,
          ),
          session.lang,
          name,
        ),
      };
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Unknown error';
      return {
        reply:
          session.lang === 'fr'
            ? `Impossible de créer le ticket : ${msg}`
            : `Could not create the ticket: ${msg}`,
      };
    }
  }

  private async maybeHandleTicketCreationFlow(params: {
    user: { id: string; email?: string; role?: string };
    message: string;
    history?: ChatHistoryItemDto[];
    threadId?: string;
    turnRoute?: TechoTurnRoute | null;
  }): Promise<{
    reply: string;
    ticketId?: string;
    persistReply?: string;
    wizardStep?: TicketWizardStep;
  } | null> {
    const { user, message, history, threadId, turnRoute } = params;
    const wizardKey = this.ticketDraftKey(user.id, threadId);
    const ticketInquiryKey = this.ticketInquiryKey(user.id, threadId);
    const hasCachedInquiry = this.ticketInquiryContextByKey.has(ticketInquiryKey);
    if (
      !this.shouldEnterTicketCreationFlow(
        message,
        history,
        wizardKey,
        hasCachedInquiry,
        turnRoute,
      )
    ) {
      return null;
    }

    const userHistoryText = (history ?? [])
      .filter((h) => h.role === 'user')
      .map((h) => h.content ?? '')
      .join('\n');
    const detectedLang = detectWizardLang(message, userHistoryText);
    const name = this.getFriendlyUserName(user.email);
    const msg = message.trim();

    let entry = this.ticketWizardByKey.get(wizardKey);
    const stepFromHistory = getWizardStepFromHistory(history);

    if (!entry && stepFromHistory) {
      entry = {
        session: {
          step: stepFromHistory,
          draft: parseDraftFromSummaryHistory(history),
          lang: detectedLang,
        },
        updatedAt: Date.now(),
      };
      this.ticketWizardByKey.set(wizardKey, entry);
    }

    const intent = await this.resolveTicketCreationIntent(msg, history, turnRoute);
    if (!entry && intent.kind !== 'none' && intent.kind !== 'wizard_continue') {
      const started = this.beginWizardFromIntent(intent, msg, name, detectedLang);
      if (started) {
        entry = { session: started.session, updatedAt: Date.now() };
        this.ticketWizardByKey.set(wizardKey, entry);
        if (started.reply) return started.reply;
      }
    }

    if (!entry) {
      const recovered = this.recoverWizardSessionFromHistory(history, msg, detectedLang);
      if (recovered) {
        entry = { session: recovered, updatedAt: Date.now() };
        this.ticketWizardByKey.set(wizardKey, entry);
      }
    }

    if (!entry) return null;

    const session = entry.session;
    if (!session.lang) session.lang = detectedLang;
    const lang = session.lang;

    if (isWizardCancel(msg)) {
      this.ticketWizardByKey.delete(wizardKey);
      return { reply: wizardCancelled(session.lang), wizardStep: undefined };
    }

    if (isTicketActionIntent(msg)) {
      this.ticketWizardByKey.delete(wizardKey);
      return null;
    }

    const structured = parseStructuredTicketInput(msg);
    const touch = () => this.ticketWizardByKey.set(wizardKey, { session, updatedAt: Date.now() });

    switch (session.step) {
      case 'await_title': {
        if (isTriggerOnlyPhrase(msg)) {
          touch();
          return this.wizardReply('await_title', wizardAskTitle(name, session.lang));
        }
        if (isTestTicketRequest(msg)) {
          Object.assign(session.draft, buildTestTicketDraft());
          session.step = 'await_confirm';
          this.enrichWizardDraft(session.draft);
          touch();
          return this.wizardReply('await_confirm', buildTicketSummary(session.draft, session.lang));
        }
        if (structured.title) {
          session.draft.title = structured.title;
          if (structured.description) session.draft.description = structured.description;
          if (structured.machine) session.draft.machine = structured.machine;
          if (structured.area) session.draft.area = structured.area;
        } else if (/\bdescription\s*:/i.test(msg)) {
          touch();
          const ask =
            session.lang === 'fr'
              ? `${name ? `${name}, ` : ''}Commençons par un titre court — on verra le détail juste après.`
              : `${name ? `${name}, ` : ''}Let's start with a short title first — we'll add details in the next step.`;
          return this.wizardReply('await_title', ask);
        } else {
          const title = sanitizeTicketTitle(msg);
          if (title.length < 3 || isTriggerOnlyPhrase(title)) {
            touch();
            return this.wizardReply('await_title', wizardInvalidTitle(session.lang));
          }
          session.draft.title = title;
        }

        if (session.draft.description && (session.draft.machine || session.draft.area)) {
          session.step = 'await_confirm';
          this.enrichWizardDraft(session.draft);
          touch();
          return this.wizardReply('await_confirm', buildTicketSummary(session.draft, session.lang));
        }
        if (session.draft.description) {
          session.step = 'await_location';
          touch();
          return this.wizardReply('await_location', wizardAskLocation(session.lang));
        }
        session.step = 'await_description';
        touch();
        return this.wizardReply(
          'await_description',
          wizardAckTitleAskDescription(name, session.draft.title!, session.lang),
        );
      }

      case 'await_description': {
        const desc = structured.description || msg;
        if (desc.length < 12) {
          touch();
          return this.wizardReply('await_description', wizardInvalidDescription(session.lang));
        }
        session.draft.description = desc;
        if (structured.machine) session.draft.machine = structured.machine;
        if (structured.area) session.draft.area = structured.area;
        if (session.draft.machine || session.draft.area) {
          session.step = 'await_confirm';
          this.enrichWizardDraft(session.draft);
          touch();
          return this.wizardReply('await_confirm', buildTicketSummary(session.draft, session.lang));
        }
        session.step = 'await_location';
        touch();
        return this.wizardReply('await_location', wizardAskLocation(session.lang));
      }

      case 'await_location': {
        if (isTicketActionIntent(msg)) {
          this.ticketWizardByKey.delete(wizardKey);
          return null;
        }
        const loc = parseMachineAndArea(msg);
        if (!loc.machine && !loc.area) {
          touch();
          return this.wizardReply('await_location', wizardInvalidLocation(session.lang));
        }
        if (loc.machine) session.draft.machine = loc.machine;
        if (loc.area) session.draft.area = loc.area;
        session.step = 'await_confirm';
        this.enrichWizardDraft(session.draft);
        touch();
        return this.wizardReply('await_confirm', buildTicketSummary(session.draft, session.lang));
      }

      case 'await_confirm': {
        if (isTicketActionIntent(msg)) {
          this.ticketWizardByKey.delete(wizardKey);
          return null;
        }
        if (isConfirmCreate(msg)) {
          return this.finalizeWizardTicket(user, session, wizardKey, threadId);
        }
        if (wantsTicketImprovement(msg)) {
          const suggestion = await this.suggestTicketEnhancement(session);
          session.pendingEnhancement = suggestion;
          session.step = 'await_suggestion_accept';
          touch();
          const enhanceText =
            wizardEnhancementIntro(session.lang) + suggestion + wizardAskAcceptEnhancement(session.lang);
          return this.wizardReply('await_suggestion_accept', enhanceText);
        }
        if (msg.length > 12 && !isTicketWizardTrigger(msg) && !isTicketActionIntent(msg)) {
          session.draft.description = `${session.draft.description}\n${msg}`.trim();
          touch();
          return this.wizardReply('await_confirm', buildTicketSummary(session.draft, session.lang));
        }
        touch();
        return this.wizardReply(
          'await_confirm',
          `${wizardRemindConfirm(session.lang)}\n\n${buildTicketSummary(session.draft, session.lang)}`,
        );
      }

      case 'await_suggestion_accept': {
        if (acceptsEnhancement(msg) && session.pendingEnhancement) {
          session.draft.description = `${session.draft.description}\n\n${session.pendingEnhancement}`.trim();
          session.pendingEnhancement = undefined;
          session.step = 'await_confirm';
          touch();
          return this.wizardReply('await_confirm', buildTicketSummary(session.draft, session.lang));
        }
        if (isConfirmCreate(msg)) {
          return this.finalizeWizardTicket(user, session, wizardKey, threadId);
        }
        if (msg.length > 10) {
          session.draft.description = `${session.draft.description}\n${msg}`.trim();
          session.pendingEnhancement = undefined;
          session.step = 'await_confirm';
          touch();
          return this.wizardReply('await_confirm', buildTicketSummary(session.draft, session.lang));
        }
        touch();
        return this.wizardReply('await_suggestion_accept', wizardRemindConfirm(session.lang));
      }

      default:
        return null;
    }
  }

  private maybeHandleConversationWrap(params: {
    message: string;
    history?: ChatHistoryItemDto[];
    lang: 'en' | 'fr';
    name?: string;
  }): { reply: string; persistReply?: string; archiveThread?: boolean } | null {
    const { message, history, lang, name } = params;
    if (!shouldProcessConversationWrap(message, history)) return null;

    if (isAwaitingMissionDoneConfirm(history)) {
      if (
        isMissionCompleteConfirmation(message) ||
        isUserRequestingConversationEnd(message) ||
        isConversationEndUserMessage(message)
      ) {
        const farewell = buildFarewellReply(name, lang);
        return { reply: farewell, archiveThread: true };
      }
      if (isMissionCompleteDeclined(message)) {
        return { reply: buildMissionContinuesReply(lang) };
      }
      return {
        reply:
          lang === 'fr'
            ? 'Répondez « oui » pour terminer ou « non » pour continuer.'
            : 'Reply "yes" to finish or "no" to keep chatting.',
      };
    }

    if (isUserRequestingConversationEnd(message)) {
      const confirm = buildEndConversationConfirm(name, lang);
      return {
        reply: stripWrapMarker(confirm),
        persistReply: tagWrapReply(confirm),
      };
    }

    return null;
  }

  private attachMissionDoneIfTaskComplete(
    reply: string,
    lang: 'en' | 'fr',
    name?: string,
  ): { reply: string; persistReply: string } {
    return appendMissionDonePrompt(reply, lang, name);
  }

  private ticketInquiryKey(userId: string, threadId?: string): string {
    const tid = threadId?.trim();
    return tid ? `${userId}:${tid}` : userId;
  }

  private async resolveTicketForAction(
    user: { id: string; role?: string },
    ctxKey: string,
    message: string,
    history?: ChatHistoryItemDto[],
  ): Promise<Ticket | null> {
    const cached = this.ticketInquiryContextByKey.get(ctxKey);
    if (cached?.ticketId) {
      try {
        return await this.ticketsService.findOne(
          cached.ticketId,
          user.id,
          user.role as UserRole,
        );
      } catch {
        this.ticketInquiryContextByKey.delete(ctxKey);
      }
    }
    const created = findCreatedTicketInHistory(history);
    if (created?.id) {
      try {
        return await this.ticketsService.findOne(
          created.id,
          user.id,
          user.role as UserRole,
        );
      } catch {
        /* fall through */
      }
    }
    const searchQ =
      extractTicketSearchQuery(message, history) ||
      findRecentTicketSearchTermFromHistory(history);
    if (!searchQ) return null;
    const rows = await this.ticketsService.searchAccessibleTickets(
      user.id,
      user.role as UserRole,
      searchQ,
      5,
    );
    if (rows.length !== 1) return null;
    return rows[0]!;
  }

  private async maybeHandleTicketAction(params: {
    user: { id: string; email?: string; role?: string };
    message: string;
    history?: ChatHistoryItemDto[];
    threadId?: string;
    turnRoute?: TechoTurnRoute | null;
    forceProcess?: boolean;
  }): Promise<{
    reply: string;
    ticketId?: string;
    persistReply?: string;
    ticketUpdated?: boolean;
    archiveThread?: boolean;
  } | null> {
    const { user, message, history, threadId, turnRoute, forceProcess } = params;
    const ctxKey = this.ticketInquiryKey(user.id, threadId);
    const hasTicketContext = this.ticketInquiryContextByKey.has(ctxKey);
    const pending = this.ticketActionByKey.get(ctxKey);

    const shouldRun =
      shouldProcessTicketAction(message, history, Boolean(pending), hasTicketContext) ||
      Boolean(
        forceProcess &&
          (hasTicketContext || findCreatedTicketInHistory(history)),
      );

    if (!shouldRun) {
      return null;
    }
    if (isAwaitingMissionDoneConfirm(history) && isMissionCompleteConfirmation(message)) {
      return null;
    }

    const userHistoryText = (history ?? [])
      .filter((h) => h.role === 'user')
      .map((h) => h.content ?? '')
      .join('\n');
    const lang = detectWizardLang(message, userHistoryText);

    if (isActionCancellation(message)) {
      this.ticketActionByKey.delete(ctxKey);
      return { reply: buildActionCancelledReply(lang) };
    }

    const awaitingConfirm = pending || isAwaitingTicketActionConfirm(history);
    if (awaitingConfirm && isActionConfirmation(message)) {
      const action =
        pending?.action ??
        (() => {
          const key = parseActionKeyFromHistory(history);
          return key ? this.ticketActionByKey.get(key)?.action : undefined;
        })();
      if (!action) {
        return {
          reply:
            lang === 'fr'
              ? 'Je ne retrouve plus l’action en attente. Reformulez ce que vous voulez faire.'
              : 'I lost track of the pending action. Please say what you want to do again.',
        };
      }
      try {
        if (action.kind === 'delete') {
          await this.ticketsService.remove(action.ticketId, user.id, user.role as UserRole);
          this.ticketInquiryContextByKey.delete(ctxKey);
        } else {
          const updated = await this.ticketsService.update(
            action.ticketId,
            action.updates,
            user.id,
            user.role as UserRole,
          );
          this.ticketInquiryContextByKey.set(ctxKey, {
            ticketId: updated.id,
            title: updated.title,
            updatedAt: Date.now(),
          });
        }
        this.ticketActionByKey.delete(ctxKey);
        const name = this.getFriendlyUserName(user.email);
        const wrapped = this.attachMissionDoneIfTaskComplete(
          buildActionSuccessReply(action, lang),
          lang,
          name,
        );
        return {
          reply: wrapped.reply,
          persistReply: wrapped.persistReply,
          ticketId: action.ticketId,
          ticketUpdated: true,
        };
      } catch (e: any) {
        this.ticketActionByKey.delete(ctxKey);
        const msg = e?.message ? String(e.message) : 'Unknown error';
        return { reply: buildActionErrorReply(msg, lang) };
      }
    }

    if (awaitingConfirm && !isActionConfirmation(message)) {
      const action = pending?.action;
      if (action) {
        const remind =
          lang === 'fr'
            ? 'Répondez « oui » pour confirmer ou « annuler » pour abandonner.'
            : 'Reply "yes" to confirm or "cancel" to abort.';
        const confirm = buildActionConfirmPrompt(action, lang);
        return {
          reply: `${remind}\n\n${confirm}`,
          persistReply: tagActionConfirmReply(ctxKey, confirm),
          ticketId: action.ticketId,
        };
      }
    }

    let parsed = parseTicketActionIntent(message);
    if (!parsed.kind && turnRoute?.action) {
      parsed = parseTicketActionIntent(`${turnRoute.action} the ticket`);
    }
    if (!parsed.kind) {
      if (hasTicketContext && /\b(delete|remove|close|update|change|open|supprimer|fermer)\b/i.test(message)) {
        const ticket = await this.resolveTicketForAction(user, ctxKey, message, history);
        if (ticket) {
          return {
            reply:
              lang === 'fr'
                ? `Je ne suis pas sûr de ce que vous voulez faire sur « ${ticket.title} ». Dites par exemple « supprime le ticket » ou « ferme le ticket » et je vous demanderai de confirmer.`
                : `I'm not sure what you want to do with "${ticket.title}". Try "delete the ticket" or "close the ticket" and I'll ask you to confirm.`,
            ticketId: ticket.id,
          };
        }
      }
      if (/\b(can't you|cant you|why can't|pourquoi.*pas)\b.*\b(close|fermer|delete|update)\b/i.test(message)) {
        const ticket = await this.resolveTicketForAction(user, ctxKey, message, history);
        if (ticket) {
          return {
            reply:
              lang === 'fr'
                ? `Oui — je peux le faire pour « ${ticket.title} ». Dites par exemple « ferme le ticket » et je vous demanderai de confirmer.`
                : `Yes — I can do that for "${ticket.title}". Say something like "close the ticket" and I'll ask you to confirm.`,
            ticketId: ticket.id,
          };
        }
      }
      return null;
    }

    const ticket = await this.resolveTicketForAction(user, ctxKey, message, history);
    if (!ticket) {
      return { reply: buildNoTicketForActionReply(lang) };
    }

    const action: PendingTicketAction = {
      kind: parsed.kind,
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      updates: parsed.updates,
      lang,
      summary: lang === 'fr' ? parsed.summaryFr : parsed.summaryEn,
    };

    this.ticketActionByKey.set(ctxKey, { action, updatedAt: Date.now() });
    const confirmText = buildActionConfirmPrompt(action, lang);
    return {
      reply: confirmText,
      persistReply: tagActionConfirmReply(ctxKey, confirmText),
      ticketId: ticket.id,
    };
  }

  private async maybeHandleTicketInquiry(params: {
    user: { id: string; email?: string; role?: string };
    message: string;
    linkedTicket: Ticket | null;
    history?: ChatHistoryItemDto[];
    threadId?: string;
    turnRoute?: TechoTurnRoute | null;
    forceProcess?: boolean;
  }): Promise<{ reply: string; ticketId?: string; persistReply?: string } | null> {
    const { user, message, linkedTicket, history, threadId, turnRoute, forceProcess } = params;
    if (isTicketWizardActiveInHistory(history) || isAwaitingWizardUserInput(history)) return null;
    const ctxKey = this.ticketInquiryKey(user.id, threadId);
    const hasCached = this.ticketInquiryContextByKey.has(ctxKey);

    if (!shouldProcessTicketInquiry(message, history, hasCached) && !forceProcess) return null;

    if (
      hasCached &&
      (isTicketActionIntent(message) || isAwaitingTicketActionConfirm(history))
    ) {
      return null;
    }

    const userHistoryText = (history ?? [])
      .filter((h) => h.role === 'user')
      .map((h) => h.content ?? '')
      .join('\n');
    const lang = detectWizardLang(message, userHistoryText);
    const aspect = extractTicketInquiryAspect(message);

    let ticket: Ticket | null = linkedTicket;

    if (!ticket) {
      const cached = this.ticketInquiryContextByKey.get(ctxKey);
      const searchQ =
        turnRoute?.searchQuery ||
        extractTicketSearchQuery(message, history);
      const followUpOnly =
        !searchQ &&
        isTicketInquiryFollowUp(message) &&
        (cached?.ticketId || hasRecentTicketInquiryContext(history));

      if (followUpOnly && cached) {
        try {
          ticket = await this.ticketsService.findOne(
            cached.ticketId,
            user.id,
            user.role as UserRole,
          );
        } catch {
          this.ticketInquiryContextByKey.delete(ctxKey);
        }
      } else if (followUpOnly && !cached) {
        const term = extractTicketSearchQuery(message, history);
        if (term) {
          const rows = await this.ticketsService.searchAccessibleTickets(
            user.id,
            user.role as UserRole,
            term,
            5,
          );
          if (rows.length === 1) ticket = rows[0]!;
        }
      } else if (searchQ) {
        const rows = await this.ticketsService.searchAccessibleTickets(
          user.id,
          user.role as UserRole,
          searchQ,
          5,
        );
        if (rows.length === 0) {
          return { reply: formatNoTicketReply(searchQ, lang) };
        }
        if (rows.length > 1) {
          return { reply: formatMultipleTicketsReply(rows, lang) };
        }
        ticket = rows[0]!;
      }
    }

    if (!ticket) {
      const need = formatNeedQueryReply(lang);
      return { reply: stripInquiryMarker(need), persistReply: need };
    }

    this.ticketInquiryContextByKey.set(ctxKey, {
      ticketId: ticket.id,
      title: ticket.title,
      updatedAt: Date.now(),
    });

    const reply = formatTicketInquiryReply(ticket, aspect, lang);
    return {
      reply,
      persistReply: tagInquiryReply('found', reply),
      ticketId: ticket.id,
    };
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

