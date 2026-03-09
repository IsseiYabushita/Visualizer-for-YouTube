# Visualizer for YouTube

YouTubeの視聴習慣を管理・可視化するWebアプリです。動画の保存・ステータス管理、チャンネル登録管理、アプリ内プレイヤーでの視聴時間の自動計測、日別・月別・年別の視聴統計グラフ表示が行えます。

## デモ

**URL:** https://visualizer-for-youtube-client.onrender.com/

> **注意:** Renderの無料プランを使用しているため、しばらくアクセスがない場合は初回起動に約1分かかることがあります。

デモアカウントでそのままログインできます：

| Email            | Password |
| ---------------- | -------- |
| demo@example.com | demo1234 |

## 主な機能

- **動画検索・保存** - YouTube Data APIを使った動画検索、あとで見る／視聴済み／お気に入りのステータス管理
- **チャンネル管理** - チャンネル登録・新着動画フィード（3時間DBキャッシュ）
- **Google OAuth連携** - Googleアカウントで認証し、YouTubeの登録チャンネルを一括インポート
- **アプリ内プレイヤー** - react-youtubeによるアプリ内再生、5秒ポーリングで視聴時間を自動記録
- **視聴統計** - 日別・月別・年別の視聴時間グラフ（Recharts）、ステータス別動画数の円グラフ
- **無限スクロール** - 保存済み動画一覧のIntersection Observer対応

## 技術スタック

| 領域           | 使用技術                                              |
| -------------- | ----------------------------------------------------- |
| フロントエンド | React 18, Vite, React Router, Recharts, react-youtube |
| バックエンド   | Node.js, Express                                      |
| データベース   | PostgreSQL (Supabase)                                 |
| 認証           | JWT, bcrypt, Google OAuth 2.0                         |
| 外部API        | YouTube Data API v3                                   |
| デプロイ       | Render (サーバー・クライアント), Supabase (DB)        |

## セットアップ（ローカル）

### 前提条件

- Node.js 18以上
- PostgreSQLまたはSupabaseのプロジェクト
- YouTube Data API v3のAPIキー
- Google OAuth 2.0のクライアントID・シークレット（チャンネルインポート機能を使う場合）

### 手順

```bash
# リポジトリをクローン
git clone https://github.com/IsseiYabushita/Visualizer-for-YouTube.git
cd youtube-manager

# サーバーのセットアップ
cd server
cp .env.example .env
# .envを編集して各値を設定
npm install

# DBの初期化
# Supabase または PostgreSQL の SQL エディタで server/src/db/init.sql を実行

# クライアントのセットアップ
cd ../client
cp .env.example .env
# .envを編集してVITE_API_URLを設定
npm install
```

### 起動

```bash
# サーバー（server/ディレクトリで）
npm start

# クライアント（client/ディレクトリで）
npm run dev
```

### 環境変数

**server/.env**

| 変数名                 | 説明                                  |
| ---------------------- | ------------------------------------- |
| `PORT`                 | サーバーポート（デフォルト: 3000）    |
| `DATABASE_URL`         | PostgreSQL接続URL                     |
| `JWT_SECRET`           | JWTの署名に使うシークレット           |
| `YOUTUBE_API_KEY`      | YouTube Data API v3のAPIキー          |
| `CLIENT_URL`           | フロントエンドのURL（CORS設定用）     |
| `GOOGLE_CLIENT_ID`     | Google OAuth クライアントID           |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット |
| `GOOGLE_REDIRECT_URI`  | OAuth コールバックURL                 |

**client/.env**

| 変数名         | 説明                      |
| -------------- | ------------------------- |
| `VITE_API_URL` | バックエンドサーバーのURL |

## ディレクトリ構成

```
youtube-manager/
├── client/                 # Reactフロントエンド
│   └── src/
│       ├── components/     # VideoPlayer
│       ├── context/        # AuthContext (JWT管理)
│       ├── pages/          # Home, Channels, Stats, Login, Register
│       └── utils/          # timeAgo, useInfiniteScroll
└── server/                 # Expressバックエンド
    └── src/
        ├── controllers/    # auth, video, channel, youtube
        ├── db/             # DB接続, init.sql
        ├── middleware/     # JWT認証ミドルウェア
        └── routes/         # ルーティング
```
