const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true }, // WhatsApp number
    qualification: { type: String },
    subjects: [{ type: String, trim: true }],
    // kaun si class, section mein kaun sa subject padhata hai
    classes: [
      {
        className: { type: String, required: true },
        section: { type: String, required: true, uppercase: true },
        subject: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Teacher", teacherSchema);
