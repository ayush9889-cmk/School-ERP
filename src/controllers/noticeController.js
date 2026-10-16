const Notice = require("../models/Notice");
const Class = require("../models/Class");
const { getStudentByUser } = require("../utils/access");

exports.createNotice = async (req, res, next) => {
  try {
    const { title, body, audience, className, section, pinned } = req.body;

    if (!title || !body) {
      return res.status(400).json({ message: "title and body are required" });
    }
    if (audience && !["all", "students", "teachers"].includes(audience)) {
      return res
        .status(400)
        .json({ message: "audience must be all, students or teachers" });
    }

    let sec = null;
    if (className) {
      const cls = await Class.findOne({ name: className });
      if (!cls)
        return res
          .status(400)
          .json({ message: `Class ${className} does not exist` });
      if (section) {
        sec = String(section).trim().toUpperCase();
        if (!cls.sections.includes(sec)) {
          return res.status(400).json({
            message: `Section ${sec} does not exist in class ${className}`,
          });
        }
      }
    }

    const notice = await Notice.create({
      title,
      body,
      audience: audience || "all",
      className: className || null,
      section: sec,
      pinned: !!pinned,
      createdBy: req.user._id,
    });

    res.status(201).json(notice);
  } catch (err) {
    next(err);
  }
};

// admin: sab, teacher: all + teachers, student: apni class ke hisaab se
exports.listNotices = async (req, res, next) => {
  try {
    let filter = {};

    if (req.user.role === "teacher") {
      filter = { audience: { $in: ["all", "teachers"] } };
    }

    if (req.user.role === "student") {
      const student = await getStudentByUser(req.user._id);
      if (!student)
        return res.status(404).json({ message: "Student profile not found" });

      filter = {
        audience: { $in: ["all", "students"] },
        $or: [
          { className: null },
          {
            className: student.className,
            section: { $in: [null, student.section] },
          },
        ],
      };
    }

    const notices = await Notice.find(filter)
      .populate("createdBy", "name")
      .sort({ pinned: -1, createdAt: -1 })
      .limit(50);

    res.json(notices);
  } catch (err) {
    next(err);
  }
};

exports.deleteNotice = async (req, res, next) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });
    res.json({ message: "Notice deleted" });
  } catch (err) {
    next(err);
  }
};
