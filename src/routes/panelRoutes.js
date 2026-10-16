const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  teacherOverview,
  studentMe,
} = require("../controllers/panelController");
const { myNotices } = require("../controllers/feedController");

router.use(auth);

router.get("/teacher/overview", authorize("teacher"), teacherOverview);
router.get("/student/me", authorize("student"), studentMe);
router.get("/notices", authorize("teacher", "student"), myNotices);

module.exports = router;
