'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TechoChatWidget() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const { isOpen, open, close, messages, addMessage, isSending, setSending, reset } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Only show for authenticated users inside dashboard
  const shouldShow =
    !!user && pathname?.startsWith('/dashboard') && !pathname.startsWith('/dashboard/admin/history');

  // If we open with no messages, add Techo greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addMessage({
        role: 'assistant',
        content: "Hello, I'm Techo, the SmartMaint assistant. How can I help you today?",
      });
    }
  }, [isOpen, messages.length, addMessage]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen]);

  if (!shouldShow) return null;

  const currentTicketId = (() => {
    // For now, if we're on a ticket detail page, use its id; otherwise no ticketId
    const match = pathname?.match(/^\/dashboard\/tickets\/([^/]+)/);
    return match ? match[1] : undefined;
  })();

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const historyPayload = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user' as const,
      content: m.content,
    }));

    addMessage({ role: 'user', content: text });
    setInput('');
    setSending(true);

    try {
      const res = await api.post<{ reply: string }>('/chat/message', {
        message: text,
        ticketId: currentTicketId,
        history: historyPayload,
      });
      addMessage({ role: 'assistant', content: res.data.reply || '…' });
    } catch (err: any) {
      console.error('Techo chat error', err);
      addMessage({
        role: 'assistant',
        content: 'Sorry, I could not contact the AI service right now. Please try again later.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleToggle = () => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  };

  const handleReset = () => {
    reset();
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={handleToggle}
        className="fixed z-40 bottom-4 right-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg h-12 w-12 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        aria-label={isOpen ? 'Close Techo chat' : 'Open Techo chat'}
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed z-40 bottom-20 right-4 w-full max-w-sm rounded-xl border border-border/60 bg-card shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/60">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/90 flex items-center justify-center text-primary-foreground text-xs font-bold">
                T
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-none">Techo</span>
                <span className="text-[11px] text-muted-foreground">SmartMaint assistant</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={close}
                className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 max-h-80 overflow-y-auto px-3 py-2 space-y-2 text-sm">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'user'
                    ? 'flex justify-end'
                    : 'flex justify-start'
                }
              >
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[80%] rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm'
                      : 'max-w-[80%] rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground'
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Techo is ready to help you with maintenance questions and tickets.
              </p>
            )}
          </div>

          <div className="border-t border-border/60 px-2 py-2 bg-card/90">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Ask Techo anything about your work…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-9 text-sm"
                disabled={isSending}
              />
              <Button
                type="button"
                size="icon"
                className="h-9 w-9"
                onClick={handleSend}
                disabled={isSending || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {currentTicketId && (
              <p className="mt-1 text-[11px] text-muted-foreground text-right">
                Linked to ticket {currentTicketId.slice(0, 8)}…
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

