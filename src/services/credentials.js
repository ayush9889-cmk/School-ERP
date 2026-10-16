const crypto = require("crypto");
const User = require("../models/User");

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#";

function generatePassword(length = 8) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARS[crypto.randomInt(0, CHARS.length)];
  }
  return out;
}

async function generateUserId(prefix) {
  const year = new Date().getFullYear();
  for (let i = 0; i < 10; i++) {
    const num = crypto.randomInt(1000, 10000);
    const userId = `${prefix}${year}${num}`;
    const exists = await User.exists({ userId });
    if (!exists) return userId;
  }
  throw new Error("Could not generate unique userId");
}

module.exports = { generatePassword, generateUserId };
