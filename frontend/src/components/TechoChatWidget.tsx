'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, Plus, XCircle, Edit2 } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    resetThread,
    deleteThread,
    updateMessage,
    updateNextAssistantMessage,
    setThreadArchived,
  } = useChatStore();
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Only show for authenticated users inside dashboard
  const shouldShow =
    !!user && pathname?.startsWith('/dashboard') && !pathname.startsWith('/dashboard/admin/history');

  // Ensure at least one thread exists when opening
  useEffect(() => {
    if (!isOpen) return;
    if (!activeThreadId) {
      if (threads.length > 0) {
        // Restore first existing thread as active after refresh
        setActiveThread(threads[0].id);
      } else {
        const id = createThread();
        // Techo greeting for new thread
        addMessage(id, {
          role: 'assistant',
          content: "Hello, I'm Techo, the SmartMaint assistant. How can I help you today?",
        });
      }
    }
  }, [isOpen, activeThreadId, threads, createThread, addMessage, setActiveThread]);

  const activeMessages = activeThreadId ? messagesByThread[activeThreadId] || [] : [];
  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const isArchived = !!activeThread?.archived;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages.length, isOpen]);

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
      historyPayload = base.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : ('user' as const),
        content: m.content,
      }));
    } else {
      // Normal send: history is whole conversation
      historyPayload = activeMessages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : ('user' as const),
        content: m.content,
      }));
      addMessage(activeThreadId, { role: 'user', content: text });
    }

    setInput('');
    setSending(true);

    try {
      const res = await api.post<{ reply: string }>('/chat/message', {
        message: text,
        ticketId: currentTicketId,
        history: historyPayload,
      });
      const replyText = res.data.reply || '…';

      if (isEditing && editingMessageId) {
        // Replace Techo's answer after this user message
        updateNextAssistantMessage(activeThreadId, editingMessageId, replyText);
      } else {
        addMessage(activeThreadId, { role: 'assistant', content: replyText });
      }
    } catch (err: any) {
      console.error('Techo chat error', err);
      if (activeThreadId) {
        addMessage(activeThreadId, {
          role: 'assistant',
          content: 'Sorry, I could not contact the AI service right now. Please try again later.',
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

  const handleReset = () => {
    if (!activeThreadId) return;
    resetThread(activeThreadId);
    // Re-add greeting after reset
    addMessage(activeThreadId, {
      role: 'assistant',
      content: "Hello, I'm Techo, the SmartMaint assistant. How can I help you today?",
    });
  };

  const handleNewConversation = () => {
    const id = createThread();
    addMessage(id, {
      role: 'assistant',
      content: "Hello, I'm Techo, the SmartMaint assistant. How can I help you today?",
    });
  };

  const handleDeleteThread = (id: string) => {
    deleteThread(id);
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
        <div className="fixed z-40 bottom-20 right-4 w-full max-w-sm rounded-xl border border-border/60 bg-card shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/60">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/90 flex items-center justify-center text-primary-foreground text-xs font-bold">
                  T
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold leading-none">Techo</span>
                  <span className="text-[11px] text-muted-foreground">SmartMaint assistant</span>
                </div>
              </div>
              {/* Tabs */}
              <div className="mt-1 flex items-center gap-1">
                {/* Tabs in 2-column grid with vertical scroll when there are many */}
                <div className="flex-1 max-h-20 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-1">
                    {threads.map((t, index) => (
                      <div
                        key={t.id}
                        className={`group inline-flex items-center rounded-full border text-[11px] whitespace-nowrap overflow-hidden ${
                          t.id === activeThreadId
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                        } ${t.archived ? 'opacity-60 line-through' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveThread(t.id)}
                          className="px-2 py-0.5 text-ellipsis overflow-hidden text-left"
                        >
                          {t.title || `Conversation ${index + 1}`}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteThread(t.id)}
                          className="pr-1.5 pl-0.5 py-0.5 text-[10px] opacity-60 hover:opacity-100"
                          title="Delete conversation"
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleNewConversation}
                  className="ml-1 h-5 w-5 rounded-full border border-border flex items-center justify-center text-[11px] text-muted-foreground hover:bg-muted shrink-0"
                  title="New conversation"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {activeThread && (
                <button
                  type="button"
                  onClick={handleToggleArchived}
                  className="px-2 py-0.5 rounded-full border text-[10px] text-muted-foreground hover:bg-muted"
                  title={isArchived ? 'Reopen conversation' : 'Mark conversation as done'}
                >
                  {isArchived ? 'Reopen' : 'Done'}
                </button>
              )}
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
            {activeMessages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'user'
                    ? 'flex justify-end'
                    : 'flex justify-start'
                }
              >
                <div className="relative max-w-[80%] group">
                  <div
                    className={
                      m.role === 'user'
                        ? 'rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm break-words'
                        : 'rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground break-words'
                    }
                  >
                    {m.content}
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
              <div className="flex justify-start">
                <div className="max-w-[60%] rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground italic">
                  Techo is thinking…
                </div>
              </div>
            )}
            {activeMessages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Techo is ready to help you with maintenance questions and tickets.
              </p>
            )}
          </div>

          <div className="border-t border-border/60 px-2 py-2 bg-card/90">
            <div className="flex items-end gap-2">
              <textarea
                placeholder={isArchived ? 'Conversation is closed.' : 'Ask Techo anything about your work…'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown as any}
                rows={1}
                className="flex-1 max-h-20 resize-none overflow-y-auto rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSending || isArchived}
              />
              <Button
                type="button"
                size="icon"
                className="h-9 w-9"
                onClick={handleSend}
                disabled={isSending || !input.trim() || isArchived}
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

