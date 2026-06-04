'use client';

import { useEffect, useMemo, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore, type ChatSource } from '@/store/chat-store';
import api from '@/lib/api';
import { displayChatContent } from '@/lib/techo-chat-display';
import {
  deriveThreadTitleFromMessages,
  getThreadDisplayTitle,
  isGenericThreadTitle,
  sortThreadsByActivity,
} from '@/lib/techo-thread-title';

export type ThreadFilter = 'all' | 'active' | 'done';

export interface ServerThreadSummary {
  threadId: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
}

export function useTechoChat() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const {
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
    setThreadMessages,
    ensureUserScope,
    mergeServerThreads,
    autoTitleThread,
  } = useChatStore();

  const name = user?.fullName?.trim() || user?.username?.trim() || user?.email?.split('@')[0] || '';
  const greeting = name
    ? `Hello ${name}, I'm Techo. How can I help you today?`
    : "Hello, I'm Techo, the SmartMaint assistant. How can I help you today?";

  useEffect(() => {
    if (user?.id) ensureUserScope(user.id);
  }, [user?.id, ensureUserScope]);

  const currentTicketId = useMemo(() => {
    const match = pathname?.match(/^\/dashboard\/(?:admin\/tickets|technician\/tickets|tickets)\/([^/]+)/);
    return match ? match[1] : undefined;
  }, [pathname]);

  const activeMessages = activeThreadId ? messagesByThread[activeThreadId] || [] : [];
  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const isArchived = !!activeThread?.archived;

  const sortedThreads = useMemo(
    () => sortThreadsByActivity(threads, messagesByThread),
    [threads, messagesByThread],
  );

  const refreshThreadTitle = useCallback(
    async (threadId: string) => {
      const state = useChatStore.getState();
      const thread = state.threads.find((t) => t.id === threadId);
      if (!thread) return;

      const msgs = state.messagesByThread[threadId] ?? [];
      const local = deriveThreadTitleFromMessages(msgs);
      if (local) autoTitleThread(threadId, local);

      const updated = useChatStore.getState().threads.find((t) => t.id === threadId);
      if (updated && !isGenericThreadTitle(updated.title)) return;

      try {
        const res = await api.post<{ title: string | null }>(
          `/chat/thread/${encodeURIComponent(threadId)}/suggest-title`,
        );
        if (res.data?.title) autoTitleThread(threadId, res.data.title);
      } catch {
        /* optional */
      }
    },
    [autoTitleThread],
  );

  const ensureActiveThread = useCallback(() => {
    if (!user?.id) return null;
    const state = useChatStore.getState();
    if (state.activeThreadId && state.threads.some((t) => t.id === state.activeThreadId)) {
      return state.activeThreadId;
    }
    if (state.threads.length > 0) {
      setActiveThread(state.threads[0].id);
      return state.threads[0].id;
    }
    const id = createThread(undefined, user.id);
    addMessage(id, { role: 'assistant', content: greeting });
    return id;
  }, [user?.id, setActiveThread, createThread, addMessage, greeting]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ threads: ServerThreadSummary[] }>('/chat/threads');
        if (cancelled || !res.data?.threads?.length) return;
        mergeServerThreads(res.data.threads);
        const top = res.data.threads.slice(0, 6);
        for (const row of top) {
          if (row.threadId) void refreshThreadTitle(row.threadId);
        }
      } catch {
        // optional until backend is deployed
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, mergeServerThreads, refreshThreadTitle]);

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
        // Server history optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeThreadId, user, setThreadMessages]);

  const sendMessage = async (
    text: string,
    options?: {
      editingMessageId?: string | null;
      imageBase64?: string | null;
    },
  ) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return false;

    const threadId = ensureActiveThread();
    if (!threadId) return false;

    const editingMessageId = options?.editingMessageId ?? null;
    const isEditing = !!editingMessageId;
    let historyPayload;

    if (isEditing && editingMessageId) {
      updateMessage(threadId, editingMessageId, trimmed);
      const idx = activeMessages.findIndex((m) => m.id === editingMessageId);
      const base = idx > 0 ? activeMessages.slice(0, idx) : [];
      historyPayload = base.slice(-100).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : ('user' as const),
        content: m.content,
      }));
    } else {
      historyPayload = activeMessages.slice(-100).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : ('user' as const),
        content: m.content,
      }));
      addMessage(threadId, {
        role: 'user',
        content: options?.imageBase64 ? `${trimmed}\n[photo attached]` : trimmed,
      });
    }

    setSending(true);
    try {
      const res = await api.post<{
        reply: string;
        ticketId?: string | null;
        ticketCreated?: boolean;
        archiveThread?: boolean;
        sources?: ChatSource[];
      }>('/chat/message', {
        message: trimmed,
        threadId,
        ticketId: currentTicketId,
        history: historyPayload,
        allowTicketCreation: true,
        ...(options?.imageBase64 && !isEditing ? { imageBase64: options.imageBase64 } : {}),
      });

      const replyText = res.data.reply || '…';
      const sources = Array.isArray(res.data.sources) ? res.data.sources : undefined;

      if (res.data.ticketCreated && res.data.ticketId) {
        window.dispatchEvent(
          new CustomEvent('smartmaint-ticket-created', { detail: { ticketId: res.data.ticketId } }),
        );
      }

      if (res.data.archiveThread) {
        setThreadArchived(threadId, true);
      } else if (
        /see you on the floor|à bientôt sur le floor|glad I could help|content d'avoir pu aider/i.test(
          replyText,
        )
      ) {
        setThreadArchived(threadId, true);
      }

      if (isEditing && editingMessageId) {
        updateNextAssistantMessage(threadId, editingMessageId, replyText, sources);
      } else {
        addMessage(threadId, { role: 'assistant', content: replyText, sources });
      }
      void refreshThreadTitle(threadId);
      return true;
    } catch (err: unknown) {
      console.error('Techo chat error', err);
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg =
        axiosErr.response?.data?.message ||
        (Array.isArray(axiosErr.response?.data?.message)
          ? axiosErr.response?.data?.message.join(', ')
          : null) ||
        'Sorry, I could not contact the AI service right now. Please try again later.';
      addMessage(threadId, {
        role: 'assistant',
        content: typeof msg === 'string' ? msg : 'Sorry, something went wrong. Please try again.',
      });
      return false;
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = () => {
    if (!user?.id) return null;
    const id = createThread(undefined, user.id);
    addMessage(id, { role: 'assistant', content: greeting });
    return id;
  };

  const resetActiveThread = () => {
    if (!activeThreadId) return;
    resetThread(activeThreadId);
    addMessage(activeThreadId, { role: 'assistant', content: greeting });
  };

  const toggleArchived = () => {
    if (!activeThread) return;
    setThreadArchived(activeThread.id, !activeThread.archived);
  };

  const filterThreads = (filter: ThreadFilter) => {
    if (filter === 'active') return sortedThreads.filter((t) => !t.archived);
    if (filter === 'done') return sortedThreads.filter((t) => t.archived);
    return sortedThreads;
  };

  return {
    user,
    greeting,
    threads: sortedThreads,
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
    setThreadArchived,
    ensureActiveThread,
    refreshThreadTitle,
    getThreadDisplayTitle: (threadId: string) => {
      const t = threads.find((x) => x.id === threadId);
      if (!t) return 'New chat';
      return getThreadDisplayTitle(t, messagesByThread[threadId]);
    },
  };
}

export function useTechoScrollToBottom(deps: unknown[]) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return messagesEndRef;
}
