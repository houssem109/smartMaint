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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ticket_entity_1 = require("./entities/ticket.entity");
const user_entity_1 = require("../users/entities/user.entity");
let TicketsService = class TicketsService {
    constructor(ticketsRepository) {
        this.ticketsRepository = ticketsRepository;
    }
    async create(createTicketDto, userId) {
        const ticket = this.ticketsRepository.create({
            ...createTicketDto,
            createdById: userId,
        });
        return this.ticketsRepository.save(ticket);
    }
    async findAll(userId, userRole, filters) {
        const queryBuilder = this.ticketsRepository
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.createdBy', 'createdBy')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.attachments', 'attachments');
        if (userRole === user_entity_1.UserRole.WORKER) {
            queryBuilder.where('ticket.createdById = :userId', { userId });
        }
        else if (userRole === user_entity_1.UserRole.TECHNICIAN) {
        }
        if (filters?.status) {
            queryBuilder.andWhere('ticket.status = :status', { status: filters.status });
        }
        if (filters?.category) {
            queryBuilder.andWhere('ticket.category = :category', { category: filters.category });
        }
        if (filters?.priority) {
            queryBuilder.andWhere('ticket.priority = :priority', { priority: filters.priority });
        }
        if (filters?.assignedToId) {
            queryBuilder.andWhere('ticket.assignedToId = :assignedToId', {
                assignedToId: filters.assignedToId,
            });
        }
        queryBuilder.orderBy('ticket.createdAt', 'DESC');
        return queryBuilder.getMany();
    }
    async findOne(id, userId, userRole) {
        const ticket = await this.ticketsRepository.findOne({
            where: { id },
            relations: ['createdBy', 'assignedTo', 'conversations', 'attachments'],
        });
        if (!ticket) {
            throw new common_1.NotFoundException('Ticket not found');
        }
        if (userRole === user_entity_1.UserRole.WORKER &&
            ticket.createdById !== userId) {
            throw new common_1.ForbiddenException('You can only view your own tickets');
        }
        if (userRole === user_entity_1.UserRole.TECHNICIAN &&
            ticket.createdById !== userId &&
            ticket.assignedToId !== userId) {
            throw new common_1.ForbiddenException('You can only view assigned tickets');
        }
        return ticket;
    }
    async update(id, updateTicketDto, userId, userRole) {
        const ticket = await this.findOne(id, userId, userRole);
        if (userRole === user_entity_1.UserRole.WORKER) {
            if (ticket.createdById !== userId) {
                throw new common_1.ForbiddenException('You can only update your own tickets');
            }
            if (ticket.status !== ticket_entity_1.TicketStatus.OPEN && updateTicketDto.status) {
                throw new common_1.ForbiddenException('You can only update open tickets');
            }
        }
        if (userRole === user_entity_1.UserRole.TECHNICIAN) {
            if (ticket.assignedToId !== userId &&
                ticket.createdById !== userId &&
                updateTicketDto.status) {
                throw new common_1.ForbiddenException('You can only update assigned tickets');
            }
        }
        Object.assign(ticket, updateTicketDto);
        return this.ticketsRepository.save(ticket);
    }
    async remove(id, userId, userRole) {
        const ticket = await this.ticketsRepository.findOne({ where: { id } });
        if (!ticket) {
            throw new common_1.NotFoundException('Ticket not found');
        }
        if (userRole === user_entity_1.UserRole.ADMIN || userRole === user_entity_1.UserRole.SUPERADMIN) {
            await this.ticketsRepository.remove(ticket);
            return;
        }
        if (userRole === user_entity_1.UserRole.WORKER && ticket.createdById === userId) {
            await this.ticketsRepository.remove(ticket);
            return;
        }
        throw new common_1.ForbiddenException('You do not have permission to delete this ticket');
    }
    async assignTicket(ticketId, technicianId, userId, userRole) {
        if (userRole !== user_entity_1.UserRole.ADMIN && userRole !== user_entity_1.UserRole.SUPERADMIN && userRole !== user_entity_1.UserRole.TECHNICIAN) {
            throw new common_1.ForbiddenException('Only admins and technicians can assign tickets');
        }
        const ticket = await this.findOne(ticketId, userId, userRole);
        ticket.assignedToId = technicianId;
        ticket.status = ticket_entity_1.TicketStatus.IN_PROGRESS;
        return this.ticketsRepository.save(ticket);
    }
};
exports.TicketsService = TicketsService;
exports.TicketsService = TicketsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ticket_entity_1.Ticket)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TicketsService);
//# sourceMappingURL=tickets.service.js.map