const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const {
  searchWeb,
  fetchWebPage,
} = require("../controllers/webSearchController");

// Web検索もログイン必須にする（既存APIと同じ方針）
router.use(authMiddleware);

// GET /api/web/search?q=...
router.get("/search", searchWeb);

// GET /api/web/fetch?url=...
router.get("/fetch", fetchWebPage);

module.exports = router;
