const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const User = require("../models/User");
const {
  isValidDate,
  todayStr,
  getTeacherByUser,
  getStudentByUser,
  canMarkAttendance,
} = require("../utils/access");

const STATUSES = ["present", "absent", "late", "leave"];

async function checkClassAccess(user, className, section) {
  if (user.role === "admin") return null;
  const teacher = await getTeacherByUser(user._id);
  if (!teacher) return "Teacher profile not found";
  const ok = await canMarkAttendance(teacher, className, section);
  return ok ? null : "You are not assigned to this class";
}

// Teacher/Admin: us din ki attendance sheet (students + existing status)
exports.getClassSheet = async (req, res, next) => {
  try {
    const { className, section } = req.query;
    const date = req.query.date || todayStr();

    if (!className || !section) {
      return res
        .status(400)
        .json({ message: "className and section required" });
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    }

    const err = await checkClassAccess(req.user, className, section);
    if (err) return res.status(403).json({ message: err });

    const sec = String(section).toUpperCase();
    const students = await Student.find({ className, section: sec })
      .populate("user", "userId")
      .select("name rollNo user")
      .sort({ rollNo: 1, name: 1 });

    const records = await Attendance.find({
      className,
      section: sec,
      date,
    });
    const map = new Map(records.map((r) => [String(r.student), r.status]));

    res.json({
      className,
      section: sec,
      date,
      alreadyMarked: records.length > 0,
      students: students.map((s) => ({
        studentId: s._id,
        userId: s.user?.userId,
        name: s.name,
        rollNo: s.rollNo,
        status: map.get(String(s._id)) || null,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// Teacher/Admin: poori class ki attendance ek saath save/update
exports.markAttendance = async (req, res, next) => {
  try {
    const { className, section, date, records } = req.body;

    if (
      !className ||
      !section ||
      !date ||
      !Array.isArray(records) ||
      !records.length
    ) {
      return res.status(400).json({
        message: "className, section, date and records[] are required",
      });
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    }
    if (date > todayStr()) {
      return res
        .status(400)
        .json({ message: "Future date ki attendance nahi lag sakti" });
    }

    const err = await checkClassAccess(req.user, className, section);
    if (err) return res.status(403).json({ message: err });

    const sec = String(section).toUpperCase();

    for (const r of records) {
      if (!STATUSES.includes(r.status)) {
        return res.status(400).json({ message: `Invalid status: ${r.status}` });
      }
    }

    // studentId ya to Mongo _id ho sakta hai ya STU... wala userId
    const resolved = [];
    for (const r of records) {
      let sid = String(r.studentId || "").trim();
      if (!/^[0-9a-fA-F]{24}$/.test(sid)) {
        const u = await User.findOne({ userId: sid, role: "student" });
        const st = u ? await Student.findOne({ user: u._id }) : null;
        if (!st) {
          return res
            .status(400)
            .json({ message: `Student not found: ${r.studentId}` });
        }
        sid = String(st._id);
      }
      resolved.push({ studentId: sid, status: r.status });
    }

    // sirf isi class ke students allowed
    const ids = resolved.map((r) => r.studentId);
    const valid = await Student.find({
      _id: { $in: ids },
      className,
      section: sec,
    }).select("_id");
    const validSet = new Set(valid.map((s) => String(s._id)));
    const invalid = ids.filter((id) => !validSet.has(id));
    if (invalid.length) {
      return res.status(400).json({
        message: "Some students do not belong to this class",
        invalid,
      });
    }

    const ops = resolved.map((r) => ({
      updateOne: {
        filter: { student: r.studentId, date },
        update: {
          $set: {
            className,
            section: sec,
            status: r.status,
            markedBy: req.user._id,
          },
        },
        upsert: true,
      },
    }));

    await Attendance.bulkWrite(ops);
    res.json({ message: "Attendance saved", date, count: resolved.length });
  } catch (err) {
    next(err);
  }
};

// Student: apni attendance (month = YYYY-MM, optional)
exports.myAttendance = async (req, res, next) => {
  try {
    const student = await getStudentByUser(req.user._id);
    if (!student)
      return res.status(404).json({ message: "Student profile not found" });

    const filter = { student: student._id };
    const { month } = req.query;
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "month must be YYYY-MM" });
      }
      filter.date = { $gte: `${month}-01`, $lte: `${month}-31` };
    }

    const records = await Attendance.find(filter)
      .select("date status")
      .sort({ date: -1 });

    const summary = { present: 0, absent: 0, late: 0, leave: 0 };
    records.forEach((r) => summary[r.status]++);
    const total = records.length;
    // late ko present maana hai
    const percentage = total
      ? Math.round(((summary.present + summary.late) / total) * 100)
      : 0;

    res.json({ month: month || "all", total, summary, percentage, records });
  } catch (err) {
    next(err);
  }
};

// Admin: kisi bhi student ki attendance
exports.studentAttendance = async (req, res, next) => {
  try {
    const records = await Attendance.find({ student: req.params.studentId })
      .select("date status")
      .sort({ date: -1 });
    res.json(records);
  } catch (err) {
    next(err);
  }
};

// Admin: pichhle 6 din ka attendance percentage (dashboard chart)
exports.adminSummary = async (req, res, next) => {
  try {
    const dates = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const rows = await Attendance.aggregate([
      { $match: { date: { $in: dates } } },
      {
        $group: {
          _id: "$date",
          total: { $sum: 1 },
          ok: {
            $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] },
          },
        },
      },
    ]);
    const map = new Map(rows.map((r) => [r._id, r]));

    const days = dates.map((date) => {
      const r = map.get(date);
      return {
        date,
        label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
          weekday: "short",
          timeZone: "UTC",
        }),
        total: r ? r.total : 0,
        percentage: r ? Math.round((r.ok / r.total) * 100) : null,
      };
    });

    res.json({ days, today: days[days.length - 1] });
  } catch (err) {
    next(err);
  }
};
