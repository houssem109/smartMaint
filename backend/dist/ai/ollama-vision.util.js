"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOllamaVisionModel = getOllamaVisionModel;
function getOllamaVisionModel() {
    return process.env.OLLAMA_VISION_MODEL?.trim() || 'llava:latest';
}
//# sourceMappingURL=ollama-vision.util.js.map