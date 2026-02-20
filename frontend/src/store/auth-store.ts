import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  fullName?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        // Set cookies for middleware access
        if (typeof document !== 'undefined') {
          document.cookie = `token=${token}; path=/; max-age=604800; SameSite=Lax`;
          document.cookie = `userRole=${user.role}; path=/; max-age=604800; SameSite=Lax`;
        }
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('token');
        // Clear cookies
        if (typeof document !== 'undefined') {
          document.cookie = 'token=; path=/; max-age=0';
          document.cookie = 'userRole=; path=/; max-age=0';
        }
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
