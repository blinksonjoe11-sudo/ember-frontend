import { useEffect, useRef, useState, Fragment } from "react";
import { chatApi } from "../api/endpoints";
import type { Message } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useSocketCtx } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import Avatar from "../components/Avatar";
import VoiceNote from "../components/VoiceNote";




interface Props {
  conversationId: string;
  title: string;
  isGroup?: boolean;
  avatarUrl?: string;
  onStartCall?: () => void;
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

function typingText(typers: Record<string, string>, isGroup: boolean): string | null {
  const names = Object.values(typers);
  if (names.length === 0) return null;
  if (!isGroup) return "typing…";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}

function recordingText(recorders: Record<string, string>, isGroup: boolean): string | null {
  const names = Object.values(recorders);
  if (names.length === 0) return null;
  if (!isGroup) return "recording audio…";
  if (names.length === 1) return `${names[0]} is recording…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are recording…`;
  return "Several people are recording…";
}

export default function ChatScreen({ conversationId, title, isGroup = false, avatarUrl, onStartCall, onBack }: Props) {


  const { user } = useAuth();
  const { subscribe, setActiveConversation, markLoungeRead } = useSocketCtx();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typers, setTypers] = useState<Record<string, string>>({});
  const typerTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [editing, setEditing] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const touchStartX = useRef(0);
  const swipingId = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [attachMenu, setAttachMenu] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval>>();
  const [recorders, setRecorders] = useState<Record<string, string>>({});
  const recorderTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [kbOffset, setKbOffset] = useState(0);
  const [pressedId, setPressedId] = useState<string | null>(null);
  





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
        if (isGroup) markLoungeRead(conversationId);
      } catch {
        /* ignore */
      }
    })();
  }, [conversationId]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      // How much the keyboard covers: full height minus the visible viewport.
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setKbOffset(covered > 0 ? covered : 0);
      scrollDown();
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

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
            type: m.type, mediaUrl: m.mediaUrl, mediaName: m.mediaName,
            replyToId: m.replyToId, replyBody: m.replyBody, replySender: m.replySender,
          }];
        });
        scrollDown();
        setTypers((prev) => {
          const next = { ...prev };
          delete next[m.senderId];
          return next;
        });
        setRecorders((prev) => {
          const next = { ...prev };
          delete next[m.senderId];
          return next;
        });
        chatApi.markRead(conversationId).catch(() => {});
      }

      if (e.type === "typing" && e.payload.conversationId === conversationId && e.payload.userId !== user?.id) {
        const uid = e.payload.userId as string;
        const name = (e.payload.name as string) || "Someone";
        setTypers((prev) => ({ ...prev, [uid]: name }));
        clearTimeout(typerTimers.current[uid]);
        typerTimers.current[uid] = setTimeout(() => {
          setTypers((prev) => {
            const next = { ...prev };
            delete next[uid];
            return next;
          });
        }, 3000);
      }

      if (e.type === "read" && e.payload.conversationId === conversationId && e.payload.readerId !== user?.id) {
        setMessages((prev) =>
          prev.map((m) => (m.senderId === user?.id ? { ...m, readAt: e.payload.readAt } : m))
        );
      }

      if (e.type === "recording" && e.payload.conversationId === conversationId && e.payload.userId !== user?.id) {
        const uid = e.payload.userId as string;
        const name = (e.payload.name as string) || "Someone";
        setRecorders((prev) => ({ ...prev, [uid]: name }));
        clearTimeout(recorderTimers.current[uid]);
        recorderTimers.current[uid] = setTimeout(() => {
          setRecorders((prev) => {
            const next = { ...prev };
            delete next[uid];
            return next;
          });
        }, 2000);
      }

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

    if (editing) {
      const target = editing;
      setSending(true);
      setEditing(null);
      setText("");
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

    setSending(true);
    setText("");
    const replyingTo = replyTo;
    setReplyTo(null);
    const tempId = "temp-" + Date.now();
    setMessages((prev) => [...prev, {
      id: tempId, conversationId, senderId: user!.id, body,
      createdAt: new Date().toISOString(), readAt: null,
      replyToId: replyingTo?.id,
      replyBody: replyingTo?.body,
      replySender: replyingTo?.senderId === user?.id ? "You" : replyingTo?.senderName,
    }]);
    scrollDown();
    try {
      const res = await chatApi.send(conversationId, body, replyingTo?.id);
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

  const pickImage = () => fileInputRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Please choose an image."); return; }
    if (file.size > 10 * 1024 * 1024) { toast("Image must be 10 MB or smaller."); return; }

    setUploading(true);
    const replyingTo = replyTo;          // ← capture
    setReplyTo(null);                    // ← clear
    const tempId = "temp-" + Date.now();
    const localUrl = URL.createObjectURL(file);
    setMessages((prev) => [...prev, {
      id: tempId, conversationId, senderId: user!.id, body: "",
      type: "image", mediaUrl: localUrl, mediaName: file.name,
      createdAt: new Date().toISOString(), readAt: null,
      replyToId: replyingTo?.id,                                    // ← add
      replyBody: replyingTo?.body,                                  // ← add
      replySender: replyingTo?.senderId === user?.id ? "You" : replyingTo?.senderName, // ← add
    }]);
    scrollDown();
    try {
      const res = await chatApi.sendMedia(conversationId, file, replyingTo?.id);  // ← pass
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: res.id, mediaUrl: res.mediaUrl } : m))
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast("Could not send image.");
    } finally {
      setUploading(false);
    }
  };

  const pickFile = () => docInputRef.current?.click();

  const onDocChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast("File must be 25 MB or smaller.");
      return;
    }
    setUploading(true);
    const replyingTo = replyTo;
    setReplyTo(null);
    const tempId = "temp-" + Date.now();
    setMessages((prev) => [...prev, {
      id: tempId, conversationId, senderId: user!.id, body: "",
      type: "file", mediaUrl: "", mediaName: file.name,
      createdAt: new Date().toISOString(), readAt: null,
      replyToId: replyingTo?.id,
      replyBody: replyingTo?.body,
      replySender: replyingTo?.senderId === user?.id ? "You" : replyingTo?.senderName,
    }]);
    scrollDown();
    try {
      const res = await chatApi.sendMedia(conversationId, file, replyingTo?.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: res.id, mediaUrl: res.mediaUrl, type: res.type } : m))
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast("Could not send file.");
    } finally {
      setUploading(false);
    }
  };


  const pickVideo = () => videoInputRef.current?.click();

  const onVideoChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast("Please choose a video.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast("Video must be 20 MB or smaller.");
      return;
    }
    setUploading(true);
    const replyingTo = replyTo;          // ← capture
    setReplyTo(null);  
    const tempId = "temp-" + Date.now();
    const localUrl = URL.createObjectURL(file);
    setMessages((prev) => [...prev, {
      id: tempId, conversationId, senderId: user!.id, body: "",
      type: "video", mediaUrl: localUrl, mediaName: file.name,
      createdAt: new Date().toISOString(), readAt: null,
      replyToId: replyingTo?.id,                                    // ← add
      replyBody: replyingTo?.body,                                  // ← add
      replySender: replyingTo?.senderId === user?.id ? "You" : replyingTo?.senderName,
    }]);
    scrollDown();
    try {
      const res = await chatApi.sendMedia(conversationId, file, replyingTo?.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: res.id, mediaUrl: res.mediaUrl, type: res.type } : m))
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast("Could not send video.");
    } finally {
      setUploading(false);
    }
  };


  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        await uploadVoice(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordSecs(0);
      chatApi.recording(conversationId).catch(() => {}); // immediate
      recordTimerRef.current = setInterval(() => {
        setRecordSecs((s) => s + 1);
        chatApi.recording(conversationId).catch(() => {}); // heartbeat
      }, 1000);
    } catch {
      toast("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    clearInterval(recordTimerRef.current);
    setRecording(false);
    mediaRecorderRef.current?.stop();
  };

  const cancelRecording = () => {
    clearInterval(recordTimerRef.current);
    setRecording(false);
    audioChunksRef.current = [];
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.onstop = null as any; // don't upload
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    }
  };

  const uploadVoice = async (blob: Blob) => {
    setUploading(true);
    const replyingTo = replyTo;          // ← capture
    setReplyTo(null);
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
    const tempId = "temp-" + Date.now();
    const localUrl = URL.createObjectURL(blob);
    setMessages((prev) => [...prev, {
      id: tempId, conversationId, senderId: user!.id, body: "",
      type: "audio", mediaUrl: localUrl, mediaName: file.name,
      createdAt: new Date().toISOString(), readAt: null,
       replyToId: replyingTo?.id,                                    // ← add
      replyBody: replyingTo?.body,                                  // ← add
      replySender: replyingTo?.senderId === user?.id ? "You" : replyingTo?.senderName,
    }]);
    scrollDown();
    try {
       const res = await chatApi.sendMedia(conversationId, file, replyingTo?.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: res.id, mediaUrl: res.mediaUrl, type: res.type } : m))
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast("Could not send voice note.");
    } finally {
      setUploading(false);
    }
  };

  const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;


  const startPress = (m: Message) => {
    if (m.deletedForEveryone) return;
    setPressedId(m.id);
    longPressTimer.current = setTimeout(() => {
      setMenuFor(m);
      setPressedId(null);
      window.getSelection?.()?.removeAllRanges();
    }, 450);
  };
  const cancelPress = () => {
    clearTimeout(longPressTimer.current);
    setPressedId(null);
  };
  const onTouchStartBubble = (m: Message, e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    swipingId.current = m.id;
    startPress(m);
  };
  const onTouchMoveBubble = (e: React.TouchEvent) => {
    cancelPress();
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx > 60 && swipingId.current) {
      const m = messages.find((x) => x.id === swipingId.current);
      if (m && !m.deletedForEveryone) setReplyTo(m);
      swipingId.current = null;
    }
  };
  const onTouchEndBubble = () => { cancelPress(); swipingId.current = null; };

  const doDeleteForMe = async (m: Message) => {
    setMenuFor(null);
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    try {
      await chatApi.deleteForMe(m.id);
    } catch {
      toast("Could not delete.");
    }
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

  const startEdit = (m: Message) => {
    setMenuFor(null);
    setReplyTo(null);
    setEditing(m);
    setText(m.body);
  };
  const cancelEdit = () => {
    setEditing(null);
    setText("");
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

  const scrollToMessage = (id: string) => {
    const el = document.getElementById("msg-" + id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bubble-flash");
      setTimeout(() => el.classList.remove("bubble-flash"), 1200);
    }
  };

  const canEdit = (m: Message) =>
    m.senderId === user?.id &&
    !m.deletedForEveryone &&
    (m.type === "text" || !m.type) &&
    Date.now() - new Date(m.createdAt).getTime() < 15 * 60 * 1000;

  return (
    <div className="chat-wrap">
      <div className="chat-header">
        <button className="chat-back" onClick={onBack} aria-label="Back">‹</button>
        <Avatar name={title}  url={avatarUrl} size="sm" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          {recordingText(recorders, isGroup) ? (
            <div style={{ fontSize: 12, color: "var(--ember)" }}>🎤 {recordingText(recorders, isGroup)}</div>
          ) : typingText(typers, isGroup) ? (
            <div style={{ fontSize: 12, color: "var(--accent)" }}>{typingText(typers, isGroup)}</div>
          ) : null}
        </div>
        <div style={{ position: "relative", display: "flex", gap: 5 }}>
          <button className="chat-back" onClick={() => setHeaderMenu((v) => !v)} aria-label="Menu">⋯</button>
          {!isGroup && (
          <button className="chat-back" onClick={onStartCall} aria-label="Call">📞</button>
        )}
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
                <div className={`bubble-row ${mine ? "row-mine" : "row-them"}`}>
                  {isGroup && !mine && (
                    <Avatar name={m.senderName || "?"} url={m.senderAvatar} size="sm" />
                  )}
                  <div
                    id={"msg-" + m.id}
                    className={`bubble ${mine ? "bubble-me" : "bubble-them"} ${deleted ? "bubble-deleted" : ""} ${pressedId === m.id ? "bubble-pressed" : ""}`}
                    onTouchStart={(e) => onTouchStartBubble(m, e)}
                    onTouchEnd={onTouchEndBubble}
                    onTouchMove={onTouchMoveBubble}
                    onContextMenu={(e) => { e.preventDefault(); if (!deleted) setMenuFor(m); }}
                  >
                    {m.replyToId && m.replyBody != null && (
                      <div className="reply-quote" onClick={() => scrollToMessage(m.replyToId!)}>
                        <span className="reply-quote-name">{m.replySender || "Reply"}</span>
                        <span className="reply-quote-body">{m.replyBody || "message"}</span>
                      </div>
                    )}
                    {!mine && m.senderName && !deleted && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>
                        {m.senderName}
                      </div>
                    )}
                    {deleted ? (
                      <span style={{ fontStyle: "italic", opacity: 0.7 }}>🚫 This message was deleted</span>
                    ) : (
                      <>
                        {m.type === "image" && m.mediaUrl ? (
                          <img
                            src={m.mediaUrl}
                            alt={m.mediaName || "image"}
                            className="bubble-image"
                            onClick={() => window.open(m.mediaUrl, "_blank")}
                            onLoad={scrollDown}
                          />
                        ) : m.type === "video" && m.mediaUrl ? (
                          <video
                            src={m.mediaUrl}
                            className="bubble-video"
                            controls
                            preload="metadata"
                            onLoadedData={scrollDown}
                          />
                        ) : m.type === "audio" && m.mediaUrl ? (
                          <VoiceNote src={m.mediaUrl} mine={mine} />
                        ) : m.type === "file" ? (
                          <a
                            className="file-card"
                            href={m.mediaUrl || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={m.mediaName}
                          >
                            <span className="file-icon">📄</span>
                            <span className="file-name">{m.mediaName || "File"}</span>
                            <span className="file-dl">⬇</span>
                          </a>
                        ) : (
                          m.body
                        )}
                        <span className="bubble-time">
                          {m.editedAt && <span style={{ opacity: 0.7, marginRight: 4 }}>edited</span>}
                          {formatTime(m.createdAt)}
                          {mine && !isGroup && (
                            <span className={`tick ${m.readAt ? "read" : ""}`}>
                              {m.readAt ? " ✓✓" : " ✓"}
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
      </div>

      {menuFor && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuFor(null)} />
          <div className="msg-sheet">
            {!menuFor.deletedForEveryone && (
              <button onClick={() => { setReplyTo(menuFor); setMenuFor(null); }}>Reply</button>
            )}
            {canEdit(menuFor) && <button onClick={() => startEdit(menuFor)}>Edit</button>}
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

      <div style={{ transform: `translateY(-${kbOffset}px)`, transition: "transform 0.15s ease" }}>
        {replyTo && !editing && (
          <div className="edit-bar">
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Replying to {replyTo.senderId === user?.id ? "yourself" : replyTo.senderName}: {replyTo.body.slice(0, 40)}
            </span>
            <button onClick={() => setReplyTo(null)}>✕</button>
          </div>
        )}
        {editing && (
          <div className="edit-bar">
            <span>Editing message</span>
            <button onClick={cancelEdit}>✕</button>
          </div>
        )}
        <div className="chat-input">
          {/* Hidden inputs */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChosen} />
          <input ref={videoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onVideoChosen} />
          <input ref={docInputRef} type="file" style={{ display: "none" }} onChange={onDocChosen} />

          {/* Attach + menu */}
          <div style={{ position: "relative" }}>
            <button
              className="chat-attach"
              onClick={() => setAttachMenu((v) => !v)}
              disabled={uploading}
              aria-label="Attach"
            >
              {uploading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "＋"}
            </button>
            {attachMenu && (
              <>
                <div className="menu-backdrop" onClick={() => setAttachMenu(false)} />
                <div className="attach-menu">
                  <button onClick={() => { setAttachMenu(false); pickImage(); }}>🖼️ Photo</button>
                  <button onClick={() => { setAttachMenu(false); pickVideo(); }}>🎥 Video</button>
                  <button onClick={() => { setAttachMenu(false); pickFile(); }}>📎 File</button>
                </div>
              </>
            )}
          </div>

          {recording ? (
            <div className="recording-bar">
              <span className="rec-dot" />
              <span className="rec-time">{fmtSecs(recordSecs)}</span>
              <button className="rec-cancel" onClick={cancelRecording} aria-label="Cancel">✕</button>
              <button className="chat-send" onClick={stopRecording} aria-label="Send voice">↑</button>
            </div>
          ) : (
            <>
              <input
                className="input"
                placeholder={editing ? "Edit message" : "Message"}
                value={text}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              />
              {text.trim() || editing ? (
                <button className="chat-send" onClick={send} disabled={sending} aria-label="Send">
                  {editing ? "✓" : "↑"}
                </button>
              ) : (
                <button className="chat-send" onClick={startRecording} disabled={uploading} aria-label="Record">
                  🎤
                </button>
                
              )}
               {/* <button onClick={() => callApi.signal(conversationId, "offer", { test: 123 })}>
          📞test
        </button> */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}