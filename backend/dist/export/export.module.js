"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const knowledge_entry_entity_1 = require("../knowledge/entities/knowledge-entry.entity");
const knowledge_document_entity_1 = require("../knowledge-documents/entities/knowledge-document.entity");
const machine_profile_entity_1 = require("../machine-profiles/entities/machine-profile.entity");
const ticket_entity_1 = require("../tickets/entities/ticket.entity");
const user_entity_1 = require("../users/entities/user.entity");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
const export_controller_1 = require("./export.controller");
const knowledge_export_service_1 = require("./knowledge-export.service");
const ticket_export_service_1 = require("./ticket-export.service");
let ExportModule = class ExportModule {
};
exports.ExportModule = ExportModule;
exports.ExportModule = ExportModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                knowledge_entry_entity_1.KnowledgeEntry,
                knowledge_document_entity_1.KnowledgeDocument,
                machine_profile_entity_1.MachineProfile,
                ticket_entity_1.Ticket,
                user_entity_1.User,
                audit_log_entity_1.AuditLog,
            ]),
        ],
        controllers: [export_controller_1.ExportController],
        providers: [knowledge_export_service_1.KnowledgeExportService, ticket_export_service_1.TicketExportService],
    })
], ExportModule);
//# sourceMappingURL=export.module.js.map