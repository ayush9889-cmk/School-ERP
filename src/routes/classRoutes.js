const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  createClass,
  listClasses,
  addSection,
  setClassTeacher,
} = require("../controllers/classController");

router.use(auth);

// Teacher ko bhi classes dikhni chahiye (attendance ke time kaam aayega)
router.get("/", authorize("admin", "teacher"), listClasses);

router.post("/", authorize("admin"), createClass);
router.post("/:id/sections", authorize("admin"), addSection);
router.put("/:id/class-teacher", authorize("admin"), setClassTeacher);

module.exports = router;
