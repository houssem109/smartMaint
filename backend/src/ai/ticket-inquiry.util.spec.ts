import {
  extractBareSearchQuery,
  extractTicketInquiryAspect,
  extractTicketSearchQuery,
  isAwaitingTicketLookupQuery,
  isTicketInquiryIntent,
  shouldProcessTicketInquiry,
} from './ticket-inquiry.util';

describe('ticket-inquiry.util', () => {
  it('detects ask about ticket intent', () => {
    expect(isTicketInquiryIntent('hello i want to ask about ticket')).toBe(true);
  });

  it('treats title after lookup prompt as inquiry not wizard', () => {
    const history = [
      { role: 'user' as const, content: 'hello i want to ask about ticket' },
      {
        role: 'assistant' as const,
        content:
          '[TICKET_INQUIRY:await_query]\nWhich ticket should I look up? Give me the title, a few words from the description, or the ticket ID.',
      },
    ];
    expect(isAwaitingTicketLookupQuery(history)).toBe(true);
    expect(shouldProcessTicketInquiry('HMI screen frozen on filler', history)).toBe(true);
    expect(extractTicketSearchQuery('HMI screen frozen on filler', history)).toBe(
      'HMI screen frozen on filler',
    );
  });

  it('follow-up status question uses title from history', () => {
    const history = [
      { role: 'user' as const, content: 'hello i want to ask about ticket' },
      {
        role: 'assistant' as const,
        content: '[TICKET_INQUIRY:await_query]\nWhich ticket should I look up?',
      },
      { role: 'user' as const, content: 'HMI screen frozen on filler' },
    ];
    expect(shouldProcessTicketInquiry('is it open or not?', history)).toBe(true);
    expect(extractTicketSearchQuery('is it open or not?', history)).toBe('HMI screen frozen on filler');
    expect(extractTicketInquiryAspect('is it open or not?')).toBe('status');
  });

  it('detects inquiry about description', () => {
    expect(
      isTicketInquiryIntent('what is the problem with ticket HMI screen frozen on filler'),
    ).toBe(true);
    expect(extractTicketInquiryAspect('what is the problem with ticket HMI')).toBe('description');
  });

  it('detects assignment and status questions', () => {
    expect(isTicketInquiryIntent('is that ticket assigned to a technician')).toBe(true);
    expect(extractTicketInquiryAspect('is the ticket open or closed')).toBe('status');
    expect(extractTicketInquiryAspect('who is assigned to the ticket')).toBe('assignment');
  });

  it('extracts search query from natural phrasing', () => {
    expect(
      extractTicketSearchQuery('what is the problem with ticket HMI screen frozen on filler'),
    ).toBe('HMI screen frozen on filler');
  });

  it('does not treat reopen request as inquiry follow-up', () => {
    expect(shouldProcessTicketInquiry('can u update it like make it open ?', [], true)).toBe(false);
    expect(shouldProcessTicketInquiry('open it again', [], true)).toBe(false);
    expect(shouldProcessTicketInquiry('can delete it', [], true)).toBe(false);
    expect(shouldProcessTicketInquiry('can you delete it?', [], true)).toBe(false);
  });

  it('does not treat wizard follow-up as ticket search after prior inquiry', () => {
    const history = [
      { role: 'user' as const, content: 'is ticket open or closed' },
      {
        role: 'assistant' as const,
        content: '[TICKET_INQUIRY:found]\nTicket "HMI frozen" is open.',
      },
      { role: 'user' as const, content: 'ok try to create ticket' },
      {
        role: 'assistant' as const,
        content:
          "Admin, Sure — I can open a ticket for you. In a few words, what's going on?",
      },
    ];
    expect(shouldProcessTicketInquiry('machine X dont work', history)).toBe(false);
    expect(extractBareSearchQuery('machine X dont work')).toBe('machine X dont work');
  });
});
