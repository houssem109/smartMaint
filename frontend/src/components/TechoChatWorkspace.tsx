'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Circle,
  Sparkles,
  X,
} from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { displayChatContent } from '@/lib/techo-chat-display';
import { useTechoChat, useTechoScrollToBottom, type ThreadFilter } from '@/hooks/useTechoChat';
import { useChatStore } from '@/store/chat-store';

function formatThreadDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function threadPreview(threadId: string): string | null {
  const msgs = useChatStore.getState().messagesByThread[threadId];
  if (!msgs?.length) return null;
  const last = [...msgs].reverse().find((m) => m.role === 'user' || m.role === 'assistant');
  return last ? displayChatContent(last.content) : null;
}

const FILTER_LABELS: Record<ThreadFilter, string> = {
  all: 'All',
  active: 'Active',
  done: 'Done',
};

function TechoAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground shadow-sm ring-2 ring-background',
        className,
      )}
      aria-hidden
    >
      T
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start gap-2.5">
      <TechoAvatar className="h-8 w-8 text-xs" />
      <div className="rounded-2xl rounded-bl-md border border-border/60 bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5" aria-label="Techo is thinking">
          <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export default function TechoChatWorkspace() {
  const {
    threads,
    filterThreads,
    activeThreadId,
    activeThread,
    activeMessages,
    isArchived,
    isSending,
    currentTicketId,
    setActiveThread,
    deleteThread,
    sendMessage,
    startNewConversation,
    toggleArchived,
    ensureActiveThread,
    getThreadDisplayTitle: displayTitleFor,
  } = useTechoChat();

  const [filter, setFilter] = useState<ThreadFilter>('all');
  const [input, setInput] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'list' | 'chat'>('list');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useTechoScrollToBottom([activeMessages.length, activeThreadId]);

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  useEffect(() => {
    ensureActiveThread();
  }, [ensureActiveThread]);

  useEffect(() => {
    syncTextareaHeight();
  }, [input, syncTextareaHeight]);

  const visibleThreads = filterThreads(filter);
  const activeCount = threads.filter((t) => !t.archived).length;
  const doneCount = threads.filter((t) => t.archived).length;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || isArchived) return;
    setInput('');
    const ok = await sendMessage(text, {
      editingMessageId,
    });
    if (ok && editingMessageId) {
      setEditingMessageId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleEditFromMessage = (id: string, content: string) => {
    setEditingMessageId(id);
    setInput(content.replace(/\n\[photo attached\]$/, ''));
  };

  const threadPendingDelete = deleteThreadId
    ? threads.find((t) => t.id === deleteThreadId)
    : null;

  const confirmDeleteThread = () => {
    if (!deleteThreadId) return;
    deleteThread(deleteThreadId);
    setDeleteThreadId(null);
  };

  return (
    <div className="surface-card relative flex h-[calc(100vh-5.5rem)] min-h-[28rem] overflow-hidden shadow-sm md:h-[calc(100vh-7rem)] md:min-h-[34rem]">
      <div className="accent-band-top absolute inset-x-0 top-0 z-10 pointer-events-none" aria-hidden />

      <aside
        className={cn(
          'relative flex w-full max-w-[17rem] flex-col border-r border-border/80 bg-muted/25 sm:max-w-xs',
          mobilePanel === 'chat' && 'hidden md:flex',
        )}
      >
        <div className="space-y-4 border-b border-border/80 p-4 pt-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Conversations</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{activeCount}</span> active
                <span className="mx-1.5 text-border">·</span>
                <span className="font-medium text-foreground/80">{doneCount}</span> done
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                startNewConversation();
                setMobilePanel('chat');
              }}
              className="shrink-0 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>

          <div
            className="flex rounded-lg bg-background/80 p-1 shadow-inner border border-border/60"
            role="tablist"
            aria-label="Filter conversations"
          >
            {(['all', 'active', 'done'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all',
                  filter === key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                {FILTER_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-scroll flex-1 overflow-y-auto p-2">
          {visibleThreads.length === 0 ? (
            <div className="mx-1 mt-8 rounded-xl border border-dashed border-border/80 bg-background/50 px-4 py-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary/40" />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                No conversations yet.
                <br />
                Start a new chat with Techo.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {visibleThreads.map((t) => {
                const isActive = t.id === activeThreadId;
                const label = displayTitleFor(t.id);
                const preview = (threadPreview(t.id) || label).slice(0, 72);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveThread(t.id);
                        setMobilePanel('chat');
                      }}
                      className={cn(
                        'w-full rounded-xl border px-3 py-3 text-left transition-all',
                        isActive
                          ? 'border-primary/30 bg-primary/[0.07] shadow-sm ring-1 ring-primary/15'
                          : 'border-transparent bg-background/40 hover:border-border/60 hover:bg-background hover:shadow-sm',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-snug line-clamp-2 text-foreground">
                          {label}
                        </span>
                        <Badge
                          variant={t.archived ? 'secondary' : 'outline'}
                          className={cn(
                            'shrink-0 text-[10px] px-1.5 py-0 font-normal',
                            !t.archived && 'border-primary/25 text-primary bg-primary/5',
                          )}
                        >
                          {t.archived ? (
                            <>
                              <CheckCircle2 className="mr-0.5 inline h-3 w-3" />
                              Done
                            </>
                          ) : (
                            <>
                              <Circle className="mr-0.5 inline h-3 w-3 fill-primary/20" />
                              Active
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
                        {preview}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/80">
                        {formatThreadDate(t.createdAt)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <section
        className={cn(
          'relative flex min-w-0 flex-1 flex-col bg-background',
          mobilePanel === 'list' && 'hidden md:flex',
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border/80 bg-card/80 px-4 py-3 backdrop-blur-sm sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 md:hidden"
              onClick={() => setMobilePanel('list')}
              aria-label="Back to conversations"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <TechoAvatar />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                {activeThread ? displayTitleFor(activeThread.id) : 'Techo assistant'}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {!isArchived && (
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.6)]"
                    aria-hidden
                  />
                )}
                SmartMaint
                <span className="text-border">·</span>
                {isArchived ? 'Closed' : 'Online'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeThread && (
              <Button
                type="button"
                variant={isArchived ? 'outline' : 'secondary'}
                size="sm"
                onClick={toggleArchived}
                className={cn(!isArchived && 'border-accent/30 bg-accent/10 text-foreground hover:bg-accent/15')}
              >
                {isArchived ? (
                  'Reopen'
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                    Mark done
                  </>
                )}
              </Button>
            )}
            {activeThread && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteThreadId(activeThread.id)}
                title="Delete conversation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-muted/30 via-background to-background">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {activeMessages.length === 0 && !isSending && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <p className="mt-4 max-w-sm text-sm font-medium text-foreground">
                  How can Techo help you today?
                </p>
                <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Ask about tickets, machines, or step-by-step maintenance procedures.
                </p>
              </div>
            )}

            {activeMessages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="group relative max-w-[min(85%,28rem)]">
                    <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-md shadow-primary/15 break-words">
                      {displayChatContent(m.content)}
                    </div>
                    {!isArchived && (
                      <button
                        type="button"
                        onClick={() => handleEditFromMessage(m.id, m.content)}
                        className="absolute -bottom-3 right-2 hidden h-6 items-center gap-1 rounded-full border border-border bg-card px-2 text-[10px] text-muted-foreground shadow-sm group-hover:flex hover:bg-muted"
                        aria-label="Edit message"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start gap-2.5">
                  <TechoAvatar className="mt-0.5 h-8 w-8 text-xs" />
                  <div className="max-w-[min(85%,32rem)]">
                    <div className="rounded-2xl rounded-bl-md border border-border/70 bg-card px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-sm break-words">
                      {displayChatContent(m.content)}
                      {m.sources && m.sources.length > 0 && (
                        <details className="mt-2.5 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                          <summary className="cursor-pointer select-none font-medium text-foreground/75 hover:text-foreground">
                            Sources ({m.sources.length})
                          </summary>
                          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                            {m.sources.map((s, i) => (
                              <li key={`${s.kind}-${i}`}>{s.caption}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ),
            )}

            {isSending && !editingMessageId && <ThinkingBubble />}
            <div ref={messagesEndRef} />
          </div>

          <footer className="shrink-0 border-t border-border/60 bg-gradient-to-t from-muted/40 via-card/95 to-card/95 px-4 py-4 backdrop-blur-md sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              {editingMessageId && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3.5 py-2.5 text-xs text-foreground shadow-sm">
                  <span className="font-medium">Editing your message — send to update the reply</span>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    onClick={() => {
                      setEditingMessageId(null);
                      setInput('');
                    }}
                    aria-label="Cancel edit"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div
                className={cn(
                  'relative flex items-end gap-2 rounded-2xl border-2 bg-background p-2 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] transition-all duration-200',
                  isArchived
                    ? 'border-border/50 opacity-60'
                    : 'border-border/50 hover:border-primary/20 focus-within:border-primary/45 focus-within:shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.22)] focus-within:ring-4 focus-within:ring-primary/[0.08]',
                )}
              >
                <textarea
                  ref={textareaRef}
                  placeholder={
                    isArchived
                      ? 'Conversation closed — reopen to continue'
                      : 'Ask Techo anything…'
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  aria-label="Message to Techo"
                  className="min-h-[3rem] max-h-32 flex-1 resize-none bg-transparent px-3 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none disabled:cursor-not-allowed"
                  disabled={isSending || isArchived}
                />
                <Button
                  type="button"
                  size="icon"
                  aria-label="Send message"
                  className={cn(
                    'mb-0.5 h-11 w-11 shrink-0 rounded-xl transition-all duration-200',
                    input.trim() && !isArchived && !isSending
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-muted text-muted-foreground shadow-none hover:bg-muted',
                  )}
                  onClick={() => void handleSend()}
                  disabled={isSending || !input.trim() || isArchived}
                >
                  <Send className={cn('h-4 w-4', input.trim() && !isArchived && '-mr-0.5')} />
                </Button>
              </div>

              {!isArchived && (
                <p className="mt-2.5 text-center text-[11px] tracking-wide text-muted-foreground/75">
                  <kbd className="rounded border border-border/80 bg-muted/50 px-1.5 py-0.5 font-sans text-[10px]">
                    Enter
                  </kbd>{' '}
                  to send
                  <span className="mx-2 text-border">·</span>
                  <kbd className="rounded border border-border/80 bg-muted/50 px-1.5 py-0.5 font-sans text-[10px]">
                    Shift
                  </kbd>
                  +
                  <kbd className="rounded border border-border/80 bg-muted/50 px-1.5 py-0.5 font-sans text-[10px]">
                    Enter
                  </kbd>{' '}
                  new line
                </p>
              )}

              {currentTicketId && (
                <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                  Linked to ticket{' '}
                  <Link
                    href={`/dashboard/tickets/${currentTicketId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {currentTicketId.slice(0, 8)}…
                  </Link>
                </p>
              )}
            </div>
          </footer>
        </div>
      </section>

      <ConfirmModal
        isOpen={!!deleteThreadId}
        title="Delete conversation"
        message={
          threadPendingDelete
            ? `Delete "${displayTitleFor(threadPendingDelete.id)}" from this device? This cannot be undone.`
            : 'Delete this conversation from this device? This cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmDeleteThread}
        onCancel={() => setDeleteThreadId(null)}
      />
    </div>
  );
}
