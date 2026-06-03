import {
  isTicketActionIntent,
  parseTicketActionIntent,
  isActionConfirmation,
  buildActionConfirmPrompt,
} from './ticket-action.util';

describe('ticket-action.util', () => {
  it('detects close ticket intent', () => {
    expect(isTicketActionIntent('can u close the ticket')).toBe(true);
    expect(parseTicketActionIntent('can u close the ticket').kind).toBe('close');
  });

  it('detects delete intent', () => {
    expect(isTicketActionIntent('please delete this ticket')).toBe(true);
    expect(parseTicketActionIntent('delete the ticket').kind).toBe('delete');
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
});
