"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MachineProfilesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const machine_profile_entity_1 = require("./entities/machine-profile.entity");
const knowledge_document_entity_1 = require("../knowledge-documents/entities/knowledge-document.entity");
const knowledge_entry_entity_1 = require("../knowledge/entities/knowledge-entry.entity");
const machine_profiles_service_1 = require("./machine-profiles.service");
const machine_profiles_controller_1 = require("./machine-profiles.controller");
let MachineProfilesModule = class MachineProfilesModule {
};
exports.MachineProfilesModule = MachineProfilesModule;
exports.MachineProfilesModule = MachineProfilesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([machine_profile_entity_1.MachineProfile, knowledge_document_entity_1.KnowledgeDocument, knowledge_entry_entity_1.KnowledgeEntry])],
        controllers: [machine_profiles_controller_1.MachineProfilesController],
        providers: [machine_profiles_service_1.MachineProfilesService],
        exports: [machine_profiles_service_1.MachineProfilesService],
    })
], MachineProfilesModule);
//# sourceMappingURL=machine-profiles.module.js.map