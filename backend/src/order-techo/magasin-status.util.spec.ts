import { isMagasinActive, isMagasinInactive, magasinStatusLabel } from './magasin-status.util';

describe('magasin status', () => {
  it('0 = active, 1 = inactive', () => {
    expect(isMagasinActive(0)).toBe(true);
    expect(isMagasinInactive(1)).toBe(true);
    expect(isMagasinInactive(0)).toBe(false);
    expect(isMagasinActive(1)).toBe(false);
  });

  it('labels', () => {
    expect(magasinStatusLabel(0, 'en')).toBe('active');
    expect(magasinStatusLabel(1, 'fr')).toBe('inactif');
  });
});
