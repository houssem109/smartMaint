import {
  isAwaitingMissionDoneConfirm,
  isMissionCompleteConfirmation,
  isConversationEndUserMessage,
  hasContinuingTaskIntent,
  shouldProcessConversationWrap,
  appendMissionDonePrompt,
  buildFarewellReply,
} from './conversation-wrap.util';

describe('conversation-wrap.util', () => {
  it('detects mission done confirmation after prompt', () => {
    const history = [
      {
        role: 'assistant' as const,
        content:
          '[CONV_WRAP:await_done]\nTicket created.\n\nAnything else I can help with, or is your mission done?',
      },
    ];
    expect(isAwaitingMissionDoneConfirm(history)).toBe(true);
    expect(isMissionCompleteConfirmation('yes')).toBe(true);
  });

  it('appends mission done question after task reply', () => {
    const { reply } = appendMissionDonePrompt('Done — ticket created.', 'en', 'Admin');
    expect(reply).toMatch(/mission done/i);
    expect(reply).toMatch(/ticket created/i);
  });

  it('accepts short yes and iam done', () => {
    expect(isMissionCompleteConfirmation('y')).toBe(true);
    expect(isMissionCompleteConfirmation('iam done')).toBe(true);
    expect(isMissionCompleteConfirmation('iamdone')).toBe(true);
    expect(isConversationEndUserMessage('done')).toBe(true);
  });

  it('detects mark conversation prompt without marker', () => {
    const history = [
      {
        role: 'assistant' as const,
        content: 'Should I mark this conversation as done? Reply "yes" to close it or "no" to keep chatting.',
      },
    ];
    expect(isAwaitingMissionDoneConfirm(history)).toBe(true);
    expect(isMissionCompleteConfirmation('y')).toBe(true);
  });

  it('does not treat follow-up task as mission done', () => {
    const history = [
      {
        role: 'assistant' as const,
        content:
          'Done — ticket reopened.\n\nAnything else I can help with, or is your mission done?',
      },
    ];
    const msg = 'ok can u change her priority to low ?';
    expect(hasContinuingTaskIntent(msg)).toBe(true);
    expect(isMissionCompleteConfirmation(msg)).toBe(false);
    expect(shouldProcessConversationWrap(msg, history)).toBe(false);
  });

  it('still treats plain ok as mission done', () => {
    const history = [
      {
        role: 'assistant' as const,
        content: 'Anything else I can help with, or is your mission done?',
      },
    ];
    expect(isMissionCompleteConfirmation('ok')).toBe(true);
    expect(shouldProcessConversationWrap('ok', history)).toBe(true);
  });
});
