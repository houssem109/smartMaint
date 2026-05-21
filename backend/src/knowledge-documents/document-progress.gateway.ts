import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export type DocumentProgressPayload = Record<string, unknown> & { documentId: string };

@WebSocketGateway({
  namespace: '/documents',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class DocumentProgressGateway implements OnGatewayConnection {
  private readonly logger = new Logger(DocumentProgressGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      (typeof client.handshake.query?.token === 'string' ? client.handshake.query.token : undefined);
    if (!token?.trim()) {
      client.disconnect(true);
      return;
    }
    const secret = this.configService.get<string>('JWT_SECRET') || 'your-secret-key';
    try {
      this.jwtService.verify(token, { secret });
    } catch {
      this.logger.warn('WebSocket JWT verification failed');
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { documentId?: string }) {
    const documentId = payload?.documentId?.trim();
    if (!documentId) return { ok: false, error: 'documentId required' };
    void client.join(this.roomName(documentId));
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, payload: { documentId?: string }) {
    const documentId = payload?.documentId?.trim();
    if (!documentId) return { ok: false };
    void client.leave(this.roomName(documentId));
    return { ok: true };
  }

  emitDocumentProgress(documentId: string, patch: Record<string, unknown>): void {
    if (!this.server) return;
    const payload: DocumentProgressPayload = { documentId, ...patch };
    this.server.to(this.roomName(documentId)).emit('document:progress', payload);
  }

  private roomName(documentId: string): string {
    return `doc:${documentId}`;
  }
}
