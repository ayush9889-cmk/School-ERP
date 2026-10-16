const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  createNotice,
  listNotices,
  deleteNotice,
} = require("../controllers/noticeController");

router.use(auth);

// sab login users dekh sakte hain, controller role ke hisaab se filter karta hai
router.get("/", listNotices);

// sirf admin banata aur delete karta hai
router.post("/", authorize("admin"), createNotice);
router.delete("/:id", authorize("admin"), deleteNotice);

module.exports = router;
