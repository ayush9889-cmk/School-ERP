const router = require("express").Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  assignFee,
  deleteCharge,
  feeOverview,
  listFeeStudents,
  studentLedger,
  recordPayment,
  voidPayment,
  myFees,
} = require("../controllers/feesController");

router.use(auth);

router.get("/me", authorize("student"), myFees);

router.post("/charges", authorize("admin"), assignFee);
router.delete("/charges/:id", authorize("admin"), deleteCharge);
router.get("/overview", authorize("admin"), feeOverview);
router.get("/students", authorize("admin"), listFeeStudents);
router.get("/students/:id", authorize("admin"), studentLedger);
router.post("/students/:id/payments", authorize("admin"), recordPayment);
router.post("/payments/:id/void", authorize("admin"), voidPayment);

module.exports = router;
