import {
  isTicketActionIntent,
  parseTicketActionIntent,
  isActionConfirmation,
  buildActionConfirmPrompt,
  shouldProcessTicketAction,
} from './ticket-action.util';

describe('ticket-action.util', () => {
  it('detects close ticket intent', () => {
    expect(isTicketActionIntent('can u close the ticket')).toBe(true);
    expect(parseTicketActionIntent('can u close the ticket').kind).toBe('close');
  });

  it('detects delete intent', () => {
    expect(isTicketActionIntent('please delete this ticket')).toBe(true);
    expect(parseTicketActionIntent('delete the ticket').kind).toBe('delete');
    expect(isTicketActionIntent('can delete it')).toBe(true);
    expect(isTicketActionIntent('can you delete it?')).toBe(true);
    expect(parseTicketActionIntent('can you delete it?').kind).toBe('delete');
  });

  it('builds confirmation prompt', () => {
    const text = buildActionConfirmPrompt(
      {
        kind: 'close',
        ticketId: '911a4348-b3eb-4e95-a6aa-1035b582e406',
        ticketTitle: 'HMI screen frozen on filler',
        updates: { status: 'closed' as any },
        lang: 'en',
        summary: 'close this ticket',
      },
      'en',
    );
    expect(text).toMatch(/Are you sure/i);
    expect(text).toMatch(/HMI screen frozen/i);
  });

  it('detects reopen / make open intents', () => {
    expect(isTicketActionIntent('can u update it like make it open ?')).toBe(true);
    expect(parseTicketActionIntent('can u update it like make it open ?').kind).toBe('reopen');
    expect(isTicketActionIntent('u want to open it again')).toBe(true);
    expect(parseTicketActionIntent('open it again').updates.status).toBe('open');
    expect(isTicketActionIntent('please reopen the ticket')).toBe(true);
  });

  it('detects priority change after leading ok', () => {
    expect(isTicketActionIntent('ok can u change her priority to low ?')).toBe(true);
    expect(parseTicketActionIntent('ok can u change her priority to low ?').updates.priority).toBe('low');
  });

  it('routes delete-it follow-ups to action handler when ticket context exists', () => {
    expect(shouldProcessTicketAction('can delete it', [], false, true)).toBe(true);
    expect(shouldProcessTicketAction('can delete it', [], false, false)).toBe(false);
  });

  it('routes delete to action handler after ticket created in history', () => {
    const history = [
      {
        role: 'assistant' as const,
        content:
          'All set — ticket "machine x dont work" is created.\nReference: 911a4348-b3eb-4e95-a6aa-1035b582e406',
      },
    ];
    expect(isTicketActionIntent('delete that ticket')).toBe(true);
    expect(shouldProcessTicketAction('delete that ticket', history, false, false)).toBe(true);
  });
});
