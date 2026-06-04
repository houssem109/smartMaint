import { isOrderIntentMessage } from './order-intent.util';

describe('order-intent.util', () => {
  it('detects commande with 8-digit order number', () => {
    expect(isOrderIntentMessage('i have commande 25109760 dont work')).toBe(true);
  });

  it('detects correction after mistaken ticket lookup', () => {
    const history = [
      { role: 'user' as const, content: 'i have commande 25109760 dont work' },
      {
        role: 'assistant' as const,
        content: 'I could not find an accessible ticket matching "25109760".',
      },
    ];
    expect(isOrderIntentMessage('its not ticket its commande', history)).toBe(true);
  });

  it('does not flag plain maintenance problem reports', () => {
    expect(isOrderIntentMessage('machine X dont work on line 2')).toBe(false);
  });
});
