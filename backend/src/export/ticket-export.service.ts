import { Injectable, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Ticket, TicketStatus } from '../tickets/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import ExcelJS from 'exceljs';

const RESOLVED_STATUSES: TicketStatus[] = [TicketStatus.SOLVED, TicketStatus.CLOSED];

export type TicketsExportQuery = {
  format?: 'xlsx' | 'csv';
  from?: string;
  to?: string;
  status?: TicketStatus;
  category?: string;
};

@Injectable()
export class TicketExportService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  private dispositionFilename(base: string): string {
    const safe = base.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    return `attachment; filename="${safe}"`;
  }

  private buildFilename(query: TicketsExportQuery, format: 'csv' | 'xlsx'): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const fromPart = query.from?.trim() ? query.from.trim().slice(0, 10) : 'all';
    const toPart = query.to?.trim() ? query.to.trim().slice(0, 10) : 'all';
    return `tickets_${fromPart}_${toPart}_${stamp}.${format}`;
  }

  private userLabel(u?: User | null): string {
    if (!u) return '';
    return u.fullName?.trim() || u.username?.trim() || u.email?.trim() || '';
  }

  private isResolved(status: TicketStatus): boolean {
    return RESOLVED_STATUSES.includes(status);
  }

  private applyDateFilters(
    qb: ReturnType<Repository<Ticket>['createQueryBuilder']>,
    query: TicketsExportQuery,
  ): void {
    const fromRaw = query.from?.trim();
    const toRaw = query.to?.trim();
    if (fromRaw && toRaw) {
      const from = new Date(fromRaw);
      const to = new Date(toRaw);
      if (!Number.isNaN(+from) && !Number.isNaN(+to)) {
        qb.andWhere({ createdAt: Between(from, to) });
      }
    } else if (fromRaw) {
      const from = new Date(fromRaw);
      if (!Number.isNaN(+from)) {
        qb.andWhere('ticket.createdAt >= :from', { from });
      }
    } else if (toRaw) {
      const to = new Date(toRaw);
      if (!Number.isNaN(+to)) {
        const end = new Date(to);
        end.setUTCHours(23, 59, 59, 999);
        qb.andWhere('ticket.createdAt <= :toEnd', { toEnd: end });
      }
    }
  }

  private async resolveResolverLabels(
    tickets: Ticket[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const resolvedIds = tickets
      .filter((t) => this.isResolved(t.status))
      .map((t) => t.id);
    if (resolvedIds.length === 0) return result;

    const logs = await this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.entityType = :type', { type: 'ticket' })
      .andWhere('log.entityId IN (:...ids)', { ids: resolvedIds })
      .andWhere("log.changes->'status'->>'to' IN (:...statuses)", {
        statuses: RESOLVED_STATUSES,
      })
      .orderBy('log.timestamp', 'DESC')
      .getMany();

    const resolverUserIdByTicket = new Map<string, string>();
    for (const log of logs) {
      if (!resolverUserIdByTicket.has(log.entityId) && log.userId) {
        resolverUserIdByTicket.set(log.entityId, log.userId);
      }
    }

    const userIds = [...new Set(resolverUserIdByTicket.values())];
    const users =
      userIds.length > 0
        ? await this.userRepository.find({ where: { id: In(userIds) } })
        : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    for (const ticket of tickets) {
      if (!this.isResolved(ticket.status)) continue;

      const resolverId = resolverUserIdByTicket.get(ticket.id);
      if (resolverId && userById.has(resolverId)) {
        result.set(ticket.id, this.userLabel(userById.get(resolverId)));
        continue;
      }
      if (ticket.assignedTo) {
        result.set(ticket.id, this.userLabel(ticket.assignedTo));
      }
    }

    return result;
  }

  async exportTickets(query: TicketsExportQuery): Promise<StreamableFile> {
    const format = query.format === 'csv' ? 'csv' : 'xlsx';

    const qb = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.createdBy', 'createdBy')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
      .where('ticket.isDeleted = false');

    this.applyDateFilters(qb, query);

    if (query.status) {
      qb.andWhere('ticket.status = :status', { status: query.status });
    }
    if (query.category?.trim()) {
      qb.andWhere('LOWER(ticket.category) = LOWER(:category)', {
        category: query.category.trim(),
      });
    }

    const rows = await qb.orderBy('ticket.createdAt', 'DESC').getMany();
    const resolverByTicket = await this.resolveResolverLabels(rows);

    const headers = [
      'Title',
      'Description',
      'Type (Category)',
      'Priority',
      'Status',
      'Resolved',
      'Created By',
      'Assigned To',
      'Resolved By',
      'Created At',
      'Updated At',
      'Machine',
      'Area',
      'Source',
    ];

    const dataRows = rows.map((t) => [
      t.title,
      t.description ?? '',
      t.category,
      t.priority,
      t.status,
      this.isResolved(t.status) ? 'Yes' : 'No',
      this.userLabel(t.createdBy),
      this.userLabel(t.assignedTo),
      resolverByTicket.get(t.id) ?? '',
      t.createdAt?.toISOString() ?? '',
      t.updatedAt?.toISOString() ?? '',
      t.machine ?? '',
      t.area ?? '',
      t.source ?? '',
    ]);

    const filename = this.buildFilename(query, format);

    if (format === 'csv') {
      const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const lines = [headers.map(esc).join(',')];
      for (const r of dataRows) {
        lines.push(r.map((c) => esc(String(c))).join(','));
      }
      const buf = Buffer.from(lines.join('\n'), 'utf8');
      return new StreamableFile(buf, {
        type: 'text/csv; charset=utf-8',
        disposition: this.dispositionFilename(filename),
      });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tickets');
    sheet.addRow(headers);
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    for (const r of dataRows) {
      sheet.addRow(r);
    }

    const colCount = headers.length;
    for (let c = 1; c <= colCount; c++) {
      let max = 12;
      for (let r = 1; r <= sheet.rowCount; r++) {
        const v = sheet.getRow(r).getCell(c).value;
        const len = v != null ? String(v).length : 0;
        if (len > max) max = Math.min(len, 55);
      }
      sheet.getColumn(c).width = max + 2;
    }

    const buf = Buffer.from(await workbook.xlsx.writeBuffer());
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: this.dispositionFilename(filename),
    });
  }
}
