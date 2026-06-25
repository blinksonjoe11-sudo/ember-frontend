import { useEffect, useRef, useState } from "react";
import { chatApi } from "../api/endpoints";
import type { Message } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useSocketCtx } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import Avatar from "../components/Avatar";

interface Props {
  conversationId: string;
  title: string;
  onBack: () => void;
}

export default function ChatScreen({ conversationId, title, onBack }: Props) {
  const { user } = useAuth();
  const { subscribe, setActiveConversation } = useSocketCtx();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const lastTypingSent = useRef(0);

  const scrollDown = () => {
    requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
    });
  };

  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, setActiveConversation]);

  useEffect(() => {
    (async () => {
      try {
        const { messages } = await chatApi.messages(conversationId);
        setMessages(messages);
        scrollDown();
        chatApi.markRead(conversationId).catch(() => {});
      } catch {
        /* ignore */
      }
    })();
  }, [conversationId]);

  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "message") {
        const m = e.payload;
        if (m.conversationId !== conversationId) return;
        if (m.senderId === user?.id) return;
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, {
            id: m.id, conversationId: m.conversationId, senderId: m.senderId,
            senderName: m.senderName, body: m.body, createdAt: m.createdAt,
          }];
        });
        setPartnerTyping(false);
        scrollDown();
        chatApi.markRead(conversationId).catch(() => {});
      }

      if (e.type === "typing" && e.payload.conversationId === conversationId && e.payload.userId !== user?.id) {
        setPartnerTyping(true);
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setPartnerTyping(false), 3000);
      }

      if (e.type === "read" && e.payload.conversationId === conversationId && e.payload.readerId !== user?.id) {
        setMessages((prev) =>
          prev.map((m) => (m.senderId === user?.id ? { ...m, readAt: e.payload.readAt } : m))
        );
      }
    });
  }, [subscribe, conversationId, user?.id]);

  const onType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      chatApi.typing(conversationId).catch(() => {});
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");

    const tempId = "temp-" + Date.now();
    setMessages((prev) => [...prev, {
      id: tempId, conversationId, senderId: user!.id, body,
      createdAt: new Date().toISOString(), readAt: null,
    }]);
    scrollDown();

    try {
      const res = await chatApi.send(conversationId, body);
      if (res.status === "held") {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        toast(res.message || "Message held for review.");
      } else {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: res.id } : m)));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast("Could not send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-wrap">
      <div className="chat-header">
        <button className="chat-back" onClick={onBack} aria-label="Back">‹</button>
        <Avatar name={title} size="sm" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          {partnerTyping && <div style={{ fontSize: 12, color: "var(--accent)" }}>typing…</div>}
        </div>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 ? (
          <div className="empty">Say hello.</div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`bubble ${mine ? "bubble-me" : "bubble-them"}`}>
                {!mine && m.senderName && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>
                    {m.senderName}
                  </div>
                )}
                {m.body}
                {mine && (
                  <span className={`tick ${m.readAt ? "read" : ""}`} aria-label={m.readAt ? "Read" : "Sent"}>
                    {m.readAt ? "✓✓" : "✓"}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="chat-input">
        <input
          className="input"
          placeholder="Message"
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        />
        <button className="chat-send" onClick={send} disabled={sending} aria-label="Send">↑</button>
      </div>
    </div>
  );
}