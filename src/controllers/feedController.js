const Notice = require("../models/Notice");
const { getStudentByUser } = require("../utils/access");

// teacher: all + teachers, student: apni class ke hisaab se
exports.myNotices = async (req, res, next) => {
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
