const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    className: { type: String, required: true },
    section: { type: String, required: true, uppercase: true },
    date: { type: String, required: true }, // "2026-10-14"
    status: {
      type: String,
      enum: ["present", "absent", "late", "leave"],
      required: true,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// ek student ki ek din mein ek hi entry
attendanceSchema.index({ student: 1, date: 1 }, { unique: true });
attendanceSchema.index({ className: 1, section: 1, date: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
