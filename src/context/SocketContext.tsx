import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { WS_BASE } from "../api/client";
import { getAccess } from "../lib/tokens";

export interface WsEvent {
  type: "message" | "notification" | "presence" | "typing" | "read" | "message_deleted" | "message_edited" | "recording";
  payload: any;
}

type Listener = (e: WsEvent) => void;

interface SocketCtx {
  subscribe: (fn: Listener) => () => void;
  unreadByConversation: Record<string, number>;
  totalUnread: number;
  markRead: (conversationId: string) => void;
  setActiveConversation: (id: string | null) => void;
  seedUnread: (counts: Record<string, number>) => void;
}

const Ctx = createContext<SocketCtx>(null as any);

export function SocketProvider({ enabled, currentUserId, children }: {
  enabled: boolean;
  currentUserId: string | null;
  children: ReactNode;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const listeners = useRef<Set<Listener>>(new Set());
  const retryRef = useRef(0);
  const closedRef = useRef(false);
  const activeConvRef = useRef<string | null>(null);
  // Dedupe: a given message id is only ever counted once, no matter how many
  // times the frame arrives (StrictMode re-mounts, reconnect replays, etc).
  const seenMsgIds = useRef<Set<string>>(new Set());

  const [unreadByConversation, setUnread] = useState<Record<string, number>>({});

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const markRead = useCallback((conversationId: string) => {
    setUnread((prev) => {
      if (!prev[conversationId]) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, []);

  // Seed unread counts from the server (persisted, survives offline/refresh).
  // Server count wins as the baseline; live socket increments build on top.
  const seedUnread = useCallback((counts: Record<string, number>) => {
    setUnread((prev) => {
      const next = { ...prev };
      for (const [id, n] of Object.entries(counts)) {
        next[id] = Math.max(prev[id] || 0, n);
      }
      return next;
    });
  }, []);

  const setActiveConversation = useCallback((id: string | null) => {
    activeConvRef.current = id;
    if (id) markRead(id);
  }, [markRead]);

  useEffect(() => {
    if (!enabled) return;
    closedRef.current = false;
    let timer: ReturnType<typeof setTimeout>;
    let localWs: WebSocket | null = null;

    const connect = async () => {
      if (closedRef.current) return;
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

      const token = await getAccess();
      if (!token || closedRef.current) return;

      const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
      localWs = ws;
      wsRef.current = ws;

      ws.onopen = () => { retryRef.current = 0; };

      ws.onmessage = (ev) => {
        let data: WsEvent;
        try { data = JSON.parse(ev.data); } catch { return; }

        if (data.type === "message") {
          const m = data.payload;
          // Only count each unique message once.
          if (m.id && !seenMsgIds.current.has(m.id)) {
            seenMsgIds.current.add(m.id);
            const fromSelf = m.senderId === currentUserId;
            const inOpenChat = m.conversationId === activeConvRef.current;
            if (!fromSelf && !inOpenChat) {
              setUnread((prev) => ({
                ...prev,
                [m.conversationId]: (prev[m.conversationId] || 0) + 1,
              }));
            }
          }
        }
        listeners.current.forEach((fn) => fn(data));
      };

      ws.onclose = () => {
        if (closedRef.current) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
        retryRef.current += 1;
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      closedRef.current = true;
      clearTimeout(timer);
      localWs?.close();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, currentUserId]);

  const totalUnread = Object.values(unreadByConversation).reduce((a, b) => a + b, 0);

  return (
    <Ctx.Provider value={{ subscribe, unreadByConversation, totalUnread, markRead, setActiveConversation, seedUnread }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSocketCtx() {
  return useContext(Ctx);
}