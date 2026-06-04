import {
  buildRouterClarifyReply,
  detectTurnRouteHeuristic,
  parseTurnRouterJson,
  routeImpliesTicketAction,
  shouldClarifyInsteadOfLoop,
} from './ticket-intent-router.util';

describe('ticket-intent-router.util', () => {
  it('parses router JSON', () => {
    const raw = '{"intent":"ticket_action","action":"delete","search_query":null,"confidence":0.91,"reason":"delete it"}';
    const r = parseTurnRouterJson(raw);
    expect(r?.intent).toBe('ticket_action');
    expect(r?.action).toBe('delete');
    expect(r?.confidence).toBeCloseTo(0.91);
  });

  it('heuristic detects delete-it with cached ticket', () => {
    const r = detectTurnRouteHeuristic({
      message: 'can you delete it?',
      history: [],
      lastTicket: { id: '911a4348-b3eb-4e95-a6aa-1035b582e406', title: 'HMI frozen' },
      pendingActionKind: null,
      wizardStep: null,
      hasCachedTicket: true,
    });
    expect(r?.intent).toBe('ticket_action');
    expect(routeImpliesTicketAction(r)).toBe(true);
  });

  it('clarify when low confidence action', () => {
    expect(
      shouldClarifyInsteadOfLoop({
        intent: 'ticket_action',
        action: 'delete',
        searchQuery: null,
        confidence: 0.35,
        reason: 'unsure',
      }),
    ).toBe(true);
  });

  it('builds clarify reply in English', () => {
    const text = buildRouterClarifyReply(null, 'en', { title: 'HMI frozen' });
    expect(text).toMatch(/delete the ticket/i);
  });

  it('heuristic routes commande to general_chat not ticket lookup', () => {
    const r = detectTurnRouteHeuristic({
      message: 'i have commande 25109760 dont work',
      history: [],
      lastTicket: null,
      pendingActionKind: null,
      wizardStep: null,
      hasCachedTicket: false,
    });
    expect(r?.intent).toBe('general_chat');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('heuristic prefers wizard continue over lookup when wizard prompt is last', () => {
    const history = [
      { role: 'user' as const, content: 'create ticket' },
      {
        role: 'assistant' as const,
        content: "Sure — I can open a ticket for you. In a few words, what's going on?",
      },
    ];
    const r = detectTurnRouteHeuristic({
      message: 'machine X dont work',
      history,
      lastTicket: { id: '911a4348-b3eb-4e95-a6aa-1035b582e406', title: 'HMI frozen' },
      pendingActionKind: null,
      wizardStep: null,
      hasCachedTicket: true,
    });
    expect(r?.intent).toBe('wizard_continue');
  });
});
