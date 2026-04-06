// src/lib/store.ts
import { create } from "zustand";
import { api } from "./api";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: false,

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await api.post<{ success: boolean; data: { user: User; accessToken: string; refreshToken: string } }>(
        "/api/auth/login",
        { email, password }
      );
      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("refreshToken", res.data.refreshToken);
      set({ user: res.data.user });
    } finally {
      set({ loading: false });
    }
  },

  register: async (email, password, name) => {
    set({ loading: true });
    try {
      const res = await api.post<{ success: boolean; data: { user: User; accessToken: string; refreshToken: string } }>(
        "/api/auth/register",
        { email, password, name }
      );
      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("refreshToken", res.data.refreshToken);
      set({ user: res.data.user });
    } finally {
      set({ loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    set({ user: null });
    window.location.href = "/login";
  },

  fetchMe: async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    try {
      const res = await api.get<{ success: boolean; data: User }>("/api/auth/me");
      set({ user: res.data });
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  },
}));
