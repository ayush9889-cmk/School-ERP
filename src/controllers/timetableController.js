const mongoose = require("mongoose");
const Timetable = require("../models/Timetable");
const Class = require("../models/Class");
const Teacher = require("../models/Teacher");
const { getTeacherByUser, getStudentByUser } = require("../utils/access");

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const overlap = (a, b) =>
  toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
const sortSlots = (a, b) =>
  DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMin(a.start) - toMin(b.start);

// Admin: ek class-section ka timetable
exports.getClassTimetable = async (req, res, next) => {
  try {
    const { className, section } = req.query;
    if (!className || !section) {
      return res
        .status(400)
        .json({ message: "className and section are required" });
    }
    const sec = String(section).toUpperCase();
    const tt = await Timetable.findOne({ className, section: sec }).populate(
      "slots.teacher",
      "name",
    );
    res.json({
      className,
      section: sec,
      slots: tt ? [...tt.slots].sort(sortSlots) : [],
    });
  } catch (err) {
    next(err);
  }
};

// Admin: poora timetable save (replace)
exports.saveClassTimetable = async (req, res, next) => {
  try {
    const { className, section, slots } = req.body;
    if (!className || !section || !Array.isArray(slots)) {
      return res
        .status(400)
        .json({ message: "className, section and slots[] are required" });
    }

    const sec = String(section).trim().toUpperCase();
    const cls = await Class.findOne({ name: String(className).trim() });
    if (!cls || !cls.sections.includes(sec)) {
      return res
        .status(400)
        .json({ message: `Class ${className}-${sec} does not exist` });
    }

    const clean = [];
    for (const s of slots) {
      const subject = String(s.subject || "").trim();
      if (!DAYS.includes(s.day))
        return res.status(400).json({ message: "Invalid day" });
      if (!TIME.test(s.start || "") || !TIME.test(s.end || "")) {
        return res
          .status(400)
          .json({ message: `${s.day}: enter valid start and end times` });
      }
      if (toMin(s.end) <= toMin(s.start)) {
        return res
          .status(400)
          .json({ message: `${s.day}: end time must be after start time` });
      }
      if (!subject)
        return res
          .status(400)
          .json({ message: `${s.day}: subject is required` });

      let teacher = null;
      if (s.teacher) {
        if (!mongoose.isValidObjectId(s.teacher)) {
          return res.status(400).json({ message: "Invalid teacher" });
        }
        teacher = s.teacher;
      }
      clean.push({ day: s.day, start: s.start, end: s.end, subject, teacher });
    }

    // isi class mein periods overlap na karein
    for (let i = 0; i < clean.length; i++) {
      for (let j = i + 1; j < clean.length; j++) {
        if (clean[i].day === clean[j].day && overlap(clean[i], clean[j])) {
          return res.status(400).json({
            message: `${clean[i].day}: periods ${clean[i].start}-${clean[i].end} and ${clean[j].start}-${clean[j].end} overlap`,
          });
        }
      }
    }

    // ek teacher ek time par do jagah na ho
    const teacherIds = [
      ...new Set(clean.filter((s) => s.teacher).map((s) => String(s.teacher))),
    ];
    if (teacherIds.length) {
      const teachers = await Teacher.find({ _id: { $in: teacherIds } }).select(
        "name",
      );
      if (teachers.length !== teacherIds.length) {
        return res.status(400).json({ message: "Teacher not found" });
      }
      const nameOf = new Map(teachers.map((t) => [String(t._id), t.name]));

      const others = await Timetable.find({
        "slots.teacher": { $in: teacherIds },
        $nor: [{ className: cls.name, section: sec }],
      });

      for (const o of others) {
        for (const os of o.slots) {
          if (!os.teacher) continue;
          for (const s of clean) {
            if (String(s.teacher) !== String(os.teacher) || s.day !== os.day)
              continue;
            if (overlap(s, os)) {
              return res.status(400).json({
                message: `${nameOf.get(String(s.teacher))} is already teaching Class ${o.className}-${o.section} on ${s.day} at ${os.start}-${os.end}.`,
              });
            }
          }
        }
      }
    }

    clean.sort(sortSlots);
    await Timetable.findOneAndUpdate(
      { className: cls.name, section: sec },
      { className: cls.name, section: sec, slots: clean },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({ message: "Timetable saved", count: clean.length });
  } catch (err) {
    next(err);
  }
};

// Teacher: apne saare periods (sab classes ke)
exports.teacherTimetable = async (req, res, next) => {
  try {
    const teacher = await getTeacherByUser(req.user._id);
    if (!teacher)
      return res.status(404).json({ message: "Teacher profile not found" });

    const docs = await Timetable.find({ "slots.teacher": teacher._id });
    const slots = docs
      .flatMap((d) =>
        d.slots
          .filter((s) => String(s.teacher) === String(teacher._id))
          .map((s) => ({
            day: s.day,
            start: s.start,
            end: s.end,
            subject: s.subject,
            className: d.className,
            section: d.section,
          })),
      )
      .sort(sortSlots);

    res.json({ slots });
  } catch (err) {
    next(err);
  }
};

// Student: apni class ka timetable
exports.studentTimetable = async (req, res, next) => {
  try {
    const student = await getStudentByUser(req.user._id);
    if (!student)
      return res.status(404).json({ message: "Student profile not found" });

    const tt = await Timetable.findOne({
      className: student.className,
      section: student.section,
    }).populate("slots.teacher", "name");

    res.json({
      className: student.className,
      section: student.section,
      slots: tt ? [...tt.slots].sort(sortSlots) : [],
    });
  } catch (err) {
    next(err);
  }
};
