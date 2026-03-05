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

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      {
        role: 'user',
        content: message,
      },
    ];

    const reply = await this.aiService.chat(messages);

    // Persist conversation if linked to a ticket
    if (ticketId) {
      const userEntry = this.conversationRepository.create({
        ticketId,
        message,
        senderType: SenderType.USER,
        senderId: user.id,
      });
      const aiEntry = this.conversationRepository.create({
        ticketId,
        message: reply,
        senderType: SenderType.AI,
        senderId: null,
      });
      await this.conversationRepository.save([userEntry, aiEntry]);
    }

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
}

