import { useEffect, useState } from "react";
import { searchApi, chatApi, friendsApi } from "../api/endpoints";
import type { User } from "../api/types";
import Avatar from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../api/client";
import { useCachedData } from "../lib/useCachedData";
import SkeletonList from "../components/Skeleton";

export default function ConnectScreen({ onOpenChat }: { onOpenChat: (id: string, name: string, isGroup?: boolean, avatarUrl?: string) => void }) {
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<"friends" | "plugs">("friends");
  const [q, setQ] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  // Cached lists — survive tab switches, skeleton only on genuine first load.
  const { data: friends, firstLoad: friendsFirst, refresh: refreshFriends } =
    useCachedData<User[]>("friends", async () => (await friendsApi.list()).friends, []);

  const { data: plugs, firstLoad: plugsFirst, refresh: refreshPlugs } =
    useCachedData<User[]>("plugs", async () => (await searchApi.people(q)).results, []);

  // Debounced plug search.
  useEffect(() => {
    if (tab !== "plugs") return;
    const t = setTimeout(refreshPlugs, 250);
    return () => clearTimeout(t);
  }, [q, tab, refreshPlugs]);

  const addFriend = async () => {
    const uname = addUsername.trim();
    if (!uname || adding) return;
    setAdding(true);
    try {
      const { friend } = await friendsApi.add(uname);
      toast(`Added ${friend.name}`);
      setAddUsername("");
      refreshFriends();
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
      onOpenChat(conversationId, target.businessName || target.name, false, target.avatarUrl);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not open chat.");
    } finally {
      setOpening(null);
    }
  };

  const list = tab === "friends" ? friends : plugs;
  const firstLoad = tab === "friends" ? friendsFirst : plugsFirst;

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

      {firstLoad ? (
        <SkeletonList rows={6} />
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