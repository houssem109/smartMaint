/** Hide internal wizard markers from stored/server messages shown in the UI. */
export function displayChatContent(content: string): string {
  return content
    .replace(/^\[TICKET_WIZARD:[^\]]+\]\n?/, '')
    .replace(/^\[TICKET_INQUIRY:[^\]]+\]\n?/, '')
    .replace(/^\[TICKET_ACTION:[^\]]+\]\n?/, '')
    .replace(/^\[CONV_WRAP:[^\]]+\]\n?/, '')
    .trim();
}
