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

interface OpenChat {
  conversationId: string;
  title: string;
}

// Shell renders inside the SocketProvider so it can read unread counts.
function Shell() {
  const [tab, setTab] = useState<Tab>("connect");
  const [chat, setChat] = useState<OpenChat | null>(null);
  const { totalUnread } = useSocketCtx();

  if (chat) {
    return (
      <ChatScreen
        conversationId={chat.conversationId}
        title={chat.title}
        onBack={() => setChat(null)}
      />
    );
  }

  const openChat = (conversationId: string, title: string) => setChat({ conversationId, title });

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
