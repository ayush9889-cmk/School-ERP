const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    className: { type: String, required: true },
    section: { type: String, required: true },
    rollNo: { type: Number },
    dob: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    parentName: { type: String, required: true, trim: true },
    parentWhatsApp: { type: String, required: true },
    address: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Student", studentSchema);
