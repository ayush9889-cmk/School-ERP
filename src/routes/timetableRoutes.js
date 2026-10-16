const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  getClassTimetable,
  saveClassTimetable,
  teacherTimetable,
  studentTimetable,
} = require("../controllers/timetableController");

router.use(auth);

router.get("/class", authorize("admin"), getClassTimetable);
router.put("/class", authorize("admin"), saveClassTimetable);
router.get("/mine", authorize("teacher"), teacherTimetable);
router.get("/my-class", authorize("student"), studentTimetable);

module.exports = router;
