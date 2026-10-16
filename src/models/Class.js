const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // "1", "2", "Nursery"
    sections: [{ type: String, trim: true, uppercase: true }], // ["A", "B"]
    classTeachers: [
      {
        section: { type: String, uppercase: true },
        teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Class", classSchema);
