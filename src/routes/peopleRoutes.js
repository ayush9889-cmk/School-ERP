const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  listStudents,
  studentDetails,
  updateStudent,
  teacherDetails,
  updateTeacher,
} = require("../controllers/peopleController");

router.use(auth, authorize("admin"));

router.get("/students", listStudents);
router.get("/students/:id", studentDetails);
router.put("/students/:id", updateStudent);

router.get("/teachers/:id", teacherDetails);
router.put("/teachers/:id", updateTeacher);

module.exports = router;
