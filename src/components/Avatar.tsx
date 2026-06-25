interface Props {
  name: string;
  initials?: string;
  url?: string;
  size?: "sm" | "lg";
}

export default function Avatar({ name, initials, url, size = "sm" }: Props) {
  const cls = size === "lg" ? "avatar avatar-lg" : "avatar";
  const fallback = initials || name.slice(0, 2).toUpperCase();
  return (
    <div className={cls} aria-label={name}>
      {url ? <img src={url} alt={name} /> : fallback}
    </div>
  );
}
