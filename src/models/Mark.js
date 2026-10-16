const mongoose = require("mongoose");

const markSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    subject: { type: String, required: true },
    obtained: { type: Number, default: null },
    absent: { type: Boolean, default: false },
    maxMarks: { type: Number, required: true },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

markSchema.index({ exam: 1, student: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model("Mark", markSchema);
