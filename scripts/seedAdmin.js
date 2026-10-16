require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

(async () => {
  await connectDB();

  const exists = await User.findOne({ userId: "admin" });
  if (exists) {
    console.log("Admin already exists");
    process.exit(0);
  }

  await User.create({
    userId: "admin",
    passwordHash: await bcrypt.hash(
      process.env.ADMIN_PASSWORD || "Admin@12345",
      10,
    ),
    role: "admin",
    name: "School Admin",
    mustChangePassword: false,
  });

  console.log("Admin created -> userId: admin");
  process.exit(0);
})();
