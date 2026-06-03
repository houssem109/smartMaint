import {
  parseStructuredTicketInput,
  sanitizeTicketTitle,
  parseMachineAndArea,
} from './ticket-wizard.util';

import {
  analyzeTicketCreationIntent,
  detectWizardLang,
  isBareTicketTrigger,
  isTicketWizardTrigger,
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
});
