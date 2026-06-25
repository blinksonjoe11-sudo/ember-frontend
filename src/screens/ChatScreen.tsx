import { useEffect, useRef, useState, Fragment } from "react";
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

function mergeMessages(local: Message[], incoming: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const m of incoming) byId.set(m.id, m);
  for (const m of local) {
    if (!byId.has(m.id)) {
      byId.set(m.id, m);
    } else {
      const serverMsg = byId.get(m.id)!;
      byId.set(m.id, { ...serverMsg, readAt: serverMsg.readAt || m.readAt });
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function ChatScreen({ conversationId, title, onBack }: Props) {
  const { user } = useAuth();
  const { subscribe, setActiveConversation } = useSocketCtx();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [menuFor, setMenuFor] = useState<Message | null>(null); // message whose menu is open
  const [headerMenu, setHeaderMenu] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const lastTypingSent = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const [editing, setEditing] = useState<Message | null>(null);

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
        const { messages: server } = await chatApi.messages(conversationId);
        setMessages((prev) => mergeMessages(prev, server || []));
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

      // Someone deleted a message for everyone → show placeholder live.
      if (e.type === "message_deleted" && e.payload.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === e.payload.messageId ? { ...m, deletedForEveryone: true, body: "" } : m))
        );
      }

      if (e.type === "message_edited" && e.payload.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === e.payload.messageId
            ? { ...m, body: e.payload.body, editedAt: e.payload.editedAt }
            : m))
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

    // Edit mode
    if (editing) {
      const target = editing;
      setSending(true);
      setEditing(null);
      setText("");
      // optimistic
      setMessages((prev) =>
        prev.map((m) => (m.id === target.id ? { ...m, body, editedAt: new Date().toISOString() } : m))
      );
      try {
        await chatApi.editMessage(target.id, body);
      } catch {
        toast("Could not edit message.");
      } finally {
        setSending(false);
      }
      return;
    }

    // Normal send
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

  // ----- long-press (touch) -----
  const startPress = (m: Message) => {
    if (m.deletedForEveryone) return;
    longPressTimer.current = setTimeout(() => setMenuFor(m), 450);
  };
  const cancelPress = () => clearTimeout(longPressTimer.current);

  // ----- delete actions -----
  const doDeleteForMe = async (m: Message) => {
    setMenuFor(null);
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    try {
      await chatApi.deleteForMe(m.id);
    } catch {
      toast("Could not delete.");
    }
  };

  const startEdit = (m: Message) => {
    setMenuFor(null);
    setEditing(m);
    setText(m.body);
  };

  const cancelEdit = () => {
    setEditing(null);
    setText("");
  };

  const doDeleteForEveryone = async (m: Message) => {
    setMenuFor(null);
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, deletedForEveryone: true, body: "" } : x))
    );
    try {
      await chatApi.deleteForEveryone(m.id);
    } catch {
      toast("Could not delete for everyone.");
    }
  };

  const doClearChat = async () => {
    setHeaderMenu(false);
    try {
      await chatApi.clearChat(conversationId);
      setMessages([]);
      toast("Chat cleared.");
    } catch {
      toast("Could not clear chat.");
    }
  };

  return (
    <div className="chat-wrap">
      <div className="chat-header">
        <button className="chat-back" onClick={onBack} aria-label="Back">‹</button>
        <Avatar name={title} size="sm" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          {partnerTyping && <div style={{ fontSize: 12, color: "var(--accent)" }}>typing…</div>}
        </div>
        <div style={{ position: "relative" }}>
          <button className="chat-back" onClick={() => setHeaderMenu((v) => !v)} aria-label="Menu">⋯</button>
          {headerMenu && (
            <>
              <div className="menu-backdrop" onClick={() => setHeaderMenu(false)} />
              <div className="msg-menu" style={{ right: 0, top: 44 }}>
                <button onClick={doClearChat}>Clear chat</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 ? (
          <div className="empty">Say hello.</div>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderId === user?.id;
            const showDivider = i === 0 || dayKey(m.createdAt) !== dayKey(messages[i - 1].createdAt);
            const deleted = m.deletedForEveryone;
            return (
              <Fragment key={m.id}>
                {showDivider && (
                  <div className="day-divider"><span>{dayLabel(m.createdAt)}</span></div>
                )}
                <div
                  className={`bubble ${mine ? "bubble-me" : "bubble-them"} ${deleted ? "bubble-deleted" : ""}`}
                  onTouchStart={() => startPress(m)}
                  onTouchEnd={cancelPress}
                  onTouchMove={cancelPress}
                  onContextMenu={(e) => { e.preventDefault(); if (!deleted) setMenuFor(m); }}
                >
                  {!mine && m.senderName && !deleted && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>
                      {m.senderName}
                    </div>
                  )}
                  {deleted ? (
                    <span style={{ fontStyle: "italic", opacity: 0.7 }}>🚫 This message was deleted</span>
                  ) : (
                    <>
                      {m.body}
                      <span className="bubble-time">
                        {m.editedAt && <span style={{ opacity: 0.7, marginRight: 4 }}>edited</span>}
                        {formatTime(m.createdAt)}
                        {mine && (
                          <span className={`tick ${m.readAt ? "read" : ""}`}>
                            {m.readAt ? " ✓✓" : " ✓"}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>
              </Fragment>
            );
          })
        )}
      </div>

      {/* Message action menu */}
     {menuFor && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuFor(null)} />
          <div className="msg-sheet">
            {menuFor.senderId === user?.id &&
              !menuFor.deletedForEveryone &&
              Date.now() - new Date(menuFor.createdAt).getTime() < 15 * 60 * 1000 && (
                <button onClick={() => startEdit(menuFor)}>Edit</button>
              )}
            <button onClick={() => doDeleteForMe(menuFor)}>Delete for me</button>
            {menuFor.senderId === user?.id && (
              <button className="danger" onClick={() => doDeleteForEveryone(menuFor)}>
                Delete for everyone
              </button>
            )}
            <button onClick={() => setMenuFor(null)}>Cancel</button>
          </div>
        </>
      )}

      <div>
        {editing && (
          <div className="edit-bar">
            <span>Editing message</span>
            <button onClick={cancelEdit}>✕</button>
          </div>
        )}
        <div className="chat-input">
          <input
            className="input"
            placeholder={editing ? "Edit message" : "Message"}
            value={text}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          />
          <button className="chat-send" onClick={send} disabled={sending} aria-label="Send">
            {editing ? "✓" : "↑"}
          </button>
        </div>
      </div>
    </div>
  );
}