import { useEffect, useState, useCallback } from "react";
import { searchApi, chatApi } from "../api/endpoints";
import type { User } from "../api/types";
import Avatar from "../components/Avatar";
import { useAuth } from "../context/AuthContext";

export default function ConnectScreen({ onOpenChat }: { onOpenChat: (id: string, name: string) => void }) {
  const { user } = useAuth();
  const isPlug = user?.role === "plug";
  const [q, setQ] = useState("");
  const [plugsOnly, setPlugsOnly] = useState(false);
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      // Plugs only ever see users; the toggle is hidden for them.
      const { results } = await searchApi.people(q, isPlug ? false : plugsOnly);
      setResults(results);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q, plugsOnly, isPlug]);

  useEffect(() => {
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [run]);

  const openChat = async (target: User) => {
    setOpening(target.id);
    try {
      const { conversationId } = await chatApi.start(target.id);
      onOpenChat(conversationId, target.businessName || target.name);
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="screen">
      <div className="header">
        <div className="eyebrow">{user?.city}</div>
        <h1 className="screen-title">Connect</h1>
        <p className="screen-sub">
          {isPlug ? "People looking for verified plugs near you." : "Find people and verified plugs in your city."}
        </p>
      </div>

      <div className="field">
        <input
          className="input"
          placeholder="Search by name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* The plugs/everyone toggle only makes sense for regular users. */}
      {!isPlug && (
        <div className="seg">
          <button className={!plugsOnly ? "active" : ""} onClick={() => setPlugsOnly(false)}>
            Everyone
          </button>
          <button className={plugsOnly ? "active" : ""} onClick={() => setPlugsOnly(true)}>
            Plugs only
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty"><span className="spinner" style={{ margin: "0 auto" }} /></div>
      ) : results.length === 0 ? (
        <div className="empty">No one found in {user?.city} yet.</div>
      ) : (
        results.map((p) => (
          <button key={p.id} className="row" onClick={() => openChat(p)} disabled={opening === p.id}>
            <Avatar name={p.businessName || p.name} initials={p.initials} url={p.avatarUrl} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row-title">
                {p.businessName || p.name}
                {p.role === "plug" && p.plugStatus === "approved" && (
                  <span className="badge badge-verified"><span className="badge-dot" />Verified</span>
                )}
              </div>
              <div className="row-sub">{p.city}</div>
            </div>
            {opening === p.id && <span className="spinner" />}
          </button>
        ))
      )}
    </div>
  );
}
