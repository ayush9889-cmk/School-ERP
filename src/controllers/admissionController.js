const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Student = require("../models/Student");
const { generatePassword, generateUserId } = require("../services/credentials");
const { sendCredentials } = require("../services/whatsapp");
const Class = require("../models/Class");

exports.admitStudent = async (req, res, next) => {
  let user;
  try {
    const {
      name,
      className,
      section,
      rollNo,
      dob,
      gender,
      parentName,
      parentWhatsApp,
      address,
    } = req.body;

    if (!name || !className || !section || !parentName || !parentWhatsApp) {
      return res.status(400).json({
        message:
          "name, className, section, parentName, parentWhatsApp are required",
      });
    }
    const cls = await Class.findOne({ name: String(className).trim() });
    if (!cls || !cls.sections.includes(String(section).trim().toUpperCase())) {
      return res
        .status(400)
        .json({ message: `Class ${className}-${section} does not exist` });
    }

    const userId = await generateUserId("STU");
    const password = generatePassword();

    user = await User.create({
      userId,
      passwordHash: await bcrypt.hash(password, 10),
      role: "student",
      name,
      mustChangePassword: true,
    });

    const student = await Student.create({
      user: user._id,
      name,
      className,
      section,
      rollNo,
      dob,
      gender,
      parentName,
      parentWhatsApp,
      address,
    });

    const whatsapp = await sendCredentials({
      phone: parentWhatsApp,
      studentName: name,
      userId,
      password,
    });

    // Password sirf isi response mein ek baar dikhega, DB mein sirf hash hai
    res.status(201).json({
      message: "Admission successful",
      student,
      credentials: { userId, password },
      whatsapp,
    });
  } catch (err) {
    if (user) await User.findByIdAndDelete(user._id); // rollback
    next(err);
  }
};

exports.resendCredentials = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id).populate("user");
    if (!student) return res.status(404).json({ message: "Student not found" });

    const password = generatePassword();
    student.user.passwordHash = await bcrypt.hash(password, 10);
    student.user.mustChangePassword = true;
    await student.user.save();

    const whatsapp = await sendCredentials({
      phone: student.parentWhatsApp,
      studentName: student.name,
      userId: student.user.userId,
      password,
    });

    res.json({
      message: "New password generated",
      credentials: { userId: student.user.userId, password },
      whatsapp,
    });
  } catch (err) {
    next(err);
  }
};

exports.listStudents = async (req, res, next) => {
  try {
    const students = await Student.find()
      .populate("user", "userId isActive")
      .sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    next(err);
  }
};
