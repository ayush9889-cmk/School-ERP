const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const Student = require("../models/Student");
const User = require("../models/User");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(str) {
  if (!DATE_RE.test(str)) return false;
  return !isNaN(new Date(`${str}T00:00:00Z`).getTime());
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function getTeacherByUser(userId) {
  return Teacher.findOne({ user: userId });
}

async function getStudentByUser(userId) {
  return Student.findOne({ user: userId });
}

// studentId ya to Mongo _id ho sakta hai ya STU... wala userId
async function resolveStudentId(raw) {
  const sid = String(raw || "").trim();
  if (/^[0-9a-fA-F]{24}$/.test(sid)) return sid;
  const u = await User.findOne({ userId: sid, role: "student" });
  const st = u ? await Student.findOne({ user: u._id }) : null;
  return st ? String(st._id) : null;
}

// Attendance ke liye: us class-section ka koi bhi assigned teacher ya class teacher
async function canMarkAttendance(teacher, className, section) {
  const sec = String(section).toUpperCase();
  const assigned = teacher.classes.some(
    (c) => c.className === className && c.section === sec,
  );
  if (assigned) return true;

  const cls = await Class.findOne({ name: className });
  if (!cls) return false;
  return cls.classTeachers.some(
    (ct) => ct.section === sec && String(ct.teacher) === String(teacher._id),
  );
}

// Homework/Marks ke liye: teacher us class-section mein wo subject padhata ho
function canGiveHomework(teacher, className, section, subject) {
  const sec = String(section).toUpperCase();
  return teacher.classes.some(
    (c) =>
      c.className === className &&
      c.section === sec &&
      c.subject.toLowerCase() === String(subject).toLowerCase(),
  );
}

module.exports = {
  isValidDate,
  todayStr,
  getTeacherByUser,
  getStudentByUser,
  resolveStudentId,
  canMarkAttendance,
  canGiveHomework,
};
