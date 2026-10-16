const Class = require("../models/Class");
const Teacher = require("../models/Teacher");

exports.createClass = async (req, res, next) => {
  try {
    const { name, sections } = req.body;
    if (!name) return res.status(400).json({ message: "Class name required" });

    const exists = await Class.findOne({ name: String(name).trim() });
    if (exists)
      return res.status(409).json({ message: "Class already exists" });

    const cls = await Class.create({
      name,
      sections: (sections || ["A"]).map((s) => String(s).trim().toUpperCase()),
    });
    res.status(201).json(cls);
  } catch (err) {
    next(err);
  }
};

exports.listClasses = async (req, res, next) => {
  try {
    const classes = await Class.find()
      .populate("classTeachers.teacher", "name")
      .sort({ name: 1 });
    res.json(classes);
  } catch (err) {
    next(err);
  }
};

exports.addSection = async (req, res, next) => {
  try {
    const section = String(req.body.section || "")
      .trim()
      .toUpperCase();
    if (!section) return res.status(400).json({ message: "Section required" });

    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: "Class not found" });
    if (cls.sections.includes(section)) {
      return res.status(409).json({ message: "Section already exists" });
    }

    cls.sections.push(section);
    await cls.save();
    res.json(cls);
  } catch (err) {
    next(err);
  }
};

exports.setClassTeacher = async (req, res, next) => {
  try {
    const section = String(req.body.section || "")
      .trim()
      .toUpperCase();
    const { teacherId } = req.body;

    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: "Class not found" });
    if (!cls.sections.includes(section)) {
      return res
        .status(400)
        .json({ message: "Section not found in this class" });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    cls.classTeachers = cls.classTeachers.filter((c) => c.section !== section);
    cls.classTeachers.push({ section, teacher: teacher._id });
    await cls.save();

    res.json(cls);
  } catch (err) {
    next(err);
  }
};
