import express from "express";
import Bookmark from "../models/Bookmark.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ userId: req.user.id })
      .populate("articleId")
      .sort({ createdAt: -1 });
    res.json(bookmarks.map((b) => b.articleId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { articleId } = req.body;
    await Bookmark.create({ userId: req.user.id, articleId });
    res.sendStatus(201);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:articleId", authMiddleware, async (req, res) => {
  try {
    await Bookmark.findOneAndDelete({
      userId: req.user.id,
      articleId: req.params.articleId,
    });
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
