"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DocumentProgressGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentProgressGateway = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
let DocumentProgressGateway = DocumentProgressGateway_1 = class DocumentProgressGateway {
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.logger = new common_1.Logger(DocumentProgressGateway_1.name);
    }
    handleConnection(client) {
        const token = client.handshake.auth?.token ||
            (typeof client.handshake.query?.token === 'string' ? client.handshake.query.token : undefined);
        if (!token?.trim()) {
            client.disconnect(true);
            return;
        }
        const secret = this.configService.get('JWT_SECRET') || 'your-secret-key';
        try {
            this.jwtService.verify(token, { secret });
        }
        catch {
            this.logger.warn('WebSocket JWT verification failed');
            client.disconnect(true);
        }
    }
    handleSubscribe(client, payload) {
        const documentId = payload?.documentId?.trim();
        if (!documentId)
            return { ok: false, error: 'documentId required' };
        void client.join(this.roomName(documentId));
        return { ok: true };
    }
    handleUnsubscribe(client, payload) {
        const documentId = payload?.documentId?.trim();
        if (!documentId)
            return { ok: false };
        void client.leave(this.roomName(documentId));
        return { ok: true };
    }
    emitDocumentProgress(documentId, patch) {
        if (!this.server)
            return;
        const payload = { documentId, ...patch };
        this.server.to(this.roomName(documentId)).emit('document:progress', payload);
    }
    roomName(documentId) {
        return `doc:${documentId}`;
    }
};
exports.DocumentProgressGateway = DocumentProgressGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], DocumentProgressGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('subscribe'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], DocumentProgressGateway.prototype, "handleSubscribe", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('unsubscribe'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], DocumentProgressGateway.prototype, "handleUnsubscribe", null);
exports.DocumentProgressGateway = DocumentProgressGateway = DocumentProgressGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/documents',
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], DocumentProgressGateway);
//# sourceMappingURL=document-progress.gateway.js.map