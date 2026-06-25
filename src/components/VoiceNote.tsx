import { useRef, useState, useEffect } from "react";

// A fixed bar pattern so every voice note has a consistent waveform look.
const BARS = [0.3, 0.5, 0.7, 0.4, 0.8, 1, 0.6, 0.9, 0.5, 0.7, 0.4, 0.6, 0.85, 0.5, 0.7, 0.35, 0.6, 0.8, 0.45, 0.65, 0.5, 0.75, 0.4, 0.6, 0.9, 0.55, 0.7, 0.4, 0.6, 0.5];

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function VoiceNote({ src, mine }: { src: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    const onMeta = () => setDuration(audio.duration);
    const onTime = () => {
      setCurrent(audio.currentTime);
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onEnd = () => { setPlaying(false); setProgress(0); setCurrent(0); };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  };

  return (
    <div className={`voice-note ${mine ? "vn-mine" : ""}`}>
      <button className="vn-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? "⏸" : "▶"}
      </button>
      <div className="vn-wave" onClick={seek}>
        {BARS.map((h, i) => {
          const filled = i / BARS.length < progress;
          return (
            <span
              key={i}
              className={`vn-bar ${filled ? "vn-bar-filled" : ""}`}
              style={{ height: `${Math.max(3, h * 22)}px` }}
            />
          );
        })}
      </div>
      <span className="vn-time">{fmt(current > 0 ? current : duration)}</span>
    </div>
  );
}