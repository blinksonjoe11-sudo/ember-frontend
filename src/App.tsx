import { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { SocketProvider, useSocketCtx } from "./context/SocketContext";
import { registerPush } from "./lib/push";
import AuthScreen from "./screens/AuthScreen";
import ConnectScreen from "./screens/ConnectScreen";
import MessagesScreen from "./screens/MessagesScreen";
import LoungeScreen from "./screens/LoungeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ChatScreen from "./screens/ChatScreen";
import TabBar, { Tab } from "./components/TabBar";
import Logo from "./components/Logo";
import { chatApi, callApi } from "./api/endpoints";
import VoiceCall from "./components/VoiceCall";

interface OpenChat {
  conversationId: string;
  title: string;
  isGroup: boolean;
  avatarUrl?: string;
}

function Shell() {
  const [tab, setTab] = useState<Tab>("connect");
  const [chat, setChat] = useState<OpenChat | null>(null);
   const { totalUnread, totalLoungeUnread, seedUnread, subscribe } = useSocketCtx();
  const { user } = useAuth();

  const [call, setCall] = useState<null | {
    conversationId: string;
    peerName: string;
    mode: "outgoing" | "incoming";
    callType: "voice" | "video";
    offer?: any;
  }>(null);

  // Global incoming-call listener — works on any screen.
  useEffect(() => {
    return subscribe((e) => {
      if (e.type === "call" && e.payload.signal === "offer") {
        if (e.payload.fromId === user?.id) return;   // ← ignore my own offer
        const offerData = e.payload.data;
        const callType = offerData?.callType || "voice";
        setCall((prev) =>
          prev
            ? prev
            : {
                conversationId: e.payload.conversationId,
                peerName: e.payload.fromName || "Unknown",
                mode: "incoming",
                callType,
                offer: offerData,
              }
        );
      }
    });
  }, [subscribe, user?.id]);

  useEffect(() => {
    (async () => {
      try {
        const { conversations } = await chatApi.list();
        const counts: Record<string, number> = {};
        for (const c of conversations) if (c.unread) counts[c.id] = c.unread;
        seedUnread(counts);
      } catch {
        /* ignore */
      }
    })();
  }, [seedUnread]);

  // When the app opens or regains focus, check for a pending incoming call
  // (e.g. one that arrived while the app was closed, surfaced via push).
  useEffect(() => {
    const checkPending = async () => {
      if (document.visibilityState !== "visible") return;
      if (call) return; // already in a call
      try {
        const p = await callApi.pending();
        if (p.pending && p.fromId !== user?.id) {
          setCall({
            conversationId: p.conversationId!,
            peerName: p.fromName || "Unknown",
            mode: "incoming",
            callType: p.data?.callType || "voice",
            offer: p.data,
          });
        }
      } catch { /* ignore */ }
    };
    checkPending();
    document.addEventListener("visibilitychange", checkPending);
    window.addEventListener("focus", checkPending);
    return () => {
      document.removeEventListener("visibilitychange", checkPending);
      window.removeEventListener("focus", checkPending);
    };
  }, [call, user?.id]);

  const openChat = (conversationId: string, title: string, isGroup = false, avatarUrl?: string) =>
    setChat({ conversationId, title, isGroup, avatarUrl });

  const callOverlay = call && (
    <VoiceCall
      conversationId={call.conversationId}
      peerName={call.peerName}
      mode={call.mode}
      callType={call.callType}
      incomingOffer={call.offer}
      onClose={() => setCall(null)}
    />
  );

  if (chat) {
    return (
      <>
        <ChatScreen
          conversationId={chat.conversationId}
          title={chat.title}
          isGroup={chat.isGroup}
          avatarUrl={chat.avatarUrl}
          onStartCall={(type: "voice" | "video") =>
            setCall({
              conversationId: chat.conversationId,
              peerName: chat.title,
              mode: "outgoing",
              callType: type,
            })
          }
          onBack={() => setChat(null)}
        />
        {callOverlay}
      </>
    );
  }

  return (
    <div className="app">
      {tab === "connect" && <ConnectScreen onOpenChat={openChat} />}
      {tab === "messages" && <MessagesScreen onOpenChat={openChat} />}
      {tab === "lounge" && <LoungeScreen onOpenChat={openChat} />}
      {tab === "profile" && <ProfileScreen />}

      {callOverlay}

      <TabBar active={tab} onChange={setTab} unread={totalUnread} loungeUnread={totalLoungeUnread} />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) registerPush();
  }, [user]);

  if (loading) {
    return (
      <div className="center-screen" style={{ alignItems: "center" }}>
        <Logo size={120} showWordmark={false} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <AuthScreen />
      </div>
    );
  }

  return (
    <SocketProvider enabled={true} currentUserId={user.id}>
      <Shell />
    </SocketProvider>
  );
}