import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

// 認証エラー(401/403)の扱いを共通化
// 理由: トークンが期限切れ/無効になった時に、画面ごとに同じ処理を書くのを避けたい
// 注意: /api/auth 系（ログイン/登録）の失敗まで強制ログアウトすると使いにくいので除外する
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";

    const isAuthEndpoint = url.startsWith("/api/auth");
    const isAuthError = status === 401 || status === 403;

    if (isAuthError && !isAuthEndpoint) {
      // localStorage を消しておく（AuthContext はリロード時にここを読む）
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // 画面状態（Reactのstate）も古いトークンを持ち続けるので、一度リロードしてログインへ
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
