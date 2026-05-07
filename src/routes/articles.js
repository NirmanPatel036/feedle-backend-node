import express from "express";
import Article from "../models/Article.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { category, categories, page = 1, limit = 20, q, random } = req.query;
    const filter = {};
    if (categories) {
      const list = String(categories)
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      if (list.length) filter.category = { $in: list };
    } else if (category) {
      filter.category = String(category).toLowerCase();
    }
    if (q) filter.$text = { $search: q };

    const limitNumber = Number(limit);
    const pageNumber = Number(page);
    if (random === "true") {
      const articles = await Article.aggregate([
        { $match: filter },
        { $sample: { size: limitNumber } },
      ]);
      return res.json(articles);
    }

    const articles = await Article.find(filter)
      .sort({ publishedAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ error: "Not found" });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
