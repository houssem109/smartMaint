'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, Plus, Edit2, Maximize2 } from 'lucide-react';
import { useChatStore, type ChatSource } from '@/store/chat-store';
import { displayChatContent } from '@/lib/techo-chat-display';
import {
  deriveThreadTitleFromMessages,
  findReusableEmptyThread,
  getThreadDisplayTitle,
  getWidgetThreadLabel,
  pickWidgetActiveThread,
  sortThreadsByActivity,
} from '@/lib/techo-thread-title';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function TechoChatWidget() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const {
    isOpen,
    open,
    close,
    threads,
    activeThreadId,
    createThread,
    setActiveThread,
    messagesByThread,
    addMessage,
    isSending,
    setSending,
    updateMessage,
    updateNextAssistantMessage,
    setThreadArchived,
    setThreadMessages,
    ensureUserScope,
    autoTitleThread,
    mergeServerThreads,
  } = useChatStore();
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  /** Data URL or raw base64 for next send (10 Type 2). */
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const name = user?.fullName?.trim() || user?.username?.trim() || user?.email?.split('@')[0] || '';
  const greeting = name
    ? `Hello ${name}, I'm Techo. How can I help you today?`
    : "Hello, I'm Techo, the SmartMaint assistant. How can I help you today?";

  // Only show for authenticated users inside dashboard
  const shouldShow =
    !!user &&
    pathname?.startsWith('/dashboard') &&
    !pathname.startsWith('/dashboard/admin/history') &&
    !pathname.startsWith('/dashboard/techo');

  // Each user gets their own chat threads (same browser, different login).
  useEffect(() => {
    if (user?.id) ensureUserScope(user.id);
  }, [user?.id, ensureUserScope]);

  // Sync server thread list (same as full Techo page)
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{
          threads: { threadId: string; title: string; lastMessageAt: string; messageCount: number }[];
        }>('/chat/threads');
        if (cancelled || !res.data?.threads?.length) return;
        mergeServerThreads(res.data.threads);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, mergeServerThreads]);

  // Ensure one sensible active thread when the widget opens
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    const state = useChatStore.getState();
    const pick = pickWidgetActiveThread(state.threads, state.messagesByThread, state.activeThreadId);

    if (pick) {
      if (state.activeThreadId !== pick.id) setActiveThread(pick.id);
      const msgs = state.messagesByThread[pick.id];
      if (!msgs?.length) {
        addMessage(pick.id, { role: 'assistant', content: greeting });
      }
      return;
    }

    const id = createThread(undefined, user.id);
    addMessage(id, { role: 'assistant', content: greeting });
  }, [isOpen, user?.id, createThread, addMessage, setActiveThread, greeting]);

  const activeMessages = activeThreadId ? messagesByThread[activeThreadId] || [] : [];
  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const isArchived = !!activeThread?.archived;
  const activeDisplayTitle = activeThread
    ? getThreadDisplayTitle(activeThread, activeMessages)
    : 'Techo';
  const switchableThreads = sortThreadsByActivity(
    threads.filter((t) => !t.archived),
    messagesByThread,
  );
  const showThreadPicker = switchableThreads.length > 1;

  const refreshThreadTitle = async (threadId: string) => {
    const msgs = useChatStore.getState().messagesByThread[threadId] ?? [];
    const local = deriveThreadTitleFromMessages(msgs);
    if (local) autoTitleThread(threadId, local);
    const thread = useChatStore.getState().threads.find((t) => t.id === threadId);
    if (thread && !/^(conversation\s*\d+|saved conversation|new chat|techo chat|chat|untitled)$/i.test(thread.title.trim())) {
      return;
    }
    try {
      const res = await api.post<{ title: string | null }>(
        `/chat/thread/${encodeURIComponent(threadId)}/suggest-title`,
      );
      if (res.data?.title) autoTitleThread(threadId, res.data.title);
    } catch {
      /* optional */
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages.length, isOpen]);

  // Hydrate thread from server when DB has more than localStorage (long memory).
  useEffect(() => {
    if (!activeThreadId || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{
          threadId: string;
          turns: { role: 'user' | 'assistant'; content: string }[];
        }>(`/chat/thread/${encodeURIComponent(activeThreadId)}/history`);
        if (cancelled || !res.data?.turns?.length) return;
        const local = useChatStore.getState().messagesByThread[activeThreadId] || [];
        // Only hydrate if server history is longer AND first user message belongs to this login
        if (res.data.turns.length <= local.length) return;
        const hydrated = res.data.turns.map((t, i) => ({
          id: `srv-${activeThreadId}-${i}-${t.role}`,
          role: t.role,
          content: displayChatContent(t.content),
          createdAt: Date.now() - (res.data.turns.length - i) * 1000,
        }));
        setThreadMessages(activeThreadId, hydrated);
        const derived = deriveThreadTitleFromMessages(hydrated);
        if (derived) autoTitleThread(activeThreadId, derived);
      } catch {
        // Server history optional until migration is applied
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeThreadId, user, setThreadMessages]);

  if (!shouldShow) return null;

  const currentTicketId = (() => {
    // For now, if we're on a ticket detail page, use its id; otherwise no ticketId
    const match = pathname?.match(/^\/dashboard\/tickets\/([^/]+)/);
    return match ? match[1] : undefined;
  })();

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    if (!activeThreadId) return;

    const isEditing = !!editingMessageId;
    let historyPayload;

    if (isEditing && editingMessageId) {
      // Update existing user message text
      updateMessage(activeThreadId, editingMessageId, text);
      // History = everything BEFORE that message
      const idx = activeMessages.findIndex((m) => m.id === editingMessageId);
      const base = idx > 0 ? activeMessages.slice(0, idx) : [];
      historyPayload = base.slice(-100).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : ('user' as const),
        content: m.content,
      }));
    } else {
      // Normal send: last 100 turns (backend keeps up to CHAT_HISTORY_MAX_TURNS)
      historyPayload = activeMessages.slice(-100).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : ('user' as const),
        content: m.content,
      }));
      addMessage(activeThreadId, {
        role: 'user',
        content: text,
      });
    }

    setInput('');
    setSending(true);

    try {
      const res = await api.post<{
        reply: string;
        ticketId?: string | null;
        ticketCreated?: boolean;
        archiveThread?: boolean;
        sources?: ChatSource[];
      }>('/chat/message', {
        message: text,
        threadId: activeThreadId,
        ticketId: currentTicketId,
        history: historyPayload,
        allowTicketCreation: true,
      });
      const replyText = res.data.reply || '…';
      const sources = Array.isArray(res.data.sources) ? res.data.sources : undefined;
      if (res.data.ticketCreated && res.data.ticketId) {
        window.dispatchEvent(
          new CustomEvent('smartmaint-ticket-created', { detail: { ticketId: res.data.ticketId } }),
        );
      }
      if (res.data.archiveThread && activeThreadId) {
        setThreadArchived(activeThreadId, true);
      } else if (
        activeThreadId &&
        /see you on the floor|à bientôt sur le floor|glad I could help|content d'avoir pu aider/i.test(
          replyText,
        )
      ) {
        setThreadArchived(activeThreadId, true);
      }

      if (isEditing && editingMessageId) {
        // Replace Techo's answer after this user message
        updateNextAssistantMessage(activeThreadId, editingMessageId, replyText, sources);
      } else {
        addMessage(activeThreadId, { role: 'assistant', content: replyText, sources });
      }
      void refreshThreadTitle(activeThreadId);
    } catch (err: any) {
      console.error('Techo chat error', err);
      if (activeThreadId) {
        const msg =
          err.response?.data?.message ||
          (Array.isArray(err.response?.data?.message) ? err.response.data.message.join(', ') : null) ||
          'Sorry, I could not contact the AI service right now. Please try again later.';
        addMessage(activeThreadId, {
          role: 'assistant',
          content: typeof msg === 'string' ? msg : 'Sorry, something went wrong. Please try again.',
        });
      }
    } finally {
      setSending(false);
      if (isEditing) {
        setEditingMessageId(null);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  const handleNewConversation = () => {
    if (!user?.id) return;
    const reusable = findReusableEmptyThread(threads, messagesByThread);
    if (reusable) {
      setActiveThread(reusable.id);
      return;
    }
    const id = createThread(undefined, user.id);
    addMessage(id, { role: 'assistant', content: greeting });
  };

  const handleEditFromMessage = (id: string, content: string) => {
    setEditingMessageId(id);
    setInput(content);
  };

  const handleToggleArchived = () => {
    if (!activeThread) return;
    setThreadArchived(activeThread.id, !activeThread.archived);
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
        <div className="fixed z-40 bottom-20 right-4 flex h-[min(32rem,calc(100vh-6rem))] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
          <div className="accent-band-top shrink-0" aria-hidden />
          <header className="shrink-0 border-b border-border/70 bg-card/95 px-3 py-2.5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-xs font-bold text-primary-foreground shadow-sm ring-2 ring-background">
                  T
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">{activeDisplayTitle}</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    {!isArchived && (
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    )}
                    {isArchived ? 'Closed' : 'Online'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleNewConversation}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="New conversation"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <Link
                  href="/dashboard/techo"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="All conversations"
                  aria-label="All conversations"
                >
                  <Maximize2 className="h-4 w-4" />
                </Link>
                {activeThread && !isArchived && (
                  <button
                    type="button"
                    onClick={handleToggleArchived}
                    className="rounded-lg px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
                    title="Mark as done"
                  >
                    Done
                  </button>
                )}
                {activeThread && isArchived && (
                  <button
                    type="button"
                    onClick={handleToggleArchived}
                    className="rounded-lg px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10"
                  >
                    Reopen
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showThreadPicker && (
              <label className="mt-2 block">
                <span className="sr-only">Switch conversation</span>
                <select
                  value={activeThreadId ?? ''}
                  onChange={(e) => setActiveThread(e.target.value)}
                  className="w-full rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
                >
                  {switchableThreads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {getWidgetThreadLabel(t, messagesByThread[t.id], threads, messagesByThread)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-muted/25 to-background px-3 py-3 text-sm">
            {activeMessages.map((m) => (
              <div
                key={m.id}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start gap-2'}
              >
                {m.role === 'assistant' && (
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-[10px] font-bold text-primary-foreground"
                    aria-hidden
                  >
                    T
                  </div>
                )}
                <div className="relative max-w-[85%] group">
                  <div
                    className={cn(
                      'break-words px-3.5 py-2 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'rounded-2xl rounded-br-md bg-primary text-primary-foreground shadow-md shadow-primary/15'
                        : 'rounded-2xl rounded-bl-md border border-border/60 bg-card text-foreground shadow-sm',
                    )}
                  >
                    {displayChatContent(m.content)}
                    {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                      <details className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                        <summary className="cursor-pointer select-none font-medium text-foreground/80">
                          Sources used ({m.sources.length})
                        </summary>
                        <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
                          {m.sources.map((s, i) => (
                            <li key={`${s.kind}-${i}`}>{s.caption}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <button
                      type="button"
                      onClick={() => handleEditFromMessage(m.id, m.content)}
                      className="hidden group-hover:flex items-center justify-center absolute -bottom-4 right-1 h-4 rounded-full bg-background/90 border border-border px-1 text-[10px] text-muted-foreground hover:bg-muted"
                      aria-label="Edit message"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
            {isSending && !editingMessageId && (
              <div className="flex justify-start gap-2">
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-[10px] font-bold text-primary-foreground"
                  aria-hidden
                >
                  T
                </div>
                <div className="rounded-2xl rounded-bl-md border border-border/60 bg-card px-3.5 py-2.5 shadow-sm">
                  <div className="flex gap-1" aria-label="Techo is thinking">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            {activeMessages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Techo is ready to help you with maintenance questions and tickets.
              </p>
            )}
          </div>

          <footer className="shrink-0 border-t border-border/70 bg-card/95 px-3 py-2.5 backdrop-blur-sm">
            <div
              className={cn(
                'flex items-end gap-1.5 rounded-xl border bg-background p-1 shadow-sm transition-all',
                isArchived
                  ? 'border-border/50 opacity-60'
                  : 'border-border/60 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10',
              )}
            >
              <textarea
                placeholder={isArchived ? 'Conversation closed' : 'Message Techo…'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
                rows={1}
                aria-label="Message to Techo"
                className="min-h-[2.5rem] max-h-20 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/70 focus-visible:outline-none disabled:cursor-not-allowed"
                disabled={isSending || isArchived}
              />
              <Button
                type="button"
                size="icon"
                aria-label="Send message"
                className={cn(
                  'mb-0.5 h-9 w-9 shrink-0 rounded-lg',
                  input.trim() && !isArchived && !isSending
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground',
                )}
                onClick={handleSend}
                disabled={isSending || !input.trim() || isArchived}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {threads.length > 1 && (
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                <Link href="/dashboard/techo" className="font-medium text-primary hover:underline">
                  {threads.length} conversations
                </Link>
              </p>
            )}
            {currentTicketId && (
              <p className="mt-0.5 text-center text-[10px] text-muted-foreground">
                Ticket {currentTicketId.slice(0, 8)}…
              </p>
            )}
          </footer>
        </div>
      )}
    </>
  );
}

