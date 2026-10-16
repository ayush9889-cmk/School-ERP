const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Unit Test 1", "Half Yearly"
    className: { type: String, required: true },
    subjects: [
      {
        name: { type: String, required: true, trim: true },
        maxMarks: { type: Number, required: true, min: 1 },
      },
    ],
    published: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

examSchema.index({ name: 1, className: 1 }, { unique: true });

module.exports = mongoose.model("Exam", examSchema);
