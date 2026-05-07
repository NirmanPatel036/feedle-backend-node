import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import articleRoutes from "./routes/articles.js";
import authRoutes from "./routes/auth.js";
import bookmarkRoutes from "./routes/bookmarks.js";
import subscriptionRoutes from "./routes/subscriptions.js";

import "./jobs/fetchArticles.js"; // starts the cron job on boot
import { fetchAllCategories } from "./jobs/fetchArticles.js";
fetchAllCategories(); // runs once on boot

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:8080",
      "https://feedle-rho.vercel.app"
      "https://feedle-backend-java-production.up.railway.app/feedle/"
    ],
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api/articles", articleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`),
    );
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });

app.get("/api/trigger-fetch", async (req, res) => {
  try {
    const { fetchAllCategories } = await import("./jobs/fetchArticles.js");
    await fetchAllCategories();
    res.json({ message: "Fetch complete" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
