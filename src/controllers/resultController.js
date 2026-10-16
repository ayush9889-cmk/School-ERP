const Exam = require("../models/Exam");
const Mark = require("../models/Mark");
const Student = require("../models/Student");
const {
  getTeacherByUser,
  getStudentByUser,
  resolveStudentId,
  canMarkAttendance,
  canGiveHomework,
} = require("../utils/access");
const { buildResult } = require("../utils/result");

// Marks bharne/dekhne ka access: admin sab, teacher sirf apna subject
async function checkSubjectAccess(user, exam, section, subjectName) {
  if (user.role === "admin") return null;
  const teacher = await getTeacherByUser(user._id);
  if (!teacher) return "Teacher profile not found";
  const ok = canGiveHomework(teacher, exam.className, section, subjectName);
  return ok ? null : "Aap is class mein ye subject nahi padhate";
}

// Teacher/Admin: ek subject ki marks sheet
exports.getMarksSheet = async (req, res, next) => {
  try {
    const { examId, section, subject } = req.query;
    if (!examId || !section || !subject) {
      return res
        .status(400)
        .json({ message: "examId, section and subject are required" });
    }

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const subj = exam.subjects.find(
      (s) => s.name.toLowerCase() === String(subject).toLowerCase(),
    );
    if (!subj)
      return res
        .status(400)
        .json({ message: "Subject is not part of this exam" });

    const sec = String(section).toUpperCase();
    const err = await checkSubjectAccess(req.user, exam, sec, subj.name);
    if (err) return res.status(403).json({ message: err });

    const students = await Student.find({
      className: exam.className,
      section: sec,
    })
      .populate("user", "userId")
      .select("name rollNo user")
      .sort({ rollNo: 1, name: 1 });

    const marks = await Mark.find({ exam: exam._id, subject: subj.name });
    const map = new Map(marks.map((m) => [String(m.student), m]));

    res.json({
      exam: exam.name,
      className: exam.className,
      section: sec,
      subject: subj.name,
      maxMarks: subj.maxMarks,
      published: exam.published,
      students: students.map((s) => {
        const m = map.get(String(s._id));
        return {
          studentId: s._id,
          userId: s.user?.userId,
          name: s.name,
          rollNo: s.rollNo,
          obtained: m ? m.obtained : null,
          absent: m ? m.absent : false,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
};

// Teacher/Admin: ek subject ke marks save/update
exports.saveMarks = async (req, res, next) => {
  try {
    const { examId, section, subject, records } = req.body;

    if (
      !examId ||
      !section ||
      !subject ||
      !Array.isArray(records) ||
      !records.length
    ) {
      return res.status(400).json({
        message: "examId, section, subject and records[] are required",
      });
    }

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const subj = exam.subjects.find(
      (s) => s.name.toLowerCase() === String(subject).toLowerCase(),
    );
    if (!subj)
      return res
        .status(400)
        .json({ message: "Subject is not part of this exam" });

    const sec = String(section).toUpperCase();
    const err = await checkSubjectAccess(req.user, exam, sec, subj.name);
    if (err) return res.status(403).json({ message: err });

    // publish ke baad teacher marks nahi badal sakta
    if (exam.published && req.user.role === "teacher") {
      return res.status(403).json({
        message:
          "Result publish ho chuka hai, change ke liye admin se sampark karein",
      });
    }

    const resolved = [];
    for (const r of records) {
      const sid = await resolveStudentId(r.studentId);
      if (!sid)
        return res
          .status(400)
          .json({ message: `Student not found: ${r.studentId}` });

      const absent = r.absent === true;
      let obtained = null;

      if (!absent) {
        obtained = Number(r.obtained);
        if (
          r.obtained === undefined ||
          r.obtained === null ||
          r.obtained === "" ||
          isNaN(obtained)
        ) {
          return res
            .status(400)
            .json({ message: `Marks required for ${r.studentId}` });
        }
        if (obtained < 0 || obtained > subj.maxMarks) {
          return res.status(400).json({
            message: `Marks for ${r.studentId} must be between 0 and ${subj.maxMarks}`,
          });
        }
      }

      resolved.push({ studentId: sid, obtained, absent });
    }

    // sirf isi class-section ke students allowed
    const ids = resolved.map((r) => r.studentId);
    const valid = await Student.find({
      _id: { $in: ids },
      className: exam.className,
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
        filter: { exam: exam._id, student: r.studentId, subject: subj.name },
        update: {
          $set: {
            obtained: r.obtained,
            absent: r.absent,
            maxMarks: subj.maxMarks,
            enteredBy: req.user._id,
          },
        },
        upsert: true,
      },
    }));

    await Mark.bulkWrite(ops);
    res.json({
      message: "Marks saved",
      subject: subj.name,
      count: resolved.length,
    });
  } catch (err) {
    next(err);
  }
};

// Student: apne saare published results
exports.myResults = async (req, res, next) => {
  try {
    const student = await getStudentByUser(req.user._id);
    if (!student)
      return res.status(404).json({ message: "Student profile not found" });

    const exams = await Exam.find({
      className: student.className,
      published: true,
    }).sort({
      createdAt: -1,
    });
    const marks = await Mark.find({
      student: student._id,
      exam: { $in: exams.map((e) => e._id) },
    });

    const results = exams.map((exam) =>
      buildResult(
        exam,
        marks.filter((m) => String(m.exam) === String(exam._id)),
      ),
    );

    res.json(results);
  } catch (err) {
    next(err);
  }
};

// Admin/Teacher: poori class ka result + rank
exports.classResult = async (req, res, next) => {
  try {
    const { examId, section } = req.query;
    if (!examId || !section) {
      return res
        .status(400)
        .json({ message: "examId and section are required" });
    }

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const sec = String(section).toUpperCase();

    if (req.user.role === "teacher") {
      const teacher = await getTeacherByUser(req.user._id);
      const ok =
        teacher && (await canMarkAttendance(teacher, exam.className, sec));
      if (!ok)
        return res
          .status(403)
          .json({ message: "You are not assigned to this class" });
    }

    const students = await Student.find({
      className: exam.className,
      section: sec,
    })
      .select("name rollNo")
      .sort({ rollNo: 1, name: 1 });
    const marks = await Mark.find({ exam: exam._id });

    const rows = students.map((s) => {
      const r = buildResult(
        exam,
        marks.filter((m) => String(m.student) === String(s._id)),
      );
      return {
        studentId: s._id,
        name: s.name,
        rollNo: s.rollNo,
        totalObtained: r.totalObtained,
        totalMax: r.totalMax,
        percentage: r.percentage,
        grade: r.grade,
        status: r.status,
        complete: r.complete,
      };
    });

    // rank sirf un students ko jinka result complete hai
    const ranked = rows
      .filter((r) => r.complete)
      .sort((a, b) => b.percentage - a.percentage);
    ranked.forEach((r, i) => {
      r.rank =
        i > 0 && r.percentage === ranked[i - 1].percentage
          ? ranked[i - 1].rank
          : i + 1;
    });

    res.json({
      exam: exam.name,
      className: exam.className,
      section: sec,
      published: exam.published,
      students: rows,
    });
  } catch (err) {
    next(err);
  }
};
