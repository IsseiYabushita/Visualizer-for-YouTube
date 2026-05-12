import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

// Webページをアプリ内で表示するためのコンポーネント
// 目的: 外部サイトへ“遷移”せず iframe 内で表示することで、ブラウザのタブタイトル（window title）をアプリのまま維持する
function WebView({ url, onClose }) {
  const { token } = useAuth();

  const [iframeError, setIframeError] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState("");
  const [readerTitle, setReaderTitle] = useState("");
  const [readerHtml, setReaderHtml] = useState("");

  // 安全のため、http/https 以外は弾く
  const safeUrl = useMemo(() => {
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u.toString();
    } catch {
      return null;
    }
  }, [url]);

  useEffect(() => {
    // アプリ内でどの画面にいても、タブタイトルは固定
    // （iframe の中のページタイトルは親のタイトルに影響しない）
    document.title = "visualizer-for-youtube";
  }, []);

  const handleOpenAsText = async () => {
    // 目的: iframe をブロックするサイトでも最低限「内容を読める」ようにする
    // 注意: これは外部サイトの“見た目そのまま表示”ではなく、安全のためにサニタイズしたHTMLを表示する
    if (!safeUrl) return;
    if (!token) {
      setReaderError("ログイン情報がありません。ログインし直してください。");
      return;
    }

    setReaderLoading(true);
    setReaderError("");
    setReaderTitle("");
    setReaderHtml("");

    try {
      const res = await api.get(
        `/api/web/fetch?url=${encodeURIComponent(safeUrl)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setReaderTitle(res.data.title || "");
      setReaderHtml(res.data.html || "");
    } catch (err) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.error;
      setReaderError(
        status
          ? `テキスト表示に失敗しました（HTTP ${status}）${serverMessage ? `: ${serverMessage}` : ""}`
          : "テキスト表示に失敗しました（ネットワーク/CORSの可能性）",
      );
    }

    setReaderLoading(false);
  };

  if (!safeUrl) {
    return (
      <div
        style={{ background: "#1a1a1a", borderRadius: "8px", padding: "1rem" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <h3 style={{ margin: 0 }}>Web表示</h3>
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            戻る
          </button>
        </div>
        <p style={{ color: "#ff4444", marginTop: "1rem" }}>
          URLが不正なため表示できません。
        </p>
      </div>
    );
  }

  return (
    <div
      style={{ background: "#1a1a1a", borderRadius: "8px", overflow: "hidden" }}
    >
      {/* ヘッダー（戻る/外部で開く） */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid #333",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ← 戻る
          </button>
          <span style={{ color: "#aaa", fontSize: "0.85rem" }}>{safeUrl}</span>
        </div>

        <button
          onClick={() => window.open(safeUrl, "_blank", "noopener,noreferrer")}
          style={{
            padding: "0.5rem 1rem",
            background: "#ff0000",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          外部で開く
        </button>
      </div>

      {/* 注意書き（iframe がブロックされるケースの説明） */}
      <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #333" }}>
        <p style={{ margin: 0, color: "#aaa", fontSize: "0.85rem" }}>
          一部サイトはセキュリティ設定（X-Frame-Options / CSP）で iframe
          表示をブロックします。表示できない場合は「外部で開く」を使ってください。
        </p>
        {iframeError && (
          <p
            style={{
              margin: "0.5rem 0 0",
              color: "#ff4444",
              fontSize: "0.85rem",
            }}
          >
            このサイトは iframe で表示できない可能性があります。
          </p>
        )}

        {/* iframe がブロックされた時の代替（テキスト表示） */}
        {iframeError && (
          <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleOpenAsText}
              disabled={readerLoading}
              style={{
                padding: "0.4rem 1rem",
                background: readerLoading ? "#333" : "#555",
                color: readerLoading ? "#777" : "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: readerLoading ? "not-allowed" : "pointer",
              }}
            >
              {readerLoading ? "取得中..." : "テキストで開く"}
            </button>
          </div>
        )}

        {readerError && (
          <p
            style={{
              margin: "0.5rem 0 0",
              color: "#ff4444",
              fontSize: "0.85rem",
            }}
          >
            {readerError}
          </p>
        )}
      </div>

      {/* リーダーモード（サーバでサニタイズしたHTML表示） */}
      {readerHtml && (
        <div style={{ padding: "1rem" }}>
          {readerTitle && (
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem" }}>
              {readerTitle}
            </h2>
          )}
          <div
            style={{ color: "#ddd", lineHeight: 1.6 }}
            // サーバ側で sanitize-html 済みのため、ここで dangerouslySetInnerHTML を使う
            dangerouslySetInnerHTML={{ __html: readerHtml }}
          />
        </div>
      )}

      {/* iframe本体 */}
      <div style={{ height: "70vh", background: "#0f0f0f" }}>
        <iframe
          title="web-view"
          src={safeUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          // sandbox は強くしすぎると表示できないサイトが増えるので、今回は未指定（MVP優先）
          onError={() => setIframeError(true)}
        />
      </div>
    </div>
  );
}

export default WebView;
