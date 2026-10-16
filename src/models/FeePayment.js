const mongoose = require("mongoose");

const feePaymentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    date: { type: String, required: true }, // "2026-10-16"
    mode: {
      type: String,
      enum: ["cash", "upi", "bank", "cheque", "concession"],
      default: "cash",
    },
    reference: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
    receiptNo: { type: String, required: true, unique: true },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    voided: { type: Boolean, default: false },
    voidReason: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("FeePayment", feePaymentSchema);
