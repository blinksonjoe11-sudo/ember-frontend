import { useEffect, useState, useCallback } from "react";
import { searchApi, chatApi, friendsApi } from "../api/endpoints";
import type { User } from "../api/types";
import Avatar from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../api/client";

export default function ConnectScreen({ onOpenChat }: { onOpenChat: (id: string, name: string) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const isPlug = user?.role === "plug";

  // Plugs only ever see users they're talking to via Messages; they don't browse.
  // For users: tab = "friends" | "plugs".
  const [tab, setTab] = useState<"friends" | "plugs">("friends");
  const [friends, setFriends] = useState<User[]>([]);
  const [plugs, setPlugs] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    try {
      const { friends } = await friendsApi.list();
      setFriends(friends);
    } catch {
      setFriends([]);
    }
  }, []);

  const loadPlugs = useCallback(async () => {
    try {
      const { results } = await searchApi.people(q);
      setPlugs(results);
    } catch {
      setPlugs([]);
    }
  }, [q]);

  useEffect(() => {
    setLoading(true);
    (tab === "friends" ? loadFriends() : loadPlugs()).finally(() => setLoading(false));
  }, [tab, loadFriends, loadPlugs]);

  // Debounced plug search.
  useEffect(() => {
    if (tab !== "plugs") return;
    const t = setTimeout(loadPlugs, 250);
    return () => clearTimeout(t);
  }, [q, tab, loadPlugs]);

  const addFriend = async () => {
    const uname = addUsername.trim();
    if (!uname || adding) return;
    setAdding(true);
    try {
      const { friend } = await friendsApi.add(uname);
      toast(`Added ${friend.name}`);
      setAddUsername("");
      loadFriends();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not add friend.");
    } finally {
      setAdding(false);
    }
  };

  const openChat = async (target: User) => {
    setOpening(target.id);
    try {
      const { conversationId } = await chatApi.start(target.id);
      onOpenChat(conversationId, target.businessName || target.name);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not open chat.");
    } finally {
      setOpening(null);
    }
  };

  const list = tab === "friends" ? friends : plugs;

  return (
    <div className="screen">
      <div className="header">
        <div className="eyebrow">{user?.city}</div>
        <h1 className="screen-title">Connect</h1>
        <p className="screen-sub">
          {tab === "friends" ? "Your friends. Add people by their username." : "Verified plugs in your city."}
        </p>
      </div>

      <div className="seg">
        <button className={tab === "friends" ? "active" : ""} onClick={() => setTab("friends")}>
          Friends
        </button>
        <button className={tab === "plugs" ? "active" : ""} onClick={() => setTab("plugs")}>
          Plugs
        </button>
      </div>

      {/* Add-friend input (friends tab only) */}
      {tab === "friends" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            className="input"
            placeholder="Enter username e.g. emma_4f2a"
            value={addUsername}
            onChange={(e) => setAddUsername(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addFriend(); }}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={addFriend} disabled={adding}>
            {adding ? <span className="spinner" /> : "Add"}
          </button>
        </div>
      )}

      {/* Plug search */}
      {tab === "plugs" && (
        <div className="field">
          <input
            className="input"
            placeholder="Search plugs by name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="empty"><span className="spinner" style={{ margin: "0 auto" }} /></div>
      ) : list.length === 0 ? (
        <div className="empty">
          {tab === "friends"
            ? "No friends yet. Add someone by their username above."
            : `No verified plugs in ${user?.city} yet.`}
        </div>
      ) : (
        list.map((p) => (
          <button key={p.id} className="row" onClick={() => openChat(p)} disabled={opening === p.id}>
            {tab === "friends" ? (
              <div className="avatar-wrap">
                <Avatar name={p.name} initials={p.initials} url={p.avatarUrl} />
                <span className={`presence ${p.online ? "online" : "offline"}`} />
              </div>
            ) : (
              <Avatar name={p.businessName || p.name} initials={p.initials} url={p.avatarUrl} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row-title">
                {p.businessName || p.name}
                {p.role === "plug" && p.plugStatus === "approved" && (
                  <span className="badge badge-verified"><span className="badge-dot" />Verified</span>
                )}
              </div>
              <div className="row-sub">{tab === "friends" ? `@${p.username}` : p.city}</div>
            </div>
            {opening === p.id && <span className="spinner" />}
          </button>
        ))
      )}
    </div>
  );
}