import { useEffect } from "react";
import { chatApi } from "../api/endpoints";
import type { Conversation } from "../api/types";
import Avatar from "../components/Avatar";
import { useSocketCtx } from "../context/SocketContext";
import { useCachedData } from "../lib/useCachedData";
import SkeletonList from "../components/Skeleton";

export default function MessagesScreen({ onOpenChat }: { onOpenChat: (id: string, name: string, isGroup?: boolean, avatarUrl?: string) => void }) {
    const { subscribe, unreadByConversation, seedUnread } = useSocketCtx();

   const { data: convs, firstLoad, refresh } = useCachedData<Conversation[]>(
    "conversations",
    async () => (await chatApi.list()).conversations,
    []
  );

  // Seed persisted unread counts into the socket context whenever the list updates.
  useEffect(() => {
    if (convs.length) {
      const counts: Record<string, number> = {};
      for (const c of convs) if (c.unread) counts[c.id] = c.unread;
      seedUnread(counts);
    }
  }, [convs, seedUnread]);

  return (
    <div className="screen">
      <div className="header">
        <div className="eyebrow">Inbox</div>
        <h1 className="screen-title">Messages</h1>
      </div>

      {firstLoad ? (
        <SkeletonList rows={5} />
      ) : convs.length === 0 ? (
        <div className="empty">No messages yet. Head to Connect to start a chat.</div>
      ) : (
        convs.map((c) => {
          const unread = Math.max(c.unread || 0, unreadByConversation[c.id] || 0);
          return (
            <button key={c.id} className="row" onClick={() => { console.log("partnerAvatar:", c.partnerAvatar); onOpenChat(c.id, c.partnerName, false, c.partnerAvatar); }}>
              <Avatar name={c.partnerName} url={c.partnerAvatar}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-title">{c.partnerName}</div>
                <div className="row-sub" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: unread ? 600 : 400, color: unread ? "var(--text-dim)" : "var(--muted)" }}>
                  {c.lastMessage || "No messages yet"}
                </div>
              </div>
              {unread > 0 && (
                <span style={{ minWidth: 22, height: 22, padding: "0 6px", borderRadius: 999, background: "var(--ember)", color: "#2a1200", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center" }}>
                  {unread}
                </span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}