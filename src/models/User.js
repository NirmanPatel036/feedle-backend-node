import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  passwordHash: String,
  subscriptions: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});
export default mongoose.model("User", UserSchema);
