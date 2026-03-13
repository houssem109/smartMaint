import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: number;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  archived?: boolean;
}

interface ChatState {
  isOpen: boolean;
  isSending: boolean;
  threads: ChatThread[];
  activeThreadId: string | null;
  messagesByThread: Record<string, ChatMessage[]>;
  open: () => void;
  close: () => void;
  createThread: (title?: string) => string;
  setActiveThread: (id: string) => void;
  addMessage: (threadId: string, msg: Omit<ChatMessage, 'id' | 'createdAt'>) => void;
  updateMessage: (threadId: string, messageId: string, content: string) => void;
  updateNextAssistantMessage: (threadId: string, afterMessageId: string, content: string) => void;
  setSending: (sending: boolean) => void;
  resetThread: (threadId: string) => void;
  deleteThread: (id: string) => void;
  setThreadArchived: (id: string, archived: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      isSending: false,
      threads: [],
      activeThreadId: null,
      messagesByThread: {},
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      createThread: (title?: string) => {
        const state = get();
        const index = state.threads.length + 1;
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const threadTitle = title || `Conversation ${index}`;
        const createdAt = Date.now();
        set({
          threads: [...state.threads, { id, title: threadTitle, createdAt, archived: false }],
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
          const newMessage: ChatMessage = {
            ...msg,
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            createdAt: Date.now(),
          };
          return {
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
      updateNextAssistantMessage: (threadId, afterMessageId, content) =>
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
            idx === targetIndex ? { ...m, content } : m,
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
    }),
    {
      name: 'techo-chat-storage',
      storage: createJSONStorage(() => localStorage),
      // Optional: limit what we persist (skip isOpen/isSending flags)
      partialize: (state) => ({
        threads: state.threads,
        activeThreadId: state.activeThreadId,
        messagesByThread: state.messagesByThread,
      } as ChatState),
    },
  ),
);

