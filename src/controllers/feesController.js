const mongoose = require("mongoose");
const Student = require("../models/Student");
const Class = require("../models/Class");
const FeeCharge = require("../models/FeeCharge");
const FeePayment = require("../models/FeePayment");
const Counter = require("../models/Counter");
const { isValidDate, todayStr, getStudentByUser } = require("../utils/access");

const MODES = ["cash", "upi", "bank", "cheque", "concession"];
const isId = (id) => mongoose.isValidObjectId(id);
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

// payments ko purane charges se bharte hue har charge ka status nikalta hai
function summarize(charges, payments, today) {
  const valid = payments.filter((p) => !p.voided);
  const paid = sum(valid, (p) => p.amount);
  const concession = sum(
    valid.filter((p) => p.mode === "concession"),
    (p) => p.amount,
  );

  const sorted = [...charges].sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      new Date(a.createdAt) - new Date(b.createdAt),
  );

  let left = paid;
  const list = sorted.map((c) => {
    const p = Math.min(c.amount, left);
    left -= p;
    const due = c.amount - p;
    const status =
      due === 0
        ? "paid"
        : c.dueDate < today
          ? "overdue"
          : p > 0
            ? "partial"
            : "due";
    return {
      _id: c._id,
      title: c.title,
      amount: c.amount,
      dueDate: c.dueDate,
      paid: p,
      due,
      status,
    };
  });

  const total = sum(charges, (c) => c.amount);
  const due = Math.max(total - paid, 0);
  const overdue = sum(
    list.filter((c) => c.status === "overdue"),
    (c) => c.due,
  );

  return {
    total,
    paid,
    collected: paid - concession,
    concession,
    due,
    advance: Math.max(paid - total, 0),
    overdue,
    status:
      total === 0
        ? "none"
        : due === 0
          ? "paid"
          : overdue > 0
            ? "overdue"
            : "due",
    charges: list,
  };
}

async function buildLedger(student) {
  const [charges, payments] = await Promise.all([
    FeeCharge.find({ student: student._id }).lean(),
    FeePayment.find({ student: student._id }).sort({ createdAt: -1 }).lean(),
  ]);
  return { summary: summarize(charges, payments, todayStr()), payments };
}

const studentInfo = (s, userId) => ({
  _id: s._id,
  name: s.name,
  className: s.className,
  section: s.section,
  rollNo: s.rollNo ?? null,
  parentName: s.parentName,
  userId,
});

const group = (list) => {
  const m = new Map();
  list.forEach((x) => {
    const k = String(x.student);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  });
  return m;
};

/* ---------------- Admin ---------------- */

// Class (ya section) ke sab students par ek fee lagao
exports.assignFee = async (req, res, next) => {
  try {
    const { className, section, title, amount, dueDate } = req.body;

    const t = String(title || "").trim();
    const amt = Number(amount);
    if (!className || !t)
      return res.status(400).json({ message: "Class and title are required" });
    if (!Number.isInteger(amt) || amt < 1) {
      return res
        .status(400)
        .json({ message: "Enter a whole amount greater than 0" });
    }
    if (!dueDate || !isValidDate(dueDate)) {
      return res.status(400).json({ message: "Enter a valid due date" });
    }

    const cls = await Class.findOne({ name: String(className).trim() });
    if (!cls)
      return res
        .status(400)
        .json({ message: `Class ${className} does not exist` });

    const filter = { className: cls.name };
    if (section) {
      const sec = String(section).trim().toUpperCase();
      if (!cls.sections.includes(sec)) {
        return res
          .status(400)
          .json({ message: `Section ${sec} does not exist in this class` });
      }
      filter.section = sec;
    }

    const students = await Student.find(filter).select("className section");
    if (students.length === 0) {
      return res
        .status(400)
        .json({ message: "There are no students in this class yet" });
    }

    const result = await FeeCharge.bulkWrite(
      students.map((s) => ({
        updateOne: {
          filter: { student: s._id, title: t, dueDate },
          update: {
            $setOnInsert: {
              className: s.className,
              section: s.section,
              amount: amt,
              createdBy: req.user._id,
            },
          },
          upsert: true,
        },
      })),
    );

    const created = result.upsertedCount || 0;
    res.status(201).json({
      students: students.length,
      created,
      skipped: students.length - created,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteCharge = async (req, res, next) => {
  try {
    if (!isId(req.params.id))
      return res.status(404).json({ message: "Fee not found" });
    const c = await FeeCharge.findByIdAndDelete(req.params.id);
    if (!c) return res.status(404).json({ message: "Fee not found" });
    res.json({ message: "Fee removed" });
  } catch (err) {
    next(err);
  }
};

// Dashboard + Fees page ke upar ki summary
exports.feeOverview = async (req, res, next) => {
  try {
    const [students, charges, payments] = await Promise.all([
      Student.find().select("name className section").lean(),
      FeeCharge.find().lean(),
      FeePayment.find().sort({ createdAt: -1 }).lean(),
    ]);

    const byCharge = group(charges);
    const byPay = group(payments);
    const today = todayStr();

    let billed = 0;
    let collected = 0;
    let concession = 0;
    let pending = 0;
    let overdueAmount = 0;
    let overdueStudents = 0;

    students.forEach((s) => {
      const c = byCharge.get(String(s._id)) || [];
      if (c.length === 0) return;
      const sm = summarize(c, byPay.get(String(s._id)) || [], today);
      billed += sm.total;
      collected += sm.collected;
      concession += sm.concession;
      pending += sm.due;
      overdueAmount += sm.overdue;
      if (sm.overdue > 0) overdueStudents++;
    });

    const nameOf = new Map(students.map((s) => [String(s._id), s]));
    const recent = payments
      .filter((p) => !p.voided)
      .slice(0, 8)
      .map((p) => {
        const s = nameOf.get(String(p.student));
        return {
          _id: p._id,
          receiptNo: p.receiptNo,
          amount: p.amount,
          mode: p.mode,
          date: p.date,
          studentName: s?.name || "Unknown",
          className: s?.className,
          section: s?.section,
        };
      });

    res.json({
      billed,
      collected,
      concession,
      pending,
      overdueAmount,
      overdueStudents,
      collectionPct: billed
        ? Math.min(100, Math.round(((collected + concession) / billed) * 100))
        : null,
      recent,
    });
  } catch (err) {
    next(err);
  }
};

// Fees page ki table: har student ka due status
exports.listFeeStudents = async (req, res, next) => {
  try {
    const students = await Student.find()
      .populate("user", "userId")
      .sort({ className: 1, section: 1, rollNo: 1, name: 1 })
      .lean();

    const ids = students.map((s) => s._id);
    const [charges, payments] = await Promise.all([
      FeeCharge.find({ student: { $in: ids } }).lean(),
      FeePayment.find({ student: { $in: ids } }).lean(),
    ]);
    const byCharge = group(charges);
    const byPay = group(payments);
    const today = todayStr();

    res.json(
      students.map((s) => {
        const sm = summarize(
          byCharge.get(String(s._id)) || [],
          byPay.get(String(s._id)) || [],
          today,
        );
        return {
          ...studentInfo(s, s.user?.userId),
          total: sm.total,
          paid: sm.paid,
          due: sm.due,
          overdue: sm.overdue,
          status: sm.status,
        };
      }),
    );
  } catch (err) {
    next(err);
  }
};

exports.studentLedger = async (req, res, next) => {
  try {
    if (!isId(req.params.id))
      return res.status(404).json({ message: "Student not found" });
    const s = await Student.findById(req.params.id).populate("user", "userId");
    if (!s) return res.status(404).json({ message: "Student not found" });

    const { summary, payments } = await buildLedger(s);
    res.json({ student: studentInfo(s, s.user?.userId), summary, payments });
  } catch (err) {
    next(err);
  }
};

exports.recordPayment = async (req, res, next) => {
  try {
    if (!isId(req.params.id))
      return res.status(404).json({ message: "Student not found" });
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount < 1) {
      return res
        .status(400)
        .json({ message: "Enter a whole amount greater than 0" });
    }

    const mode = req.body.mode || "cash";
    if (!MODES.includes(mode))
      return res.status(400).json({ message: "Invalid payment mode" });

    const date = req.body.date || todayStr();
    if (!isValidDate(date))
      return res.status(400).json({ message: "Enter a valid date" });
    if (date > todayStr()) {
      return res
        .status(400)
        .json({ message: "Payment date cannot be in the future" });
    }

    const { summary } = await buildLedger(student);
    if (summary.total === 0) {
      return res
        .status(400)
        .json({ message: "No fees are assigned to this student yet" });
    }
    if (amount > summary.due) {
      return res.status(400).json({
        message: `Amount exceeds the pending balance of ₹${summary.due}`,
      });
    }

    const year = date.slice(0, 4);
    const counter = await Counter.findOneAndUpdate(
      { _id: `receipt-${year}` },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );
    const receiptNo = `RCT-${year}-${String(counter.seq).padStart(4, "0")}`;

    const payment = await FeePayment.create({
      student: student._id,
      amount,
      date,
      mode,
      reference: String(req.body.reference || "").trim(),
      note: String(req.body.note || "").trim(),
      receiptNo,
      receivedBy: req.user._id,
    });

    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
};

exports.voidPayment = async (req, res, next) => {
  try {
    if (!isId(req.params.id))
      return res.status(404).json({ message: "Payment not found" });
    const reason = String(req.body.reason || "").trim();
    if (!reason)
      return res.status(400).json({ message: "Enter a reason for voiding" });

    const p = await FeePayment.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Payment not found" });
    if (p.voided)
      return res.status(400).json({ message: "This payment is already void" });

    p.voided = true;
    p.voidReason = reason;
    await p.save();
    res.json(p);
  } catch (err) {
    next(err);
  }
};

/* ---------------- Student ---------------- */

exports.myFees = async (req, res, next) => {
  try {
    const s = await getStudentByUser(req.user._id);
    if (!s)
      return res.status(404).json({ message: "Student profile not found" });

    const { summary, payments } = await buildLedger(s);
    res.json({
      student: studentInfo(s, req.user.userId),
      summary,
      payments: payments.filter((p) => !p.voided),
    });
  } catch (err) {
    next(err);
  }
};
