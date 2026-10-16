const Exam = require("../models/Exam");
const Class = require("../models/Class");
const { getTeacherByUser, getStudentByUser } = require("../utils/access");

exports.createExam = async (req, res, next) => {
  try {
    const { name, className, subjects } = req.body;

    if (!name || !className || !Array.isArray(subjects) || !subjects.length) {
      return res
        .status(400)
        .json({ message: "name, className and subjects[] are required" });
    }

    const cls = await Class.findOne({ name: className });
    if (!cls)
      return res
        .status(400)
        .json({ message: `Class ${className} does not exist` });

    for (const s of subjects) {
      if (!s.name || !(Number(s.maxMarks) > 0)) {
        return res
          .status(400)
          .json({ message: "Every subject needs a name and maxMarks > 0" });
      }
    }

    const names = subjects.map((s) => s.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      return res.status(400).json({ message: "Duplicate subject names" });
    }

    const exists = await Exam.findOne({ name, className });
    if (exists)
      return res
        .status(409)
        .json({ message: "Exam already exists for this class" });

    const exam = await Exam.create({
      name,
      className,
      subjects: subjects.map((s) => ({
        name: s.name.trim(),
        maxMarks: Number(s.maxMarks),
      })),
      createdBy: req.user._id,
    });

    res.status(201).json(exam);
  } catch (err) {
    next(err);
  }
};

exports.listExams = async (req, res, next) => {
  try {
    let filter = {};

    if (req.user.role === "teacher") {
      const teacher = await getTeacherByUser(req.user._id);
      if (!teacher)
        return res.status(404).json({ message: "Teacher profile not found" });
      const classNames = [...new Set(teacher.classes.map((c) => c.className))];
      filter = { className: { $in: classNames } };
    }

    if (req.user.role === "student") {
      const student = await getStudentByUser(req.user._id);
      if (!student)
        return res.status(404).json({ message: "Student profile not found" });
      filter = { className: student.className, published: true };
    }

    const exams = await Exam.find(filter).sort({ createdAt: -1 });
    res.json(exams);
  } catch (err) {
    next(err);
  }
};

// Admin: result publish / unpublish
exports.setPublished = async (req, res, next) => {
  try {
    const published = req.body.published !== false; // default true
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      { published },
      { new: true },
    );
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    res.json({
      message: published ? "Result published" : "Result unpublished",
      exam,
    });
  } catch (err) {
    next(err);
  }
};
