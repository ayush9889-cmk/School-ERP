const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  admitStudent,
  resendCredentials,
  listStudents,
} = require("../controllers/admissionController");
const {
  admitTeacher,
  listTeachers,
  assignClasses,
  resendCredentials: resendTeacherCredentials,
} = require("../controllers/teacherController");

router.use(auth, authorize("admin"));

// Students
router.post("/student", admitStudent);
router.get("/students", listStudents);
router.post("/student/:id/resend-credentials", resendCredentials);

// Teachers
router.post("/teacher", admitTeacher);
router.get("/teachers", listTeachers);
router.put("/teacher/:id/classes", assignClasses);
router.post("/teacher/:id/resend-credentials", resendTeacherCredentials);

module.exports = router;
