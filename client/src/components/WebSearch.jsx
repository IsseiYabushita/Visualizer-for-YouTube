import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import WebView from "./WebView";

// Web検索タブ用コンポーネント
// 目的: サーバ側でWeb検索→結果をアプリ内で表示（iframe）し、ブラウザのタブタイトルをアプリのまま維持する
function WebSearch() {
  const { token } = useAuth();

  const headers = useMemo(() => {
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);

  // 結果クリック後の “アプリ内ブラウザ” 表示
  const [selectedUrl, setSelectedUrl] = useState(null);

  useEffect(() => {
    // 念のため画面表示時にタイトル固定
    document.title = "visualizer-for-youtube";
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();

    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      // encodeURIComponent を使う理由: スペースや日本語などをURLクエリとして安全に送るため
      const res = await api.get(`/api/web/search?q=${encodeURIComponent(q)}`, {
        headers,
      });
      setResults(res.data.results || []);
    } catch (err) {
      // 失敗理由を表示（CORS/認証/サーバエラー切り分け用）
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.error;
      if (status) {
        setError(
          `Web検索に失敗しました（HTTP ${status}）${serverMessage ? `: ${serverMessage}` : ""}`,
        );
      } else {
        // response がない場合は、CORSやネットワーク到達不可の可能性が高い
        setError(
          "Web検索に失敗しました（ネットワーク/CORSの可能性）。サーバURLとCORS設定を確認してください。",
        );
      }
    }

    setLoading(false);
  };

  // 選択中は WebView（iframe）を優先表示
  if (selectedUrl) {
    return <WebView url={selectedUrl} onClose={() => setSelectedUrl(null)} />;
  }

  return (
    <div>
      <form
        onSubmit={handleSearch}
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
      >
        <input
          type="text"
          placeholder="Webを検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            padding: "0.75rem",
            borderRadius: "4px",
            border: "1px solid #333",
            background: "#1a1a1a",
            color: "#fff",
            fontSize: "1rem",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "0.75rem 1.5rem",
            background: "#ff0000",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          検索
        </button>
      </form>

      {loading && <p style={{ color: "#aaa" }}>検索中...</p>}
      {error && <p style={{ color: "#ff4444" }}>{error}</p>}

      {/* 検索結果 */}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {results.map((r) => (
          <div
            key={r.url}
            style={{
              background: "#1a1a1a",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#1a8cd8",
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: "1rem",
              }}
              onClick={() => setSelectedUrl(r.url)}
            >
              {r.title}
            </p>
            <p
              style={{
                margin: "0.25rem 0 0",
                color: "#777",
                fontSize: "0.85rem",
              }}
            >
              {r.displayUrl || r.url}
            </p>
            {r.snippet && (
              <p
                style={{
                  margin: "0.5rem 0 0",
                  color: "#aaa",
                  fontSize: "0.9rem",
                }}
              >
                {r.snippet}
              </p>
            )}
            <div
              style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}
            >
              <button
                onClick={() => setSelectedUrl(r.url)}
                style={{
                  padding: "0.4rem 1rem",
                  background: "#333",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                アプリ内で開く
              </button>
              <button
                onClick={() =>
                  window.open(r.url, "_blank", "noopener,noreferrer")
                }
                style={{
                  padding: "0.4rem 1rem",
                  background: "#555",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                外部で開く
              </button>
            </div>
          </div>
        ))}

        {!loading && results.length === 0 && query.trim() !== "" && !error && (
          <p style={{ color: "#aaa" }}>結果がありませんでした。</p>
        )}
      </div>
    </div>
  );
}

export default WebSearch;
