const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const auth = require("../middleware/auth");
const { login, me, changePassword } = require("../controllers/authController");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many login attempts, try again later" },
});

router.post("/login", loginLimiter, login);
router.get("/me", auth, me);
router.post("/change-password", auth, changePassword);

module.exports = router;
