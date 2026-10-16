const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Teacher = require("../models/Teacher");
const Class = require("../models/Class");
const { generatePassword, generateUserId } = require("../services/credentials");
const { sendCredentials } = require("../services/whatsapp");

async function validateClasses(classes = []) {
  for (const c of classes) {
    const cls = await Class.findOne({ name: c.className });
    if (!cls || !cls.sections.includes(String(c.section).toUpperCase())) {
      return `Class ${c.className}-${c.section} does not exist`;
    }
    if (!c.subject) return "Subject required for every class entry";
  }
  return null;
}

exports.admitTeacher = async (req, res, next) => {
  let user;
  try {
    const { name, phone, qualification, subjects, classes } = req.body;

    if (!name || !phone) {
      return res
        .status(400)
        .json({ message: "name and phone (WhatsApp) are required" });
    }

    const classError = await validateClasses(classes);
    if (classError) return res.status(400).json({ message: classError });

    const userId = await generateUserId("TCH");
    const password = generatePassword();

    user = await User.create({
      userId,
      passwordHash: await bcrypt.hash(password, 10),
      role: "teacher",
      name,
      mustChangePassword: true,
    });

    const teacher = await Teacher.create({
      user: user._id,
      name,
      phone,
      qualification,
      subjects: subjects || [],
      classes: classes || [],
    });

    const whatsapp = await sendCredentials({
      phone,
      studentName: name,
      role: "teacher",
      userId,
      password,
    });

    res.status(201).json({
      message: "Teacher added",
      teacher,
      credentials: { userId, password },
      whatsapp,
    });
  } catch (err) {
    if (user) await User.findByIdAndDelete(user._id); // rollback
    next(err);
  }
};

exports.listTeachers = async (req, res, next) => {
  try {
    const teachers = await Teacher.find()
      .populate("user", "userId isActive")
      .sort({ createdAt: -1 });
    res.json(teachers);
  } catch (err) {
    next(err);
  }
};

exports.assignClasses = async (req, res, next) => {
  try {
    const { classes } = req.body;
    if (!Array.isArray(classes)) {
      return res.status(400).json({ message: "classes array required" });
    }

    const classError = await validateClasses(classes);
    if (classError) return res.status(400).json({ message: classError });

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { classes },
      { new: true },
    );
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    res.json(teacher);
  } catch (err) {
    next(err);
  }
};

exports.resendCredentials = async (req, res, next) => {
  try {
    const teacher = await Teacher.findById(req.params.id).populate("user");
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    const password = generatePassword();
    teacher.user.passwordHash = await bcrypt.hash(password, 10);
    teacher.user.mustChangePassword = true;
    await teacher.user.save();

    const whatsapp = await sendCredentials({
      phone: teacher.phone,
      studentName: teacher.name,
      role: "teacher",
      userId: teacher.user.userId,
      password,
    });

    res.json({
      message: "New password generated",
      credentials: { userId: teacher.user.userId, password },
      whatsapp,
    });
  } catch (err) {
    next(err);
  }
};
