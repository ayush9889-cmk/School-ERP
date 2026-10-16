const mongoose = require("mongoose");

const feeChargeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    className: { type: String, required: true },
    section: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    dueDate: { type: String, required: true }, // "2026-10-31"
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// ek student par ek hi fee (title + due date) do baar nahi lagegi
feeChargeSchema.index({ student: 1, title: 1, dueDate: 1 }, { unique: true });

module.exports = mongoose.model("FeeCharge", feeChargeSchema);
