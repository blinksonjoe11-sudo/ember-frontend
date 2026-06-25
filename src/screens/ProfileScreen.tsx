import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { avatarApi, plugApi } from "../api/endpoints";
import { ApiError } from "../api/client";
import Avatar from "../components/Avatar";
import { useToast } from "../context/ToastContext";

export default function ProfileScreen() {
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // plug verification form
  const [nin, setNin] = useState("");
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const pickAvatar = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await avatarApi.upload(file);
      await refreshUser();
      toast("Photo updated.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const copyUsername = async () => {
    try {
      await navigator.clipboard.writeText(user.username);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Could not copy.");
    }
  };

  const submitNin = async () => {
    setErr("");
    if (nin.length !== 11) {
      setErr("NIN must be 11 digits.");
      return;
    }
    setSubmitting(true);
    try {
      await plugApi.submitNin({ nin, businessName, bio });
      await refreshUser();
      toast("Submitted for review.");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const status = user.plugStatus;

  return (
    <div className="screen">
      <div className="header">
        <div className="eyebrow">Account</div>
        <h1 className="screen-title">Profile</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={pickAvatar} style={{ position: "relative" }} disabled={uploading}>
          <Avatar name={user.name} initials={user.initials} url={user.avatarUrl} size="lg" />
          {uploading && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.5)", borderRadius: "50%" }}>
              <span className="spinner" />
            </div>
          )}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={pickAvatar} disabled={uploading}>
          Change photo
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{user.businessName || user.name}</div>
          <div style={{ color: "var(--muted)", fontSize: 14, display: "flex", gap: 8, justifyContent: "center", marginTop: 4 }}>
            {user.city}
            {user.role === "plug" && status === "approved" && <span className="badge badge-verified">Verified plug</span>}
            {user.role === "plug" && status !== "approved" && <span className="badge badge-pending">Plug · {status}</span>}
          </div>
        </div>
      </div>

      {/* Username — share this so friends can add you */}
      <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>
            Your username
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>@{user.username}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={copyUsername}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      {/* Plug verification block */}
      {user.role === "plug" && status !== "approved" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Get verified</div>
          {status === "under_review" || status === "nin_submitted" ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              Your NIN is under review. We'll notify you once an admin approves your account.
            </p>
          ) : status === "rejected" ? (
            <p style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>
              Your last submission was rejected. You can submit again below.
            </p>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 12 }}>
              Submit your details to be verified as a plug. Users only see approved plugs.
            </p>
          )}

          {status !== "under_review" && status !== "nin_submitted" && (
            <>
              <div className="field">
                <label>Business name</label>
                <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="field">
                <label>NIN (11 digits)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={11}
                  value={nin}
                  onChange={(e) => setNin(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="field">
                <label>Short bio</label>
                <textarea className="textarea" value={bio} onChange={(e) => setBio(e.target.value)} />
              </div>
              {err && <div className="error-text">{err}</div>}
              <button className="btn btn-primary" onClick={submitNin} disabled={submitting} style={{ marginTop: 8 }}>
                {submitting ? <span className="spinner" /> : "Submit for review"}
              </button>
            </>
          )}
        </div>
      )}

      <button className="btn btn-ghost" onClick={logout} style={{ marginTop: 8 }}>
        Log out
      </button>
    </div>
  );
}
