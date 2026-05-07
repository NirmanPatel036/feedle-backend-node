import mongoose from "mongoose";

const BookmarkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  articleId: { type: mongoose.Schema.Types.ObjectId, ref: "Article" },
  createdAt: { type: Date, default: Date.now },
});
BookmarkSchema.index({ userId: 1, articleId: 1 }, { unique: true });
export default mongoose.model("Bookmark", BookmarkSchema);
