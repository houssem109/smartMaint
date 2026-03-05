import { create } from 'zustand';

type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: number;
}

interface ChatState {
  isOpen: boolean;
  isSending: boolean;
  messages: ChatMessage[];
  open: () => void;
  close: () => void;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'createdAt'>) => void;
  setSending: (sending: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  isSending: false,
  messages: [],
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          createdAt: Date.now(),
        },
      ],
    })),
  setSending: (sending) => set({ isSending: sending }),
  reset: () => set({ messages: [], isSending: false }),
}));

