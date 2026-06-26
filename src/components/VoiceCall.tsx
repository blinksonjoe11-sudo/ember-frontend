import { useEffect, useRef, useState } from "react";
import { callApi } from "../api/endpoints";
import { useSocketCtx } from "../context/SocketContext";

type CallState = "idle" | "calling" | "incoming" | "connected" | "ended";

interface Props {
  conversationId: string;
  peerName: string;
  // "outgoing" = I pressed call; "incoming" = I received an offer
  mode: "outgoing" | "incoming";
  incomingOffer?: any; // SDP offer when incoming
  onClose: () => void;
}

export default function VoiceCall({ conversationId, peerName, mode, incomingOffer, onClose }: Props) {
  const { subscribe } = useSocketCtx();
  const [state, setState] = useState<CallState>(mode === "outgoing" ? "calling" : "incoming");
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const startedRef = useRef(false);
  const ringRef = useRef<{ stop: () => void } | null>(null);


  const startRinging = (kind: "incoming" | "outgoing") => {
    stopRinging();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    let stopped = false;

    const playPattern = () => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      // Incoming = higher, friendlier; outgoing = the classic ring-back beep.
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
      stop: () => {
        stopped = true;
        clearInterval(interval);
        ctx.close().catch(() => {});
      },
    };
  };

  const stopRinging = () => {
    ringRef.current?.stop();
    ringRef.current = null;
  };

  useEffect(() => {
    if (state === "incoming") startRinging("incoming");
    else if (state === "calling") startRinging("outgoing");
    else stopRinging();
    return stopRinging;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  // Build the peer connection with TURN from the backend.
  const createPeer = async () => {
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      const turn = await callApi.turn();
      
      if (Array.isArray(turn) && turn.length) iceServers = turn;
    } catch (err) {
      
    }

    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    // Send our ICE candidates to the peer.
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        callApi.signal(conversationId, "ice", e.candidate).catch(() => {});
      }
    };

    // Play the remote audio when it arrives.
    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

   pc.onconnectionstatechange = () => {
     
      if (pc.connectionState === "connected") {
        setState("connected");
        startTimer();
      }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        endCall(false);
      }
    };

    // Add our mic.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    return pc;
  };

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
  };

  // Outgoing: create offer and send it.
  const startOutgoing = async () => {
    const pc = await createPeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    callApi.signal(conversationId, "offer", offer).catch(() => {});
  };

  

  // Incoming accepted: set their offer, create+send answer.
  const acceptCall = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    
    try {
      const pc = await createPeer();
     
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      
      for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => {});
      pendingIce.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      callApi.signal(conversationId, "answer", answer).catch(() => {});
    } catch (err) {

    }
  };

  const endCall = (notify = true) => {
    stopRinging();
    if (notify) callApi.signal(conversationId, "end", null).catch(() => {});
    clearInterval(timerRef.current);
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setState("ended");
    setTimeout(onClose, 600);
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  };

  // Listen for signaling from the peer.
 useEffect(() => {
    return subscribe(async (e) => {
      if (e.type !== "call") return;
      const { signal, data, conversationId: cid } = e.payload;
      if (cid !== conversationId) return;
      const pc = pcRef.current;


      if (signal === "answer" && pc) {
        // Only apply an answer if we're expecting one (avoids the double-apply
        // crash from StrictMode/duplicate signals once we're already stable).
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data))
            .catch((err) => console.error("setRemote answer failed:", err));
       
        } else {
          
        }
      } else if (signal === "ice") {
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(data).catch(() => {});
        } else {
          pendingIce.current.push(data);
        }
      } else if (signal === "end") {
        endCall(false);
      }
    });
  }, [subscribe, conversationId]);

  // Kick off an outgoing call on mount.
 useEffect(() => {
    if (mode === "outgoing" && !startedRef.current) {
      startedRef.current = true;
      startOutgoing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="call-overlay">
      <audio ref={remoteAudioRef} autoPlay />
      <div className="call-card">
        <div className="call-avatar">{peerName.slice(0, 2).toUpperCase()}</div>
        <div className="call-name">{peerName}</div>
        <div className="call-status">
          {state === "calling" && "Calling…"}
          {state === "incoming" && "Incoming voice call"}
          {state === "connected" && fmt(secs)}
          {state === "ended" && "Call ended"}
        </div>

        <div className="call-actions">
          {state === "incoming" ? (
            <>
              <button className="call-btn call-decline" onClick={() => endCall(true)}>✕</button>
              <button className="call-btn call-accept" onClick={acceptCall}>📞</button>
            </>
          ) : state === "connected" ? (
            <>
              <button className={`call-btn ${muted ? "call-muted" : ""}`} onClick={toggleMute}>
                {muted ? "🔇" : "🎤"}
              </button>
              <button className="call-btn call-decline" onClick={() => endCall(true)}>✕</button>
            </>
          ) : state === "calling" ? (
            <button className="call-btn call-decline" onClick={() => endCall(true)}>✕</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}