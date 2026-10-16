const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  getClassSheet,
  markAttendance,
  myAttendance,
  studentAttendance,
  adminSummary,
} = require("../controllers/attendanceController");

router.use(auth);

router.get("/sheet", authorize("teacher", "admin"), getClassSheet);
router.post("/", authorize("teacher", "admin"), markAttendance);

router.get("/me", authorize("student"), myAttendance);
router.get("/summary", authorize("admin"), adminSummary);
router.get("/student/:studentId", authorize("admin"), studentAttendance);

module.exports = router;
