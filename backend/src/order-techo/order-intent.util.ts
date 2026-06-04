/** Detect sales-order (commande) intent so Techo does not route to ticket lookup/wizard. */

export function extractOrderNumberFromText(text: string): string | null {
  const m = text.match(/\b(\d{8})\b/);
  return m ? m[1]! : null;
}

export function isOrderIntentMessage(
  message: string,
  history?: { role: string; content: string }[],
): boolean {
  const t = message.trim().toLowerCase();
  if (!t) return false;

  if (/\b(not\s+(a\s+)?ticket|pas\s+(un\s+)?ticket|its\s+commande|it's\s+commande|c'est\s+(une\s+)?commande)\b/i.test(t)) {
    return true;
  }

  if (/\b(commande|order|dcto|magasin|store|sales\s+order)\b/i.test(t)) {
    return true;
  }

  const hasOrderNumber = /\b\d{8}\b/.test(message);
  if (!hasOrderNumber) return false;

  if (
    /\b(dont\s*work|doesnt\s*work|doesn't\s*work|not\s+work|blocked|bloqu|problem|problème|erreur|error|why|pourquoi)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  if (/\b(cs|ca|so|co)\b/i.test(t)) return true;

  const blob = [
    message,
    ...(history ?? []).slice(-8).map((h) => h.content ?? ''),
  ].join('\n');
  return /\b(commande|order|dcto|magasin|store)\b/i.test(blob);
}
