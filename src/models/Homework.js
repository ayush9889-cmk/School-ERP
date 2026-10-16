const mongoose = require("mongoose");

const homeworkSchema = new mongoose.Schema(
  {
    className: { type: String, required: true },
    section: { type: String, required: true, uppercase: true },
    subject: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    dueDate: { type: String, required: true }, // "2026-10-20"
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
  },
  { timestamps: true },
);

homeworkSchema.index({ className: 1, section: 1, dueDate: -1 });

module.exports = mongoose.model("Homework", homeworkSchema);
