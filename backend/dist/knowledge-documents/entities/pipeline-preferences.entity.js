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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelinePreferences = void 0;
const typeorm_1 = require("typeorm");
let PipelinePreferences = class PipelinePreferences {
};
exports.PipelinePreferences = PipelinePreferences;
PipelinePreferences.SINGLETON_ID = '00000000-0000-0000-0000-000000000001';
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], PipelinePreferences.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], PipelinePreferences.prototype, "pdfVisionEnabled", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], PipelinePreferences.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], PipelinePreferences.prototype, "updatedById", void 0);
exports.PipelinePreferences = PipelinePreferences = __decorate([
    (0, typeorm_1.Entity)('pipeline_preferences')
], PipelinePreferences);
//# sourceMappingURL=pipeline-preferences.entity.js.map