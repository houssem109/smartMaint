"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripThreadTitleSource = exports.sanitizeThreadTitle = exports.isGenericThreadTitle = exports.deriveThreadTitleHeuristic = void 0;
exports.suggestThreadTitle = suggestThreadTitle;
const thread_title_util_1 = require("./thread-title.util");
Object.defineProperty(exports, "deriveThreadTitleHeuristic", { enumerable: true, get: function () { return thread_title_util_1.deriveThreadTitleHeuristic; } });
Object.defineProperty(exports, "isGenericThreadTitle", { enumerable: true, get: function () { return thread_title_util_1.isGenericThreadTitle; } });
Object.defineProperty(exports, "sanitizeThreadTitle", { enumerable: true, get: function () { return thread_title_util_1.sanitizeThreadTitle; } });
Object.defineProperty(exports, "stripThreadTitleSource", { enumerable: true, get: function () { return thread_title_util_1.stripThreadTitleSource; } });
async function suggestThreadTitle(chatFn, turns) {
    const heuristic = (0, thread_title_util_1.deriveThreadTitleHeuristic)(turns);
    const userTurns = turns.filter((t) => t.role === 'user' && (0, thread_title_util_1.stripThreadTitleSource)(t.content).length >= 8);
    if (userTurns.length === 0)
        return heuristic;
    if (!(0, thread_title_util_1.isThreadTitleLlmEnabled)()) {
        return heuristic;
    }
    try {
        const raw = await chatFn([{ role: 'user', content: (0, thread_title_util_1.buildThreadTitleLlmPrompt)(turns) }]);
        const llmTitle = (0, thread_title_util_1.parseThreadTitleLlmJson)(raw);
        if (llmTitle && !(0, thread_title_util_1.isGenericThreadTitle)(llmTitle)) {
            return llmTitle;
        }
    }
    catch {
    }
    return heuristic;
}
//# sourceMappingURL=thread-title.service.js.map