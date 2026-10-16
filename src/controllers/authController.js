const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

exports.login = async (req, res, next) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) {
      return res.status(400).json({ message: "userId and password required" });
    }

    const user = await User.findOne({ userId: userId.trim() });
    const ok =
      user &&
      user.isActive &&
      (await bcrypt.compare(password, user.passwordHash));
    if (!ok)
      return res.status(401).json({ message: "Invalid userId or password" });

    res.json({
      token: signToken(user),
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  const u = req.user;
  res.json({
    id: u._id,
    userId: u.userId,
    name: u.name,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
  });
};

exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "New password must be at least 8 characters" });
    }

    const user = req.user;
    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Old password is wrong" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    res.json({ message: "Password changed" });
  } catch (err) {
    next(err);
  }
};
