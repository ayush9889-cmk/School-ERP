const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  createExam,
  listExams,
  setPublished,
} = require("../controllers/examController");

router.use(auth);

router.get("/", authorize("admin", "teacher", "student"), listExams);
router.post("/", authorize("admin"), createExam);
router.put("/:id/publish", authorize("admin"), setPublished);

module.exports = router;
