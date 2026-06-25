import { useState } from "react";
import Logo from "../components/Logo";
import { authApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { CITIES } from "../api/types";
import { registerPush } from "../lib/push";
import InstallButton from "../components/InstallButton";

type Mode = "welcome" | "login" | "register" | "verify" | "forgot" | "reset";

export default function AuthScreen() {
  const { setSession } = useAuth();
  const [mode, setMode] = useState<Mode>("welcome");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState<string>(CITIES[0]);
  const [birthYear, setBirthYear] = useState("");
  const [role, setRole] = useState<"user" | "plug">("user");

  // verify state
  const [pendingUserId, setPendingUserId] = useState("");
  const [code, setCode] = useState("");

  const reset = () => {
    setError("");
    setBusy(false);
  };

  const finish = async (r: any) => {
    await setSession(r);
    registerPush();
  };

  const doRegister = async () => {
    reset();
    const yr = parseInt(birthYear, 10);
    if (!name || !email || password.length < 6 || !yr) {
      setError("Fill every field. Password needs 6+ characters.");
      return;
    }
    if (new Date().getFullYear() - yr < 18) {
      setError("Ember is for adults 18 and older.");
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.register({ name, email, password, city, birthYear: yr, role });
      setPendingUserId(res.userId);
      setMode("verify");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    reset();
    setBusy(true);
    try {
      const res = await authApi.login(email, password);
      if ((res as any).action === "verify_email") {
        setPendingUserId((res as any).userId);
        setMode("verify");
        return;
      }
      await finish(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    reset();
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.verifyEmail(pendingUserId, code);
      await finish(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  };

  const doForgot = async () => {
    reset();
    if (!email) { setError("Enter your email."); return; }
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
      setMode("reset");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send code.");
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    reset();
    if (resetCode.length !== 6) { setError("Enter the 6-digit code."); return; }
    if (newPassword.length < 6) { setError("Password needs 6+ characters."); return; }
    setBusy(true);
    try {
      await authApi.resetPassword(email, resetCode, newPassword);
      setResetCode("");
      setNewPassword("");
      setPassword("");
      setMode("login");
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await authApi.resendCode(pendingUserId);
      setError("");
    } catch {
      /* ignore */
    }
  };

  // ---------- WELCOME ----------
  if (mode === "welcome") {
    return (
      <div className="center-screen" style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 40 }}>
          <Logo size={220} />
        </div>
        <p style={{ color: "var(--muted)", marginBottom: 32, fontSize: 15, lineHeight: 1.5 }}>
          Verified adults only. Connect with people and plugs in your city.
        </p>
        <button className="btn btn-primary" onClick={() => setMode("register")} style={{ marginBottom: 12 }}>
          Create account
        </button>
        <button className="btn btn-ghost" onClick={() => setMode("login")}>
          I already have an account
        </button>
        <InstallButton />
      </div>
    );
  }

  // ---------- VERIFY ----------
  if (mode === "verify") {
    return (
      <div className="center-screen">
        <h1 className="screen-title">Check your email</h1>
        <p className="screen-sub">We sent a 6-digit code. Enter it below to confirm your account.</p>
        <div className="field">
          <input
            className="input"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            style={{ textAlign: "center", fontSize: 28, letterSpacing: 8 }}
          />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" onClick={doVerify} disabled={busy} style={{ marginTop: 12 }}>
          {busy ? <span className="spinner" /> : "Verify"}
        </button>
        <button className="btn btn-ghost" onClick={resend} style={{ marginTop: 10 }}>
          Resend code
        </button>
      </div>
    );
  }


  // ---------- FORGOT ----------
  if (mode === "forgot") {
    return (
      <div className="center-screen">
        <h1 className="screen-title">Reset password</h1>
        <p className="screen-sub">Enter your email and we'll send a 6-digit reset code.</p>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" onClick={doForgot} disabled={busy} style={{ marginTop: 12 }}>
          {busy ? <span className="spinner" /> : "Send code"}
        </button>
        <button className="btn btn-ghost" onClick={() => { setMode("login"); reset(); }} style={{ marginTop: 10 }}>
          Back to login
        </button>
      </div>
    );
  }

  // ---------- RESET ----------
  if (mode === "reset") {
    return (
      <div className="center-screen">
        <h1 className="screen-title">Enter code</h1>
        <p className="screen-sub">Check your email for the 6-digit code, then set a new password.</p>
        <div className="field">
          <label>Code</label>
          <input
            className="input"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
            style={{ textAlign: "center", fontSize: 24, letterSpacing: 6 }}
          />
        </div>
        <div className="field">
          <label>New password (6+ characters)</label>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" onClick={doReset} disabled={busy} style={{ marginTop: 12 }}>
          {busy ? <span className="spinner" /> : "Reset password"}
        </button>
        <button className="btn btn-ghost" onClick={() => { setMode("login"); reset(); }} style={{ marginTop: 10 }}>
          Back to login
        </button>
      </div>
    );
  }

  // ---------- LOGIN ----------
  if (mode === "login") {
    return (
      <div className="center-screen">
        <h1 className="screen-title">Welcome back</h1>
        <p className="screen-sub">Log in to your Ember account.</p>
        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button
          onClick={() => { setMode("forgot"); reset(); }}
          style={{ alignSelf: "flex-end", color: "var(--accent)", fontSize: 13, marginBottom: 4 }}
        >
          Forgot password?
        </button>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" onClick={doLogin} disabled={busy} style={{ marginTop: 12 }}>
          {busy ? <span className="spinner" /> : "Log in"}
        </button>
        <button className="btn btn-ghost" onClick={() => { setMode("register"); reset(); }} style={{ marginTop: 10 }}>
          Create an account instead
        </button>
      </div>
    );
  }

  // ---------- REGISTER ----------
  return (
    <div className="screen">
      <h1 className="screen-title">Create account</h1>
      <p className="screen-sub">You must be 18 or older to join.</p>

      <div className="seg">
        <button className={role === "user" ? "active" : ""} onClick={() => setRole("user")}>
          I'm a user
        </button>
        <button className={role === "plug" ? "active" : ""} onClick={() => setRole("plug")}>
          I'm a plug
        </button>
      </div>

      <div className="field">
        <label>Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label>Password (6+ characters)</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="field">
        <label>City</label>
        <select className="select" value={city} onChange={(e) => setCity(e.target.value)}>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Year of birth</label>
        <input
          className="input"
          inputMode="numeric"
          placeholder="e.g. 1998"
          maxLength={4}
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
        />
      </div>

      {role === "plug" && (
        <p style={{ color: "var(--ember)", fontSize: 13, marginBottom: 12 }}>
          After signup you'll verify your NIN to get approved as a plug.
        </p>
      )}
      {error && <div className="error-text">{error}</div>}

      <button className="btn btn-primary" onClick={doRegister} disabled={busy} style={{ marginTop: 12 }}>
        {busy ? <span className="spinner" /> : "Continue"}
      </button>
      <button className="btn btn-ghost" onClick={() => { setMode("login"); reset(); }} style={{ marginTop: 10 }}>
        I already have an account
      </button>
    </div>
  );
}
