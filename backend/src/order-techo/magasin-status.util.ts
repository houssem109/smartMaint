/** In magasin.csv: 0 = active, 1 = inactive. */
export function isMagasinActive(status: number): boolean {
  return status === 0;
}

export function isMagasinInactive(status: number): boolean {
  return status === 1;
}

export function magasinStatusLabel(status: number, lang: 'fr' | 'en'): string {
  if (isMagasinActive(status)) return lang === 'en' ? 'active' : 'actif';
  if (isMagasinInactive(status)) return lang === 'en' ? 'inactive' : 'inactif';
  return lang === 'en' ? 'unknown' : 'inconnu';
}
