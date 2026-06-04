import {
  deriveThreadTitleHeuristic,
  isGenericThreadTitle,
  parseThreadTitleLlmJson,
  sanitizeThreadTitle,
} from './thread-title.util';

describe('thread-title.util', () => {
  it('derives title from ticket inquiry reply', () => {
    const turns = [
      { role: 'user', content: 'ask about ticket HMI screen frozen on filler' },
      {
        role: 'assistant',
        content: 'Here\'s ticket "HMI screen frozen on filler" (911a4348…)\nStatus: open',
      },
    ];
    expect(deriveThreadTitleHeuristic(turns)).toBe('HMI screen frozen on filler');
  });

  it('derives title from substantive user message', () => {
    const turns = [
      { role: 'user', content: 'create ticket' },
      { role: 'assistant', content: "Sure — what's going on?" },
      { role: 'user', content: 'machine X dont work on line 2' },
    ];
    expect(deriveThreadTitleHeuristic(turns)).toMatch(/machine X dont work/i);
  });

  it('skips generic titles', () => {
    expect(isGenericThreadTitle('Saved conversation')).toBe(true);
    expect(isGenericThreadTitle('Conversation 3')).toBe(true);
    expect(isGenericThreadTitle('HMI frozen on filler')).toBe(false);
  });

  it('parses LLM title JSON', () => {
    expect(parseThreadTitleLlmJson('{"title":"HMI screen frozen"}')).toBe('HMI screen frozen');
    expect(sanitizeThreadTitle('  too   long '.repeat(20)).length).toBeLessThanOrEqual(56);
  });
});
