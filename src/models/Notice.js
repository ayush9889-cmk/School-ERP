const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    audience: {
      type: String,
      enum: ["all", "students", "teachers"],
      default: "all",
    },
    // optional: sirf kisi class/section ke students ke liye
    className: { type: String, default: null },
    section: { type: String, uppercase: true, default: null },
    pinned: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notice", noticeSchema);
