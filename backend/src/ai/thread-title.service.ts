import {
  buildThreadTitleLlmPrompt,
  deriveThreadTitleHeuristic,
  isGenericThreadTitle,
  isThreadTitleLlmEnabled,
  parseThreadTitleLlmJson,
  sanitizeThreadTitle,
  stripThreadTitleSource,
} from './thread-title.util';

export {
  deriveThreadTitleHeuristic,
  isGenericThreadTitle,
  sanitizeThreadTitle,
  stripThreadTitleSource,
};

export async function suggestThreadTitle(
  chatFn: (messages: { role: 'user' | 'assistant' | 'system'; content: string }[]) => Promise<string>,
  turns: { role: string; content: string }[],
): Promise<string | null> {
  const heuristic = deriveThreadTitleHeuristic(turns);
  const userTurns = turns.filter((t) => t.role === 'user' && stripThreadTitleSource(t.content).length >= 8);
  if (userTurns.length === 0) return heuristic;

  if (!isThreadTitleLlmEnabled()) {
    return heuristic;
  }

  try {
    const raw = await chatFn([{ role: 'user', content: buildThreadTitleLlmPrompt(turns) }]);
    const llmTitle = parseThreadTitleLlmJson(raw);
    if (llmTitle && !isGenericThreadTitle(llmTitle)) {
      return llmTitle;
    }
  } catch {
    /* fallback to heuristic */
  }

  return heuristic;
}
