"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderTechoModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const ai_module_1 = require("../ai/ai.module");
const audit_log_entity_1 = require("../common/entities/audit-log.entity");
const order_data_service_1 = require("./order-data.service");
const order_rule_engine_service_1 = require("./order-rule-engine.service");
const order_techo_service_1 = require("./order-techo.service");
const reference_data_load_log_service_1 = require("./reference-data-load-log.service");
let OrderTechoModule = class OrderTechoModule {
};
exports.OrderTechoModule = OrderTechoModule;
exports.OrderTechoModule = OrderTechoModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([audit_log_entity_1.AuditLog]), (0, common_1.forwardRef)(() => ai_module_1.AiModule)],
        providers: [
            order_data_service_1.OrderDataService,
            order_rule_engine_service_1.OrderRuleEngineService,
            order_techo_service_1.OrderTechoService,
            reference_data_load_log_service_1.ReferenceDataLoadLogService,
        ],
        exports: [order_techo_service_1.OrderTechoService, order_data_service_1.OrderDataService],
    })
], OrderTechoModule);
//# sourceMappingURL=order-techo.module.js.map