import { useState } from "react";
import { communityApi } from "../api/endpoints";
import type { Community } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { useCachedData } from "../lib/useCachedData";
import SkeletonList from "../components/Skeleton";

export default function LoungeScreen({ onOpenChat }: { onOpenChat: (id: string, name: string) => void }) {
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);

  const { data: communities, firstLoad } = useCachedData<Community[]>(
    "communities",
    async () => (await communityApi.list()).communities,
    []
  );

  const lounge = communities.find((c) => c.kind === "lounge") || null;
  const userCommunities = communities.filter((c) => c.kind === "community");

  const open = async (c: Community) => {
    setJoining(true);
    try {
      const { conversationId } = await communityApi.join(c.id);
      onOpenChat(conversationId, c.name);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="screen">
      <div className="header">
        <div className="eyebrow">{user?.city}</div>
        <h1 className="screen-title">Lounge</h1>
        <p className="screen-sub">The hangout for verified adults in your city.</p>
      </div>

      {firstLoad ? (
        <SkeletonList rows={3} />
      ) : (
        <>
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

          {userCommunities.length > 0 && (
            <>
              <div style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 10px" }}>
                Communities in {user?.city}
              </div>
              {userCommunities.map((c) => (
                <button key={c.id} className="row" onClick={() => open(c)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>{c.members} members</div>
                  </div>
                </button>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}