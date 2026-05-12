const https = require("https");

// DuckDuckGo のHTML検索結果を取得する（APIキー不要で始めやすい）
// 注意: HTML構造が変わると壊れる可能性があるため、最低限のフォールバックも入れる
const fetchHtml = (url, redirectsLeft = 3) => {
  return new Promise((resolve, reject) => {
    // Accept-Encoding を identity にして、gzip/br の解凍処理を不要にする
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "visualizer-for-youtube/1.0 (+https://localhost) node.js",
          "Accept-Language": "ja,en;q=0.8",
          Accept: "text/html",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        // リダイレクト対応
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          if (redirectsLeft <= 0) {
            reject(new Error("Too many redirects"));
            return;
          }
          const nextUrl = new URL(res.headers.location, url).toString();
          resolve(fetchHtml(nextUrl, redirectsLeft - 1));
          return;
        }

        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(body));
        res.on("error", reject);
      },
    );

    req.on("error", reject);
    req.end();
  });
};

// http/https のみ許可する（変なスキームを弾いて安全寄りにする）
const isSafeHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

// DuckDuckGo のリダイレクトURL（/l/?uddg=...）を実URLに戻す
const decodeDuckDuckGoHref = (href) => {
  if (!href) return null;

  // すでに外部URLならそのまま
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  // DuckDuckGoの相対リンクを想定（/l/?uddg=...）
  if (href.startsWith("/")) {
    const wrapped = new URL(href, "https://duckduckgo.com");
    const uddg = wrapped.searchParams.get("uddg");
    if (uddg) {
      try {
        return decodeURIComponent(uddg);
      } catch {
        return uddg;
      }
    }
    // uddg がない場合は、duckduckgo内リンクなので無視
    return null;
  }

  return null;
};

// HTMLから最小限の情報を抽出する（追加依存なし）
// トレードオフ: cheerioのようなDOMパーサより壊れやすいが、この環境ではnpm installが難しいためMVPとして採用
const decodeHtmlEntities = (value) => {
  if (!value) return "";
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
};

const stripTags = (value) => {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, "");
};

const parseDuckDuckGoHtml = (html, limit = 10) => {
  const results = [];

  // result__a のリンクを拾う（DuckDuckGo /html/ の定番クラス）
  const linkRegex =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  let match;
  while ((match = linkRegex.exec(html)) && results.length < limit) {
    const href = match[1];
    const rawTitle = match[2];

    const url = decodeDuckDuckGoHref(href);
    const title = decodeHtmlEntities(stripTags(rawTitle));
    if (!title || !url || !isSafeHttpUrl(url)) continue;

    // ざっくり snippet を近傍から拾う（見つからない場合は空でOK）
    const near = html.slice(match.index, match.index + 2500);
    const snippetMatch = near.match(
      /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/,
    );
    const snippet = snippetMatch
      ? decodeHtmlEntities(stripTags(snippetMatch[1]))
      : "";

    let displayUrl = "";
    try {
      displayUrl = new URL(url).hostname;
    } catch {
      displayUrl = "";
    }

    results.push({ title, url, snippet, displayUrl });
  }

  return results;
};

// GET /api/web/search?q=...
const searchWeb = async (req, res) => {
  const q = (req.query.q || "").toString().trim();

  // 入力チェック（サーバ保護のため、長すぎるクエリは弾く）
  if (!q) {
    return res.status(400).json({ error: "検索キーワードを入力してください" });
  }
  if (q.length > 200) {
    return res.status(400).json({ error: "検索キーワードが長すぎます" });
  }

  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const html = await fetchHtml(url);
    const results = parseDuckDuckGoHtml(html, 12);

    // 仕様: 画面側が扱いやすいように results 配列で返す
    return res.json({ results });
  } catch (err) {
    return res.status(500).json({ error: "Web検索に失敗しました" });
  }
};

module.exports = { searchWeb };
