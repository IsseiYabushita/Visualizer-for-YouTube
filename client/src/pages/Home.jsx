import { useState, useEffect } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Stats from "./Stats";
import VideoPlayer from "../components/VideoPlayer";
import Channels from "./Channels";
import WebSearch from "../components/WebSearch";
import timeAgo from "../utils/timeAgo";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import useInfiniteScroll from "../utils/useInfiniteScroll";

function Home() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [savedVideos, setSavedVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("channels");
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);

  // 検索からのチャンネルパネル
  const [channelPanel, setChannelPanel] = useState(null); // { channelId, channelName }
  const [channelPanelVideos, setChannelPanelVideos] = useState([]);
  const [channelPanelNextPageToken, setChannelPanelNextPageToken] =
    useState(null);
  const [channelPanelLoading, setChannelPanelLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // 保存済み動画の無限スクロール
  const {
    visibleItems: visibleSavedVideos,
    sentinelRef: savedSentinelRef,
    hasMore: savedHasMore,
  } = useInfiniteScroll(savedVideos, 12);

  useEffect(() => {
    // タブタイトルを常にアプリ名に固定しておく
    // 理由: Web検索結果をアプリ内(iframe)で開いても、ブラウザのウィンドウタイトルを維持したいため
    document.title = "visualizer-for-youtube";

    fetchSavedVideos();
    fetchWeeklyDuration();
    // 30秒ごとにグラフを自動更新
    const timer = setInterval(fetchWeeklyDuration, 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchWeeklyDuration = async () => {
    try {
      const res = await api.get("/api/videos/weekly-duration", { headers });
      setWeeklyData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSavedVideos = async () => {
    try {
      const res = await api.get("/api/videos", {
        headers,
      });
      setSavedVideos(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/youtube/search?q=${query}`, { headers });
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSave = async (video, status) => {
    try {
      await api.post("/api/videos", { ...video, status }, { headers });
      fetchSavedVideos();
      alert("保存しました！");
    } catch (err) {
      alert("保存に失敗しました");
    }
  };

  const handleSubscribeFromVideo = async (video) => {
    try {
      const searchRes = await api.get(
        `/api/channels/search?q=${encodeURIComponent(video.channel_name)}`,
        { headers },
      );
      const matched = searchRes.data.find(
        (ch) => ch.channel_name === video.channel_name,
      );
      if (!matched) {
        alert("チャンネルが見つかりませんでした");
        return;
      }
      await api.post(
        "/api/channels",
        { channel_id: matched.channel_id },
        { headers },
      );
      alert(`「${video.channel_name}」を登録しました！`);
    } catch (err) {
      alert("登録済みか、チャンネル登録に失敗しました");
    }
  };

  const handleOpenChannelPanel = async (channelId, channelName) => {
    setChannelPanel({ channelId, channelName });
    setChannelPanelVideos([]);
    setChannelPanelNextPageToken(null);
    setChannelPanelLoading(true);
    try {
      const res = await api.get(`/api/youtube/channel/${channelId}/videos`, {
        headers,
      });
      setChannelPanelVideos(res.data.videos || []);
      setChannelPanelNextPageToken(res.data.nextPageToken || null);
    } catch (err) {
      console.error(err);
    }
    setChannelPanelLoading(false);
  };

  const handleLoadMoreChannelPanel = async () => {
    if (!channelPanelNextPageToken || !channelPanel) return;
    setChannelPanelLoading(true);
    try {
      const res = await api.get(
        `/api/youtube/channel/${channelPanel.channelId}/videos?pageToken=${encodeURIComponent(channelPanelNextPageToken)}`,
        { headers },
      );
      setChannelPanelVideos((prev) => [...prev, ...(res.data.videos || [])]);
      setChannelPanelNextPageToken(res.data.nextPageToken || null);
    } catch (err) {
      console.error(err);
    }
    setChannelPanelLoading(false);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/videos/${id}`, { headers });
      fetchSavedVideos();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.put(`/api/videos/${id}`, { status }, { headers });
      fetchSavedVideos();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      {playingVideoId && (
        <VideoPlayer
          videoId={playingVideoId.youtubeId}
          videoDbId={playingVideoId.dbId}
          token={token}
          onClose={() => {
            setPlayingVideoId(null);
            fetchWeeklyDuration();
          }}
        />
      )}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem" }}>
        {/* ヘッダー */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
            borderBottom: "1px solid #333",
            paddingBottom: "1rem",
          }}
        >
          <h1 style={{ color: "#ff0000" }}>Visualizer for YouTube</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span>{user?.username}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: "0.5rem 1rem",
                background: "#333",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* タブ */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginBottom: "1rem",
            alignItems: "center",
          }}
        >
          {["channels", "search", "web", "saved", "stats"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.5rem 1.5rem",
                background: activeTab === tab ? "#ff0000" : "#333",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              {tab === "channels"
                ? "チャンネル"
                : tab === "search"
                  ? "検索"
                  : tab === "web"
                    ? "Web検索"
                    : tab === "saved"
                      ? "保存済み"
                      : "統計"}
            </button>
          ))}
        </div>

        {/* 過去7日間の再生時間グラフ */}
        <div
          style={{
            background: "#1a1a1a",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <p style={{ fontSize: "0.85rem", color: "#aaa", margin: 0 }}>
              過去7日間の再生時間
            </p>
            <button
              onClick={fetchWeeklyDuration}
              style={{
                background: "none",
                border: "1px solid #444",
                color: "#aaa",
                borderRadius: "4px",
                padding: "2px 8px",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              ↻ 更新
            </button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={weeklyData}
              margin={{ top: 24, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#aaa" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name, props) => {
                  const s = props.payload.seconds || 0;
                  if (s < 60) return [`${s}s`, "再生時間"];
                  const m = Math.floor(s / 60);
                  if (m < 60)
                    return [
                      `${m}m${s % 60 > 0 ? (s % 60) + "s" : ""}`,
                      "再生時間",
                    ];
                  const h = Math.floor(m / 60);
                  const rm = m % 60;
                  return [rm > 0 ? `${h}h${rm}m` : `${h}h`, "再生時間"];
                }}
                contentStyle={{
                  background: "#0f0f0f",
                  border: "1px solid #333",
                  fontSize: "0.85rem",
                }}
              />
              <Bar
                dataKey="seconds"
                fill="#ff0000"
                radius={[4, 4, 0, 0]}
                minPointSize={3}
              >
                <LabelList
                  dataKey="seconds"
                  position="top"
                  style={{ fontSize: "0.7rem", fill: "#aaa" }}
                  formatter={(s) => {
                    if (!s || s === 0) return "";
                    if (s < 60) return `${s}s`;
                    const m = Math.floor(s / 60);
                    if (m < 60) return `${m}m`;
                    const h = Math.floor(m / 60);
                    const rm = m % 60;
                    return rm > 0 ? `${h}h${rm}m` : `${h}h`;
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* チャンネルタブ */}
        {activeTab === "channels" && <Channels onPlay={setPlayingVideoId} />}

        {/* 検索タブ */}
        {activeTab === "search" && (
          <div>
            {/* チャンネルパネル */}
            {channelPanel && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <button
                    onClick={() => setChannelPanel(null)}
                    style={{
                      padding: "0.4rem 1rem",
                      background: "#333",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    ← 検索結果に戻る
                  </button>
                  <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
                    {channelPanel.channelName}
                  </h2>
                </div>
                {channelPanelLoading && channelPanelVideos.length === 0 && (
                  <p style={{ color: "#aaa" }}>読み込み中...</p>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {channelPanelVideos.map((video) => (
                    <div
                      key={video.youtube_id}
                      style={{
                        background: "#1a1a1a",
                        borderRadius: "8px",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        loading="lazy"
                        style={{
                          width: "100%",
                          cursor: "pointer",
                          display: "block",
                        }}
                        onClick={() =>
                          setPlayingVideoId({
                            youtubeId: video.youtube_id,
                            dbId: null,
                          })
                        }
                      />
                      <div
                        style={{
                          padding: "0.75rem",
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "0.9rem",
                            marginBottom: "0.5rem",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {video.title}
                        </p>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "#666",
                            marginBottom: "0.75rem",
                          }}
                        >
                          {video.published_at
                            ? `${new Date(video.published_at).toLocaleDateString("ja-JP")} · ${timeAgo(video.published_at)}`
                            : ""}
                        </p>
                        <button
                          onClick={() => handleSave(video, "watch_later")}
                          style={{
                            marginTop: "auto",
                            padding: "0.4rem",
                            background: "#333",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          あとで見る
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {channelPanelNextPageToken && (
                  <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
                    <button
                      onClick={handleLoadMoreChannelPanel}
                      disabled={channelPanelLoading}
                      style={{
                        padding: "0.6rem 2rem",
                        background: channelPanelLoading ? "#333" : "#555",
                        color: channelPanelLoading ? "#777" : "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: channelPanelLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {channelPanelLoading ? "読み込み中..." : "もっと見る"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* 検索フォームと結果（チャンネルパネル非表示時） */}
            {!channelPanel && (
              <div>
                <form
                  onSubmit={handleSearch}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginBottom: "2rem",
                  }}
                >
                  <input
                    type="text"
                    placeholder="動画を検索..."
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
                    }}
                  >
                    検索
                  </button>
                </form>
                {loading && <p>検索中...</p>}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {searchResults.map((video) => (
                    <div
                      key={video.youtube_id}
                      style={{
                        background: "#1a1a1a",
                        borderRadius: "8px",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        loading="lazy"
                        style={{
                          width: "100%",
                          cursor: "pointer",
                          display: "block",
                        }}
                        onClick={() =>
                          setPlayingVideoId({
                            youtubeId: video.youtube_id,
                            dbId: null,
                          })
                        }
                      />
                      <div
                        style={{
                          padding: "0.75rem",
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "0.9rem",
                            marginBottom: "0.5rem",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {video.title}
                        </p>
                        <p
                          style={{
                            fontSize: "0.8rem",
                            color: "#1a8cd8",
                            marginBottom: "0.25rem",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                          onClick={() =>
                            handleOpenChannelPanel(
                              video.channel_id,
                              video.channel_name,
                            )
                          }
                        >
                          {video.channel_name}
                        </p>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "#777",
                            marginBottom: "0.75rem",
                          }}
                        >
                          {video.published_at
                            ? `${new Date(video.published_at).toLocaleDateString("ja-JP")} · ${timeAgo(video.published_at)}`
                            : ""}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            marginTop: "auto",
                          }}
                        >
                          <button
                            onClick={() => handleSave(video, "watch_later")}
                            style={{
                              flex: 1,
                              padding: "0.4rem",
                              background: "#333",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "0.8rem",
                            }}
                          >
                            あとで見る
                          </button>
                          <button
                            onClick={() => handleSubscribeFromVideo(video)}
                            style={{
                              flex: 1,
                              padding: "0.4rem",
                              background: "#ff0000",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "0.8rem",
                            }}
                          >
                            チャンネル登録
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Web検索タブ */}
        {activeTab === "web" && <WebSearch />}

        {/* 保存済みタブ */}
        {activeTab === "saved" && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              {visibleSavedVideos.map((video) => (
                <div
                  key={video.id}
                  style={{
                    background: "#1a1a1a",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    loading="lazy"
                    style={{ width: "100%", cursor: "pointer" }}
                    onClick={() =>
                      setPlayingVideoId({
                        youtubeId: video.youtube_id,
                        dbId: video.id,
                      })
                    }
                  />
                  <div style={{ padding: "0.75rem" }}>
                    <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                      {video.title}
                    </p>
                    <p
                      style={{
                        fontSize: "0.8rem",
                        color: video.channel_id ? "#1a8cd8" : "#aaa",
                        marginBottom: "0.25rem",
                        cursor: video.channel_id ? "pointer" : "default",
                        textDecoration: video.channel_id ? "underline" : "none",
                      }}
                      onClick={() => {
                        if (video.channel_id)
                          handleOpenChannelPanel(
                            video.channel_id,
                            video.channel_name,
                          );
                      }}
                    >
                      {video.channel_name}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "#777",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {video.published_at
                        ? `${new Date(video.published_at).toLocaleDateString("ja-JP")} · ${timeAgo(video.published_at)}`
                        : ""}
                    </p>
                    <select
                      value={video.status}
                      onChange={(e) =>
                        handleUpdateStatus(video.id, e.target.value)
                      }
                      style={{
                        width: "100%",
                        padding: "0.4rem",
                        background: "#333",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <option value="watch_later">あとで見る</option>
                      <option value="watched">視聴済み</option>
                      <option value="favorite">お気に入り</option>
                    </select>
                    <button
                      onClick={() => handleDelete(video.id)}
                      style={{
                        width: "100%",
                        padding: "0.4rem",
                        background: "#ff4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {savedHasMore && (
              <div ref={savedSentinelRef} style={{ height: "1px" }} />
            )}
          </div>
        )}

        {/* 統計タブ */}
        {activeTab === "stats" && <Stats />}
      </div>
    </>
  );
}

export default Home;
