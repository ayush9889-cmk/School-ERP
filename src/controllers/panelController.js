const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const Class = require("../models/Class");
const Attendance = require("../models/Attendance");
const Homework = require("../models/Homework");
const { todayStr } = require("../utils/access");

// Teacher dashboard ka data: classes, students, aaj ki attendance status, homework
exports.teacherOverview = async (req, res, next) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher)
      return res.status(404).json({ message: "Teacher profile not found" });

    const classDocs = await Class.find({
      "classTeachers.teacher": teacher._id,
    });

    const map = new Map();
    const get = (className, section) => {
      const key = `${className}|${section}`;
      if (!map.has(key)) {
        map.set(key, {
          className,
          section,
          subjects: [],
          isClassTeacher: false,
          students: 0,
          attendanceToday: null,
        });
      }
      return map.get(key);
    };

    teacher.classes.forEach((c) =>
      get(c.className, c.section).subjects.push(c.subject),
    );
    classDocs.forEach((c) =>
      c.classTeachers
        .filter((ct) => String(ct.teacher) === String(teacher._id))
        .forEach((ct) => {
          get(c.name, ct.section).isClassTeacher = true;
        }),
    );

    const classes = [...map.values()].sort(
      (a, b) =>
        a.className.localeCompare(b.className, undefined, { numeric: true }) ||
        a.section.localeCompare(b.section),
    );

    const today = todayStr();
    let totalStudents = 0;

    if (classes.length) {
      const match = {
        $or: classes.map(({ className, section }) => ({ className, section })),
      };

      const counts = await Student.aggregate([
        { $match: match },
        {
          $group: {
            _id: { className: "$className", section: "$section" },
            n: { $sum: 1 },
          },
        },
      ]);
      counts.forEach((c) => {
        const e = map.get(`${c._id.className}|${c._id.section}`);
        if (e) {
          e.students = c.n;
          totalStudents += c.n;
        }
      });

      const att = await Attendance.aggregate([
        { $match: { date: today, ...match } },
        {
          $group: {
            _id: { className: "$className", section: "$section" },
            total: { $sum: 1 },
            ok: {
              $sum: {
                $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0],
              },
            },
          },
        },
      ]);
      att.forEach((a) => {
        const e = map.get(`${a._id.className}|${a._id.section}`);
        if (e) e.attendanceToday = { total: a.total, present: a.ok };
      });
    }

    const [recentHomework, activeHomework] = await Promise.all([
      Homework.find({ createdBy: teacher._id })
        .sort({ createdAt: -1 })
        .limit(5),
      Homework.countDocuments({
        createdBy: teacher._id,
        dueDate: { $gte: today },
      }),
    ]);

    res.json({
      teacher: {
        id: teacher._id,
        name: teacher.name,
        subjects: teacher.subjects,
      },
      assignments: teacher.classes,
      classes,
      stats: {
        classes: classes.length,
        students: totalStudents,
        subjects: new Set(teacher.classes.map((c) => c.subject.toLowerCase()))
          .size,
        activeHomework,
      },
      recentHomework,
      today,
    });
  } catch (err) {
    next(err);
  }
};

// Student ki basic profile (class, section, roll no)
exports.studentMe = async (req, res, next) => {
  try {
    const s = await Student.findOne({ user: req.user._id });
    if (!s)
      return res.status(404).json({ message: "Student profile not found" });

    res.json({
      name: s.name,
      className: s.className,
      section: s.section,
      rollNo: s.rollNo ?? null,
      userId: req.user.userId,
    });
  } catch (err) {
    next(err);
  }
};
