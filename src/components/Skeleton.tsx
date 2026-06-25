// A shimmering placeholder row that mimics the real list rows.
function SkeletonRow() {
  return (
    <div className="skeleton-row">
      <div className="skeleton-avatar shimmer" />
      <div style={{ flex: 1 }}>
        <div className="skeleton-line shimmer" style={{ width: "55%" }} />
        <div className="skeleton-line shimmer" style={{ width: "35%", marginTop: 8, height: 11 }} />
      </div>
    </div>
  );
}

export default function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}