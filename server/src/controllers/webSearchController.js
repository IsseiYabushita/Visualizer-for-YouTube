const https = require("https");
const dns = require("dns").promises;
const net = require("net");
const sanitizeHtml = require("sanitize-html");

// DuckDuckGo のHTML検索結果を取得する（APIキー不要で始めやすい）
// 注意: HTML構造が変わると壊れる可能性があるため、最低限のフォールバックも入れる
const fetchHtml = async (url, redirectsLeft = 3) => {
  // 再帰的にリダイレクトを追うための内部実装
  const doRequest = async (targetUrl, redirectsLeftInner) => {
    const tu = new URL(targetUrl);
    const protoHttps = tu.protocol === "https:";

    // 解決: A/AAAA を優先して取得（hosts を無視）
    let addrs = [];
    try {
      const a4 = await dns.resolve4(tu.hostname).catch(() => []);
      addrs = addrs.concat(a4.map((a) => ({ address: a, family: 4 })));
    } catch {}
    try {
      const a6 = await dns.resolve6(tu.hostname).catch(() => []);
      addrs = addrs.concat(a6.map((a) => ({ address: a, family: 6 })));
    } catch {}

    if (!addrs || addrs.length === 0) {
      throw new Error("DNS解決に失敗しました");
    }

    // プライベートIPを避ける
    const usable = addrs.find((a) => !isPrivateIp(a.address));
    if (!usable)
      throw new Error("到達先がプライベートIPのため接続を拒否しました");

    const ip = usable.address;

    const requestModule = protoHttps ? https : require("http");

    return await new Promise((resolve, reject) => {
      const options = {
        host: ip,
        port: tu.port || (protoHttps ? 443 : 80),
        path: tu.pathname + tu.search,
        method: "GET",
        headers: {
          "User-Agent":
            "visualizer-for-youtube/1.0 (+https://localhost) node.js",
          "Accept-Language": "ja,en;q=0.8",
          Accept: "text/html",
          "Accept-Encoding": "identity",
          Host: tu.hostname,
        },
      };

      // HTTPS の場合は SNI を元のホスト名で送る
      if (protoHttps) options.servername = tu.hostname;

      const req = requestModule.request(options, (res) => {
        // リダイレクト対応
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          if (redirectsLeftInner <= 0) {
            reject(new Error("Too many redirects"));
            return;
          }
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          // 再帰
          doRequest(nextUrl, redirectsLeftInner - 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            body,
            statusCode: res.statusCode || 0,
            headers: res.headers,
          }),
        );
        res.on("error", reject);
      });

      req.on("error", reject);
      req.end();
    });
  };

  return doRequest(url, redirectsLeft);
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

// SSRF（サーバが社内/ローカル等へ勝手にアクセスする攻撃）を避けるための最低限チェック
// - http/https のみ許可
// - プライベートIP/localhost/メタデータIPなどは拒否
const isPrivateIp = (ip) => {
  // IPv4
  if (net.isIP(ip) === 4) {
    const parts = ip.split(".").map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  // IPv6
  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fe80:")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    return false;
  }

  // 不明は安全側で拒否
  return true;
};

const ensureSafeTargetUrl = async (rawUrl) => {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URLが不正です" };
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "http/https 以外のURLは許可されていません" };
  }

  // user:pass@host のような URL は避ける
  if (u.username || u.password) {
    return { ok: false, reason: "認証情報付きURLは許可されていません" };
  }

  const hostname = u.hostname;
  if (!hostname) return { ok: false, reason: "URLのホスト名が不正です" };

  // まず hostname が IP 直書きの場合
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return {
        ok: false,
        reason: "ローカル/プライベート宛てURLは許可されていません",
      };
    }
    return { ok: true, url: u.toString() };
  }

  // hostname の DNS 解決でプライベートIPに向くものを拒否
  try {
    let addrs = [];
    try {
      const a4 = await dns.resolve4(hostname).catch(() => []);
      addrs = addrs.concat(a4.map((a) => ({ address: a, family: 4 })));
    } catch {}
    try {
      const a6 = await dns.resolve6(hostname).catch(() => []);
      addrs = addrs.concat(a6.map((a) => ({ address: a, family: 6 })));
    } catch {}

    if (!addrs || addrs.length === 0) {
      return { ok: false, reason: "URLの解決に失敗しました" };
    }

    const hasPublic = addrs.some((a) => !isPrivateIp(a.address));
    if (!hasPublic) {
      return {
        ok: false,
        reason: "ローカル/プライベート宛てURLは許可されていません",
      };
    }
  } catch {
    return { ok: false, reason: "URLの解決に失敗しました" };
  }

  return { ok: true, url: u.toString() };
};

// Webページを取得して「安全なHTML」にして返す（iframeがブロックされる時の代替）
// GET /api/web/fetch?url=...
const fetchWebPage = async (req, res) => {
  const rawUrl = (req.query.url || "").toString().trim();
  if (!rawUrl) {
    return res.status(400).json({ error: "URLを指定してください" });
  }
  if (rawUrl.length > 2000) {
    return res.status(400).json({ error: "URLが長すぎます" });
  }

  const safe = await ensureSafeTargetUrl(rawUrl);
  if (!safe.ok) {
    return res.status(400).json({ error: safe.reason });
  }

  try {
    // fetch の代わりに hosts を無視する fetchHtml を使う
    const timeoutMs = 10000;
    const p = fetchHtml(safe.url, 5);
    const response = await Promise.race([
      p,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout")), timeoutMs),
      ),
    ]);

    // response は { body, statusCode, headers }
    if (!response || !response.statusCode || response.statusCode >= 400) {
      return res.status(502).json({
        error: `取得に失敗しました（HTTP ${response?.statusCode || "?"}）`,
      });
    }

    const contentType =
      (response.headers &&
        (response.headers["content-type"] ||
          response.headers["Content-Type"])) ||
      "";
    if (!contentType.includes("text/html")) {
      return res.status(415).json({ error: "HTML以外は表示できません" });
    }

    // 巨大レスポンス対策（最大 1MB）
    const MAX_BYTES = 1_000_000;
    const html = response.body || "";
    if (Buffer.byteLength(html, "utf8") > MAX_BYTES) {
      return res.status(413).json({ error: "ページが大きすぎます" });
    }

    // title をざっくり抽出（なければURL）
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch
      ? decodeHtmlEntities(stripTags(titleMatch[1]))
      : safe.url;

    // XSS対策としてサニタイズして返す
    const safeHtml = sanitizeHtml(html, {
      allowedTags: [
        "h1",
        "h2",
        "h3",
        "p",
        "ul",
        "ol",
        "li",
        "a",
        "strong",
        "em",
        "br",
        "blockquote",
        "code",
        "pre",
        "hr",
      ],
      allowedAttributes: {
        a: ["href"],
      },
      // 相対リンクはそのままだと壊れるので、可能なら絶対URLにする
      transformTags: {
        a: (tagName, attribs) => {
          const href = attribs.href || "";
          try {
            const abs = new URL(href, safe.url).toString();
            return { tagName, attribs: { href: abs } };
          } catch {
            return { tagName, attribs: { href: "" } };
          }
        },
      },
    });

    return res.json({ title, url: safe.url, html: safeHtml });
  } catch (err) {
    const isAbort = err?.name === "AbortError";
    return res.status(502).json({
      error: isAbort ? "取得がタイムアウトしました" : "取得に失敗しました",
    });
  }
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
    const resp = await fetchHtml(url);
    const html = resp && resp.body ? resp.body : "";
    const results = parseDuckDuckGoHtml(html, 12);

    // 仕様: 画面側が扱いやすいように results 配列で返す
    return res.json({ results });
  } catch (err) {
    return res.status(500).json({ error: "Web検索に失敗しました" });
  }
};

module.exports = { searchWeb, fetchWebPage };
