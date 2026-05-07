import express from "express";
import User from "../models/User.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("subscriptions");
    res.json(user.subscriptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const topic = String(req.body.topic || "")
      .toLowerCase()
      .trim();
    if (!topic) return res.status(400).json({ error: "Invalid topic" });
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { subscriptions: topic },
    });
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:topic", authMiddleware, async (req, res) => {
  try {
    const topic = String(req.params.topic || "")
      .toLowerCase()
      .trim();
    if (!topic) return res.status(400).json({ error: "Invalid topic" });
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { subscriptions: topic },
    });
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
