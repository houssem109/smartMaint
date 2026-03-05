"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateKnowledgeEntryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_knowledge_entry_dto_1 = require("./create-knowledge-entry.dto");
class UpdateKnowledgeEntryDto extends (0, swagger_1.PartialType)(create_knowledge_entry_dto_1.CreateKnowledgeEntryDto) {
}
exports.UpdateKnowledgeEntryDto = UpdateKnowledgeEntryDto;
//# sourceMappingURL=update-knowledge-entry.dto.js.map