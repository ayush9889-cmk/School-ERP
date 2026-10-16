const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  getMarksSheet,
  saveMarks,
  myResults,
  classResult,
} = require("../controllers/resultController");

router.use(auth);

router.get("/sheet", authorize("teacher", "admin"), getMarksSheet);
router.post("/marks", authorize("teacher", "admin"), saveMarks);
router.get("/class", authorize("teacher", "admin"), classResult);

router.get("/me", authorize("student"), myResults);

module.exports = router;
