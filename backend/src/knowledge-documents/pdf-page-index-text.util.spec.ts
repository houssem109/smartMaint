import {
  extractVisionPreferredPageText,
  shouldReplacePageTextWithVision,
  shouldSkipPopplerOnlyForRow,
} from './pdf-page-index-text.util';

describe('pdf-page-index-text.util', () => {
  it('skips unreadable poppler-only pages', () => {
    expect(
      shouldSkipPopplerOnlyForRow({ quality: 'unreadable' }, 'K1 MCC', false, 200),
    ).toBe(true);
  });

  it('keeps pages when vision stored text exists', () => {
    expect(
      shouldSkipPopplerOnlyForRow({ quality: 'unreadable', visionUsed: true }, '', true, 200),
    ).toBe(false);
  });

  it('prefers vision block over short OCR on unreadable pages', () => {
    const text = 'K1\n\n--- Vision description ---\nMotor contactor K1 feeds MCC line L1-L3.';
    expect(
      extractVisionPreferredPageText(
        text,
        'K1',
        { quality: 'unreadable', visionUsed: true, extractionMode: 'vision' },
        false,
      ),
    ).toBe('Motor contactor K1 feeds MCC line L1-L3.');
  });

  it('replaces OCR with vision on wiring/unreadable pages', () => {
    expect(
      shouldReplacePageTextWithVision({ quality: 'unreadable', sectionType: 'wiring' }, 'short', {}),
    ).toBe(true);
  });
});
