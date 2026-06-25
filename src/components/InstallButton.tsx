import { useEffect, useState } from "react";

// Captured beforeinstallprompt event (Android/desktop Chrome/Edge).
let deferredPrompt: any = null;

export default function InstallButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
    !(window as any).MSStream;

  useEffect(() => {
    if (isStandalone) return; // already installed — nothing to show

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // If the prompt was already captured before this mounted, reflect it.
    if (deferredPrompt) setCanInstall(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isStandalone]);

  // Already running as an installed app — render nothing.
  if (isStandalone) return null;

  const onClick = async () => {
    if (deferredPrompt) {
      // Android / desktop: fire the real install dialog.
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      setCanInstall(false);
    } else if (isIos) {
      // iPhone has no install API — show the manual steps.
      setShowIosHelp(true);
    }
  };

  // Only show the button if we can prompt (Android) or it's iOS (manual help).
  if (!canInstall && !isIos) return null;

  return (
    <>
      <button className="btn btn-ghost" onClick={onClick} style={{ marginTop: 12 }}>
        ⤓ Install Ember app
      </button>

      {showIosHelp && (
        <div
          onClick={() => setShowIosHelp(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 200, padding: 16,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, width: "100%", marginBottom: 12 }}
          >
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12 }}>
              Install on iPhone
            </div>
            <ol style={{ paddingLeft: 18, color: "var(--text-dim)", lineHeight: 1.7, fontSize: 14 }}>
              <li>Tap the <strong>Share</strong> icon in Safari's toolbar.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> — Ember appears on your home screen.</li>
            </ol>
            <button className="btn btn-primary" onClick={() => setShowIosHelp(false)} style={{ marginTop: 16 }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}