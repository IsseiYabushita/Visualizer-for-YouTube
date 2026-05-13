import { useRef } from "react";
import api from "../api";

function VideoPlayer({ videoId, videoDbId, token, onClose }) {
  const intervalRef = useRef(null);

  const handlePlay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      if (!token) return;
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };
      try {
        if (videoDbId) {
          await api.put(
            `/api/videos/${videoDbId}/duration`,
            { seconds: 5 },
            authHeader,
          );
        } else {
          await api.post(
            "/api/videos/track-duration",
            { seconds: 5 },
            authHeader,
          );
        }
      } catch (err) {
        console.error(err);
      }
    }, 5000);
  };

  const handlePause = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div style={{ width: "80%", maxWidth: "800px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "0.5rem",
          }}
        >
          <button
            onClick={() => {
              handlePause();
              onClose();
            }}
            style={{
              background: "#ff0000",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              padding: "0.5rem 1rem",
              fontSize: "1rem",
            }}
          >
            ✕ 閉じる
          </button>
        </div>
        <iframe
          src={embedUrl}
          title="YouTube video player"
          width="100%"
          height="400"
          style={{ border: "none", display: "block" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          onLoad={handlePlay}
        />
        <p style={{ color: "#bbb", marginTop: "0.75rem", lineHeight: 1.5 }}>
          もし自動再生されない場合は、プレイヤー内の再生ボタンを押してください。
          hosts で youtube.com をブロックしていても、埋め込み先が
          youtube-nocookie.com なら再生できることがあります。
        </p>
      </div>
    </div>
  );
}

export default VideoPlayer;
