const Homework = require("../models/Homework");
const {
  isValidDate,
  getTeacherByUser,
  getStudentByUser,
  canGiveHomework,
} = require("../utils/access");

exports.createHomework = async (req, res, next) => {
  try {
    const { className, section, subject, title, description, dueDate } =
      req.body;

    if (!className || !section || !subject || !title || !dueDate) {
      return res.status(400).json({
        message: "className, section, subject, title, dueDate are required",
      });
    }
    if (!isValidDate(dueDate)) {
      return res.status(400).json({ message: "dueDate must be YYYY-MM-DD" });
    }

    const teacher = await getTeacherByUser(req.user._id);
    if (!teacher)
      return res.status(404).json({ message: "Teacher profile not found" });

    if (!canGiveHomework(teacher, className, section, subject)) {
      return res.status(403).json({
        message: "Aap is class mein ye subject nahi padhate",
      });
    }

    const hw = await Homework.create({
      className,
      section,
      subject,
      title,
      description,
      dueDate,
      createdBy: teacher._id,
    });

    res.status(201).json(hw);
  } catch (err) {
    next(err);
  }
};

// Teacher: apna diya hua homework
exports.teacherHomework = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUser(req.user._id);
    if (!teacher)
      return res.status(404).json({ message: "Teacher profile not found" });

    const list = await Homework.find({ createdBy: teacher._id }).sort({
      createdAt: -1,
    });
    res.json(list);
  } catch (err) {
    next(err);
  }
};

// Student: apni class ka homework
exports.studentHomework = async (req, res, next) => {
  try {
    const student = await getStudentByUser(req.user._id);
    if (!student)
      return res.status(404).json({ message: "Student profile not found" });

    const list = await Homework.find({
      className: student.className,
      section: student.section,
    })
      .populate("createdBy", "name")
      .sort({ dueDate: -1, createdAt: -1 })
      .limit(100);

    res.json(list);
  } catch (err) {
    next(err);
  }
};

exports.deleteHomework = async (req, res, next) => {
  try {
    const hw = await Homework.findById(req.params.id);
    if (!hw) return res.status(404).json({ message: "Homework not found" });

    if (req.user.role === "teacher") {
      const teacher = await getTeacherByUser(req.user._id);
      if (!teacher || String(hw.createdBy) !== String(teacher._id)) {
        return res
          .status(403)
          .json({ message: "Aap sirf apna homework delete kar sakte hain" });
      }
    }

    await hw.deleteOne();
    res.json({ message: "Homework deleted" });
  } catch (err) {
    next(err);
  }
};
