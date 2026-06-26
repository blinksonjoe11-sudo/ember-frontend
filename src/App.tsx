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
import { chatApi } from "./api/endpoints";

interface OpenChat {
  conversationId: string;
  title: string;
  isGroup: boolean;
  avatarUrl?: string;
}

function Shell() {
   const [tab, setTab] = useState<Tab>("connect");
  const [chat, setChat] = useState<OpenChat | null>(null);
  const { totalUnread, seedUnread } = useSocketCtx();


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

  if (chat) {
    return (
     <ChatScreen
        conversationId={chat.conversationId}
        title={chat.title}
        isGroup={chat.isGroup}
        avatarUrl={chat.avatarUrl}
        onBack={() => setChat(null)}
      />
    );
  }

  // DMs call openChat(id, title). Lounges call openChat(id, title, true).
  const openChat = (conversationId: string, title: string, isGroup = false, avatarUrl?: string) =>
    setChat({ conversationId, title, isGroup, avatarUrl }); 

  return (
    <div className="app">
      {tab === "connect" && <ConnectScreen onOpenChat={openChat} />}
      {tab === "messages" && <MessagesScreen onOpenChat={openChat} />}
      {tab === "lounge" && <LoungeScreen onOpenChat={openChat} />}
      {tab === "profile" && <ProfileScreen />}
      <TabBar active={tab} onChange={setTab} unread={totalUnread} />
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