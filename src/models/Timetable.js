const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      required: true,
    },
    start: { type: String, required: true }, // "08:00"
    end: { type: String, required: true },
    subject: { type: String, required: true, trim: true },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
  },
  { _id: false },
);

const timetableSchema = new mongoose.Schema(
  {
    className: { type: String, required: true },
    section: { type: String, required: true, uppercase: true },
    slots: [slotSchema],
  },
  { timestamps: true },
);

timetableSchema.index({ className: 1, section: 1 }, { unique: true });

module.exports = mongoose.model("Timetable", timetableSchema);
