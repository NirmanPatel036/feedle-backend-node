import mongoose from "mongoose";

const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  url: { type: String, required: true },
  urlHash: { type: String, unique: true }, // dedup key
  urlToImage: String,
  source: String,
  category: { type: String, index: true },
  publishedAt: Date,
  fetchedAt: Date,
});
export default mongoose.model("Article", ArticleSchema);
