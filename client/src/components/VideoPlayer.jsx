import YouTube from "react-youtube";
import { useRef, useState } from "react";
import api from "../api";

function VideoPlayer({ videoId, videoDbId, token, onClose }) {
  const intervalRef = useRef(null);
  const [playbackError, setPlaybackError] = useState("");

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

  const handleEnd = () => {
    handlePause();
    onClose();
  };

  const opts = {
    width: "100%",
    height: "400",
    // youtube.com が hosts でブロックされている環境を考慮して nocookie ドメインを優先する
    host: "https://www.youtube-nocookie.com",
    playerVars: { autoplay: 1 },
  };

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
        <YouTube
          videoId={videoId}
          opts={opts}
          style={{ width: "100%" }}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnd={handleEnd}
          onError={() => {
            handlePause();
            setPlaybackError(
              "動画の再生に失敗しました。ネットワーク制限や hosts 設定で YouTube ドメインが遮断されている可能性があります。",
            );
          }}
        />
        {playbackError && (
          <p
            style={{ color: "#ffdede", marginTop: "0.75rem", lineHeight: 1.5 }}
          >
            {playbackError}
          </p>
        )}
      </div>
    </div>
  );
}

export default VideoPlayer;
