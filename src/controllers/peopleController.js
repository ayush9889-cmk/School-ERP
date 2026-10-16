const mongoose = require("mongoose");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const User = require("../models/User");
const Class = require("../models/Class");
const Attendance = require("../models/Attendance");
const Exam = require("../models/Exam");
const Mark = require("../models/Mark");
const { buildResult } = require("../utils/result");

const OK = ["present", "late"];

function summarize(records) {
  const s = { present: 0, late: 0, absent: 0, leave: 0 };
  records.forEach((r) => {
    if (s[r.status] !== undefined) s[r.status]++;
  });
  const total = records.length;
  return {
    ...s,
    total,
    percentage: total ? Math.round(((s.present + s.late) / total) * 100) : null,
  };
}

/* ---------------- Students ---------------- */

// Saare students + overall attendance %
exports.listStudents = async (req, res, next) => {
  try {
    const students = await Student.find()
      .populate("user", "userId isActive")
      .sort({ createdAt: -1 })
      .lean();

    const agg = await Attendance.aggregate([
      {
        $group: {
          _id: "$student",
          total: { $sum: 1 },
          ok: { $sum: { $cond: [{ $in: ["$status", OK] }, 1, 0] } },
        },
      },
    ]);
    const map = new Map(agg.map((a) => [String(a._id), a]));

    res.json(
      students.map((s) => {
        const a = map.get(String(s._id));
        return {
          ...s,
          attendance: {
            total: a ? a.total : 0,
            percentage: a ? Math.round((a.ok / a.total) * 100) : null,
          },
        };
      }),
    );
  } catch (err) {
    next(err);
  }
};

exports.studentDetails = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Student not found" });
    }
    const student = await Student.findById(req.params.id).populate(
      "user",
      "userId isActive",
    );
    if (!student) return res.status(404).json({ message: "Student not found" });

    const month = new Date().toISOString().slice(0, 7);
    const records = await Attendance.find({ student: student._id })
      .select("date status")
      .sort({ date: -1 });

    const exams = await Exam.find({ className: student.className })
      .sort({ createdAt: -1 })
      .limit(5);
    const marks = await Mark.find({
      student: student._id,
      exam: { $in: exams.map((e) => e._id) },
    });
    const results = exams.map((e) => ({
      ...buildResult(
        e,
        marks.filter((m) => String(m.exam) === String(e._id)),
      ),
      published: e.published,
    }));

    res.json({
      student,
      attendance: {
        month,
        thisMonth: summarize(records.filter((r) => r.date.startsWith(month))),
        overall: summarize(records),
      },
      recentAttendance: records.slice(0, 15),
      results,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateStudent = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Student not found" });
    }
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const b = req.body;

    if (b.name !== undefined) {
      const n = String(b.name).trim();
      if (!n) return res.status(400).json({ message: "Name cannot be empty" });
      student.name = n;
    }

    const className =
      b.className !== undefined
        ? String(b.className).trim()
        : student.className;
    const section =
      b.section !== undefined
        ? String(b.section).trim().toUpperCase()
        : student.section;
    if (className !== student.className || section !== student.section) {
      const cls = await Class.findOne({ name: className });
      if (!cls || !cls.sections.includes(section)) {
        return res
          .status(400)
          .json({ message: `Class ${className}-${section} does not exist` });
      }
    }
    student.className = className;
    student.section = section;

    if (b.rollNo !== undefined) {
      if (b.rollNo === "" || b.rollNo === null) {
        student.rollNo = undefined;
      } else {
        const r = Number(b.rollNo);
        if (!Number.isFinite(r) || r < 1) {
          return res
            .status(400)
            .json({ message: "Roll number must be a positive number" });
        }
        student.rollNo = r;
      }
    }

    if (b.dob !== undefined) student.dob = b.dob || undefined;

    if (b.gender !== undefined) {
      if (b.gender && !["male", "female", "other"].includes(b.gender)) {
        return res.status(400).json({ message: "Invalid gender" });
      }
      student.gender = b.gender || undefined;
    }

    if (b.parentName !== undefined) {
      const p = String(b.parentName).trim();
      if (!p)
        return res
          .status(400)
          .json({ message: "Guardian name cannot be empty" });
      student.parentName = p;
    }

    if (b.parentWhatsApp !== undefined) {
      const d = String(b.parentWhatsApp).replace(/\D/g, "");
      if (d.length < 10 || d.length > 13) {
        return res
          .status(400)
          .json({ message: "Enter a valid WhatsApp number" });
      }
      student.parentWhatsApp = d;
    }

    if (b.address !== undefined)
      student.address = String(b.address).trim() || undefined;

    await student.save();
    if (b.name !== undefined)
      await User.findByIdAndUpdate(student.user, { name: student.name });

    res.json(student);
  } catch (err) {
    next(err);
  }
};

/* ---------------- Teachers ---------------- */

exports.teacherDetails = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    const teacher = await Teacher.findById(req.params.id).populate(
      "user",
      "userId isActive",
    );
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    const keys = [
      ...new Set(teacher.classes.map((c) => `${c.className}|${c.section}`)),
    ];
    const students = keys.length
      ? await Student.countDocuments({
          $or: keys.map((k) => {
            const [className, section] = k.split("|");
            return { className, section };
          }),
        })
      : 0;

    const classDocs = await Class.find({
      "classTeachers.teacher": teacher._id,
    });
    const classTeacherOf = classDocs.flatMap((c) =>
      c.classTeachers
        .filter((ct) => String(ct.teacher) === String(teacher._id))
        .map((ct) => ({ className: c.name, section: ct.section })),
    );

    res.json({
      teacher,
      stats: {
        classes: keys.length,
        subjects: teacher.subjects.length,
        students,
      },
      classTeacherOf,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateTeacher = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    const b = req.body;

    if (b.name !== undefined) {
      const n = String(b.name).trim();
      if (!n) return res.status(400).json({ message: "Name cannot be empty" });
      teacher.name = n;
    }

    if (b.phone !== undefined) {
      const d = String(b.phone).replace(/\D/g, "");
      if (d.length < 10 || d.length > 13) {
        return res
          .status(400)
          .json({ message: "Enter a valid WhatsApp number" });
      }
      teacher.phone = d;
    }

    if (b.qualification !== undefined) {
      teacher.qualification = String(b.qualification).trim() || undefined;
    }

    if (b.subjects !== undefined) {
      const list = Array.isArray(b.subjects)
        ? b.subjects
        : String(b.subjects).split(",");
      teacher.subjects = list.map((s) => String(s).trim()).filter(Boolean);
    }

    await teacher.save();
    if (b.name !== undefined)
      await User.findByIdAndUpdate(teacher.user, { name: teacher.name });

    res.json(teacher);
  } catch (err) {
    next(err);
  }
};
