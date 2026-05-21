import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export type DocumentProgressPayload = Record<string, unknown> & {
    documentId: string;
};
export declare class DocumentProgressGateway implements OnGatewayConnection {
    private readonly jwtService;
    private readonly configService;
    private readonly logger;
    server: Server;
    constructor(jwtService: JwtService, configService: ConfigService);
    handleConnection(client: Socket): void;
    handleSubscribe(client: Socket, payload: {
        documentId?: string;
    }): {
        ok: boolean;
        error: string;
    } | {
        ok: boolean;
        error?: undefined;
    };
    handleUnsubscribe(client: Socket, payload: {
        documentId?: string;
    }): {
        ok: boolean;
    };
    emitDocumentProgress(documentId: string, patch: Record<string, unknown>): void;
    private roomName;
}
