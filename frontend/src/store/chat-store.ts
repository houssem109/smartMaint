import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatSource {
  kind: 'pdf_chunk' | 'knowledge_entry';
  caption: string;
  score?: number;
  documentId?: string;
  chunkIndex?: number;
  knowledgeEntryId?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: number;
  /** RAG / knowledge citations for this assistant turn (from POST /chat/message). */
  sources?: ChatSource[];
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  lastActivityAt?: number;
  archived?: boolean;
}

interface ChatState {
  /** User id that owns persisted threads (prevents sharing chat between accounts on same browser). */
  ownerUserId: string | null;
  isOpen: boolean;
  isSending: boolean;
  threads: ChatThread[];
  activeThreadId: string | null;
  messagesByThread: Record<string, ChatMessage[]>;
  /** Clear chat when a different user logs in on this device. */
  ensureUserScope: (userId: string) => void;
  clearAll: () => void;
  open: () => void;
  close: () => void;
  createThread: (title?: string, userId?: string) => string;
  setActiveThread: (id: string) => void;
  addMessage: (threadId: string, msg: Omit<ChatMessage, 'id' | 'createdAt'>) => void;
  updateMessage: (threadId: string, messageId: string, content: string) => void;
  updateNextAssistantMessage: (
    threadId: string,
    afterMessageId: string,
    content: string,
    sources?: ChatSource[],
  ) => void;
  setSending: (sending: boolean) => void;
  resetThread: (threadId: string) => void;
  deleteThread: (id: string) => void;
  setThreadArchived: (id: string, archived: boolean) => void;
  setThreadTitle: (id: string, title: string) => void;
  /** Set title only when still generic (Conversation N, Saved conversation, …). */
  autoTitleThread: (id: string, title: string) => void;
  /** Replace thread messages (e.g. hydrate from server history). */
  setThreadMessages: (threadId: string, messages: ChatMessage[]) => void;
  /** Add threads discovered on the server that are not in localStorage yet. */
  mergeServerThreads: (
    serverThreads: { threadId: string; title: string; lastMessageAt: string; messageCount: number }[],
  ) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      isOpen: false,
      isSending: false,
      threads: [],
      activeThreadId: null,
      messagesByThread: {},
      ensureUserScope: (userId: string) => {
        const state = get();
        if (state.ownerUserId === userId) return;
        set({
          ownerUserId: userId,
          isOpen: false,
          isSending: false,
          threads: [],
          activeThreadId: null,
          messagesByThread: {},
        });
      },
      clearAll: () =>
        set({
          ownerUserId: null,
          isOpen: false,
          isSending: false,
          threads: [],
          activeThreadId: null,
          messagesByThread: {},
        }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      createThread: (title?: string, userId?: string) => {
        const state = get();
        const prefix = userId ? `${userId.slice(0, 8)}-` : '';
        const id = `${prefix}${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const threadTitle = title || 'New chat';
        const createdAt = Date.now();
        set({
          threads: [
            ...state.threads,
            { id, title: threadTitle, createdAt, lastActivityAt: createdAt, archived: false },
          ],
          activeThreadId: id,
          messagesByThread: {
            ...state.messagesByThread,
            [id]: [],
          },
        });
        return id;
      },
      setActiveThread: (id: string) => {
        const state = get();
        if (!state.threads.find((t) => t.id === id)) return;
        set({ activeThreadId: id });
      },
      addMessage: (threadId, msg) =>
        set((state) => {
          const existing = state.messagesByThread[threadId] || [];
          const now = Date.now();
          const newMessage: ChatMessage = {
            ...msg,
            id: `${now}-${Math.random().toString(16).slice(2)}`,
            createdAt: now,
          };
          return {
            threads: state.threads.map((t) =>
              t.id === threadId ? { ...t, lastActivityAt: now } : t,
            ),
            messagesByThread: {
              ...state.messagesByThread,
              [threadId]: [...existing, newMessage],
            },
          };
        }),
      setSending: (sending) => set({ isSending: sending }),
      updateMessage: (threadId, messageId, content) =>
        set((state) => {
          const existing = state.messagesByThread[threadId] || [];
          const updated = existing.map((m) =>
            m.id === messageId ? { ...m, content } : m,
          );
          return {
            messagesByThread: {
              ...state.messagesByThread,
              [threadId]: updated,
            },
          };
        }),
      updateNextAssistantMessage: (threadId, afterMessageId, content, sources) =>
        set((state) => {
          const existing = state.messagesByThread[threadId] || [];
          const startIndex = existing.findIndex((m) => m.id === afterMessageId);
          if (startIndex === -1) return state;
          const relativeIndex = existing
            .slice(startIndex + 1)
            .findIndex((m) => m.role === 'assistant');
          if (relativeIndex === -1) return state;
          const targetIndex = startIndex + 1 + relativeIndex;
          const updated = existing.map((m, idx) =>
            idx === targetIndex
              ? { ...m, content, ...(sources !== undefined ? { sources } : {}) }
              : m,
          );
          return {
            messagesByThread: {
              ...state.messagesByThread,
              [threadId]: updated,
            },
          };
        }),
      resetThread: (threadId: string) =>
        set((state) => ({
          messagesByThread: {
            ...state.messagesByThread,
            [threadId]: [],
          },
          isSending: false,
        })),
      deleteThread: (id: string) =>
        set((state) => {
          const remainingThreads = state.threads.filter((t) => t.id !== id);
          const { [id]: _, ...restMessages } = state.messagesByThread;
          let nextActive: string | null = state.activeThreadId;
          if (state.activeThreadId === id) {
            nextActive = remainingThreads.length > 0 ? remainingThreads[0].id : null;
          }
          return {
            threads: remainingThreads,
            messagesByThread: restMessages,
            activeThreadId: nextActive,
          };
        }),
      setThreadArchived: (id: string, archived: boolean) =>
        set((state) => ({
          threads: state.threads.map((t) => (t.id === id ? { ...t, archived } : t)),
        })),
      setThreadTitle: (id: string, title: string) =>
        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === id ? { ...t, title: title.trim() || t.title } : t,
          ),
        })),
      autoTitleThread: (id: string, title: string) =>
        set((state) => {
          const thread = state.threads.find((t) => t.id === id);
          if (!thread || !title.trim()) return state;
          const generic =
            !thread.title?.trim() ||
            /^(conversation\s*\d+|saved conversation|new chat|techo chat|chat|untitled)$/i.test(
              thread.title.trim(),
            );
          if (!generic) return state;
          return {
            threads: state.threads.map((t) =>
              t.id === id ? { ...t, title: title.trim() } : t,
            ),
          };
        }),
      setThreadMessages: (threadId: string, messages: ChatMessage[]) =>
        set((state) => ({
          messagesByThread: {
            ...state.messagesByThread,
            [threadId]: messages,
          },
        })),
      mergeServerThreads: (serverThreads) =>
        set((state) => {
          if (!serverThreads.length) return state;
          const existingById = new Map(state.threads.map((t) => [t.id, t]));
          const messagesByThread = { ...state.messagesByThread };
          let threads = [...state.threads];

          for (const row of serverThreads) {
            const id = row.threadId?.trim();
            if (!id) continue;
            const serverTitle = row.title?.trim();
            const lastAt = Date.parse(row.lastMessageAt) || Date.now();
            const existing = existingById.get(id);

            if (existing) {
              const generic =
                !existing.title?.trim() ||
                /^(conversation\s*\d+|saved conversation|new chat|techo chat|chat|untitled)$/i.test(
                  existing.title.trim(),
                );
              if (
                generic &&
                serverTitle &&
                !/^(saved conversation|new chat)$/i.test(serverTitle)
              ) {
                threads = threads.map((t) =>
                  t.id === id ? { ...t, title: serverTitle, lastActivityAt: lastAt } : t,
                );
              } else if (!existing.lastActivityAt || lastAt > existing.lastActivityAt) {
                threads = threads.map((t) =>
                  t.id === id ? { ...t, lastActivityAt: lastAt } : t,
                );
              }
              continue;
            }

            existingById.set(id, {
              id,
              title: serverTitle && !/^saved conversation$/i.test(serverTitle) ? serverTitle : 'New chat',
              createdAt: lastAt,
              lastActivityAt: lastAt,
              archived: false,
            });
            threads.push(existingById.get(id)!);
            if (!messagesByThread[id]) {
              messagesByThread[id] = [];
            }
          }

          return {
            threads,
            messagesByThread,
            activeThreadId: state.activeThreadId ?? threads[0]?.id ?? null,
          };
        }),
    }),
    {
      name: 'techo-chat-storage',
      storage: createJSONStorage(() => localStorage),
      // Optional: limit what we persist (skip isOpen/isSending flags)
      partialize: (state) => ({
        ownerUserId: state.ownerUserId,
        threads: state.threads,
        activeThreadId: state.activeThreadId,
        messagesByThread: state.messagesByThread,
      } as ChatState),
    },
  ),
);

