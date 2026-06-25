import { api } from "./client";
import type { AuthResult, Community, Conversation, Message, User } from "./types";

// ---------- Auth ----------
export const authApi = {
  register: (b: {
    name: string;
    email: string;
    password: string;
    city: string;
    birthYear: number;
    role: "user" | "plug";
  }) => api<{ userId: string; role: string; message: string }>("/api/auth/register", {
    method: "POST",
    body: b,
    auth: false,
  }),

  verifyEmail: (userId: string, code: string) =>
    api<AuthResult>("/api/auth/verify-email", {
      method: "POST",
      body: { userId, code },
      auth: false,
    }),

  resendCode: (userId: string) =>
    api("/api/auth/resend-code", { method: "POST", body: { userId }, auth: false }),

  forgotPassword: (email: string) =>
    api<{ message: string; userId?: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
      auth: false,
    }),

  resetPassword: (email: string, code: string, newPassword: string) =>
    api<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: { email, code, newPassword },
      auth: false,
    }),

  login: (email: string, password: string) =>
    api<AuthResult & { action?: string; userId?: string; error?: string }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),

  me: () => api<{ user: User }>("/api/me"),
};

// ---------- Plug verification ----------
export const plugApi = {
  submitNin: (b: { nin: string; businessName: string; bio: string }) =>
    api<{ status: string; message: string }>("/api/plug/nin", { method: "POST", body: b }),

  status: () => api<{ status: string; businessName: string }>("/api/plug/status"),
};

// ---------- Search ----------
export const searchApi = {
  people: (q: string, plugsOnly = false) =>
    api<{ results: User[] }>(
      `/api/search?q=${encodeURIComponent(q)}${plugsOnly ? "&type=plug" : ""}`
    ),
};

// ---------- Messaging ----------
export const chatApi = {
  start: (targetUserId: string) =>
    api<{ conversationId: string }>("/api/conversations", {
      method: "POST",
      body: { targetUserId },
    }),

  list: () => api<{ conversations: Conversation[] }>("/api/conversations"),

  messages: (conversationId: string) =>
    api<{ messages: Message[] }>(`/api/conversations/${conversationId}/messages`),

  send: (conversationId: string, body: string) =>
    api<{ id: string; status: string; message?: string }>(
      `/api/conversations/${conversationId}/messages`,
      { method: "POST", body: { body } }
    ),

  block: (userId: string) => api(`/api/users/${userId}/block`, { method: "POST" }),

  typing: (conversationId: string) =>
    api(`/api/conversations/${conversationId}/typing`, { method: "POST" }),

  markRead: (conversationId: string) =>
    api(`/api/conversations/${conversationId}/read`, { method: "POST" }),
};

// ---------- Communities / lounges ----------
export const communityApi = {
  list: () => api<{ communities: Community[] }>("/api/communities"),
  join: (id: string) =>
    api<{ ok: boolean; conversationId: string }>(`/api/communities/${id}/join`, {
      method: "POST",
    }),
};

// ---------- Devices (push) ----------
export const deviceApi = {
  register: (fcmToken: string, platform: string) =>
    api("/api/devices", { method: "POST", body: { fcmToken, platform } }),
};

// ---------- Reports ----------
export const reportApi = {
  create: (targetType: string, targetId: string, reason: string) =>
    api("/api/reports", { method: "POST", body: { targetType, targetId, reason } }),
};

// ---------- Avatar ----------
export const avatarApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    return api<{ avatarUrl: string }>("/api/avatar", {
      method: "POST",
      body: form,
      isForm: true,
    });
  },
};
