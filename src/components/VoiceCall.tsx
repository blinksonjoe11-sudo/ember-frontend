import { useEffect, useRef, useState } from "react";
import { callApi } from "../api/endpoints";
import { useSocketCtx } from "../context/SocketContext";

type CallState = "idle" | "calling" | "incoming" | "connecting" | "connected" | "ended";

interface Props {
  conversationId: string;
  peerName: string;
  mode: "outgoing" | "incoming";
  callType: "voice" | "video";
  incomingOffer?: any;
  onClose: () => void;
}

export default function VoiceCall({ conversationId, peerName, mode, callType, incomingOffer, onClose }: Props) {
  const { subscribe } = useSocketCtx();
  const [state, setState] = useState<CallState>(mode === "outgoing" ? "calling" : "incoming");
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const isVideo = callType === "video";

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const startedRef = useRef(false);
  const ringRef = useRef<{ stop: () => void } | null>(null);
  const facingRef = useRef<"user" | "environment">("user");

  const startRinging = (kind: "incoming" | "outgoing") => {
    stopRinging();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctx.resume().catch(() => {});
    let stopped = false;
    const playPattern = () => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = kind === "incoming" ? 480 : 440;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    };
    playPattern();
    const interval = setInterval(playPattern, kind === "incoming" ? 1000 : 2500);
    ringRef.current = {
      stop: () => { stopped = true; clearInterval(interval); ctx.close().catch(() => {}); },
    };
  };
  const stopRinging = () => { ringRef.current?.stop(); ringRef.current = null; };

  useEffect(() => {
    if (state === "incoming") startRinging("incoming");
    else if (state === "calling") startRinging("outgoing");
    else stopRinging();   // "connecting", "connected", "ended" all stop the ring
    return stopRinging;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Auto-end the call if it isn't answered within 45 seconds.
  useEffect(() => {
    if (state === "calling" || state === "incoming") {
      timeoutRef.current = setTimeout(() => {
        if (pcRef.current?.connectionState !== "connected") endCall(true);
      }, 45000);
    }
    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Attach streams to the video elements whenever they or the state change.
  useEffect(() => {
    if (!isVideo) return;
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [state, isVideo]);

  const createPeer = async () => {
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      const turn = await callApi.turn();
      if (Array.isArray(turn) && turn.length) iceServers = turn;
    } catch { /* fall back to STUN */ }

    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) callApi.signal(conversationId, "ice", e.candidate).catch(() => {});
    };

    pc.ontrack = (e) => {
      const [stream] = e.streams;
      remoteStreamRef.current = stream;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current && isVideo) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        clearTimeout(timeoutRef.current);
        setState("connected");
        startTimer();
      }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") endCall(false);
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo ? { facingMode: facingRef.current } : false,
    });
    localStreamRef.current = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    if (isVideo && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }
    return pc;
  };

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
  };

  const startOutgoing = async () => {
    const pc = await createPeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    callApi.signal(conversationId, "offer", { sdp: offer, callType }).catch(() => {});
  };

 const acceptCall = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setState("connecting");   // ← instant feedback the moment you tap
    try {
      const pc = await createPeer();
      const sdp = incomingOffer?.sdp || incomingOffer;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => {});
      pendingIce.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      callApi.signal(conversationId, "answer", answer).catch(() => {});
    } catch {
      startedRef.current = false;
      setState("incoming"); // revert if it failed, so they can retry
    }
  };

  const endCall = (notify = true) => {
    stopRinging();
    clearTimeout(timeoutRef.current);
    if (notify) callApi.signal(conversationId, "end", null).catch(() => {});
    clearInterval(timerRef.current);
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setState("ended");
    setTimeout(onClose, 600);
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOff(!track.enabled); }
  };

  const flipCam = async () => {
    if (!isVideo) return;
    facingRef.current = facingRef.current === "user" ? "environment" : "user";
    const pc = pcRef.current;
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: facingRef.current },
    }).catch(() => null);
    if (!newStream || !pc) return;
    const newTrack = newStream.getVideoTracks()[0];
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (sender) await sender.replaceTrack(newTrack);
    const old = localStreamRef.current?.getVideoTracks()[0];
    old?.stop();
    if (localStreamRef.current) {
      if (old) localStreamRef.current.removeTrack(old);
      localStreamRef.current.addTrack(newTrack);
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
  };

  useEffect(() => {
    return subscribe(async (e) => {
      if (e.type !== "call") return;
      const { signal, data, conversationId: cid } = e.payload;
      if (cid !== conversationId) return;
      const pc = pcRef.current;
      if (signal === "answer" && pc) {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data)).catch(() => {});
        }
      } else if (signal === "ice") {
        if (pc && pc.remoteDescription) await pc.addIceCandidate(data).catch(() => {});
        else pendingIce.current.push(data);
      } else if (signal === "end") {
        endCall(false);
      }
    });
  }, [subscribe, conversationId]);

  useEffect(() => {
    if (mode === "outgoing" && !startedRef.current) {
      startedRef.current = true;
      startOutgoing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className={`call-overlay ${isVideo ? "call-video" : ""}`}>
      <audio ref={remoteAudioRef} autoPlay />

      {isVideo && (
        <>
          <video
            ref={remoteVideoRef}
            className="call-remote-video"
            autoPlay
            playsInline
            style={{ display: state === "connected" ? "block" : "none" }}
          />
          <video ref={localVideoRef} className="call-local-video" autoPlay playsInline muted />
        </>
      )}

      <div className="call-card">
        {(!isVideo || state !== "connected") && (
          <>
            <div className="call-avatar">{peerName.slice(0, 2).toUpperCase()}</div>
            <div className="call-name">{peerName}</div>
          </>
        )}
        <div className="call-status">
          {state === "calling" && (isVideo ? "Video calling…" : "Calling…")}
          {state === "incoming" && (isVideo ? "Incoming video call" : "Incoming voice call")}
          {state === "connecting" && "Connecting…"}
          {state === "connected" && fmt(secs)}
          {state === "ended" && "Call ended"}
        </div>

        <div className="call-actions">
          {state === "incoming" ? (
            <>
              <button className="call-btn call-decline" onClick={() => endCall(true)} aria-label="Decline">📵</button>
              <button className="call-btn call-accept" onClick={acceptCall} aria-label="Accept">{isVideo ? "🎥" : "📞"}</button>
            </>
          ) : state === "connected" ? (
            <>
              <button className={`call-btn ${muted ? "call-muted" : ""}`} onClick={toggleMute} aria-label="Mute">
                {muted ? "🔇" : "🎤"}
              </button>
              {isVideo && (
                <button className={`call-btn ${camOff ? "call-muted" : ""}`} onClick={toggleCam} aria-label="Camera">
                  {camOff ? "📷" : "🎥"}
                </button>
              )}
              {isVideo && (
                <button className="call-btn" onClick={flipCam} aria-label="Flip camera">🔄</button>
              )}
              <button className="call-btn call-decline" onClick={() => endCall(true)} aria-label="End call">📵</button>
            </>
          ) : state === "calling" ? (
            <button className="call-btn call-decline" onClick={() => endCall(true)} aria-label="Cancel">📵</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}