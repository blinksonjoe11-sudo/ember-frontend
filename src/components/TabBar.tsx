export type Tab = "connect" | "messages" | "lounge" | "profile";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "connect", label: "Connect", icon: "◈" },
  { key: "messages", label: "Messages", icon: "✦" },
  { key: "lounge", label: "Lounge", icon: "◉" },
  { key: "profile", label: "Profile", icon: "❂" },
];

export default function TabBar({
  active,
  onChange,
  unread,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  unread: number;
}) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`tab ${active === t.key ? "active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          <span className="tab-icon">{t.icon}</span>
          {t.label}
          {t.key === "messages" && unread > 0 && (
            <span className="tab-badge">{unread > 9 ? "9+" : unread}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
