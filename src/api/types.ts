export type Role = "user" | "plug" | "admin";
export type PlugStatus = "pending" | "nin_submitted" | "under_review" | "approved" | "rejected";
export const CITIES = ["Lagos", "Abuja", "Port Harcourt", "Warri"] as const;
export type City = (typeof CITIES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  initials: string;
  city: string;
  role: Role;
  emailVerified: boolean;
  avatarUrl?: string;
  plugStatus?: PlugStatus;
  businessName?: string;
  online?: boolean;
}

export interface Conversation {
  id: string;
  partnerId: string;
  partnerName: string;
  lastMessage: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  body: string;
  createdAt: string;
  status?: string;
  readAt?: string | null;
  deletedForEveryone?: boolean;
  editedAt?: string | null;
  replyToId?: string | null;
  replyBody?: string | null;
  replySender?: string | null;
}

export interface Community {
  id: string;
  ownerId?: string;
  city: string;
  name: string;
  description: string;
  kind: "lounge" | "community";
  members: number;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}
