import {
  analyzeTicketCreationIntent,
  detectWizardLang,
  findCreatedTicketInHistory,
  getWizardStepFromHistory,
  inferWizardStepFromAssistantText,
  isAwaitingWizardUserInput,
  isBareTicketTrigger,
  isTestTicketRequest,
  isTicketWizardActiveInHistory,
  isTicketWizardTrigger,
  isWizardSupersededByCreatedTicket,
  parseMachineAndArea,
  parseStructuredTicketInput,
  sanitizeTicketTitle,
  shouldStartTicketWizard,
} from './ticket-wizard.util';
describe('ticket-wizard.util', () => {
  it('keeps English when user writes in English', () => {
    const history =
      'i want to create a ticket\nHMI screen frozen on filler\nOperator panel blank. Production stopped.\nFiller 01, Line A';
    expect(detectWizardLang('yes', history)).toBe('en');
  });

  it('detects natural problem reports from context', () => {
    expect(
      analyzeTicketCreationIntent('I have a problem with the HMI on filler 2').kind,
    ).toBe('problem_report');
    expect(shouldStartTicketWizard('I want to create a ticket')).toBe(true);
    expect(analyzeTicketCreationIntent('How do I reset the PLC timer?').kind).toBe('none');
  });

  it('does not start ticket wizard for sales order problems', () => {
    expect(analyzeTicketCreationIntent('i have commande 25109760 dont work').kind).toBe('none');
    expect(shouldStartTicketWizard('i have commande 25109760 dont work')).toBe(false);
  });

  it('detects "create a ticket" (substring trap)', () => {
    expect('create a ticket'.includes('create ticket')).toBe(false);
    expect(isTicketWizardTrigger('create a ticket')).toBe(true);
    expect(isBareTicketTrigger('create a ticket')).toBe(true);
  });

  it('splits title from description in one message', () => {
    const parsed = parseStructuredTicketInput(
      'title is HMI screen frozen on filler Description: Operator panel blank. Production stopped 08:30. Machine: Filler 01. Area: Line A.',
    );
    expect(parsed.title).toBe('HMI screen frozen on filler');
    expect(parsed.description).toContain('Operator panel blank');
    expect(parsed.machine).toBe('Filler 01');
    expect(parsed.area).toBe('Line A');
  });

  it('sanitizes title without description tail', () => {
    const t = sanitizeTicketTitle(
      'HMI frozen Description: should not be in title Machine: X',
    );
    expect(t).toBe('HMI frozen');
    expect(t).not.toMatch(/description/i);
  });

  it('parses machine and area from free text', () => {
    expect(parseMachineAndArea('Filler 01, Line A')).toEqual({
      machine: 'Filler 01',
      area: 'Line A',
    });
  });

  it('infers wizard step from assistant text without markers', () => {
    expect(
      inferWizardStepFromAssistantText(
        "Admin, Sure — I can open a ticket for you. In a few words, what's going on?",
      ),
    ).toBe('await_title');
    const history = [
      { role: 'user' as const, content: 'create ticket' },
      {
        role: 'assistant' as const,
        content: "Sure — I can open a ticket for you. In a few words, what's going on?",
      },
    ];
    expect(getWizardStepFromHistory(history)).toBe('await_title');
    expect(isAwaitingWizardUserInput(history)).toBe(true);
    expect(analyzeTicketCreationIntent('machine X dont work', history).kind).toBe('wizard_continue');
  });

  it('detects test ticket requests', () => {
    expect(isTestTicketRequest('only create ticket for test')).toBe(true);
    expect(isTestTicketRequest('machine X dont work')).toBe(false);
  });

  it('stops wizard after ticket is created in history', () => {
    const history = [
      { role: 'user' as const, content: 'create ticket' },
      {
        role: 'assistant' as const,
        content:
          "Here's the ticket I'll create:\nTitle: machine x dont work\nDescription: idk\nMachine: —\nArea: —",
      },
      { role: 'user' as const, content: 'yes create it' },
      {
        role: 'assistant' as const,
        content:
          'All set — ticket "machine x dont work" is created.\nReference: 911a4348-b3eb-4e95-a6aa-1035b582e406\nPriority: medium',
      },
      {
        role: 'assistant' as const,
        content: 'Anything else I can help with, or is your mission done?',
      },
    ];
    expect(isWizardSupersededByCreatedTicket(history)).toBe(true);
    expect(isTicketWizardActiveInHistory(history)).toBe(false);
    expect(findCreatedTicketInHistory(history)?.id).toBe(
      '911a4348-b3eb-4e95-a6aa-1035b582e406',
    );
  });
});
