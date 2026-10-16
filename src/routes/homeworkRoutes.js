const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  createHomework,
  teacherHomework,
  studentHomework,
  deleteHomework,
} = require("../controllers/homeworkController");

router.use(auth);

router.post("/", authorize("teacher"), createHomework);
router.get("/mine", authorize("teacher"), teacherHomework);
router.get("/my-class", authorize("student"), studentHomework);
router.delete("/:id", authorize("teacher", "admin"), deleteHomework);

module.exports = router;
