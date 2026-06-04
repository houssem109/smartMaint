'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Plus,
  Trash2,
  Edit2,
  ImagePlus,
  CheckCircle2,
  Circle,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
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
    resetActiveThread,
    toggleArchived,
    ensureActiveThread,
    getThreadDisplayTitle: displayTitleFor,
  } = useTechoChat();

  const [filter, setFilter] = useState<ThreadFilter>('all');
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useTechoScrollToBottom([activeMessages.length, activeThreadId]);

  useEffect(() => {
    ensureActiveThread();
  }, [ensureActiveThread]);

  const visibleThreads = filterThreads(filter);
  const activeCount = threads.filter((t) => !t.archived).length;
  const doneCount = threads.filter((t) => t.archived).length;

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      window.alert('Use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > 4.2 * 1024 * 1024) {
      window.alert('Image must be under 4.2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === 'string') setPendingImage(r);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || isArchived) return;
    const imagePayload = editingMessageId ? null : pendingImage;
    setInput('');
    setPendingImage(null);
    const ok = await sendMessage(text, {
      editingMessageId,
      imageBase64: imagePayload,
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

  const handleDeleteThread = (id: string) => {
    if (!window.confirm('Delete this conversation from this device?')) return;
    deleteThread(id);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[32rem] overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <aside className="flex w-full max-w-xs flex-col border-r border-border/60 bg-muted/20">
        <div className="border-b border-border/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Conversations</h2>
              <p className="text-xs text-muted-foreground">
                {activeCount} active · {doneCount} done
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => startNewConversation()} className="shrink-0">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'done'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors',
                  filter === key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted',
                )}
              >
                {key === 'all' ? 'All' : key === 'active' ? 'Active' : 'Done'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {visibleThreads.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No conversations yet. Start a new chat with Techo.
            </p>
          )}
          {visibleThreads.map((t) => {
            const isActive = t.id === activeThreadId;
            const label = displayTitleFor(t.id);
            const preview = (threadPreview(t.id) || label).slice(0, 80);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveThread(t.id)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                  isActive
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-transparent bg-background/60 hover:bg-muted/60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium line-clamp-2 leading-snug">{label}</span>
                  <Badge
                    variant={t.archived ? 'secondary' : 'default'}
                    className={cn('shrink-0 text-[10px] px-1.5 py-0', t.archived && 'opacity-80')}
                  >
                    {t.archived ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-0.5 inline" />
                        Done
                      </>
                    ) : (
                      <>
                        <Circle className="h-3 w-3 mr-0.5 inline" />
                        Active
                      </>
                    )}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{preview}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{formatThreadDate(t.createdAt)}</p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
              T
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {activeThread ? displayTitleFor(activeThread.id) : 'Techo assistant'}
              </p>
              <p className="text-xs text-muted-foreground">
                SmartMaint · {isArchived ? 'Conversation closed' : 'Online'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeThread && (
              <Button type="button" variant="outline" size="sm" onClick={toggleArchived}>
                {isArchived ? 'Reopen' : 'Mark done'}
              </Button>
            )}
            {activeThread && (
              <Button type="button" variant="ghost" size="icon" onClick={resetActiveThread} title="Clear messages">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            {activeThread && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteThread(activeThread.id)}
                title="Delete conversation"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {activeMessages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className="relative max-w-[75%] group">
                <div
                  className={
                    m.role === 'user'
                      ? 'rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm break-words'
                      : 'rounded-xl bg-muted px-4 py-2 text-sm text-foreground break-words'
                  }
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
                {m.role === 'user' && !isArchived && (
                  <button
                    type="button"
                    onClick={() => handleEditFromMessage(m.id, m.content)}
                    className="hidden group-hover:flex items-center justify-center absolute -bottom-3 right-1 h-5 rounded-full bg-background border border-border px-1.5 text-[10px] text-muted-foreground hover:bg-muted"
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
              <div className="rounded-xl bg-muted px-4 py-2 text-xs text-muted-foreground italic">
                Techo is thinking…
              </div>
            </div>
          )}
          {activeMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Ask Techo about tickets, machines, or maintenance procedures.</p>
            </div>
          )}
        </div>

        <footer className="border-t border-border/60 px-4 py-3 bg-card/90">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPickImage}
          />
          {pendingImage && (
            <div className="mb-2 flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImage} alt="" className="h-12 w-12 rounded object-cover shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">Photo will be sent with your message.</span>
              <button
                type="button"
                className="text-xs text-destructive hover:underline shrink-0"
                onClick={() => setPendingImage(null)}
              >
                Remove
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="h-10 w-10 shrink-0 rounded-md border border-input flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40"
              disabled={isSending || isArchived}
              title="Attach photo"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <textarea
              placeholder={isArchived ? 'Conversation is closed. Reopen to continue.' : 'Message Techo…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="flex-1 max-h-32 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSending || isArchived}
            />
            <Button
              type="button"
              size="icon"
              className="h-10 w-10"
              onClick={() => void handleSend()}
              disabled={isSending || !input.trim() || isArchived}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {currentTicketId && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Linked to ticket{' '}
              <Link href={`/dashboard/tickets/${currentTicketId}`} className="underline">
                {currentTicketId.slice(0, 8)}…
              </Link>
            </p>
          )}
        </footer>
      </section>
    </div>
  );
}
