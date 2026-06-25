import { useEffect, useState } from "react";
import { communityApi } from "../api/endpoints";
import type { Community } from "../api/types";
import { useAuth } from "../context/AuthContext";

export default function LoungeScreen({ onOpenChat }: { onOpenChat: (id: string, name: string) => void }) {
  const { user } = useAuth();
  const [lounge, setLounge] = useState<Community | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { communities } = await communityApi.list();
        setLounge(communities.find((c) => c.kind === "lounge") || null);
        setCommunities(communities.filter((c) => c.kind === "community"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const open = async (c: Community) => {
    setJoining(true);
    try {
      const { conversationId } = await communityApi.join(c.id);
      onOpenChat(conversationId, c.name);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="screen">
        <div className="empty"><span className="spinner" style={{ margin: "0 auto" }} /></div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="header">
        <div className="eyebrow">{user?.city}</div>
        <h1 className="screen-title">Lounge</h1>
        <p className="screen-sub">The hangout for verified adults in your city.</p>
      </div>

      {lounge && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{lounge.name}</div>
          <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 14 }}>
            {lounge.description}
          </div>
          <button className="btn btn-primary" onClick={() => open(lounge)} disabled={joining}>
            {joining ? <span className="spinner" /> : "Enter lounge"}
          </button>
        </div>
      )}

      {communities.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 10px" }}>
            Communities in {user?.city}
          </div>
          {communities.map((c) => (
            <button key={c.id} className="row" onClick={() => open(c)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>{c.members} members</div>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
